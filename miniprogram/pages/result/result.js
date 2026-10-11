// 结果页：统计、成就、生成视频（服务器渲染，与网页版同一引擎）、长图海报
const C = require('../../libs/core.js');
const ST = require('../../libs/stats.js');
const PO = require('../../libs/poster.js');
const SS = require('../../libs/session.js');
const CONSENT = 'skypassport.videoConsent', LAST = 'skypassport.lastVideo', PICK = 'skypassport.badgesOn';
const RAR_T = { legend: '传奇', gold: '金', silver: '银' }, MAX_PICK = 12; // the poster canvas must stay under ~4000 px tall on every phone
const dataSig = rows => rows.length + '|' + (rows[0] ? rows[0].rawDate + rows[0].fn : '') + '|' + (rows.length ? rows[rows.length - 1].rawDate : '');

let ALL = [], mapImgPath = '', pollTimer = null, specTimer = null;
function loadMapBase() {
  if (mapImgPath) return Promise.resolve(mapImgPath);
  return new Promise(res => wx.downloadFile({ url: SS.SITE + '/mp-world-night.png', success: r => { if (r.statusCode === 200) mapImgPath = r.tempFilePath; res(mapImgPath); }, fail: () => res('') }));
}

Page({
  data: {
    demo: false, name: '', latin: '', years: [], year: 0, up: true, sum: null, badges: [], medals: [], cats: [], cat: 'all', got: 0, picked: 0, unres: [], noDate: 0, label: '',
    theme: 'burgundy', mstyle: 'groove', len: '24',
    themes: [{ v: 'burgundy', t: '酒红', c: '#5a1424' }, { v: 'navy', t: '藏青', c: '#1c2c4a' }, { v: 'green', t: '墨绿', c: '#1d4434' }, { v: 'black', t: '黑', c: '#222225' }],
    lens: [{ v: '24', t: '完整' }, { v: '12.5', t: '约 45 秒' }, { v: '5.5', t: '约 30 秒' }],
    video: { state: '', progress: 0, ahead: 0, url: '', size: '', err: '' }, saving: '',
    poster: '', posterH: 1000, busy: '', err: '',
  },
  onLoad() {
    const g = getApp().globalData;
    if (!g.rows) { wx.redirectTo({ url: '/pages/index/index' }); return; }
    const res = C.buildFlights(); ALL = res.all;
    const years = [...new Set(ALL.filter(f => !f.vd).map(f => f.y))].sort((a, b) => a - b);
    this.setData({ demo: g.demo, name: g.demo ? '林小舟' : '', latin: g.demo ? 'LIN XIAOZHOU' : '', years, unres: [...res.diag.refs.keys()].slice(0, 8), noDate: res.diag.noDate.length });
    this.recompute(); loadMapBase();
    // resume a video that was still rendering (or already done) for this same spreadsheet
    const last = wx.getStorageSync(LAST);
    if (last && last.sig === dataSig(SS.rowsForServer())) {
      this.setData({ ...last.opts, video: { state: 'queued', progress: 0, ahead: 0, url: '', size: '', err: '' } });
      this.recompute(); this.setData({ 'video.state': 'queued' }); this.poll(last.id, true);
    } else setTimeout(() => this.askPrerender(), 1200);
  },
  onUnload() { clearTimeout(pollTimer); clearTimeout(specTimer); },
  recompute() {
    const list = ST.pick(ALL, { up: this.data.up, year: this.data.year }), sum = ST.summarize(list, 'CN');
    const label = !sum.n ? '' : sum.y0 === sum.y1 ? `${sum.y0} 年度` : `${sum.y0} — ${sum.y1}`;
    this.setData({ sum: { ...sum, kmText: ST.fmt(sum.km), hours: Math.round(sum.min / 60) }, label, poster: '' });
    this.medals(ST.allBadges(list, 'CN'));
    this.resetVideo();
  },
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
  resetVideo() { if (this.data.video.state && this.data.video.state !== 'done') return; this.setData({ video: { state: '', progress: 0, ahead: 0, url: '', size: '', err: '' } }); this.prerender(); },
  pickYear(e) { this.setData({ year: +e.currentTarget.dataset.y }); this.recompute(); },
  toggleUp() { this.setData({ up: !this.data.up }); this.recompute(); },
  onName(e) { this.setData({ name: e.detail.value.trim(), poster: '' }); this.resetVideo(); },
  onLatin(e) { this.setData({ latin: e.detail.value.toUpperCase().replace(/[^A-Z ]/g, '') }); this.resetVideo(); },
  pick(e) { const { k, v } = e.currentTarget.dataset; this.setData({ [k]: v }); this.resetVideo(); },

  /* ---------- video: rendered on the server with the web engine ---------- */
  videoBody() { const d = this.data; return { rows: SS.rowsForServer(), opts: { name: d.name, latin: d.latin, theme: d.theme, mstyle: d.mstyle, len: d.len, year: d.year, up: d.up } }; },
  // with consent, the server starts the film while the user is still reading the stats; tapping 生成视频 with the
  // same choices then picks up that render (or the finished file). Pre-renders only run when the server is idle.
  askPrerender() {
    if (wx.getStorageSync(CONSENT) || !this.data.sum || !this.data.sum.n) return this.prerender();
    wx.showModal({
      title: '先帮你把视频做好？',
      content: '你看统计的时候，视频就在服务器上开始生成。会上传航段的日期、航班号、出发和到达地，以及你填的名字；24 小时后自动删除，不做其他用途。',
      confirmText: '同意', cancelText: '先不用',
      success: r => { if (r.confirm) { wx.setStorageSync(CONSENT, 1); this.prerender(); } },
    });
  },
  prerender() {
    clearTimeout(specTimer);
    if (!wx.getStorageSync(CONSENT) || !this.data.sum || !this.data.sum.n || this.data.video.state) return;
    specTimer = setTimeout(() => SS.api('/api/video', 'POST', { ...this.videoBody(), spec: true }).catch(() => {}), 3000); // settle typing first
  },
  makeVideo() {
    if (!this.data.sum || !this.data.sum.n || ['queued', 'rendering', 'sending'].includes(this.data.video.state)) return;
    if (wx.getStorageSync(CONSENT)) return this.submitVideo();
    wx.showModal({
      title: '生成视频需要上传航段',
      content: '视频在我们的服务器上渲染：会上传航段的日期、航班号、出发和到达地，以及你填的名字。视频生成 24 小时后自动删除，不做其他用途。',
      confirmText: '同意', cancelText: '不用了', // WeChat caps modal button text at 4 characters, or the modal silently fails
      success: r => { if (r.confirm) { wx.setStorageSync(CONSENT, 1); this.submitVideo(); } },
      fail: e => this.setData({ 'video.state': 'error', 'video.err': '弹窗打开失败：' + (e.errMsg || '') }),
    });
  },
  async submitVideo() {
    this.setData({ video: { state: 'sending', progress: 0, ahead: 0, url: '', size: '', err: '' } });
    try {
      clearTimeout(specTimer); const d = this.data, r = await SS.api('/api/video', 'POST', this.videoBody());
      wx.setStorageSync(LAST, { id: r.id, sig: dataSig(SS.rowsForServer()), opts: { name: d.name, latin: d.latin, theme: d.theme, mstyle: d.mstyle, len: d.len, year: d.year, up: d.up } });
      this.setData({ 'video.state': 'queued', 'video.ahead': r.ahead || 0 });
      this.poll(r.id);
    } catch (e) {
      const msg = e.code === 429 ? '一小时内生成次数太多，请稍后再试' : e.code === 503 ? '现在排队的人太多，请稍后再试' : '提交失败：' + e.message;
      this.setData({ 'video.state': 'error', 'video.err': msg });
    }
  },
  poll(id, resume) {
    clearTimeout(pollTimer);
    pollTimer = setTimeout(async () => {
      try {
        const s = await SS.api('/api/video/' + id, 'GET');
        if (s.state === 'done') return this.setData({ video: { state: 'done', progress: 1, ahead: 0, url: SS.SITE + s.url, size: (s.size / 1048576).toFixed(1) + ' MB', err: '' } });
        if (s.state === 'error') return this.setData({ 'video.state': 'error', 'video.err': s.error || '生成失败' });
        this.setData({ 'video.state': s.state, 'video.progress': Math.round(s.progress * 100), 'video.ahead': s.ahead || 0 });
      } catch (e) { if (resume && e.code === 404) { wx.removeStorageSync(LAST); return this.setData({ video: { state: '', progress: 0, ahead: 0, url: '', size: '', err: '' } }); } /* otherwise transient: keep polling */ }
      this.poll(id, resume);
    }, resume ? 300 : 2000);
  },
  // the video file on the phone (downloaded once, reused for the album and for sending to a friend)
  localVideo() {
    if (this._vfile && this._vfileUrl === this.data.video.url) return Promise.resolve(this._vfile);
    return new Promise((resolve, reject) => {
      this.setData({ saving: '正在下载 0%' });
      const task = wx.downloadFile({
        url: this.data.video.url,
        success: r => { this.setData({ saving: '' }); if (r.statusCode !== 200) return reject(new Error('下载失败')); this._vfile = r.tempFilePath; this._vfileUrl = this.data.video.url; resolve(r.tempFilePath); },
        fail: () => { this.setData({ saving: '' }); reject(new Error('下载失败，请重试')); },
      });
      task.onProgressUpdate(p => this.setData({ saving: `正在下载 ${p.progress}%` }));
    });
  },
  async saveVideo() {
    if (!this.data.video.url || this.data.saving) return;
    try { const f = await this.localVideo(); wx.saveVideoToPhotosAlbum({ filePath: f, success: () => wx.showModal({ title: '已保存到相册', content: '发朋友圈：打开朋友圈 → 右上角相机 → 从相册选择这段视频。', showCancel: false }), fail: e => this.albumDenied(e) }); }
    catch (e) { wx.showToast({ title: e.message, icon: 'none' }); }
  },
  async sendVideo() {
    if (!this.data.video.url || this.data.saving) return;
    try { const f = await this.localVideo(); wx.shareVideoMessage({ videoPath: f, fail: e => { if (!/cancel/.test(e.errMsg || '')) wx.showToast({ title: '发送失败', icon: 'none' }); } }); }
    catch (e) { wx.showToast({ title: e.message, icon: 'none' }); }
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
      const list = ST.pick(ALL, { up: this.data.up, year: this.data.year });
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
