#!/usr/bin/env node
/* =========================================================
   Something Ventured · demo server
   Zero dependencies (Node 18+). One process serves:
     /          the website (index.html)
     /app/      the member web app (PWA, add to home screen)
     /admin/    the back office
     /api/      the API: POST /api/<method>, live updates on GET /api/stream
   Data lives in server/data/db.json (created from the seed on first run).
   ========================================================= */
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { createReadStream } from 'node:fs';
import { readFile, writeFile, mkdir, rename, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { handle, seed, ApiError } from '../shared/core.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = process.env.SV_DATA_DIR || path.join(ROOT, 'server', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || '0.0.0.0';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.webmanifest', '.svg', '.txt']);
const PRIVATE = /^\/(server|scripts|node_modules)(\/|$)|\/\./;

/* ---------- storage ---------- */
let db;
let timer = null;
async function loadDb() {
  if (!process.argv.includes('--reset')) {
    try {
      const data = JSON.parse(await readFile(DB_FILE, 'utf8'));
      if (data && data.version === 1) { db = data; return 'loaded'; }
    } catch { /* first run */ }
  }
  db = seed(Date.now());
  await flush();
  return 'seeded';
}
function persistSoon() {
  if (!timer) timer = setTimeout(() => { timer = null; flush().catch(err => console.error('save failed', err)); }, 150);
}
async function flush() {
  await mkdir(DATA_DIR, { recursive: true });
  const tmp = DB_FILE + '.tmp';
  await writeFile(tmp, JSON.stringify(db));
  await rename(tmp, DB_FILE);
}

/* ---------- live updates (Server-Sent Events) ---------- */
const clients = new Set();
function broadcast(changed, origin) {
  const msg = `data: ${JSON.stringify({ changed, origin: origin || null })}\n\n`;
  for (const res of clients) res.write(msg);
}
setInterval(() => { for (const res of clients) res.write(': keep-alive\n\n'); }, 25e3).unref();

function stream(req, res) {
  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'x-accel-buffering': 'no',
  });
  res.write('retry: 3000\n\n');
  clients.add(res);
  req.on('close', () => clients.delete(res));
}

/* ---------- API ---------- */
function json(res, status, body) {
  const out = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(out);
}
function readBody(req, limit = 1e6) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > limit) { reject(new ApiError('too_large', '请求太大了', 413)); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
async function api(req, res, method) {
  if (method === 'stream' && req.method === 'GET') return stream(req, res);
  if (req.method !== 'POST') return json(res, 405, { error: { code: 'method', message: '请使用 POST' } });
  if (!/^[a-z][a-z.]*$/i.test(method)) return json(res, 404, { error: { code: 'not_found', message: '未知接口' } });
  try {
    const body = await readBody(req);
    let args = {};
    if (body) {
      try { args = JSON.parse(body); } catch { throw new ApiError('bad_json', '请求格式不正确', 400); }
    }
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || null;
    const { result, changed } = handle(db, { token, method, args, now: Date.now() });
    if (changed.length) {
      persistSoon();
      const visible = changed.filter(t => t !== 'session');
      if (visible.length) broadcast(visible, req.headers['x-sv-origin']);
    }
    json(res, 200, { result });
  } catch (err) {
    if (err instanceof ApiError) return json(res, err.status, { error: { code: err.code, message: err.message } });
    console.error(err);
    json(res, 500, { error: { code: 'internal', message: '服务器出了点问题' } });
  }
}

/* ---------- static files ---------- */
async function serveStatic(req, res, pathname) {
  let rel;
  try { rel = decodeURIComponent(pathname); } catch { rel = '/'; }
  if (PRIVATE.test(rel)) return notFound(res);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.normalize(path.join(ROOT, rel));
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) return notFound(res);
  let info;
  try { info = await stat(file); } catch { return notFound(res); }
  if (info.isDirectory()) {
    res.writeHead(301, { location: pathname + '/' });
    return res.end();
  }
  const ext = path.extname(file).toLowerCase();
  const etag = `W/"${info.size.toString(36)}-${Math.floor(info.mtimeMs).toString(36)}"`;
  const longCache = ext === '.woff2' || ext === '.png' || ext === '.jpg';
  const headers = {
    'content-type': TYPES[ext] || 'application/octet-stream',
    'cache-control': longCache ? 'public, max-age=604800' : 'no-cache',
    etag,
    'x-content-type-options': 'nosniff',
  };
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, headers);
    return res.end();
  }
  const gzip = COMPRESSIBLE.has(ext) && /\bgzip\b/.test(req.headers['accept-encoding'] || '') && info.size > 1024;
  if (gzip) { headers['content-encoding'] = 'gzip'; headers.vary = 'accept-encoding'; } else headers['content-length'] = info.size;
  res.writeHead(200, headers);
  if (req.method === 'HEAD') return res.end();
  const src = createReadStream(file);
  src.on('error', () => res.destroy());
  (gzip ? src.pipe(zlib.createGzip()) : src).pipe(res);
}
function notFound(res) {
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('Not found');
}

/* ---------- boot ---------- */
const how = await loadDb();
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) return api(req, res, url.pathname.slice(5));
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
  serveStatic(req, res, url.pathname).catch(err => { console.error(err); if (!res.headersSent) notFound(res); });
});

server.listen(PORT, HOST, () => {
  const lan = Object.values(os.networkInterfaces()).flat().filter(i => i && i.family === 'IPv4' && !i.internal).map(i => i.address);
  console.log(`\n  Something Ventured · demo server (${how === 'seeded' ? 'fresh seed' : 'data loaded'}: ${path.relative(ROOT, DB_FILE)})\n`);
  console.log(`  官网      http://localhost:${PORT}/`);
  console.log(`  会员端    http://localhost:${PORT}/app/`);
  console.log(`  管理后台  http://localhost:${PORT}/admin/`);
  for (const ip of lan) console.log(`  局域网    http://${ip}:${PORT}/app/`);
  console.log('\n  演示验证码 2026 · 后台 PIN 1215 · 重置数据：npm run reset\n');
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    if (timer) { clearTimeout(timer); await flush().catch(() => {}); }
    process.exit(0);
  });
}
