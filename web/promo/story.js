// Sky Passport promo v3 — a story in five acts with a tech (HUD) look, drawn on the product's own page so every product
// shot is the real renderer. Memory → Decode → Passport → Meaning → Start. Chinese and English versions share one timeline,
// laid on the product's music grid (112 BPM): STORY.scene() builds a fake scene for synth(); sound cues come from the picture.
(function () {
  const PW = 1080, PH = 1920;
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const C = mk(PW, PH), g = C.getContext('2d'), TMP = mk(PW, PH), tg = TMP.getContext('2d'), GLOW = mk(PW / 2, PH / 2), gg = GLOW.getContext('2d');

  /* ---------- three directions (the art-motion gate): same shots, different light ---------- */
  const PAL = {
    hud: { name: '深空 HUD', bg0: '#01030a', bg1: '#071330', ac: [94, 234, 255], ac2: [255, 79, 154], gold: '#e9c58e', ink: '#eaf6ff', sub: 'rgba(200,225,245,.72)', warm: [255, 196, 140] },
    gold: { name: '全息金', bg0: '#050302', bg1: '#1a1008', ac: [240, 201, 135], ac2: [255, 140, 70], gold: '#f6d79f', ink: '#fff4e4', sub: 'rgba(245,225,200,.72)', warm: [255, 210, 150] },
    aurora: { name: '极光数据', bg0: '#010807', bg1: '#08202a', ac: [111, 247, 210], ac2: [169, 139, 255], gold: '#e9c58e', ink: '#eafffa', sub: 'rgba(205,245,235,.72)', warm: [255, 205, 160] },
  };
  let P = PAL.hud, LG = 'zh';
  const T = (zh, en) => (LG === 'en' ? en : zh);
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

  /* ---------- motion helpers (all randomness from hash(): same frame → same pixels) ---------- */
  const cl = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const eo = t => 1 - Math.pow(1 - cl(t), 3), eio = t => { t = cl(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  const expo = t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * cl(t)));
  const spring = (t, d = 0.75, bounce = 0.12) => { if (t <= 0) return 0; const z = 1 - bounce, w = 2 * Math.PI / d, wd = w * Math.sqrt(1 - z * z); return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + z * w / wd * Math.sin(wd * t)); };
  const win = (t, a, b, fi = 0.3, fo = 0.3) => Math.min(cl((t - a) / fi), cl((b - t) / fo));
  const font = (w, s, f) => F(w, s, f);

  /* ---------- timeline (bars of the product's grid) ---------- */
  const HERO = 1.2; // brand title lands at Y[2].t + HERO, after a one-beat dead stop
  const BARS = [2, 2, 2, 1, 1, 1, 1, 1]; // decode · globe · brand · five modules
  let SC = null, Y = null;
  function scene() {
    const years = []; let t = T_F0;
    BARS.forEach((b, i) => { years.push({ y: 2020 + i, t, end: t + b * BAR, bars: b, n: 6, dream: false, gap: false }); t += b * BAR; });
    const T_FE = t, flights = [];
    years.forEach((y, k) => { if (k < 1) return; for (let j = 0; j < y.bars; j++) [0, 3, 5].forEach(e => flights.push({ t0: y.t + j * BAR + e * BEAT / 2, dur: 0.8, km: 1500, up: 0, vd: 0 })); });
    return { T_END: T_FE + 3 * BAR + 2.5 * BAR, T_FE, T_STAMP: T_FE + BEAT, T_ZOOM: T_FE + BAR, T_CARD: T_FE + 3 * BAR, years, flights, order: ['CN'], visit: { CN: T_OPEN }, P: { nat: 'CN' }, style: 'groove' };
  }

  /* ---------- data from the real product scene ---------- */
  let FL = [], LONG = null, DOTS = null, QR = null, F0 = null, BG = null, SCAN = null, APS = [], GC = { lam: -110, phi: -20 };
  const shot = pt => { renderFrame(Math.max(0, Math.min(S.frames - 1, Math.round(pt * FPS)))); return cv; };
  const D2 = n => String(n).padStart(2, '0');
  const MONTH = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

  /* ---------- background: deep field, perspective grid floor, dust; scanlines + grain on top ---------- */
  function buildBg() {
    BG = mk(PW, PH); const b = BG.getContext('2d'); const gr = b.createLinearGradient(0, 0, 0, PH); gr.addColorStop(0, P.bg0); gr.addColorStop(0.55, P.bg1); gr.addColorStop(1, P.bg0); b.fillStyle = gr; b.fillRect(0, 0, PW, PH);
    const v = b.createRadialGradient(PW / 2, PH * 0.45, 200, PW / 2, PH * 0.5, PH * 0.8); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.55)'); b.fillStyle = v; b.fillRect(0, 0, PW, PH);
    SCAN = mk(4, 4); const s = SCAN.getContext('2d'); s.fillStyle = 'rgba(0,0,0,.22)'; s.fillRect(0, 0, 4, 1);
  }
  function backdrop(t, warm = 0) {
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.filter = 'none'; g.drawImage(BG, 0, 0);
    if (warm > 0) { const w = g.createRadialGradient(PW / 2, PH * 0.42, 0, PW / 2, PH * 0.42, 900); w.addColorStop(0, rgba(P.warm, 0.22 * warm)); w.addColorStop(1, rgba(P.warm, 0)); g.fillStyle = w; g.fillRect(0, 0, PW, PH); }
    // perspective grid floor
    const hz = 1240, vx = PW / 2; g.save(); g.globalAlpha = 0.5 * (1 - warm * 0.7); g.strokeStyle = rgba(P.ac, 0.16); g.lineWidth = 1.2;
    for (let i = -14; i <= 14; i++) { g.beginPath(); g.moveTo(vx + i * 30, hz); g.lineTo(vx + i * 260, PH + 40); g.stroke(); }
    const z0 = (t * 0.6) % 1; for (let k = 0; k < 14; k++) { const z = (k + 1 - z0) / 14, y = hz + (PH - hz) * Math.pow(z, 2.2); g.globalAlpha = 0.5 * Math.pow(z, 1.2) * (1 - warm * 0.7); g.beginPath(); g.moveTo(0, y); g.lineTo(PW, y); g.stroke(); }
    const hg = g.createLinearGradient(0, hz - 140, 0, hz + 60); hg.addColorStop(0, rgba(P.ac, 0)); hg.addColorStop(0.7, rgba(P.ac, 0.10)); hg.addColorStop(1, rgba(P.ac, 0)); g.globalAlpha = 1; g.fillStyle = hg; g.fillRect(0, hz - 140, PW, 200);
    // dust drifting upward
    for (let i = 0; i < 90; i++) { const x = hash(i * 3.1) * PW, sp = 8 + 30 * hash(i * 5.7), y = ((hash(i * 9.3) * PH - t * sp) % PH + PH) % PH, a = 0.15 + 0.35 * hash(i * 2.2); g.fillStyle = rgba(i % 7 ? P.ac : P.ac2, a * 0.6); g.fillRect(x, y, 2, 2); }
    g.restore();
  }
  function finish(i, t) { // scanlines, grain, edge vignette — the screen surface
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.fillStyle = g.createPattern(SCAN, 'repeat'); g.fillRect(0, 0, PW, PH);
    g.save(); g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.06; const p = g.createPattern(GRAIN[i % 3], 'repeat'); p.setTransform(new DOMMatrix([1, 0, 0, 1, (hash(i) * 256) | 0, (hash(i + 7) * 256) | 0])); g.fillStyle = p; g.fillRect(0, 0, PW, PH); g.restore();
  }
  // bloom: a half-size blurred copy of what was just drawn, added back
  function bloom(amount = 0.7, blur = 18) { gg.setTransform(1, 0, 0, 1, 0, 0); gg.clearRect(0, 0, GLOW.width, GLOW.height); gg.filter = `blur(${blur}px)`; gg.drawImage(C, 0, 0, GLOW.width, GLOW.height); gg.filter = 'none';
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'lighter'; g.globalAlpha = amount; g.drawImage(GLOW, 0, 0, PW, PH); g.restore(); }
  // a cut: a few frames of horizontal slices pushed sideways, with a colour fringe
  function glitch(t, at, dur = 0.16, k = 1) {
    const u = (t - at) / dur; if (u < 0 || u > 1) return; const s = (1 - u) * k, seed = Math.floor(t * 30);
    tg.setTransform(1, 0, 0, 1, 0, 0); tg.clearRect(0, 0, PW, PH); tg.drawImage(C, 0, 0);
    for (let j = 0; j < 9; j++) { const y = hash(seed * 13 + j) * PH, h = 12 + 90 * hash(seed * 7 + j), dx = (hash(seed * 3 + j) - 0.5) * 120 * s; g.drawImage(TMP, 0, y, PW, h, dx, y, PW, h); }
    g.save(); g.globalCompositeOperation = 'screen'; g.globalAlpha = 0.35 * s; g.drawImage(TMP, 10 * s, 0); g.restore();
  }

  /* ---------- HUD: corners, labels, timecode, chapters ---------- */
  const CH = () => [T('记忆', 'MEMORY'), T('解码', 'DECODE'), T('护照', 'PASSPORT'), T('意义', 'MEANING'), T('开始', 'START')];
  function chapterAt(t) { return t < T_F0 ? 0 : t < Y[2].t ? 1 : t < SC.T_FE ? 2 : t < SC.T_CARD ? 3 : 4; }
  function hud(t) {
    const a = eo(t / 0.8); if (a <= 0) return; g.save(); g.globalAlpha = a; g.strokeStyle = rgba(P.ac, 0.55); g.lineWidth = 2;
    const m = 44, L = 46 * eo(t / 0.6);
    for (const [x, y, sx, sy] of [[m, m, 1, 1], [PW - m, m, -1, 1], [m, PH - m, 1, -1], [PW - m, PH - m, -1, -1]]) { g.beginPath(); g.moveTo(x + sx * L, y); g.lineTo(x, y); g.lineTo(x, y + sy * L); g.stroke(); }
    g.font = font(700, 20, 'SM'); g.fillStyle = rgba(P.ac, 0.75); g.textAlign = 'left'; g.fillText(decodeStr('SKY PASSPORT // FLIGHT LOG', 0.2, t, 0.8), m + 12, m + 40);
    g.textAlign = 'right'; const tc = `T+${D2(Math.floor(t / 60))}:${D2(Math.floor(t % 60))}.${D2(Math.floor((t % 1) * 100))}`; g.fillText(tc, PW - m - 12, m + 40);
    // chapters along the bottom
    const cs = CH(), ci = chapterAt(t), w = (PW - 2 * m - 80) / cs.length; g.textAlign = 'center'; g.font = font(700, LG === 'en' ? 17 : 20, LG === 'en' ? 'SM' : undefined);
    cs.forEach((c, k) => { const x = m + 40 + w * (k + 0.5), on = k === ci; g.fillStyle = on ? rgba(P.ac, 0.95) : rgba(P.ac, 0.32); g.fillText(`0${k + 1} ${c}`, x, PH - m - 18); g.fillRect(x - w / 2 + 8, PH - m - 48, w - 16, on ? 3 : 1); });
    g.restore();
  }

  /* ---------- text ---------- */
  const GLYPH_EN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<>/#$%&*', GLYPH_ZH = '航迹手帐飞行记忆解码数据表格机场国家时间护起降';
  // decode effect: each character flickers through glyphs, then settles in order
  function decodeStr(s, t0, t, dur = 0.7) { const ch = [...s], n = ch.length, u = (t - t0) / dur; if (u >= 1.15) return s; if (u <= 0) return '';
    const set = /[㐀-鿿]/.test(s) ? GLYPH_ZH : GLYPH_EN; let out = '';
    for (let i = 0; i < n; i++) { const at = i / n; if (u * 1.15 > at + 0.15) out += ch[i]; else if (u * 1.15 > at) out += ch[i] === ' ' ? ' ' : set[Math.floor(hash(i * 31 + Math.floor(t * 24)) * set.length)]; else out += ' '; }
    return out; }
  function text(s, x, y, size, { w = 700, color = P.ink, align = 'center', fam, a = 1, max = 1e9 } = {}) { if (a <= 0 || !s) return; g.save(); g.globalAlpha *= a; let z = size; g.font = font(w, z, fam); while (g.measureText(s).width > max && z > 14) { z -= 2; g.font = font(w, z, fam); } g.fillStyle = color; g.textAlign = align; g.fillText(s, x, y); g.restore(); }
  function blurIn(s, x, y, size, t0, t, o = {}) { const u = cl((t - t0) / 0.7), a = Math.min(eo(u), o.out ? cl((o.out - t) / 0.3) : 1); if (a <= 0) return; g.save(); g.filter = u < 1 ? `blur(${(1 - eo(u)) * 18}px)` : 'none'; text(s, x, y + (1 - eo(u)) * 26, size, { ...o, a }); g.restore(); }
  function decodeIn(s, x, y, size, t0, t, o = {}) { const a = o.out ? cl((o.out - t) / 0.3) : 1; if (a <= 0 || t < t0) return; text(decodeStr(s, t0, t, o.dur || 0.6), x, y, size, { ...o, a }); }
  // story narration: one line at a time, lower third
  /* Narration drives the words on screen. VO = [[t0, t1, text, head, y], …] from make_voice.py (real TTS timings).
     A spoken line is shown as one subtitle whose characters light up as the voice reaches them; lines flagged `head` are already
     on screen as a headline, so they only get the voice meter. With VO set, the old fixed captions (say) stay off. */
  let VO = null, NOQR = false, NOURL = false, KIN = false; /* KIN: false | 'A' rapid fire | 'B' one pass | 'C' departures board */
  function meter(cx, y, on, t, a) { g.save(); g.globalAlpha = a; for (let i = 0; i < 9; i++) { const h = on ? 5 + 24 * Math.abs(Math.sin(t * 9 + i * 1.7)) * (0.45 + 0.55 * hash(Math.floor(t * 12) * 7 + i)) : 4; g.fillStyle = i === 4 ? P.gold : rgba(P.ac, 0.85); g.fillRect(cx - 49 + i * 11, y - h / 2, 5, h); } g.restore(); }
  function subtitle(t) { if (!VO) return; const ln = VO.find(l => t >= l[0] - 0.15 && t <= l[1] + 0.35); if (!ln) return; const [t0, t1, s, head, yy] = ln, a = Math.min(cl((t - t0 + 0.15) / 0.2), cl((t1 + 0.35 - t) / 0.3)), on = t >= t0 && t <= t1;
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
    if (head) { meter(PW / 2, yy || 1700, on, t, a * 0.9); g.restore(); return; }
    const y = yy || 1590, ch = [...s]; let sz = LG === 'en' ? 44 : 50; g.font = font(600, sz); while (g.measureText(s).width > PW - 170 && sz > 26) { sz -= 2; g.font = font(600, sz); }
    const ws = ch.map(c => g.measureText(c).width), w = ws.reduce((p, c) => p + c, 0), bw = w + 300, bh = sz + 64;
    const bg = g.createLinearGradient(PW / 2 - bw / 2, 0, PW / 2 + bw / 2, 0); bg.addColorStop(0, 'rgba(2,6,16,0)'); bg.addColorStop(0.22, 'rgba(2,6,16,.82)'); bg.addColorStop(0.78, 'rgba(2,6,16,.82)'); bg.addColorStop(1, 'rgba(2,6,16,0)');
    g.globalAlpha = a; g.fillStyle = bg; g.fillRect(PW / 2 - bw / 2, y - sz - 20, bw, bh);
    const ln2 = g.createLinearGradient(PW / 2 - w / 2, 0, PW / 2 + w / 2, 0); ln2.addColorStop(0, 'rgba(233,197,142,0)'); ln2.addColorStop(0.5, 'rgba(233,197,142,.9)'); ln2.addColorStop(1, 'rgba(233,197,142,0)'); g.fillStyle = ln2; g.fillRect(PW / 2 - w / 2, y - sz - 20, w, 1.5);
    const k = ch.length * cl((t - t0) / Math.max(0.3, t1 - t0 - 0.12)); let x = PW / 2 - w / 2; g.textAlign = 'left';
    ch.forEach((c, i) => { const lit = cl(k - i); g.globalAlpha = a; g.fillStyle = `rgba(234,244,255,${0.3 + 0.7 * lit})`; if (lit > 0 && lit < 1) g.fillStyle = P.gold; g.fillText(c, x, y); x += ws[i]; });
    meter(PW / 2, y + 42, on, t, a * 0.85); g.restore(); }
  function say(s, t0, t1, t, y = 1560) { if (VO || KIN) return; const a = win(t, t0, t1, 0.35, 0.3); if (a <= 0) return; const sz = LG === 'en' ? 46 : 52;
    g.save(); g.font = font(600, sz); const w = Math.min(PW - 100, g.measureText(s).width + 80); g.globalAlpha = a * 0.96; g.fillStyle = 'rgba(2,6,16,.94)'; rr(g, PW / 2 - w / 2, y - sz - 22, w, sz + 46, 16); g.fill();
    g.globalAlpha = a; g.fillStyle = rgba(P.ac, 0.9); g.fillRect(PW / 2 - w / 2, y - sz - 22, 4, sz + 46); g.restore(); // a subtitle bar: readable over the white passes too
    g.save(); g.filter = t - t0 < 0.4 ? `blur(${(1 - eo((t - t0) / 0.4)) * 10}px)` : 'none'; text(s, PW / 2, y, sz, { w: 600, a, max: PW - 160 }); g.restore(); }

  /* ---------- Act 1: boarding passes (paper memories) ---------- */
  function pass(f, x, y, s, rot, a, k) {
    if (a <= 0) return; const w = 620, h = 250; g.save(); g.globalAlpha *= a; g.translate(x, y); g.rotate(rot); g.scale(s, s);
    g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 30; g.shadowOffsetY = 14; rr(g, -w / 2, -h / 2, w, h, 18); const pg = g.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2); pg.addColorStop(0, '#fbf6ef'); pg.addColorStop(1, '#e9e1d6'); g.fillStyle = pg; g.fill(); g.shadowColor = 'transparent';
    const band = ['#8e1d38', '#1c4f8c', '#0f6b5a', '#b0601c', '#5b2a86'][k % 5]; g.save(); rr(g, -w / 2, -h / 2, w, h, 18); g.clip(); g.fillStyle = band; g.fillRect(-w / 2, -h / 2, w, 46); g.restore();
    g.font = font(700, 20, 'SM'); g.fillStyle = '#fff'; g.textAlign = 'left'; g.fillText('BOARDING PASS', -w / 2 + 22, -h / 2 + 31); g.textAlign = 'right'; g.fillText(f.fn, w / 2 - 150, -h / 2 + 31);
    g.textAlign = 'left'; g.fillStyle = '#2a1f24'; g.font = font(700, 64, 'SM'); g.fillText(f.f, -w / 2 + 24, 20); g.font = font(400, 36, 'SM'); g.fillText('→', -w / 2 + 170, 14); g.font = font(700, 64, 'SM'); g.fillText(f.to, -w / 2 + 230, 20);
    const d = f.date.split('-'); g.font = font(400, 17, 'SM'); g.fillStyle = '#7b6d72';
    [['DATE', `${d[2]} ${MONTH[+d[1] - 1]} ${d[0]}`, 0], ['GATE', 'B' + (10 + (k * 7) % 40), 200], ['SEAT', (12 + (k * 11) % 40) + 'ABCK'[k % 4], 320]].forEach(([l, v, dx]) => { g.fillText(l, -w / 2 + 24 + dx, 66); g.font = font(700, 22, 'SM'); g.fillStyle = '#2a1f24'; g.fillText(v, -w / 2 + 24 + dx, 94); g.font = font(400, 17, 'SM'); g.fillStyle = '#7b6d72'; });
    g.setLineDash([6, 7]); g.strokeStyle = 'rgba(80,60,70,.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(w / 2 - 128, -h / 2 + 56); g.lineTo(w / 2 - 128, h / 2 - 10); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#2a1f24'; for (let i = 0; i < 26; i++) { const bw = 1 + Math.floor(hash(k * 97 + i) * 4); g.fillRect(w / 2 - 110 + i * 3.6, -h / 2 + 70, bw, 140); }
    g.restore();
  }
  function act1(t) {
    backdrop(t, 1 - cl((t - 4.6) / 1.6));
    const f0 = FL[0];
    // the first pass, held in a soft light
    const a0 = win(t, 0.3, 3.2, 0.6, 0.6), s0 = 0.92 + 0.05 * eo(t / 3);
    pass(f0, PW / 2, 900 - 12 * Math.sin(t * 1.4), s0, -0.04 + 0.01 * Math.sin(t), a0, 0);
    say(T(`${f0.y} 年，第一次一个人出远门`, `${f0.y}. My first flight on my own.`), 0.5, 2.6, t);
    // then they pile up: passes fly in from depth, faster and faster
    const N = Math.min(FL.length, 42);
    for (let k = N - 1; k >= 1; k--) { const st = 1.9 + 2.0 * Math.pow(k / N, 0.75), u = (t - st) / 1.5; if (u <= 0 || u > 1.05) continue;
      const z = 6 - 5.4 * eio(u), x = (hash(k * 1.7) - 0.5) * 2.4, y = (hash(k * 3.3) - 0.5) * 3.0, sc = 1.4 / z, X = PW / 2 + x * 520 / z, Yy = 900 + y * 520 / z;
      pass(FL[k], X, Yy, sc, (hash(k * 5.1) - 0.5) * 0.5, cl(u * 4) * cl((1.05 - u) * 6) * (1 - cl((t - 4.4) / 0.4)), k); } /* clear the stage for the spreadsheet and its line */
    say(T('后来，登机牌越攒越多', 'Then the boarding passes piled up.'), 2.9, 4.4, t);
    // a counter in the HUD
    if (t > 1.9 && t < 4.6) { const n = Math.min(FL.length, Math.floor(1 + (FL.length - 1) * eo((t - 1.9) / 2.3))); text(`${T('登机牌', 'BOARDING PASSES')}  ${String(n).padStart(3, '0')}`, PW / 2, 300, 28, { fam: 'SM', color: rgba(P.ac, 0.85), a: win(t, 1.9, 4.6) }); }
    // and end up as rows in a spreadsheet
    if (t > 4.3) { const u = eo((t - 4.3) / 0.6); table(t, 1 - u * 0, u); say(T('最后都躺进了一张冷冰冰的表格', 'And ended up as rows in a cold spreadsheet.'), 4.5, T_F0 - 0.05, t); }
  }

  /* ---------- the spreadsheet, then the scan that decodes it ---------- */
  function table(t, cold, a, scanY = -1) {
    const x = 120, y = 560, w = 840, h = 800; g.save(); g.globalAlpha *= a; g.fillStyle = 'rgba(16,22,34,.92)'; rr(g, x, y, w, h, 20); g.fill(); g.strokeStyle = scanY >= 0 ? rgba(P.ac, 0.6) : 'rgba(255,255,255,.18)'; g.lineWidth = 1.5; g.stroke();
    g.font = font(700, 20, 'SM'); g.fillStyle = 'rgba(200,210,225,.55)'; g.textAlign = 'left'; ['DATE', 'FLIGHT', 'FROM', 'TO'].forEach((hd, i) => g.fillText(hd, x + 40 + [0, 240, 450, 620][i], y + 54));
    g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x + 30, y + 74, w - 60, 2);
    g.save(); rr(g, x, y + 80, w, h - 90, 0); g.clip();
    const off = scanY >= 0 ? 0 : (t * 26) % 48;
    FL.forEach((f, i) => { const yy = y + 120 + i * 48 - off; if (yy > y + h + 20) return; const done = scanY >= 0 && yy < scanY;
      g.font = font(400, 24, 'SM'); g.fillStyle = done ? rgba(P.ac, 0.95) : `rgba(205,212,225,${0.5 + 0.1 * cold})`;
      g.fillText(f.date, x + 40, yy); g.fillText(f.fn, x + 280, yy); g.fillText(f.f, x + 490, yy); g.fillText(f.to, x + 660, yy);
      if (done) { g.fillStyle = rgba(P.ac, 0.9); g.beginPath(); g.arc(x + w - 46, yy - 8, 6, 0, 7); g.fill(); } });
    g.restore();
    if (scanY >= y && scanY <= y + h) { const sg = g.createLinearGradient(0, scanY - 90, 0, scanY + 6); sg.addColorStop(0, rgba(P.ac, 0)); sg.addColorStop(1, rgba(P.ac, 0.35)); g.fillStyle = sg; g.fillRect(x, scanY - 90, w, 96); g.fillStyle = rgba(P.ac, 0.95); g.fillRect(x - 20, scanY, w + 40, 3); }
    g.restore();
  }
  function act2a(t) { // decode
    backdrop(t); const t0 = Y[0].t, u = (t - t0) / (Y[0].end - t0);
    decodeIn(T('把每一行，解码成一条航线', 'Decoding every row into a route'), PW / 2, 400, LG === 'en' ? 52 : 60, t0 - 0.1, t, { w: 700, dur: 0.8 });
    const scanY = 560 + 820 * eio(cl((t - t0 - 0.3) / 2.6));
    const fade = 1 - cl((t - Y[0].end + 0.9) / 0.6); table(t, 0, fade, scanY);
    // the parse log, typed beside the scan
    const rows = Math.min(FL.length, Math.floor(FL.length * cl((t - t0 - 0.3) / 2.6)));
    g.save(); g.globalAlpha = fade; g.font = font(700, 22, 'SM'); g.textAlign = 'left';
    const log = [T('读取表格', 'READ SHEET') + `  ${rows}/${FL.length}`, T('识别机场', 'MATCH AIRPORTS') + `  ${Math.min(F0.ap, Math.ceil(F0.ap * rows / FL.length))}`, T('时区换算', 'TIME ZONES') + '  OK', T('国家地区', 'COUNTRIES') + `  ${Math.min(F0.cc, Math.ceil(F0.cc * rows / FL.length))}`];
    log.forEach((l, i) => { if (t > t0 + 0.4 + i * 0.5) { g.fillStyle = rgba(P.ac, 0.9); g.fillText('▸ ' + decodeStr(l, t0 + 0.4 + i * 0.5, t, 0.4), 130, 1450 + i * 40); } });
    g.restore();
    // rows become points rising to the globe
    if (t > Y[0].end - 1.0) { const k = eo((t - (Y[0].end - 1.0)) / 1.0); FL.forEach((f, i) => { const x0 = 160 + (hash(i * 2.3) * 760), y0 = 640 + i * 14, x1 = PW / 2 + (hash(i * 7.1) - 0.5) * 300, y1 = 860 + (hash(i * 4.4) - 0.5) * 300; const x = x0 + (x1 - x0) * k, y = y0 + (y1 - y0) * k - Math.sin(Math.PI * k) * 200;
      g.fillStyle = rgba(P.ac, 0.9 * (1 - k * 0.5)); g.beginPath(); g.arc(x, y, 3 + 2 * Math.sin(Math.PI * k), 0, 7); g.fill(); }); }
    bloom(0.55);
  }

  /* ---------- the globe: dotted land, routes lifted off the surface ---------- */
  // land as dots: rasterise the land once (geoContains costs ~4 ms a point), then sample it on an equal-area-ish grid
  function globeDots() { if (DOTS) return DOTS; DOTS = []; const Wm = 1440, Hm = 720, m = mk(Wm, Hm), mc = m.getContext('2d'), pr = d3.geoEquirectangular().scale(Wm / (2 * Math.PI)).translate([Wm / 2, Hm / 2]);
    mc.fillStyle = '#fff'; mc.beginPath(); d3.geoPath(pr, mc)(LAND); mc.fill(); const px = mc.getImageData(0, 0, Wm, Hm).data, land = (lo, la) => px[(Math.floor((90 - la) / 180 * Hm) * Wm + Math.floor((lo + 180) / 360 * Wm)) * 4 + 3] > 128;
    for (let lat = -56; lat <= 78; lat += 1.6) { const step = 1.6 / Math.max(0.2, Math.cos(lat * Math.PI / 180)); for (let lon = -180; lon < 180; lon += step) if (land(lon, lat)) DOTS.push([lon, lat, hash(lon * 3 + lat)]); } return DOTS; }
  function globe(t, cx, cy, R, lam, phi, opt) {
    const proj = d3.geoOrthographic().scale(R).translate([cx, cy]).rotate([lam, phi]), ctr = [-lam, -phi], vis = p => d3.geoDistance(p, ctr) < Math.PI / 2;
    // atmosphere
    const at = g.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.28); at.addColorStop(0, rgba(P.ac, 0.20 * opt.a)); at.addColorStop(1, rgba(P.ac, 0)); g.fillStyle = at; g.beginPath(); g.arc(cx, cy, R * 1.28, 0, 7); g.fill();
    const bd = g.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R); bd.addColorStop(0, 'rgba(18,40,80,.85)'); bd.addColorStop(1, 'rgba(3,8,20,.95)'); g.save(); g.globalAlpha = opt.a; g.fillStyle = bd; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fill();
    g.strokeStyle = rgba(P.ac, 0.35); g.lineWidth = 1.5; g.stroke();
    // graticule
    g.strokeStyle = rgba(P.ac, 0.08); g.lineWidth = 1; const gp = d3.geoPath(proj, g); g.beginPath(); gp(d3.geoGraticule().step([20, 20])()); g.stroke();
    // land dots, darker at the limb
    for (const [lo, la, h] of globeDots()) { const dd = d3.geoDistance([lo, la], ctr); if (dd >= Math.PI / 2) continue; const p = proj([lo, la]), c = Math.cos(dd); g.fillStyle = rgba(P.ac, (0.25 + 0.55 * c) * (0.7 + 0.3 * Math.sin(t * 2 + h * 40))); g.fillRect(p[0] - 1.6, p[1] - 1.6, 3.2, 3.2); }
    // airports as city lights
    g.globalCompositeOperation = 'lighter'; for (const c of APS) { const ll = [AP[c].lon, AP[c].lat]; if (!vis(ll)) continue; const p = proj(ll); g.fillStyle = rgba(P.warm, 0.18 * opt.a); g.beginPath(); g.arc(p[0], p[1], 10, 0, 7); g.fill(); g.fillStyle = rgba(P.warm, 0.9 * opt.a); g.beginPath(); g.arc(p[0], p[1], 2.6, 0, 7); g.fill(); }
    // routes: great circles lifted by distance; each one draws in with a glowing head
    g.globalCompositeOperation = 'lighter';
    FL.forEach((f, i) => { const st = opt.t0 + i * opt.step, u = cl((t - st) / 0.7); if (u <= 0) return; const A = [AP[f.f].lon, AP[f.f].lat], B = [AP[f.to].lon, AP[f.to].lat], ip = d3.geoInterpolate(A, B), D = d3.geoDistance(A, B), hmax = 0.06 + 0.22 * D / Math.PI, n = 36;
      let prev = null; const col = i % 5 === 4 ? P.ac2 : P.ac;
      for (let j = 0; j <= n * eo(u); j++) { const q = j / n, ll = ip(q), p = proj(ll), lift = 1 + hmax * Math.sin(Math.PI * q), X = cx + (p[0] - cx) * lift, Yy = cy + (p[1] - cy) * lift, front = vis(ll) || Math.hypot(X - cx, Yy - cy) > R;
        if (prev && front && prev[2]) { g.strokeStyle = rgba(col, (opt.pulse ? 0.4 : 0.6) * (0.55 + 0.45 * q)); g.lineWidth = 2.6; g.beginPath(); g.moveTo(prev[0], prev[1]); g.lineTo(X, Yy); g.stroke(); }
        prev = [X, Yy, front]; }
      if (u < 1 && prev && prev[2]) { g.fillStyle = rgba(col, 0.95); g.beginPath(); g.arc(prev[0], prev[1], 5, 0, 7); g.fill(); g.fillStyle = rgba(col, 0.25); g.beginPath(); g.arc(prev[0], prev[1], 14, 0, 7); g.fill(); }
      if (opt.pulse && u >= 1) { const q = ((t * 0.5 + hash(i)) % 1), ll = ip(q), p = proj(ll), lift = 1 + hmax * Math.sin(Math.PI * q), X = cx + (p[0] - cx) * lift, Yy = cy + (p[1] - cy) * lift; if (vis(ll) || Math.hypot(X - cx, Yy - cy) > R) { g.fillStyle = rgba(col, 0.9); g.beginPath(); g.arc(X, Yy, 3.5, 0, 7); g.fill(); } } });
    g.restore();
    // HUD ring
    g.save(); g.globalAlpha = 0.7 * opt.a; g.strokeStyle = rgba(P.ac, 0.4); g.lineWidth = 1.5; g.beginPath(); g.arc(cx, cy, R * 1.12, 0, 7); g.stroke();
    for (let k = 0; k < 72; k++) { const an = k / 72 * Math.PI * 2 + t * 0.12, r1 = R * 1.12, r2 = r1 + (k % 6 ? 8 : 18); g.beginPath(); g.moveTo(cx + Math.cos(an) * r1, cy + Math.sin(an) * r1); g.lineTo(cx + Math.cos(an) * r2, cy + Math.sin(an) * r2); g.stroke(); }
    g.restore();
  }
  function act2b(t) { // the routes, on a turning globe
    backdrop(t); const t0 = Y[1].t, u = (t - t0) / (Y[1].end - t0);
    const R = 380 + 40 * eo(u), lam = GC.lam + 22 - (t - t0) * 7;
    globe(t, PW / 2, 900, R, lam, GC.phi, { t0: t0 + 0.2, step: 2.9 / FL.length, a: eo((t - t0) / 0.5), pulse: false });
    decodeIn(T('解码完成', 'DECODED'), PW / 2, 360, 30, t0, t, { fam: 'SM', color: rgba(P.ac, 0.9), w: 700 });
    say(T(`${F0.n} 次起飞，${F0.cc} 个国家地区，绕地球 ${(F0.km / 40075).toFixed(2)} 圈`, `${F0.n} take-offs. ${F0.cc} countries. ${(F0.km / 40075).toFixed(2)}× around the Earth.`), t0 + 1.2, Y[1].end - 0.05, t, 1480);
    bloom(0.75);
  }

  /* ---------- Act 3: the passport — hero, then five modules on the beat ---------- */
  function goldFill(y0, y1) { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, '#fbe9c2'); gr.addColorStop(0.55, '#e2b670'); gr.addColorStop(1, '#f6dca6'); return gr; }
  function act3a(t) {
    const t0 = Y[2].t, hit = t0 + HERO, stop = hit - BEAT;
    backdrop(t);
    if (t < hit) { // the globe keeps turning, then collapses into a point of light during the stop
      const k = cl((t - stop) / BEAT), R = 420 * (1 - eio(k) * 0.96), lam = GC.lam + 22 - (t - Y[1].t) * 7;
      if (R > 8) globe(t, PW / 2, 900, R, lam, GC.phi, { t0: -99, step: 0, a: 1 - k * 0.6, pulse: true });
      const lp = eo(k); g.save(); g.globalCompositeOperation = 'lighter'; const lg = g.createRadialGradient(PW / 2, 900, 0, PW / 2, 900, 40 + 260 * lp); lg.addColorStop(0, `rgba(255,240,220,${0.9 * lp})`); lg.addColorStop(1, 'rgba(255,240,220,0)'); g.fillStyle = lg; g.fillRect(0, 0, PW, PH); g.restore();
      bloom(0.6);
    } else { // HIT: the emblem and the title land together
      const h = t - hit, k = 1 + 0.14 * Math.exp(-h * 15) * Math.cos(h * 28);
      g.save(); g.translate(PW / 2, 760); g.scale(k, k); g.strokeStyle = g.fillStyle = goldFill(-260, 260); emblem(g, 0.82, false); g.restore();
      const title = T('航迹手帐', 'SKY PASSPORT'), ty = 1140, tr = LG === 'en' ? 8 : 30; let sz = LG === 'en' ? 128 : 168; g.font = `900 ${sz}px ${SERIF}`; while (g.measureText(title).width + tr * title.length > 860 && sz > 60) { sz -= 4; g.font = `900 ${sz}px ${SERIF}`; } /* fits with the landing bounce */
      for (const [dx, col] of [[-14, 'rgba(255,60,120,.55)'], [14, 'rgba(60,220,255,.55)']]) { const s = Math.exp(-h * 10); if (s < 0.03) continue; g.save(); g.globalAlpha = s; g.globalCompositeOperation = 'screen'; g.fillStyle = col; g.font = `900 ${sz}px ${SERIF}`; g.textAlign = 'center'; spaced(g, title, PW / 2 + dx * s, ty, tr); g.restore(); }
      g.save(); g.translate(PW / 2, ty - 50); g.scale(k, k); g.translate(-PW / 2, -(ty - 50)); g.fillStyle = goldFill(ty - sz, ty + 10); g.font = `900 ${sz}px ${SERIF}`; g.textAlign = 'center'; spaced(g, title, PW / 2, ty, tr); g.restore();
      decodeIn(LG === 'en' ? '航 迹 手 帐' : 'S K Y   P A S S P O R T', PW / 2, 1222, 34, hit + 0.25, t, { fam: LG === 'en' ? undefined : 'SM', color: rgba(P.ac, 0.95), w: 700 });
      blurIn(T('把你的航班记录，做成一本会动的护照', 'Your flight history, as a passport that comes alive'), PW / 2, 1360, LG === 'en' ? 40 : 46, hit + 0.9, t, { w: 500, color: P.sub, max: PW - 160 });
      const sw = (t - hit - 1.2) / 1.0; if (sw > 0 && sw < 1) { g.save(); g.beginPath(); g.rect(120, 980, 840, 200); g.clip(); g.globalCompositeOperation = 'lighter'; const x = 0 + (PW + 400) * eio(sw) - 200, lg = g.createLinearGradient(x - 90, 0, x + 90, 0); lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.5, 'rgba(255,255,255,.45)'); lg.addColorStop(1, 'rgba(255,255,255,0)'); g.setTransform(1, 0, -0.35, 1, 0, 0); g.fillStyle = lg; g.fillRect(-400, 980, PW + 800, 200); g.restore(); }
      const fl = Math.exp(-h * 9); if (fl > 0.02) { g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = `rgba(255,236,205,${0.42 * fl})`; g.fillRect(0, 0, PW, PH); g.restore(); }
      bloom(0.55 + 0.4 * Math.exp(-h * 4));
    }
  }
  // a HUD window for one module
  function panel(x, y, w, h, t0, t, title, draw) {
    const u = cl((t - t0) / 0.22), a = eo(u); if (a <= 0) return; const hy = y + (1 - a) * 40;
    g.save(); g.globalAlpha = a; g.fillStyle = 'rgba(6,14,30,.78)'; rr(g, x, hy, w, h, 14); g.fill(); g.strokeStyle = rgba(P.ac, 0.55); g.lineWidth = 1.5; g.stroke();
    g.fillStyle = rgba(P.ac, 0.12); g.fillRect(x, hy, w, 44); g.font = font(700, 18, 'SM'); g.fillStyle = rgba(P.ac, 0.95); g.textAlign = 'left'; g.fillText(decodeStr(title, t0 + 0.05, t, 0.4), x + 18, hy + 29);
    g.textAlign = 'right'; g.fillText('● REC', x + w - 18, hy + 29);
    g.save(); rr(g, x + 12, hy + 56, w - 24, h - 68, 8); g.clip(); draw(x + 12, hy + 56, w - 24, h - 68); g.restore(); g.restore();
  }
  const MODS = () => [
    ['MODULE 01 // PASSPORT FILM', T('一分钟的飞行护照', 'A one-minute passport film'), T('竖屏动画 · 原创配乐 · 存进相册', 'Vertical film · original score · straight to your photos')],
    ['MODULE 02 // LONG POSTER', T('一张图，晒出这些年', 'One image, all those years'), T('统计 · 航线地图 · 飞行成就', 'Numbers · route map · achievements')],
    ['MODULE 03 // AI CLEANUP', T('写错的地名，它认得出', 'Typos? It still gets them'), T('错别字、简称、中英文都能认', 'Misspellings, nicknames, any language')],
    ['MODULE 04 // ANY EXPORT', T('各种 App 的导出，直接上传', 'Upload your exports as-is'), T('航旅纵横 · Flighty · myFlightradar24 · Excel · CSV', 'Flighty · myFlightradar24 · OpenFlights · Excel · CSV')],
    ['MODULE 05 // PRIVATE', T('表格只在你的浏览器里处理', 'Your sheet never leaves your browser'), T('不登录 · 不上传 · 免费', 'No sign-up · no upload · free')],
  ];
  function act3b(t) {
    backdrop(t); const k = Math.max(3, Math.min(7, Y.findIndex(y => t >= y.t && t < y.end))), m = k - 3, t0 = Y[k].t, [hd, title, line] = MODS()[m];
    text(`0${m + 1} / 05`, PW / 2, 250, 26, { fam: 'SM', color: rgba(P.ac, 0.9), a: win(t, t0 - 0.05, Y[k].end + 0.1, 0.15, 0.15) });
    decodeIn(title, PW / 2, 340, LG === 'en' ? 60 : 72, t0 - 0.2, t, { w: 800, dur: 0.28, max: PW - 120 });
    blurIn(line, PW / 2, 410, LG === 'en' ? 30 : 34, t0 + 0.15, t, { w: 400, color: P.sub, max: PW - 140 });
    const lt = t - t0;
    if (m === 0) panel(170, 480, 740, 1240, t0 + 0.05, t, hd, (x, y, w, h) => { const pt = T_F0 + 2.5 + lt * 4.5; g.drawImage(shot(pt), x + (w - h * 9 / 16) / 2, y, h * 9 / 16, h); });
    if (m === 1) panel(170, 480, 740, 1240, t0 + 0.05, t, hd, (x, y, w, h) => { const sc = w / LONG.width, trv = LONG.height * sc - h; g.drawImage(LONG, x, y - trv * eio(cl((lt - 0.2) / 1.8)), w, LONG.height * sc); });
    if (m === 2) panel(110, 520, 860, 900, t0 + 0.05, t, hd, (x, y, w, h) => { const fx = LG === 'en' ? [['Heathrw', 'London Heathrow LHR'], ['JFK Intl', 'New York JFK'], ['Narita T1', 'Tokyo Narita NRT'], ['Suvarnabumi', 'Bangkok BKK'], ['LA', 'Los Angeles LAX']] : [['浦栋', '上海浦东 PVG'], ['红桥', '上海虹桥 SHA'], ['Narita T1', '东京成田 NRT'], ['Suvarnabumi', '曼谷 BKK'], ['LA', '洛杉矶 LAX']];
      fx.forEach(([bad, good], i) => { const yy = y + 110 + i * 150, kk = cl((lt - 0.2 - i * 0.24) / 0.2); text(bad, x + 50, yy, 44, { align: 'left', w: 600, color: `rgba(255,120,140,${1 - kk})` }); if (kk > 0) { text(good, x + 50 + (1 - eo(kk)) * 30, yy, 44, { align: 'left', w: 700, a: kk }); g.save(); g.globalAlpha = kk; g.fillStyle = rgba(P.ac, 0.95); g.beginPath(); g.arc(x + w - 70, yy - 14, 24, 0, 7); g.fill(); g.strokeStyle = '#04101f'; g.lineWidth = 5; g.beginPath(); g.moveTo(x + w - 82, yy - 14); g.lineTo(x + w - 73, yy - 5); g.lineTo(x + w - 58, yy - 23); g.stroke(); g.restore(); }
        g.fillStyle = rgba(P.ac, 0.12); g.fillRect(x + 40, yy + 40, w - 80, 1.5); }); });
    if (m === 3) panel(110, 520, 860, 900, t0 + 0.05, t, hd, (x, y, w, h) => { const chips = LG === 'en' ? ['Flighty', 'myFlightradar24', 'OpenFlights', 'Excel', 'CSV', 'Google Sheets'] : ['航旅纵横', 'Flighty', 'myFlightradar24', 'OpenFlights', 'Excel', 'CSV'];
      chips.forEach((c, i) => { const st = 0.02 + i * 0.1, kk = eo(cl((lt - st) / 0.5)), x0 = x + 60 + (i % 2) * 400, y0 = y + 110 + Math.floor(i / 2) * 150, x1 = x + w / 2, y1 = y + h - 120, k2 = eio(cl((lt - 1.2 - i * 0.05) / 0.5)), X = x0 + (x1 - x0 - 150) * k2, Yy = y0 + (y1 - y0) * k2;
        g.save(); g.globalAlpha = kk * (1 - k2 * 0.85); g.strokeStyle = rgba(P.ac, 0.7); g.lineWidth = 1.5; rr(g, X, Yy - 46, 330, 66, 33); g.stroke(); text(c, X + 165, Yy, 30, { w: 700, a: 1, max: 300 }); g.restore(); });
      const k3 = eo(cl((lt - 1.5) / 0.4)); if (k3 > 0) { g.save(); g.globalAlpha = k3; g.translate(x + w / 2, y + h - 150); g.strokeStyle = g.fillStyle = goldFill(-120, 120); emblem(g, 0.32 * (0.8 + 0.2 * k3), false); g.restore(); } });
    if (m === 4) panel(110, 520, 860, 900, t0 + 0.05, t, hd, (x, y, w, h) => { const cx = x + w / 2, cy = y + h / 2 - 20, k1 = eo(cl((lt - 0.02) / 0.3));
      g.save(); g.globalAlpha = k1; g.strokeStyle = rgba(P.ac, 0.8); g.lineWidth = 3; rr(g, x + 80, y + 70, w - 160, h - 220, 18); g.stroke(); g.fillStyle = rgba(P.ac, 0.15); g.fillRect(x + 80, y + 70, w - 160, 50); [0, 1, 2].forEach(i => { g.fillStyle = rgba(P.ac, 0.7); g.beginPath(); g.arc(x + 110 + i * 26, y + 95, 7, 0, 7); g.fill(); });
      for (let i = 0; i < 7; i++) { const yy = y + 170 + i * 52; g.fillStyle = rgba(P.ac, 0.18 + 0.1 * (i % 2)); g.fillRect(x + 120, yy, (w - 240) * (0.5 + 0.5 * hash(i * 3)), 22); }
      const k2 = spring(lt - 0.6, 0.6, 0.18); g.translate(cx, cy + 40); g.scale(0.6 + 0.4 * k2, 0.6 + 0.4 * k2); g.globalAlpha = k1 * cl(k2 * 2);
      g.fillStyle = P.gold; rr(g, -90, -40, 180, 140, 20); g.fill(); g.lineWidth = 22; g.strokeStyle = P.gold; g.beginPath(); g.arc(0, -40, 62, Math.PI, 0); g.stroke(); g.fillStyle = '#04101f'; g.beginPath(); g.arc(0, 15, 16, 0, 7); g.fill(); g.fillRect(-6, 15, 12, 44);
      g.restore(); text(LG === 'en' ? 'LOCAL ONLY' : '仅在本地 · LOCAL ONLY', cx, y + h - 60, 32, { fam: 'SM', w: 700, color: rgba(P.ac, 0.95), a: k1 }); });
    bloom(0.35);
    glitch(t, t0, 0.14, 1);
  }

  /* ---------- Act 4: meaning — the real stamp, the line, the totals ---------- */
  function act4a(t) {
    backdrop(t); const pt = S.T_STAMP + (t - SC.T_STAMP), out = cl((t - SC.T_STAMP - 0.65) / 0.4);
    if (out < 1) panel(130, 230, 820, 1460, SC.T_FE - 0.2, t, 'ARCHIVE // STAMPED', (x, y, w, h) => { g.globalAlpha *= 1 - out; g.drawImage(shot(pt), x + (w - h * 9 / 16) / 2, y, h * 9 / 16, h); });
    blurIn(T('每一次起飞', 'Every take-off'), PW / 2, 880, LG === 'en' ? 92 : 104, SC.T_STAMP + 0.8, t, { w: 900 });
    blurIn(T('都值得被记住', 'deserves to be remembered'), PW / 2, 1010, LG === 'en' ? 72 : 104, SC.T_STAMP + 1.05, t, { w: 900, color: P.gold, max: PW - 100 });
    bloom(0.45);
  }
  function act4b(t) {
    backdrop(t); const u = t - SC.T_ZOOM;
    if (VO) { /* narrated cut: no numbers again — the line stays, over the traveller's routes glowing on the globe */
      globe(t, PW / 2, 1010, 390 + 14 * eo(u / 4), GC.lam - 10 + u * 6, GC.phi, { t0: -99, step: 0, a: eo(u / 0.6), pulse: true });
      text(T('每一次起飞', 'Every take-off'), PW / 2, 360, LG === 'en' ? 84 : 96, { w: 900, a: eo(u / 0.5) }); text(T('都值得被记住', 'deserves to be remembered'), PW / 2, 480, LG === 'en' ? 64 : 96, { w: 900, color: P.gold, a: eo((u - 0.15) / 0.5), max: PW - 100 });
      bloom(0.65); return; }
    globe(t, PW / 2, 760, 330, GC.lam - 10 + u * 6, GC.phi, { t0: -99, step: 0, a: eo(u / 0.6), pulse: true });
    decodeIn(T('这些年，你一共', 'Over the years'), PW / 2, 330, 40, SC.T_ZOOM - 0.1, t, { w: 600, color: P.sub, dur: 0.5 });
    const st = [[F0.n, T('次起飞', 'take-offs')], [Math.round(F0.km), 'km'], [F0.cc, T('个国家地区', 'countries & regions')], [Math.round(F0.min / 60), T('小时在空中', 'hours in the air')]];
    st.forEach(([n, l], i) => { const s0 = SC.T_ZOOM + 0.4 + i * 0.3, k = expo(cl((t - s0) / 1.1)), a = eo(cl((t - s0) / 0.3)), cx = 300 + (i % 2) * 480, cy = 1260 + Math.floor(i / 2) * 210; if (a <= 0) return;
      g.save(); g.globalAlpha = a; g.strokeStyle = rgba(P.ac, 0.5); g.lineWidth = 1.5; rr(g, cx - 220, cy - 120, 440, 180, 12); g.stroke(); g.fillStyle = rgba(P.ac, 0.06); g.fill(); g.restore();
      text(fmt(n * k), cx - 190, cy, 76, { align: 'left', w: 800, a, fam: 'SM' }); text(l, cx - 188, cy + 42, 26, { align: 'left', w: 400, color: P.sub, a, max: 380 }); });
    bloom(0.6);
  }

  /* ---------- Act 5: start ---------- */
  function act5(t) {
    backdrop(t); const t0 = SC.T_CARD, dy = NOQR ? 190 : 0; /* NOQR: the end card without the code, set a little lower */
    g.save(); g.translate(PW / 2, 470 + dy); g.strokeStyle = g.fillStyle = goldFill(-200, 200); const len = 2400; g.setLineDash([len * eio((t - t0) / 1.2), len]); emblem(g, 0.6, false); g.setLineDash([]); g.restore();
    const ta = eo((t - t0 - 0.3) / 0.5); g.save(); g.globalAlpha = ta; g.fillStyle = goldFill(760, 900); g.font = `900 ${LG === 'en' ? 110 : 140}px ${SERIF}`; g.textAlign = 'center'; spaced(g, T('航迹手帐', 'SKY PASSPORT'), PW / 2, 880 + dy, LG === 'en' ? 8 : 26); g.restore();
    blurIn(T('把你的天空，装进一本护照', 'Every flight. One passport.'), PW / 2, 980 + dy, 46, t0 + 0.6, t, { w: 600 });
    // QR in a HUD frame with a scan line
    const qa = NOQR ? 0 : eo(cl((t - t0 - 1.0) / 0.4)), qx = PW / 2 - 190, qy = 1080, qs = 380;
    if (qa > 0) { g.save(); g.globalAlpha = qa; g.fillStyle = '#fff'; rr(g, qx, qy, qs, qs, 22); g.fill(); g.imageSmoothingEnabled = false; g.drawImage(QR, qx + 26, qy + 26, qs - 52, qs - 52); g.imageSmoothingEnabled = true;
      g.strokeStyle = rgba(P.ac, 0.9); g.lineWidth = 3; const L = 40, e = 18; [[qx - e, qy - e, 1, 1], [qx + qs + e, qy - e, -1, 1], [qx - e, qy + qs + e, 1, -1], [qx + qs + e, qy + qs + e, -1, -1]].forEach(([x, y, sx, sy]) => { g.beginPath(); g.moveTo(x + sx * L, y); g.lineTo(x, y); g.lineTo(x, y + sy * L); g.stroke(); });
      const sy = qy + ((t - t0) * 0.6 % 1) * qs; g.fillStyle = rgba(P.ac, 0.5); g.fillRect(qx - 10, sy, qs + 20, 3); g.restore(); }
    if (!NOURL) decodeIn(URL_TEXT(), PW / 2, NOQR ? 1330 : 1560, 38, t0 + 1.4, t, { fam: 'SM', w: 700, color: rgba(P.ac, 0.95), dur: 0.6 });
    blurIn(NOURL ? T('免费 · 隐私 · 一分钟出片', 'Free · private · made in your browser') : T('免费 · 隐私 · 一分钟出片 · 微信小程序同名', 'Free · private · made in your browser'), PW / 2, NOURL ? 1320 : NOQR ? 1400 : 1630, 30, t0 + 1.8, t, { w: 400, color: P.sub, max: PW - 140 });
    bloom(0.4);
  }
  const URL_TEXT = () => (LG === 'en' ? 'sky-passport.vercel.app' : 'passport.nybbq.art');

  /* ================= kinetic cut (~24 s): boarding passes at speed, no explaining =================
     Picture time runs through four pieces of the film's own timeline, cut on bar lines so the music and its hits stay on the grid:
     bars 0–3 passes (new) · 6–11 globe + slammed numbers, dead stop, title hit, two bars of montage (new) · 14–15 stamp · 17–end card. */
  const KSEG = () => KIN === 'B' ? [[0, 3 * BAR], [6 * BAR, 9 * BAR], [17 * BAR, SC.T_END]] : KIN === 'C' ? [[0, 3 * BAR], [5 * BAR, 9 * BAR], [17 * BAR, SC.T_END]] : [[0, 3 * BAR], [6 * BAR, 11 * BAR], [14 * BAR, 15 * BAR], [17 * BAR, SC.T_END]];
  const kinLen = () => KSEG().reduce((a, [x, y]) => a + y - x, 0);
  function kinMap(tau) { let acc = 0; for (const [a, b] of KSEG()) { if (tau < acc + b - a) return [a + tau - acc, a]; acc += b - a; } const L = KSEG(); return [L[L.length - 1][1] - 1e-3, L[L.length - 1][0]]; }
  function big(s, x, y, size, { fill, stroke, a = 1, align = 'center', fam = 'SM', w = 700, lw = 3 } = {}) { if (a <= 0) return; g.save(); g.globalAlpha *= a; g.font = font(w, size, fam); g.textAlign = align; if (stroke) { g.lineWidth = lw; g.strokeStyle = stroke; g.strokeText(s, x, y); } if (fill) { g.fillStyle = fill; g.fillText(s, x, y); } g.restore(); }
  function flash(a, col = '255,246,225') { if (a <= 0.01) return; g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'lighter'; g.fillStyle = `rgba(${col},${a})`; g.fillRect(0, 0, PW, PH); g.restore(); }
  function streaks(t, n, a) { g.save(); g.globalCompositeOperation = 'lighter'; for (let i = 0; i < n; i++) { const y = hash(i * 9.1) * PH, sp = 2600 + 2600 * hash(i * 3.7), x = ((t * sp + hash(i * 5.3) * 3000) % (PW + 900)) - 450, w = 160 + 420 * hash(i * 2.2); const lg = g.createLinearGradient(x, 0, x + w, 0); lg.addColorStop(0, rgba(P.ac, 0)); lg.addColorStop(1, rgba(P.ac, 0.5 * a)); g.fillStyle = lg; g.fillRect(x, y, w, 2); } g.restore(); }
  const KSLOT = () => { const o = []; let t = 2 * BEAT; while (t < 6 * BEAT - 1e-6) { o.push(t); t += BEAT / 2; } while (t < 8 * BEAT - 1e-6) { o.push(t); t += BEAT / 4; } return o; }; /* 8ths, then 16ths: the passes speed up */
  function kinA(t) {
    backdrop(t, 0.25); const f0 = FL[0], cy = 900, T2 = 8 * BEAT, slots = KSLOT();
    if (t < 2 * BEAT) { /* one pass slams in */
      const k = spring(t - 0.12, 0.5, 0.25), a = cl((t - 0.1) / 0.08);
      big(String(f0.y), PW / 2, 1010, 430, { stroke: rgba(P.ac, 0.22 * a), lw: 4 }); big('BOARDING PASS', PW / 2, 420, 34, { fill: rgba(P.ac, 0.9 * a) }); big('NO. 001', PW / 2, 1420, 54, { fill: P.ink, a });
      pass(f0, PW / 2, cy, 2.4 - 1.25 * k, -0.05 + 0.3 * (1 - k), a, 0); flash(0.55 * Math.exp(-Math.max(0, t - 0.12) * 14));
    } else if (t < T2) { /* rapid fire: a pass per slot, its route in giant type behind */
      let n = 0; for (let i = 0; i < slots.length; i++) if (t >= slots[i]) n = i; const ts = slots[n], len = (slots[n + 1] || T2) - ts, u = (t - ts) / len, idx = Math.min(FL.length - 1, 1 + Math.floor(n * (FL.length - 2) / slots.length)), f = FL[idx], dir = n % 2 ? 1 : -1;
      streaks(t, 26, 0.7); const rtxt = `${f.f} ${f.to}`; big(rtxt, PW / 2 + dir * (200 - 500 * u), 560 + 760 * (n % 2), 330, { stroke: rgba(P.ac, 0.3), lw: 4 }); big(rtxt, PW / 2 - dir * (240 - 420 * u), 1320 - 760 * (n % 2), 330, { stroke: 'rgba(255,79,154,.22)', lw: 3 });
      if (n > 0) { const pf = FL[Math.min(FL.length - 1, 1 + Math.floor((n - 1) * (FL.length - 2) / slots.length))]; pass(pf, PW / 2 - dir * (-1) * (300 + 1500 * eo(u * 1.6)), cy + 80 * dir, 1.5, 0.14 * dir, 1 - cl(u * 2.2), n - 1); }
      const k = eo(cl(u / 0.35)); pass(f, PW / 2 + dir * 900 * (1 - k), cy - 30 * dir, 1.95 - 0.35 * k, -0.13 * dir * (1 - 0.5 * k), 1, n);
      big(`NO. ${String(idx + 1).padStart(3, '0')} / ${String(FL.length).padStart(3, '0')}`, PW / 2, 300, 44, { fill: P.ink }); big(String(f.y), PW / 2, 1640, 120, { fill: P.gold, w: 700 });
      flash(0.38 * Math.exp(-(t - ts) * 26)); g.save(); g.fillStyle = rgba(P.ac, 0.9); g.fillRect(80, 1720, (PW - 160) * (t - 2 * BEAT) / (T2 - 2 * BEAT), 4); g.restore();
    } else { /* tunnel: every pass rushes to the vanishing point and becomes one line of light */
      const u = (t - T2) / (T_F0 - T2), N = Math.min(FL.length, 44); streaks(t, 40, 1 - u);
      for (let k = N - 1; k >= 0; k--) { const z = ((k / N + u * 1.5) % 1), d = 1 / (0.12 + z * 3.2), ang = k * 2.4 + t * 1.3, rad = 520 * d * (1 - eo((u - 0.55) / 0.4)), sc = 0.42 * d * (1 - eio((u - 0.5) / 0.45)); if (sc < 0.02) continue;
        pass(FL[k], PW / 2 + Math.cos(ang) * rad, cy + Math.sin(ang) * rad * 1.25, sc, ang * 0.3, cl(z * 6) * cl((1 - z) * 3), k); }
      const lk = eo((u - 0.55) / 0.4); if (lk > 0) { g.save(); g.globalCompositeOperation = 'lighter'; const w = PW * (0.1 + 1.2 * lk), lg = g.createLinearGradient(PW / 2 - w / 2, 0, PW / 2 + w / 2, 0); lg.addColorStop(0, 'rgba(255,240,220,0)'); lg.addColorStop(0.5, `rgba(255,244,226,${lk})`); lg.addColorStop(1, 'rgba(255,240,220,0)'); g.fillStyle = lg; g.fillRect(PW / 2 - w / 2, cy - 3 - 5 * lk, w, 6 + 10 * lk);
        const rg = g.createRadialGradient(PW / 2, cy, 0, PW / 2, cy, 60 + 420 * lk); rg.addColorStop(0, `rgba(255,240,220,${0.8 * lk})`); rg.addColorStop(1, 'rgba(255,240,220,0)'); g.fillStyle = rg; g.fillRect(0, 0, PW, PH); g.restore(); }
      big(`${String(FL.length).padStart(3, '0')} FLIGHTS`, PW / 2, 300, 44, { fill: P.ink, a: 1 - cl((u - 0.6) / 0.2) });
    }
    bloom(0.85);
  }
  function kinNums(t) { /* over the globe: one giant number per beat */
    const t0 = 6 * BAR, items = [[String(F0.n), T('次起飞', 'FLIGHTS')], [fmt(F0.km), 'KM'], [String(F0.cc), T('个国家地区', 'COUNTRIES')], [(F0.km / 40075).toFixed(2), T('圈 · 绕地球', '× ROUND THE EARTH')]];
    const n = Math.min(3, Math.floor((t - t0) / BEAT)), u = (t - t0 - n * BEAT) / BEAT; if (n < 0) return; const [num, lab] = items[n], k = spring(u * BEAT, 0.32, 0.3), left = n % 2 === 0, x = left ? 90 : PW - 90, al = left ? 'left' : 'right', y = 1560;
    let sz = 300; g.save(); g.font = font(700, sz, 'SM'); while (g.measureText(num).width > PW - 160 && sz > 120) { sz -= 10; g.font = font(700, sz, 'SM'); } g.restore(); const s2 = sz * (1.5 - 0.5 * k), a = cl(u * 12) * (1 - cl((u - 0.82) / 0.18));
    big(num, x + (left ? -1 : 1) * 14 * (1 - k), y, s2, { fill: 'rgba(255,79,154,.5)', a, align: al }); big(num, x, y, s2, { fill: P.ink, a, align: al }); big(lab, x, y + 90, 46, { fill: P.gold, a, align: al, fam: undefined, w: 700 });
    flash(0.22 * Math.exp(-u * BEAT * 20));
  }
  function kinMont(t, tbO, mO) { /* two bars: the film, then the poster — tilted cards at speed, a punch on every beat (or one card from tbO) */
    backdrop(t); const t0 = 9 * BAR, m = tbO != null ? mO : (t < t0 + BAR ? 0 : 1), tb = tbO != null ? tbO : t0 + m * BAR, lt = t - tb, bu = (lt % BEAT) / BEAT, punch = 1 + 0.035 * Math.exp(-bu * BEAT * 9), k = spring(lt, 0.4, 0.22), dir = m ? 1 : -1;
    streaks(t, 22, 0.6); const word = m ? T('长图', 'POSTER') : T('影片', 'FILM'), en = m ? 'LONG POSTER' : 'PASSPORT FILM';
    big(word, PW / 2 - dir * (60 - 180 * lt / BAR), 760, LG === 'en' ? 300 : 520, { stroke: rgba(P.ac, 0.22), lw: 5, fam: undefined, w: 900 });
    g.save(); g.translate(PW / 2 + dir * 700 * (1 - k), 980); g.rotate(-0.07 * dir * (2 - k)); g.scale(punch, punch); const w = 600, h = w * 16 / 9;
    g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 60; g.shadowOffsetY = 30; g.fillStyle = '#04101f'; rr(g, -w / 2 - 14, -h / 2 - 14, w + 28, h + 28, 34); g.fill(); g.shadowColor = 'transparent'; g.strokeStyle = rgba(P.ac, 0.8); g.lineWidth = 2; g.stroke();
    g.save(); rr(g, -w / 2, -h / 2, w, h, 22); g.clip(); if (m === 0) g.drawImage(shot(T_F0 + 1.5 + lt * (tbO != null ? 5 : 9)), -w / 2, -h / 2, w, h); else { const sc = w / LONG.width, trv = LONG.height * sc - h; g.drawImage(LONG, -w / 2, -h / 2 - trv * eio(cl(lt / (BAR * 0.95))), w, LONG.height * sc); } g.restore(); g.restore();
    big(`0${m + 1}`, 90, 330, 120, { fill: P.gold, align: 'left' }); big(en, 90, 400, 34, { fill: rgba(P.ac, 0.95), align: 'left' });
    text(m ? T('一张图，晒出这些年', 'One image, all those years') : T('一分钟，生成你的飞行护照', 'Your passport film, in a minute'), PW / 2, 1690, 50, { w: 800, a: cl(lt / 0.2), max: PW - 120 });
    flash(0.3 * Math.exp(-lt * 18)); bloom(0.5); glitch(t, tb, 0.14, 1);
  }
  /* ----- B: one boarding pass — turn it in the light, fly into its barcode, come out among the routes ----- */
  function kinB1(t) {
    backdrop(t, 0.6 * (1 - cl((t - 3) / 2))); const f0 = FL[0], z0 = 3.0, zk = Math.max(0, t - z0), sc = 1.2 * Math.exp(zk * 1.3), k = eio(zk / 1.3), bx = 215, fade = 1 - cl((t - 5.0) / 0.6);
    if (fade > 0) { pass(f0, PW / 2 - bx * sc * k, 900, sc, (-0.1 + 0.035 * t) * (1 - k), cl(t / 0.8) * fade, 0);
      if (t < z0 + 0.3) { const u = ((t - 0.6) % 2.2) / 1.1; if (u > 0 && u < 1) { g.save(); g.translate(PW / 2, 900); g.rotate(-0.1 + 0.035 * t); g.scale(1.2, 1.2); rr(g, -310, -125, 620, 250, 18); g.clip(); g.globalCompositeOperation = 'lighter'; const x = -420 + 840 * u, lg = g.createLinearGradient(x - 70, 0, x + 70, 0); lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.5, 'rgba(255,250,235,.55)'); lg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = lg; g.fillRect(-320, -130, 640, 260); g.restore(); } } }
    big(`${f0.y} · ${f0.f} → ${f0.to}`, PW / 2, 430, 36, { fill: rgba(P.ac, 0.9), a: win(t, 0.5, 3.2) }); blurIn(T('一切，从一张登机牌开始', 'It all starts with one boarding pass'), PW / 2, 1420, 52, 0.9, t, { w: 600, out: 3.3, max: PW - 140 });
    const lk = cl((t - 4.2) / 1.2); if (lk > 0) { g.save(); g.globalCompositeOperation = 'lighter'; const end = eio((t - 5.6) / 0.7); for (let i = 0; i < 46; i++) { const x = PW * (i + 0.5) / 46 + (hash(i * 3.1) - 0.5) * 30, w = 2 + 10 * hash(i * 7.7), h = PH * (1 - end) + 8 * end, sp = (t * (300 + 900 * hash(i))) % 60; g.fillStyle = rgba(i % 5 ? P.ac : [255, 226, 170], (0.25 + 0.5 * hash(i * 1.3)) * lk); g.fillRect(x, 900 - h / 2 + (1 - end) * (sp - 30), w, h); } g.restore(); flash(0.6 * eo((t - 6.0) / 0.4)); }
    bloom(0.8);
  }
  function kinB2(t) { act2b(t); const t0 = 6 * BAR; for (let k = 0; k < 18; k++) { const a = k * 0.349 + t * 1.5, sn = Math.sin(a); if (sn < -0.1) continue; pass(FL[k % FL.length], PW / 2 + Math.cos(a) * 520, 900 + sn * 170 - 60 * Math.cos(a), 0.16 + 0.06 * sn, a * 0.2, cl((t - t0) / 0.4) * (0.5 + 0.5 * sn), k); } }
  /* ----- C: the departures board — your flights flip in, then the whole board spells the totals ----- */
  function kinBoard(t, k2 = 0) {
    backdrop(t); const cols = 14, rows = 12, cw = 66, ch = 92, gap = 6, x0 = (PW - cols * (cw + gap) + gap) / 2, y0 = 420, GL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', T2 = 8 * BEAT;
    const msg = { 3: `${F0.n} FLIGHTS`, 5: `${fmt(F0.km)} KM`, 7: `${F0.cc} COUNTRIES`, 9: `${(F0.km / 40075).toFixed(2)} LAPS` };
    big(T('出发 DEPARTURES', 'DEPARTURES'), x0, 330, 44, { fill: P.gold, align: 'left', fam: undefined, w: 800 }); big(`${D2(Math.floor(6 + t * 3) % 24)}:${D2(Math.floor(t * 47) % 60)}`, PW - x0, 330, 44, { fill: P.ink, align: 'right' });
    g.save(); g.translate(PW / 2, 900); g.scale(1 - 0.97 * k2, 1 - 0.97 * k2); g.translate(-PW / 2, -900); g.globalAlpha = 1 - k2 * 0.5; g.font = font(700, 58, 'SM'); g.textAlign = 'center';
    for (let r = 0; r < rows; r++) { const f = FL[Math.min(FL.length - 1, Math.floor(r * FL.length / rows))], a = `${(f.fn || '').slice(0, 6).padEnd(7)}${f.f} ${f.to}`.padEnd(cols), m = msg[r] ? msg[r].padStart(Math.floor((cols + msg[r].length) / 2)).padEnd(cols) : ''.padEnd(cols), tr = 0.25 + r * 0.3;
      for (let c = 0; c < cols; c++) { const x = x0 + c * (cw + gap), y = y0 + r * (ch + gap); let chr = ' ', gold = false;
        if (t >= T2) { const st = T2 + 0.7 + c * 0.035 + r * 0.02; if (t >= st) { chr = m[c]; gold = true; } else chr = GL[Math.floor(hash(r * 31 + c * 7 + Math.floor(t * 24)) * GL.length)]; }
        else if (t >= tr) { const st = tr + 0.22 + c * 0.03; chr = t >= st ? a[c] : GL[Math.floor(hash(r * 31 + c * 7 + Math.floor(t * 22)) * GL.length)]; }
        const gr = g.createLinearGradient(0, y, 0, y + ch); gr.addColorStop(0, '#16305c'); gr.addColorStop(0.5, '#11244a'); gr.addColorStop(0.5, '#0b1a38'); gr.addColorStop(1, '#0a1630'); g.fillStyle = gr; rr(g, x, y, cw, ch, 8); g.fill();
        if (chr !== ' ') { g.fillStyle = gold ? P.gold : (c >= 7 ? rgba(P.ac, 0.95) : '#fff6e2'); g.fillText(chr, x + cw / 2, y + ch * 0.72); } g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(x, y + ch / 2 - 1, cw, 2); } }
    g.restore(); if (t >= T2) flash(0.3 * Math.exp(-(t - T2) * 14) + 0.35 * Math.exp(-Math.abs(t - T2 - 1.25) * 16)); bloom(0.45);
  }
  /* B: the hit is the stamp — the passport page slams in at the stamp's contact frame, then the line; the name waits for the end card */
  function kinStampB(t) { const hit = Y[2].t + HERO, h = t - hit, k = eio(cl((h - 1.15) / 0.6)), sl = 1 + 0.1 * Math.exp(-h * 13) * Math.cos(h * 27), sc = (1 - 0.34 * k) * sl, w = 700, hh = w * 16 / 9, sx = 9 * Math.exp(-h * 9) * Math.sin(h * 70);
    backdrop(t); streaks(t, 14, 0.5 * Math.exp(-h * 3));
    g.save(); g.translate(PW / 2 + sx, 930 - 250 * k); g.scale(sc, sc); g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 60; g.shadowOffsetY = 30; g.fillStyle = '#04101f'; rr(g, -w / 2 - 12, -hh / 2 - 12, w + 24, hh + 24, 30); g.fill(); g.shadowColor = 'transparent'; g.strokeStyle = rgba(P.ac, 0.8); g.lineWidth = 2; g.stroke();
    g.save(); rr(g, -w / 2, -hh / 2, w, hh, 20); g.clip(); g.drawImage(shot(S.T_STAMP + 0.16 + h * 0.8), -w / 2, -hh / 2, w, hh); g.restore(); g.restore();
    blurIn(T('每一次起飞', 'Every take-off'), PW / 2, 1500, LG === 'en' ? 76 : 88, hit + 1.25, t, { w: 900 }); blurIn(T('都值得被记住', 'deserves to be remembered'), PW / 2, 1610, LG === 'en' ? 60 : 88, hit + 1.45, t, { w: 900, color: P.gold, max: PW - 100 });
    flash(0.6 * Math.exp(-h * 10)); bloom(0.5 + 0.4 * Math.exp(-h * 4)); }
  function kinPassC(t, k2 = 0) {
    const t0 = 5 * BAR, lt = t - t0, k = spring(lt - 0.15, 0.55, 0.2), tear = Math.max(0, t - (t0 + 5 * BEAT)), tk = eio(cl(tear / 0.9)), w = 900, h = 430, px = 250;
    if (lt < 0.5) { kinBoard(T_F0 - 0.01, 0); g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = `rgba(2,6,16,${cl(lt / 0.3)})`; g.fillRect(0, 0, PW, PH); g.restore(); } else backdrop(t, 0.3);
    streaks(t, 16, 0.4); big('BOARDING PASS', PW / 2, 420, 36, { fill: rgba(P.ac, 0.9), a: cl((lt - 0.3) / 0.3) * (1 - k2) });
    g.save(); g.translate(PW / 2, 900); g.scale((1.6 - 0.6 * k) * (1 - 0.97 * k2), (1.6 - 0.6 * k) * (1 - 0.97 * k2)); g.rotate(-0.04 - 0.25 * (1 - k)); g.globalAlpha = cl(lt / 0.12) * (1 - 0.4 * k2);
    const body = (x0, x1, draw) => { g.save(); g.beginPath(); g.rect(x0, -h / 2 - 40, x1 - x0, h + 80); g.clip(); g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 40; g.shadowOffsetY = 18; rr(g, -w / 2, -h / 2, w, h, 26); const pg = g.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2); pg.addColorStop(0, '#fbf6ef'); pg.addColorStop(1, '#e9e1d6'); g.fillStyle = pg; g.fill(); g.shadowColor = 'transparent'; g.fillStyle = '#8e1d38'; g.fillRect(-w / 2, -h / 2, w, 64); draw(); g.restore(); };
    body(-w / 2, px, () => { g.fillStyle = '#f6dca6'; g.font = font(700, 26, 'SM'); g.textAlign = 'left'; g.fillText('SKY PASSPORT · BOARDING PASS', -w / 2 + 34, -h / 2 + 42);
      g.fillStyle = '#8a7480'; g.font = font(400, 20, 'SM'); g.fillText(T('出发 FROM', 'FROM'), -w / 2 + 36, -78); g.fillText(T('到达 TO', 'TO'), -w / 2 + 330, -78); g.fillStyle = '#1d1420'; g.font = font(800, LG === 'en' ? 46 : 58); g.fillText(T('这些年', 'ALL THOSE YEARS'), -w / 2 + 34, -12); g.fillStyle = '#8e1d38'; g.fillText('→', -w / 2 + 250, -12); g.fillStyle = '#1d1420'; g.fillText(T('航迹手帐', 'SKY PASSPORT'), -w / 2 + 330, -12);
      [[T('旅客', 'PASSENGER'), (S.P && S.P.latin) || 'TRAVELLER'], [T('航班', 'FLIGHTS'), String(F0.n)], [T('座位', 'SEAT'), '1A']].forEach(([a, b], i) => { const x = -w / 2 + 36 + [0, 330, 470][i]; g.fillStyle = '#8a7480'; g.font = font(400, 18, 'SM'); g.fillText(a, x, 70); g.fillStyle = '#1d1420'; g.font = font(700, 30, 'SM'); g.fillText(b, x, 110); }); });
    g.save(); g.setLineDash([8, 8]); g.strokeStyle = 'rgba(40,20,30,.4)'; g.lineWidth = 2; g.globalAlpha *= 1 - tk; g.beginPath(); g.moveTo(px, -h / 2 + 70); g.lineTo(px, h / 2 - 10); g.stroke(); g.restore();
    g.save(); g.translate(px + 60 * tk + 700 * tk * tk, 900 * tk * tk); g.rotate(0.9 * tk); g.translate(-px, 0); g.globalAlpha *= 1 - cl((tk - 0.7) / 0.3);
    body(px, w / 2, () => { g.fillStyle = '#1d1420'; let x = px + 40; for (let i = 0; x < w / 2 - 36; i++) { const bw = 3 + 7 * hash(i * 2.7); g.fillRect(x, -60, bw, 170); x += bw + 3 + 5 * hash(i * 5.1); } }); g.restore(); g.restore();
    flash(0.5 * Math.exp(-Math.max(0, lt - 0.15) * 14) + 0.25 * Math.exp(-tear * 16) * (tear > 0 ? 1 : 0)); bloom(0.6);
  }
  function kinFrame(i) {
    const tau = i / FPS, [t, seg0] = kinMap(tau), hit = Y[2].t + HERO;
    if (KIN === 'B') { if (t < T_F0) kinB1(t); else if (t < Y[2].t) kinB2(t); else if (t < Y[3].t) { if (t >= hit) kinStampB(t); else act3a(t); if (t < hit) { const k = eio(cl((t - Y[2].t) / (hit - Y[2].t))); for (let q = 0; q < 18; q++) { const a = q * 0.349 + t * (1.5 + 5 * k), r = 1 - k; pass(FL[q % FL.length], PW / 2 + Math.cos(a) * 520 * r, 900 + Math.sin(a) * 170 * r, 0.2 * (1 - 0.9 * k), a * 0.2, 1 - k * 0.7, q); } } } else if (t < SC.T_ZOOM) act4a(t); else act5(t); if (tau > 0.2) glitch(t, seg0, 0.12, 0.9); g.setTransform(1, 0, 0, 1, 0, 0); hud(t); finish(i, tau); return C; }
    if (KIN === 'C') { if (t < T_F0) kinBoard(t); else if (t < hit) { const k = eio(cl((t - (hit - BEAT)) / BEAT)); kinPassC(t, k); const lp = eo(k); g.save(); g.globalCompositeOperation = 'lighter'; const lg = g.createRadialGradient(PW / 2, 900, 0, PW / 2, 900, 40 + 260 * lp); lg.addColorStop(0, `rgba(255,240,220,${0.9 * lp})`); lg.addColorStop(1, 'rgba(255,240,220,0)'); g.fillStyle = lg; g.fillRect(0, 0, PW, PH); g.restore(); }
      else if (t < Y[3].t) kinMont(t, hit, 0); else act5(t); if (tau > 0.2 && seg0 > 16) glitch(t, seg0, 0.12, 0.9); g.setTransform(1, 0, 0, 1, 0, 0); hud(t); finish(i, tau); return C; }
    if (t < T_F0) kinA(t); else if (t < Y[2].t) { act2b(t); kinNums(t); } else if (t < Y[3].t) act3a(t); else if (t < 11 * BAR + 1e-6 && t < 14 * BAR - 1e-6 && t < SC.T_FE - 3 * BAR) kinMont(t); else if (t < SC.T_ZOOM) act4a(t); else act5(t);
    if (tau > 0.2) glitch(t, seg0, 0.12, 0.9);
    g.setTransform(1, 0, 0, 1, 0, 0); hud(t); finish(i, tau); return C;
  }
  function frame(i) {
    if (KIN) return kinFrame(i);
    const t = i / FPS;
    if (t < T_F0) act1(t); else if (t < Y[1].t) act2a(t); else if (t < Y[2].t) act2b(t); else if (t < Y[3].t) act3a(t); else if (t < SC.T_FE) act3b(t);
    else if (t < SC.T_ZOOM) act4a(t); else if (t < SC.T_CARD) act4b(t); else act5(t);
    for (const e of [T_F0, Y[1].t, SC.T_ZOOM, SC.T_CARD]) glitch(t, e, 0.12, 0.8);
    g.setTransform(1, 0, 0, 1, 0, 0); subtitle(t); hud(t); finish(i, t); return C;
  }

  /* ---------- sound: every cue from the picture's timing (CC0 recordings; no synthesised effects) ---------- */
  const SPR_MOVE = 0.12, SPR_LAND = 0.42; // NB: not "LAND" — that name is the engine's land geometry
  function cues() {
    const C2 = [], card = (t0, k = 0) => C2.push(['card' + (k % 2), t0 + SPR_MOVE, 0.3, 0.4 + 0.2 * (k % 3) / 2, 0.1, 1, 3000], ['place' + (k % 2), t0 + SPR_LAND, 0.28, 0.5, 0.1, 1, 3000]);
    // Act 1: the first pass settles, then passes fly past the camera (one swish per few, never stacked)
    if (KIN === 'B') { C2.push(['paper', 0.5, 0.24, 0.5, 0.15, 1, 4000], ['cov_sw', 3.6, 0.3, 0.5, 0.15, 1, 1500], ['swish', 4.6, 0.24, 0.4, 0.1, 1, 3000], ['swish', 5.3, 0.24, 0.6, 0.1, 1.1, 3000], ['glitchA', 6 * BAR, 0.4, 0.5, 0.05, 1, 5000]); }
    else if (KIN === 'C') { for (let r = 0; r < 12; r++) C2.push(['tick' + (r % 2), 0.25 + r * 0.3 + 0.05, 0.2, 0.3 + 0.4 * hash(r), 0.08, 1, 4000], ['card' + (r % 2), 0.25 + r * 0.3 + 0.24, 0.2, 0.5, 0.06, 1, 3000]); C2.push(['data', 8 * BEAT + 0.75, 0.14, 0.5, 0.1, 1, 2000], ['place1', 8 * BEAT + 1.25, 0.4, 0.5, 0.12, 1, 3000], ['place0', 5 * BAR + 0.17, 0.42, 0.5, 0.12, 1, 3000], ['paper', 5 * BAR + 5 * BEAT + 0.05, 0.36, 0.6, 0.12, 1, 4000], ['swish', 5 * BAR + 5 * BEAT + 0.35, 0.26, 0.7, 0.1, 1, 3000]); }
    else if (KIN) { C2.push(['place0', 0.12 + 0.02, 0.4, 0.5, 0.12, 1, 3000], ['paper', 0.2, 0.2, 0.5, 0.1, 1, 4000]); KSLOT().forEach((ts, n) => C2.push(['card' + (n % 2), ts + 0.03, 0.3, n % 2 ? 0.72 : 0.28, 0.06, [1, 1.06, 0.94, 1.12][n % 4], 3000]));
      C2.push(['cov_sw', 8 * BEAT + 0.5, 0.3, 0.5, 0.15, 1, 1500], ['swish', 8 * BEAT + 0.2, 0.22, 0.4, 0.1, 1, 3000], ['swish', 8 * BEAT + 0.8, 0.22, 0.6, 0.1, 1.1, 3000]);
      for (let n = 0; n < 4; n++) C2.push(['place' + (n % 2), 6 * BAR + n * BEAT + 0.02, 0.34, n % 2 ? 0.7 : 0.3, 0.12, 1, 3000]); }
    const N = KIN ? 0 : Math.min(FL.length, 42); if (!KIN) C2.push(['paper', 0.55, 0.22, 0.5, 0.15, 1, 4000]); let last = -9; for (let k = 1; k < N; k++) { const st = 1.9 + 2.0 * Math.pow(k / N, 0.75), tz = st + 1.5 * 0.9; /* closest to the camera = fastest on screen */ if (tz - last > 0.22) { C2.push(['swish', tz, 0.18, 0.2 + 0.6 * hash(k), 0.1, [1, 1.08, 0.94][k % 3], 3000]); last = tz; } }
    if (!KIN) { C2.push(['cov_sw', 3.05, 0.2, 0.45, 0.12, 1, 1500]); /* the first wave of passes reaches the camera */ C2.push(['place1', 4.3 + 0.35, 0.3, 0.5, 0.12, 1, 3000]); }
    // Act 2: the scan (data texture + blips per log line), rows rise, the globe draws its routes
    const t0 = Y[0].t; C2.push(['data', t0 + 0.3 + 0.75, 0.12, 0.5, 0.1, 1, 2000], ['blip', t0 - 0.1, 0.3, 0.5, 0.05, 1, 3000]);
    for (let i = 0; i < 4; i++) C2.push(['tone', t0 + 0.4 + i * 0.5, 0.16, 0.35 + 0.1 * i, 0.08, [1, 1.122, 1.26, 1.5][i], 1500]);
    C2.push(['cov_sw', Y[0].end - 0.5, 0.26, 0.5, 0.15, 1, 1500], ['glitchA', Y[1].t, 0.4, 0.5, 0.05, 1, 5000], ['glitchB', Y[1].t + 0.03, 0.35, 0.55, 0.05, 1, 5000]);
    if (KIN !== 'C') for (let i = 0; i < FL.length; i += 6) C2.push(['tick' + (i / 6 % 2), Y[1].t + 0.2 + i * 2.9 / FL.length, 0.14, 0.3 + 0.4 * hash(i), 0.1, 1, 4000]);
    // Act 3: the hero after a dead stop, the light sweep, five modules on the beat
    const hit = Y[2].t + HERO; C2.push(['rev_zoom', hit, 0.16, 0.5, 0.2], ['hit2', hit, 0.5, 0.5, 0.12], ['boom2', hit, 0.34, 0.5, 0], ['sparkle2', hit + 1.7, 0.16, 0.5, 0.25, 1, 2500], ['blip2', hit + 0.25, 0.3, 0.5, 0.05, 1, 5000]);
    for (let k = 3; k < 8; k++) { const ts = Y[k].t; C2.push(['glitchA', ts, 0.35, 0.5, 0.05, 1, 5000], ['blip2', ts + 0.05, 0.25, 0.5, 0.05, 1, 5000], ['card' + (k % 2), ts + 0.05 + SPR_MOVE, 0.24, 0.5, 0.1, 1, 3000]); }
    for (let i = 0; i < 5; i++) C2.push(['ding', Y[5].t + 0.35 + i * 0.24 + 0.1, 0.16, 0.35 + 0.075 * i, 0.15, [1, 1.122, 1.26, 1.335, 1.498][i], 3500]);
    for (let i = 0; i < 6; i++) C2.push(['blip', Y[6].t + 0.2 + i * 0.12, 0.2, 0.3 + 0.08 * i, 0.05, 1, 3000]);
    C2.push(['print', Y[6].t + 1.35, 0.2, 0.5, 0.12, 1, 4000], ['place0', Y[7].t + 0.6 + 0.3, 0.3, 0.5, 0.1, 1, 3000]);
    // Act 4: the real stamp (hang → slam), the totals; Act 5: the end card
    card(SC.T_FE - 0.2, 0); const T2 = SC.T_STAMP + 0.16; C2.push(['rev_stamp', T2, 0.09, 0.5, 0.15], ['hit', T2, 0.5, 0.5, 0.1], ['boom', T2, 0.32, 0.5, 0], ['wood', T2, 0.42, 0.5, 0.08], ['paper', T2, 0.18, 0.5, 0.15]);
    C2.push(['rev_zoom', SC.T_ZOOM, 0.08, 0.5, 0.2], ['sparkle', SC.T_ZOOM + 0.25, 0.16, 0.5, 0.25, 1, 7000]); for (let i = 0; i < 4; i++) C2.push(['blip', SC.T_ZOOM + 0.4 + i * 0.3, 0.22, 0.3 + 0.13 * i, 0.05, 1, 3000]);
    C2.push(['swish', SC.T_CARD, 0.3, 0.5, 0.12, 1, 3000], ['chime', SC.T_CARD + 0.5, 0.2, 0.5, 0.25, 1, 2500]); card(SC.T_CARD + 1.0, 1); C2.push(['blip', SC.T_CARD + 1.4, 0.25, 0.5, 0.05, 1, 3000]);
    return C2;
  }
  async function decodeSprite(b64, map, bank) { const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0)), x = (await new OfflineAudioContext(1, 48000, 48000).decodeAudioData(bin.buffer)).getChannelData(0);
    let k = 0; for (let i = 1; i < 9600; i++) if (Math.abs(x[i]) > Math.abs(x[k])) k = i; const off = k - 4800; for (const [nm, [st, len, sy]] of Object.entries(map)) bank[nm] = { d: x.slice(st + off, st + off + len), s: sy }; }
  let BANK = null;
  const ALL_TEXT = () => [T('年，第一次一个人出远门后来，登机牌越攒越多最后都躺进了一张冷冰冰的表格把每一行，解码成一条航线读取表格识别机场时区换算国家地区解码完成次起飞个国家地区绕地球圈航迹手帐把你的航班记录，做成一本会动的护照', ''),
    MODS().flat().join(''), T('每一次起飞都值得被记住这些年，你一共小时在空中把你的天空，装进一本护照免费隐私一分钟出片微信小程序同名仅在本地记忆解码意义开始登机牌', 'MEMORY DECODE PASSPORT MEANING START'), URL_TEXT(), GLYPH_ZH, GLYPH_EN].join('');

  /* ---------- posters: drawn on the film canvas, then cut to each size (h = how much of the 1080-wide canvas is used) ---------- */
  function corners(h, m = 40) { g.save(); g.strokeStyle = rgba(P.ac, 0.55); g.lineWidth = 2; const L = 44; for (const [x, y, sx, sy] of [[m, m, 1, 1], [PW - m, m, -1, 1], [m, h - m, 1, -1], [PW - m, h - m, -1, -1]]) { g.beginPath(); g.moveTo(x + sx * L, y); g.lineTo(x, y); g.lineTo(x, y + sy * L); g.stroke(); } g.restore(); }
  function titleAt(y, size) { g.save(); g.fillStyle = goldFill(y - size, y + 10); g.font = `900 ${size}px ${SERIF}`; g.textAlign = 'center'; spaced(g, T('航迹手帐', 'SKY PASSPORT'), PW / 2, y, LG === 'en' ? size * 0.07 : size * 0.18); g.restore(); }
  function qrBlock(x, y, s) { g.save(); g.fillStyle = '#fff'; rr(g, x, y, s, s, s * 0.07); g.fill(); g.imageSmoothingEnabled = false; g.drawImage(QR, x + s * 0.07, y + s * 0.07, s * 0.86, s * 0.86); g.imageSmoothingEnabled = true; g.restore(); }
  const statLine = () => T(`${F0.n} 次起飞 · ${F0.cc} 个国家地区 · 绕地球 ${(F0.km / 40075).toFixed(2)} 圈`, `${F0.n} take-offs · ${F0.cc} countries · ${(F0.km / 40075).toFixed(2)}× around the Earth`);
  const POSTERS = {
    main: [1920, () => { backdrop(6); corners(1920); text('SKY PASSPORT // FLIGHT LOG', PW / 2, 150, 24, { fam: 'SM', color: rgba(P.ac, 0.85) }); titleAt(300, LG === 'en' ? 120 : 150);
      text(T('把你的航班记录，做成一本会动的护照', 'Your flight history, as a passport that comes alive'), PW / 2, 390, LG === 'en' ? 38 : 44, { w: 500, color: P.sub, max: PW - 140 });
      globe(30, PW / 2, 900, 380, GC.lam + 8, GC.phi, { t0: -99, step: 0, a: 1, pulse: true }); bloom(0.55);
      text(statLine(), PW / 2, 1420, LG === 'en' ? 34 : 38, { w: 700, max: PW - 120 });
      qrBlock(140, 1540, 240); text(URL_TEXT(), 410, 1630, 40, { align: 'left', fam: 'SM', w: 700, color: rgba(P.ac, 0.95), max: 560 });
      text(T('免费 · 隐私 · 一分钟出片', 'Free · private · made in your browser'), 410, 1690, 30, { align: 'left', w: 400, color: P.sub, max: 560 }); text(T('微信小程序同名「航迹手帐」', 'Upload · preview · save the MP4'), 410, 1740, 28, { align: 'left', w: 400, color: P.sub, max: 560 }); }],
    story: [1920, () => { backdrop(6, 0.35); corners(1920); globe(30, PW / 2, 620, 330, GC.lam + 8, GC.phi, { t0: -99, step: 0, a: 1, pulse: true });
      [5, 12, 20].forEach((k, j) => pass(FL[k], PW / 2 + (j - 1) * 120, 1440 + j * 40, 0.86, (j - 1) * 0.12, 1, k)); bloom(0.45);
      g.save(); g.fillStyle = 'rgba(2,6,16,.7)'; g.fillRect(0, 1030, PW, 250); g.restore();
      text(T('每一次起飞', 'Every take-off'), PW / 2, 1130, LG === 'en' ? 84 : 96, { w: 900 }); text(T('都值得被记住', 'deserves to be remembered'), PW / 2, 1240, LG === 'en' ? 64 : 96, { w: 900, color: P.gold, max: PW - 100 });
      qrBlock(PW / 2 - 110, 1690, 160); text(URL_TEXT(), PW / 2, 1890, 30, { fam: 'SM', w: 700, color: rgba(P.ac, 0.95) }); titleAt(150, LG === 'en' ? 64 : 72); }],
    xhs: [1440, () => { backdrop(6); corners(1440); titleAt(190, LG === 'en' ? 104 : 128); text(T('把航班记录，做成一本会动的护照', 'Your flights, as a passport that comes alive'), PW / 2, 270, LG === 'en' ? 36 : 42, { w: 500, color: P.sub, max: PW - 140 });
      globe(30, PW / 2, 720, 330, GC.lam + 8, GC.phi, { t0: -99, step: 0, a: 1, pulse: true }); bloom(0.5); text(statLine(), PW / 2, 1160, LG === 'en' ? 32 : 36, { w: 700, max: PW - 120 });
      text(URL_TEXT(), PW / 2, 1290, 40, { fam: 'SM', w: 700, color: rgba(P.ac, 0.95) }); text(T('免费 · 隐私 · 一分钟出片', 'Free · private · made in your browser'), PW / 2, 1345, 28, { w: 400, color: P.sub }); }],
    square: [1080, () => { backdrop(6); corners(1080); globe(30, PW / 2, 470, 300, GC.lam + 8, GC.phi, { t0: -99, step: 0, a: 1, pulse: true }); bloom(0.5);
      titleAt(880, LG === 'en' ? 96 : 116); text(URL_TEXT(), PW / 2, 975, 34, { fam: 'SM', w: 700, color: rgba(P.ac, 0.95) }); }],
    og: [567, () => { backdrop(6); corners(567, 26); globe(30, 800, 300, 230, GC.lam + 8, GC.phi, { t0: -99, step: 0, a: 1, pulse: true }); bloom(0.5);
      g.save(); g.fillStyle = goldFill(170, 260); g.font = `900 ${LG === 'en' ? 70 : 88}px ${SERIF}`; g.textAlign = 'left'; g.fillText(T('航迹手帐', 'Sky Passport'), 70, 250); g.restore();
      text(T('把航班记录做成一本会动的护照', 'Turn your flights into'), 72, 320, 32, { align: 'left', w: 600, max: 470 }); text(T('免费 · 隐私 · 浏览器里一分钟出片', 'a passport film'), 72, 365, 32, { align: 'left', w: 600, color: LG === 'en' ? P.ink : P.sub, max: 470 });
      text(LG === 'en' ? 'Free · private · in your browser' : '', 72, 420, 24, { align: 'left', w: 400, color: P.sub, max: 470 }); text(URL_TEXT(), 72, 500, 26, { align: 'left', fam: 'SM', w: 700, color: rgba(P.ac, 0.95) }); }],
  };
  function poster(kind, w, h) { const [hh, draw] = POSTERS[kind]; g.setTransform(1, 0, 0, 1, 0, 0); draw(); finish(7, 30); const o = mk(w, h); o.getContext('2d').drawImage(C, 0, 0, PW, hh, 0, 0, w, h); return o.toDataURL(kind === 'og' ? 'image/jpeg' : 'image/png', 0.9); }

  window.STORY = {
    palettes: Object.keys(PAL),
    async init(pal, lang, sprites) {
      P = PAL[pal] || PAL.hud; LG = lang === 'en' ? 'en' : 'zh'; LANG = LG; // the product page's language too: long poster and badges follow
      if (LG === 'en') { $('name').value = 'Lin Xiaozhou'; buildScene(); } // the sample traveller, written for English viewers
      await Promise.all([ensureFonts(), loadFlags(S.order)]); coverBuilt = false;
      const txt = ALL_TEXT(); await Promise.all(['400 30px "Open Sans"', '700 30px "Open Sans"', '800 30px "Open Sans"', '400 30px "Space Mono"', '700 30px "Space Mono"', '400 30px "Noto Sans SC"', '700 30px "Noto Sans SC"', '900 30px "Noto Serif SC"'].map(f => document.fonts.load(f, txt).catch(() => {})));
      FL = S.flights.filter(f => !f.vd && !f.up); F0 = S.final; APS = [...new Set(FL.flatMap(f => [f.f, f.to]))];
      { const c = d3.geoCentroid({ type: 'MultiPoint', coordinates: APS.map(a => [AP[a].lon, AP[a].lat]) }); GC = { lam: -c[0], phi: -Math.max(-35, Math.min(35, c[1])) * 0.8 }; } /* face the traveller's airports */ LONG = await renderLongPoster(); SC = scene(); Y = SC.years; DOTS = null; globeDots(); buildBg();
      const q = qrcode(0, 'M'); q.addData(LG === 'en' ? 'https://sky-passport.vercel.app' : 'https://passport.nybbq.art'); q.make(); const n = q.getModuleCount(); QR = mk(n + 4, n + 4); const qg = QR.getContext('2d'); qg.fillStyle = '#fff'; qg.fillRect(0, 0, n + 4, n + 4); qg.fillStyle = '#04101f'; for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) qg.fillRect(k + 2, r + 2, 1, 1);
      BANK = { ...((await loadSfx()) || {}) }; for (const [b64, map] of sprites || []) await decodeSprite(b64, window[map] || map, BANK);
      return { frames: Math.ceil(SC.T_END * FPS), seconds: SC.T_END, hero: Y[2].t + HERO, stamp: SC.T_STAMP + 0.16, lang: LG, pal: P.name };
    },
    frame(i) { return frame(i).toDataURL('image/jpeg', 0.92); },
    setVO(v) { VO = v && v.length ? v : null; },
    setNoQR(v, nourl) { NOQR = !!v; NOURL = !!nourl; },
    setKinetic(v) { KIN = v === true ? 'A' : (v || false); return { frames: Math.ceil(kinLen() * FPS), seconds: kinLen(), segs: KSEG() }; },
    poster(kind, w, h) { return poster(kind, w, h); },
    debug() { const m = mk(1440, 720), mc = m.getContext('2d'), pr = d3.geoEquirectangular().scale(1440 / (2 * Math.PI)).translate([720, 360]); mc.fillStyle = '#fff'; mc.beginPath(); d3.geoPath(pr, mc)(LAND); mc.fill(); const px = mc.getImageData(0, 0, 1440, 720).data; let n = 0; for (let i = 3; i < px.length; i += 4) if (px[i] > 128) n++; return { dots: DOTS ? DOTS.length : -1, flights: FL.length, land: LAND && LAND.type, filled: n }; },
    cues() { return cues().map(c => [c[0], c[1]]); },
    /* vo (optional): { b64: mono float32 narration at 48 kHz, duck: [[t0,t1,depth],…], db: speech level over the mix } */
    audio(stems, vo) { const tb = Y[2].t + HERO, voice = vo ? new Float32Array(Uint8Array.from(atob(vo.b64), c => c.charCodeAt(0)).buffer) : null,
      A = synth({ ...SC, sfx: BANK, cues: cues(), stops: [[tb - BEAT, tb]], stems, voice, duck: vo ? vo.duck : null, voiceDb: vo ? vo.db : undefined }, 48000), n = A.L.length, o = new Int16Array(n * 2);
      for (let i = 0; i < n; i++) { o[2 * i] = Math.max(-32767, Math.min(32767, A.L[i] * 32767)); o[2 * i + 1] = Math.max(-32767, Math.min(32767, A.R[i] * 32767)); }
      const b64 = arr => { let s = ''; const u = new Uint8Array(arr.buffer); for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode.apply(null, u.subarray(i, i + 32768)); return btoa(s); };
      if (!stems) return b64(o); const k = A.stems.sx.length, f = new Float32Array((vo ? 3 : 2) * k); f.set(A.stems.sx, 0); f.set(A.stems.mu, k); if (vo) f.set(A.stems.vo, 2 * k); return { pcm: b64(o), stems: b64(f) }; }, /* stems: effects, music[, voice] */
  };
})();
