// Long poster for the mini program, drawn on a canvas type="2d" (no Path2D / letterSpacing: plain 2D calls only).
// Layout mirrors the web long poster; the route map uses a pre-rendered base (mp-world.png, centre 105°E, 78°N…56°S).
const { placeName, fmt } = require('./stats.js');
const qrcode = require('./qrcode.js');
const C = require('./core.js');

const W = 1080, MAP_W = 940, MAP_X = 70, LON0 = 105, LAT0 = 78, LAT1 = -56;
const MAP_H = Math.round((LAT0 - LAT1) * MAP_W / 360);
const THEME = { c0: '#6b1a2a', c1: '#4a0f1c', c2: '#1f050c' };

function layout(data) {
  const rowsB = Math.ceil(data.badges.length / 2);
  return { Hd: 520, Hn: 160, Hs: 320, Hm: MAP_H + 60, Hb: data.badges.length ? 70 + rowsB * 150 : 0, Hy: data.sum.years.length > 1 ? 300 : 0, Hq: 260 };
}
function height(data) { const L = layout(data); return L.Hd + L.Hn + L.Hs + L.Hm + L.Hb + L.Hy + L.Hq + 20; }

function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function gold(g, y0, y1) { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, '#fbe9c2'); gr.addColorStop(0.55, '#e2b670'); gr.addColorStop(1, '#f6dca6'); return gr; }
function fit(g, txt, max, size, weight) { let s = size; g.font = `${weight} ${s}px sans-serif`; while (g.measureText(txt).width > max && s > 14) { s -= 2; g.font = `${weight} ${s}px sans-serif`; } return s; }
function spaced(g, txt, cx, y, track) { const ch = [...txt], ws = ch.map(c => g.measureText(c).width); let x = cx - (ws.reduce((a, b) => a + b, 0) + track * (ch.length - 1)) / 2; g.textAlign = 'left'; ch.forEach((c, i) => { g.fillText(c, x, y); x += ws[i] + track; }); }

// lon/lat → poster pixels for the fixed base map
function proj(lon, lat, top) { let d = ((lon - LON0 + 540) % 360) - 180; return [MAP_X + (d / 360 + 0.5) * MAP_W, top + (LAT0 - lat) * MAP_W / 360]; }

function drawRoutes(g, flights, top) {
  g.save(); g.beginPath(); g.rect(MAP_X, top, MAP_W, MAP_H); g.clip();
  const seen = new Map();
  for (const f of flights) {
    const A = C.AP[f.f], B = C.AP[f.to]; if (!A || !B) continue;
    let a = proj(A.lon, A.lat, top), b = proj(B.lon, B.lat, top);
    const segs = Math.abs(b[0] - a[0]) > MAP_W / 2 ? [[a, [b[0] + (b[0] < a[0] ? MAP_W : -MAP_W), b[1]]], [[a[0] + (a[0] < b[0] ? MAP_W : -MAP_W), a[1]], b]] : [[a, b]]; // wrap across the map edge
    for (const [p, q] of segs) {
      const dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy) || 1; let nx = -dy / L, ny = dx / L; if (ny > 0) { nx = -nx; ny = -ny; }
      const cx = (p[0] + q[0]) / 2 + nx * L * 0.18, cy = (p[1] + q[1]) / 2 + ny * L * 0.18;
      g.beginPath(); g.moveTo(p[0], p[1]); g.quadraticCurveTo(cx, cy, q[0], q[1]);
      g.lineWidth = f.up ? 2 : 2.4; g.strokeStyle = f.up ? 'rgba(30,110,200,.75)' : 'rgba(205,30,55,.72)'; g.stroke();
    }
    seen.set(f.f, a); seen.set(f.to, b);
  }
  for (const [, p] of seen) { g.beginPath(); g.arc(p[0], p[1], 4.5, 0, 7); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 2.4; g.strokeStyle = '#b0173a'; g.stroke(); }
  g.restore();
}

function emblem(g, cx, cy, R, style) {
  g.save(); g.strokeStyle = style; g.lineWidth = 4; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.stroke(); g.lineWidth = 2.4;
  for (const k of [0.36, 0.74]) { g.beginPath(); g.ellipse(cx, cy, R * k, R, 0, 0, 7); g.stroke(); }
  g.beginPath(); g.moveTo(cx, cy - R); g.lineTo(cx, cy + R); g.stroke();
  for (const la of [-0.62, -0.3, 0, 0.3, 0.62]) { const y = cy + R * Math.sin(la), hw = R * Math.cos(la); g.beginPath(); g.ellipse(cx, y, hw, hw * 0.16, 0, 0, Math.PI); g.stroke(); }
  g.lineWidth = 3.4; g.beginPath(); g.ellipse(cx, cy, R * 1.32, R * 0.34, -0.34, 0, Math.PI); g.stroke(); g.restore();
}

function qrDraw(g, text, x, y, size) {
  const q = qrcode(0, 'M'); q.addData(text); q.make(); const n = q.getModuleCount(), cell = size / (n + 4);
  g.fillStyle = '#fff'; rr(g, x - 10, y - 10, size + 20, size + 20, 14); g.fill(); g.fillStyle = '#2a0b12';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) g.fillRect(x + (c + 2) * cell, y + (r + 2) * cell, Math.ceil(cell), Math.ceil(cell));
}

// data: { name, label, sum, badges, flights, site }; mapImg: canvas image of mp-world.png (may be null)
function draw(g, data, mapImg) {
  const Lh = layout(data), H = height(data), S = data.sum;
  const pg = g.createLinearGradient(0, 0, W, H); pg.addColorStop(0, '#fbf7f6'); pg.addColorStop(1, '#f1ecf5'); g.fillStyle = pg; g.fillRect(0, 0, W, H);
  // leather header
  const hd = g.createRadialGradient(W / 2, 180, 40, W / 2, 300, 900); hd.addColorStop(0, THEME.c0); hd.addColorStop(0.6, THEME.c1); hd.addColorStop(1, THEME.c2);
  g.fillStyle = hd; g.fillRect(0, 0, W, Lh.Hd);
  const gd = gold(g, 60, 480); emblem(g, W / 2, 190, 92, gd);
  g.fillStyle = gd; g.font = '900 96px serif'; spaced(g, '航迹护照', W / 2, 420, 18); g.font = '600 26px sans-serif'; spaced(g, 'SKY PASSPORT', W / 2, 468, 12);
  g.strokeStyle = 'rgba(227,189,132,.6)'; g.lineWidth = 2; rr(g, 24, 24, W - 48, Lh.Hd - 48, 26); g.stroke();
  let y = Lh.Hd;
  // who and when
  const head = data.name ? `${data.name} · ${data.label}` : data.label;
  g.textAlign = 'center'; g.fillStyle = '#4b1019'; fit(g, head, 960, 54, 700); g.fillText(head, W / 2, y + 88);
  g.font = '400 26px sans-serif'; g.fillStyle = '#8e5a6a'; g.fillText(S.y0 === S.y1 ? '我的年度飞行报告' : '我的飞行护照 · 一本护照，装下我的天空', W / 2, y + 132); y += Lh.Hn;
  // stats
  [['航班', String(S.n), 'flights'], ['里程', fmt(S.km), 'km'], ['飞行时长', String(Math.round(S.min / 60)), 'hours'], ['国家地区', String(S.cc), 'countries'], ['机场', String(S.ap), 'airports'], ['航司', String(S.al), 'airlines']].forEach(([l, v, u], i) => {
    const cx = 70 + (i % 3) * 320, cy = y + 10 + Math.floor(i / 3) * 150;
    g.fillStyle = 'rgba(255,255,255,.78)'; rr(g, cx, cy, 300, 130, 18); g.fill(); g.strokeStyle = 'rgba(142,29,56,.15)'; g.lineWidth = 2; g.stroke();
    g.textAlign = 'left'; g.font = '400 22px sans-serif'; g.fillStyle = '#9a2b46'; g.fillText(l, cx + 22, cy + 40);
    fit(g, v, 250, 56, 700); g.fillStyle = '#1d1420'; g.fillText(v, cx + 22, cy + 104);
    g.textAlign = 'right'; g.font = '400 18px monospace'; g.fillStyle = '#9a7f8a'; g.fillText(u, cx + 280, cy + 40);
  });
  y += Lh.Hs;
  // route map
  const top = y + 20;
  if (mapImg) g.drawImage(mapImg, MAP_X, top, MAP_W, MAP_H);
  drawRoutes(g, data.flights, top); y += Lh.Hm;
  // achievements
  if (data.badges.length) {
    y += 40; g.textAlign = 'left'; g.font = '700 34px sans-serif'; g.fillStyle = '#4b1019'; g.fillText('飞行成就', 70, y); y += 30;
    data.badges.forEach((b, i) => {
      const cx = 70 + (i % 2) * 480, cy = y + Math.floor(i / 2) * 150;
      g.fillStyle = 'rgba(255,255,255,.82)'; rr(g, cx, cy, 460, 130, 18); g.fill(); g.strokeStyle = 'rgba(185,138,80,.45)'; g.lineWidth = 2; g.stroke();
      g.textAlign = 'left'; g.font = '400 22px sans-serif'; g.fillStyle = '#9a2b46'; g.fillText(`${b.i} ${b.k}`, cx + 22, cy + 38);
      fit(g, b.v, 416, 34, 700); g.fillStyle = '#1d1420'; g.fillText(b.v, cx + 22, cy + 82);
      fit(g, b.d, 416, 20, 400); g.fillStyle = '#8a7480'; g.fillText(b.d, cx + 22, cy + 114);
    });
    y += Math.ceil(data.badges.length / 2) * 150;
  }
  // flights per year
  if (S.years.length > 1) {
    y += 40; g.textAlign = 'left'; g.font = '700 34px sans-serif'; g.fillStyle = '#4b1019'; g.fillText('每年的航班', 70, y); y += 40;
    const mx = Math.max(...S.years.map(v => v.n)), bw = Math.min(90, (W - 160) / S.years.length - 14);
    S.years.forEach((v, i) => {
      const x = 80 + i * (bw + 14), h = Math.max(6, 160 * v.n / mx), gr = g.createLinearGradient(0, y + 180 - h, 0, y + 180);
      gr.addColorStop(0, '#c41e37'); gr.addColorStop(1, '#e98aa8'); g.fillStyle = gr; rr(g, x, y + 180 - h, bw, h, 6); g.fill();
      g.textAlign = 'center'; g.font = '700 20px monospace'; g.fillStyle = '#4b1019'; g.fillText(String(v.n), x + bw / 2, y + 170 - h);
      g.font = '400 18px monospace'; g.fillStyle = '#8a7480'; g.fillText("'" + String(v.y).slice(2), x + bw / 2, y + 210);
    });
  }
  // footer: QR to the web version (video)
  const fy = H - Lh.Hq; g.fillStyle = hd; g.fillRect(0, fy, W, Lh.Hq);
  qrDraw(g, data.site, W - 230, fy + 46, 160);
  g.textAlign = 'left'; g.fillStyle = gold(g, fy + 60, fy + 200); g.font = '700 40px sans-serif'; g.fillText('扫码生成你的飞行护照视频', 70, fy + 108);
  g.font = '400 26px monospace'; g.fillStyle = '#e9d8cf'; g.fillText(data.site.replace(/^https?:\/\//, ''), 70, fy + 156);
  g.font = '400 22px sans-serif'; g.fillStyle = 'rgba(233,216,207,.6)'; g.fillText('微信小程序「航迹护照」', 70, fy + 202);
  return H;
}

module.exports = { W, height, draw };
