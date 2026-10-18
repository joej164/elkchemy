import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Computed once per config load; ELKCHEMY_BUILD_ID overrides the UTC timestamp.
const buildId =
  process.env.ELKCHEMY_BUILD_ID ||
  new Date().toISOString().replace(/\.\d+Z$/, '').replace(/[-:]/g, '').replace('T', '-');
const versionJson = `${JSON.stringify({ build: buildId })}\n`;

function versionPlugin(): Plugin {
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

export default defineConfig({
  plugins: [react(), versionPlugin()],
  define: { __BUILD_ID__: JSON.stringify(buildId) },
  // The polyfill fetches preload links at runtime; the only fetch is the on-demand update check.
  build: { modulePreload: { polyfill: false } },
});
