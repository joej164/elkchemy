#!/usr/bin/env node
// Hosting for https://elkchemy.web.app: one Firebase release serves the published game at / and the development
// preview at /dev/. Firebase deploys a whole release at once, so every deploy re-uploads the published game: it comes from
// hosting/root/ (the exact published files, recorded in hosting/root.json), never from a fresh build of the working tree.
//
//   node hosting/hosting.mjs prepare      verified root + dist-dev/ (npm run build:dev) → hosting/public/, then check
//   node hosting/hosting.mjs check        hosting/public/ and firebase.json are safe to deploy (firebase predeploy runs it)
//   node hosting/hosting.mjs check-live   the live site's root files still match hosting/root.json (read-only, HTTPS)
//   node hosting/hosting.mjs promote DIR  intentional production promotion: DIR (a production build) becomes the root
//
// No dependencies; Node 20+.
import { createHash } from 'node:crypto';
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const PROJECT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const PATHS = {
  root: join(PROJECT, 'hosting/root'), manifest: join(PROJECT, 'hosting/root.json'), dev: join(PROJECT, 'dist-dev'),
  out: join(PROJECT, 'hosting/public'), firebase: join(PROJECT, 'firebase.json'),
};
/** The development preview's folder in the release, and its URL path. */
export const DEV_DIR = 'dev';
export const DEV_BASE = `/${DEV_DIR}/`;
export const PUBLIC = 'hosting/public';
export const PREDEPLOY = 'node hosting/hosting.mjs check';
export const LIVE = 'https://elkchemy.web.app';

/** Every file under `dir`, as sorted relative paths with forward slashes. */
export async function listFiles(dir) {
  const out = [];
  const walk = async (d) => {
    for (const e of await readdir(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) await walk(p); else out.push(relative(dir, p).split(sep).join('/'));
    }
  };
  await walk(dir);
  return out.sort();
}

export const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
/** Firebase Hosting's file hash: SHA-256 of the gzip (level 9) the CLI uploads. Comparable with the Hosting API's list. */
export const firebaseHash = (buf) => sha256(gzipSync(buf, { level: 9 }));

const exists = (p) => stat(p).then(() => true, () => false);
const readJson = async (p) => JSON.parse(await readFile(p, 'utf8'));

/**
 * Problems with `dir` as the published root: each recorded file present with its exact bytes, and no other file except
 * under `allowed` (the preview's folder, when checking a release). Empty when it is exactly the recorded root.
 */
export async function checkRoot(dir, manifest, allowed = null) {
  if (!(await exists(dir))) return [`${dir} is missing`];
  const problems = [];
  const recorded = new Map(manifest.files.map((f) => [f.path, f]));
  for (const path of await listFiles(dir)) {
    if (allowed && path.startsWith(`${allowed}/`)) continue;
    const f = recorded.get(path);
    if (!f) { problems.push(`root: unexpected file ${path}`); continue; }
    const buf = await readFile(join(dir, path));
    if (buf.length !== f.bytes || sha256(buf) !== f.sha256) problems.push(`root: ${path} differs from the published file`);
    recorded.delete(path);
  }
  for (const path of recorded.keys()) problems.push(`root: ${path} is missing`);
  return problems;
}

const ROOT_URL = /[`"'(](?:\/(?:assets|audio|icons)\/|\/version\.json|\/\?update=)/;

/**
 * Problems with `dir` as the development preview: a dev build (npm run build:dev) whose page, assets, version and manifest
 * all stay under /dev/, so it never loads, checks or installs the published game's files.
 */
export async function checkDev(dir) {
  if (!(await exists(join(dir, 'index.html')))) return [`${dir}/index.html is missing: run npm run build:dev`];
  const problems = [];
  const html = await readFile(join(dir, 'index.html'), 'utf8');
  if (!html.includes('Development preview')) problems.push('dev: index.html is not the development preview');
  for (const [, url] of html.matchAll(/(?:src|href)="([^"]*)"/g)) {
    if (!url.startsWith(DEV_BASE) && !/^(?:https?:|data:|#)/.test(url)) problems.push(`dev: index.html refers to ${url}, outside ${DEV_BASE}`);
  }
  const version = await readJson(join(dir, 'version.json')).catch(() => null);
  if (typeof version?.build !== 'string' || !version.build.startsWith('dev-')) problems.push('dev: version.json is not a dev build id');
  const manifest = await readJson(join(dir, 'manifest.webmanifest')).catch(() => null);
  if (!manifest || [manifest.start_url, manifest.scope, manifest.id].some((u) => u !== DEV_BASE) ||
    manifest.icons?.some((i) => !i.src.startsWith(DEV_BASE))) problems.push(`dev: manifest.webmanifest must start, scope and install under ${DEV_BASE}`);
  for (const path of await listFiles(dir)) {
    if (!/\.(?:js|css)$/.test(path)) continue;
    if (ROOT_URL.test(await readFile(join(dir, path), 'utf8'))) problems.push(`dev: ${path} refers to a root URL (/assets, /audio, /icons, /version.json or /?update=)`);
  }
  return problems;
}

/**
 * Problems with firebase.json: it deploys only the prepared release, runs the check first, keeps every production header
 * rule recorded with the root, and adds rules (headers, redirects) only for /dev. Nothing else may change how / behaves.
 */
export function checkConfig(config, manifest) {
  const hosting = config?.hosting;
  if (!hosting || Array.isArray(hosting)) return ['firebase.json: expected a single hosting entry'];
  const problems = [];
  if (hosting.public !== PUBLIC) problems.push(`firebase.json: public must be ${PUBLIC}`);
  const predeploy = [hosting.predeploy ?? []].flat();
  if (!predeploy.includes(PREDEPLOY)) problems.push(`firebase.json: predeploy must run "${PREDEPLOY}"`);
  if (JSON.stringify(hosting.ignore) !== JSON.stringify(manifest.config.ignore)) problems.push('firebase.json: ignore changed');
  const headers = hosting.headers ?? [];
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  for (const rule of manifest.config.headers) {
    if (!headers.some((h) => same(h, rule))) problems.push(`firebase.json: production header rule for ${rule.source} changed or missing`);
  }
  for (const rule of headers) {
    if (!manifest.config.headers.some((r) => same(r, rule)) && !String(rule.source).startsWith(`/${DEV_DIR}`)) {
      problems.push(`firebase.json: header rule for ${rule.source} is outside /${DEV_DIR}`);
    }
  }
  for (const rule of hosting.redirects ?? []) {
    if (!String(rule.source).startsWith(`/${DEV_DIR}`) || !String(rule.destination).startsWith(DEV_BASE)) {
      problems.push(`firebase.json: redirect ${rule.source} → ${rule.destination} is outside /${DEV_DIR}`);
    }
  }
  const allowed = new Set(['public', 'ignore', 'headers', 'redirects', 'predeploy']);
  for (const key of Object.keys(hosting)) if (!allowed.has(key)) problems.push(`firebase.json: hosting.${key} would change the published game`);
  return problems;
}

/** Problems with `dir` as a release: the exact published root, the preview under dev/, and distinct build ids. */
export async function checkRelease(dir, manifest, config) {
  const problems = [...await checkRoot(dir, manifest, DEV_DIR), ...await checkDev(join(dir, DEV_DIR)), ...checkConfig(config, manifest)];
  const dev = await readJson(join(dir, DEV_DIR, 'version.json')).catch(() => null);
  if (dev?.build === manifest.build) problems.push('dev and root have the same build id');
  return problems;
}

/** The record of a published root: its build, source commit, every file's bytes and hashes, and production's rules. */
export async function recordManifest(dir, config, extra = {}) {
  const files = [];
  for (const path of await listFiles(dir)) {
    const buf = await readFile(join(dir, path));
    files.push({ path, bytes: buf.length, sha256: sha256(buf), firebaseHash: firebaseHash(buf) });
  }
  const headers = (config.hosting.headers ?? []).filter((h) => !String(h.source).startsWith(`/${DEV_DIR}`));
  return {
    build: (await readJson(join(dir, 'version.json'))).build,
    ...extra,
    config: { ignore: config.hosting.ignore, headers },
    files,
  };
}

const report = (problems, ok) => {
  if (problems.length === 0) { console.log(ok); return true; }
  console.error(`✗ ${problems.length} problem${problems.length === 1 ? '' : 's'}:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
  process.exitCode = 1;
  return false;
};

async function prepare() {
  const manifest = await readJson(PATHS.manifest);
  const before = [...await checkRoot(PATHS.root, manifest), ...await checkDev(PATHS.dev)];
  if (!report(before, `✓ hosting/root is the published build ${manifest.build}; dist-dev is a development preview`)) return;
  await rm(PATHS.out, { recursive: true, force: true });
  await mkdir(PATHS.out, { recursive: true });
  await cp(PATHS.root, PATHS.out, { recursive: true });
  await cp(PATHS.dev, join(PATHS.out, DEV_DIR), { recursive: true });
  await check();
}

async function check() {
  const manifest = await readJson(PATHS.manifest);
  const problems = await checkRelease(PATHS.out, manifest, await readJson(PATHS.firebase));
  const dev = await readJson(join(PATHS.out, DEV_DIR, 'version.json')).catch(() => ({}));
  report(problems, `✓ ${PUBLIC}: / is the published build ${manifest.build} (${manifest.files.length} files, byte-identical); ` +
    `${DEV_BASE} is ${dev.build}; firebase.json changes only ${DEV_BASE}`);
}

async function checkLive() {
  const manifest = await readJson(PATHS.manifest);
  const problems = [];
  for (const f of manifest.files) {
    const res = await fetch(`${LIVE}/${f.path}`, { cache: 'no-store' });
    if (!res.ok) { problems.push(`live: /${f.path} answered ${res.status}`); continue; }
    if (sha256(Buffer.from(await res.arrayBuffer())) !== f.sha256) problems.push(`live: /${f.path} differs from hosting/root`);
  }
  report(problems, `✓ ${LIVE}/ serves exactly hosting/root (build ${manifest.build}, ${manifest.files.length} files)`);
}

/**
 * An intentional production promotion: `dir` (a production build: npm run build, from a reviewed commit) replaces
 * hosting/root and its record. Refuses a dev build. The release is then prepared, checked and deployed as usual.
 */
async function promote(dir) {
  if (!dir) { report(['usage: node hosting/hosting.mjs promote DIR'], ''); return; }
  const src = resolve(dir);
  const version = await readJson(join(src, 'version.json')).catch(() => null);
  const html = await readFile(join(src, 'index.html'), 'utf8').catch(() => '');
  if (!version?.build || version.build.startsWith('dev-') || html.includes('Development preview') || html.includes(DEV_BASE)) {
    report([`${dir} is not a production build (npm run build)`], ''); return;
  }
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: PROJECT, encoding: 'utf8' }).trim();
  const dirty = execFileSync('git', ['status', '--porcelain'], { cwd: PROJECT, encoding: 'utf8' }).trim() !== '';
  await rm(PATHS.root, { recursive: true, force: true });
  await cp(src, PATHS.root, { recursive: true });
  const manifest = await recordManifest(PATHS.root, await readJson(PATHS.firebase), {
    source: { commit, workingTreeClean: !dirty }, published: null,
  });
  await writeFile(PATHS.manifest, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`hosting/root is now build ${manifest.build} from ${commit}${dirty ? ' (working tree not clean!)' : ''}. ` +
    'Review and commit hosting/, then prepare, check and deploy; record the published release in hosting/root.json.');
}

const commands = { prepare, check, 'check-live': checkLive, promote };
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [name, ...args] = process.argv.slice(2);
  const command = commands[name];
  if (!command) {
    console.error(`usage: node hosting/hosting.mjs ${Object.keys(commands).join(' | ')}`);
    process.exitCode = 2;
  } else {
    await command(...args);
  }
}
