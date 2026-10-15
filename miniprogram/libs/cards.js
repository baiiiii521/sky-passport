// Share images drawn on the phone (canvas type="2d"), in the same night look as the long poster:
//   share  1000×800   the card of a WeChat share (5:4): the traveller's own map and numbers
//   xhs1-3 1080×1440  three 3:4 cards for 小红书: cover, the map, the medals
//   medal  1080×1440  one medal, to show off
// d = { name, label, sum, flights, badges (picked), got, total, cities, routes }; map = image of mp-world-night.png (or null)
const { placeName, fmt } = require('./stats.js');
const PO = require('./poster.js');
const CORE = require('./core.js');
const { rr, gold, fit, trk, panel, corners, flap, flapW, medal, emblem, drawRoutes, rng, NP, F, MAP_W, MAP_X, MAP_H } = PO.lib;

const SERIF = '"HJSerif", "Songti SC", serif';   // HJSerif: the subset loaded by app.js (headline glyphs only); anything else falls back
const SF = (s, w = 900) => `${w} ${s}px ${SERIF}`;
const SIZE = { share: [1000, 800], xhs1: [1080, 1440], xhs2: [1080, 1440], xhs3: [1080, 1440], medal: [1080, 1440] };
const RARN = { legend: '传奇', gold: '金', silver: '银', base: '' };

function bg(g, W, H, seed) {
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#02040b'); gr.addColorStop(0.5, '#071533'); gr.addColorStop(1, '#02040b'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (const [x, y, r, c] of [[W * 0.85, H * 0.1, W * 0.9, 'rgba(56,90,210,.30)'], [W * 0.05, H * 0.55, W * 0.7, 'rgba(255,79,154,.08)']]) { const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, c); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(0, 0, W, H); }
  const R = rng(seed || 7); for (let i = 0; i < 110; i++) { g.fillStyle = `rgba(214,230,255,${0.12 + 0.4 * R()})`; const s = 1 + 2 * R(); g.fillRect(R() * W, R() * H, s, s); }
}
function foot(g, W, H) {
  g.fillStyle = 'rgba(233,197,142,.35)'; g.fillRect(W / 2 - 200, H - 112, 400, 1.5);
  g.textAlign = 'center'; g.fillStyle = gold(g, H - 90, H - 50); g.font = SF(34); trk(g, '航迹手帐', W / 2, H - 58, 10, 'center');
  g.font = F(400, 22, 1); g.fillStyle = NP.mut; trk(g, 'SKY PASSPORT · 微信小程序', W / 2, H - 24, 4, 'center'); g.textAlign = 'left';
}
function wrap(g, txt, x, y, maxW, lh, lines, align) {
  const out = []; let cur = ''; for (const ch of String(txt)) { if (g.measureText(cur + ch).width > maxW && cur) { out.push(cur); cur = ch; if (out.length === lines) break; } else cur += ch; }
  if (out.length < lines && cur) out.push(cur); g.textAlign = align || 'left'; out.slice(0, lines).forEach((l, i) => g.fillText(i === lines - 1 && out.length >= lines && l !== cur ? l.slice(0, -1) + '…' : l, x, y + i * lh)); g.textAlign = 'left';
}
const who = d => d.name ? `${d.name}的航迹手帐` : '我的航迹手帐';
const hours = d => Math.round(d.sum.min / 60);
const laps = d => (d.sum.km / 40075).toFixed(2);
function map(g, d, img, top, x0) {
  g.save(); g.translate(x0 - MAP_X, 0);
  if (img) { g.globalAlpha = 0.95; g.drawImage(img, MAP_X, top, MAP_W, MAP_H); g.globalAlpha = 1; } else { g.fillStyle = 'rgba(16,34,72,.6)'; g.fillRect(MAP_X, top, MAP_W, MAP_H); }
  drawRoutes(g, d.flights, top); g.restore();
}
function coin(g, cx, cy, r, b) {
  medal(g, cx, cy, r, b.rar); g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `${Math.round(r * 0.95)}px "Apple Color Emoji", sans-serif`; g.fillText(b.i, cx, cy + r * 0.04); g.textBaseline = 'alphabetic'; g.textAlign = 'left';
}

const DRAW = {
  share(g, d, img) {
    const W = 1000, H = 800; bg(g, W, H, 3); map(g, d, img, 34, 20);
    const fade = g.createLinearGradient(0, 300, 0, 420); fade.addColorStop(0, 'rgba(2,4,11,0)'); fade.addColorStop(1, 'rgba(2,4,11,1)'); g.fillStyle = fade; g.fillRect(0, 300, W, 120); g.fillStyle = '#02040b'; g.fillRect(0, 420, W, H - 420);
    let s = 60; g.font = SF(s); while (g.measureText(who(d)).width > 880 && s > 36) { s -= 2; g.font = SF(s); } g.fillStyle = gold(g, 440, 500); g.fillText(who(d), 60, 492);
    g.font = F(700, 24, 1); g.fillStyle = NP.ac; trk(g, d.label || '', 62, 536, 4);
    [[fmt(d.sum.n), '次起飞'], [fmt(d.sum.km), '公里'], [String(d.sum.cc), '个国家和地区']].forEach(([v, l], i) => { const x = [60, 290, 640][i]; g.font = F(700, 58, 1); g.fillStyle = '#fff6e2'; g.fillText(v, x, 650); g.font = F(400, 26); g.fillStyle = NP.mut; g.fillText(l, x, 694); });
    g.fillStyle = 'rgba(94,234,255,.18)'; g.fillRect(60, 726, W - 120, 1); g.font = F(400, 24); g.fillStyle = NP.mut; g.fillText(`绕地球 ${laps(d)} 圈 · ${hours(d)} 小时在空中`, 60, 768); g.textAlign = 'right'; g.fillStyle = gold(g, 740, 776); g.font = SF(30); g.fillText('航迹手帐', W - 60, 768); g.textAlign = 'left';
  },
  xhs1(g, d) {
    const W = 1080, H = 1440; bg(g, W, H, 11); corners(g, 40, 40, W - 80, H - 80, 46, 'rgba(94,234,255,.55)');
    g.textAlign = 'center'; g.font = F(700, 24, 1); g.fillStyle = NP.ac; trk(g, 'FLIGHT JOURNAL', W / 2, 140, 10, 'center');
    emblem(g, W / 2, 330, 108, gold(g, 220, 440));
    g.fillStyle = gold(g, 500, 600); let s = 96; g.font = SF(s); while (g.measureText(who(d)).width > 940 && s > 50) { s -= 4; g.font = SF(s); } g.textAlign = 'center'; g.fillText(who(d), W / 2, 590);
    g.font = F(700, 34, 1); g.fillStyle = NP.ink; trk(g, d.label || '', W / 2, 650, 6, 'center');
    [[fmt(d.sum.n), '次起飞'], [fmt(d.sum.km), '公里'], [String(d.sum.cc), '个国家和地区'], [String(hours(d)), '小时在空中']].forEach(([v, l], i) => {
      const x = 80 + (i % 2) * 470, y = 720 + Math.floor(i / 2) * 230; panel(g, x, y, 450, 200, 24); const sz = Math.min(64, Math.floor(380 / Math.max(2, v.length) / 0.82)); flap(g, x + 34, y + 30, v, sz); g.font = F(400, 28); g.fillStyle = NP.mut; g.textAlign = 'left'; g.fillText(l, x + 36, y + 172);
    });
    g.textAlign = 'center'; g.font = SF(48); g.fillStyle = gold(g, 1180, 1240); g.fillText(`绕地球 ${laps(d)} 圈`, W / 2, 1240); g.textAlign = 'left'; foot(g, W, H);
  },
  xhs2(g, d, img) {
    const W = 1080, H = 1440; bg(g, W, H, 13);
    g.font = F(700, 24, 1); g.fillStyle = NP.ac; trk(g, 'ROUTE MAP', 60, 150, 8); g.font = SF(86); g.fillStyle = gold(g, 170, 260); g.fillText('我飞过的地方', 60, 258);
    g.font = F(400, 32); g.fillStyle = NP.mut; g.fillText(`${d.sum.ap} 个机场 · ${d.cities} 座城市 · ${d.sum.cc} 个国家和地区`, 62, 318);
    panel(g, 40, 360, W - 80, MAP_H + 60, 26); map(g, d, img, 390, 60);
    g.font = F(700, 24, 1); g.fillStyle = NP.ac; trk(g, 'TOP ROUTES · 最常飞', 60, 900, 4);
    d.routes.slice(0, 5).forEach((r, i) => { const y = 970 + i * 70; g.fillStyle = 'rgba(94,234,255,.1)'; g.fillRect(60, y + 22, W - 120, 1); g.font = F(700, 34); g.fillStyle = NP.ink; fit(g, r.t, 720, 34, 700); g.fillText(r.t, 60, y); g.font = F(700, 32, 1); g.fillStyle = NP.gold; g.textAlign = 'right'; g.fillText(`${r.n} 次`, W - 60, y); g.textAlign = 'left'; });
    foot(g, W, H);
  },
  xhs3(g, d) {
    const W = 1080, H = 1440; bg(g, W, H, 17);
    g.font = F(700, 24, 1); g.fillStyle = NP.ac; trk(g, 'ACHIEVEMENTS', 60, 150, 8); g.font = SF(86); g.fillStyle = gold(g, 170, 260); g.fillText('飞行成就', 60, 258);
    g.font = F(400, 32); g.fillStyle = NP.mut; g.fillText(`已解锁 ${d.got} / ${d.total} 枚飞行勋章`, 62, 318);
    d.badges.slice(0, 9).forEach((b, i) => { const x = 50 + (i % 3) * 330, y = 370 + Math.floor(i / 3) * 300; panel(g, x, y, 310, 280, 22, b.rar === 'gold' ? 'rgba(233,197,142,.45)' : b.rar === 'legend' ? 'rgba(255,79,154,.5)' : null);
      coin(g, x + 155, y + 92, 62, b); g.textAlign = 'center'; g.font = F(400, 24); g.fillStyle = NP.mut; g.fillText(b.k, x + 155, y + 196); g.fillStyle = NP.ink; const sz = fit(g, b.v, 280, 34, 800); g.font = F(800, sz); g.fillText(b.v, x + 155, y + 244); g.textAlign = 'left'; });
    foot(g, W, H);
  },
  medal(g, d, img, b) {
    const W = 1080, H = 1440; bg(g, W, H, 19); const glow = g.createRadialGradient(W / 2, 560, 0, W / 2, 560, 520); glow.addColorStop(0, b.rar === 'gold' || b.rar === 'legend' ? 'rgba(255,214,160,.28)' : 'rgba(94,234,255,.2)'); glow.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = glow; g.fillRect(0, 0, W, H);
    corners(g, 40, 40, W - 80, H - 80, 46, 'rgba(233,197,142,.5)');
    g.textAlign = 'center'; g.font = F(700, 24, 1); g.fillStyle = NP.ac; trk(g, 'ACHIEVEMENT UNLOCKED', W / 2, 150, 8, 'center');
    if (RARN[b.rar]) { g.font = F(700, 28); const t = RARN[b.rar] + ' · ' + (b.rar === 'legend' ? 'LEGEND' : b.rar.toUpperCase()), w = g.measureText(t).width + 40; rr(g, W / 2 - w / 2, 180, w, 46, 23); g.fillStyle = b.rar === 'legend' ? '#ff4f9a' : b.rar === 'gold' ? '#e9c58e' : '#cfd8e4'; g.fill(); g.fillStyle = '#02040b'; g.textAlign = 'center'; g.fillText(t, W / 2, 213); }
    coin(g, W / 2, 560, 230, b);
    g.textAlign = 'center'; g.font = SF(52); g.fillStyle = gold(g, 860, 910); g.fillText(b.k, W / 2, 910);
    let s = 92; g.font = F(800, s); while (g.measureText(b.v).width > 960 && s > 44) { s -= 4; g.font = F(800, s); } g.fillStyle = '#fff6e2'; g.fillText(b.v, W / 2, 1030);
    g.font = F(400, 34); g.fillStyle = NP.mut; wrap(g, b.d || '', W / 2, 1100, 900, 50, 2, 'center');
    g.font = F(400, 28, 1); g.fillStyle = NP.ink; g.textAlign = 'center'; g.fillText(`${d.name || '我'} · ${d.label || ''}`, W / 2, 1236); g.textAlign = 'left'; foot(g, W, H);
  },
};

// data for the cards from the page's flight list (the same ST helpers the pages use)
function cardData(view, sum, list, picked, all) {
  const cm = new Map(), rt = new Map();
  for (const f of list) { if (f.up || f.vd) continue; for (const c of [f.f, f.to]) { const A = CORE.AP[c]; cm.set(A ? A.city : c, 1); } const k = [f.f, f.to].sort().join('|'); rt.set(k, (rt.get(k) || 0) + 1); }
  const routes = [...rt].sort((a, b) => b[1] - a[1]).map(([k, n]) => { const [a, b] = k.split('|'); return { t: `${placeName(a)} — ${placeName(b)}`, n }; });
  return { name: view.name, label: view.label, sum, flights: list, badges: picked, got: all.filter(b => !b.lock).length, total: all.length, cities: cm.size, routes };
}
// draw `kind` on the page's hidden <canvas id="card"> and hand back a temp file
function render(page, kind, d, img, extra) {
  const [W, H] = SIZE[kind];
  return new Promise((res, rej) => wx.createSelectorQuery().in(page).select('#card').fields({ node: true }).exec(r => {
    const cv = r && r[0] && r[0].node; if (!cv) return rej(new Error('画布不可用'));
    cv.width = W; cv.height = H; const g = cv.getContext('2d'); g.clearRect(0, 0, W, H);
    let im = null; const go = () => { try { DRAW[kind](g, d, im, extra); } catch (e) { return rej(e); }
      wx.canvasToTempFilePath({ canvas: cv, x: 0, y: 0, width: W, height: H, destWidth: W, destHeight: H, fileType: 'jpg', quality: 0.92, success: o => res(o.tempFilePath), fail: rej }); };
    if (img) { im = cv.createImage(); im.onload = go; im.onerror = () => { im = null; go(); }; im.src = img; } else go();
  }));
}
const caption = d => `我的飞行手帐 ✈️ ${d.label ? d.label + '，' : ''}${d.sum.n} 次起飞、${fmt(d.sum.km)} 公里、${d.sum.cc} 个国家和地区，绕地球 ${laps(d)} 圈。\n用「航迹手帐」小程序把航班记录做成了一本会动的护照，还能出长图和成就卡。\n#航迹手帐 #飞行记录 #我的飞行足迹 #旅行日记 #年度总结`;

module.exports = { SIZE, DRAW, render, cardData, caption, who };
