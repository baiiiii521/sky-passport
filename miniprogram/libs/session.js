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

// the spreadsheet library (880 KB) is a sub package: downloaded in the background after the first screen (app.json preloadRule), evaluated on first use
let xlsxLib = null, xlsxReady = null;
function loadXLSX() {
  if (xlsxReady) return xlsxReady;
  xlsxReady = require.async('../sub/xlsx/xlsx.full.min.js').then(x => { xlsxLib = x; C.setXLSX(x); return x; }, () => { throw new Error('表格组件下载失败，请检查网络后重试'); });
  xlsxReady.catch(() => { xlsxReady = null; });
  return xlsxReady;
}
// a new data set: parse once, reset the shared choices, tell the tab pages (ver)
function loaded(rows, demo, keep) { const g = getApp().globalData, was = g.view || {}, own = keep && !g.demo; g.rows = rows; g.demo = demo; g.res = C.buildFlights();
  g.view = { year: 0, up: true, name: demo ? '林小舟' : own ? was.name || '' : '', latin: demo ? 'LIN XIAOZHOU' : own ? was.latin || '' : '', label: '' }; g.ver++; }

/* ---------- flights typed by hand (same idea as the web's 手动添加): kept on the phone, added to whatever spreadsheet is loaded ---------- */
const MANUAL = 'skypassport.manual';
const manualRow = (m, i) => ({ rawDate: m.d, al: '', fn: m.fn || '', from: m.from, to: m.to, dt: '', at: '', km: '', st: '', sheetUp: false, sheetVoid: false, src: { sheet: '手动添加', row: i + 1, cols: {}, manual: true } });
function savedManual() { try { const v = wx.getStorageSync(MANUAL); return Array.isArray(v) ? v.filter(m => m && m.d && m.from && m.to) : []; } catch (e) { return []; } }
function manualLegs() { const g = getApp().globalData; return g.demo ? [] : (g.rows || []).filter(r => r.src && r.src.manual).map(r => ({ d: r.rawDate, from: r.from, to: r.to, fn: r.fn })); }
// replace the hand-typed legs: the sample makes way for the user's own flights, a loaded spreadsheet keeps its rows
function setManual(legs) {
  const g = getApp().globalData, file = g.demo ? [] : (g.rows || []).filter(r => !(r.src && r.src.manual)), rows = file.concat(legs.map(manualRow));
  try { wx.setStorageSync(MANUAL, legs); } catch (e) { /* storage full: the legs still work for this session */ }
  if (!rows.length) { g.rows = null; g.res = null; g.demo = false; g.ver++; return 0; }
  C.setRaw(rows); C.setSource('file'); loaded(rows, false, true);
  return rows.length;
}

// after loading: open the 制作 tab (switching to the tab that is already open does not fire its onShow, so call it)
function go(page) { if (page.route === 'pages/result/result') { if (page.onShow) page.onShow(); wx.pageScrollTo({ scrollTop: 0, duration: 0 }); } else wx.switchTab({ url: '/pages/result/result' }); }
// the two ways in, shared by every tab: `page` shows busy/err through its own data
function chooseFile(page) {
  wx.chooseMessageFile({
    count: 1, type: 'file', extension: ['xls', 'xlsx', 'csv', 'txt'],
    success: async r => {
      page.setData({ busy: '正在读取表格…', err: '' });
      try { await Promise.all([loadAirports(), loadXLSX()]); readSpreadsheet(r.tempFiles[0].path); page.setData({ busy: '' }); go(page); }
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
  const XLSX = xlsxLib;
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

function api(path, method, data, timeout) {
  return new Promise((resolve, reject) => wx.request({
    url: SITE + path, method, data, timeout: timeout || 20000, header: { 'Content-Type': 'application/json' },
    success: r => (r.statusCode === 200 ? resolve(r.data) : reject(Object.assign(new Error((r.data && r.data.error) || ('HTTP ' + r.statusCode)), { code: r.statusCode, body: r.data }))),
    fail: e => reject(new Error(e.errMsg || '网络错误')),
  }));
}

/* ---------- flights from screenshots: the picture goes to our server (Tencent Cloud OCR), the flights come back as text ---------- */
const readB64 = path => new Promise((res, rej) => wx.getFileSystemManager().readFile({ filePath: path, encoding: 'base64', success: r => res(r.data), fail: e => rej(new Error(e.errMsg || '读不了图片')) }));
// 760 px wide, quality 50: about 80 KB, still easy to read for the OCR, and small enough for a slow line (compressedWidth needs base library 2.26)
const squeeze = path => new Promise(res => wx.compressImage({ src: path, quality: 50, compressedWidth: 760, success: r => res(r.tempFilePath), fail: () => res(path) }));
// one screenshot → {legs: ready to add, todo: found but a date or an airport is missing}
async function shotFlights(file) {
  const b64 = await readB64(await squeeze(file.tempFilePath));
  if (b64.length > 5.4e6) throw Object.assign(new Error('图片太大'), { code: 400 });
  const post = () => api('/api/shots', 'POST', { image: b64 }, 60000); let r;
  try { r = await post(); } catch (e) { if (e.code) throw e; r = await post(); }   // no status code = the upload itself failed (slow line): try once more
  const legs = [], todo = [];
  for (const f of (r && r.flights) || []) {
    const fa = f.from && C.resolveAirport(f.from), ta = f.to && C.resolveAirport(f.to);
    if (f.date && fa && ta && fa !== ta) legs.push({ d: f.date, from: fa, to: ta, fn: f.fn || '' });
    else todo.push(`${f.date || (f.md ? '?年-' + f.md : '日期?')} ${f.fn || ''} ${f.from || '?'} → ${f.to || '?'}`);
  }
  return { legs, todo };
}

module.exports = { shotFlights, SITE, loadAirports, readSpreadsheet, useDemo, rowsForServer, api, chooseFile, tryDemo, savedManual, manualLegs, setManual };
