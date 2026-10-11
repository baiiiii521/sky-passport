// Long poster 「夜航」 for the mini program, drawn on a canvas type="2d" (no Path2D / letterSpacing / conic gradients: plain 2D calls only).
// Same sections and look as the web poster (extras.js renderLongPosterNight): cover, boarding pass, split-flap numbers, dark route map,
// medals, timeline, QR footer. The route map uses a pre-rendered base (mp-world-night.png, centre 105°E, 78°N…56°S, with the
// standard China outline and the nine-dash line already on it).
const { placeName, fmt, tier } = require('./stats.js');
const qrcode = require('./qrcode.js');
const C = require('./core.js');

const W = 1080, MAP_W = 960, MAP_X = 60, LON0 = 105, LAT0 = 78, LAT1 = -56, GAP = 56;
const MAP_H = Math.round((LAT0 - LAT1) * MAP_W / 360);
const NP = { ac: '#5eeaff', ac2: '#ff4f9a', gold: '#e9c58e', ink: '#eaf4ff', mut: '#8fa6c2', line: 'rgba(94,234,255,.18)' };
const SANS = 'sans-serif', MONO = 'monospace';
const F = (w, s, mono) => `${w} ${s}px ${mono ? MONO : SANS}`;

function layout(data) {
  const rowsB = Math.ceil(data.badges.length / 2);
  return { cover: 720, pass: 290, stats: 58 + 336, map: 58 + MAP_H + 64, badges: data.badges.length ? 40 + rowsB * 172 : 0, years: data.sum.years.length > 1 ? 358 : 0, foot: 360 };
}
function height(data) { const L = layout(data); return L.cover + L.pass + L.foot + [L.stats, L.map, L.badges, L.years].filter(Boolean).reduce((a, b) => a + b + GAP, 0) + GAP; }

function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function gold(g, y0, y1) { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, '#fbe9c2'); gr.addColorStop(0.55, '#e2b670'); gr.addColorStop(1, '#f6dca6'); return gr; }
function fit(g, txt, max, size, weight, mono) { let s = size; g.font = F(weight, s, mono); while (g.measureText(txt).width > max && s > 12) { s -= 1; g.font = F(weight, s, mono); } return s; }
function trk(g, txt, x, y, sp, align) { const ch = [...txt], ws = ch.map(c => g.measureText(c).width), w = ws.reduce((a, b) => a + b, 0) + sp * (ch.length - 1); let cx = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x; g.textAlign = 'left'; ch.forEach((c, i) => { g.fillText(c, cx, y); cx += ws[i] + sp; }); return w; }
function panel(g, x, y, w, h, r, stroke) { const gr = g.createLinearGradient(x, y, x, y + h); gr.addColorStop(0, 'rgba(16,34,72,.92)'); gr.addColorStop(1, 'rgba(6,14,34,.96)'); rr(g, x, y, w, h, r); g.fillStyle = gr; g.fill(); g.lineWidth = 1.5; g.strokeStyle = stroke || 'rgba(94,234,255,.22)'; g.stroke(); }
function corners(g, x, y, w, h, s, col) { g.strokeStyle = col || NP.ac; g.lineWidth = 3; g.beginPath(); for (const [px, py, dx, dy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) { g.moveTo(px, py + dy * s); g.lineTo(px, py); g.lineTo(px + dx * s, py); } g.stroke(); }
function head(g, y, code, title, right) { g.textAlign = 'left'; g.font = F(700, 19, 1); g.fillStyle = NP.ac; const cw = trk(g, code, 60, y, 3); g.font = F(800, 30); g.fillStyle = NP.ink; g.fillText(title, 60 + cw + 20, y + 3);
  if (right) { g.font = F(400, 19, 1); g.fillStyle = NP.mut; g.textAlign = 'right'; g.fillText(right, W - 60, y); g.textAlign = 'left'; }
  g.fillStyle = NP.line; g.fillRect(60, y + 22, W - 120, 1); for (let x = 60; x <= W - 60; x += 48) g.fillRect(x, y + 17, 1, 6);
  const lg = g.createLinearGradient(60, 0, 200, 0); lg.addColorStop(0, NP.ac); lg.addColorStop(1, 'rgba(94,234,255,0)'); g.fillStyle = lg; g.fillRect(60, y + 20, 140, 3); }
const isCell = c => /[\d A-Z]/.test(c);
const flapW = (txt, size) => { let w = 0; for (const c of txt) w += (isCell(c) ? size * 0.74 : size * 0.34) + size * 0.08; return w; };
function flap(g, x, y, txt, size) { const cw = size * 0.74, ch = size * 1.28, gap = size * 0.08; let cx = x; g.textAlign = 'center'; g.font = F(700, size, 1);
  for (const c of txt) { if (isCell(c)) { rr(g, cx, y, cw, ch, size * 0.12); const gr = g.createLinearGradient(0, y, 0, y + ch); gr.addColorStop(0, '#16305c'); gr.addColorStop(0.5, '#11244a'); gr.addColorStop(0.5, '#0b1a38'); gr.addColorStop(1, '#0a1630'); g.fillStyle = gr; g.fill();
      g.strokeStyle = 'rgba(94,234,255,.18)'; g.lineWidth = 1.2; g.stroke(); g.fillStyle = '#fff6e2'; g.fillText(c, cx + cw / 2, y + ch * 0.73); g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(cx, y + ch / 2 - 1, cw, 2); cx += cw + gap; }
    else { g.fillStyle = '#fff6e2'; g.fillText(c, cx + size * 0.16, y + ch * 0.73); cx += size * 0.34 + gap; } } g.textAlign = 'left'; }
function medal(g, cx, cy, r, rar) { const Cc = { base: ['#2a6a95', '#0f2b4c', '#2a6a95'], silver: ['#f2f6fb', '#8e9db2', '#dfe6ef'], gold: ['#ffe9b5', '#c58b3a', '#f9d78f'], legend: ['#ff4f9a', '#ffc56b', '#5eeaff'] }[rar] || ['#2a6a95', '#0f2b4c', '#2a6a95'];
  const gr = g.createLinearGradient(cx - r, cy - r, cx + r, cy + r); gr.addColorStop(0, Cc[0]); gr.addColorStop(0.55, Cc[1]); gr.addColorStop(1, Cc[2]);
  g.beginPath(); g.arc(cx, cy, r + 6, 0, 7); g.fillStyle = 'rgba(0,0,0,.4)'; g.fill(); g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fillStyle = gr; g.fill();
  const hl = g.createRadialGradient(cx - r * 0.35, cy - r * 0.45, 1, cx - r * 0.35, cy - r * 0.45, r * 0.9); hl.addColorStop(0, 'rgba(255,255,255,.55)'); hl.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = hl; g.fill();
  g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,.25)'; g.stroke(); }
function emblem(g, cx, cy, R, style) {
  g.save(); g.strokeStyle = style; g.lineWidth = 4; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.stroke(); g.lineWidth = 2.4;
  for (const k of [0.36, 0.74]) { g.beginPath(); g.ellipse(cx, cy, R * k, R, 0, 0, 7); g.stroke(); }
  g.beginPath(); g.moveTo(cx, cy - R); g.lineTo(cx, cy + R); g.stroke();
  for (const la of [-0.62, -0.3, 0, 0.3, 0.62]) { const y = cy + R * Math.sin(la), hw = R * Math.cos(la); g.beginPath(); g.ellipse(cx, y, hw, hw * 0.16, 0, 0, Math.PI); g.stroke(); }
  g.lineWidth = 3.4; g.beginPath(); g.ellipse(cx, cy, R * 1.32, R * 0.34, -0.34, 0, Math.PI); g.stroke(); g.restore();
}
function qrDraw(g, text, x, y, size) {
  const q = qrcode(0, 'M'); q.addData(text); q.make(); const n = q.getModuleCount(), cell = size / (n + 4);
  g.fillStyle = '#fff'; rr(g, x - 14, y - 14, size + 28, size + 28, 18); g.fill(); g.lineWidth = 2; g.strokeStyle = 'rgba(94,234,255,.8)'; g.stroke(); g.fillStyle = '#04101f';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) g.fillRect(x + (c + 2) * cell, y + (r + 2) * cell, Math.ceil(cell), Math.ceil(cell));
}
// lon/lat → poster pixels for the fixed base map
function proj(lon, lat, top) { const d = ((lon - LON0 + 540) % 360) - 180; return [MAP_X + (d / 360 + 0.5) * MAP_W, top + (LAT0 - lat) * MAP_W / 360]; }
function drawRoutes(g, flights, top) {
  g.save(); g.beginPath(); g.rect(MAP_X, top, MAP_W, MAP_H); g.clip(); g.lineCap = 'round';
  const routes = new Map(), aps = new Map();
  for (const f of flights) { const A = C.AP[f.f], B = C.AP[f.to]; if (!A || !B) continue; const k = [f.f, f.to].sort().join() + (f.up ? 'u' : ''), r = routes.get(k); if (r) r.n++; else routes.set(k, { f, n: 1 }); for (const a of [f.f, f.to]) aps.set(a, (aps.get(a) || 0) + 1); }
  g.globalCompositeOperation = 'lighter';
  for (const { f, n } of routes.values()) {
    const A = C.AP[f.f], B = C.AP[f.to], a = proj(A.lon, A.lat, top), b = proj(B.lon, B.lat, top);
    const segs = Math.abs(b[0] - a[0]) > MAP_W / 2 ? [[a, [b[0] + (b[0] < a[0] ? MAP_W : -MAP_W), b[1]]], [[a[0] + (a[0] < b[0] ? MAP_W : -MAP_W), a[1]], b]] : [[a, b]]; // wrap across the map edge
    for (const [p, q] of segs) {
      const dx = q[0] - p[0], dy = q[1] - p[1], Ln = Math.hypot(dx, dy) || 1; let nx = -dy / Ln, ny = dx / Ln; if (ny > 0) { nx = -nx; ny = -ny; }
      const cx = (p[0] + q[0]) / 2 + nx * Ln * 0.18, cy = (p[1] + q[1]) / 2 + ny * Ln * 0.18, path = () => { g.beginPath(); g.moveTo(p[0], p[1]); g.quadraticCurveTo(cx, cy, q[0], q[1]); };
      if (f.up) { g.setLineDash([8, 8]); g.lineWidth = 2; g.strokeStyle = 'rgba(94,234,255,.75)'; path(); g.stroke(); g.setLineDash([]); continue; }
      g.lineWidth = 8 + Math.min(6, n); g.strokeStyle = 'rgba(255,79,154,.08)'; path(); g.stroke();
      const lg = g.createLinearGradient(p[0], p[1], q[0] + 0.01, q[1]); lg.addColorStop(0, 'rgba(255,214,150,.95)'); lg.addColorStop(1, 'rgba(255,79,154,.95)'); g.lineWidth = 1.6 + Math.min(2.4, n * 0.35); g.strokeStyle = lg; path(); g.stroke();
    }
  }
  for (const [code, n] of aps) { const A = C.AP[code], p = proj(A.lon, A.lat, top), r = 6 + Math.min(8, Math.sqrt(n) * 2), rg = g.createRadialGradient(p[0], p[1], 0, p[0], p[1], r * 2); rg.addColorStop(0, 'rgba(111,247,200,.55)'); rg.addColorStop(1, 'rgba(111,247,200,0)'); g.fillStyle = rg; g.beginPath(); g.arc(p[0], p[1], r * 2, 0, 7); g.fill(); g.fillStyle = '#eafff7'; g.beginPath(); g.arc(p[0], p[1], 3, 0, 7); g.fill(); }
  g.globalCompositeOperation = 'source-over'; g.font = F(700, 15, 1); g.lineJoin = 'round'; g.textAlign = 'left';
  for (const [code] of [...aps].sort((a, b) => b[1] - a[1]).slice(0, 8)) { const A = C.AP[code], p = proj(A.lon, A.lat, top); if (p[0] > MAP_X + MAP_W - 60) continue; g.lineWidth = 5; g.strokeStyle = 'rgba(4,11,30,.9)'; g.strokeText(code, p[0] + 9, p[1] - 9); g.fillStyle = NP.ac; g.fillText(code, p[0] + 9, p[1] - 9); }
  g.restore(); return routes.size;
}
const hashS = s => { let a = 7; for (const ch of s) a = (a * 31 + ch.charCodeAt(0)) >>> 0; return a; };
const rng = seed => { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };

// data: { name, latin, label, sum, badges, flights, site }; mapImg: canvas image of mp-world-night.png (may be null)
function draw(g, data, mapImg) {
  const Lh = layout(data), H = height(data), S = data.sum, flown = data.flights.filter(f => !f.up), LF = flown.length ? flown : data.flights;
  const seed = hashS((data.latin || data.name || 'SKY') + data.label), rnd = rng(seed), T = tier(S.km);
  /* background: night sky, glows, stars */
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#030716'); bg.addColorStop(0.25, '#071431'); bg.addColorStop(0.6, '#050d24'); bg.addColorStop(1, '#02040b'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  for (const [x, y, r, col] of [[W * 0.85, 120, 760, 'rgba(56,90,210,.30)'], [W * 0.05, 700, 620, 'rgba(255,79,154,.10)'], [W * 0.9, H * 0.55, 700, 'rgba(167,139,250,.10)']]) { const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, col); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(0, 0, W, H); }
  for (let i = 0; i < Math.round(H / 5); i++) { const x = rnd() * W, y = rnd() * H, s = rnd(); g.fillStyle = `rgba(${s < 0.18 ? '255,214,170' : '200,236,255'},${(0.2 + rnd() * 0.7).toFixed(2)})`; g.fillRect(x, y, s > 0.93 ? 2.2 : 1.2, s > 0.93 ? 2.2 : 1.2); }
  /* cover */
  const serial = `NO. SP-${S.y1}-${(seed % 65536).toString(16).toUpperCase().padStart(4, '0')}`;
  g.font = F(700, 19, 1); g.fillStyle = NP.ac; trk(g, 'SKY PASSPORT // FLIGHT LOG', 60, 70, 4); g.fillStyle = NP.gold; trk(g, serial, W - 60, 70, 3, 'right');
  g.font = '900 46px serif'; g.fillStyle = gold(g, 90, 140); trk(g, '航迹护照', 60, 136, 14); g.font = F(400, 18, 1); g.fillStyle = NP.mut; g.textAlign = 'right'; g.fillText('VALID · 一生有效', W - 60, 132); g.textAlign = 'left';
  g.fillStyle = NP.line; g.fillRect(60, 162, W - 120, 1); for (let x = 60; x <= W - 60; x += 24) g.fillRect(x, x % 120 === 60 ? 154 : 158, 1, x % 120 === 60 ? 9 : 5);
  const ex = W / 2, ey = 350, ER = 118; { const halo = g.createRadialGradient(ex, ey, 10, ex, ey, ER * 2.6); halo.addColorStop(0, 'rgba(94,234,255,.16)'); halo.addColorStop(1, 'rgba(94,234,255,0)'); g.fillStyle = halo; g.fillRect(0, 160, W, 420);
    g.strokeStyle = 'rgba(94,234,255,.25)'; g.lineWidth = 1.4; g.setLineDash([5, 7]); g.beginPath(); g.arc(ex, ey, ER * 1.5, 0, 7); g.stroke(); g.setLineDash([]);
    g.strokeStyle = 'rgba(94,234,255,.6)'; g.lineWidth = 2.4; g.beginPath(); g.arc(ex, ey, ER * 1.38, -2.5, -1.2); g.stroke();
    for (let a = 0; a < 360; a += 6) { const r0 = ER * 1.26, r1 = ER * (a % 30 === 0 ? 1.33 : 1.3), t = a * Math.PI / 180; g.strokeStyle = a % 30 === 0 ? 'rgba(94,234,255,.55)' : 'rgba(94,234,255,.22)'; g.lineWidth = a % 30 === 0 ? 2 : 1; g.beginPath(); g.moveTo(ex + Math.cos(t) * r0, ey + Math.sin(t) * r0); g.lineTo(ex + Math.cos(t) * r1, ey + Math.sin(t) * r1); g.stroke(); }
    g.fillStyle = NP.ac2; g.beginPath(); g.arc(ex + Math.cos(-1.2) * ER * 1.5, ey + Math.sin(-1.2) * ER * 1.5, 7, 0, 7); g.fill(); emblem(g, ex, ey, ER * 0.82, gold(g, ey - ER, ey + ER)); }
  g.font = F(700, 18, 1); g.fillStyle = NP.ac; g.fillText('● 飞行里程', 60, 236); g.font = F(700, 28, 1); g.fillStyle = NP.ink; g.fillText(`${fmt(S.km)} KM`, 60, 272);
  g.textAlign = 'right'; g.font = F(700, 18, 1); g.fillStyle = NP.ac; g.fillText('ORBIT · 01', W - 60, 236); g.font = F(700, 28, 1); g.fillStyle = NP.ink; g.fillText(`${(S.km / 40075).toFixed(2)} 圈`, W - 60, 272);
  g.textAlign = 'center'; const nm = data.name || '我的飞行护照'; fit(g, nm, 940, 88, 800); const ng = g.createLinearGradient(0, 520, 0, 600); ng.addColorStop(0, '#ffffff'); ng.addColorStop(1, '#bfeeff'); g.fillStyle = ng; g.fillText(nm, W / 2, 600);
  g.font = F(700, 32, 1); g.fillStyle = gold(g, 620, 660); trk(g, `${data.label.replace(' 年度', '')}  ·  FLIGHT LOG`, W / 2, 656, 2, 'center'); g.textAlign = 'center';
  g.font = F(400, 26); g.fillStyle = NP.mut; g.fillText(S.y0 === S.y1 ? '我的年度飞行报告' : '一本护照，装下我的天空', W / 2, 700); g.textAlign = 'left';
  let y = Lh.cover;
  /* boarding pass: home base → farthest airport */
  { const apc = new Map(); for (const f of LF) for (const a of [f.f, f.to]) apc.set(a, (apc.get(a) || 0) + 1); const fromC = [...apc].sort((a, b) => b[1] - a[1])[0][0]; let toC = fromC, fk = -1; for (const [a] of apc) { if (!C.AP[a] || !C.AP[fromC]) continue; const d = C.hav(C.AP[fromC], C.AP[a]); if (d > fk) { fk = d; toC = a; } }
    const x = 60, w = W - 120, h = 250, yy = y + 20, px = x + w - 250; panel(g, x, yy, w, h, 26, 'rgba(94,234,255,.35)');
    g.fillStyle = bg; for (const cy of [yy, yy + h]) { g.beginPath(); g.arc(px, cy, 20, 0, 7); g.fill(); }
    g.setLineDash([6, 8]); g.strokeStyle = 'rgba(94,234,255,.4)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(px, yy + 26); g.lineTo(px, yy + h - 26); g.stroke(); g.setLineDash([]);
    g.font = F(700, 17, 1); g.fillStyle = NP.ac; trk(g, 'BOARDING PASS · 登机牌', x + 32, yy + 42, 3); g.font = F(400, 14, 1); g.fillStyle = NP.mut; g.fillText('大本营 · HOME', x + 32, yy + 64);
    g.font = F(700, 80, 1); g.fillStyle = '#fff6e2'; g.fillText(fromC, x + 30, yy + 130); const fw = g.measureText(fromC).width;
    g.fillStyle = NP.ac; g.font = F(700, 44); g.fillText('✈', x + 30 + fw + 44, yy + 116); g.font = F(700, 80, 1); g.fillStyle = '#fff6e2'; g.fillText(toC, x + 30 + fw + 140, yy + 130);
    g.font = F(400, 14, 1); g.fillStyle = NP.mut; g.fillText(`最远 · ${fmt(Math.max(0, fk))} KM`, x + 32 + fw + 140, yy + 64); g.font = F(400, 19); g.fillText(placeName(fromC), x + 32, yy + 162); g.fillText(placeName(toC), x + 30 + fw + 142, yy + 162);
    let fx = x + 32; for (const [k, v] of [['旅客', data.latin || data.name || '— — —'], ['年份', S.y0 === S.y1 ? String(S.y0) : `${S.y0}–${S.y1}`], ['航班', String(S.n)]]) { g.font = F(400, 15, 1); g.fillStyle = NP.ac; g.fillText(k, fx, yy + 200); fit(g, v, 200, 24, 700, 1); g.fillStyle = NP.ink; g.fillText(v, fx, yy + 230); fx += Math.max(150, g.measureText(v).width + 40); }
    g.font = F(400, 15, 1); g.fillStyle = NP.ac; g.fillText('等级 · CLASS', px + 34, yy + 42); g.font = F(800, 40); g.fillStyle = gold(g, yy + 60, yy + 100); g.fillText(T[1], px + 34, yy + 94); g.font = F(400, 18); g.fillStyle = NP.mut; g.fillText(T[3], px + 34, yy + 124);
    let bx = px + 34; const r2 = rng(seed + 7); g.fillStyle = 'rgba(234,244,255,.85)'; while (bx < x + w - 30) { const bw = 1 + Math.floor(r2() * 4); g.fillRect(bx, yy + 150, bw, 66); bx += bw + 1 + Math.floor(r2() * 3); }
    g.font = F(400, 13, 1); g.fillStyle = NP.mut; g.fillText(serial.replace('NO. ', ''), px + 34, yy + 234); y += Lh.pass; }
  /* numbers */
  y += GAP; head(g, y, 'FLIGHT DATA', '飞行数据'); y += 58;
  [['航班', String(S.n), 'FLT'], ['里程', fmt(S.km), 'KM'], ['空中时间', fmt(S.min / 60), 'HRS'], ['国家地区', String(S.cc), 'CTRY'], ['机场', String(S.ap), 'APT'], ['航司', String(S.al), 'AIRL']].forEach(([l, v, u], i) => {
    const tw = (W - 120 - 40) / 3, cx = 60 + (i % 3) * (tw + 20), cy = y + Math.floor(i / 3) * 168; panel(g, cx, cy, tw, 150, 18);
    g.font = F(400, 20); g.fillStyle = NP.mut; g.fillText(l, cx + 22, cy + 38); g.textAlign = 'right'; g.font = F(700, 15, 1); g.fillStyle = NP.ac; g.fillText(u, cx + tw - 20, cy + 36); g.textAlign = 'left';
    let fs = 50; while (flapW(v, fs) > tw - 40 && fs > 24) fs -= 2; flap(g, cx + 20, cy + 58, v, fs); });
  y += 336;
  /* route map */
  y += GAP; const hy = y; y += 58; panel(g, MAP_X, y, MAP_W, MAP_H, 22); g.save(); rr(g, MAP_X, y, MAP_W, MAP_H, 22); g.clip(); if (mapImg) g.drawImage(mapImg, MAP_X, y, MAP_W, MAP_H); g.restore();
  const nr = drawRoutes(g, data.flights, y); corners(g, MAP_X + 12, y + 12, MAP_W - 24, MAP_H - 24, 26, 'rgba(94,234,255,.7)'); head(g, hy, 'ROUTE MAP', '航线图', `${nr} 条航线`);
  y += MAP_H + 22; g.font = F(400, 18); let lx = 60; for (const [col, dash, txt] of [['#ffb08a', false, '已飞'], [NP.ac, true, '待出行'], ['#6ff7c8', null, '机场']]) {
    if (dash === null) { g.fillStyle = col; g.beginPath(); g.arc(lx + 8, y + 20, 6, 0, 7); g.fill(); } else { g.strokeStyle = col; g.lineWidth = 3; g.setLineDash(dash ? [6, 5] : []); g.beginPath(); g.moveTo(lx, y + 20); g.lineTo(lx + 34, y + 20); g.stroke(); g.setLineDash([]); }
    g.fillStyle = NP.mut; g.fillText(txt, lx + (dash === null ? 24 : 44), y + 27); lx += g.measureText(txt).width + (dash === null ? 60 : 80); }
  y += 42;
  /* medals */
  if (data.badges.length) { y += GAP; head(g, y, 'ACHIEVEMENTS', '飞行成就', `${data.badges.length} 枚勋章`); y += 58; const RAR = { legend: '传奇', gold: '金', silver: '银' };
    data.badges.forEach((b, i) => { const cw = (W - 120 - 20) / 2, cx = 60 + (i % 2) * (cw + 20), cy = y + Math.floor(i / 2) * 172, ch = 154;
      panel(g, cx, cy, cw, ch, 20, b.rar === 'gold' ? 'rgba(233,197,142,.45)' : b.rar === 'legend' ? 'rgba(255,150,200,.7)' : 'rgba(94,234,255,.22)');
      medal(g, cx + 68, cy + ch / 2, 42, b.rar); g.font = F(400, 38); g.textAlign = 'center'; g.fillStyle = '#fff'; g.fillText(b.i, cx + 68, cy + ch / 2 + 14); g.textAlign = 'left';
      const tx = cx + 134, tw = cw - 150; g.font = F(400, 19); g.fillStyle = NP.mut; g.fillText(b.k, tx, cy + 48); fit(g, b.v, tw, 32, 800); g.fillStyle = NP.ink; g.fillText(b.v, tx, cy + 90); fit(g, b.d, tw, 18, 400); g.fillStyle = NP.mut; g.fillText(b.d, tx, cy + 124);
      if (RAR[b.rar]) { g.font = F(700, 13, 1); const tw2 = g.measureText(RAR[b.rar]).width + 16; rr(g, cx + cw - tw2 - 16, cy + 14, tw2, 24, 6); g.fillStyle = b.rar === 'gold' ? NP.gold : b.rar === 'silver' ? '#cfd8e4' : '#ff9cc3'; g.fill(); g.fillStyle = '#02040b'; g.fillText(RAR[b.rar], cx + cw - tw2 - 8, cy + 31); } });
    y += Math.ceil(data.badges.length / 2) * 172 - 18; }
  /* timeline */
  if (S.years.length > 1) { y += GAP; head(g, y, 'TIMELINE', '每年的航班'); y += 58; panel(g, 60, y, W - 120, 300, 22);
    const years = S.years, mx = Math.max(...years.map(v => v.n)), n = years.length, bw = Math.min(72, (W - 200) / n - 14), x0 = W / 2 - (n * (bw + 14) - 14) / 2, base = y + 236, hmax = 170;
    g.strokeStyle = 'rgba(94,234,255,.08)'; g.lineWidth = 1; g.setLineDash([4, 6]); for (let q = 1; q <= 4; q++) { g.beginPath(); g.moveTo(90, base - hmax * q / 4); g.lineTo(W - 90, base - hmax * q / 4); g.stroke(); } g.setLineDash([]); g.fillStyle = 'rgba(94,234,255,.35)'; g.fillRect(90, base, W - 180, 1.5);
    years.forEach((v, i) => { const x = x0 + i * (bw + 14), h = Math.max(6, hmax * v.n / mx), top = v.n === mx, gr = g.createLinearGradient(0, base - h, 0, base); if (top) { gr.addColorStop(0, '#ffe3a3'); gr.addColorStop(1, '#c58b3a'); } else { gr.addColorStop(0, NP.ac); gr.addColorStop(1, 'rgba(167,139,250,.75)'); }
      g.fillStyle = top ? 'rgba(233,197,142,.12)' : 'rgba(94,234,255,.10)'; rr(g, x - 6, base - h - 6, bw + 12, h + 6, 8); g.fill(); g.fillStyle = gr; rr(g, x, base - h, bw, h, 6); g.fill(); g.fillStyle = 'rgba(255,255,255,.6)'; g.fillRect(x + 3, base - h + 2, bw - 6, 2);
      g.textAlign = 'center'; g.font = F(700, 20, 1); g.fillStyle = top ? NP.gold : NP.ink; g.fillText(String(v.n), x + bw / 2, base - h - 14); g.font = F(400, 17, 1); g.fillStyle = NP.mut; g.fillText("'" + String(v.y).slice(2), x + bw / 2, base + 30); g.textAlign = 'left'; });
    y += 300; }
  /* footer: QR to the web version, machine-readable zone */
  const fy = H - Lh.foot; g.fillStyle = 'rgba(2,4,11,.6)'; g.fillRect(0, fy, W, Lh.foot); const tl = g.createLinearGradient(0, 0, W, 0); tl.addColorStop(0, 'rgba(255,79,154,0)'); tl.addColorStop(0.3, NP.ac2); tl.addColorStop(0.7, NP.ac); tl.addColorStop(1, 'rgba(94,234,255,0)'); g.fillStyle = tl; g.fillRect(0, fy, W, 2);
  g.strokeStyle = 'rgba(94,234,255,.05)'; g.lineWidth = 1; for (let x = 0; x <= W; x += 40) { g.beginPath(); g.moveTo(x, fy); g.lineTo(x, H); g.stroke(); } for (let yy = fy; yy <= H; yy += 40) { g.beginPath(); g.moveTo(0, yy); g.lineTo(W, yy); g.stroke(); }
  const qs = 196, qx = W - 60 - qs - 16, qy = fy + 56; qrDraw(g, data.site, qx, qy, qs); corners(g, qx - 26, qy - 26, qs + 52, qs + 52, 22);
  g.textAlign = 'left'; g.font = F(800, 40); g.fillStyle = gold(g, fy + 70, fy + 120); g.fillText('扫码生成你的飞行护照', 60, fy + 112); g.font = F(700, 26, 1); g.fillStyle = NP.ink; g.fillText(data.site.replace(/^https?:\/\//, ''), 60, fy + 160);
  g.font = F(400, 19); g.fillStyle = NP.mut; g.fillText('微信小程序「航迹护照」 · 免费', 60, fy + 198);
  const mrz = ('P<CHN' + (data.latin || 'TRAVELLER').toUpperCase().replace(/[^A-Z]+/g, '<') + '<<FLIGHT<LOG').padEnd(44, '<').slice(0, 44), mrz2 = (serial.replace(/[^A-Z0-9]/g, '') + '<' + S.y0 + S.y1 + '<' + S.n + '<' + S.km).padEnd(44, '<').slice(0, 44);
  g.font = F(400, 17, 1); g.fillStyle = 'rgba(94,234,255,.45)'; g.fillText(mrz, 60, fy + 266); g.fillText(mrz2, 60, fy + 294);
  return H;
}

module.exports = { W, height, draw };
