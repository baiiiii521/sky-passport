// Unit tests for the spreadsheet parsing / diagnosis (public/js/core.js) and the loudness helpers (public/js/music.js).
// Run: npm test   (Node ≥ 18, no dependencies; the browser scripts are loaded into a vm context)
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PUB = path.join(__dirname, '..', 'public');
function load(files, extra = '') {
  const ctx = vm.createContext({
    console, Intl, Math, Date, JSON, Set, Map, Float32Array, Float64Array, Promise,
    XLSX: { SSF: { parse_date_code: n => { const d = new Date(Date.UTC(1899, 11, 30) + n * 864e5); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() }; } } },
  });
  const src = files.map(f => fs.readFileSync(path.join(PUB, 'js', f), 'utf8')).join('\n') + '\n' + extra;
  vm.runInContext(src, ctx, { filename: files.join('+') });
  return ctx;
}
const core = load(['core.js'], `
ingestAirports(${fs.readFileSync(path.join(PUB, 'airports.json'), 'utf8')});
globalThis.T = { parseDate, dateProblem, parseTime, findCols, readSheet, detectDateOrder, resolveAirport, buildFlights, rowStatus,
  setRaw: r => { RAW = r; }, STFIX: () => STFIX, EXCL: () => EXCL, manual, getDMY: () => DMY, colName, ymd };`).T;
const row = (o, i) => ({ rawDate: '', al: '', fn: '', from: '', to: '', dt: '', at: '', km: '', st: '已使用', sheetUp: false, sheetVoid: false, src: { sheet: 'S', row: i + 2, cols: { date: 'A', from: 'D', to: 'E' } }, ...o });

test('parseDate: the formats people actually type', () => {
  const P = core.parseDate;
  assert.deepEqual([...P('2024-05-01')], [2024, 5, 1]);
  assert.deepEqual([...P('2024年5月1日 周三')], [2024, 5, 1]);
  assert.deepEqual([...P('2024/5/1')], [2024, 5, 1]);
  assert.deepEqual([...P('2024.05.01')], [2024, 5, 1]);
  assert.deepEqual([...P('05/01/2024')], [2024, 5, 1]); // month-first by default
  assert.deepEqual([...P('1 May 2024')], [2024, 5, 1]);
  assert.deepEqual([...P('01-May-24')], [2024, 5, 1]);
  assert.deepEqual([...P('May 1st, 2024')], [2024, 5, 1]);
  assert.deepEqual([...P(45413)], [2024, 5, 1]); // Excel serial
  assert.equal(P('2024-13-01'), null);
  assert.equal(P(''), null);
  assert.equal(P('5月1日'), null);
});

test('dateProblem explains why a date was skipped', () => {
  assert.equal(core.dateProblem(''), 'empty');
  assert.equal(core.dateProblem('5月8日'), 'no_year');
  assert.equal(core.dateProblem('OPEN'), 'open');
  assert.equal(core.dateProblem('next tuesday'), 'bad');
});

test('detectDateOrder switches to day-first only when the data proves it', () => {
  core.detectDateOrder([{ rawDate: '25/12/2023' }, { rawDate: '03/04/2024' }]);
  assert.equal(core.getDMY(), true);
  assert.deepEqual([...core.parseDate('03/04/2024')], [2024, 4, 3]);
  core.detectDateOrder([{ rawDate: '03/04/2024' }]);
  assert.equal(core.getDMY(), false);
});

test('findCols maps Chinese and English headers', () => {
  const m = core.findCols(['日期', '航班号', '航空公司', '出发', '到达', '出发时间', '到达时间', '里程数', '客票状态']);
  assert.equal(m.date, 0); assert.equal(m.fn, 1); assert.equal(m.al, 2); assert.equal(m.from, 3); assert.equal(m.to, 4); assert.equal(m.st, 8);
  const e = core.findCols(['Flight Date', 'Flight No', 'Origin', 'Destination']);
  assert.equal(e.date, 0); assert.equal(e.fn, 1); assert.equal(e.from, 2); assert.equal(e.to, 3);
});

test('readSheet keeps the spreadsheet position of every row', () => {
  const aoa = [['我的记录'], ['日期', '航班号', '出发', '到达'], ['2024-05-01', 'MU5101', '上海虹桥', '北京首都'], ['', '', '', ''], ['2024-05-06', 'CA1519', 'PEK', 'SHA']];
  const rows = core.readSheet(aoa, 'Sheet1', 1, { date: 0, fn: 1, from: 2, to: 3 });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].src.row, 3); assert.equal(rows[1].src.row, 5);
  assert.equal(rows[0].src.cols.from, 'C');
  assert.equal(core.colName(26), 'AA');
});

test('resolveAirport: IATA, Chinese names, manual fixes', () => {
  assert.equal(core.resolveAirport('pvg'), 'PVG');
  assert.equal(core.resolveAirport('上海浦东国际机场'), 'PVG');
  assert.equal(core.resolveAirport('浦栋'), null);
  core.manual['浦栋'] = 'PVG';
  assert.equal(core.resolveAirport('浦栋'), 'PVG');
  delete core.manual['浦栋'];
});

test('buildFlights reports every problem with its row', () => {
  core.setRaw([
    row({ rawDate: '2024-05-01', fn: 'MU5101', from: 'PVG', to: 'PEK' }, 0),
    row({ rawDate: '2024-05-01', fn: 'MU5101', from: 'PVG', to: 'PEK' }, 1), // duplicate
    row({ rawDate: '2024-05-02', fn: 'CA1', from: '浦栋', to: 'PEK' }, 2), // unknown name
    row({ rawDate: '5月8日', fn: 'MU583', from: 'PVG', to: 'LAX' }, 3), // no year
    row({ rawDate: '2024-06-01', fn: 'G1234', from: '上海虹桥站', to: '北京南站' }, 4), // train
    row({ rawDate: '2024-06-02', fn: 'MU1', from: 'SHA', to: 'SHA' }, 5), // same airport
    row({ rawDate: '2024-06-03', fn: 'MU2', from: 'PVG', to: 'NRT', st: '已改期' }, 6), // unknown status
    row({ rawDate: '2024-06-04', fn: 'MU3', from: 'PVG', to: 'HKG', st: '已退票' }, 7), // void
  ]);
  const r = core.buildFlights(), d = r.diag;
  assert.deepEqual([...d.refs.keys()], ['浦栋']);
  assert.equal(d.refs.get('浦栋').rows[0].r.src.row, 4);
  assert.equal(d.noDate.length, 1);
  assert.equal(d.suspect.length, 1); assert.equal(d.suspect[0].fn, 'G1234');
  assert.equal(d.sameAp.length, 1);
  assert.equal(d.dup, 1);
  assert.deepEqual([...d.unknownSt.keys()], ['已改期']);
  assert.equal(r.all.find(f => f.fn === 'MU3').vd, 1);
  // accepted fixes change the result
  core.STFIX()['已改期'] = 'void';
  core.EXCL().add('S#6');
  const r2 = core.buildFlights();
  assert.equal(r2.all.find(f => f.fn === 'MU2').vd, 1);
  assert.equal(r2.diag.excluded, 1);
  assert.equal(r2.all.some(f => f.fn === 'G1234'), false);
});

test('loudness meter and limiter (BS.1770)', () => {
  const m = load(['core.js', 'music.js'], 'globalThis.M={lufs,limiter};').M;
  const SR = 48000, n = SR * 3, L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i++) L[i] = R[i] = Math.sin(2 * Math.PI * 997 * i / SR) * 0.5; // −6 dBFS sine, both channels
  const v = m.lufs(L, R, SR);
  assert.ok(Math.abs(v - (-6.0)) < 0.3, 'stereo −6 dBFS 1 kHz sine ≈ −6 LUFS, got ' + v.toFixed(2));
  for (let i = 0; i < n; i++) { L[i] *= 3; R[i] *= 3; }
  const ceil = Math.pow(10, -1.6 / 20);
  m.limiter(L, R, SR, ceil);
  let pk = 0; for (let i = 0; i < n; i++) pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i]));
  assert.ok(pk <= ceil + 1e-6, 'peak ' + pk);
});

// ---- v3: overseas export formats and the column-mapping fixes (2026-10-10) ----
test('findCols: one column per role, whole words only', () => {
  const F = h => ({ ...core.findCols(h) });
  // "Departure Time" used to be read as both the departure time and the origin airport
  assert.deepEqual(F(['Date', 'Flight', 'Departure Time', 'Departure Airport', 'Arrival Airport', 'Arrival Time']), { date: 0, fn: 1, dt: 2, from: 3, to: 4, at: 5 });
  // OpenFlights: "Distance" must not become the arrival time ("di-sta-nce"), and its unit is unknown
  const of = F(['Date', 'From', 'To', 'Flight_Number', 'Airline', 'Distance', 'Duration']);
  assert.equal(of.dist, 5); assert.equal(of.at, undefined); assert.equal(of.km, undefined); assert.equal(of.fn, 3);
  // Flighty: scheduled gate times, cancellation flag
  const fl = F(['Date', 'Airline', 'Flight', 'From', 'To', 'Canceled', 'Gate Departure (Scheduled)', 'Landing (Scheduled)', 'Gate Arrival (Scheduled)']);
  assert.equal(fl.dt, 6); assert.equal(fl.at, 8); assert.equal(fl.cx, 5);
  // 航旅纵横 / template still map as before
  assert.deepEqual(F(['日期', '航班号', '航空公司', '出发', '到达', '出发时间', '到达时间', '里程数', '状态']), { date: 0, fn: 1, al: 2, from: 3, to: 4, dt: 5, at: 6, km: 7, st: 8 });
});

test('resolveAirport: myFlightradar24 brackets, English names, codes in mixed text', () => {
  const R = core.resolveAirport;
  assert.equal(R('Shanghai / Pudong (PVG/ZSPD)'), 'PVG');
  assert.equal(R('Hong Kong / Chek Lap Kok (HKG/VHHH)'), 'HKG');
  assert.equal(R('London Heathrow Airport'), 'LHR');
  assert.equal(R('John F. Kennedy International Airport'), 'JFK');
  assert.equal(R('Shanghai Pudong International Airport'), 'PVG');
  assert.equal(R('PVG - Shanghai Pudong'), 'PVG');
  assert.equal(R('上海浦东'), 'PVG');
  assert.equal(R('Nowhere Field'), null);
});

test('parseDate / parseTime: compact dates and 12-hour clocks', () => {
  assert.deepEqual([...core.parseDate('20240501')], [2024, 5, 1]);
  assert.deepEqual([...core.parseDate(20240501)], [2024, 5, 1]);
  assert.deepEqual([...core.parseTime('8:30 PM')], [20, 30]);
  assert.deepEqual([...core.parseTime('12:05 am')], [0, 5]);
  assert.deepEqual([...core.parseTime('2024-01-05T11:05')], [11, 5]);
  assert.deepEqual([...core.parseTime('20:30')], [20, 30]);
  assert.equal(core.parseTime('25:00'), null);
});

test('readSheet + buildFlights: miles, cancellations, bare flight numbers, time inside the date cell', () => {
  const of = [['Date', 'From', 'To', 'Flight_Number', 'Airline', 'Distance'], ['2019-06-01 08:00:00', 'PEK', 'JFK', 'CA981', 'Air China', '6844']];
  const fl = [['Date', 'Airline', 'Flight', 'From', 'To', 'Canceled'], ['2024-03-01', 'BAW', '117', 'LHR', 'JFK', 'true'], ['2024-03-05', 'BAW', '118', 'JFK', 'LHR', 'false']];
  const rows = [...core.readSheet(of, 'openflights', 0, core.findCols(of[0])), ...core.readSheet(fl, 'flighty', 0, core.findCols(fl[0]))];
  core.setRaw(rows); const { all } = core.buildFlights();
  const pek = all.find(f => f.f === 'PEK');
  assert.ok(pek.km > 10900 && pek.km < 11100, 'OpenFlights miles converted to km: ' + pek.km);
  assert.equal(pek.t, '08:00');
  const lhr = all.find(f => f.f === 'LHR'), jfk = all.find(f => f.f === 'JFK');
  assert.equal(lhr.fn, 'BAW117'); assert.equal(lhr.vd, 1); assert.equal(jfk.vd, 0);
});

test('every page script parses (a stray // inside a one-line statement once broke the whole page)', () => {
  for (const f of fs.readdirSync(path.join(PUB, 'js')).filter(f => f.endsWith('.js'))) {
    assert.doesNotThrow(() => new vm.Script(fs.readFileSync(path.join(PUB, 'js', f), 'utf8'), { filename: f }), f);
  }
});

test('index.html stamps are current (run: npm run stamp)', () => {
  const { stamp } = require('../scripts/stamp.js'); const html = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8');
  assert.equal(stamp(html), html);
});
