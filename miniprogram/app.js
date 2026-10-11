// 航迹护照 · 小程序：表格在手机上解析；视频由 passport.nybbq.art 的渲染服务生成（个人主体小程序不能内嵌网页）
// ver: bumped whenever a spreadsheet (or the sample) is loaded, so the tab pages know to refresh; view: the choices shared by the tabs
App({ globalData: { site: 'https://passport.nybbq.art', rows: null, demo: false, ver: 0, res: null, view: { year: 0, up: true, name: '', latin: '', label: '' } } })
