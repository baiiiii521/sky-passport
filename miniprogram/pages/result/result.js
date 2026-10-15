// 「制作」标签页：导入、统计、生成视频（服务器渲染，与网页版同一引擎）。成就和长图在「成就」标签页
const C = require('../../libs/core.js');
const ST = require('../../libs/stats.js');
const SS = require('../../libs/session.js');
const CA = require('../../libs/cards.js');
const PICK = 'skypassport.badgesOn', NAT = 'skypassport.nat', PHOTO = 'skypassport.photo', TAGS = 'skypassport.tags';
const TAG_ZH = '一本护照，装下我的天空', TAG_EN = 'MY JOURNEY ACROSS THE GLOBE';   // the web page's defaults
// nationality: the passport's issuing country in the film (cover, page, MRZ) and the home country for the stats (international flights, 首次出境)
const TOP = ['CN', 'HK', 'MO', 'TW', 'JP', 'KR', 'SG', 'MY', 'TH', 'US', 'GB', 'CA', 'AU', 'NZ', 'DE', 'FR'];   // offered first, before the full list
let NATS = null; const nats = () => NATS || (NATS = Object.entries(C.NAMES).filter(([k]) => /^[A-Z]{2}$/.test(k)).sort((a, b) => (TOP.indexOf(a[0]) + 1 || 99) - (TOP.indexOf(b[0]) + 1 || 99) || a[1][1].localeCompare(b[1][1], 'zh'))
  .map(([k, v]) => ({ k, t: `${v[1]} · ${v[2]}`, q: `${v[1]} ${v[0]} ${v[2]} ${k}`.toLowerCase() })));   /* NAMES already says 中国台湾 / 中国香港 / 中国澳门 */
const CONSENT = 'skypassport.videoConsent', LAST = 'skypassport.lastVideo';
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
    photo: '', tagZh: TAG_ZH, tagEn: TAG_EN, nat: 'CN', natIdx: 0, natList: [], natOpen: false, natQ: '', natHits: [], step: 1, steps: [{ n: 1, t: '航班' }, { n: 2, t: '名字' }, { n: 3, t: '风格与生成' }], next: null, card: '', version: '',
    manualOpen: false, legs: [], saved: 0, shotTodo: [], shotMsg: '', mDate: '', mFrom: '', mTo: '', mFn: '', mHint: '', mCls: '',
  },
  onLoad() { this.loadExtras(); const list = nats(), k = wx.getStorageSync(NAT) || 'CN', i = Math.max(0, list.findIndex(n => n.k === k)); this.setData({ natList: list.map(n => n.t), nat: list[i] ? list[i].k : 'CN', natIdx: i }); },
  onShow() {
    const g = getApp().globalData, want = g.openManual, shots = g.openShots; g.openManual = false; g.openShots = false; if (this.data.version !== g.version) this.setData({ version: g.version });
    if (!g.rows) this.setData({ has: false, saved: SS.savedManual().length }); else if (this._ver !== g.ver) { this._ver = g.ver; this.load(); }
    if (shots) this.openManual().then(() => { if (this.data.manualOpen) this.pickShots(true); }); else if (want) this.openManual();   /* from the home page: straight to the album */
  },

  /* ---------- flights typed by hand ---------- */
  async openManual() {
    if (this.data.manualOpen) return;
    this.setData({ busy: '正在准备机场数据…', err: '' });
    try { await SS.loadAirports(); } catch (e) { return this.setData({ busy: '', err: e.message || String(e) }); }
    const g = getApp().globalData, saved = SS.savedManual();
    this.setData({ busy: '', manualOpen: true, mHint: '', mCls: '' });
    if (saved.length && (g.demo || !SS.manualLegs().length)) { SS.setManual(saved); this.refresh(); wx.showToast({ title: `已恢复上次输入的 ${saved.length} 段`, icon: 'none' }); } /* pick up where the user left off */
    else this.showLegs();
    clearTimeout(specTimer);
  },
  closeManual() { this.setData({ manualOpen: false }); if (this.data.has) setTimeout(() => this.askPrerender(), 600); },
  refresh() { const g = getApp().globalData; this._ver = g.ver; if (g.rows) this.load(); else this.setData({ has: false, saved: 0 }); this.showLegs(); },
  showLegs() { this.setData({ legs: SS.manualLegs().map((m, i) => ({ i, d: m.d, t: `${m.from} ${ST.placeName(m.from)} → ${m.to} ${ST.placeName(m.to)}`, fn: m.fn })) }); },
  onMDate(e) { this.setData({ mDate: e.detail.value }); },
  onMFn(e) { this.setData({ mFn: e.detail.value }); },
  onMFrom(e) { this.setData({ mFrom: e.detail.value }); this.mCheck(); },
  onMTo(e) { this.setData({ mTo: e.detail.value }); this.mCheck(); },
  mCheck() {
    const fv = this.data.mFrom.trim(), tv = this.data.mTo.trim(), fa = fv && C.resolveAirport(fv), ta = tv && C.resolveAirport(tv), nm = c => `${c} ${ST.placeName(c)}`;
    this.setData({ mHint: fv || tv ? [fv ? (fa ? nm(fa) : `「${fv}」没认出`) : '…', tv ? (ta ? nm(ta) : `「${tv}」没认出`) : '…'].join(' → ') : '', mCls: fa && ta ? 'ok' : (fv && !fa) || (tv && !ta) ? 'bad' : '' });
  },
  addLeg() {
    const d = this.data, fa = C.resolveAirport(d.mFrom.trim()), ta = C.resolveAirport(d.mTo.trim()), bad = m => this.setData({ mHint: m, mCls: 'bad' });
    if (!d.mDate) return bad('先选日期');
    if (!fa || !ta) return bad('出发和到达都要能认出（三字码最稳，如 PVG、NRT）');
    if (fa === ta) return bad('出发和到达是同一个机场');
    if (d.legs.length >= 300) return bad('手动输入最多 300 段，更多请用表格导入');
    const legs = SS.manualLegs().concat([{ d: d.mDate, from: fa, to: ta, fn: d.mFn.toUpperCase().replace(/\s+/g, '').slice(0, 8) }]);
    SS.track('import_manual'); SS.setManual(legs); this.refresh();
    this.setData({ mFrom: ta, mTo: '', mFn: '', mHint: `已添加 ${fa} → ${ta}，共 ${legs.length} 段`, mCls: 'ok' }); /* the next leg usually starts where this one ended */
  },
  /* screenshots of a trip list (航旅纵横「已结束」etc.) → legs; anything incomplete is listed so the user can type it in */
  pickShots(quiet) {   /* quiet === true: opened for the user from another tab; if the album cannot open by itself, the card's own button is right there */
    if (this._shots) return;
    wx.chooseMedia({ count: 9, mediaType: ['image'], sourceType: ['album'], sizeType: ['compressed'], success: r => this.readShots(r.tempFiles || []), fail: e => { if (quiet !== true && !/cancel/.test(e.errMsg || '')) this.setData({ err: '没能打开相册：' + (e.errMsg || '') }); } });
  },
  async readShots(files) {
    if (!files.length || this._shots) return; this._shots = true; await this.openManual();
    if (!this.data.manualOpen) { this._shots = false; return; }
    let legs = SS.manualLegs(), added = 0, dup = 0, fail = ''; const todo = [], key = m => [m.d, m.from, m.to, m.fn].join('|'), have = new Set(legs.map(key));
    for (let i = 0; i < files.length; i++) {
      this.setData({ busy: `正在识别第 ${i + 1} / ${files.length} 张…`, err: '' });
      try { const r = await SS.shotFlights(files[i]); todo.push(...r.todo); for (const m of r.legs) { if (have.has(key(m))) { dup++; continue; } have.add(key(m)); legs.push(m); added++; } }
      catch (e) { fail = e.code === 429 ? '这一小时识别的张数太多了，请稍后再试' : e.code === 503 ? '截图识别暂时不可用，请先手动输入' : e.code === 400 ? '有图片读不出来，请换一张清晰的截图' : (e.code ? '识别服务出错了，请稍后再试' : '上传没成功（网络较慢或不通），请换个网络再试，或先手动输入'); if (e.code !== 400) break; }
    }
    this._shots = false; this.setData({ busy: '' });
    SS.track(added ? 'import_shots' : 'shots_none'); if (added) { SS.setManual(legs.slice(0, 300)); this.refresh(); }
    this.setData({ shotTodo: todo.slice(0, 30), shotMsg: fail && !added ? fail : `识别出 ${added} 段${dup ? `，${dup} 段重复已跳过` : ''}${todo.length ? `；另有 ${todo.length} 段没认全，请照下面手动补上` : ''}${!added && !todo.length ? '：没找到航班，请确认截图里有日期、航班号和起降地' : ''}${fail ? `（${fail}）` : ''}`, mHint: '', mCls: '' });
  },
  delLeg(e) { const legs = SS.manualLegs(); legs.splice(+e.currentTarget.dataset.i, 1); SS.setManual(legs); this.refresh(); this.setData({ mHint: '', mCls: '' }); },
  clearLegs() { wx.showModal({ title: '清空手动输入的航班？', content: '只清空你手动输入的航段，不影响已选择的表格。', confirmText: '清空', success: r => { if (r.confirm) { SS.setManual([]); this.refresh(); this.setData({ mHint: '', mCls: '' }); } } }); },

  chooseFile() { SS.chooseFile(this); }, tryDemo() { SS.tryDemo(this); }, toBadges() { wx.switchTab({ url: '/pages/badges/badges' }); },
  load() {
    const g = getApp().globalData, res = g.res || C.buildFlights(); ALL = res.all; clearTimeout(pollTimer); clearTimeout(specTimer);
    this.setData({ has: true, step: 1, year: 0, up: true, card: '', video: { state: '', progress: 0, ahead: 0, url: '', size: '', err: '' } });
    this.setData({ next: this.nextFlight() }); if (this.data.next && !this._cdTracked) { this._cdTracked = true; SS.track('countdown'); }
    const years = [...new Set(ALL.filter(f => !f.vd).map(f => f.y))].sort((a, b) => a - b);
    this.setData({ demo: g.demo, name: g.view.name || '', latin: g.view.latin || '', years, unres: [...res.diag.refs.keys()].slice(0, 8), noDate: res.diag.noDate.length });
    this.recompute();
    // resume a video that was still rendering (or already done) for this same spreadsheet
    const last = wx.getStorageSync(LAST);
    if (last && last.sig === dataSig(SS.rowsForServer())) {
      this.setData({ ...last.opts, video: { state: 'queued', progress: 0, ahead: 0, url: '', size: '', err: '' } });
      this.recompute(); this.setData({ 'video.state': 'queued' }); this.poll(last.id, true);
    } else if (!this.data.manualOpen) setTimeout(() => this.askPrerender(), 1200); /* while typing flights by hand, do not start renders for every leg */
  },
  onUnload() { clearTimeout(pollTimer); clearTimeout(specTimer); },
  recompute() {
    const list = ST.pick(ALL, { up: this.data.up, year: this.data.year }), sum = ST.summarize(list, this.data.nat);
    const label = !sum.n ? '' : sum.y0 === sum.y1 ? `${sum.y0} 年度` : `${sum.y0} — ${sum.y1}`;
    this.setData({ sum: { ...sum, kmText: ST.fmt(sum.km), hours: Math.round(sum.min / 60) }, label });
    this._list = list; this.share();
    this.resetVideo(); this.cardSoon();
  },
  /* the next upcoming flight, for the countdown (dates are the traveller's local dates) */
  nextFlight() {
    const now = new Date(), today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const f = ALL.filter(x => !x.vd && x.date && x.date >= today).sort((a, b) => (a.date < b.date ? -1 : 1))[0]; if (!f) return null;
    const days = Math.round((new Date(f.date + 'T00:00:00') - new Date(today + 'T00:00:00')) / 864e5);
    return { days, when: `${+f.date.slice(5, 7)} 月 ${+f.date.slice(8, 10)} 日`, route: `${ST.placeName(f.f)} → ${ST.placeName(f.to)}${f.fn ? ' · ' + f.fn : ''}` };
  },
  /* the personal share card (5:4): redrawn a moment after the numbers or the name change */
  cardSoon() { clearTimeout(this._cardT); this._cardT = setTimeout(() => this.makeCard(), 500); },
  async makeCard() {
    const d = this.data; if (!d.sum || !d.sum.n || !this._list) return;
    const all = ST.allBadges(this._list, this.data.nat), sel = wx.getStorageSync(PICK), picked = all.filter(b => !b.lock && (Array.isArray(sel) ? sel.includes(b.id) : ST.BADGE_DEFAULT.includes(b.id)));
    try { const img = await SS.mapBase(), path = await CA.render(this, 'share', CA.cardData({ name: d.name, label: d.label }, d.sum, this._list, picked, all), img); this.setData({ card: path }); } catch (e) { /* the static card is used instead */ }
  },
  goStep(e) { const n = +e.currentTarget.dataset.n; if (n === this.data.step || (n > 1 && (!this.data.sum || !this.data.sum.n))) return; this.setData({ step: n }); wx.pageScrollTo({ scrollTop: 0, duration: 200 }); },
  nextStep() { this.setData({ step: Math.min(3, this.data.step + 1) }); wx.pageScrollTo({ scrollTop: 0, duration: 200 }); },
  prevStep() { this.setData({ step: Math.max(1, this.data.step - 1) }); wx.pageScrollTo({ scrollTop: 0, duration: 200 }); },
  forget() {
    wx.showModal({ title: '清空这些航班？', content: '会清空保存在这台手机上的表格和手动输入的航段，回到导入页重新开始。', confirmText: '清空', success: r => { if (!r.confirm) return;
      SS.forgetLast(); SS.setManual([]); const g = getApp().globalData; g.rows = null; g.res = null; g.demo = false; g.ver++; this._ver = g.ver; this.setData({ has: false, saved: 0, card: '', step: 1 }); } });
  },
  /* the choices the 成就 tab also needs */
  share() { const d = this.data, g = getApp().globalData; g.view = { year: d.year, up: d.up, name: d.name, latin: d.latin, label: d.label, nat: d.nat }; g.viewVer = (g.viewVer || 0) + 1; },
  resetVideo() { if (this.data.video.state && this.data.video.state !== 'done') return; this.setData({ video: { state: '', progress: 0, ahead: 0, url: '', size: '', err: '' } }); this.prerender(); },
  pickYear(e) { this.setData({ year: +e.currentTarget.dataset.y }); this.recompute(); },
  toggleUp() { this.setData({ up: !this.data.up }); this.recompute(); },
  /* nationality: a search box over the list (scrolling 250 places was too slow) */
  natShow() { this.setData({ natOpen: true, natQ: '', natHits: nats().slice(0, 40).map(n => ({ k: n.k, t: n.t })) }); },
  natHide() { this.setData({ natOpen: false }); },
  natSearch(e) { const q = e.detail.value.trim().toLowerCase(), all = nats(); this.setData({ natQ: e.detail.value, natHits: (q ? all.filter(n => n.q.includes(q)) : all.slice(0, 40)).slice(0, 60).map(n => ({ k: n.k, t: n.t })) }); },
  natPick(e) { const k = e.currentTarget.dataset.k, i = nats().findIndex(n => n.k === k); if (i < 0) return; wx.setStorageSync(NAT, k); this.setData({ nat: k, natIdx: i, natOpen: false }); this.recompute(); },
  /* passport photo (cropped 3:4, 360×480 JPEG ≈ 30–60 KB, kept on the phone) and the closing lines */
  loadExtras() { let t = null; try { t = wx.getStorageSync(TAGS); } catch (e) {} const p = (() => { try { return wx.getStorageSync(PHOTO); } catch (e) { return ''; } })();
    this._photoB64 = p && p.b64 || ''; this.setData({ photo: p && p.path || '', tagZh: t && typeof t.zh === 'string' ? t.zh : TAG_ZH, tagEn: t && typeof t.en === 'string' ? t.en : TAG_EN });
    if (this._photoB64 && p.path) wx.getFileSystemManager().access({ path: p.path, fail: () => this.photoFile(this._photoB64) }); },
  photoFile(b64) { const f = `${wx.env.USER_DATA_PATH}/passport-photo.jpg`; try { wx.getFileSystemManager().writeFileSync(f, b64, 'base64'); this.setData({ photo: f }); return f; } catch (e) { return ''; } },
  pickPhoto() {
    wx.chooseMedia({ count: 1, mediaType: ['image'], sourceType: ['album', 'camera'], sizeType: ['compressed'], success: async r => {
      const src = r.tempFiles[0].tempFilePath, crop = () => new Promise(res => (wx.cropImage ? wx.cropImage({ src, cropScale: '3:4', success: o => res(o.tempFilePath), fail: () => res(src) }) : res(src)));
      try { const path = await crop(); this.setData({ busy: '正在处理照片…' }); const b64 = await this.shrink(path); this._photoB64 = b64; const f = this.photoFile(b64); wx.setStorageSync(PHOTO, { b64, path: f }); this.setData({ busy: '' }); this.resetVideo(); }
      catch (e) { this.setData({ busy: '', err: '照片处理失败：' + (e.errMsg || e.message || e) }); } },
      fail: e => { if (!/cancel/.test(e.errMsg || '')) this.setData({ err: '没能打开相册：' + (e.errMsg || '') }); } });
  },
  // centre-crop to 3:4 and scale to 360×480 on the hidden canvas, then base64
  shrink(path) {
    return new Promise((res, rej) => wx.createSelectorQuery().in(this).select('#card').fields({ node: true }).exec(q => {
      const cv = q && q[0] && q[0].node; if (!cv) return rej(new Error('画布不可用')); cv.width = 360; cv.height = 480; const g = cv.getContext('2d'), im = cv.createImage();
      im.onload = () => { const k = Math.max(360 / im.width, 480 / im.height), w = im.width * k, h = im.height * k; g.fillStyle = '#fff'; g.fillRect(0, 0, 360, 480); g.drawImage(im, (360 - w) / 2, (480 - h) / 2, w, h);
        wx.canvasToTempFilePath({ canvas: cv, x: 0, y: 0, width: 360, height: 480, destWidth: 360, destHeight: 480, fileType: 'jpg', quality: 0.82, success: o => wx.getFileSystemManager().readFile({ filePath: o.tempFilePath, encoding: 'base64', success: f => res(f.data), fail: rej }), fail: rej }); };
      im.onerror = () => rej(new Error('读不了这张图')); im.src = path; }));
  },
  clearPhoto() { this._photoB64 = ''; try { wx.removeStorageSync(PHOTO); } catch (e) {} this.setData({ photo: '' }); this.resetVideo(); },
  saveTags() { try { wx.setStorageSync(TAGS, { zh: this.data.tagZh, en: this.data.tagEn }); } catch (e) {} this.resetVideo(); },
  onTagZh(e) { this.setData({ tagZh: e.detail.value }); this.saveTags(); },
  onTagEn(e) { this.setData({ tagEn: e.detail.value.toUpperCase() }); this.saveTags(); },
  resetTags() { this.setData({ tagZh: TAG_ZH, tagEn: TAG_EN }); this.saveTags(); },
  onName(e) { this.setData({ name: e.detail.value.trim() }); this.share(); this.resetVideo(); this.cardSoon(); },
  onLatin(e) { this.setData({ latin: e.detail.value.toUpperCase().replace(/[^A-Z ]/g, '') }); this.share(); this.resetVideo(); this.cardSoon(); },
  pick(e) { const { k, v } = e.currentTarget.dataset; this.setData({ [k]: v }); this.resetVideo(); },

  /* ---------- video: rendered on the server with the web engine ---------- */
  videoBody() { const d = this.data; return { rows: SS.rowsForServer(), opts: { name: d.name, latin: d.latin, nat: d.nat, tagZh: d.tagZh, tagEn: d.tagEn, photo: this._photoB64 || '', theme: d.theme, mstyle: d.mstyle, len: d.len, year: d.year, up: d.up } }; },
  // with consent, the server starts the film while the user is still reading the stats; tapping 生成视频 with the
  // same choices then picks up that render (or the finished file). Pre-renders only run when the server is idle.
  askPrerender() {
    if (this.data.manualOpen) return;
    if (wx.getStorageSync(CONSENT) || !this.data.sum || !this.data.sum.n) return this.prerender();
    wx.showModal({
      title: '先帮你把视频做好？',
      content: '你看统计的时候，视频就在服务器上开始生成。会上传航段的日期、航班号、出发和到达地，你填的名字、结尾文案和选的照片（如果有）；24 小时后自动删除，不做其他用途。',
      confirmText: '同意', cancelText: '先不用',
      success: r => { if (r.confirm) { wx.setStorageSync(CONSENT, 1); this.prerender(); } },
    });
  },
  prerender() {
    clearTimeout(specTimer);
    if (this.data.manualOpen || !wx.getStorageSync(CONSENT) || !this.data.sum || !this.data.sum.n || this.data.video.state) return;
    specTimer = setTimeout(() => SS.api('/api/video', 'POST', { ...this.videoBody(), spec: true }).catch(() => {}), 3000); // settle typing first
  },
  copySite() { wx.setClipboardData({ data: 'https://passport.nybbq.art', success: () => wx.showToast({ title: '网址已复制，请到浏览器粘贴打开', icon: 'none', duration: 2500 }) }); },
  makeVideo() {
    if (!this.data.sum || !this.data.sum.n || ['queued', 'rendering', 'sending'].includes(this.data.video.state)) return;
    if (wx.getStorageSync(CONSENT)) return this.submitVideo();
    wx.showModal({
      title: '生成视频需要上传航段',
      content: '视频在我们的服务器上渲染：会上传航段的日期、航班号、出发和到达地，你填的名字和结尾文案，以及你选的照片（如果有）。视频生成 24 小时后自动删除，不做其他用途。',
      confirmText: '同意', cancelText: '不用了', // WeChat caps modal button text at 4 characters, or the modal silently fails
      success: r => { if (r.confirm) { wx.setStorageSync(CONSENT, 1); this.submitVideo(); } },
      fail: e => this.setData({ 'video.state': 'error', 'video.err': '弹窗打开失败：' + (e.errMsg || '') }),
    });
  },
  async submitVideo() {
    this.setData({ video: { state: 'sending', progress: 0, ahead: 0, url: '', size: '', err: '' } });
    try {
      clearTimeout(specTimer); SS.track('video_req'); const d = this.data, r = await SS.api('/api/video', 'POST', this.videoBody());
      wx.setStorageSync(LAST, { id: r.id, sig: dataSig(SS.rowsForServer()), opts: { name: d.name, latin: d.latin, nat: d.nat, natIdx: d.natIdx, theme: d.theme, mstyle: d.mstyle, len: d.len, year: d.year, up: d.up } });
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
        if (s.state === 'done') { if (!resume) SS.track('video_ok'); return this.setData({ video: { state: 'done', progress: 1, ahead: 0, url: SS.SITE + s.url, size: (s.size / 1048576).toFixed(1) + ' MB', err: '' } }); }
        if (s.state === 'error') { SS.track('video_fail'); return this.setData({ 'video.state': 'error', 'video.err': '生成失败了，请再点一次「生成视频」；还不行可以用下面的网页版' }); }
        if (s.state === 'cancelled') { wx.removeStorageSync(LAST); return this.setData({ 'video.state': 'error', 'video.err': '这次生成被取消了，请再点一次「生成视频」' }); }
        this._pollFail = 0;
        this.setData({ 'video.state': s.state === 'rendering' ? 'rendering' : 'queued', 'video.progress': Math.round((s.progress || 0) * 100), 'video.ahead': s.ahead || 0 });
      } catch (e) {
        if (e.code === 404) { wx.removeStorageSync(LAST); return this.setData({ video: resume ? { state: '', progress: 0, ahead: 0, url: '', size: '', err: '' } : { state: 'error', progress: 0, ahead: 0, url: '', size: '', err: '这次生成中断了（服务器刚重启），请再点一次「生成视频」' } }); }
        this._pollFail = (this._pollFail || 0) + 1; /* transient: keep polling, but not for ever (about a minute without any answer) */
        if (this._pollFail >= 20) { this._pollFail = 0; return this.setData({ 'video.state': 'error', 'video.err': '连不上服务器，请检查网络后再点「生成视频」（已经开始的视频不会丢）' }); }
      }
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
    try { const f = await this.localVideo(); wx.saveVideoToPhotosAlbum({ filePath: f, success: () => SS.track('video_save') || wx.showModal({ title: '已保存到相册', content: '发朋友圈：打开朋友圈 → 右上角相机 → 从相册选择这段视频。', showCancel: false }), fail: e => this.albumDenied(e) }); }
    catch (e) { wx.showToast({ title: e.message, icon: 'none' }); }
  },
  async sendVideo() {
    if (!this.data.video.url || this.data.saving) return;
    try { const f = await this.localVideo(); SS.track('video_send'); wx.shareVideoMessage({ videoPath: f, fail: e => { if (!/cancel/.test(e.errMsg || '')) wx.showToast({ title: '发送失败', icon: 'none' }); } }); }
    catch (e) { wx.showToast({ title: e.message, icon: 'none' }); }
  },
  albumDenied(e) {
    if (/cancel/.test((e && e.errMsg) || '')) return;
    wx.showModal({ title: '需要相册权限', content: '请在设置里允许「保存到相册」，再点一次保存。', confirmText: '去设置', success: r => { if (r.confirm) wx.openSetting(); } });
  },

  onShareAppMessage() { const d = this.data; if (d.card) SS.track('share_card'); return { title: d.sum && d.sum.n ? `${d.name || '我'}的航迹手帐：${d.sum.n} 次起飞，${d.sum.cc} 个国家和地区` : '把航班记录做成一本会动的护照', path: '/pages/index/index', imageUrl: d.card || SS.SITE + '/mp/share.jpg' }; }, // share card image is 5:4
});
