// 「制作」标签页：导入、统计、生成视频（服务器渲染，与网页版同一引擎）。成就和长图在「成就」标签页
const C = require('../../libs/core.js');
const ST = require('../../libs/stats.js');
const SS = require('../../libs/session.js');
const CONSENT = 'skypassport.videoConsent', LAST = 'skypassport.lastVideo', PICK = 'skypassport.badgesOn';
const RAR_T = { legend: '传奇', gold: '金', silver: '银' }, MAX_PICK = 12; // the poster canvas must stay under ~4000 px tall on every phone
const dataSig = rows => rows.length + '|' + (rows[0] ? rows[0].rawDate + rows[0].fn : '') + '|' + (rows.length ? rows[rows.length - 1].rawDate : '');

let ALL = [], pollTimer = null, specTimer = null;

Page({
  data: {
    has: false, demo: false, name: '', latin: '', years: [], year: 0, up: true, sum: null, unres: [], noDate: 0, label: '',
    theme: 'burgundy', mstyle: 'groove', len: '24',
    themes: [{ v: 'burgundy', t: '酒红', c: '#5a1424' }, { v: 'navy', t: '藏青', c: '#1c2c4a' }, { v: 'green', t: '墨绿', c: '#1d4434' }, { v: 'black', t: '黑', c: '#222225' }],
    lens: [{ v: '24', t: '完整' }, { v: '12.5', t: '约 45 秒' }, { v: '5.5', t: '约 30 秒' }],
    video: { state: '', progress: 0, ahead: 0, url: '', size: '', err: '' }, saving: '',
    busy: '', err: '',
  },
  onShow() { const g = getApp().globalData; if (!g.rows) return this.setData({ has: false }); if (this._ver !== g.ver) { this._ver = g.ver; this.load(); } },
  chooseFile() { SS.chooseFile(this); }, tryDemo() { SS.tryDemo(this); }, toBadges() { wx.switchTab({ url: '/pages/badges/badges' }); },
  load() {
    const g = getApp().globalData, res = g.res || C.buildFlights(); ALL = res.all; clearTimeout(pollTimer); clearTimeout(specTimer);
    this.setData({ has: true, year: 0, up: true, video: { state: '', progress: 0, ahead: 0, url: '', size: '', err: '' } });
    const years = [...new Set(ALL.filter(f => !f.vd).map(f => f.y))].sort((a, b) => a - b);
    this.setData({ demo: g.demo, name: g.demo ? '林小舟' : '', latin: g.demo ? 'LIN XIAOZHOU' : '', years, unres: [...res.diag.refs.keys()].slice(0, 8), noDate: res.diag.noDate.length });
    this.recompute();
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
    this.setData({ sum: { ...sum, kmText: ST.fmt(sum.km), hours: Math.round(sum.min / 60) }, label });
    this.share();
    this.resetVideo();
  },
  /* the choices the 成就 tab also needs */
  share() { const d = this.data, g = getApp().globalData; g.view = { year: d.year, up: d.up, name: d.name, latin: d.latin, label: d.label }; g.viewVer = (g.viewVer || 0) + 1; },
  resetVideo() { if (this.data.video.state && this.data.video.state !== 'done') return; this.setData({ video: { state: '', progress: 0, ahead: 0, url: '', size: '', err: '' } }); this.prerender(); },
  pickYear(e) { this.setData({ year: +e.currentTarget.dataset.y }); this.recompute(); },
  toggleUp() { this.setData({ up: !this.data.up }); this.recompute(); },
  onName(e) { this.setData({ name: e.detail.value.trim() }); this.share(); this.resetVideo(); },
  onLatin(e) { this.setData({ latin: e.detail.value.toUpperCase().replace(/[^A-Z ]/g, '') }); this.share(); this.resetVideo(); },
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

  onShareAppMessage() { return { title: '我的飞行护照：' + (this.data.label || ''), path: '/pages/index/index', imageUrl: SS.SITE + '/mp/share.jpg' }; }, // share card image is 5:4
});
