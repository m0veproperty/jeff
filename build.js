const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'dist');
const EXCLUDE = new Set([
  'dist',
  'package.json',
  'build.js',
  'server.js',
  'vercel.json',
  'jeffsite-exact-original-npm.zip',
  '.git',
  'node_modules'
]);

function copyTree(src, dst, top = true) {
  fs.mkdirSync(dst, { recursive: true });
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    if (top && EXCLUDE.has(ent.name)) continue;
    const source = path.join(src, ent.name);
    const target = path.join(dst, ent.name);
    if (ent.isDirectory()) copyTree(source, target, false);
    else fs.copyFileSync(source, target);
  }
}

function safePath(value) {
  const decoded = decodeURIComponent(value || '/');
  const normalized = path.posix.normalize(decoded).replace(/^\/+/, '');
  if (normalized.startsWith('..')) throw new Error(`Unsafe public path: ${value}`);
  return normalized || 'index.html';
}

fs.rmSync(OUT, { recursive: true, force: true });
copyTree(ROOT, OUT, true);

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'siteclone.manifest.json'), 'utf8'));
let aliases = 0;

for (const resource of Object.values(manifest.resources || {})) {
  if (!resource.localPath || !resource.publicPath) continue;

  const source = path.join(ROOT, resource.localPath);
  if (!fs.existsSync(source) || !fs.statSync(source).isFile()) continue;

  const url = new URL(resource.publicPath, 'http://local.invalid');
  const publicFile = url.pathname === '/' ? 'index.html' : safePath(url.pathname);
  const target = path.join(OUT, publicFile);

  if (!fs.existsSync(target)) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
    aliases++;
  }
}

if (!fs.existsSync(path.join(OUT, 'index.html'))) {
  throw new Error('dist/index.html was not produced');
}

console.log(`Exact capture copied to dist with ${aliases} manifest aliases.`);
