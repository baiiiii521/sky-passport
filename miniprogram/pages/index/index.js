// 首页：成片展示、示例视频、功能介绍、三步说明；选择表格后进入结果页
const SS = require('../../libs/session.js');
const M = SS.SITE + '/mp/';

Page({
  data: {
    busy: '', err: '', showDemo: false, introSrc: '',
    demoVideo: M + 'demo.mp4', demoPoster: M + 'cover.jpg',
    globeImg: M + 'globe.jpg',
    sample: [{ c: ['5', '1'], l: '次起飞' }, { c: ['1', '3', '1', ',', '4', '8', '3'], l: '公里' }, { c: ['1', '3'], l: '个国家地区' }, { c: ['1', '9', '8'], l: '小时在空中' }],

    guide: [
      ['打开「航旅纵横」App，进入「我的」，找到全部行程 / 飞行记录', '不同版本的叫法可能是「行程」「飞行足迹」或「出行记录」。'],
      ['点「导出」，选 Excel，然后发送给「文件传输助手」', '导出的 .xls 里通常有「已结束」「待出行」「无效票」几张表，不用改。'],
      ['回到这里点「从聊天中选择表格」，选中刚发的文件', '自己整理的 Excel / CSV 也可以：表头写 日期、航班号、出发、到达。'],
    ],
  },
  onLoad() { SS.loadAirports().catch(() => {}); },
  playDemo() { this.setData({ showDemo: !this.data.showDemo, introSrc: '' }); },
  /* three short intro films (A rapid fire, B one pass, C departures board): a different one each tap */
  playIntro() { let k = Math.floor(Math.random() * 3); if (k === this._intro) k = (k + 1) % 3; this._intro = k; this.setData({ introSrc: SS.SITE + '/promo/intro-' + 'abc'[k] + '.mp4', showDemo: false }); },
  introEnded() { this.setData({ introSrc: '' }); },

  chooseFile() { SS.chooseFile(this); },
  tryDemo() { SS.tryDemo(this); },
  manual() { getApp().globalData.openManual = true; wx.switchTab({ url: '/pages/result/result' }); },
  shots() { getApp().globalData.openShots = true; wx.switchTab({ url: '/pages/result/result' }); },
  toGuide() { wx.pageScrollTo({ selector: '#guide', duration: 300, offsetTop: -16 }); },
  onShareAppMessage() { return { title: '把你的航班记录做成一本飞行护照', path: '/pages/index/index', imageUrl: M + 'share.jpg' }; }, // share card image is 5:4
  onShareTimeline() { return { title: '航迹手帐：把航班记录做成一本飞行护照' }; },
});
