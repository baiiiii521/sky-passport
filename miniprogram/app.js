// 航迹手帐 · 小程序：表格在手机上解析；视频由 passport.nybbq.art 的渲染服务生成（个人主体小程序不能内嵌网页）
// ver: bumped whenever a spreadsheet (or the sample) is loaded, so the tab pages know to refresh; view: the choices shared by the tabs
// airports (170 KB, cached on the phone after the first run) start downloading at launch, whichever tab the user lands on
App({ onLaunch() { require('./libs/session.js').loadAirports().catch(() => {}); }, globalData: { site: 'https://passport.nybbq.art', rows: null, demo: false, ver: 0, res: null, view: { year: 0, up: true, name: '', latin: '', label: '' } } })
