// Promo kit generator — injected into the running site (after the demo scene is built) by web/promo/make_promo.py.
// Draws posters, caption overlays and end card with the product's own renderer (cover foil, frames, QR, badges)
// so the marketing material is pixel-identical to what users get. window.PROMO.all() → {name: dataURL}.
(function () {
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const png = c => c.toDataURL('image/png');
  const snap = t => { renderFrame(Math.max(0, Math.min(S.frames - 1, Math.round(t * FPS)))); const c = mk(W, H); c.getContext('2d').drawImage(cv, 0, 0); return c; };
  const TH = () => theme();
  function leather(g, w, h) {
    const t = TH(), bg = g.createRadialGradient(w / 2, h * 0.3, 60, w / 2, h * 0.5, Math.max(w, h) * 0.75);
    bg.addColorStop(0, t.c[0]); bg.addColorStop(0.55, t.c[1]); bg.addColorStop(1, t.c[2]); g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.save(); g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.5; g.drawImage(GRAIN[0], 0, 0, w, h); g.restore();
  }
  function frameLines(g, w, h) { g.save(); g.strokeStyle = 'rgba(227,189,132,.75)'; g.lineWidth = 3; rr(g, 40, 40, w - 80, h - 80, 30); g.stroke(); g.lineWidth = 1.2; rr(g, 56, 56, w - 112, h - 112, 22); g.stroke(); g.restore(); }
  function goldTitle(g, txt, cx, y, size, track) { g.fillStyle = goldText(g, y - size, y + 10); g.font = `900 ${size}px ${SERIF}`; g.textAlign = 'center'; spaced(g, txt, cx, y, track); }
  function txt(g, s, x, y, size, color, weight = 400, align = 'center', fam) { g.font = F(weight, size, fam); g.fillStyle = color; g.textAlign = align; g.fillText(s, x, y); }
  function wrapFit(g, s, maxW, size, weight) { let z = size; g.font = F(weight, z); while (g.measureText(s).width > maxW && z > 16) { z -= 2; g.font = F(weight, z); } return z; }
  // a phone showing one frame of the film
  function phone(g, img, cx, cy, w, rot = 0) {
    const h = w * 16 / 9, b = w * 0.045;
    g.save(); g.translate(cx, cy); g.rotate(rot);
    g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 40; g.shadowOffsetY = 18;
    g.fillStyle = '#0d0407'; rr(g, -w / 2 - b, -h / 2 - b, w + 2 * b, h + 2 * b, w * 0.12); g.fill(); g.shadowColor = 'transparent';
    g.save(); rr(g, -w / 2, -h / 2, w, h, w * 0.08); g.clip(); g.drawImage(img, -w / 2, -h / 2, w, h); g.restore();
    g.strokeStyle = 'rgba(227,189,132,.35)'; g.lineWidth = 2; rr(g, -w / 2 - b, -h / 2 - b, w + 2 * b, h + 2 * b, w * 0.12); g.stroke();
    g.restore();
  }
  function qrBlock(g, x, y, size, label, sub) {
    drawQrCard(g, x, y, size, 1, null);
    if (label) txt(g, label, x + size / 2, y + size + 52, 28, '#fbe9c2', 700);
    if (sub) txt(g, sub, x + size / 2, y + size + 92, 22, '#d9c3b6', 400, 'center', 'SM');
  }
  const S0 = () => S.final, KM = () => fmt(S0().km), YRS = () => yearsLabel(S, ' — ', '');

  /* ---------- posters ---------- */
  function posterMain(shots) {
    const c = mk(1080, 1920), g = c.getContext('2d'); leather(g, 1080, 1920); frameLines(g, 1080, 1920);
    g.save(); g.translate(540, 300); g.strokeStyle = g.fillStyle = goldText(g, 120, 480); emblem(g, 0.62, false); g.restore();
    goldTitle(g, '航迹护照', 540, 640, 150, 30);
    txt(g, 'SKY  PASSPORT', 540, 708, 30, '#e3bd84', 600);
    txt(g, '把这些年飞过的航班，做成一本会动的护照', 540, 790, 38, '#f6e7d4', 600);
    phone(g, shots.cover, 300, 1210, 300, -0.10); phone(g, shots.world, 780, 1210, 300, 0.10); phone(g, shots.page, 540, 1170, 340, 0);
    ['1 分钟竖屏视频', '原创配乐', '长图海报', '飞行成就'].forEach((s, i) => { const w = 210, x = 540 + (i - 1.5) * (w + 20); g.fillStyle = 'rgba(227,189,132,.12)'; rr(g, x - w / 2, 1520, w, 64, 32); g.fill(); g.strokeStyle = 'rgba(227,189,132,.5)'; g.lineWidth = 2; g.stroke(); txt(g, s, x, 1563, 26, '#fbe9c2', 600); });
    qrBlock(g, 120, 1640, 170, null, null);
    txt(g, '扫码免费制作', 340, 1715, 40, '#fbe9c2', 700, 'left'); txt(g, 'passport.nybbq.art', 340, 1765, 28, '#d9c3b6', 400, 'left', 'SM');
    txt(g, '手机浏览器 · 电脑 · 微信小程序', 340, 1808, 24, 'rgba(217,195,182,.75)', 400, 'left');
    return c;
  }
  function posterFeatures(shots, long) {
    const c = mk(1080, 1920), g = c.getContext('2d');
    const pg = g.createLinearGradient(0, 0, 0, 1920); pg.addColorStop(0, '#fbf7f6'); pg.addColorStop(1, '#efe8f3'); g.fillStyle = pg; g.fillRect(0, 0, 1080, 1920);
    guilloche(g, 900, 1500, 300, 41, 110, '#b9a2e6', 0.12, 0.8, 200);
    g.save(); leather(g, 1080, 420); g.restore(); goldTitle(g, '你会得到', 540, 230, 96, 20); txt(g, '上传一份航班记录，一次全部生成', 540, 320, 34, '#f6e7d4', 600);
    const items = [
      ['🎬', '飞行护照视频', '约 1 分钟竖屏动画 · 原创配乐 · 可存相册', shots.page],
      ['🖼', '长图海报', '统计 · 航线地图 · 成就，一张图发朋友圈', long],
      ['🏅', '飞行成就', '最长单程 · 最常飞航线 · 红眼航班 · 碳排放', null],
      ['🔒', '隐私优先', '表格在你的手机上解析；生成视频后 24 小时删除', null],
    ];
    items.forEach(([ic, t, d, img], i) => {
      const y = 480 + i * 330; g.fillStyle = 'rgba(255,255,255,.85)'; rr(g, 60, y, 960, 300, 28); g.fill(); g.strokeStyle = 'rgba(142,29,56,.14)'; g.lineWidth = 2; g.stroke();
      txt(g, ic, 140, y + 120, 72, '#000', 400); txt(g, t, 220, y + 110, 46, '#4b1019', 700, 'left'); const z = wrapFit(g, d, img ? 560 : 760, 28, 400); txt(g, d, 220, y + 165, z, '#8a6a74', 400, 'left');
      if (img) { g.save(); rr(g, 800, y + 20, 190, 260, 16); g.clip(); const r = Math.max(190 / img.width, 260 / img.height); g.drawImage(img, 800 + (190 - img.width * r) / 2, y + 20, img.width * r, img.height * r); g.restore(); }
      if (i === 2) {  const line = computeBadges(S).filter(b => ['最长单程', '最常飞航线', '飞得最远的地方'].includes(b.k)).map(b => `${b.k.replace('飞得最远的地方', '最远')} ${b.v}`).join('  ·  '); const z2 = wrapFit(g, line, 760, 30, 700); txt(g, line, 220, y + 235, z2, '#b0173a', 700, 'left'); }
      if (i === 3) txt(g, '国内标准地图 · 不需要注册登录', 220, y + 235, 30, '#b0173a', 700, 'left');
    });
    g.fillStyle = '#2a0b12'; g.fillRect(0, 1820, 1080, 100); txt(g, '免费制作 · passport.nybbq.art', 540, 1882, 36, '#fbe9c2', 700);
    return c;
  }
  function posterXhs(shots) { // 小红书 3:4
    const c = mk(1080, 1440), g = c.getContext('2d'); leather(g, 1080, 1440); frameLines(g, 1080, 1440);
    txt(g, '我把这些年的航班', 540, 230, 92, '#fbe9c2', 900); txt(g, '做成了一本护照 ✈️', 540, 350, 92, '#fbe9c2', 900);
    txt(g, `${S0().n} 次航班 · ${(S0().km / 10000).toFixed(1)} 万公里 · ${S0().cc} 个国家地区`, 540, 440, 34, '#e3bd84', 600);
    phone(g, shots.page, 380, 930, 360, -0.06); phone(g, shots.cover, 790, 960, 250, 0.08);
    g.fillStyle = '#c41e37'; rr(g, 700, 1260, 300, 90, 45); g.fill(); txt(g, '免费 · 1 分钟出片', 850, 1318, 32, '#fff', 700);
    txt(g, 'passport.nybbq.art', 90, 1318, 30, '#d9c3b6', 400, 'left', 'SM');
    return c;
  }
  function posterSteps(shots) {
    const c = mk(1080, 1920), g = c.getContext('2d'); leather(g, 1080, 1920); frameLines(g, 1080, 1920);
    goldTitle(g, '三步做好', 540, 250, 110, 24); txt(g, '你的飞行护照视频', 540, 330, 40, '#f6e7d4', 600);
    const steps = [['导出记录', '航旅纵横 → 我的 → 行程 → 导出 Excel', shots.page], ['上传表格', '浏览器打开网址，或在微信里选择聊天中的文件', shots.world], ['生成分享', '视频 · 长图 · 成就，一键存相册、发朋友圈', shots.cover]];
    steps.forEach(([t, d, img], i) => {
      const y = 410 + i * 400;
      g.fillStyle = 'rgba(255,250,240,.06)'; rr(g, 80, y, 920, 360, 30); g.fill(); g.strokeStyle = 'rgba(227,189,132,.35)'; g.lineWidth = 2; g.stroke();
      g.fillStyle = goldText(g, y + 60, y + 160); g.beginPath(); g.arc(180, y + 110, 58, 0, 7); g.fill(); txt(g, String(i + 1), 180, y + 134, 64, '#2a0b12', 900);
      txt(g, t, 270, y + 130, 54, '#fbe9c2', 700, 'left'); const z = wrapFit(g, d, 470, 28, 400); txt(g, d, 270, y + 190, z, '#d9c3b6', 400, 'left');
      phone(g, img, 870, y + 185, 150, 0.04);
    });
    txt(g, '扫码开始 · passport.nybbq.art', 540, 1650, 30, '#fbe9c2', 700);
    qrBlock(g, 455, 1690, 170, null, null);
    return c;
  }
  function posterSquare() { // 朋友圈 / 公众号 1:1
    const c = mk(1080, 1080), g = c.getContext('2d'); leather(g, 1080, 1080); frameLines(g, 1080, 1080);
    g.save(); g.translate(540, 300); g.strokeStyle = g.fillStyle = goldText(g, 120, 480); emblem(g, 0.55, false); g.restore();
    goldTitle(g, '航迹护照', 540, 640, 130, 26); txt(g, '一本护照，装下我的天空', 540, 720, 38, '#f6e7d4', 600);
    qrBlock(g, 455, 790, 170, null, null); txt(g, 'passport.nybbq.art', 540, 1010, 28, '#d9c3b6', 400, 'center', 'SM');
    return c;
  }

  /* ---------- promo video pieces ---------- */
  function caption(s, y = 1830) { // transparent overlay with a pill caption
    const c = mk(1080, 1920), g = c.getContext('2d'); const z = 40; g.font = F(700, z); const w = g.measureText(s).width + 90;
    g.fillStyle = 'rgba(26,6,11,.82)'; rr(g, 540 - w / 2, y - 62, w, 92, 46); g.fill(); g.strokeStyle = 'rgba(227,189,132,.6)'; g.lineWidth = 2; g.stroke();
    txt(g, s, 540, y - 2, z, '#fbe9c2', 700); return c;
  }
  function longBg() { const c = mk(1080, 1920), g = c.getContext('2d'); leather(g, 1080, 1920); frameLines(g, 1080, 1920); goldTitle(g, '一键生成长图海报', 540, 190, 72, 10); txt(g, '统计 · 航线地图 · 飞行成就，发朋友圈刚刚好', 540, 262, 30, '#f6e7d4', 600); return c; }
  function endCard() {
    const c = mk(1080, 1920), g = c.getContext('2d'); leather(g, 1080, 1920); frameLines(g, 1080, 1920);
    g.save(); g.translate(540, 470); g.strokeStyle = g.fillStyle = goldText(g, 260, 700); emblem(g, 0.8, false); g.restore();
    goldTitle(g, '航迹护照', 540, 910, 160, 32); txt(g, '把这些年飞过的航班，做成一本会动的护照', 540, 1000, 38, '#f6e7d4', 600);
    qrBlock(g, 400, 1150, 280, null, null);
    txt(g, '扫码免费制作', 540, 1530, 48, '#fbe9c2', 700); txt(g, 'passport.nybbq.art', 540, 1590, 34, '#e3bd84', 400, 'center', 'SM');
    txt(g, '手机浏览器 · 电脑 · 微信小程序', 540, 1645, 28, 'rgba(217,195,182,.8)', 400);
    return c;
  }

  window.PROMO = {
    async all() {
      await Promise.all([ensureFonts(), loadFlags(S.order)]); coverBuilt = false;
      const shots = { cover: snap(S.T_END - 0.4), page: snap(S.T_FE - 3.2), world: snap(S.T_CARD - 1.2) };
      const long = await renderLongPoster();
      const out = {
        'poster-1-main-9x16': posterMain(shots), 'poster-2-features-9x16': posterFeatures(shots, long), 'poster-3-xiaohongshu-3x4': posterXhs(shots),
        'poster-4-steps-9x16': posterSteps(shots), 'poster-5-square-1x1': posterSquare(),
        'v-cap-0': caption('把这些年飞过的航班，做成一本会动的护照', 140), 'v-cap-1': caption('上传航旅纵横导出的表格'), 'v-cap-2': caption('航线一年年飞过地图'),
        'v-cap-3': caption('国旗、里程、国家地区实时累计'), 'v-cap-4': caption('最后盖上你的飞行印章'), 'v-long-bg': longBg(), 'v-long': long, 'v-end': endCard(),
      };
      const r = {}; for (const [k, v] of Object.entries(out)) r[k] = png(v);
      r.info = JSON.stringify({ T_OPEN, T_F0, T_FE: S.T_FE, T_STAMP: S.T_STAMP, T_ZOOM: S.T_ZOOM, T_CARD: S.T_CARD, T_END: S.T_END, longH: long.height });
      drawAt(playT); return r;
    },
  };
})();
