// Flights from a screenshot (航旅纵横「已结束 / 待出行」lists and similar trip lists in airline or booking apps).
//   POST /api/shots {image: "<base64 jpeg/png>"}  →  {flights: [{date, fn, al, from, to, dt, at}], lines}
// The picture goes to Tencent Cloud OCR (GeneralBasicOCR) and is never written to disk; the text boxes that come back are
// turned into flights here by position, so every client (web page, mini program) gets the same answer. Place names are
// returned as printed: the client resolves them with its airport dictionary and lets the user correct the list.
// Keys: COS_SECRET_ID / COS_SECRET_KEY (the same sub-account as the bucket, with the OCR policy added) or OCR_SECRET_ID / OCR_SECRET_KEY.
'use strict';
const https = require('https');
const crypto = require('crypto');

const E = process.env, ID = E.OCR_SECRET_ID || E.COS_SECRET_ID, KEY = E.OCR_SECRET_KEY || E.COS_SECRET_KEY;
const ACTION = E.OCR_ACTION || 'GeneralBasicOCR', REGION = E.OCR_REGION || 'ap-beijing', HOST = 'ocr.tencentcloudapi.com';
const PER_IP_HOUR = 40, PER_DAY = +E.OCR_PER_DAY || 600;   // the day cap keeps a runaway client inside the free quota

/* ---------- text boxes → flights (pure; tested in tests/shots.test.js) ---------- */
const FN = /(?<![A-Z0-9])([A-Z][A-Z0-9]|[0-9][A-Z])\s?(\d{3,4})(?![0-9])/;
const TIME = /(?<![0-9])([01]?\d|2[0-3])[:：]([0-5]\d)(?![0-9])/;
const FULL = /(20\d\d|19\d\d)\s*[-/.年]\s*(\d{1,2})\s*[-/.月]\s*(\d{1,2})/;
const MD = /^(\d{1,2})\s*[-/.月]\s*(\d{1,2})日?$/;
const NOISE = /^(去点评|点评|添加行程|已结束|待出行|历史行程|筛选|标签|航班|火车|用车|酒店|[+＋]\s*\d\s*天?|次日|经停|直飞|准点|延误|取消|计划|实际|到达|出发|起飞|降落)$/;
const p2 = n => String(n).padStart(2, '0');
const okDate = (y, m, d) => m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1950 && y <= 2100;
// "南昌昌北T2" → "南昌昌北": terminals, punctuation and arrows are not part of the name
const place = s => String(s || '').replace(TIME, ' ').replace(/[（(][^）)]*[）)]/g, ' ').replace(/(T\s?\d[A-Z]?|[一二三四]号?航站楼|航站楼|国际机场|机场)\s*$/i, '').replace(/[○●•·:：→\->—|]+/g, ' ').replace(/\s+/g, ' ').trim();
const isPlace = s => { const t = place(s); return t.length >= 2 && t.length <= 24 && /[一-鿿A-Za-z]/.test(t) && !NOISE.test(t) && !FN.test(t.toUpperCase()) && !/^\d+$/.test(t) && !/(航空|累计|行程|解锁|数据)/.test(t) && !/\d\s*(小时|时|分钟?|h|hr|min|m)(\s|\d|$)/i.test(t) && !/^(周|星期)[一二三四五六日天]$/.test(t); };

function parseShots(dets) {
  const D = (dets || []).map(d => ({ t: String(d.t || '').trim(), x: +d.x || 0, y: +d.y || 0, w: +d.w || 0, h: Math.max(1, +d.h || 1) })).filter(d => d.t)
    .map(d => ({ ...d, yc: d.y + d.h / 2, xc: d.x + d.w / 2, x1: d.x + d.w })).sort((a, b) => a.yc - b.yc || a.x - b.x);
  const sameRow = (a, b) => Math.abs(a.yc - b.yc) < 0.6 * Math.max(a.h, b.h);
  const anchors = []; for (const d of D) { const m = d.t.toUpperCase().match(FN); if (m && !TIME.test(d.t)) anchors.push({ d, fn: m[1] + m[2], m }); }
  const H = anchors.length ? anchors.map(a => a.d.h).sort((a, b) => a - b)[anchors.length >> 1] : 20;   // a typical line height on this picture
  // dates: a full date in one box, or month-day with the year in a box just below / above (航旅纵横 prints "05-11" over "2026")
  const dates = [];
  for (const d of D) {
    const f = d.t.match(FULL); if (f && okDate(+f[1], +f[2], +f[3])) { dates.push({ d, v: `${f[1]}-${p2(f[2])}-${p2(f[3])}` }); continue; }
    const m = d.t.match(MD); if (!m || !okDate(2000, +m[1], +m[2])) continue;
    const yr = D.filter(o => /^(19|20)\d\d年?$/.test(o.t) && Math.abs(o.xc - d.xc) < Math.max(d.w, 60) && Math.abs(o.yc - d.yc) < 3 * d.h && o !== d).sort((a, b) => Math.abs(a.yc - d.yc) - Math.abs(b.yc - d.yc))[0];
    dates.push({ d, v: yr ? `${yr.t.slice(0, 4)}-${p2(m[1])}-${p2(m[2])}` : '', md: `${p2(m[1])}-${p2(m[2])}` });
  }
  const flights = [];
  anchors.forEach((a, i) => {
    const top = a.d.yc - 0.8 * H, next = anchors[i + 1], bottom = next ? next.d.yc - 0.8 * H : a.d.yc + 14 * H, inCard = d => d.yc >= top && d.yc < bottom;
    // times in this card, each with the name printed next to it (same row to the right, else in the same box, else right below)
    const times = D.filter(d => inCard(d) && TIME.test(d.t)).flatMap(d => { const out = []; let s = d.t, m, k = 0; while ((m = s.match(TIME)) && k++ < 2) { out.push({ d, hm: `${p2(m[1])}:${m[2]}`, rest: s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length) }); s = s.slice(m.index + m[0].length); } return out; });
    const used = new Set(), nameFor = t => {
      if (times.filter(o => o.d === t.d).length === 1 && isPlace(t.rest)) return place(t.rest);
      const paired = times.some(o => o.d !== t.d && sameRow(o.d, t.d));   // 08:00 ——— 10:20 on one row: the names sit under the times, not beside them
      const right = !paired && D.filter(o => o !== t.d && !used.has(o) && inCard(o) && sameRow(o, t.d) && o.x >= t.d.x1 - 4 && isPlace(o.t) && !TIME.test(o.t)).sort((p, q) => p.x - q.x)[0];
      if (right) { used.add(right); return place(right.t); }
      const below = D.filter(o => o !== t.d && !used.has(o) && inCard(o) && o.yc > t.d.yc && o.yc - t.d.yc < 3.2 * H && Math.abs(o.xc - t.d.xc) < Math.max(t.d.w, 4 * H) && isPlace(o.t) && !TIME.test(o.t)).sort((p, q) => p.yc - q.yc)[0];
      if (below) { used.add(below); return place(below.t); }
      return '';
    };
    // departure first: top to bottom in a vertical card, left to right when both times share a row
    times.sort((p, q) => (sameRow(p.d, q.d) ? p.d.x - q.d.x : p.d.yc - q.d.yc));
    const dep = times[0], arr = times[1];
    const from = dep ? nameFor(dep) : '', to = arr ? nameFor(arr) : '';
    const dc = dates.filter(o => o.d.yc >= top - 1.5 * H && o.d.yc < bottom).sort((p, q) => Math.abs(p.d.yc - a.d.yc) - Math.abs(q.d.yc - a.d.yc))[0];
    const before = a.d.t.slice(0, a.d.t.toUpperCase().indexOf(a.m[0])).trim(), left = D.filter(o => o !== a.d && sameRow(o, a.d) && o.x < a.d.x && /航空|航$|Air/i.test(o.t)).sort((p, q) => q.x - p.x)[0];
    const al = (before || (left ? left.t : '')).replace(/[^一-鿿A-Za-z ]/g, '').trim().slice(0, 20);
    if (!from && !to && !dc) return;   // a flight number on its own (a header, an advert) is not a trip
    flights.push({ date: dc ? dc.v : '', md: dc && !dc.v ? dc.md : undefined, fn: a.fn, al, from, to, dt: dep ? dep.hm : '', at: arr ? arr.hm : '' });
  });
  return flights;
}

/* ---------- Tencent Cloud OCR (TC3-HMAC-SHA256, no SDK) ---------- */
function ocr(imageBase64) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ ImageBase64: imageBase64 }), ts = Math.floor(Date.now() / 1000), date = new Date(ts * 1000).toISOString().slice(0, 10), ct = 'application/json; charset=utf-8';
    const sha = s => crypto.createHash('sha256').update(s).digest('hex'), hmac = (k, s, enc) => crypto.createHmac('sha256', k).update(s).digest(enc);
    const canon = `POST\n/\n\ncontent-type:${ct}\nhost:${HOST}\nx-tc-action:${ACTION.toLowerCase()}\n\ncontent-type;host;x-tc-action\n${sha(body)}`;
    const scope = `${date}/ocr/tc3_request`, sig = hmac(hmac(hmac(hmac('TC3' + KEY, date), 'ocr'), 'tc3_request'), `TC3-HMAC-SHA256\n${ts}\n${scope}\n${sha(canon)}`, 'hex');
    const req = https.request({ host: HOST, path: '/', method: 'POST', timeout: 20000, headers: { 'Content-Type': ct, Host: HOST, 'X-TC-Action': ACTION, 'X-TC-Version': '2018-11-19', 'X-TC-Region': REGION, 'X-TC-Timestamp': ts,
      'Content-Length': Buffer.byteLength(body), Authorization: `TC3-HMAC-SHA256 Credential=${ID}/${scope}, SignedHeaders=content-type;host;x-tc-action, Signature=${sig}` } }, res => {
      let b = ''; res.on('data', d => { b += d; }); res.on('end', () => {
        let j = null; try { j = JSON.parse(b).Response; } catch (e) {}
        if (!j) return reject(Object.assign(new Error('bad answer'), { code: 'BadAnswer' }));
        if (j.Error) return reject(Object.assign(new Error(j.Error.Message || j.Error.Code), { code: j.Error.Code }));
        resolve((j.TextDetections || []).map(d => ({ t: d.DetectedText, x: d.ItemPolygon ? d.ItemPolygon.X : 0, y: d.ItemPolygon ? d.ItemPolygon.Y : 0, w: d.ItemPolygon ? d.ItemPolygon.Width : 0, h: d.ItemPolygon ? d.ItemPolygon.Height : 0 })));
      });
    });
    req.on('timeout', () => req.destroy(Object.assign(new Error('timeout'), { code: 'Timeout' }))); req.on('error', reject); req.end(body);
  });
}

/* ---------- POST /api/shots ---------- */
const hits = new Map(); let day = { d: '', n: 0 };
async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  if (!ID || !KEY || E.OCR_DISABLED === '1') return res.status(503).json({ error: 'disabled' });
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown', now = Date.now(), w = hits.get(ip) || { n: 0, t: now };
  if (now - w.t > 3600e3) { w.n = 0; w.t = now; } if (hits.size > 5000) hits.clear();
  const today = new Date().toISOString().slice(0, 10); if (day.d !== today) day = { d: today, n: 0 };
  if (w.n >= PER_IP_HOUR) return res.status(429).json({ error: 'too_many' });
  if (day.n >= PER_DAY) return res.status(503).json({ error: 'quota' });
  const img = req.body && typeof req.body.image === 'string' ? req.body.image.replace(/^data:image\/\w+;base64,/, '') : '';
  if (img.length < 2000 || img.length > 5.5e6 || !/^[A-Za-z0-9+/=\s]+$/.test(img.slice(0, 400))) return res.status(400).json({ error: 'bad_input' });
  w.n++; hits.set(ip, w); day.n++;
  try {
    const dets = await ocr(img), flights = parseShots(dets);
    return res.status(200).json({ flights, lines: dets.length });
  } catch (e) {
    console.error('ocr', e.code || '', String(e.message || e).slice(0, 160));
    const c = String(e.code || '');
    if (/^FailedOperation\.(ImageNoText|EmptyImageError)/.test(c)) return res.status(200).json({ flights: [], lines: 0 });
    if (/^(AuthFailure|ResourceUnavailable|ResourcesSoldOut|UnauthorizedOperation)/.test(c)) return res.status(503).json({ error: 'disabled' });   // not switched on, no permission, or out of quota
    if (/^(FailedOperation\.(ImageDecodeFailed|UnKnowError|ImageSizeTooLarge|DownLoadError)|LimitExceeded\.TooLargeFileError|InvalidParameter)/.test(c)) return res.status(400).json({ error: 'bad_image' });
    return res.status(502).json({ error: 'ocr_failed' });
  }
}

module.exports = { parseShots, ocr, handler, place };
