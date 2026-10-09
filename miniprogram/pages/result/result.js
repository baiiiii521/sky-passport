// 结果页：统计、成就、生成视频（服务器渲染，与网页版同一引擎）、长图海报
const C = require('../../libs/core.js');
const ST = require('../../libs/stats.js');
const PO = require('../../libs/poster.js');
const SS = require('../../libs/session.js');
const CONSENT = 'skypassport.videoConsent';

let ALL = [], mapImgPath = '', pollTimer = null;
function loadMapBase() {
  if (mapImgPath) return Promise.resolve(mapImgPath);
  return new Promise(res => wx.downloadFile({ url: SS.SITE + '/mp-world.png', success: r => { if (r.statusCode === 200) mapImgPath = r.tempFilePath; res(mapImgPath); }, fail: () => res('') }));
}

Page({
  data: {
    demo: false, name: '', latin: '', years: [], year: 0, up: true, sum: null, badges: [], unres: [], noDate: 0, label: '',
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
  },
  onUnload() { clearTimeout(pollTimer); },
  recompute() {
    const list = ST.pick(ALL, { up: this.data.up, year: this.data.year }), sum = ST.summarize(list, 'CN');
    const label = !sum.n ? '' : sum.y0 === sum.y1 ? `${sum.y0} 年度` : `${sum.y0} — ${sum.y1}`;
    this.setData({ sum: { ...sum, kmText: ST.fmt(sum.km), hours: Math.round(sum.min / 60) }, badges: ST.badges(list, 'CN'), label, poster: '' });
    this.resetVideo();
  },
  resetVideo() { if (this.data.video.state && this.data.video.state !== 'done') return; this.setData({ video: { state: '', progress: 0, ahead: 0, url: '', size: '', err: '' } }); },
  pickYear(e) { this.setData({ year: +e.currentTarget.dataset.y }); this.recompute(); },
  toggleUp() { this.setData({ up: !this.data.up }); this.recompute(); },
  onName(e) { this.setData({ name: e.detail.value.trim(), poster: '' }); this.resetVideo(); },
  onLatin(e) { this.setData({ latin: e.detail.value.toUpperCase().replace(/[^A-Z ]/g, '') }); this.resetVideo(); },
  pick(e) { const { k, v } = e.currentTarget.dataset; this.setData({ [k]: v }); this.resetVideo(); },

  /* ---------- video: rendered on the server with the web engine ---------- */
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
      const d = this.data, r = await SS.api('/api/video', 'POST', { rows: SS.rowsForServer(), opts: { name: d.name, latin: d.latin, theme: d.theme, mstyle: d.mstyle, len: d.len, year: d.year, up: d.up } });
      this.setData({ 'video.state': 'queued', 'video.ahead': r.ahead || 0 });
      this.poll(r.id);
    } catch (e) {
      const msg = e.code === 429 ? '一小时内生成次数太多，请稍后再试' : e.code === 503 ? '现在排队的人太多，请稍后再试' : '提交失败：' + e.message;
      this.setData({ 'video.state': 'error', 'video.err': msg });
    }
  },
  poll(id) {
    clearTimeout(pollTimer);
    pollTimer = setTimeout(async () => {
      try {
        const s = await SS.api('/api/video/' + id, 'GET');
        if (s.state === 'done') return this.setData({ video: { state: 'done', progress: 1, ahead: 0, url: SS.SITE + s.url, size: (s.size / 1048576).toFixed(1) + ' MB', err: '' } });
        if (s.state === 'error') return this.setData({ 'video.state': 'error', 'video.err': s.error || '生成失败' });
        this.setData({ 'video.state': s.state, 'video.progress': Math.round(s.progress * 100), 'video.ahead': s.ahead || 0 });
      } catch (e) { /* transient: keep polling */ }
      this.poll(id);
    }, 2000);
  },
  saveVideo() {
    if (!this.data.video.url || this.data.saving) return;
    this.setData({ saving: '正在下载 0%' });
    const task = wx.downloadFile({
      url: this.data.video.url,
      success: r => {
        if (r.statusCode !== 200) { this.setData({ saving: '' }); return wx.showToast({ title: '下载失败', icon: 'none' }); }
        wx.saveVideoToPhotosAlbum({
          filePath: r.tempFilePath,
          success: () => { this.setData({ saving: '' }); wx.showToast({ title: '已保存到相册', icon: 'success' }); },
          fail: e => { this.setData({ saving: '' }); this.albumDenied(e); },
        });
      },
      fail: () => { this.setData({ saving: '' }); wx.showToast({ title: '下载失败，请重试', icon: 'none' }); },
    });
    task.onProgressUpdate(p => this.setData({ saving: `正在下载 ${p.progress}%` }));
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
      const data = { name: this.data.name, label: this.data.label, sum: this.data.sum, badges: this.data.badges.slice(0, 8), flights: list, site: SS.SITE };
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
  savePoster() {
    wx.saveImageToPhotosAlbum({ filePath: this.data.poster, success: () => wx.showToast({ title: '已保存到相册', icon: 'success' }), fail: e => this.albumDenied(e) });
  },
  onShareAppMessage() { return { title: '我的飞行护照：' + (this.data.label || ''), path: '/pages/index/index', imageUrl: SS.SITE + '/mp/cover.jpg' }; },
});
