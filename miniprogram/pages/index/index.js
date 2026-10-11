// 首页：成片展示、示例视频、功能介绍、三步说明；选择表格后进入结果页
const SS = require('../../libs/session.js');
const M = SS.SITE + '/mp/';

Page({
  data: {
    busy: '', err: '', guideOpen: false, showDemo: false,
    shots: [{ src: M + 'cover.jpg', cap: '烫金护照封面' }, { src: M + 'page.jpg', cap: '航线一年年飞过地图' }, { src: M + 'world.jpg', cap: '盖章、拉远、点亮航线' }],
    demoVideo: M + 'demo.mp4', demoPoster: M + 'cover.jpg', longImg: M + 'long.jpg',
    globeImg: M + 'globe.jpg',
    sample: [{ c: ['5', '1'], l: '次起飞' }, { c: ['1', '3', '1', ',', '4', '8', '3'], l: '公里' }, { c: ['1', '3'], l: '个国家地区' }, { c: ['1', '9', '8'], l: '小时在空中' }],
    ticker: [['MU201', 'PVG', 'LAX'], ['FM517', 'DXB', 'PVG'], ['CZ380', 'PVG', 'DXB'], ['CA6702', 'TAO', 'SHA'], ['HO6813', 'SHA', 'HAK'], ['MU523', 'PVG', 'NRT'], ['MU201', 'PVG', 'LAX'], ['FM517', 'DXB', 'PVG'], ['CZ380', 'PVG', 'DXB'], ['CA6702', 'TAO', 'SHA'], ['HO6813', 'SHA', 'HAK'], ['MU523', 'PVG', 'NRT']],
    how: [{ t: '记忆 · 导入航班', d: '航旅纵横导出的表格，从聊天里选中就行' }, { t: '解码 · 自动识别', d: '机场、日期、状态自动认出来，算出统计和成就' }, { t: '护照 · 生成影片', d: '一分钟竖屏影片 + 长图海报，存相册、发朋友圈' }],
    guide: [
      ['打开「航旅纵横」App，进入「我的」，找到全部行程 / 飞行记录', '不同版本的叫法可能是「行程」「飞行足迹」或「出行记录」。'],
      ['点「导出」，选 Excel，然后发送给「文件传输助手」', '导出的 .xls 里通常有「已结束」「待出行」「无效票」几张表，不用改。'],
      ['回到这里点「从聊天中选择表格」，选中刚发的文件', '自己整理的 Excel / CSV 也可以：表头写 日期、航班号、出发、到达。'],
    ],
  },
  onLoad() { SS.loadAirports().catch(() => {}); },
  toggleGuide() { this.setData({ guideOpen: !this.data.guideOpen }); },
  playDemo() { this.setData({ showDemo: true }); },
  previewShot(e) { wx.previewImage({ urls: this.data.shots.map(s => s.src).concat(this.data.longImg), current: e.currentTarget.dataset.src }); },

  chooseFile() {
    wx.chooseMessageFile({
      count: 1, type: 'file', extension: ['xls', 'xlsx', 'csv', 'txt'],
      success: async r => {
        this.setData({ busy: '正在读取表格…', err: '' });
        try { await SS.loadAirports(); SS.readSpreadsheet(r.tempFiles[0].path); this.setData({ busy: '' }); wx.navigateTo({ url: '/pages/result/result' }); }
        catch (e) { this.setData({ busy: '', err: e.message || String(e) }); }
      },
      fail: e => { if (!/cancel/.test(e.errMsg || '')) this.setData({ err: '没能打开文件：' + e.errMsg }); },
    });
  },
  async tryDemo() {
    this.setData({ busy: '正在载入示例…', err: '' });
    try { await SS.loadAirports(); SS.useDemo(); this.setData({ busy: '' }); wx.navigateTo({ url: '/pages/result/result' }); }
    catch (e) { this.setData({ busy: '', err: e.message || String(e) }); }
  },
  onShareAppMessage() { return { title: '把你的航班记录做成一本飞行护照', path: '/pages/index/index', imageUrl: M + 'share.jpg' }; }, // share card image is 5:4
  onShareTimeline() { return { title: '航迹护照：把航班记录做成一本飞行护照' }; },
});
