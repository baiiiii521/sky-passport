// 「成就」标签页：33 枚飞行勋章（点选）和夜航长图海报；数据和年份等选择来自「制作」标签页（globalData.res / view）
const ST = require('../../libs/stats.js');
const PO = require('../../libs/poster.js');
const SS = require('../../libs/session.js');
const CA = require('../../libs/cards.js');
const PICK = 'skypassport.badgesOn';
const RAR_T = { legend: '传奇', gold: '金', silver: '银' }, MAX_PICK = 12; // the poster canvas must stay under ~4000 px tall on every phone

const loadMapBase = () => SS.mapBase();

Page({
  data: { has: false, demo: false, name: '', latin: '', label: '', sum: null, badges: [], medals: [], cats: [], cat: 'all', got: 0, picked: 0, poster: '', posterH: 1000, busy: '', err: '', xhs: [], card: '', version: '', sampleImg: SS.SITE + '/mp/long.jpg?v=113' },
  onShow() {
    const g = getApp().globalData; if (this.data.version !== g.version) this.setData({ version: g.version }); if (!g.rows || !g.res) return this.setData({ has: false });
    const key = g.ver + '/' + (g.viewVer || 0); if (this._key === key) return; this._key = key;
    const v = g.view, list = ST.pick(g.res.all, { up: v.up, year: v.year }), sum = ST.summarize(list, 'CN'); this._list = list;
    const label = !sum.n ? '' : sum.y0 === sum.y1 ? `${sum.y0} 年度` : `${sum.y0} — ${sum.y1}`;
    this.setData({ has: !!sum.n, demo: g.demo, name: v.name, latin: v.latin, label, sum, poster: '', xhs: [], card: '' }); this._all = ST.allBadges(list, 'CN'); this.medals(this._all); loadMapBase().then(() => this.makeShareCard());
  },
  chooseFile() { SS.chooseFile(this); }, tryDemo() { SS.tryDemo(this); },
  manual() { getApp().globalData.openManual = true; wx.switchTab({ url: '/pages/result/result' }); },
  shots() { getApp().globalData.openShots = true; wx.switchTab({ url: '/pages/result/result' }); },
  previewSample() { wx.previewImage({ urls: [this.data.sampleImg] }); },
  /* medals: every achievement with its rarity; the user's pick (ids) is remembered, the recommended set applies until then */
  medals(all) {
    const sel = wx.getStorageSync(PICK), isOn = b => !b.lock && (Array.isArray(sel) ? sel.includes(b.id) : ST.BADGE_DEFAULT.includes(b.id));
    const medals = (all || this.data.medals).map(b => ({ ...b, on: isOn(b), rarT: RAR_T[b.rar] || '', showProg: typeof b.prog === 'number' && b.prog < 1, progPct: Math.round(Math.max(0.02, Math.min(1, b.prog || 0)) * 100) })).sort((a, b) => (a.lock ? 1 : 0) - (b.lock ? 1 : 0));
    const cats = ST.BADGE_CATS.map(([c, t]) => { const k = medals.filter(b => c === 'all' || b.cat === c); return { c, t, n: k.length, g: k.filter(b => !b.lock).length }; });
    this.setData({ medals, cats, got: medals.filter(b => !b.lock).length, picked: medals.filter(b => b.on).length, badges: medals.filter(b => b.on), poster: '' });
  },
  pickCat(e) { this.setData({ cat: e.currentTarget.dataset.c }); },
  toggleMedal(e) {
    const id = e.currentTarget.dataset.id, m = this.data.medals.find(b => b.id === id); if (!m) return;
    if (m.lock) return wx.showToast({ title: m.d, icon: 'none', duration: 2500 });
    const on = new Set(this.data.medals.filter(b => b.on).map(b => b.id)); if (on.has(id)) on.delete(id); else if (on.size >= MAX_PICK) return wx.showToast({ title: `长图最多印 ${MAX_PICK} 枚，先取消一枚`, icon: 'none' }); else on.add(id);
    wx.setStorageSync(PICK, [...on]); this.medals();
  },
  pickSet(e) {
    const m = e.currentTarget.dataset.m; if (m === 'rec') wx.removeStorageSync(PICK); else wx.setStorageSync(PICK, m === 'all' ? this.data.medals.filter(b => !b.lock).slice(0, MAX_PICK).map(b => b.id) : []);
    this.medals();
  },
  albumDenied(e) {
    if (/cancel/.test((e && e.errMsg) || '')) return;
    wx.showModal({ title: '需要相册权限', content: '请在设置里允许「保存到相册」，再点一次保存。', confirmText: '去设置', success: r => { if (r.confirm) wx.openSetting(); } });
  },
  /* ---------- long poster (drawn on the phone) ---------- */
  async makePoster() {
    if (!this.data.sum || !this.data.sum.n) return; SS.track('poster');
    this.setData({ busy: '正在生成长图…', err: '' });
    try {
      const list = this._list;
      const data = { name: this.data.name, latin: this.data.latin, label: this.data.label, sum: this.data.sum, badges: this.data.badges, flights: list, site: SS.SITE };
      const H = PO.height(data); this.setData({ posterH: H });
      const canvas = await new Promise((res, rej) => wx.createSelectorQuery().select('#poster').fields({ node: true }).exec(r => (r && r[0] && r[0].node ? res(r[0].node) : rej(new Error('画布不可用')))));
      canvas.width = PO.W; canvas.height = H;
      const path = await loadMapBase();
      const img = path ? await new Promise(res => { const im = canvas.createImage(); im.onload = () => res(im); im.onerror = () => res(null); im.src = path; }) : null;
      PO.draw(canvas.getContext('2d'), data, img);
      const out = await new Promise((res, rej) => wx.canvasToTempFilePath({ canvas, x: 0, y: 0, width: PO.W, height: H, destWidth: PO.W, destHeight: H, fileType: 'jpg', quality: 0.92, success: r => res(r.tempFilePath), fail: rej }));
      this.setData({ poster: out, busy: '' });
    } catch (e) { this.setData({ busy: '', err: '生成失败：' + (e.errMsg || e.message || e) }); }
  },
  /* ---------- cards: the share card, three 小红书 cards, one card per medal ---------- */
  cardData() { return CA.cardData({ name: this.data.name, label: this.data.label }, this.data.sum, this._list, this.data.badges, this._all || []); },
  async makeShareCard() { if (!this.data.has) return; try { const p = await CA.render(this, 'share', this.cardData(), await loadMapBase()); this.setData({ card: p }); } catch (e) {} },
  async makeXhs() {
    if (!this.data.sum || !this.data.sum.n) return; this.setData({ busy: '正在生成小红书卡片…', err: '' });
    try { const d = this.cardData(), img = await loadMapBase(), out = []; for (const k of ['xhs1', 'xhs2', 'xhs3']) out.push(await CA.render(this, k, d, img)); this.setData({ xhs: out, busy: '' }); SS.track('xhs_cards'); }
    catch (e) { this.setData({ busy: '', err: '生成失败：' + (e.errMsg || e.message || e) }); }
  },
  previewXhs(e) { wx.previewImage({ urls: this.data.xhs, current: this.data.xhs[+e.currentTarget.dataset.i] }); },
  async saveXhs() {
    let n = 0; for (const p of this.data.xhs) { const ok = await new Promise(res => wx.saveImageToPhotosAlbum({ filePath: p, success: () => res(true), fail: e => { this.albumDenied(e); res(false); } })); if (!ok) break; n++; }
    if (n === this.data.xhs.length) wx.showToast({ title: `已保存 ${n} 张`, icon: 'success' });
  },
  copyCaption() { wx.setClipboardData({ data: CA.caption(this.cardData()), success: () => wx.showToast({ title: '文案已复制', icon: 'none' }) }); },
  async medalCard(e) {
    const m = this.data.medals.find(b => b.id === e.currentTarget.dataset.id); if (!m || m.lock) return;
    this.setData({ busy: '正在生成勋章卡…', err: '' });
    try { const p = await CA.render(this, 'medal', this.cardData(), null, m); this.setData({ busy: '' }); SS.track('medal_card');
      if (wx.showShareImageMenu) wx.showShareImageMenu({ path: p, fail: () => wx.previewImage({ urls: [p] }) }); else wx.previewImage({ urls: [p] }); }
    catch (err) { this.setData({ busy: '', err: '生成失败：' + (err.errMsg || err.message || err) }); }
  },
  previewPoster() { if (this.data.poster) wx.previewImage({ urls: [this.data.poster] }); },
  sharePoster() {
    if (!this.data.poster) return;
    if (wx.showShareImageMenu) wx.showShareImageMenu({ path: this.data.poster, fail: e => { if (!/cancel/.test(e.errMsg || '')) this.savePoster(); } });
    else this.savePoster();
  },
  savePoster() {
    wx.saveImageToPhotosAlbum({ filePath: this.data.poster, success: () => wx.showToast({ title: '已保存到相册', icon: 'success' }), fail: e => this.albumDenied(e) });
  },
  onShareAppMessage() { const d = this.data; if (d.card) SS.track('share_card'); return { title: d.sum && d.sum.n ? `${d.name || '我'}的航迹手帐：已解锁 ${d.got} 枚飞行勋章` : '把航班记录做成一本会动的护照', path: '/pages/index/index', imageUrl: d.card || SS.SITE + '/mp/share.jpg' }; }, // share card image is 5:4
});
