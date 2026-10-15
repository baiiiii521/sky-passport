// 航迹手帐 · 小程序：表格在手机上解析；视频由 passport.nybbq.art 的渲染服务生成（个人主体小程序不能内嵌网页）
// ver: bumped whenever a spreadsheet (or the sample) is loaded, so the tab pages know to refresh; view: the choices shared by the tabs
const VERSION = '1.0.18';   // bump with every upload; shown at the bottom of each tab (the release version wins when there is one)
const FONT = 'https://sky-passport-1252289725.cos.ap-beijing.myqcloud.com/static/mp/hj-serif.woff';   // a 37 KB subset of Noto Serif SC Black (OFL): headline glyphs only
App({
  onLaunch() {
    const SS = require('./libs/session.js');
    let v = ''; try { v = wx.getAccountInfoSync().miniProgram.version; } catch (e) {} this.globalData.version = v || VERSION;
    wx.loadFontFace({ global: true, scopes: ['webview', 'native'], family: 'HJSerif', source: `url("${FONT}")`, fail: () => {} });
    // airports (170 KB, cached on the phone after the first run) start downloading at launch, whichever tab the user lands on; then last time's flights come back
    SS.loadAirports().then(() => { if (SS.restoreLast()) SS.track('restore_last'); }).catch(() => {});
    SS.track('visit');
  },
  globalData: { site: 'https://passport.nybbq.art', version: VERSION, rows: null, demo: false, ver: 0, res: null, view: { year: 0, up: true, name: '', latin: '', label: '' } },
});
