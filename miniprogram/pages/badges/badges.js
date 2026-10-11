// 「成就」标签页：33 枚飞行勋章（点选）和夜航长图海报；数据和年份等选择来自「制作」标签页（globalData.res / view）
const ST = require('../../libs/stats.js');
const PO = require('../../libs/poster.js');
const SS = require('../../libs/session.js');
const PICK = 'skypassport.badgesOn';
const RAR_T = { legend: '传奇', gold: '金', silver: '银' }, MAX_PICK = 12; // the poster canvas must stay under ~4000 px tall on every phone

let mapImgPath = '';
function loadMapBase() {
  if (mapImgPath) return Promise.resolve(mapImgPath);
  return new Promise(res => wx.downloadFile({ url: SS.SITE + '/mp-world-night.png', success: r => { if (r.statusCode === 200) mapImgPath = r.tempFilePath; res(mapImgPath); }, fail: () => res('') }));
}

Page({
  data: { has: false, demo: false, name: '', latin: '', label: '', sum: null, badges: [], medals: [], cats: [], cat: 'all', got: 0, picked: 0, poster: '', posterH: 1000, busy: '', err: '', sampleImg: SS.SITE + '/mp/long.jpg?v=104' },
  onShow() {
    const g = getApp().globalData; if (!g.rows || !g.res) return this.setData({ has: false });
    const key = g.ver + '/' + (g.viewVer || 0); if (this._key === key) return; this._key = key;
    const v = g.view, list = ST.pick(g.res.all, { up: v.up, year: v.year }), sum = ST.summarize(list, 'CN'); this._list = list;
    const label = !sum.n ? '' : sum.y0 === sum.y1 ? `${sum.y0} 年度` : `${sum.y0} — ${sum.y1}`;
    this.setData({ has: !!sum.n, demo: g.demo, name: v.name, latin: v.latin, label, sum, poster: '' }); this.medals(ST.allBadges(list, 'CN')); loadMapBase();
  },
  chooseFile() { SS.chooseFile(this); }, tryDemo() { SS.tryDemo(this); },
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
    if (!this.data.sum || !this.data.sum.n) return;
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
  previewPoster() { if (this.data.poster) wx.previewImage({ urls: [this.data.poster] }); },
  sharePoster() {
    if (!this.data.poster) return;
    if (wx.showShareImageMenu) wx.showShareImageMenu({ path: this.data.poster, fail: e => { if (!/cancel/.test(e.errMsg || '')) this.savePoster(); } });
    else this.savePoster();
  },
  savePoster() {
    wx.saveImageToPhotosAlbum({ filePath: this.data.poster, success: () => wx.showToast({ title: '已保存到相册', icon: 'success' }), fail: e => this.albumDenied(e) });
  },
  onShareAppMessage() { return { title: '我的飞行护照：' + (this.data.label || ''), path: '/pages/index/index', imageUrl: SS.SITE + '/mp/share.jpg' }; }, // share card image is 5:4
});
