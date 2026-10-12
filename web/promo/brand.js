// 航迹手帐 brand film (30 s, 1080×1920, 30 fps) — one idea per bar on the product's own music grid (112 BPM), drawn on the
// product page so every product shot is the real renderer: the film frames, the medals and the long poster are not mock-ups.
//   beats  0– 4  起点   the limb of the Earth, one flight drawn in the dark
//   beats  4– 8  揭示   pull back: the whole globe, every route; the headline
//   beats  8–18  导入   three ways in, 2.5 beats each: spreadsheet · screenshot (recognised) · typed by hand; then all three
//   beats 18–24  解码   routes and the three numbers; the globe becomes the emblem on the passport (match cut)
//   beats 24–32  影片   the cover holds, opens, the film runs at speed …
//   beats 32–36  盖章   … dead stop, hang, the stamp lands (the film's own stop → hang → slam)
//   beats 36–44  成就   33 medals, then three of them called out one beat apart
//   beats 44–48  长图   the long poster scrolls by
//   beats 48–56  落版   emblem, name, line (two bars, unhurried)
// Sound: the product's synth on the same grid (music time = film time + 1 bar, so the film starts on the second intro bar);
// every effect is a CC0 recording placed from the picture's own timing. Nothing here is random: hash() only.
(function () {
  const PW = 1080, PH = 1920, mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const CV = mk(PW, PH), g = CV.getContext('2d'), GLOW = mk(PW / 4, PH / 4), gg = GLOW.getContext('2d'), TMP = mk(PW, 420), tg = TMP.getContext('2d');
  const cl = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), lerp = (a, b, u) => a + (b - a) * u, seg = (t, a, d) => cl((t - a) / d);
  const eo = t => 1 - Math.pow(1 - cl(t), 3), eo5 = t => 1 - Math.pow(1 - cl(t), 5), ei = t => Math.pow(cl(t), 3), eio = t => { t = cl(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  const spring = (t, d = 0.6, bounce = 0.2) => { if (t <= 0) return 0; const z = 1 - bounce, w = 2 * Math.PI / d, wd = w * Math.sqrt(1 - z * z); return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + z * w / wd * Math.sin(wd * t)); };
  const BR = BAR, Q = BEAT, END = 30, CP = 2.5 * Q, TM = { globe: 4 * Q, imp: 8 * Q, dec: 18 * Q, film: 24 * Q, hang: 32 * Q, stamp: 33 * Q + 0.16, medal: 36 * Q, poster: 44 * Q, card: 48 * Q };   // CP: one import card
  const INK = '#f6efe2', MUTE = 'rgba(206,216,232,.66)', CY = [132, 226, 245], WARM = [255, 214, 160], GOLD = [233, 197, 142];
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  const SER = (s, w = 900) => `${w} ${s}px ${SERIF}`, SAN = (w, s) => `${w} ${s}px "Noto Sans SC","Open Sans",sans-serif`, MONO = (s, w = 700) => `${w} ${s}px "Space Mono",monospace`;
  const gold = (y0, y1) => { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, '#fff3d6'); gr.addColorStop(0.5, '#e9c58e'); gr.addColorStop(1, '#b58543'); return gr; };
  const fmt = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  /* ---------- data from the real scene ---------- */
  let FL = [], APS = [], LONGP = null, DOTS = null, GC = { lam: -110, phi: -20, limb: 30 }, HERO = 0, MEDALS = [], HEROES = [], BANK = null, VIG = null;
  const air = fn => { const a = typeof AIRLINES !== 'undefined' && AIRLINES[String(fn).slice(0, 2)]; return a ? (Array.isArray(a) ? a[0] : a.zh || a) : '航班'; };
  function dots() { if (DOTS) return DOTS; DOTS = []; const Wm = 1440, Hm = 720, m = mk(Wm, Hm), mc = m.getContext('2d'), pr = d3.geoEquirectangular().scale(Wm / (2 * Math.PI)).translate([Wm / 2, Hm / 2]);
    mc.fillStyle = '#fff'; mc.beginPath(); d3.geoPath(pr, mc)(LAND); mc.fill(); const px = mc.getImageData(0, 0, Wm, Hm).data, land = (lo, la) => px[(Math.floor((90 - la) / 180 * Hm) * Wm + Math.floor((lo + 180) / 360 * Wm)) * 4 + 3] > 128;
    for (let lat = -56; lat <= 80; lat += 1.5) { const step = 1.5 / Math.max(0.2, Math.cos(lat * Math.PI / 180)); for (let lon = -180; lon < 180; lon += step) if (land(lon, lat)) DOTS.push([lon, lat, hash(lon * 3 + lat)]); } return DOTS; }

  /* ---------- type ---------- */
  function tracked(s, x, y, tr = 0, align = 'left') { const ch = [...String(s)], ws = ch.map(c => g.measureText(c).width), tot = ws.reduce((a, b) => a + b, 0) + tr * (ch.length - 1); let cx = align === 'center' ? x - tot / 2 : align === 'right' ? x - tot : x; g.textAlign = 'left'; ch.forEach((c, i) => { g.fillText(c, cx, y); cx += ws[i] + tr; }); return tot; }
  // a line rising out of its own baseline (clipped), the one way text enters in this film
  function rise(s, x, y, size, t0, t, o = {}) { const u = eo5((t - t0) / (o.d || 0.6)), a = Math.min(cl((t - t0) / 0.16), cl(((o.out || 1e9) - t) / 0.2)) * (o.a === undefined ? 1 : o.a); if (a <= 0 || t < t0) return 0;
    g.save(); g.font = o.font || SER(size); g.textBaseline = 'alphabetic'; g.beginPath(); g.rect(-50, y - size * 1.12, PW + 100, size * 1.42); g.clip(); g.globalAlpha = a; g.fillStyle = o.fill === 'gold' ? gold(y - size * 0.9, y + size * 0.1) : o.fill || INK; const w = tracked(s, x, y + (1 - u) * size * 0.95, o.tr || 0, o.align); g.restore(); return w; }
  function fade(s, x, y, t0, t, o = {}) { const a = Math.min(cl((t - t0) / (o.d || 0.35)), cl(((o.out || 1e9) - t) / 0.2)) * (o.a === undefined ? 1 : o.a); if (a <= 0) return; g.save(); g.globalAlpha = a; g.font = o.font; g.fillStyle = o.fill || MUTE; g.textBaseline = 'alphabetic'; tracked(s, x, y, o.tr || 0, o.align); g.restore(); }
  // the shared title block: eyebrow, name, one line under it — always on the same left edge
  function title(t, t0, out, eyebrow, name, sub, goldPart) { fade(eyebrow, 96, 214, t0, t, { font: MONO(24), fill: rgba(GOLD, 0.9), tr: 8, out });
    if (goldPart) { g.font = SER(112); const w = rise(goldPart, 96, 330, 112, t0 + 0.04, t, { fill: 'gold', out }); rise(name, 96 + w + 14, 330, 112, t0 + 0.04, t, { out }); } else rise(name, 96, 330, 112, t0 + 0.04, t, { out, tr: 4 });
    if (sub) fade(sub, 98, 400, t0 + 0.2, t, { font: SAN(400, 38), fill: 'rgba(222,230,244,.86)', out }); }

  /* ---------- light and surface ---------- */
  function bg(t, warm = 0, deep = 0) { g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.filter = 'none';
    const gr = g.createLinearGradient(0, 0, 0, PH); gr.addColorStop(0, '#02040b'); gr.addColorStop(0.5, deep ? '#040814' : '#081226'); gr.addColorStop(1, '#02040b'); g.fillStyle = gr; g.fillRect(0, 0, PW, PH);
    const x = PW / 2 + 160 * Math.sin(t * 0.21), r1 = g.createRadialGradient(x, 720, 0, x, 720, 1150); r1.addColorStop(0, `rgba(46,84,176,${0.26 * (1 - deep * 0.6)})`); r1.addColorStop(1, 'rgba(46,84,176,0)'); g.fillStyle = r1; g.fillRect(0, 0, PW, PH);
    if (warm > 0) { const w = g.createRadialGradient(PW / 2, 900, 0, PW / 2, 900, 1000); w.addColorStop(0, rgba(WARM, 0.13 * warm)); w.addColorStop(1, rgba(WARM, 0)); g.fillStyle = w; g.fillRect(0, 0, PW, PH); }
    for (let i = 0; i < 80; i++) { const z = 0.3 + 0.7 * hash(i * 4.7), px = (hash(i * 3.1) * PW + t * 6 * z) % PW, py = ((hash(i * 9.3) * PH - t * 14 * z) % PH + PH) % PH; g.fillStyle = `rgba(214,230,255,${0.10 + 0.32 * z * (0.6 + 0.4 * Math.sin(t * 1.3 + i))})`; g.fillRect(px, py, 1.5 + z, 1.5 + z); } }
  function flash(a, col = WARM) { if (a <= 0.01) return; g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'lighter'; g.fillStyle = rgba(col, cl(a)); g.fillRect(0, 0, PW, PH); g.restore(); }
  // an anamorphic streak through a bright point: the film's one lens signature
  function streak(x, y, a, len = 900) { if (a <= 0.01) return; g.save(); g.globalCompositeOperation = 'lighter'; const gr = g.createLinearGradient(x - len, 0, x + len, 0); gr.addColorStop(0, rgba(CY, 0)); gr.addColorStop(0.5, `rgba(235,246,255,${0.85 * a})`); gr.addColorStop(1, rgba(CY, 0)); g.fillStyle = gr; g.fillRect(x - len, y - 2, len * 2, 4);
    const h = g.createRadialGradient(x, y, 0, x, y, 90); h.addColorStop(0, `rgba(255,240,215,${0.7 * a})`); h.addColorStop(1, 'rgba(255,240,215,0)'); g.fillStyle = h; g.fillRect(x - 90, y - 90, 180, 180); g.restore(); }
  let BLOOMED = false;
  function bloom(a = 0.42) { BLOOMED = true; gg.setTransform(1, 0, 0, 1, 0, 0); gg.clearRect(0, 0, GLOW.width, GLOW.height); gg.filter = 'blur(7px)'; gg.drawImage(CV, 0, 0, GLOW.width, GLOW.height); gg.filter = 'none';
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'lighter'; g.globalAlpha = a; g.drawImage(GLOW, 0, 0, PW, PH); g.restore(); }
  function finish(i) { if (!BLOOMED) bloom(); BLOOMED = false;
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.drawImage(VIG, 0, 0);
    g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.07; const p = g.createPattern(GRAIN[i % 3], 'repeat'); p.setTransform(new DOMMatrix([1, 0, 0, 1, (hash(i) * 256) | 0, (hash(i + 7) * 256) | 0])); g.fillStyle = p; g.fillRect(0, 0, PW, PH); g.restore(); }
  function emblem(x, y, r, a, draw = 1, t = 0) { if (a <= 0) return; g.save(); g.globalAlpha = a; g.lineCap = 'round'; g.strokeStyle = gold(y - r, y + r); g.lineWidth = Math.max(1.5, r * 0.065);
    g.beginPath(); g.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * draw); g.stroke(); const k = cl(draw * 1.6 - 0.6); if (k > 0) { g.globalAlpha = a * k; g.lineWidth = Math.max(1.2, r * 0.05); g.beginPath(); g.ellipse(x, y, r * 0.4, r, 0, 0, 7); g.stroke();
      g.lineWidth = Math.max(1, r * 0.04); g.beginPath(); g.moveTo(x - r, y); g.lineTo(x + r, y); const d = r * 0.5, hw = Math.sqrt(r * r - d * d); g.moveTo(x - hw, y - d); g.lineTo(x + hw, y - d); g.moveTo(x - hw, y + d); g.lineTo(x + hw, y + d); g.stroke();
      g.strokeStyle = rgba(CY, 0.9); g.lineWidth = Math.max(1.2, r * 0.05); g.beginPath(); g.ellipse(x, y, r * 1.45, r * 0.4, -0.35, 0, 7); g.stroke(); const an = t * 1.1; g.fillStyle = rgba(CY, 1); g.beginPath(); g.arc(x + Math.cos(an) * r * 1.45 * Math.cos(-0.35) - Math.sin(an) * r * 0.4 * Math.sin(-0.35), y + Math.cos(an) * r * 1.45 * Math.sin(-0.35) + Math.sin(an) * r * 0.4 * Math.cos(-0.35), Math.max(2.5, r * 0.07), 0, 7); g.fill(); }
    g.restore(); }
  function chrome(t) { const a = 0.6 * seg(t, 0.3, 0.5) * (1 - seg(t, TM.card - 0.25, 0.2)) * (t >= TM.hang - 0.1 && t < TM.medal ? 1 - seg(t, TM.hang - 0.1, 0.3) : 1); if (a <= 0.01) return;
    const k = t < TM.imp ? 0 : t < TM.dec ? 1 : t < TM.film ? 2 : t < TM.medal ? 3 : t < TM.poster ? 4 : 5, nm = ['ORIGIN', 'IMPORT', 'DECODE', 'FILM', 'BADGES', 'POSTER'][k];
    emblem(108, 96, 13, a, 1, t); g.save(); g.globalAlpha = a; g.fillStyle = INK; g.font = MONO(20); g.textBaseline = 'middle'; tracked('SKY PASSPORT', 140, 97, 6); g.fillStyle = rgba(GOLD, 1); tracked(`0${k + 1} / 06  ${nm}`, PW - 96, 97, 4, 'right'); g.restore(); }

  /* ---------- the globe (dot matrix, lifted great circles) ---------- */
  function globe(t, cx, cy, R, lam, phi, a, prog, ring = 1) { if (a <= 0) return; const proj = d3.geoOrthographic().scale(R).translate([cx, cy]).rotate([lam, phi]), ctr = [-lam, -phi], vis = p => d3.geoDistance(p, ctr) < Math.PI / 2;
    g.save(); const at = g.createRadialGradient(cx, cy, R * 0.92, cx, cy, R * 1.22); at.addColorStop(0, rgba(CY, 0.22 * a)); at.addColorStop(1, rgba(CY, 0)); g.fillStyle = at; g.beginPath(); g.arc(cx, cy, R * 1.22, 0, 7); g.fill();
    const bd = g.createRadialGradient(cx - R * 0.35, cy - R * 0.45, R * 0.1, cx, cy, R); bd.addColorStop(0, 'rgba(20,44,92,.92)'); bd.addColorStop(1, 'rgba(3,8,22,.97)'); g.globalAlpha = a; g.fillStyle = bd; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fill(); g.strokeStyle = rgba(CY, 0.42); g.lineWidth = 1.6; g.stroke();
    const ds = Math.max(2.6, Math.min(9, R * 0.0072)), round = ds > 4.5; for (const [lo, la, h] of dots()) { const dd = d3.geoDistance([lo, la], ctr); if (dd >= Math.PI / 2) continue; const p = proj([lo, la]); if (p[1] < -20 || p[1] > PH + 20 || p[0] < -20 || p[0] > PW + 20) continue; const c = Math.cos(dd); g.fillStyle = `rgba(168,224,242,${(0.22 + 0.6 * c) * (0.72 + 0.28 * Math.sin(t * 2 + h * 40))})`; if (round) { g.beginPath(); g.arc(p[0], p[1], ds / 2, 0, 7); g.fill(); } else g.fillRect(p[0] - ds / 2, p[1] - ds / 2, ds, ds); }
    g.globalCompositeOperation = 'lighter'; const lw = Math.max(2.4, Math.min(5.5, R * 0.0058));
    FL.forEach((f, i) => { const u = prog(i); if (u <= 0) return; const A = [AP[f.f].lon, AP[f.f].lat], Bp = [AP[f.to].lon, AP[f.to].lat], ip = d3.geoInterpolate(A, Bp), D = d3.geoDistance(A, Bp), hmax = 0.05 + 0.2 * D / Math.PI, n = 40, col = i % 5 === 4 ? CY : WARM; let prev = null;
      for (let j = 0; j <= n * eo(u); j++) { const q = j / n, ll = ip(q), p = proj(ll), lift = 1 + hmax * Math.sin(Math.PI * q), X = cx + (p[0] - cx) * lift, Y2 = cy + (p[1] - cy) * lift, front = vis(ll) || Math.hypot(X - cx, Y2 - cy) > R;
        if (prev && front && prev[2]) { g.strokeStyle = rgba(col, 0.62 * (0.5 + 0.5 * q)); g.lineWidth = lw; g.beginPath(); g.moveTo(prev[0], prev[1]); g.lineTo(X, Y2); g.stroke(); } prev = [X, Y2, front]; }
      if (u < 1 && prev && prev[2]) { g.fillStyle = rgba(col, 0.95); g.beginPath(); g.arc(prev[0], prev[1], lw * 1.9, 0, 7); g.fill(); g.fillStyle = rgba(col, 0.22); g.beginPath(); g.arc(prev[0], prev[1], lw * 6, 0, 7); g.fill(); } });
    for (const c of APS) { const ll = [AP[c].lon, AP[c].lat]; if (!vis(ll)) continue; const p = proj(ll); g.fillStyle = rgba(WARM, 0.16); g.beginPath(); g.arc(p[0], p[1], lw * 3.6, 0, 7); g.fill(); g.fillStyle = rgba(WARM, 0.9); g.beginPath(); g.arc(p[0], p[1], lw * 0.95, 0, 7); g.fill(); }
    g.globalCompositeOperation = 'source-over'; if (ring > 0 && R < 900) { g.globalAlpha = 0.6 * a * ring; g.strokeStyle = rgba(CY, 0.38); g.lineWidth = 1.4; g.beginPath(); g.arc(cx, cy, R * 1.13, 0, 7); g.stroke(); for (let k = 0; k < 72; k++) { const an = k / 72 * Math.PI * 2 + t * 0.14, r1 = R * 1.13, r2 = r1 + (k % 6 ? 7 : 16); g.beginPath(); g.moveTo(cx + Math.cos(an) * r1, cy + Math.sin(an) * r1); g.lineTo(cx + Math.cos(an) * r2, cy + Math.sin(an) * r2); g.stroke(); } }
    g.restore(); }

  /* ---------- bars 0–1: one route in the dark, then everything ---------- */
  function sOrigin(t) { bg(t, 0, 1 - seg(t, BR - 0.3, 1.2)); const u = eio(seg(t, BR - 0.28, 1.5)), out = ei(seg(t, TM.imp - 0.2, 0.2));
    const R = lerp(2500 - 90 * t, 440, u), top = lerp(1210, 720, u) - out * 900, lam = GC.lam + 12 - t * 5.5, phi = lerp(GC.limb, GC.phi, u), N = FL.length;
    g.save(); g.globalAlpha = 1 - out; globe(t, PW / 2, top + R, R, lam, phi, eo(seg(t, 0.05, 0.9)), i => (i === HERO ? seg(t, 0.35, 1.5) : seg(t, BR + 0.05 + (i * 1.25 / N), 0.7)), u); g.restore();
    const o2 = TM.imp - 0.22; fade('EVERY TAKE-OFF', 98, 352, 0.3, t, { font: MONO(24), fill: rgba(GOLD, 0.9), tr: 8, out: o2 });
    rise('每一次起飞', 92, 480, 118, 0.5, t, { out: o2, tr: 4 }); g.font = SER(118); const w = rise('都值得被', 92, 626, 118, BR + 0.12, t, { out: o2, tr: 4 }); rise('记住', 92 + w + 4, 626, 118, BR + 0.26, t, { out: o2, tr: 4, fill: 'gold' });
    fade('IS WORTH REMEMBERING', 98, 700, BR + 0.5, t, { font: MONO(24), fill: rgba(GOLD, 0.9), tr: 8, out: o2 });
    // one flight over the limb: a hairline arc with a bright head, the first thing that moves
    { const hk = eio(seg(t, 0.3, 1.75)), fa = 1 - seg(t, BR + 0.1, 0.6), pt = q => [70 + 940 * q, 1262 - 300 * Math.sin(Math.PI * q) - 40 * q]; if (hk > 0 && fa > 0) { g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
        for (let j = 1; j <= 60; j++) { const q0 = (j - 1) / 60 * hk, q1 = j / 60 * hk, A = pt(q0), Bp = pt(q1); g.strokeStyle = rgba(WARM, fa * (0.08 + 0.72 * Math.pow(j / 60, 2.2))); g.lineWidth = 1.2 + 2.2 * (j / 60); g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(Bp[0], Bp[1]); g.stroke(); }
        const hd = pt(hk); g.fillStyle = `rgba(255,246,228,${fa})`; g.beginPath(); g.arc(hd[0], hd[1], 5, 0, 7); g.fill(); g.restore(); streak(hd[0], hd[1], 0.75 * fa * (0.5 + 0.5 * Math.sin(Math.PI * Math.min(1, hk * 1.05))), 380); } }
    flash(0.28 * Math.exp(-Math.max(0, t - BR) * 9) * (t >= BR ? 1 : 0), CY); }

  /* ---------- bar 2: three ways in ---------- */
  const glass = (w, h, r) => { rr(g, -w / 2, -h / 2, w, h, r); const gr = g.createLinearGradient(0, -h / 2, 0, h / 2); gr.addColorStop(0, 'rgba(18,32,66,.97)'); gr.addColorStop(1, 'rgba(7,13,30,.98)'); g.fillStyle = gr; g.fill(); g.strokeStyle = rgba(GOLD, 0.42); g.lineWidth = 1.5; g.stroke(); };
  function cardSheet(p) { glass(860, 1100, 34); g.textBaseline = 'middle'; g.fillStyle = '#6ff7c8'; g.beginPath(); g.arc(-380, -492, 8, 0, 7); g.fill(); g.fillStyle = MUTE; g.font = MONO(24); g.fillText('flights.xlsx', -358, -491);
    const X = [-384, -150, 30, 222]; g.font = SAN(500, 26); g.fillStyle = rgba(GOLD, 0.9); ['日期', '航班', '出发', '到达'].forEach((s, k) => g.fillText(s, X[k], -420)); g.strokeStyle = rgba(GOLD, 0.3); g.lineWidth = 1; g.beginPath(); g.moveTo(-390, -386); g.lineTo(390, -386); g.stroke();
    const yb = -350 + seg(p, 0.02, 0.5) * 860; g.fillStyle = rgba(CY, 0.12); g.fillRect(-410, yb - 44, 820, 88); g.fillStyle = rgba(CY, 0.8); g.fillRect(-410, yb - 44, 4, 88);
    for (let i = 0; i < 9; i++) { const f = FL[(i * 5 + 2) % FL.length], y = -338 + i * 96, a = cl((p - i * 0.022) / 0.12); if (a <= 0) continue; g.globalAlpha *= a; g.fillStyle = INK; g.font = MONO(28, 400); g.fillText(f.date, X[0], y); g.font = MONO(28); g.fillText(f.fn, X[1], y); g.font = SAN(500, 30); g.fillText(placeName(f.f).slice(0, 5), X[2], y); g.fillText(placeName(f.to).slice(0, 5), X[3], y); g.globalAlpha /= a; g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(-390, y + 47, 780, 1); } }
  function cardShot(p) { rr(g, -430, -550, 860, 1100, 34); g.fillStyle = '#f1ece2'; g.fill(); g.textBaseline = 'middle'; g.fillStyle = '#10151f'; g.font = SAN(800, 44); g.fillText('已结束', -384, -478); g.fillStyle = '#9aa0ab'; g.font = SAN(500, 36); g.fillText('待出行', -214, -476); g.fillStyle = '#c69652'; g.fillRect(-384, -446, 132, 6);
    const line = -560 + seg(p, 0.04, 0.42) * 1140, boxes = [];
    for (let i = 0; i < 4; i++) { const f = FL[(i * 11 + 7) % FL.length], y = -330 + i * 236, hh = 7 + Math.floor(hash(i * 3.3 + 1) * 12), mm = [0, 15, 30, 40, 50][Math.floor(hash(i * 7.1) * 5)], arr = hh * 60 + mm + (f.min || 120), tm = m => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
      g.fillStyle = '#10151f'; g.font = MONO(38); g.fillText(f.date.slice(5), -392, y - 44); g.fillStyle = '#8a909b'; g.font = SAN(500, 26); g.fillText(f.date.slice(0, 4), -390, y - 2);
      rr(g, -226, y - 92, 620, 200, 20); g.fillStyle = '#fff'; g.fill(); g.fillStyle = ['#2f6fd0', '#c8452f', '#2a9d6a', '#7a4fc9'][i]; g.beginPath(); g.arc(-186, y - 46, 14, 0, 7); g.fill(); g.fillStyle = '#4a5162'; g.font = SAN(500, 30); const s1 = `${air(f.fn)} ${f.fn}`; g.fillText(s1, -158, y - 45);
      g.fillStyle = '#10151f'; g.font = MONO(34); g.fillText(tm(hh * 60 + mm), -186, y + 14); g.fillText(tm(arr), -186, y + 68); g.font = SAN(500, 32); g.fillText(placeName(f.f), -44, y + 14); g.fillText(placeName(f.to), -44, y + 68);
      g.font = SAN(500, 30); boxes.push([-400, y - 70, 142, 52, y - 44], [-166, y - 70, g.measureText(s1).width + 16, 50, y - 45]); g.font = SAN(500, 32); boxes.push([-194, y - 10, 150 + g.measureText(placeName(f.f)).width + 14, 48, y + 14], [-194, y + 44, 150 + g.measureText(placeName(f.to)).width + 14, 48, y + 68]); }
    for (const [x, y, w, h, yc] of boxes) { const a = cl((line - yc) / 60); if (a <= 0) continue; g.strokeStyle = `rgba(0,160,196,${0.95 * a})`; g.lineWidth = 3; rr(g, x, y, w, h, 8); g.stroke(); g.fillStyle = `rgba(0,190,230,${0.10 * a})`; g.fill(); }
    if (p < 0.5) { g.save(); rr(g, -430, -550, 860, 1100, 34); g.clip(); const gr = g.createLinearGradient(0, line - 150, 0, line); gr.addColorStop(0, 'rgba(0,190,230,0)'); gr.addColorStop(1, 'rgba(0,190,230,.28)'); g.fillStyle = gr; g.fillRect(-430, line - 150, 860, 150); g.fillStyle = '#00b6dc'; g.fillRect(-430, line - 2, 860, 5); g.restore(); } }
  function cardHand(p) { glass(860, 1100, 34); g.textBaseline = 'middle'; const f = FL[HERO], rows = [['日期', f.date], ['出发', `${f.f}  ${placeName(f.f)}`], ['到达', `${f.to}  ${placeName(f.to)}`]]; let st = 0.03;
    rows.forEach(([lab, val], i) => { const y = -430 + i * 250, n = Math.floor(cl((p - st) / 0.11) * [...val].length), on = p >= st && n < [...val].length; st += 0.12; rr(g, -370, y, 740, 200, 26); g.fillStyle = 'rgba(3,8,20,.75)'; g.fill(); g.strokeStyle = on ? rgba(CY, 0.9) : 'rgba(132,226,245,.22)'; g.lineWidth = on ? 2.5 : 1.5; g.stroke();
      g.fillStyle = rgba(GOLD, 0.9); g.font = SAN(500, 28); g.fillText(lab, -334, y + 52); g.fillStyle = INK; g.font = i ? SAN(700, 50) : MONO(50); const s = [...val].slice(0, n).join(''); g.fillText(s, -334, y + 128); if (on) { g.fillStyle = rgba(CY, 1); g.fillRect(-330 + g.measureText(s).width, y + 100, 4, 56); } });
    const pr = cl((p - 0.4) / 0.08), k = 1 - 0.04 * Math.sin(Math.PI * pr); g.save(); g.translate(0, 410); g.scale(k, k); rr(g, -370, -65, 740, 130, 65); const gr = g.createLinearGradient(0, -65, 0, 65); gr.addColorStop(0, '#f6d7a2'); gr.addColorStop(1, '#c69652'); g.fillStyle = gr; g.fill(); g.fillStyle = '#1a0d04'; g.font = SAN(800, 44); g.textAlign = 'center'; g.fillText(pr >= 1 ? '✓ 已添加' : '添加这一段', 0, 2); g.restore(); g.textAlign = 'left'; }
  const CARDS = [[cardSheet, '表格', '上传 App 导出的 Excel / CSV'], [cardShot, '截图', '行程截图，自动认出每一段'], [cardHand, '手输', '一段一段，自己添加']];
  function card(k, p, x, y, sc, rot, a) { if (a <= 0.01 || sc <= 0.01) return; g.save(); g.translate(x, y); g.rotate(rot); g.scale(sc, sc); g.globalAlpha = a; g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = 60; g.shadowOffsetY = 30; rr(g, -430, -550, 860, 1100, 34); g.fillStyle = '#060b18'; g.fill(); g.shadowColor = 'transparent'; CARDS[k][0](p); g.restore(); }
  function sImport(t) { const lt = t - TM.imp; bg(t, 0.25);
    for (let k = 0; k < 3; k++) { const p = lt - k * CP; if (p < 0 || lt >= 3 * CP) continue; const u = eo5(seg(p, 0, 0.4)), v = k < 2 ? ei(seg(p, CP - 0.14, 0.14)) : 0;
      if (p < CP) { const o1 = TM.imp + (k + 1) * CP - 0.12; fade(`0${k + 1} / 03`, 96, 214, k * CP + TM.imp, t, { font: MONO(24), fill: rgba(GOLD, 0.9), tr: 8, out: o1, d: 0.2 }); rise(CARDS[k][1], 96, 330, 112, TM.imp + k * CP + 0.04, t, { out: o1, tr: 8, d: 0.5 }); fade(CARDS[k][2], 98, 400, TM.imp + k * CP + 0.2, t, { font: SAN(400, 38), fill: 'rgba(222,230,244,.86)', out: o1, d: 0.25 }); }
      if (p < 0.4) { g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.5 * (1 - u); for (let j = 0; j < 9; j++) { const y = 520 + j * 120 + 40 * hash(j + k * 9); g.fillStyle = rgba(j % 3 ? CY : WARM, 0.5); g.fillRect(540 - 430 + (1 - u) * 820 + 860, y, 500 * (1 - u), 2); } g.restore(); }
      card(k, p * 0.42, 540 + (1 - u) * 860 - v * 940, 1030, 0.95 + 0.05 * u, (1 - u) * 0.09 - v * 0.07, 1); }
    if (lt >= 3 * CP) { const p = lt - 3 * CP, q = eo5(seg(p, 0, 0.5)), w = ei(seg(p, CP - 0.22, 0.22)), o = TM.dec - 0.2;
      for (const j of [0, 2, 1]) { const x = lerp(lerp(540, 540 + (j - 1) * 306, q), 540, w), y = lerp(lerp(1030, 900 + Math.abs(j - 1) * 26, q), 840, w), sc = lerp(lerp(j === 2 ? 1 : 0.5, 0.36, q), 0.03, w); card(j, 9, x, y, sc, (j - 1) * 0.085 * q * (1 - w), (j === 2 ? 1 : q) * (1 - w)); if (!w) fade(CARDS[j][1], 540 + (j - 1) * 306, 1178, TM.imp + 3 * CP + 0.2 + j * 0.06, t, { font: SAN(500, 32), fill: rgba(GOLD, 0.95), align: 'center', out: o, tr: 4 }); }
      rise('三种方式，装进来', PW / 2, 1470, 84, TM.imp + 3 * CP + 0.1, t, { align: 'center', out: o, tr: 4 }); fade('SHEET  ·  SCREENSHOT  ·  BY HAND', PW / 2, 1540, TM.imp + 3 * CP + 0.3, t, { font: MONO(24), fill: rgba(GOLD, 0.8), tr: 6, align: 'center', out: o });
      if (w > 0) streak(540, 840, w * 0.9, 700); }
    flash(0.22 * Math.exp(-lt * 12), CY); }

  /* ---------- bar 3: decoded; the globe becomes the emblem on the cover ---------- */
  const FILM = { cx: 540, cy: 900, s0: 0.74, ex: 541, ey: 640, er: 150 };   // emblem centre and radius inside the product frame
  function sDecode(t) { const lt = t - TM.dec, DD = TM.film - TM.dec, N = FL.length, u = eo5(seg(lt, 0, 0.7)), m = eio(seg(lt, DD - 0.36, 0.36)), o = TM.film - 0.4; bg(t, 0.2 + 0.4 * m);
    const tx = FILM.cx + (FILM.ex - 540) * FILM.s0, ty = FILM.cy + (FILM.ey - 960) * FILM.s0, R = lerp(lerp(60, 384, u), FILM.er * FILM.s0, m), cx = lerp(540, tx, m), cy = lerp(lerp(840, 880, u), ty, m);
    globe(t, cx, cy, R, GC.lam + 16 - lt * 8, GC.phi, u, i => seg(lt, 0.15 + i * 1.5 / N, 0.7) * (1 - m), 1 - m); if (m > 0) emblem(cx, cy, R, m * 0.9, 1, t);
    title(t, TM.dec + 0.02, o, '03 / 06  DECODE', '自动解码', '机场、时区、国家和地区，自己认出来');
    const F0 = S.final, st = [[F0.n, '次起飞', 200], [F0.km, '公里', 540], [F0.cc, '个国家和地区', 880]];
    st.forEach(([v, lab, x], j) => { const t0 = TM.dec + 0.45 + j * 0.2, k = eo5(seg(t, t0, 1.3)); g.save(); g.font = MONO(86); const s = fmt(v * k); rise(s, x, 1500, 86, t0, t, { font: MONO(86), fill: 'gold', align: 'center', out: o, d: 0.4 }); g.restore(); fade(lab, x, 1562, t0 + 0.15, t, { font: SAN(400, 32), fill: 'rgba(222,230,244,.86)', align: 'center', out: o }); });
    g.save(); g.globalAlpha = seg(t, TM.dec + 0.45, 0.4) * (1 - seg(t, o, 0.2)) * 0.5; g.fillStyle = rgba(GOLD, 0.6); g.fillRect(96, 1384, 888, 1); g.fillRect(96, 1606, 888, 1); g.restore();
    flash(0.2 * Math.exp(-lt * 12), CY); }

  /* ---------- bars 4–5: the film itself — opens, runs, stops, is stamped ---------- */
  function sFilm(t) { const lt = t - TM.film, h = t - TM.stamp; bg(t, 0.7);
    const HB = TM.hang - TM.film, VO = 0.95 / (2 * Q), pt = lt < 2 * Q ? T_OPEN - 0.3 + lt * 0.2 : lt < 4 * Q ? T_OPEN - 0.08 + (lt - 2 * Q) * VO : lt < HB ? lerp(T_OPEN + 0.87, S.T_FE - 0.3, eio((lt - 4 * Q) / (4 * Q))) : S.T_FE + (lt - HB);
    renderFrame(Math.max(0, Math.min(S.frames - 1, Math.round(pt * FPS))));
    let s = lt < HB ? lerp(FILM.s0, 0.8, eo(lt / HB)) : lerp(0.8, 0.86, eo((lt - HB) / (Q + 0.16))); if (h >= 0) s *= 1 + 0.03 * Math.exp(-h * 9) * Math.cos(h * 30);
    const w = PW * s, hh = PH * s, x0 = FILM.cx - w / 2, y0 = FILM.cy - hh / 2 + 6 * Math.sin(t * 0.9), r = 46 * s;
    { const gl = g.createRadialGradient(540, y0 + hh / 2, w * 0.3, 540, y0 + hh / 2, w * 1.25); gl.addColorStop(0, rgba(WARM, 0.2)); gl.addColorStop(1, rgba(WARM, 0)); g.fillStyle = gl; g.fillRect(0, 0, PW, PH); } bloom(0.5);
    g.save(); g.shadowColor = 'rgba(0,0,0,.7)'; g.shadowBlur = 90; g.shadowOffsetY = 40; rr(g, x0, y0, w, hh, r); g.fillStyle = '#000'; g.fill(); g.restore();
    g.save(); rr(g, x0, y0, w, hh, r); g.clip(); g.drawImage(cv, x0, y0, w, hh);
    if (lt < Q * 2.2) { const k = lt / (Q * 2.2), x = x0 - w * 0.6 + k * w * 2.2; g.globalCompositeOperation = 'lighter'; const gr = g.createLinearGradient(x - 220, 0, x + 220, 0); gr.addColorStop(0, 'rgba(255,236,200,0)'); gr.addColorStop(0.5, 'rgba(255,236,200,.16)'); gr.addColorStop(1, 'rgba(255,236,200,0)'); g.fillStyle = gr; g.transform(1, 0, -0.35, 1, 0, 0); g.fillRect(x - 220 + 400, y0, 440, hh); }
    g.restore(); g.save(); rr(g, x0, y0, w, hh, r); g.strokeStyle = rgba(GOLD, 0.55); g.lineWidth = 2; g.stroke(); g.restore();
    if (lt < 0.6) { const k = lt / 0.6, ex = x0 + FILM.ex * s, ey = y0 + FILM.ey * s; g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = rgba(WARM, 0.7 * (1 - k)); g.lineWidth = 3; g.beginPath(); g.arc(ex, ey, FILM.er * s * (1 + 1.6 * eo(k)), 0, 7); g.stroke(); g.restore(); }
    if (lt >= 4 * Q && lt < HB) { const k = (lt - 4 * Q) / (4 * Q), a = Math.sin(Math.PI * k); g.save(); g.globalCompositeOperation = 'lighter'; for (let j = 0; j < 16; j++) { const y = y0 + hash(j * 5.3) * hh, len = 120 + 360 * hash(j * 2.9), x = j % 2 ? x0 - 30 - len * (0.3 + k) : x0 + w + 30 + len * (k - 0.3); g.fillStyle = rgba(j % 3 ? WARM : CY, 0.35 * a); g.fillRect(x, y, len, 2); } g.restore();
      fade('▸▸  ×6', PW / 2, y0 - 26, TM.film + 4 * Q + 0.05, t, { font: MONO(24), fill: rgba(GOLD, 0.9), tr: 6, align: 'center', out: TM.hang - 0.08, d: 0.12 }); }
    if (h >= 0) { flash(0.55 * Math.exp(-h * 13)); g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = rgba(WARM, 0.7 * Math.exp(-h * 4.5)); g.lineWidth = 5 * Math.exp(-h * 3) + 1; g.beginPath(); g.arc(540, 900, 260 + 1500 * eo(h / 0.9), 0, 7); g.stroke();
      for (let j = 0; j < 46; j++) { const an = hash(j * 1.7) * 6.283, sp = 300 + 900 * hash(j * 3.9), d = sp * (1 - Math.exp(-h * 3.2)) / 3.2 * 3, a = Math.exp(-h * 2.6); g.fillStyle = rgba(j % 4 ? GOLD : CY, 0.9 * a); g.beginPath(); g.arc(540 + Math.cos(an) * (200 + d), 1000 + Math.sin(an) * (260 + d) + 240 * h * h, 2 + 3 * hash(j), 0, 7); g.fill(); } g.restore(); streak(540, y0 + hh * 0.56, 0.8 * Math.exp(-h * 6), 1000); }
    const c1 = TM.hang - 0.12; rise('一分钟 · 会动的飞行护照', PW / 2, 1810, 60, TM.film + 0.2, t, { align: 'center', out: c1, tr: 3 }); fade('A ONE-MINUTE FILM  ·  ORIGINAL SCORE', PW / 2, 1862, TM.film + 0.35, t, { font: MONO(22), fill: rgba(GOLD, 0.8), tr: 6, align: 'center', out: c1 });
    rise('每一程，都盖下一枚章', PW / 2, 1820, 62, TM.stamp + 0.18, t, { align: 'center', out: TM.medal - 0.14, tr: 3, fill: 'gold' }); }

  /* ---------- bar 6: medals ---------- */
  const RAR = { base: ['#4f9ccd', '#12305a'], silver: ['#f7f9fc', '#8795ab'], gold: ['#fff0c6', '#bf8433'], legend: ['#ff7fb4', '#5eeaff'] };
  function coin(x, y, r, b, a, bright = 0) { if (r < 2 || a <= 0.01) return; g.save(); g.globalAlpha = a; const c = RAR[b.rar] || RAR.base; g.fillStyle = 'rgba(0,0,0,.5)'; g.beginPath(); g.arc(x, y + r * 0.08, r * 1.06, 0, 7); g.fill();
    const gr = g.createLinearGradient(x - r, y - r, x + r, y + r); if (b.lock) { gr.addColorStop(0, '#16233f'); gr.addColorStop(1, '#0a1226'); } else { gr.addColorStop(0, c[0]); gr.addColorStop(b.rar === 'legend' ? 0.5 : 0.6, b.rar === 'legend' ? '#ffc56b' : c[1]); gr.addColorStop(1, b.rar === 'legend' ? c[1] : c[0]); }
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.strokeStyle = b.lock ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.32)'; g.lineWidth = Math.max(1.5, r * 0.035); g.beginPath(); g.arc(x, y, r * 0.9, 0, 7); g.stroke();
    const hl = g.createRadialGradient(x - r * 0.35, y - r * 0.4, 0, x - r * 0.35, y - r * 0.4, r * 0.9); hl.addColorStop(0, `rgba(255,255,255,${b.lock ? 0.08 : 0.42 + 0.5 * bright})`); hl.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = hl; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    g.globalAlpha = a * (b.lock ? 0.45 : 1); g.font = `${Math.round(r * 0.92)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(b.lock ? '🔒' : b.i, x, y + r * 0.06); g.restore(); }
  function sMedals(t) { const lt = t - TM.medal, MD = TM.poster - TM.medal, p2 = eo5(seg(lt, 4 * Q - 0.1, 0.5)), out = ei(seg(lt, MD - 0.22, 0.22)); bg(t, 0.45);
    g.save(); g.translate(540, 1000 - out * 700); g.scale(lerp(1, 0.93, p2), lerp(1, 0.93, p2)); const band = -0.5 + seg(lt, 0.6, 1.3) * 2.2;
    MEDALS.forEach((b, i) => { const c = i % 5, r = Math.floor(i / 5), n = Math.min(5, MEDALS.length - r * 5), x = (c - (n - 1) / 2) * 190, y = -530 + r * 182, d = (r + c) * 0.055, u = spring(lt - d, 0.55, 0.22), br = Math.exp(-Math.pow(((x + 470) / 940 + (y + 530) / 1100) / 2 - band, 2) * 40);
      coin(x, y, 72 * u, b, cl((lt - d) / 0.12) * lerp(1, 0.2, p2) * (1 - out), br); }); g.restore();
    const o = TM.poster - 0.2; fade('05 / 06  BADGES', 96, 214, TM.medal + 0.02, t, { font: MONO(24), fill: rgba(GOLD, 0.9), tr: 8, out: o }); g.font = SER(112); const w = rise(String(MEDALS.length), 96, 330, 112, TM.medal + 0.05, t, { fill: 'gold', out: o }); rise(' 枚飞行成就', 96 + w, 330, 112, TM.medal + 0.09, t, { out: o, tr: 2 });
    HEROES.forEach((b, j) => { const t0 = TM.medal + 4 * Q + j * Q, u = spring(t - t0, 0.5, 0.22), y = 660 + j * 340 - out * 500; if (t < t0) return; const a = 1 - out;
      g.save(); g.globalCompositeOperation = 'lighter'; const gl = g.createRadialGradient(250, y, 0, 250, y, 260); gl.addColorStop(0, rgba(WARM, 0.22 * a * cl(u))); gl.addColorStop(1, rgba(WARM, 0)); g.fillStyle = gl; g.fillRect(0, y - 260, 520, 520); g.restore();
      coin(250, y, 124 * u, b, a, 0.6 * Math.exp(-(t - t0) * 4)); fade(b.k, 420, y - 48, t0 + 0.06, t, { font: SAN(500, 36), fill: rgba(GOLD, 0.95), tr: 4, out: o, d: 0.2 });
      let sz = 70; g.font = SER(sz); while (g.measureText(b.v).width > 590 && sz > 40) { sz -= 2; g.font = SER(sz); } rise(b.v, 420, y + 40, sz, t0 + 0.05, t, { font: SER(sz), out: o, d: 0.45 }); });
    flash(0.42 * Math.exp(-lt * 9)); streak(540, 330, 0.5 * Math.exp(-lt * 5), 900); }

  /* ---------- bar 7: the long poster ---------- */
  function sPoster(t) { const lt = t - TM.poster, inn = eo5(seg(lt, 0, 0.45)), out = ei(seg(lt, BR - 0.22, 0.22)), sc = 0.7, w = PW * sc, H = 1380; bg(t, 0.2);
    const span = (LONGP.height - 560) * sc - H, off = lerp(0, span, eio(seg(lt, 0.1, BR - 0.3)));
    g.save(); g.translate(566, 1130 + (1 - inn) * 1300 - out * 2200); g.rotate(-0.075 + 0.03 * inn); g.shadowColor = 'rgba(0,0,0,.7)'; g.shadowBlur = 80; g.shadowOffsetY = 40; rr(g, -w / 2, -H / 2, w, H, 30); g.fillStyle = '#04070f'; g.fill(); g.shadowColor = 'transparent';
    rr(g, -w / 2, -H / 2, w, H, 30); g.clip(); g.drawImage(LONGP, 0, off / sc, PW, H / sc, -w / 2, -H / 2, w, H);
    const e1 = g.createLinearGradient(0, -H / 2, 0, -H / 2 + 120); e1.addColorStop(0, 'rgba(2,4,11,.75)'); e1.addColorStop(1, 'rgba(2,4,11,0)'); g.fillStyle = e1; g.fillRect(-w / 2, -H / 2, w, 120); const e2 = g.createLinearGradient(0, H / 2 - 160, 0, H / 2); e2.addColorStop(0, 'rgba(2,4,11,0)'); e2.addColorStop(1, 'rgba(2,4,11,.8)'); g.fillStyle = e2; g.fillRect(-w / 2, H / 2 - 160, w, 160);
    g.restore(); g.save(); g.translate(566, 1130 + (1 - inn) * 1300 - out * 2200); g.rotate(-0.075 + 0.03 * inn); rr(g, -w / 2, -H / 2, w, H, 30); g.strokeStyle = rgba(GOLD, 0.5); g.lineWidth = 2; g.stroke(); g.restore();
    title(t, TM.poster + 0.02, TM.card - 0.24, '06 / 06  POSTER', '长图海报', '一张图，晒出这些年');
    // the page counter of a long scroll, on the right edge
    g.save(); g.globalAlpha = 0.7 * inn * (1 - out); g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(1020, 520, 3, 1100); g.fillStyle = rgba(GOLD, 1); g.fillRect(1018, 520 + 1000 * (off / span), 7, 100); g.restore();
    flash(0.18 * Math.exp(-lt * 12), CY); }

  /* ---------- bar 8 → 20.0 s: the name ---------- */
  function sEnd(t) { const lt = t - TM.card; bg(t, 0, 1); const glow = eo(seg(lt, 0.2, 1.4)), gw = g.createRadialGradient(540, 900, 0, 540, 900, 900); gw.addColorStop(0, rgba(WARM, 0.14 * glow)); gw.addColorStop(1, rgba(WARM, 0)); g.fillStyle = gw; g.fillRect(0, 0, PW, PH);
    emblem(540, 600, 118, seg(lt, 0.1, 0.4), eo5(seg(lt, 0.1, 1.2)), t);
    rise('航迹手帐', PW / 2, 960, 178, TM.card + 0.5, t, { align: 'center', tr: 26, fill: 'gold', d: 0.9 });
    const k = seg(lt, 1.75, 0.85); if (k > 0 && k < 1) { tg.setTransform(1, 0, 0, 1, 0, 0); tg.globalCompositeOperation = 'source-over'; tg.clearRect(0, 0, PW, 420); tg.font = SER(178); tg.fillStyle = '#fff'; tg.textBaseline = 'alphabetic'; const ch = [...'航迹手帐'], ws = ch.map(c => tg.measureText(c).width), tot = ws.reduce((a, b) => a + b, 0) + 26 * 3; let x = PW / 2 - tot / 2; ch.forEach((c, i) => { tg.fillText(c, x, 300); x += ws[i] + 26; });
      tg.globalCompositeOperation = 'source-in'; const bx = lerp(-200, PW + 200, k), gr = tg.createLinearGradient(bx - 170, 0, bx + 170, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); tg.fillStyle = gr; tg.fillRect(0, 0, PW, 420);
      g.save(); g.globalCompositeOperation = 'lighter'; g.drawImage(TMP, 0, 660); g.restore(); streak(bx, 905, 0.5 * Math.sin(Math.PI * k), 420); }
    fade('SKY  PASSPORT', PW / 2, 1050, TM.card + 1.05, t, { font: MONO(32), fill: rgba(GOLD, 0.9), tr: 18, align: 'center', d: 0.5 });
    const lw = 280 * eo5(seg(lt, 1.2, 0.8)); g.fillStyle = rgba(GOLD, 0.55); g.fillRect(540 - lw, 1118, lw * 2, 1.5);
    rise('把飞过的天空，收进一本手帐', PW / 2, 1222, 54, TM.card + 1.45, t, { font: SER(54, 600), align: 'center', tr: 5, d: 0.7 });
    fade('网页　·　微信小程序　·　免费', PW / 2, 1690, TM.card + 2.2, t, { font: SAN(500, 38), fill: 'rgba(226,234,246,.88)', align: 'center', tr: 4, d: 0.6 }); }

  function frame(i) { const t = i / FPS; g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.shadowColor = 'transparent'; g.textAlign = 'left';
    if (t < TM.imp) sOrigin(t); else if (t < TM.dec) sImport(t); else if (t < TM.film) sDecode(t); else if (t < TM.medal) sFilm(t); else if (t < TM.poster) sMedals(t); else if (t < TM.card) sPoster(t); else sEnd(t);
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; chrome(t); finish(i);
    if (t < 0.4) { g.fillStyle = `rgba(0,0,0,${1 - t / 0.4})`; g.fillRect(0, 0, PW, PH); } if (t > END - 0.25) { g.fillStyle = `rgba(0,0,0,${cl((t - (END - 0.25)) / 0.25) * 0.9})`; g.fillRect(0, 0, PW, PH); } return CV; }

  /* ---------- sound ---------- */
  function scene() { const years = [3, 4, 5, 6, 7, 8].map((b, k) => ({ y: 2020 + k, t: b * BR, end: (b + 1) * BR, bars: 1, n: 6, dream: false, gap: false })), flights = [];
    years.forEach((y, k) => { if (k) [0, 3, 5].forEach(e => flights.push({ t0: y.t + e * Q / 2, dur: 0.8, km: 1500, up: 0, vd: 0 })); });
    return { T_END: END + BR, T_FE: TM.hang + BR, T_STAMP: TM.hang + BR + Q, T_ZOOM: TM.medal + BR, T_CARD: TM.card + BR, years, flights, order: ['CN'], visit: { CN: T_OPEN }, P: { nat: 'CN' }, style: 'groove' }; }
  function cues() { const c = [], add = (nm, t, gain, pan = 0.5, rv = 0.1, rate = 1, fb = 3000) => c.push([nm, t + BR, gain, pan, rv, rate, fb]);
    add('fly', 1.15, 0.12, 0.45, 0.25, 0.9, 1500); add('rev_zoom', BR, 0.10, 0.5, 0.2); add('sparkle', BR + 0.3, 0.10, 0.5, 0.25, 1, 7000);
    for (let i = 0; i < 8; i++) add('tick' + (i % 2), BR + 0.18 + i * 0.16, 0.13, 0.25 + 0.5 * hash(i * 1.7), 0.1, 1, 4000); add('swish', TM.imp - 0.08, 0.26, 0.5, 0.12);
    for (let k = 0; k < 3; k++) { add('card' + (k % 2), TM.imp + k * CP + 0.12, 0.3, 0.62, 0.08, [1, 1.06, 0.94][k]); add('place' + (k % 2), TM.imp + k * CP + 0.36, 0.3, 0.5, 0.1); }
    for (let i = 0; i < 5; i++) add('tick' + (i % 2), TM.imp + 0.5 + i * 0.16, 0.1, 0.4, 0.06, 1, 4000);   // the highlight reads down the sheet
    add('blip', TM.imp + CP + 0.45, 0.2, 0.4, 0.05, 1, 3000); add('blip2', TM.imp + CP + 0.75, 0.2, 0.6, 0.05, 1, 5000); add('blip', TM.imp + CP + 1.02, 0.18, 0.5, 0.05, 1.12, 3000);
    for (let i = 0; i < 9; i++) add('key' + (i % 4), TM.imp + 2 * CP + 0.14 + i * 0.085, 0.2, 0.45 + 0.012 * i, 0.05); add('pop0', TM.imp + 2 * CP + 1.05, 0.2);
    add('paper', TM.imp + 3 * CP + 0.08, 0.22, 0.5, 0.15, 1, 4000); add('swish', TM.dec - 0.1, 0.26, 0.5, 0.12, 1.1);
    add('data', TM.dec + 1.0, 0.12, 0.5, 0.1, 1, 2000); for (let i = 0; i < 4; i++) add('tone', TM.dec + 0.45 + i * 0.27, 0.16, 0.35 + 0.1 * i, 0.08, [1, 1.122, 1.26, 1.5][i], 1500); for (let i = 0; i < 8; i++) add('tick' + (i % 2), TM.dec + 0.6 + i * 0.17, 0.12, 0.3 + 0.06 * i, 0.08, 1, 4000);
    add('swish', TM.film - 0.12, 0.24, 0.5, 0.12, 0.92);
    add('leather', TM.film + 0.15, 0.22, 0.5, 0.1); add('cov_sw', TM.film + 2 * Q + 0.54, 0.3, 0.5, 0.15, 1, 1500); add('cov_land', TM.film + 2 * Q + 0.87, 0.3, 0.5, 0.1); add('print', TM.film + 4 * Q + 0.1, 0.18, 0.5, 0.12, 1, 4000); add('fly', TM.film + 4 * Q + 1.05, 0.2, 0.5, 0.2, 1.1, 1500);
    const T2 = TM.stamp; add('rev_stamp', T2, 0.09, 0.5, 0.15); add('hit', T2, 0.5, 0.5, 0.1); add('boom', T2, 0.32, 0.5, 0); add('wood', T2, 0.42, 0.5, 0.08); add('paper', T2, 0.18, 0.5, 0.15);
    add('rev_zoom', TM.medal, 0.08, 0.5, 0.2); add('sparkle', TM.medal + 0.3, 0.14, 0.5, 0.25, 1, 7000); for (let i = 0; i < 11; i++) add('pop' + (i % 2), TM.medal + 0.05 + i * 0.075, 0.13, 0.2 + 0.6 * hash(i * 2.3), 0.08, [1, 1.12, 0.92][i % 3]);
    for (let j = 0; j < 3; j++) add('ding', TM.medal + 4 * Q + j * Q + 0.08, 0.18, 0.35 + 0.15 * j, 0.15, [1, 1.26, 1.498][j], 3500);
    add('swish', TM.poster + 0.06, 0.24, 0.5, 0.12); add('paper', TM.poster + 0.2, 0.22, 0.5, 0.15, 1, 4000); add('swish', TM.card - 0.14, 0.26, 0.5, 0.12, 1.1);
    add('chime', TM.card + 0.7, 0.22, 0.5, 0.25, 1, 2500); add('place0', TM.card + 1.5, 0.24, 0.5, 0.1); add('sparkle2', TM.card + 1.95, 0.15, 0.5, 0.25, 1, 2500); return c; }
  async function decodeSprite(b64, map, bank) { const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0)), x = (await new OfflineAudioContext(1, 48000, 48000).decodeAudioData(bin.buffer)).getChannelData(0);
    let k = 0; for (let i = 1; i < 9600; i++) if (Math.abs(x[i]) > Math.abs(x[k])) k = i; const off = k - 4800; for (const [nm, [st, len, sy]] of Object.entries(map)) bank[nm] = { d: x.slice(st + off, st + off + len), s: sy }; }

  window.BRAND = {
    async init(sprites) {
      LANG = 'zh'; await Promise.all([ensureFonts(), loadFlags(S.order)]); coverBuilt = false;
      FL = S.flights.filter(f => !f.vd && !f.up && AP[f.f] && AP[f.to]); APS = [...new Set(FL.flatMap(f => [f.f, f.to]))]; HERO = FL.reduce((b, f, i) => (f.km > FL[b].km ? i : b), 0);
      const c = d3.geoCentroid({ type: 'MultiPoint', coordinates: APS.map(a => [AP[a].lon, AP[a].lat]) }), la = Math.max(-35, Math.min(35, c[1])); GC = { lam: -c[0], phi: -la * 0.8, limb: -(la - 56) };
      MEDALS = allBadges(S).slice().sort((a, b) => (a.lock ? 1 : 0) - (b.lock ? 1 : 0)); HEROES = ['dist', 'stamps', 'longest'].map(id => MEDALS.find(b => b.id === id && !b.lock)).filter(Boolean); for (const b of MEDALS) if (HEROES.length < 3 && !b.lock && !HEROES.includes(b)) HEROES.push(b);
      LONGP = await renderLongPoster(); dots();
      VIG = mk(PW, PH); const v = VIG.getContext('2d'), vg = v.createRadialGradient(PW / 2, PH * 0.48, 500, PW / 2, PH * 0.5, PH * 0.78); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.6)'); v.fillStyle = vg; v.fillRect(0, 0, PW, PH);
      const txt = '每一次起飞都值得被记住次起飞公里个国家和地区表格截图手输上传导出的行程，自动认出每一段一段一段，自己添加三种方式，装进来日期航班出发到达已结束待出行添加这一段已添加自动解码机场、时区一分钟会动的飞行护照每一程，都盖下一枚章枚飞行成就长图海报一张图，晒出这些年航迹手帐把飞过的天空，收进一本手帐网页微信小程序免费·✓▸×' + MEDALS.map(b => b.k + b.v).join('') + FL.map(f => placeName(f.f) + placeName(f.to) + air(f.fn)).join('') + 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 /.,:-';
      await Promise.all([SER(30), SER(30, 600), SAN(400, 30), SAN(500, 30), SAN(700, 30), SAN(800, 30), MONO(30), MONO(30, 400)].map(f => document.fonts.load(f, txt).catch(() => {})));
      BANK = { ...((await loadSfx()) || {}) }; for (const [b64, map] of sprites || []) await decodeSprite(b64, map, BANK);
      return { frames: Math.round(END * FPS), seconds: END, bars: TM, medals: MEDALS.length, heroes: HEROES.map(b => b.v), poster: [LONGP.width, LONGP.height] };
    },
    frame(i) { return frame(i).toDataURL('image/jpeg', 0.93); },
    cues() { return cues().map(c => [c[0], +(c[1] - BR).toFixed(3)]); },
    /* the score on the product's grid, cut one bar in (see the header) */
    audio() { const A = synth({ ...scene(), sfx: BANK, cues: cues(), stops: [[TM.card + BR - Q * 0.5, TM.card + BR]] }, 48000), k0 = Math.round(BR * 48000), n = Math.round(END * 48000), o = new Int16Array(n * 2), fi = Math.round(0.012 * 48000);
      for (let i = 0; i < n; i++) { const e = Math.min(1, i / fi, (n - i) / (0.25 * 48000)); o[2 * i] = Math.max(-32767, Math.min(32767, (A.L[k0 + i] || 0) * e * 32767)); o[2 * i + 1] = Math.max(-32767, Math.min(32767, (A.R[k0 + i] || 0) * e * 32767)); }
      let s = ''; const u = new Uint8Array(o.buffer); for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode.apply(null, u.subarray(i, i + 32768)); return btoa(s); },
  };
})();
