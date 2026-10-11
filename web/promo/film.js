// Sky Passport promo film — a keynote-style story (t2 grammar: drifting light fields, glass cards, springs, blur-in type),
// injected into the running site after the demo scene is built, so product shots come from the real renderer.
// Timeline is laid on the product's own music grid (112 BPM): FILM.scene() builds a fake "scene" for synth().
(function () {
  let PW = 1080, PH = 1920;
  const C = document.createElement('canvas'); C.width = PW; C.height = PH; const g = C.getContext('2d');
  const tmp = document.createElement('canvas'); tmp.width = PW; tmp.height = PH; const tg = tmp.getContext('2d');
  const small = document.createElement('canvas'); small.width = PW / 4; small.height = PH / 4; const sg = small.getContext('2d');
  function resize(w, h) { PW = w; PH = h; C.width = tmp.width = w; C.height = tmp.height = h; small.width = w / 4; small.height = h / 4; }

  /* ---------- palettes (style directions) ---------- */
  const PAL = {
    tech: { name: '科技蓝紫', base: '#05060a', blobs: [[150, 90, 238], [56, 104, 255], [120, 214, 255], [255, 96, 84]], ink: '#f5f5f7', sub: 'rgba(240,240,250,.8)', accent: '#9fd8ff', gold: false },
    brand: { name: '酒红鎏金', base: '#0c0306', blobs: [[196, 30, 55], [227, 189, 132], [120, 60, 160], [80, 160, 200]], ink: '#fbf1e4', sub: 'rgba(245,230,215,.82)', accent: '#e9c58e', gold: true },
    aurora: { name: '极光青粉', base: '#04080a', blobs: [[120, 216, 194], [233, 143, 176], [127, 198, 232], [185, 143, 230]], ink: '#f2fbf9', sub: 'rgba(230,248,244,.8)', accent: '#8ff0d2', gold: false },
  };
  let P = PAL.brand;

  /* ---------- motion helpers ---------- */
  const cl = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const spring = (t, d = 0.6, bounce = 0) => { if (t <= 0) return 0; const z = 1 - bounce, w = 2 * Math.PI / d; if (z >= 1) return 1 - Math.exp(-w * t) * (1 + w * t); const wd = w * Math.sqrt(1 - z * z); return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + z * w / wd * Math.sin(wd * t)); };
  const eo = t => 1 - Math.pow(1 - cl(t), 3), eio = t => { t = cl(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  const expo = t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * cl(t)));
  const win = (t, a, b, fi = 0.35, fo = 0.35) => Math.min(cl((t - a) / fi), cl((b - t) / fo));

  /* ---------- background: drifting light field + grain ---------- */
  function field(t, dim = 1) {
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.filter = 'none';
    sg.setTransform(1, 0, 0, 1, 0, 0); sg.globalCompositeOperation = 'source-over'; sg.fillStyle = P.base; sg.fillRect(0, 0, small.width, small.height);
    sg.globalCompositeOperation = 'screen';
    const pos = [[0.25, 0.22, 9.7], [0.78, 0.35, 11.3], [0.35, 0.72, 12.7], [0.8, 0.82, 10.4]];
    P.blobs.forEach((c, i) => { const [x, y, per] = pos[i]; const px = (x + 0.16 * Math.sin(t * 2 * Math.PI / per + i)) * small.width, py = (y + 0.1 * Math.cos(t * 2 * Math.PI / (per * 1.3) + i * 2)) * small.height, r = small.width * (0.55 + 0.1 * Math.sin(t / per * 5 + i));
      const gr = sg.createRadialGradient(px, py, 0, px, py, r); gr.addColorStop(0, `rgba(${c},${0.55 * dim})`); gr.addColorStop(1, `rgba(${c},0)`); sg.fillStyle = gr; sg.fillRect(0, 0, small.width, small.height); });
    sg.globalCompositeOperation = 'source-over';
    g.fillStyle = P.base; g.fillRect(0, 0, PW, PH); g.filter = 'blur(60px)'; g.drawImage(small, -60, -60, PW + 120, PH + 120); g.filter = 'none';
    const v = g.createRadialGradient(PW / 2, PH * 0.45, 100, PW / 2, PH * 0.5, PH * 0.75); v.addColorStop(0, 'rgba(0,0,0,.25)'); v.addColorStop(1, 'rgba(0,0,0,.55)'); g.fillStyle = v; g.fillRect(0, 0, PW, PH);
  }
  function film_grain(i) { g.save(); g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.05; const p = g.createPattern(GRAIN[i % 3], 'repeat'); p.setTransform(new DOMMatrix([1, 0, 0, 1, (hash(i) * 256) | 0, (hash(i + 7) * 256) | 0])); g.fillStyle = p; g.fillRect(0, 0, PW, PH); g.restore(); }

  /* ---------- type ---------- */
  const font = (w, s, fam) => F(w, s, fam);
  function blurText(s, x, y, size, t0, t, { w = 700, color = P.ink, align = 'center', fam, out = 1e9 } = {}) {
    const u = cl((t - t0) / 0.8), o = Math.min(eo(u), cl((out - t) / 0.35)); if (o <= 0) return;
    g.save(); g.globalAlpha = o; g.filter = u < 1 ? `blur(${(1 - eo(u)) * 22}px)` : 'none'; g.font = font(w, size, fam); g.fillStyle = color; g.textAlign = align;
    g.fillText(s, x, y + (1 - eo(u)) * 30); g.restore();
  }
  function blurChars(s, x, y, size, t0, t, { w = 800, color = P.ink, fam, stag = 0.04, out = 1e9 } = {}) {
    g.save(); g.font = font(w, size, fam); g.textAlign = 'left'; g.fillStyle = color; const ch = [...s], ws = ch.map(c => g.measureText(c).width); let cx = x - ws.reduce((a, b) => a + b, 0) / 2;
    ch.forEach((c, i) => { const u = cl((t - t0 - i * stag) / 0.6), o = Math.min(eo(u), cl((out - t) / 0.35)); if (o > 0) { g.globalAlpha = o; g.filter = u < 1 ? `blur(${(1 - eo(u)) * 16}px)` : 'none'; g.fillText(c, cx, y + (1 - eo(u)) * 46); } cx += ws[i]; });
    g.restore(); }
  function goldFill(y0, y1) { const gr = g.createLinearGradient(0, y0, 0, y1); if (P.gold) { gr.addColorStop(0, '#fbe9c2'); gr.addColorStop(0.55, '#e2b670'); gr.addColorStop(1, '#f6dca6'); } else { gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, P.accent); gr.addColorStop(1, '#ffffff'); } return gr; }
  function sweep(x0, y0, w, h, u) { if (u <= 0 || u >= 1) return; g.save(); g.beginPath(); g.rect(x0, y0, w, h); g.clip(); g.globalCompositeOperation = 'lighter'; const cx = x0 - 200 + (w + 400) * eio(u);
    const gr = g.createLinearGradient(cx - 70, 0, cx + 70, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.setTransform(1, 0, -0.36, 1, 0, 0); g.fillStyle = gr; g.fillRect(x0 - 400, y0, w + 800, h); g.restore(); }

  /* ---------- glass card (backdrop-sampled blur) ---------- */
  function glass(x, y, w, h, r, a = 1) {
    g.save(); g.globalAlpha *= a; // multiplies, so a card inside a fading group fades with it
    g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 70; g.shadowOffsetY = 34; rr(g, x, y, w, h, r); g.fillStyle = 'rgba(0,0,0,.01)'; g.fill(); g.shadowColor = 'transparent';
    tg.setTransform(1, 0, 0, 1, 0, 0); tg.clearRect(0, 0, PW, PH); tg.drawImage(C, 0, 0);
    g.save(); rr(g, x, y, w, h, r); g.clip(); const m = g.getTransform(); g.setTransform(1, 0, 0, 1, 0, 0); g.filter = 'blur(36px) saturate(160%)'; g.drawImage(tmp, 0, 0); g.filter = 'none'; g.setTransform(m);
    g.fillStyle = 'rgba(255,255,255,.075)'; g.fillRect(x, y, w, h);
    const top = g.createLinearGradient(0, y, 0, y + 140); top.addColorStop(0, 'rgba(255,255,255,.14)'); top.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = top; g.fillRect(x, y, w, 140); g.restore();
    const st = g.createLinearGradient(x, y, x + w, y + h); st.addColorStop(0, 'rgba(255,255,255,.42)'); st.addColorStop(1, 'rgba(255,255,255,.06)'); g.strokeStyle = st; g.lineWidth = 1.5; rr(g, x, y, w, h, r); g.stroke();
    g.restore();
  }
  // a card that springs in from below with a slight 3D tilt (scale + skew stand-in), then floats
  function cardIn(t, t0, cx, cy, w, h, draw, { tilt = 0.35 } = {}) {
    const s = spring(t - t0, 0.75, 0.12); if (s <= 0) return null;
    const f = Math.sin((t - t0) * 2 * Math.PI / 3.6) * 7, sc = 0.9 + 0.1 * s;
    g.save(); g.translate(cx, cy + (1 - s) * 220 + f); g.scale(sc * (1 - (1 - s) * tilt * 0.4), sc); g.transform(1, 0, (1 - s) * tilt * 0.3, 1, 0, 0); g.globalAlpha *= cl(s * 1.4);
    glass(-w / 2, -h / 2, w, h, 36, 1); g.save(); rr(g, -w / 2, -h / 2, w, h, 36); g.clip(); draw(-w / 2, -h / 2, w, h); g.restore();
    g.restore(); return s;
  }

  /* ---------- product shots from the real renderer ---------- */
  const shot = pt => { renderFrame(Math.max(0, Math.min(S.frames - 1, Math.round(pt * FPS)))); return cv; };
  let LONG = null, BADGES = [], DOTS = null, ROWS = [];

  /* ---------- the dotted world (land sampled once) ---------- */
  const MAPX = 60, MAPY = 600, MW = 960, MH = 560;
  let mproj = null; // fitted to the traveller's airports in init()
  function fitMap() { const pts = []; S.flights.forEach(f => { [f.f, f.to].forEach(c => AP[c] && pts.push([AP[c].lon, AP[c].lat])); });
    mproj = d3.geoMercator().rotate([-110, 0]).fitExtent([[MAPX + 40, MAPY + 40], [MAPX + MW - 40, MAPY + MH - 40]], { type: 'MultiPoint', coordinates: pts }); DOTS = null; }
  function dots() {
    if (DOTS) return DOTS; DOTS = []; const step = 13;
    for (let y = MAPY - 160; y < MAPY + MH + 160; y += step) for (let x = 20; x < PW - 20; x += step) { const ll = mproj.invert([x, y]); if (ll && ll[1] > -56 && ll[1] < 78 && d3.geoContains(LAND, ll)) DOTS.push([x, y, hash(x * 7 + y)]); }
    return DOTS;
  }
  const apXY = c => mproj([AP[c].lon, AP[c].lat]);
  function arc(a, b, u, col, lw) { const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, c = [(a[0] + b[0]) / 2 - dy / L * L * 0.22 * Math.sign(dx || 1), (a[1] + b[1]) / 2 - Math.abs(dx) / L * L * 0.22];
    g.beginPath(); g.moveTo(a[0], a[1]); const n = 30; for (let i = 1; i <= n * u; i++) { const k = i / n, m = 1 - k; g.lineTo(m * m * a[0] + 2 * m * k * c[0] + k * k * b[0], m * m * a[1] + 2 * m * k * c[1] + k * k * b[1]); }
    g.strokeStyle = col; g.lineWidth = lw; g.stroke(); const k = u, m = 1 - k; return [m * m * a[0] + 2 * m * k * c[0] + k * k * b[0], m * m * a[1] + 2 * m * k * c[1] + k * k * b[1]]; }
  function worldMap(t, alpha, litUntil) {
    g.save(); g.globalAlpha = alpha;
    for (const [x, y, h] of dots()) { const tw = 0.35 + 0.25 * Math.sin(t * 2 + h * 30); const e = Math.min(1, Math.min(x - 20, PW - 20 - x, y - MAPY + 160, MAPY + MH + 160 - y) / 120); g.fillStyle = `rgba(255,255,255,${(0.3 * tw + 0.12) * e})`; g.beginPath(); g.arc(x, y, 2.6, 0, 7); g.fill(); }
    const fl = S.flights.filter(f => !f.vd);
    fl.forEach((f, i) => { const st = litUntil.t0 + i * litUntil.step, u = cl((t - st) / 0.7); if (u <= 0) return; const a = apXY(f.f), b = apXY(f.to);
      g.save(); g.globalCompositeOperation = 'lighter'; const head = arc(a, b, eo(u), `rgba(${P.blobs[i % 4]},${0.55})`, 2.2); g.restore();
      if (u < 1) { g.beginPath(); g.arc(head[0], head[1], 5, 0, 7); g.fillStyle = '#fff'; g.fill(); } });
    g.restore();
  }

  /* ---------- the fake scene that drives synth(): bars laid to the story ---------- */
  const yrsBars = [1, 2, 2, 2, 2, 2]; // 6.43 → 30.0 s: light, brand, video, poster, badges, smart-check
  function scene() {
    const years = []; let t = T_F0;
    yrsBars.forEach((b, i) => { years.push({ y: 2020 + i, t, end: t + b * BAR, bars: b, n: 6, dream: false, gap: false }); t += b * BAR; });
    const T_FE = t, flights = [];
    years.forEach(y => { for (let k = 0; k < y.bars; k++) [0, 3, 5].forEach((e, j) => flights.push({ t0: y.t + k * BAR + e * BEAT / 2, km: j === 0 && k === 0 ? 9000 : 1500, up: 0, vd: 0 })); });
    const order = ['CN', 'JP', 'TH', 'US', 'FR', 'AU'], visit = { CN: T_OPEN }; // pops land with the achievement chips
    order.slice(1).forEach((c, i) => { visit[c] = years[4].t + 0.5 + i * 0.42; });
    return { T_END: T_FE + 3 * BAR + 2.5 * BAR, T_FE, T_STAMP: T_FE + BEAT, T_ZOOM: T_FE + BAR, T_CARD: T_FE + 3 * BAR, years, flights, order, visit, P: { nat: 'CN' }, style: 'groove' };
  }
  let SC = null, BANK = null;
  // promo-only recordings (web/promo/sfx-promo.mp3, passed in by make_film.py) on top of the film's own sprite
  const SFX_PROMO_MAP={"hit2":[9600,72000,557],"boom2":[84480,57600,1382],"card0":[144960,6253,3091],"card1":[154093,7403,4013],"place0":[164376,5431,638],"place1":[172687,4939,1368],"swish":[180506,7106,1992],"ding":[190492,25594,360],"chime":[218966,72000,1368],"sparkle2":[293846,67200,3619]};

  /* ---------- scenes ---------- */
  function sHook(t) { // 0 → T_OPEN: the spreadsheet
    blurChars('这些年你飞过的航班', PW / 2, 420, 64, -0.35, t, { out: T_OPEN - 0.1 });
    blurText('都躺在一张冷冰冰的表格里', PW / 2, 510, 46, 1.4, t, { w: 500, color: P.sub, out: T_OPEN - 0.1 });
    const s = cardIn(t, 0.9, PW / 2, 1150, 900, 820, (x, y, w, h) => {
      g.font = font(700, 26, 'SM'); g.fillStyle = P.sub; g.textAlign = 'left';
      ['DATE', 'FLIGHT', 'FROM → TO'].forEach((hd, i) => g.fillText(hd, x + 50 + [0, 260, 470][i], y + 70));
      g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x + 40, y + 92, w - 80, 2);
      const off = (t * 34) % 64;
      ROWS.forEach((r, i) => { const yy = y + 150 + i * 64 - off; if (yy < y + 110 || yy > y + h - 30) return; const hl = i === Math.floor(t * 2.2) % ROWS.length;
        if (hl) { g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(x + 30, yy - 42, w - 60, 58); }
        g.font = font(400, 28, 'SM'); g.fillStyle = hl ? P.ink : 'rgba(235,235,245,.55)'; g.fillText(r[0], x + 50, yy); g.fillText(r[1], x + 310, yy); g.fillText(r[2], x + 520, yy); });
    });
    const k = cl((t - (T_OPEN - 0.6)) / 0.6); if (k > 0) { g.fillStyle = `rgba(0,0,0,${0.6 * k})`; g.fillRect(0, 0, PW, PH); }
    return s;
  }
  function sData(t) { // T_OPEN → BRAND: rows become points become routes
    const u = (t - T_OPEN);
    blurChars('把每一行，变成一条航线', PW / 2, 400, 60, T_OPEN + 0.1, t, { out: SC.years[1].t - 0.15 });
    worldMap(t, cl(u / 0.6), { t0: T_OPEN + 0.5, step: 0.075 });
    blurText(`${S.final.n} 次起飞 · ${S.final.cc} 个国家地区`, PW / 2, 1360, 44, T_OPEN + 2.2, t, { w: 600, color: P.accent, out: SC.years[1].t - 0.15 });
  }
  function emblemDraw(cx, cy, s, u) { // the foil emblem stroked in, then filled
    g.save(); g.translate(cx, cy); const len = 2400; g.setLineDash([len * u, len]); g.strokeStyle = g.fillStyle = goldFill(cy - 250, cy + 250); emblem(g, s, false); g.setLineDash([]); g.restore(); }
  const HERO = 1.2; // brand title lands at years[1].t + HERO
  function sBrand(t) {
    const t0 = SC.years[1].t, u = t - t0;
    emblemDraw(PW / 2, 700, 0.9, eio(u / 1.4));
    const h = u - HERO; // the title lands on one frame: the hero hit (see promoCues), after a one-beat dead stop
    if (h >= 0) { const k = 1 + 0.12 * Math.exp(-h * 16) * Math.cos(h * 30); g.save(); g.translate(PW / 2, 1100); g.scale(k, k); g.translate(-PW / 2, -1100);
      g.fillStyle = goldFill(1000, 1160); g.font = `900 170px ${SERIF}`; g.textAlign = 'center'; spaced(g, '航迹手帐', PW / 2, 1150, 34); g.restore();
      const f = Math.exp(-h * 9); if (f > 0.02) { g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = `rgba(255,236,200,${0.28 * f})`; g.fillRect(0, 0, PW, PH); g.restore(); } }
    sweep(140, 990, 800, 200, (u - 1.9) / 1.0);
    blurText('S K Y   P A S S P O R T', PW / 2, 1230, 34, t0 + 1.4, t, { w: 600, color: P.accent });
    blurText('把航班记录，做成一本会动的护照', PW / 2, 1340, 44, t0 + 2.2, t, { w: 500, color: P.sub });
  }
  function featureHead(t0, t, no, title, sub) {
    blurText(no, PW / 2, 300, 30, t0 - 0.1, t, { w: 700, color: P.accent, fam: 'SM' });
    blurChars(title, PW / 2, 400, 78, t0 - 0.05, t, { w: 800 });
    blurText(sub, PW / 2, 480, 36, t0 + 0.2, t, { w: 400, color: P.sub });
  }
  function sVideo(t) {
    const t0 = SC.years[2].t; featureHead(t0, t, '01 / 视频护照', '一分钟的飞行护照', '原创配乐 · 竖屏 1080P · 一键存相册');
    cardIn(t, t0 + 0.05, PW / 2, 1220, 760, 1351, (x, y, w, h) => { const pt = T_F0 + 2.5 + (t - t0) * 3.2; g.drawImage(shot(pt), x, y, w, h); });
  }
  function sPoster(t) {
    const t0 = SC.years[3].t; featureHead(t0, t, '02 / 长图海报', '一张图，发朋友圈', '统计 · 航线地图 · 飞行成就');
    cardIn(t, t0 + 0.05, PW / 2, 1220, 700, 1240, (x, y, w, h) => { const sc = w / LONG.width, travel = LONG.height * sc - h, k = eio(cl((t - t0 - 0.9) / 2.8)); g.drawImage(LONG, x, y - travel * k, w, LONG.height * sc); });
  }
  function sBadges(t) {
    const t0 = SC.years[4].t - 0.15; featureHead(t0, t, '03 / 飞行成就', '你的飞行，有数据为证', '最长单程 · 最常飞航线 · 碳排放 …');
    BADGES.slice(0, 6).forEach((b, i) => { const cx = 290 + (i % 2) * 500, cy = 760 + Math.floor(i / 2) * 330, st = t0 + 0.5 + i * 0.42;
      cardIn(t, st, cx, cy, 460, 280, (x, y, w, h) => { g.textAlign = 'left'; g.font = font(400, 26); g.fillStyle = P.sub; g.fillText(`${b.i} ${b.k}`, x + 32, y + 60);
        const m = b.v.match(/^([\d,.]+)(.*)$/); let v = b.v; if (m && !/年/.test(m[2])) { const n = parseFloat(m[1].replace(/,/g, '')), k = expo(cl((t - st - 0.25) / 0.9)); v = (m[1].includes('.') ? (n * k).toFixed(m[1].split('.')[1].length) : fmt(n * k)) + m[2]; }
        let z = 46; g.font = font(800, z); while (g.measureText(v).width > w - 64 && z > 24) { z -= 2; g.font = font(800, z); } g.fillStyle = P.ink; g.fillText(v, x + 32, y + 140);
        let dz = 24; g.font = font(400, dz); while (g.measureText(b.d).width > w - 64 && dz > 14) { dz--; g.font = font(400, dz); } g.fillStyle = P.sub; g.fillText(b.d, x + 32, y + 200); }); });
  }
  function sSmart(t) {
    const t0 = SC.years[5].t; featureHead(t0, t, '04 / 智能识别', '表格写错了？它认得出', '航旅纵横导出 · 中文地名 · 错别字自动纠正');
    const fixes = [['浦栋', '上海浦东 PVG'], ['红桥', '上海虹桥 SHA'], ['Narita T1', '东京成田 NRT'], ['Suvarnabumi', '曼谷 BKK'], ['LA', '洛杉矶 LAX']];
    cardIn(t, t0 + 0.05, PW / 2, 1130, 900, 760, (x, y, w, h) => {
      fixes.forEach(([bad, good], i) => { const yy = y + 110 + i * 130, k = cl((t - t0 - 1.0 - i * 0.45) / 0.35);
        g.textAlign = 'left'; g.font = font(600, 38); g.fillStyle = `rgba(255,120,130,${1 - k})`; g.fillText(bad, x + 60, yy + 12);
        if (k > 0) { g.fillStyle = `rgba(255,255,255,${k})`; g.fillText(good, x + 60 + (1 - eo(k)) * 30, yy + 12); g.save(); g.globalAlpha = k; g.beginPath(); g.arc(x + w - 90, yy, 26, 0, 7); g.fillStyle = '#4ad69a'; g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 5; g.beginPath(); g.moveTo(x + w - 102, yy); g.lineTo(x + w - 93, yy + 9); g.lineTo(x + w - 77, yy - 9); g.stroke(); g.restore(); }
        g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(x + 50, yy + 50, w - 100, 1.5); });
    });
    blurText('表格在你的手机上解析 · 视频 24 小时后删除', PW / 2, 1620, 32, t0 + 2.6, t, { w: 400, color: P.sub, out: SC.T_FE - 0.05 });
  }
  function sStamp(t) { // hang → slam, on the real product page held in a card; then the line on dark
    const pt = S.T_STAMP + (t - SC.T_STAMP), out = cl((t - SC.T_STAMP - 0.55) / 0.45);
    if (out < 1) { g.save(); g.globalAlpha = 1 - out; cardIn(t, SC.T_FE - 0.25, PW / 2, 1000 - out * 60, 820, 1458, (x, y, w, h) => g.drawImage(shot(pt), x, y, w, h)); g.restore(); }
    blurChars('每一次起飞', PW / 2, 900, 96, SC.T_STAMP + 0.75, t, { w: 900 });
    blurChars('都值得被记住', PW / 2, 1030, 96, SC.T_STAMP + 1.0, t, { w: 900, color: P.accent });
  }
  function sLookBack(t) {
    const u = t - SC.T_ZOOM; worldMap(t, cl((u + 0.4) / 0.4), { t0: SC.T_ZOOM - 3.5, step: 0.02 });
    blurText('这些年，你一共', PW / 2, 380, 54, SC.T_ZOOM - 0.15, t, { w: 600, color: P.sub, out: SC.T_CARD - 0.1 });
    const F0 = S.final, stats = [[F0.n, '次起飞'], [Math.round(F0.km / 1000) / 10, '万公里'], [F0.cc, '个国家地区'], [Math.round(F0.min / 60), '小时在空中']];
    stats.forEach(([n, l], i) => { const st = SC.T_ZOOM + 0.5 + i * 0.35, cx = 290 + (i % 2) * 500, cy = 1380 + Math.floor(i / 2) * 230;
      cardIn(t, st, cx, cy, 440, 190, (x, y, w, h) => { const k = expo(cl((t - st - 0.2) / 1.0)), v = Number.isInteger(n) ? fmt(n * k) : (n * k).toFixed(1);
        g.textAlign = 'left'; g.font = font(800, 72); g.fillStyle = P.ink; g.fillText(v, x + 36, y + 110); g.font = font(400, 28); g.fillStyle = P.sub; g.fillText(l, x + 40, y + 160); }); });
  }
  function sCta(t) {
    const t0 = SC.T_CARD; emblemDraw(PW / 2, 520, 0.62, eio((t - t0) / 1.2));
    g.save(); g.globalAlpha = cl((t - t0 - 0.4) / 0.6); g.fillStyle = goldFill(760, 900); g.font = `900 150px ${SERIF}`; g.textAlign = 'center'; spaced(g, '航迹手帐', PW / 2, 900, 30); g.restore();
    blurText('把你的天空，装进一本护照', PW / 2, 1000, 48, t0 + 0.7, t, { w: 600 });
    cardIn(t, t0 + 1.1, PW / 2, 1330, 420, 420, (x, y, w, h) => { const q = qrCanvas(); g.fillStyle = '#fff'; rr(g, x + 50, y + 50, w - 100, h - 100, 18); g.fill(); g.imageSmoothingEnabled = false; g.drawImage(q, x + 64, y + 64, w - 128, h - 128); g.imageSmoothingEnabled = true; });
    blurText('passport.nybbq.art', PW / 2, 1620, 40, t0 + 1.6, t, { w: 600, color: P.accent, fam: 'SM' });
    blurText('免费 · 一分钟出片 · 手机浏览器 / 电脑 / 微信小程序', PW / 2, 1690, 30, t0 + 1.9, t, { w: 400, color: P.sub });
  }

  /* ---------- sound: real recordings (film + promo sprites) placed on this timeline ---------- */
  const SPR_MOVE = 0.12, SPR_LAND = 0.42; // NB: not "LAND" — that name is the engine's land geometry // a card's spring (0.75 s, bounce 0.12): top speed / settled
  function promoCues() {
    const C = [], Y = SC.years, card = (t0, k = 0) => C.push(['card' + (k % 2), t0 + SPR_MOVE, 0.3, 0.4 + 0.2 * (k % 3) / 2, 0.1, 1, 3000], ['place' + (k % 2), t0 + SPR_LAND, 0.3, 0.5, 0.1, 1, 3000]);
    card(0.9);                                                                                  // the spreadsheet card
    C.push(['cov_sw', T_OPEN, 0.3, 0.5, 0.15, 1, 1500], ['print', T_OPEN + 0.9, 0.18, 0.5, 0.15, 1, 4000]); // cut to the map; routes sweep in
    const tb = Y[1].t + HERO; C.push(['cov_sw', Y[1].t, 0.22, 0.5, 0.15, 1, 1500], ['rev_zoom', tb, 0.16, 0.5, 0.2], ['hit2', tb, 0.5, 0.5, 0.12], ['boom2', tb, 0.34, 0.5, 0], ['sparkle2', Y[1].t + 2.4, 0.16, 0.5, 0.25, 1, 2500]); // brand: hero + light sweep
    [Y[2].t, Y[3].t, Y[5].t].forEach((t0, k) => { C.push(['swish', t0, 0.3, 0.5, 0.12, 1, 3000]); card(t0 + 0.05, k); }); // feature cuts + their cards
    C.push(['paper', Y[3].t + 0.95, 0.2, 0.5, 0.12, 1, 4000]);                                  // the long poster starts to scroll
    C.push(['swish', Y[4].t - 0.15, 0.3, 0.5, 0.12, 1, 3000]); for (let i = 0; i < 6; i++) card(Y[4].t - 0.15 + 0.5 + i * 0.42, i); // achievements
    for (let i = 0; i < 5; i++) C.push(['ding', Y[5].t + 1.0 + i * 0.45 + 0.12, 0.16, 0.35 + 0.075 * i, 0.15, [1, 1.122, 1.26, 1.335, 1.498][i], 3500]); // each fix gets a check (rising)
    card(SC.T_FE - 0.25, 0); const T = SC.T_STAMP + 0.16; C.push(['rev_stamp', T, 0.09, 0.5, 0.15], ['hit', T, 0.5, 0.5, 0.1], ['boom', T, 0.32, 0.5, 0], ['wood', T, 0.42, 0.5, 0.08], ['paper', T, 0.18, 0.5, 0.15]); // the real stamp
    C.push(['rev_zoom', SC.T_ZOOM, 0.08, 0.5, 0.2], ['sparkle', SC.T_ZOOM + 0.25, 0.16, 0.5, 0.25, 1, 7000]); for (let i = 0; i < 4; i++) card(SC.T_ZOOM + 0.5 + i * 0.35, i); // totals
    C.push(['swish', SC.T_CARD, 0.3, 0.5, 0.12, 1, 3000], ['chime', SC.T_CARD + 0.5, 0.2, 0.5, 0.25, 1, 2500]); card(SC.T_CARD + 1.1, 1);     // end card, QR
    return C;
  }
  function frame(i) {
    const t = i / FPS; field(t, t < T_OPEN ? 0.6 : 1);
    const cuts = [0, T_OPEN, ...SC.years.slice(1).map(y => y.t), SC.T_FE, SC.T_ZOOM, SC.T_CARD, SC.T_END]; let a = 0, b = 1; for (let k = 0; k < cuts.length - 1; k++) if (t >= cuts[k] && t < cuts[k + 1]) { a = cuts[k]; b = cuts[k + 1]; }
    const z = 1 + 0.03 * (t - a) / (b - a); g.setTransform(z, 0, 0, z, PW / 2 * (1 - z), PH * 0.55 * (1 - z));
    if (t < T_OPEN) sHook(t);
    else if (t < SC.years[1].t) sData(t);
    else if (t < SC.years[2].t) sBrand(t);
    else if (t < SC.years[3].t) sVideo(t);
    else if (t < SC.years[4].t) sPoster(t);
    else if (t < SC.years[5].t) sBadges(t);
    else if (t < SC.T_FE) sSmart(t);
    else if (t < SC.T_ZOOM) sStamp(t);
    else if (t < SC.T_CARD) sLookBack(t);
    else sCta(t);
    g.setTransform(1, 0, 0, 1, 0, 0);
    // a quick dip on every section downbeat (the product's punch, but as a light flash)
    for (const e of [T_OPEN, ...SC.years.slice(1).map(y => y.t), SC.T_ZOOM, SC.T_CARD]) { const d = t - e; if (d >= 0 && d < 0.25) { g.fillStyle = `rgba(255,255,255,${0.10 * (1 - d / 0.25)})`; g.fillRect(0, 0, PW, PH); } }
    film_grain(i); return C;
  }


  /* ---------- posters: same light field + glass language, several sizes ---------- */
  function tx(s, x, y, size, { w = 700, color = P.ink, align = 'center', fam, max = 1e9 } = {}) {
    g.save(); let z = size; g.font = font(w, z, fam); while (g.measureText(s).width > max && z > 12) { z -= 2; g.font = font(w, z, fam); } g.fillStyle = color; g.textAlign = align; g.fillText(s, x, y); g.restore(); }
  function title(s, x, y, size, track) { g.save(); g.fillStyle = goldFill(y - size, y + 10); g.font = `900 ${size}px ${SERIF}`; g.textAlign = 'center'; spaced(g, s, x, y, track); g.restore(); }
  function card(x, y, w, h, draw, r = 32) { glass(x, y, w, h, r); g.save(); rr(g, x, y, w, h, r); g.clip(); draw && draw(x, y, w, h); g.restore(); }
  function qr(x, y, s) { const q = qrCanvas(); g.fillStyle = '#fff'; rr(g, x, y, s, s, s * 0.08); g.fill(); g.imageSmoothingEnabled = false; const m = s * 0.07; g.drawImage(q, x + m, y + m, s - 2 * m, s - 2 * m); g.imageSmoothingEnabled = true; }
  function cta(y, left = PW / 2 - 300) { qr(left, y, 170); tx('扫码 / 浏览器打开', left + 205, y + 52, 30, { align: 'left', color: P.sub, w: 500 });
    tx('passport.nybbq.art', left + 205, y + 105, 40, { align: 'left', color: P.accent, fam: 'SM' }); tx('免费 · 一分钟出片 · 微信小程序同名', left + 205, y + 152, 26, { align: 'left', color: P.sub, w: 400 }); }
  function table(x, y, w, h, z = 28) { g.textAlign = 'left'; g.font = font(700, z * 0.85, 'SM'); g.fillStyle = P.sub; ['DATE', 'FLIGHT', 'ROUTE'].forEach((hd, i) => g.fillText(hd, x + w * [0.06, 0.4, 0.66][i], y + z * 2.4));
    g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x + w * 0.04, y + z * 3.1, w * 0.92, 2);
    ROWS.forEach((r, i) => { const yy = y + z * 5 + i * z * 2.2; if (yy > y + h - z) return; g.font = font(400, z, 'SM'); g.fillStyle = i === 4 ? P.ink : 'rgba(235,235,245,.55)'; if (i === 4) { g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(x + w * 0.03, yy - z * 1.3, w * 0.94, z * 1.9); g.fillStyle = P.ink; }
      g.fillText(r[0].slice(2), x + w * 0.06, yy); g.fillText(r[1], x + w * 0.4, yy); g.fillText(r[2].replace(' → ', '→'), x + w * 0.66, yy); }); }
  const page = () => shot(S.T_STAMP + 1.0), PR = 1920 / 1080;
  const POSTERS = {
    main: (w, h) => { resize(w, h); field(7);
      if (h / w > 1.2 && h / w < 1.5) { title('航迹手帐', w / 2, 190, 112, 22); tx('把你的天空，装进一本护照', w / 2, 275, 46, { w: 800 });
          const ch = h - 400, cw = ch / PR; card(80, 330, cw, ch, (x, y, cw2, ch2) => g.drawImage(page(), x, y, cw2, ch2)); const cx = 80 + cw + (w - 80 - cw) / 2;
          emblemDraw(cx, 520, 0.3, 1); tx('上传航班表格', cx, 760, 32, { color: P.sub, w: 500 }); tx('一分钟生成', cx, 810, 32, { color: P.sub, w: 500 }); tx('飞行护照视频', cx, 860, 32, { color: P.sub, w: 500 });
          qr(cx - 110, 950, 220); tx('passport.nybbq.art', cx, 1225, 28, { color: P.accent, fam: 'SM', max: w - 80 - cw - 40 }); tx('免费 · 小程序同名', cx, 1275, 26, { color: P.sub, w: 400 }); }
      else if (h / w >= 1.5) { const top = h * 0.07; emblemDraw(w / 2, top + 110, 0.4, 1); title('航迹手帐', w / 2, top + 330, 128, 26); tx('S K Y   P A S S P O R T', w / 2, top + 392, 28, { color: P.accent, fam: 'SM' });
          tx('把你的天空，装进一本护照', w / 2, top + 480, 52, { w: 800 }); tx('上传航班表格，一分钟生成你的飞行护照视频', w / 2, top + 545, 32, { color: P.sub, w: 400 });
          const ch = h - (top + 600) - 300, cw = ch / PR; card((w - cw) / 2, top + 600, cw, ch, (x, y, cw2, ch2) => g.drawImage(page(), x, y, cw2, ch2)); cta(h - 250); }
      else { emblemDraw(240, 220, 0.3, 1); title('航迹手帐', 240, 450, 80, 8); tx('SKY PASSPORT', 240, 505, 24, { color: P.accent, fam: 'SM' }); tx('把你的天空', 240, 600, 42, { w: 800 }); tx('装进一本护照', 240, 660, 42, { w: 800 });
          qr(155, 740, 170); tx('passport.nybbq.art', 240, 970, 28, { color: P.accent, fam: 'SM', max: 400 });
          const ch = h - 120, cw = ch / PR; card(w - cw - 90, 60, cw, ch, (x, y, cw2, ch2) => g.drawImage(page(), x, y, cw2, ch2)); } },
    features: (w, h) => { resize(w, h); field(15); tx('航迹手帐 · 能做什么', w / 2, 170, 32, { color: P.accent, w: 600 }); g.save(); g.font = font(800, 84); g.fillStyle = goldFill(190, 290); g.textAlign = 'center'; g.fillText('一张表格，四样礼物', w / 2, 280); g.restore();
      const items = [['01', '视频护照', '一分钟竖屏动画 · 原创配乐 · 一键存相册'], ['02', '长图海报', '统计 · 航线地图 · 一张图发朋友圈'], ['03', '飞行成就', '最长单程 · 最常飞航线 · 空中时长'], ['04', '智能识别', '航旅纵横导出 · 中文地名 · 错别字纠正']];
      items.forEach(([n, t2, d], i) => { const y = 350 + i * 300; card(80, y, w - 160, 260, (x, y0, cw, chh) => {
        tx(n, x + 50, y0 + 100, 64, { align: 'left', color: P.accent, fam: 'SM', w: 700 }); tx(t2, x + 50, y0 + 175, 52, { align: 'left', w: 800 }); tx(d, x + 50, y0 + 225, 26, { align: 'left', color: P.sub, w: 400, max: 470 });
        const tw = 300, tx0 = x + cw - tw - 30, ty0 = y0 + 25, th = chh - 50; g.save(); rr(g, tx0, ty0, tw, th, 18); g.clip();
        if (i === 0) g.drawImage(page(), tx0, ty0 - 120, tw, tw * PR); else if (i === 1) g.drawImage(LONG, tx0, ty0, tw, LONG.height * tw / LONG.width);
        else { g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(tx0, ty0, tw, th); if (i === 2) { const b = BADGES[0]; tx(b.v, tx0 + tw / 2, ty0 + 100, 44, { w: 800, max: tw - 30 }); tx(b.k, tx0 + tw / 2, ty0 + 150, 24, { color: P.sub, w: 400 }); }
          else { tx('浦栋', tx0 + tw / 2, ty0 + 80, 36, { color: 'rgba(255,120,130,.9)', w: 600 }); tx('↓', tx0 + tw / 2, ty0 + 120, 28, { color: P.sub }); tx('上海浦东 PVG ✓', tx0 + tw / 2, ty0 + 170, 32, { w: 700 }); } }
        g.restore(); }); });
      cta(h - 380); tx('表格在你手机上解析 · 视频 24 小时后删除', w / 2, h - 90, 26, { color: P.sub, w: 400 }); },
    data: (w, h) => { resize(w, h); DOTS = null; field(22); tx('林小舟的这些年（示例）', w / 2, 200, 32, { color: P.accent, w: 600 }); g.save(); g.font = font(800, 88); g.fillStyle = goldFill(220, 330); g.textAlign = 'center'; g.fillText('飞过的每一程', w / 2, 320); g.restore();
      worldMap(100, 1, { t0: -100, step: 0 });
      const F0 = S.final, st = [[fmt(F0.n), '次起飞'], [(F0.km / 10000).toFixed(1), '万公里'], [F0.cc, '个国家地区'], [Math.round(F0.min / 60), '小时在空中']];
      st.forEach(([n, l], i) => card(110 + (i % 2) * 450, 1170 + Math.floor(i / 2) * 225, 410, 200, (x, y) => { tx(String(n), x + 36, y + 115, 80, { align: 'left', w: 800 }); tx(l, x + 40, y + 165, 28, { align: 'left', color: P.sub, w: 400 }); }));
      tx('你的呢？', w / 2, 1665, 48, { w: 800 }); cta(1705); },
    story: (w, h) => { resize(w, h); field(3); g.save(); g.font = font(800, 70); g.fillStyle = P.ink; g.textAlign = 'center'; g.fillText('这些年飞过的航班', w / 2, 150); g.fillStyle = goldFill(180, 260); g.fillText('不该只躺在表格里', w / 2, 245); g.restore();
      card(70, 340, 440, 760, (x, y, cw, ch) => table(x, y, cw, ch, 22)); tx('→', w / 2 + 22, 740, 80, { color: P.accent, w: 800 });
      const cw = 760 / PR * 1.0; card(w - 70 - 430, 320, 430, 430 * PR, (x, y, cw2, ch2) => g.drawImage(page(), x, y, cw2, ch2));
      tx('航迹手帐 · 一分钟变成会动的飞行护照', w / 2, 1215, 34, { w: 700 }); cta(1240, w / 2 - 290); },
  };
  window.FILM = {
    async init(pal, promoSfx) {
      P = PAL[pal] || PAL.brand; await Promise.all([ensureFonts(), loadFlags(S.order)]); coverBuilt = false;
      LONG = LONG || await renderLongPoster(); BADGES = computeBadges(S).filter(b => !/首次出境/.test(b.k));
      ROWS = S.flights.filter(f => !f.vd).map(f => [f.date, f.fn, `${f.f} → ${f.to}`]);
      SC = scene(); fitMap(); dots();
      const film = await loadSfx(); BANK = { ...(film || {}) };
      if (promoSfx) { const bin = Uint8Array.from(atob(promoSfx), c => c.charCodeAt(0)), x = (await new OfflineAudioContext(1, 48000, 48000).decodeAudioData(bin.buffer)).getChannelData(0);
        let k = 0; for (let i = 1; i < 9600; i++) if (Math.abs(x[i]) > Math.abs(x[k])) k = i; const off = k - 4800;
        for (const [nm, [st, len, sy]] of Object.entries(SFX_PROMO_MAP)) BANK[nm] = { d: x.slice(st + off, st + off + len), s: sy }; }
      return { frames: Math.ceil(SC.T_END * FPS), seconds: SC.T_END, palettes: Object.keys(PAL) };
    },
    frame(i) { if (PW !== 1080 || PH !== 1920) { resize(1080, 1920); DOTS = null; } return frame(i).toDataURL('image/jpeg', 0.9); },
    poster(kind, w, h) { POSTERS[kind](w, h); film_grain(3); const d = C.toDataURL('image/png'); resize(1080, 1920); DOTS = null; return d; },
    cues() { return promoCues().map(c => [c[0], c[1]]); },
    audio(stems) { const tb = SC.years[1].t + HERO, A = synth({ ...SC, sfx: BANK, cues: promoCues(), stops: [[tb - BEAT, tb]], stems }, 48000), n = A.L.length, o = new Int16Array(n * 2); for (let i = 0; i < n; i++) { o[2 * i] = Math.max(-32767, Math.min(32767, A.L[i] * 32767)); o[2 * i + 1] = Math.max(-32767, Math.min(32767, A.R[i] * 32767)); }
      let b = ''; const u = new Uint8Array(o.buffer); for (let i = 0; i < u.length; i += 32768) b += String.fromCharCode.apply(null, u.subarray(i, i + 32768)); return stems ? { pcm: btoa(b), stems: (() => { const f = new Float32Array(2 * A.stems.sx.length); f.set(A.stems.sx, 0); f.set(A.stems.mu, A.stems.sx.length); let s = ''; const u = new Uint8Array(f.buffer); for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode.apply(null, u.subarray(i, i + 32768)); return btoa(s); })() } : btoa(b); },
  };
})();
