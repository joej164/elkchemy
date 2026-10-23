import { readFile, writeFile } from 'node:fs/promises';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// `vite build --mode dev` (npm run build:dev) makes the development preview: served from /dev/, written to dist-dev/,
// its build id prefixed `dev-`, with its own version.json, title and manifest. Every other build is the ordinary game
// at /, written to dist/. Neither output is deployed directly: see scripts/hosting.mjs.
export const DEV_MODE = 'dev';
export const DEV_BASE = '/dev/';

// Computed once per config load; ELKCHEMY_BUILD_ID overrides the UTC timestamp.
const timestamp = new Date().toISOString().replace(/\.\d+Z$/, '').replace(/[-:]/g, '').replace('T', '-');

function versionPlugin(buildId: string): Plugin {
  const versionJson = `${JSON.stringify({ build: buildId })}\n`;
  return {
    name: 'elkchemy-version',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: versionJson });
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.method === 'GET' && (req.url ?? '').split('?')[0] === '/version.json') {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store');
          res.end(versionJson);
          return;
        }
        next();
      });
    },
  };
}

/**
 * The development preview is marked as such, and installs (Add to Home Screen) as its own app: its title, and a manifest
 * (rewritten after the public folder is copied) whose start, scope, id and icons stay under /dev/. Production's are untouched.
 */
function devPreviewPlugin(outDir: string): Plugin {
  return {
    name: 'elkchemy-dev-preview',
    transformIndexHtml: (html) => html.replace('<title>Elkchemy</title>', '<title>Elkchemy — Development preview</title>'),
    async closeBundle() {
      const file = `${outDir}/manifest.webmanifest`;
      const manifest = JSON.parse(await readFile(file, 'utf8'));
      const dev = {
        ...manifest, name: 'Elkchemy (Development preview)', short_name: 'Elkchemy Dev', id: DEV_BASE, start_url: DEV_BASE, scope: DEV_BASE,
        icons: manifest.icons.map((icon: { src: string }) => ({ ...icon, src: `${DEV_BASE}${icon.src.replace(/^\//, '')}` })),
      };
      await writeFile(file, `${JSON.stringify(dev, null, 2)}\n`);
    },
  };
}

export default defineConfig(({ mode }) => {
  const dev = mode === DEV_MODE;
  const buildId = process.env.ELKCHEMY_BUILD_ID || (dev ? `dev-${timestamp}` : timestamp);
  const outDir = dev ? 'dist-dev' : 'dist';
  return {
    base: dev ? DEV_BASE : '/',
    plugins: [react(), versionPlugin(buildId), ...(dev ? [devPreviewPlugin(outDir)] : [])],
    define: { __BUILD_ID__: JSON.stringify(buildId), __DEV_PREVIEW__: JSON.stringify(dev) },
    // The polyfill fetches preload links at runtime; the only fetch is the on-demand update check.
    build: { outDir, modulePreload: { polyfill: false } },
  };
});
