// 航迹护照 · 小程序轻量版
// 表格在手机上解析（与网页版同一份 core.js），生成统计、成就和长图海报；视频需要浏览器能力，引导到网页版生成。
const C = require('../../libs/core.js');
const ST = require('../../libs/stats.js');
const PO = require('../../libs/poster.js');
const SITE = getApp().globalData.site;
const CACHE = `${wx.env.USER_DATA_PATH}/airports.json`;
const DEMO_NAME = '林小舟';

let ALL = [], DIAG = null, apReady = null, mapImgPath = '';

function loadAirports() {
  if (apReady) return apReady;
  apReady = new Promise((resolve, reject) => {
    const fs = wx.getFileSystemManager();
    try { C.ingestAirports(JSON.parse(fs.readFileSync(CACHE, 'utf8'))); return resolve(); } catch (e) { /* not cached yet */ }
    wx.request({
      url: SITE + '/airports.json', dataType: 'json', timeout: 30000,
      success: r => { if (r.statusCode !== 200 || !r.data || !r.data.rows) return reject(new Error('机场数据下载失败')); C.ingestAirports(r.data); try { fs.writeFileSync(CACHE, JSON.stringify(r.data), 'utf8'); } catch (e) {} resolve(); },
      fail: () => reject(new Error('网络不可用，机场数据下载失败')),
    });
  });
  apReady.catch(() => { apReady = null; });
  return apReady;
}
function loadMapBase() {
  if (mapImgPath) return Promise.resolve(mapImgPath);
  return new Promise(res => wx.downloadFile({ url: SITE + '/mp-world.png', success: r => { if (r.statusCode === 200) mapImgPath = r.tempFilePath; res(mapImgPath); }, fail: () => res('') }));
}

Page({
  data: {
    stage: 'start', busy: '', err: '', name: '', guideOpen: false, demo: false,
    years: [], year: 0, up: true, sum: null, badges: [], unres: [], noDate: 0, label: '', poster: '', posterH: 1000,
    guide: [
      ['打开「航旅纵横」App，进入「我的」，找到全部行程 / 飞行记录', '不同版本的叫法可能是「行程」「飞行足迹」或「出行记录」。'],
      ['点「导出」，选 Excel，然后发送给自己（文件传输助手）', '导出的 .xls 里通常有「已结束」「待出行」「无效票」几张表，不用改。'],
      ['回到这里点「从聊天中选择表格」，选中刚发的文件', '自己整理的 Excel / CSV 也可以：表头写 日期、航班号、出发、到达。'],
    ],
  },
  onLoad() { loadAirports().catch(() => {}); loadMapBase(); },
  toggleGuide() { this.setData({ guideOpen: !this.data.guideOpen }); },

  chooseFile() {
    wx.chooseMessageFile({
      count: 1, type: 'file', extension: ['xls', 'xlsx', 'csv', 'txt'],
      success: r => this.readFile(r.tempFiles[0]),
      fail: e => { if (!/cancel/.test(e.errMsg || '')) this.setData({ err: '没能打开文件：' + e.errMsg }); },
    });
  },
  async readFile(file) {
    this.setData({ busy: '正在读取表格…', err: '' });
    try {
      await loadAirports();
      const buf = wx.getFileSystemManager().readFileSync(file.path);
      const XLSX = require('../../libs/xlsx.full.min.js');
      const wb = XLSX.read(new Uint8Array(buf), { type: 'array', cellDates: true });
      const rows = C.readWorkbook(wb);
      if (!rows.length) throw new Error('没在文件里找到航班表格：请确认表头有「出发」「到达」「日期」，或者到网页版用 AI 识别表格结构。');
      C.setRaw(rows); C.setSource('file');
      this.ingest(false);
    } catch (e) { this.setData({ busy: '', err: e.message || String(e) }); }
  },
  async useDemo() {
    this.setData({ busy: '正在载入示例…', err: '' });
    try { await loadAirports(); C.setRaw(C.demoRows()); C.setSource('demo'); this.ingest(true); }
    catch (e) { this.setData({ busy: '', err: e.message || String(e) }); }
  },
  ingest(demo) {
    const res = C.buildFlights(); ALL = res.all; DIAG = res.diag;
    const years = [...new Set(ALL.filter(f => !f.vd).map(f => f.y))].sort((a, b) => a - b);
    this.setData({ stage: 'result', busy: '', demo, poster: '', year: 0, years, name: demo ? DEMO_NAME : this.data.name,
      unres: [...DIAG.refs.keys()].slice(0, 8), noDate: DIAG.noDate.length });
    this.recompute();
  },
  recompute() {
    const list = ST.pick(ALL, { up: this.data.up, year: this.data.year }), sum = ST.summarize(list, 'CN');
    const label = !sum.n ? '' : sum.y0 === sum.y1 ? `${sum.y0} 年度` : `${sum.y0} — ${sum.y1}`;
    this.setData({ sum: { ...sum, kmText: ST.fmt(sum.km), hours: Math.round(sum.min / 60) }, badges: ST.badges(list, 'CN'), label, poster: '' });
  },
  pickYear(e) { this.setData({ year: +e.currentTarget.dataset.y }); this.recompute(); },
  toggleUp() { this.setData({ up: !this.data.up }); this.recompute(); },
  onName(e) { this.setData({ name: e.detail.value.trim(), poster: '' }); },
  restart() { this.setData({ stage: 'start', poster: '', err: '' }); },

  async makePoster() {
    if (!this.data.sum || !this.data.sum.n) return;
    this.setData({ busy: '正在生成长图…' });
    try {
      const list = ST.pick(ALL, { up: this.data.up, year: this.data.year });
      const data = { name: this.data.name, label: this.data.label, sum: this.data.sum, badges: this.data.badges.slice(0, 8), flights: list, site: SITE };
      const H = PO.height(data);
      this.setData({ posterH: H });
      const canvas = await new Promise((res, rej) => wx.createSelectorQuery().select('#poster').fields({ node: true }).exec(r => (r && r[0] && r[0].node ? res(r[0].node) : rej(new Error('画布不可用')))));
      canvas.width = PO.W; canvas.height = H;
      const g = canvas.getContext('2d');
      const path = await loadMapBase();
      let img = null;
      if (path) img = await new Promise(res => { const im = canvas.createImage(); im.onload = () => res(im); im.onerror = () => res(null); im.src = path; });
      PO.draw(g, data, img);
      const out = await new Promise((res, rej) => wx.canvasToTempFilePath({ canvas, x: 0, y: 0, width: PO.W, height: H, destWidth: PO.W, destHeight: H, fileType: 'jpg', quality: 0.92, success: r => res(r.tempFilePath), fail: rej }));
      this.setData({ poster: out, busy: '' });
    } catch (e) { this.setData({ busy: '', err: '生成失败：' + (e.errMsg || e.message || e) }); }
  },
  previewPoster() { if (this.data.poster) wx.previewImage({ urls: [this.data.poster] }); },
  savePoster() {
    wx.saveImageToPhotosAlbum({
      filePath: this.data.poster,
      success: () => wx.showToast({ title: '已保存到相册', icon: 'success' }),
      fail: e => {
        if (/cancel/.test(e.errMsg || '')) return;
        wx.showModal({ title: '需要相册权限', content: '请在设置里允许「保存到相册」，再点一次保存。', confirmText: '去设置', success: r => { if (r.confirm) wx.openSetting(); } });
      },
    });
  },
  copySite() {
    wx.setClipboardData({ data: SITE, success: () => wx.showModal({ title: '网址已复制', content: '在手机浏览器（Safari / Chrome）里粘贴打开，上传同一份表格，就能生成带配乐的飞行护照视频。', showCancel: false }) });
  },
  onShareAppMessage() { return { title: '把你的航班记录做成一本飞行护照', path: '/pages/index/index' }; },
});
