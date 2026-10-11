// Shared state between the home page and the result page: airports, the parsed spreadsheet, server calls.
const C = require('./core.js');
const SITE = 'https://passport.nybbq.art';
const CACHE = `${wx.env.USER_DATA_PATH}/airports.json`;
let apReady = null;

function loadAirports() {
  if (apReady) return apReady;
  apReady = new Promise((resolve, reject) => {
    const fs = wx.getFileSystemManager();
    try { C.ingestAirports(JSON.parse(fs.readFileSync(CACHE, 'utf8'))); return resolve(); } catch (e) { /* first run */ }
    wx.request({
      url: SITE + '/airports.json', dataType: 'json', timeout: 30000,
      success: r => { if (r.statusCode !== 200 || !r.data || !r.data.rows) return reject(new Error('机场数据下载失败')); C.ingestAirports(r.data); try { fs.writeFileSync(CACHE, JSON.stringify(r.data), 'utf8'); } catch (e) {} resolve(); },
      fail: () => reject(new Error('网络不可用，机场数据下载失败')),
    });
  });
  apReady.catch(() => { apReady = null; });
  return apReady;
}

// a new data set: parse once, reset the shared choices, tell the tab pages (ver)
function loaded(rows, demo) { const g = getApp().globalData; g.rows = rows; g.demo = demo; g.res = C.buildFlights(); g.view = { year: 0, up: true, name: demo ? '林小舟' : '', latin: demo ? 'LIN XIAOZHOU' : '', label: '' }; g.ver++; }
// after loading: open the 制作 tab (switching to the tab that is already open does not fire its onShow, so call it)
function go(page) { if (page.route === 'pages/result/result') { if (page.onShow) page.onShow(); wx.pageScrollTo({ scrollTop: 0, duration: 0 }); } else wx.switchTab({ url: '/pages/result/result' }); }
// the two ways in, shared by every tab: `page` shows busy/err through its own data
function chooseFile(page) {
  wx.chooseMessageFile({
    count: 1, type: 'file', extension: ['xls', 'xlsx', 'csv', 'txt'],
    success: async r => {
      page.setData({ busy: '正在读取表格…', err: '' });
      try { await loadAirports(); readSpreadsheet(r.tempFiles[0].path); page.setData({ busy: '' }); go(page); }
      catch (e) { page.setData({ busy: '', err: e.message || String(e) }); }
    },
    fail: e => { if (!/cancel/.test(e.errMsg || '')) page.setData({ err: '没能打开文件：' + e.errMsg }); },
  });
}
async function tryDemo(page) {
  page.setData({ busy: '正在载入示例…', err: '' });
  try { await loadAirports(); useDemo(); page.setData({ busy: '' }); go(page); }
  catch (e) { page.setData({ busy: '', err: e.message || String(e) }); }
}
// read a chosen file (xls/xlsx/csv) into core's RAW; returns the row count
function readSpreadsheet(path) {
  const XLSX = require('./xlsx.full.min.js');
  const buf = wx.getFileSystemManager().readFileSync(path);
  const rows = C.readWorkbook(XLSX.read(new Uint8Array(buf), { type: 'array', cellDates: true }));
  if (!rows.length) throw new Error('没在文件里找到航班表格：请确认表头有「出发」「到达」「日期」，或者到网页版用 AI 识别表格结构。');
  C.setRaw(rows); C.setSource('file');
  loaded(rows, false);
  return rows.length;
}
function useDemo() {
  const rows = C.demoRows().map((r, i) => ({ ...r, st: '', src: { sheet: '示例', row: i + 2, cols: {} } }));
  C.setRaw(rows); C.setSource('demo');
  loaded(rows, true);
}

// rows for the render service: dates and times as plain text (Date objects would shift through UTC in JSON)
function rowsForServer() {
  const t2 = v => { const t = C.parseTime(v); return t ? `${String(t[0]).padStart(2, '0')}:${String(t[1]).padStart(2, '0')}` : ''; };
  return (getApp().globalData.rows || []).map(r => {
    const d = C.parseDate(r.rawDate);
    return { rawDate: d ? C.ymd(d) : String(r.rawDate || ''), fn: r.fn, al: r.al, from: r.from, to: r.to, dt: t2(r.dt), at: t2(r.at), km: String(r.km || ''), st: r.st || '',
      sheetUp: !!r.sheetUp || !!r.up, sheetVoid: !!r.sheetVoid || !!r.vd, sheet: r.src ? r.src.sheet : '', row: r.src ? r.src.row : 0 };
  });
}

function api(path, method, data) {
  return new Promise((resolve, reject) => wx.request({
    url: SITE + path, method, data, timeout: 20000, header: { 'Content-Type': 'application/json' },
    success: r => (r.statusCode === 200 ? resolve(r.data) : reject(Object.assign(new Error((r.data && r.data.error) || ('HTTP ' + r.statusCode)), { code: r.statusCode, body: r.data }))),
    fail: e => reject(new Error(e.errMsg || '网络错误')),
  }));
}

module.exports = { SITE, loadAirports, readSpreadsheet, useDemo, rowsForServer, api, chooseFile, tryDemo };
