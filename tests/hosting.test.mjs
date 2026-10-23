import { afterAll, describe, expect, it } from 'vitest';
import { appendFile, cp, mkdir, mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  checkConfig, checkDev, checkRelease, checkRoot, DEV_DIR, firebaseHash, listFiles, PATHS, PREDEPLOY, PUBLIC, sha256,
} from '../hosting/hosting.mjs';

const manifest = JSON.parse(await readFile(PATHS.manifest, 'utf8'));
const config = JSON.parse(await readFile(PATHS.firebase, 'utf8'));
const temp = await mkdtemp(join(tmpdir(), 'elkchemy-hosting-'));
afterAll(() => rm(temp, { recursive: true, force: true }));

let n = 0;
/** A development preview as npm run build:dev makes it, in miniature; `change` swaps one of its parts. */
async function fakeDev(dir, change = {}) {
  await mkdir(join(dir, 'assets'), { recursive: true });
  await writeFile(join(dir, 'index.html'), change.html ?? '<title>Elkchemy — Development preview</title>' +
    '<link rel="icon" href="/dev/icons/favicon-32.png"><script type="module" src="/dev/assets/index.js"></script>');
  await writeFile(join(dir, 'version.json'), JSON.stringify({ build: change.build ?? 'dev-20261023-000000' }));
  await writeFile(join(dir, 'manifest.webmanifest'), JSON.stringify(change.manifest ??
    { start_url: '/dev/', scope: '/dev/', id: '/dev/', icons: [{ src: '/dev/icons/icon-192.png' }] }));
  await writeFile(join(dir, 'assets/index.js'), change.js ?? 'fetch(`/dev/audio/merge-three.wav`);fetch(`/dev/version.json?t=1`)');
  return dir;
}
/** A release as hosting:prepare assembles it: the preserved root, the preview in dev/. */
async function release(change) {
  const dir = join(temp, `release-${n++}`);
  await cp(PATHS.root, dir, { recursive: true });
  await fakeDev(join(dir, DEV_DIR), change);
  return dir;
}
const withHosting = (change) => ({ hosting: { ...config.hosting, ...change } });

describe('hosting: the preserved published root', () => {
  it('is exactly the recorded published build, file for file, with Firebase\'s own hashes', async () => {
    expect(await checkRoot(PATHS.root, manifest)).toEqual([]);
    expect(manifest.build).toBe('20261021-024248');
    expect(JSON.parse(await readFile(join(PATHS.root, 'version.json'), 'utf8')).build).toBe(manifest.build);
    expect(await listFiles(PATHS.root)).toEqual(manifest.files.map((f) => f.path));
    expect(manifest.files).toHaveLength(36);
    for (const f of manifest.files) {
      const buf = await readFile(join(PATHS.root, f.path));
      expect([sha256(buf), firebaseHash(buf)], f.path).toEqual([f.sha256, f.firebaseHash]);
    }
    expect(manifest.published.firebaseVersion).toMatch(/\/sites\/elkchemy\/versions\/9fb0192e2122df23$/);
  });

  it('predates the prototype: no palace entrance, no development preview, nothing under /dev/', async () => {
    const js = manifest.files.filter((f) => f.path.endsWith('.js'));
    expect(js).toHaveLength(1);
    const code = await readFile(join(PATHS.root, js[0].path), 'utf8');
    expect(code).not.toMatch(/Palace entrance prototype|Development preview|\/dev\//);
    expect(manifest.files.some((f) => f.path.startsWith(`${DEV_DIR}/`))).toBe(false);
  });
});

describe('hosting: firebase.json', () => {
  it('deploys only the prepared release, checks it first, and keeps every production rule', () => {
    expect(checkConfig(config, manifest)).toEqual([]);
    expect([config.hosting.public, config.hosting.predeploy]).toEqual([PUBLIC, [PREDEPLOY]]);
    expect(manifest.config.headers.map((h) => h.source)).toEqual(['/', '**/*.html', '/manifest.webmanifest', '/version.json', '/assets/**']);
    // No redirect: Firebase matches redirects regardless of a trailing slash, so /dev → /dev/ would loop on /dev/ itself.
    // A bare /dev reaches the preview through Hosting's own directory handling.
    expect(config.hosting.redirects).toBeUndefined();
  });

  it('refuses anything that would change the published game or deploy something else', () => {
    const cases = [
      [{ public: 'dist' }, /public must be hosting\/public/],
      [{ public: 'dist-dev' }, /public must be hosting\/public/],
      [{ predeploy: [] }, /predeploy must run/],
      [{ ignore: ['**/.*'] }, /ignore changed/],
      [{ headers: config.hosting.headers.filter((h) => h.source !== '/assets/**') }, /rule for \/assets\/\*\* changed or missing/],
      [{ headers: [...config.hosting.headers, { source: '/', headers: [{ key: 'X', value: 'y' }] }] }, /header rule for \/ is outside \/dev/],
      [{ redirects: [{ source: '/', destination: '/dev/', type: 302 }] }, /redirect \/ → \/dev\/ is outside \/dev/],
      [{ redirects: [{ source: '/dev', destination: '/', type: 302 }] }, /redirect \/dev → \/ is outside \/dev/],
      [{ rewrites: [{ source: '**', destination: '/dev/index.html' }] }, /hosting\.rewrites would change the published game/],
      [{ cleanUrls: true }, /hosting\.cleanUrls would change/],
      [{ trailingSlash: false }, /hosting\.trailingSlash would change/],
    ];
    for (const [change, problem] of cases) expect(checkConfig(withHosting(change), manifest).join('\n'), JSON.stringify(change)).toMatch(problem);
  });
});

describe('hosting: a prepared release', () => {
  it('passes with the preserved root at / and a development preview under dev/', async () => {
    expect(await checkRelease(await release(), manifest, config)).toEqual([]);
  });

  it('refuses a changed, added or missing root file', async () => {
    const changed = await release();
    await appendFile(join(changed, 'index.html'), '\n');
    expect(await checkRelease(changed, manifest, config)).toEqual(['root: index.html differs from the published file']);
    const added = await release();
    await writeFile(join(added, 'sandbox.html'), '<p>prototype</p>');
    expect(await checkRelease(added, manifest, config)).toEqual(['root: unexpected file sandbox.html']);
    const missing = await release();
    await unlink(join(missing, 'audio/merge-three.wav'));
    expect(await checkRelease(missing, manifest, config)).toEqual(['root: audio/merge-three.wav is missing']);
  });

  it('refuses a working-tree production build in place of the published root', async () => {
    const dir = join(temp, 'fresh');
    await cp(PATHS.root, dir, { recursive: true });
    await writeFile(join(dir, 'version.json'), JSON.stringify({ build: '20261023-120000' }));
    expect(await checkRoot(dir, manifest)).toEqual(['root: version.json differs from the published file']);
  });

  it('refuses a preview that is missing, not a dev build, or reaches outside /dev/', async () => {
    expect(await checkDev(join(temp, 'nothing-here'))).toEqual([`${join(temp, 'nothing-here')}/index.html is missing: run npm run build:dev`]);
    const cases = [
      [{ html: '<title>Elkchemy</title><script src="/dev/assets/index.js"></script>' }, /not the development preview/],
      [{ html: '<title>Development preview</title><script src="/assets/index.js"></script>' }, /refers to \/assets\/index\.js, outside \/dev\//],
      [{ build: '20261023-120000' }, /not a dev build id/],
      [{ manifest: { start_url: '/', scope: '/', id: '/', icons: [] } }, /manifest\.webmanifest must start, scope and install under \/dev\//],
      [{ js: 'fetch(`/version.json?t=1`)' }, /assets\/index\.js refers to a root URL/],
      [{ js: 'fetch("/audio/merge-three.wav")' }, /assets\/index\.js refers to a root URL/],
      [{ js: 'location.replace(`/?update=x`)' }, /assets\/index\.js refers to a root URL/],
    ];
    for (const [change, problem] of cases) {
      expect((await checkDev(await fakeDev(join(temp, `dev-${n++}`), change))).join('\n'), JSON.stringify(change)).toMatch(problem);
    }
    expect((await checkRelease(await release({ build: manifest.build }), manifest, config)).join('\n')).toMatch(/same build id/);
  });
});
