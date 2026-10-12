// Screenshot import: OCR text boxes → flights (server/shots.js). The boxes below follow a real 航旅纵横「已结束」list.
const test = require('node:test');
const assert = require('node:assert');
const { parseShots, place } = require('../server/shots.js');

const B = (t, x, y, w, h) => ({ t, x, y, w, h });
const header = [B('待出行', 205, 180, 120, 45), B('已结束', 435, 175, 150, 55), B('家人行程', 675, 180, 165, 45), B('航班', 85, 310, 85, 42), B('火车', 340, 310, 85, 42),
  B('13 次', 125, 555, 95, 45), B('累计次数', 100, 608, 140, 36), B('28 h 1 min', 418, 555, 185, 45), B('累计时长', 440, 608, 140, 36), B('16626 km', 760, 555, 185, 45), B('累计里程', 780, 608, 140, 36),
  B('更多航线图、热力图数据', 298, 695, 395, 38), B('历史行程', 45, 840, 185, 48), B('标签', 728, 845, 70, 36), B('筛选', 875, 845, 70, 36)];
const card = (y, md, yr, air, t1, p1, t2, p2, split) => [B(md, 45, y, 110, 45), B(yr, 45, y + 50, 70, 30), B('去点评', 828, y - 30, 130, 35),
  ...(split ? [B(air.split(' ')[0], 270, y + 5, 150, 40), B(air.split(' ')[1], 438, y + 5, 137, 40)] : [B(air, 270, y + 5, 305, 40)]),
  ...(split ? [B(t1, 270, y + 85, 100, 40), B(p1, 414, y + 85, 205, 40), B(t2, 270, y + 152, 105, 40), B(p2, 414, y + 152, 150, 40)] : [B(t1 + ' ' + p1, 270, y + 85, 350, 40), B(t2 + ' ' + p2, 270, y + 152, 300, 40)])];
const footer = [B('+添加行程', 835, 1795, 165, 40), B('去点评', 828, 1870, 130, 35), B('4条 更早历史行程待解锁', 97, 1935, 420, 40), B('去解锁', 775, 1935, 100, 38)];
const want = [
  { date: '2026-05-11', fn: 'RY6627', al: '江西航空', from: '南昌昌北', to: '南阳姜营', dt: '11:30', at: '12:50' },
  { date: '2026-05-08', fn: 'RY6628', al: '江西航空', from: '南阳姜营', to: '南昌昌北', dt: '18:40', at: '20:00' },
  { date: '2024-10-01', fn: '9C8711', al: '春秋航空', from: '南阳姜营', to: '兰州中川', dt: '13:00', at: '15:00' }];
const list = split => [...header, ...card(980, '05-11', '2026', '江西航空 RY6627', '11:30', '南昌昌北T2', '12:50', '南阳姜营', split), ...card(1286, '05-08', '2026', '江西航空 RY6628', '18:40', '南阳姜营', '20:00', '南昌昌北T2', split),
  ...card(1592, '10-01', '2024', '春秋航空 9C8711', '13:00', '南阳姜营', '15:00', '兰州中川', split), ...footer];
const strip = f => ({ date: f.date, fn: f.fn, al: f.al, from: f.from, to: f.to, dt: f.dt, at: f.at });

test('航旅纵横 list: one box per word', () => assert.deepStrictEqual(parseShots(list(true)).map(strip), want));
test('航旅纵横 list: time and place merged into one box', () => assert.deepStrictEqual(parseShots(list(false)).map(strip), want));
test('boxes in any order give the same flights', () => assert.deepStrictEqual(parseShots(list(true).reverse()).map(strip), want));
test('a card layout with both times on one row and the cities below', () => {
  const d = [B('2025年3月2日 周日', 40, 100, 300, 36), B('中国东方航空 MU 5101', 40, 150, 360, 36), B('08:00', 60, 230, 110, 50), B('10:20', 560, 230, 110, 50), B('上海虹桥T2', 50, 300, 170, 34), B('北京首都T2', 540, 300, 170, 34), B('2小时20分', 300, 240, 130, 30)];
  assert.deepStrictEqual(parseShots(d).map(strip), [{ date: '2025-03-02', fn: 'MU5101', al: '中国东方航空', from: '上海虹桥', to: '北京首都', dt: '08:00', at: '10:20' }]);
});
test('no year next to the day: the date is left for the user', () => {
  const f = parseShots([B('05-11', 45, 100, 110, 45), B('江西航空 RY6627', 270, 105, 305, 40), B('11:30 南昌昌北T2', 270, 185, 350, 40), B('12:50 南阳姜营', 270, 250, 300, 40)])[0];
  assert.strictEqual(f.date, ''); assert.strictEqual(f.md, '05-11'); assert.strictEqual(f.from, '南昌昌北');
});
test('numbers that are not flights are ignored; nothing found gives an empty list', () => { assert.deepStrictEqual(parseShots(header), []); assert.deepStrictEqual(parseShots([]), []); assert.deepStrictEqual(parseShots(null), []); });
test('place names lose terminals and brackets', () => { assert.strictEqual(place('南昌昌北T2'), '南昌昌北'); assert.strictEqual(place('北京大兴国际机场'), '北京大兴'); assert.strictEqual(place('上海浦东 T1（国际）'), '上海浦东'); assert.strictEqual(place('。 南昌昌北T2'), '南昌昌北'); });
test('real OCR answer for a 航旅纵横「已结束」screenshot (GeneralBasicOCR, 2026-10-12)', () => {
  const fx = require('./fixtures/shot_hanglv.json');
  assert.deepStrictEqual(parseShots(fx.boxes).map(strip), fx.flights.map(strip)); assert.strictEqual(fx.flights.length, 3);
});
