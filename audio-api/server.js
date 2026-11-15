'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 3000);
const API_KEY = process.env.AUDIO_API_KEY || '';
const AUDIO_DIR = path.resolve(process.env.AUDIO_DIR || path.join(__dirname, 'tracks'));
const TYPES = { '.mp3':'audio/mpeg', '.m4a':'audio/mp4', '.ogg':'audio/ogg', '.wav':'audio/wav', '.flac':'audio/flac' };

if (API_KEY.length < 32) {
  console.error('Set AUDIO_API_KEY to a secret of at least 32 characters.');
  process.exit(1);
}
function normalize(s) {
  return s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/\.[a-z0-9]+$/i, '').replace(/[^a-z0-9]+/g, ' ').trim();
}
function authorized(req) {
  const actual = Buffer.from(req.headers.authorization || '');
  const expected = Buffer.from('Bearer ' + API_KEY);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}
function findTrack(query) {
  const wanted = normalize(query);
  if (!wanted) return null;
  const words = wanted.split(/\s+/);
  const files = fs.readdirSync(AUDIO_DIR, { withFileTypes: true })
    .filter(e => e.isFile() && TYPES[path.extname(e.name).toLowerCase()])
    .map(e => e.name);
  let best = null, bestScore = 0;
  for (const name of files) {
    const candidate = normalize(name), parts = candidate.split(/\s+/);
    const score = candidate === wanted ? 1000 : candidate.includes(wanted) ? 500 :
      (words.every(w => parts.some(p => p.includes(w))) ? words.length * 10 : 0);
    if (score > bestScore) { best = name; bestScore = score; }
  }
  return best;
}
const server = http.createServer((req, res) => {
  let url;
  try { url = new URL(req.url, 'http://localhost'); }
  catch { res.writeHead(400); return res.end('Bad request'); }
  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type':'application/json' });
    return res.end(JSON.stringify({ status:'ok' }));
  }
  if (req.method !== 'GET' || url.pathname !== '/audio') {
    res.writeHead(404); return res.end('Not found');
  }
  if (!authorized(req)) { res.writeHead(401); return res.end('Unauthorized'); }
  const query = (url.searchParams.get('q') || '').trim();
  if (!query || query.length > 160) { res.writeHead(400); return res.end('Enter a valid track name'); }
  try {
    if (!fs.existsSync(AUDIO_DIR)) { res.writeHead(503); return res.end('Audio library is not configured'); }
    const filename = findTrack(query);
    if (!filename) { res.writeHead(404); return res.end('No matching track in the authorized audio library'); }
    const filePath = path.join(AUDIO_DIR, filename);
    const stat = fs.statSync(filePath);
    if (!stat.isFile() || stat.size < 1) { res.writeHead(404); return res.end('Audio file unavailable'); }
    if (stat.size > 25 * 1024 * 1024) { res.writeHead(413); return res.end('Audio file exceeds 25 MB'); }
    const ext = path.extname(filename).toLowerCase();
    res.writeHead(200, { 'Content-Type':TYPES[ext], 'Content-Length':stat.size,
      'Content-Disposition':'attachment', 'X-Track-Name':encodeURIComponent(path.basename(filename, ext)),
      'Cache-Control':'no-store' });
    const stream = fs.createReadStream(filePath);
    stream.on('error', err => { console.error('[STREAM]', err.message); res.destroy(err); });
    stream.pipe(res);
  } catch (err) { console.error('[API]', err.message); if (!res.headersSent) res.writeHead(500); res.end('Internal server error'); }
});
server.listen(PORT, '0.0.0.0', () => console.log('GREAT DEMON Audio API listening on ' + PORT));
