// Sky Passport · server-side video rendering for the mini program (personal mini programs cannot embed the web page).
// The mini program sends the parsed rows + options; this service opens the real web page in headless Chromium,
// renders every frame with the same engine (renderFrame / synth), and encodes H.264/AAC with ffmpeg.
//   POST /api/video        {rows, opts}  → {id, ahead}
//   GET  /api/video/<id>                 → {state, progress, url, size, seconds}
// Videos live in VIDEO_DIR for 24 h. One job at a time; per-IP and queue limits keep the 4-core box responsive.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const puppeteer = require('puppeteer-core');

const PORT = +process.env.RENDER_PORT || 3102;
// served by nginx on 127.0.0.1:8088 (going through the public address would eat the 3 Mbps uplink)
const PAGE = process.env.RENDER_PAGE || 'http://127.0.0.1:8088/index.html?site=https://passport.nybbq.art';
const CHROME = process.env.CHROME_PATH || '/snap/bin/chromium';
const VIDEO_DIR = process.env.VIDEO_DIR || '/srv/sky-passport/videos';
const TTL = 24 * 3600e3, MAX_QUEUE = 12, PER_IP_HOUR = 5, MAX_ROWS = 1500;
fs.mkdirSync(VIDEO_DIR, { recursive: true });

const jobs = new Map(), byKey = new Map(), queue = [], hits = new Map();
let browser = null, busy = false, warming = Promise.resolve();

const s = (v, n = 40) => (typeof v === 'string' || typeof v === 'number' ? String(v) : '').slice(0, n);
function clean(body) {
  if (!body || !Array.isArray(body.rows) || !body.rows.length || body.rows.length > MAX_ROWS) return null;
  const rows = body.rows.map((r, i) => ({ rawDate: s(r.rawDate, 24), al: s(r.al), fn: s(r.fn, 12), from: s(r.from, 60), to: s(r.to, 60), dt: s(r.dt, 12), at: s(r.at, 12), km: s(r.km, 10), st: s(r.st, 20),
    sheetUp: !!r.sheetUp, sheetVoid: !!r.sheetVoid, src: { sheet: s(r.sheet, 30) || 'S', row: +r.row || i + 2, cols: {} } }));
  const o = body.opts || {};
  const opts = { name: s(o.name, 24), latin: s(o.latin, 24).toUpperCase().replace(/[^A-Z ]/g, ''), nat: /^[A-Z]{2}$/.test(o.nat) ? o.nat : 'CN',
    theme: ['burgundy', 'navy', 'green', 'black'].includes(o.theme) ? o.theme : 'burgundy', mstyle: o.mstyle === 'calm' ? 'calm' : 'groove',
    len: ['24', '12.5', '5.5'].includes(String(o.len)) ? String(o.len) : '24', year: +o.year || 0, up: o.up !== false, manual: {} };
  for (const [k, v] of Object.entries(o.manual || {}).slice(0, 80)) if (/^[A-Z]{3}$/.test(v)) opts.manual[s(k, 60)] = v;
  return { rows, opts };
}

async function getBrowser() {
  if (browser && browser.connected) return browser;
  browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--mute-audio', '--hide-scrollbars'] });
  return browser;
}

const WORKERS = +process.env.RENDER_WORKERS || 4; // pages rendering frame ranges in parallel (deterministic engine ⇒ identical frames)

// warm pages: the site, fonts and map data stay loaded between jobs; recycled after a while to bound memory
const pool = [];
async function takePage() {
  while (pool.length) { const p = pool.pop(); if (!p.isClosed() && p._uses < 25) return p; await p.close().catch(() => {}); }
  const page = await (await getBrowser()).newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(PAGE + (PAGE.includes('?') ? '&' : '?') + 'render=pool', { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction('typeof S!=="undefined"&&S&&S.ok', { timeout: 60000 });
  page._uses = 0;
  return page;
}
function givePage(p) { if (p && !p.isClosed()) { p._uses++; pool.push(p); } }

// feed the rows/options exactly like the web UI would (resetting whatever the previous job left behind)
async function openScene(job) {
  const page = await takePage();
  const info = await page.evaluate(async ({ rows, opts }) => {
    for (const k in manual) delete manual[k]; STFIX = {}; EXCL = new Set(); KEEP = new Set(); playT = 0;
    const press = (id, v) => { for (const b of document.querySelectorAll('#' + id + ' button')) b.setAttribute('aria-pressed', String(b.dataset.v === v)); };
    press('segTheme', opts.theme); press('segMusic', opts.mstyle); press('segLen', opts.len);
    document.getElementById('name').value = opts.name; document.getElementById('latin').value = opts.latin; document.getElementById('nat').value = opts.nat;
    document.getElementById('optUp').checked = opts.up;
    Object.assign(manual, opts.manual);
    RAW = rows; SOURCE = 'file'; RESET_YEARS = true; detectDateOrder(RAW);
    document.getElementById('yFrom').innerHTML = ''; document.getElementById('yTo').innerHTML = '';
    buildScene(); renderSummary();
    if (opts.year) { document.getElementById('yFrom').value = opts.year; document.getElementById('yTo').value = opts.year; }
    buildScene();
    if (!S.ok) return { ok: false };
    await Promise.all([ensureFonts(), loadFlags(S.order)]); coverBuilt = false;
    return { ok: true, frames: S.frames, seconds: S.T_END, flights: S.flights.length };
  }, { rows: job.rows, opts: job.opts });
  return { page, info };
}

async function render(job) {
  const dir = path.join(VIDEO_DIR, job.id + '.frames'), wav = path.join(VIDEO_DIR, job.id + '.wav'), tmp = path.join(VIDEO_DIR, job.id + '.part.mp4'), out = path.join(VIDEO_DIR, job.id + '.mp4');
  fs.mkdirSync(dir, { recursive: true });
  const pages = [];
  try {
    const T = [Date.now()];
    const first = await openScene(job); pages.push(first.page);
    const info = first.info; if (!info.ok) throw new Error('没有可用的航段（地名没认出来或缺日期）');
    job.seconds = info.seconds;
    // soundtrack (same synth as the page) → WAV
    const pcm = await first.page.evaluate(() => { const A = synth(S, 48000), n = A.L.length, o = new Int16Array(n * 2);
      for (let i = 0; i < n; i++) { o[2 * i] = Math.max(-32767, Math.min(32767, A.L[i] * 32767)); o[2 * i + 1] = Math.max(-32767, Math.min(32767, A.R[i] * 32767)); }
      let b = ''; const u = new Uint8Array(o.buffer); for (let i = 0; i < u.length; i += 32768) b += String.fromCharCode.apply(null, u.subarray(i, i + 32768)); return btoa(b); });
    const data = Buffer.from(pcm, 'base64'), hdr = Buffer.alloc(44);
    hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + data.length, 4); hdr.write('WAVEfmt ', 8); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(2, 22);
    hdr.writeUInt32LE(48000, 24); hdr.writeUInt32LE(192000, 28); hdr.writeUInt16LE(4, 32); hdr.writeUInt16LE(16, 34); hdr.write('data', 36); hdr.writeUInt32LE(data.length, 40);
    fs.writeFileSync(wav, Buffer.concat([hdr, data]));
    T.push(Date.now());
    // more pages, each renders a contiguous range of frames to JPEG files
    (await Promise.all(Array.from({ length: WORKERS - 1 }, () => openScene(job)))).forEach(o => pages.push(o.page));
    const N = info.frames, per = Math.ceil(N / pages.length); let done = 0;
    await Promise.all(pages.map(async (pg, k) => {
      const a = k * per, b = Math.min(N, a + per);
      for (let i = a; i < b; i += 10) {
        const imgs = await pg.evaluate((x, y) => { const out = []; for (let f = x; f < y; f++) { renderFrame(f); out.push(cv.toDataURL('image/jpeg', 0.9).slice(23)); } return out; }, i, Math.min(b, i + 10));
        imgs.forEach((b64, n) => fs.writeFileSync(path.join(dir, String(i + n).padStart(5, '0') + '.jpg'), Buffer.from(b64, 'base64')));
        done += imgs.length; job.progress = Math.min(0.97, done / N);
      }
    }));
    pages.splice(0).forEach(givePage);
    T.push(Date.now());
    await new Promise((res, rej) => {
      const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', path.join(dir, '%05d.jpg'), '-i', wav, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '25',
        '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', tmp], { stdio: ['ignore', 'ignore', 'pipe'] });
      let err = ''; ff.stderr.on('data', d => { err += d; }); ff.on('close', c => (c === 0 ? res() : rej(new Error('ffmpeg ' + c + ' ' + err.slice(-300)))));
    });
    T.push(Date.now()); job.phases = T.slice(1).map((t, i) => ((t - T[i]) / 1000).toFixed(1)).join('/'); // scene+audio / frames / encode
    fs.renameSync(tmp, out); job.size = fs.statSync(out).size; job.state = 'done'; job.progress = 1;
  } finally {
    await Promise.all(pages.map(p => p.close().catch(() => {}))); // only reached with pages still held, i.e. after an error
    for (const f of [tmp, wav, dir]) fs.rm(f, { force: true, recursive: true }, () => {});
  }
}

async function pump() {
  if (busy || !queue.length) return;
  busy = true; await warming; // never race the pre-warm for CPU
  const job = queue.shift(); job.state = 'rendering'; job.started = Date.now();
  try { await render(job); console.log('done', job.id, job.seconds && job.seconds.toFixed(1) + 's video', ((Date.now() - job.started) / 1000).toFixed(0) + 's', 'phases', job.phases); }
  catch (e) { job.state = 'error'; job.error = String(e.message || e).slice(0, 200); console.error('fail', job.id, job.error); try { await browser.close(); } catch (_) {} browser = null; }
  finally { delete job.rows; busy = false; setImmediate(pump); }
}

// hourly cleanup of old videos and job records
setInterval(() => {
  const now = Date.now();
  for (const f of fs.readdirSync(VIDEO_DIR)) { const p = path.join(VIDEO_DIR, f); if (now - fs.statSync(p).mtimeMs > TTL) fs.rm(p, { force: true }, () => {}); }
  for (const [id, j] of jobs) if (now - j.created > TTL) { jobs.delete(id); if (byKey.get(j.key) === id) byKey.delete(j.key); }
  for (const [ip, w] of hits) if (now - w.t > 3600e3) hits.delete(ip);
}, 3600e3).unref();

function send(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); }
http.createServer((req, res) => {
  const url = req.url.split('?')[0], m = url.match(/^\/api\/video\/([a-f0-9]{24})$/);
  if (req.method === 'GET' && m) {
    const j = jobs.get(m[1]); if (!j) return send(res, 404, { error: 'not_found' });
    const ahead = j.state === 'queued' ? queue.indexOf(j) + (busy ? 1 : 0) : 0;
    return send(res, 200, { state: j.state, progress: +(j.progress || 0).toFixed(3), ahead, seconds: j.seconds, size: j.size, url: j.state === 'done' ? '/v/' + j.id + '.mp4' : undefined, error: j.error });
  }
  if (req.method !== 'POST' || url !== '/api/video') return send(res, 404, { error: 'not_found' });
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  let size = 0; const chunks = [];
  req.on('data', c => { size += c.length; if (size > 600e3) { send(res, 413, { error: 'too_large' }); req.destroy(); } else chunks.push(c); });
  req.on('end', () => {
    if (res.writableEnded) return;
    let body = null; try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (e) {}
    const input = clean(body); if (!input) return send(res, 400, { error: 'bad_input' });
    const w = hits.get(ip) || { n: 0, t: Date.now() }; if (Date.now() - w.t > 3600e3) { w.n = 0; w.t = Date.now(); }
    // same rows + same options → the same film: hand back the existing job (done, queued or rendering)
    const key = crypto.createHash('sha1').update(JSON.stringify(input)).digest('hex'), prev = jobs.get(byKey.get(key));
    if (prev && prev.state !== 'error' && (prev.state !== 'done' || fs.existsSync(path.join(VIDEO_DIR, prev.id + '.mp4')))) {
      return send(res, 200, { id: prev.id, ahead: prev.state === 'queued' ? queue.indexOf(prev) + (busy ? 1 : 0) : 0, reused: true });
    }
    if (w.n >= PER_IP_HOUR) return send(res, 429, { error: 'too_many' });
    if (queue.length >= MAX_QUEUE) return send(res, 503, { error: 'busy' });
    w.n++; hits.set(ip, w);
    const id = crypto.randomBytes(12).toString('hex'), job = { id, key, state: 'queued', created: Date.now(), progress: 0, ...input };
    jobs.set(id, job); byKey.set(key, id); queue.push(job); setImmediate(pump);
    send(res, 200, { id, ahead: queue.length - 1 + (busy ? 1 : 0) });
  });
}).listen(PORT, '127.0.0.1', () => {
  console.log('sky-passport render on 127.0.0.1:' + PORT);
  // pre-warm the page pool so the first job after a restart is as fast as the rest
  warming = Promise.all(Array.from({ length: WORKERS }, () => takePage())).then(ps => { ps.forEach(p => pool.push(p)); console.log('pool warm:', pool.length); }).catch(e => console.error('prewarm', e.message));
});
