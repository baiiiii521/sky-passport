// Copy the site's heavy static files to the COS bucket (prefix static/), so browsers and the mini program fetch them from
// object storage instead of the box's 3 Mbps line. nginx answers those paths with a 302 to the bucket (see deploy/COS.md).
//   set -a; . /srv/sky-passport/cos.env; set +a; node server/cos_sync.js [--check]
// Text files are stored gzipped (Content-Encoding: gzip). Only changed files are uploaded (manifest: cos_sync.json).
// Run it after every deploy that touches fonts/, vendor/, sfx/, mp/, promo/ or the three JSON data files.
'use strict';
const fs = require('fs');
const path = require('path');
const https = require('https');
const zlib = require('zlib');
const crypto = require('crypto');
const PUB = path.join(__dirname, '..', 'public'), MAN = path.join(__dirname, '..', 'cos_sync.json');
const E = process.env; if (!(E.COS_BUCKET && E.COS_REGION && E.COS_SECRET_ID && E.COS_SECRET_KEY)) { console.error('COS_* not set'); process.exit(1); }
const HOST = `${E.COS_BUCKET}.cos.${E.COS_REGION}.myqcloud.com`;
const TYPES = { '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.jpg': 'image/jpeg', '.png': 'image/png' };
const GZ = new Set(['.js', '.json', '.css', '.svg']);
const walk = d => fs.readdirSync(path.join(PUB, d)).filter(f => !f.startsWith('.')).flatMap(f => (fs.statSync(path.join(PUB, d, f)).isDirectory() ? walk(d + '/' + f) : [d + '/' + f]));
const files = [...['mp', 'promo', 'fonts', 'sfx', 'vendor'].filter(d => fs.existsSync(path.join(PUB, d))).flatMap(walk), 'airports.json', 'world-50m.json', 'china.json'].filter(f => TYPES[path.extname(f)]);
function req(method, key, headers, body) {
  return new Promise((resolve, reject) => {
    const now = Math.floor(Date.now() / 1000), kt = `${now - 60};${now + 900}`, hm = (k, v) => crypto.createHmac('sha1', k).update(v).digest('hex'), p = '/' + key.split('/').map(encodeURIComponent).join('/');
    const sig = hm(hm(E.COS_SECRET_KEY, kt), `sha1\n${kt}\n${crypto.createHash('sha1').update(`${method.toLowerCase()}\n/${key}\n\n\n`).digest('hex')}\n`);
    const r = https.request({ host: HOST, path: p, method, timeout: 120000, headers: { ...headers, ...(method === 'PUT' ? { Authorization: `q-sign-algorithm=sha1&q-ak=${E.COS_SECRET_ID}&q-sign-time=${kt}&q-key-time=${kt}&q-header-list=&q-url-param-list=&q-signature=${sig}` } : {}) } },
      res => { let b = ''; res.on('data', d => { b += d; }); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: b })); });
    r.on('timeout', () => r.destroy(new Error('timeout'))); r.on('error', reject); r.end(body);
  });
}
(async () => {
  const check = process.argv.includes('--check'); let man = {}; try { man = JSON.parse(fs.readFileSync(MAN, 'utf8')); } catch (e) {}
  let up = 0, skip = 0, bad = 0, bytes = 0; const q = [...files];
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (q.length) {
      const f = q.shift(), ext = path.extname(f), raw = fs.readFileSync(path.join(PUB, f)), md5 = crypto.createHash('md5').update(raw).digest('hex'), key = 'static/' + f;
      if (check) { const r = await req('HEAD', key, {}); if (r.status !== 200) { bad++; console.log('MISSING', f, r.status); } continue; }
      if (man[f] === md5) { skip++; continue; }
      const gz = GZ.has(ext), body = gz ? zlib.gzipSync(raw, { level: 9 }) : raw;
      // hashed font files never change; versioned (?v=) scripts and data can be cached long; images and films a day
      const cc = /^fonts\/.*\.woff2?$/.test(f) ? 'public, max-age=31536000, immutable' : /^(mp|promo)\//.test(f) ? 'public, max-age=86400' : 'public, max-age=2592000';
      const r = await req('PUT', key, { 'Content-Type': TYPES[ext], 'Content-Length': body.length, 'Cache-Control': cc, ...(gz ? { 'Content-Encoding': 'gzip' } : {}) }, body);
      if (r.status === 200) { man[f] = md5; up++; bytes += body.length; } else { bad++; console.log('FAILED', f, r.status, r.body.slice(0, 120)); }
    }
  }));
  if (!check) fs.writeFileSync(MAN, JSON.stringify(man));
  console.log(check ? `checked ${files.length} files, missing ${bad}` : `uploaded ${up} (${(bytes / 1048576).toFixed(1)} MB), unchanged ${skip}, failed ${bad}, total ${files.length}`);
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
