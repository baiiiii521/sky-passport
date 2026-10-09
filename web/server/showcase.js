// Renders the mini program's home-page showcase images from the demo traveller, on the server:
//   public/mp/cover.jpg (closing poster), page.jpg (mid-flight page), world.jpg (zoom-out with stamp), long.jpg (long poster)
// Usage: NODE_PATH=/srv/sky-passport/rt/node_modules node server/showcase.js
'use strict';
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const OUT = path.join(__dirname, '..', 'public', 'mp');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const b = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/snap/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1280, height: 900 });
  await p.goto(process.env.RENDER_PAGE || 'https://passport.nybbq.art/index.html', { waitUntil: 'load', timeout: 60000 });
  await p.waitForFunction('typeof S!=="undefined"&&S&&S.ok', { timeout: 60000 });
  await p.evaluate(async () => { await Promise.all([ensureFonts(), loadFlags(S.order)]); coverBuilt = false; });
  const shots = await p.evaluate(() => {
    const at = t => { renderFrame(Math.round(t * FPS)); return cv.toDataURL('image/jpeg', 0.82); };
    return { cover: at(S.T_END - 0.4), page: at(S.T_FE - 3.2), world: at(S.T_CARD - 1.2) };
  });
  for (const [k, d] of Object.entries(shots)) fs.writeFileSync(path.join(OUT, k + '.jpg'), Buffer.from(d.split(',')[1], 'base64'));
  const long = await p.evaluate(async () => (await renderLongPoster()).toDataURL('image/jpeg', 0.8));
  fs.writeFileSync(path.join(OUT, 'long.jpg'), Buffer.from(long.split(',')[1], 'base64'));
  // the home page's sample video: the demo traveller rendered by the live service, kept permanently
  const rows = await p.evaluate(() => demoRows().map((r, i) => ({ ...r, row: i + 2 })));
  await b.close();
  const api = 'http://127.0.0.1:' + (process.env.RENDER_PORT || 3102) + '/api/video';
  const job = await (await fetch(api, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': 'showcase' }, body: JSON.stringify({ rows, opts: { name: '林小舟', latin: 'LIN XIAOZHOU' } }) })).json();
  for (;;) { await new Promise(r => setTimeout(r, 3000)); const st = await (await fetch(api + '/' + job.id)).json(); if (st.state === 'done') { fs.copyFileSync(path.join('/srv/sky-passport/videos', job.id + '.mp4'), path.join(OUT, 'demo.mp4')); break; } if (st.state === 'error') throw new Error(st.error); }
  console.log('showcase →', OUT, fs.readdirSync(OUT));
})().catch(e => { console.error(e); process.exit(1); });
