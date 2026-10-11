// Sky Passport · server-side video rendering for the mini program (personal mini programs cannot embed the web page).
// The mini program sends the parsed rows + options; this service opens the real web page in headless Chromium,
// renders every frame with the same engine (renderFrame / synth), and encodes H.264/AAC with ffmpeg.
//   POST /api/video        {rows, opts}  → {id, ahead}
//   GET  /api/video/<id>                 → {state, progress, url, size, seconds}
// Videos live in VIDEO_DIR for 24 h. One job at a time; per-IP and queue limits keep the 4-core box responsive.
// Speculative jobs ({spec:true}, sent while the user is still looking at their stats) only use idle time: a real
// request goes first and cancels a running speculative render; a real request with the same input adopts it.
'use strict';
const http = require('http');
const https = require('https');
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
const TTL = 24 * 3600e3, MAX_QUEUE = 12, PER_IP_HOUR = 5, SPEC_PER_IP_HOUR = 8, MAX_ROWS = 1500;
fs.mkdirSync(VIDEO_DIR, { recursive: true });
// Optional: finished films go to Tencent COS (the box only has 3 Mbps up). Set all four in /srv/sky-passport/cos.env:
//   COS_BUCKET=<name>-<appid>  COS_REGION=ap-guangzhou  COS_SECRET_ID=…  COS_SECRET_KEY=…   (a sub-account key that may only PutObject on this bucket)
// The bucket is public-read with a 1-day lifecycle rule; ids are 96 random bits. After a successful upload the local file is
// removed and nginx (location /v/ … try_files … @cos) answers /v/<id>.mp4 with a 302 to the bucket, so clients keep the same URL.
const COS = process.env.COS_BUCKET && process.env.COS_REGION && process.env.COS_SECRET_ID && process.env.COS_SECRET_KEY
  ? { host: `${process.env.COS_BUCKET}.cos.${process.env.COS_REGION}.myqcloud.com`, id: process.env.COS_SECRET_ID, key: process.env.COS_SECRET_KEY } : null;
function cosPut(file, key) {
  return new Promise((resolve, reject) => {
    const now = Math.floor(Date.now() / 1000), kt = `${now - 60};${now + 900}`, hm = (k, v) => crypto.createHmac('sha1', k).update(v).digest('hex');
    const sts = `sha1\n${kt}\n${crypto.createHash('sha1').update(`put\n/${key}\n\n\n`).digest('hex')}\n`, sig = hm(hm(COS.key, kt), sts);
    const rq = https.request({ host: COS.host, path: '/' + key, method: 'PUT', timeout: 90000, headers: { 'Content-Type': 'video/mp4', 'Content-Length': fs.statSync(file).size,
      Authorization: `q-sign-algorithm=sha1&q-ak=${COS.id}&q-sign-time=${kt}&q-key-time=${kt}&q-header-list=&q-url-param-list=&q-signature=${sig}` } },
      r => { let b = ''; r.on('data', d => { b += d; }); r.on('end', () => (r.statusCode === 200 ? resolve() : reject(new Error('COS ' + r.statusCode + ' ' + b.slice(0, 160))))); });
    rq.on('timeout', () => rq.destroy(new Error('COS timeout'))); rq.on('error', reject); fs.createReadStream(file).on('error', reject).pipe(rq);
  });
}

const jobs = new Map(), byKey = new Map(), queue = [], hits = new Map();
// Finished films are remembered across restarts (id, input key, size, where the file is), so the same sheet + options
// within 24 h is answered at once instead of rendered again. Only what the status call needs is kept: no rows, no names.
const INDEX = process.env.JOB_INDEX || path.join(VIDEO_DIR, '..', 'jobs.json');
function saveIndex() { const done = [...jobs.values()].filter(j => j.state === 'done').map(j => ({ id: j.id, key: j.key, created: j.created, size: j.size, seconds: j.seconds, cos: !!j.cos }));
  fs.writeFile(INDEX + '.tmp', JSON.stringify(done), e => { if (!e) fs.rename(INDEX + '.tmp', INDEX, () => {}); }); }
try { for (const j of JSON.parse(fs.readFileSync(INDEX, 'utf8'))) { if (Date.now() - j.created > TTL || !(j.cos || fs.existsSync(path.join(VIDEO_DIR, j.id + '.mp4')))) continue; jobs.set(j.id, { ...j, state: 'done', progress: 1 }); byKey.set(j.key, j.id); } console.log('restored', jobs.size, 'finished films'); } catch (e) { /* first run */ }
let browser = null, busy = null, warming = Promise.resolve(); // busy = the job being rendered

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

// one browser for every page: concurrent callers (the pre-warm opens all pages at once) share a single launch
let launching = null;
async function getBrowser() {
  if (browser && browser.connected) return browser;
  if (!launching) launching = puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--mute-audio', '--hide-scrollbars',
    // all pages render at once; none of them may be throttled as a background tab
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'], protocolTimeout: 300000 })
    .then(b => { browser = b; launching = null; b.on('disconnected', () => { if (browser === b) browser = null; pool.length = 0; }); return b; }, e => { launching = null; throw e; });
  return launching;
}

// pages rendering frame ranges in parallel (deterministic engine ⇒ identical frames). 3, not 4: each warm page holds ~400 MB and grows with use,
// and on this 3.7 GB box (MySQL, other apps, no swap) four of them left only ~150 MB above the memory floor after a few hours.
const WORKERS = +process.env.RENDER_WORKERS || 3, PAGE_USES = 8;

// warm pages: the site, fonts and map data stay loaded between jobs; recycled after a while to bound memory
const pool = [];
async function takePage() {
  while (pool.length) { const p = pool.pop(); if (!p.isClosed() && p._uses < PAGE_USES) return p; await p.close().catch(() => {}); }
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
    buildScene(); clearTimeout(audioTimer); // the page would synthesise the score on its own: only the job's first page needs it, on demand
    if (!S.ok) return { ok: false };
    await Promise.all([ensureFonts(), loadFlags(S.order)]); coverBuilt = false;
    return { ok: true, frames: S.frames, seconds: S.T_END, flights: S.flights.length };
  }, { rows: job.rows, opts: job.opts });
  return { page, info };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
// The box also serves other sites and has no swap: a render must never push it into memory exhaustion.
// MemAvailable is checked before every batch; below the floor the job stops and its pages/encoders are dropped.
const MEM_FLOOR_MB = +process.env.RENDER_MEM_FLOOR_MB || 450;
function memAvailMB() { try { const m = fs.readFileSync('/proc/meminfo', 'utf8').match(/MemAvailable:\s+(\d+)/); return m ? +m[1] / 1024 : 1e9; } catch (e) { return 1e9; } }
let memLow = 0; // lowest MemAvailable seen during the current job (logged)
function encoder(file) { // one x264 per page, fed while that page is still drawing; segments are joined losslessly at the end
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '25',
    '-pix_fmt', 'yuv420p', '-threads', '1', '-x264-params', 'rc-lookahead=8', '-an', file], { stdio: ['pipe', 'ignore', 'pipe'] });
  let err = ''; ff.stderr.on('data', d => { err += d; });
  const done = new Promise((res, rej) => { ff.on('close', c => (c === 0 ? res() : rej(new Error('ffmpeg ' + c + ' ' + err.slice(-300))))); ff.stdin.on('error', () => {}); });
  done.catch(() => {}); // a cancelled job kills its encoders without awaiting them
  const write = buf => (!ff.stdin.writable || ff.stdin.write(buf) ? null : new Promise(r => { const go = () => { ff.stdin.off('drain', go); ff.off('close', go); r(); }; ff.stdin.on('drain', go); ff.on('close', go); }));
  return { write, end: () => { ff.stdin.end(); return done; }, kill: () => ff.kill('SIGKILL') };
}
const BATCH = 6;
const grab = (pg, x, y) => { const p = pg.evaluate((x, y) => { const out = []; for (let f = x; f < y; f++) { renderFrame(f); out.push(cv.toDataURL('image/jpeg', 0.9).slice(23)); } return out; }, x, y); p.catch(() => {}); return p; };

async function render(job) {
  const base = path.join(VIDEO_DIR, job.id), wav = base + '.wav', list = base + '.txt', tmp = base + '.part.mp4', out = base + '.mp4';
  const lanes = job.lanes || WORKERS, segs = Array.from({ length: lanes }, (_, k) => `${base}.s${k}.mp4`), encs = [];
  const pages = [];
  try {
    const T = [Date.now()]; memLow = memAvailMB();
    // every page loads the scene at once; page 0 also starts the soundtrack in its Web Worker (runs beside the drawing)
    const opened = await Promise.all(Array.from({ length: lanes }, () => openScene(job)));
    opened.forEach(o => pages.push(o.page));
    const info = opened[0].info; if (!info.ok) throw new Error('没有可用的航段（地名没认出来或缺日期）');
    job.seconds = info.seconds;
    const audio = pages[0].evaluate(async () => { const A = await ensureAudio(), n = A.L.length, o = new Int16Array(n * 2); if (synthW) { synthW.terminate(); synthW = null; } // give the Worker's memory back
      for (let i = 0; i < n; i++) { o[2 * i] = Math.max(-32767, Math.min(32767, A.L[i] * 32767)); o[2 * i + 1] = Math.max(-32767, Math.min(32767, A.R[i] * 32767)); }
      let b = ''; const u = new Uint8Array(o.buffer); for (let i = 0; i < u.length; i += 32768) b += String.fromCharCode.apply(null, u.subarray(i, i + 32768)); return btoa(b); });
    audio.catch(() => {});
    T.push(Date.now());
    const N = info.frames, per = Math.ceil(N / pages.length); let done = 0;
    const ran = await Promise.allSettled(pages.map(async (pg, k) => {
      const a = k * per, b = Math.min(N, a + per), enc = encoder(segs[k]); encs.push(enc);
      let next = a < b ? grab(pg, a, Math.min(b, a + BATCH)) : null; // always one batch in flight while the last one is written
      for (let i = a; i < b; i += BATCH) {
        const imgs = await next; if (job.cancel) throw new Error('cancelled');
        const mem = memAvailMB(); memLow = Math.min(memLow, mem);
        if (mem < MEM_FLOOR_MB) { job.lowmem = true; throw new Error('服务器内存不足，请稍后再试'); }
        next = i + BATCH < b ? grab(pg, i + BATCH, Math.min(b, i + 2 * BATCH)) : null;
        for (const b64 of imgs) { const w = enc.write(Buffer.from(b64, 'base64')); if (w) await w; }
        done += imgs.length; job.progress = Math.min(0.97, done / N);
      }
      await enc.end();
    }));
    const bad = ran.find(r => r.status === 'rejected'); if (bad) throw (job.cancel ? new Error('cancelled') : bad.reason); // every page has stopped by now
    pages.splice(0).forEach(givePage);
    T.push(Date.now());
    const data = Buffer.from(await audio, 'base64'), hdr = Buffer.alloc(44);
    hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + data.length, 4); hdr.write('WAVEfmt ', 8); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(2, 22);
    hdr.writeUInt32LE(48000, 24); hdr.writeUInt32LE(192000, 28); hdr.writeUInt16LE(4, 32); hdr.writeUInt16LE(16, 34); hdr.write('data', 36); hdr.writeUInt32LE(data.length, 40);
    fs.writeFileSync(wav, Buffer.concat([hdr, data]));
    fs.writeFileSync(list, segs.map(f => `file '${f}'\n`).join(''));
    await new Promise((res, rej) => {
      const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k',
        '-shortest', '-movflags', '+faststart', tmp], { stdio: ['ignore', 'ignore', 'pipe'] });
      let err = ''; ff.stderr.on('data', d => { err += d; }); ff.on('close', c => (c === 0 ? res() : rej(new Error('ffmpeg ' + c + ' ' + err.slice(-300)))));
    });
    T.push(Date.now()); job.phases = T.slice(1).map((t, i) => ((t - T[i]) / 1000).toFixed(1)).join('/'); // scenes / frames+encode / mux
    fs.renameSync(tmp, out); job.size = fs.statSync(out).size;
    if (COS) { try { const t = Date.now(); await cosPut(out, 'v/' + job.id + '.mp4'); job.cos = true; fs.rm(out, { force: true }, () => {}); console.log('cos', job.id, ((Date.now() - t) / 1000).toFixed(1) + 's'); } catch (e) { console.error('cos upload failed, serving locally', job.id, String(e.message || e)); } }
    job.state = 'done'; job.progress = 1;
  } finally {
    encs.forEach(e => e.kill());
    // pages still held here: after a cancel they are healthy (openScene resets them), after an error their state is unknown
    if (job.cancel) pages.forEach(givePage); else await Promise.all(pages.map(p => p.close().catch(() => {})));
    for (const f of [tmp, wav, list, ...segs]) fs.rm(f, { force: true }, () => {});
  }
}

const position = j => { const real = queue.filter(q => !q.spec); return j.spec ? -1 : real.indexOf(j) + (busy && !busy.spec ? 1 : 0); };
async function pump() {
  if (busy || !queue.length) return;
  await warming; if (busy) return; // never race the pre-warm for CPU
  const k = queue.findIndex(j => !j.spec), job = queue.splice(k >= 0 ? k : 0, 1)[0]; // real requests first
  busy = job; job.state = 'rendering'; job.started = Date.now();
  try { await render(job); saveIndex(); console.log('done', job.id, job.spec ? 'spec' : 'real', job.seconds && job.seconds.toFixed(1) + 's video', ((Date.now() - job.started) / 1000).toFixed(0) + 's', 'phases', job.phases, 'minMemMB', Math.round(memLow)); }
  catch (e) {
    if (job.cancel) { job.state = 'cancelled'; console.log('cancelled', job.id); }
    else {
      try { await browser.close(); } catch (_) {} browser = null; pool.length = 0; // frees every page
      if (job.lowmem && !job.retried) { job.retried = true; job.lowmem = false; job.lanes = 2; job.state = 'queued'; job.progress = 0; queue.unshift(job); console.log('low memory, retrying with 2 pages', job.id); } // the user just sees it continue
      else { job.state = 'error'; job.error = String(e.message || e).slice(0, 200); console.error('fail', job.id, job.error); }
    }
  }
  finally { if (!['cancelled', 'queued'].includes(job.state)) delete job.rows; busy = null; setImmediate(pump); }
}

// hourly cleanup of old videos and job records
setInterval(() => {
  const now = Date.now();
  try { for (const f of fs.readdirSync(VIDEO_DIR)) { const p = path.join(VIDEO_DIR, f); try { if (now - fs.statSync(p).mtimeMs > TTL) fs.rm(p, { force: true }, () => {}); } catch (e) { /* removed meanwhile (uploaded to COS) */ } } } catch (e) { console.error('cleanup', e.message); }
  for (const [id, j] of jobs) if (now - j.created > TTL) { jobs.delete(id); if (byKey.get(j.key) === id) byKey.delete(j.key); }
  for (const [ip, w] of hits) if (now - w.t > 3600e3) hits.delete(ip);
  saveIndex();
}, 3600e3).unref();

// a stray rejection or error must not take the queue (and the job being rendered) down with it
process.on('unhandledRejection', e => console.error('unhandledRejection', e && e.stack || e));
process.on('uncaughtException', e => console.error('uncaughtException', e && e.stack || e));

function send(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); }
http.createServer((req, res) => {
  const url = req.url.split('?')[0], m = url.match(/^\/api\/video\/([a-f0-9]{24})$/);
  if (req.method === 'GET' && m) {
    const j = jobs.get(m[1]); if (!j) return send(res, 404, { error: 'not_found' });
    const ahead = j.state === 'queued' ? Math.max(0, position(j)) : 0;
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
    const spec = body.spec === true;
    // same rows + same options → the same film: hand back the existing job (done, queued or rendering)
    const key = crypto.createHash('sha1').update(JSON.stringify(input)).digest('hex'); let prev = jobs.get(byKey.get(key));
    if (!spec && prev && prev.state === 'cancelled' && prev.rows) { prev.state = 'queued'; prev.cancel = false; prev.progress = 0; queue.push(prev); } // bring a cancelled pre-render back
    if (prev && !['error', 'cancelled'].includes(prev.state) && (prev.state !== 'done' || prev.cos || fs.existsSync(path.join(VIDEO_DIR, prev.id + '.mp4')))) {
      if (!spec && prev.spec) { prev.spec = false; if (busy && busy.spec && busy !== prev) busy.cancel = true; } // the user asked for it: no longer speculative
      setImmediate(pump);
      return send(res, 200, { id: prev.id, ahead: prev.state === 'queued' ? Math.max(0, position(prev)) : 0, reused: true });
    }
    const w = hits.get(ip) || { n: 0, s: 0, t: Date.now() }; if (Date.now() - w.t > 3600e3) { w.n = 0; w.s = 0; w.t = Date.now(); }
    if (spec) {
      // pre-renders never queue behind or ahead of real work: only on an idle box, at most one per client
      if (queue.some(j => !j.spec) || (busy && !busy.spec) || w.s >= SPEC_PER_IP_HOUR) return send(res, 202, { skipped: true });
      for (let i = queue.length - 1; i >= 0; i--) if (queue[i].spec && queue[i].ip === ip) { queue[i].state = 'cancelled'; queue.splice(i, 1); }
      if (busy && busy.spec && busy.ip === ip) busy.cancel = true;
      w.s++;
    } else {
      if (w.n >= PER_IP_HOUR) return send(res, 429, { error: 'too_many' });
      if (queue.filter(j => !j.spec).length >= MAX_QUEUE) return send(res, 503, { error: 'busy' });
      w.n++;
      if (busy && busy.spec) busy.cancel = true; // a real request preempts a pre-render
      for (let i = queue.length - 1; i >= 0; i--) if (queue[i].spec) { queue[i].state = 'cancelled'; queue.splice(i, 1); }
    }
    hits.set(ip, w);
    const id = crypto.randomBytes(12).toString('hex'), job = { id, key, ip, spec, state: 'queued', created: Date.now(), progress: 0, ...input };
    jobs.set(id, job); byKey.set(key, id); queue.push(job); setImmediate(pump);
    send(res, 200, { id, ahead: Math.max(0, position(job)) });
  });
}).listen(PORT, '127.0.0.1', () => {
  console.log('sky-passport render on 127.0.0.1:' + PORT);
  // pre-warm the page pool so the first job after a restart is as fast as the rest
  warming = Promise.all(Array.from({ length: WORKERS }, () => takePage())).then(ps => { ps.forEach(p => pool.push(p)); console.log('pool warm:', pool.length); }).catch(e => console.error('prewarm', e.message));
});
