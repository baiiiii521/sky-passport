// Stats and achievements for the mini program — same definitions as the web (engine.js stats(), extras.js computeBadges()).
const C = require('./core.js');

let zhRev = null;
function placeName(code) {
  if (!zhRev) { zhRev = {}; for (const k of C.ZHKEYS) { const c = C.ZH[k]; if (!zhRev[c] || k.length > zhRev[c].length) zhRev[c] = k; } }
  const a = C.AP[code];
  return a ? (zhRev[code] || a.city) : code;
}
const fmt = n => Math.round(n).toLocaleString('en-US');

// flights in the film/poster: void tickets out, upcoming optional, optional single year
function pick(all, { up = true, year = 0 } = {}) {
  return all.filter(f => !f.vd && (up || !f.up) && (!year || f.y === year));
}

function summarize(list, home) {
  const al = new Set(), ap = new Set(), cc = new Set([home]);
  let km = 0, min = 0;
  for (const f of list) {
    km += f.km; min += f.min; ap.add(f.f); ap.add(f.to); cc.add(f.fc); cc.add(f.tc);
    if (f.al && f.al !== '--') al.add(f.al); else if (f.fn && f.fn !== '—') al.add(f.fn.slice(0, 2));
  }
  const years = [];
  for (const f of list) { let y = years.find(v => v.y === f.y); if (!y) years.push(y = { y: f.y, n: 0 }); y.n++; }
  years.sort((a, b) => a.y - b.y);
  return { n: list.length, km: Math.round(km), min: Math.round(min), cc: cc.size, ap: ap.size, al: al.size, years,
    y0: years.length ? years[0].y : 0, y1: years.length ? years[years.length - 1].y : 0 };
}

function badges(list, home) {
  const flown = list.filter(f => !f.up), L = flown.length ? flown : list;
  if (!L.length) return [];
  const out = [], cnt = (arr, key) => { const m = new Map(); for (const x of arr) { const k = key(x); m.set(k, (m.get(k) || 0) + 1); } return [...m.entries()].sort((a, b) => b[1] - a[1]); };
  const first = L.find(f => f.fc !== home || f.tc !== home);
  if (first) out.push({ i: '🛂', k: '首次出境', v: `${placeName(first.f)} → ${placeName(first.to)}`, d: first.date });
  const lng = L.reduce((a, b) => (b.km > a.km ? b : a));
  out.push({ i: '📏', k: '最长单程', v: `${fmt(lng.km)} km`, d: `${placeName(lng.f)} → ${placeName(lng.to)} · ${lng.fn}` });
  const route = cnt(L, f => [f.f, f.to].sort().join('-'))[0];
  if (route && route[1] > 1) { const [a, b] = route[0].split('-'); out.push({ i: '🔁', k: '最常飞航线', v: `${placeName(a)} ⇄ ${placeName(b)}`, d: `${route[1]} 次` }); }
  const aps = cnt(L.flatMap(f => [f.f, f.to]), x => x), base = aps[0][0];
  out.push({ i: '🛫', k: '最常去的机场', v: `${placeName(base)} ${base}`, d: `${aps[0][1]} 次起降` });
  let far = null, fk = 0;
  for (const [c] of aps) { const d = C.hav(C.AP[base], C.AP[c]); if (d > fk) { fk = d; far = c; } }
  if (far) out.push({ i: '🧭', k: '飞得最远的地方', v: placeName(far), d: `离${placeName(base)} ${fmt(fk)} km` });
  const ys = cnt(L, f => f.y);
  if (ys.length > 1) out.push({ i: '📅', k: '最忙的一年', v: `${ys[0][0]} 年`, d: `${ys[0][1]} 段航班` });
  const red = L.filter(f => f.hasT && (+f.t.slice(0, 2) >= 22 || +f.t.slice(0, 2) < 6)).length;
  if (red) out.push({ i: '🌙', k: '红眼航班', v: `${red} 次`, d: '22:00–06:00 起飞' });
  const km = L.reduce((a, f) => a + f.km, 0), min = L.reduce((a, f) => a + f.min, 0);
  out.push({ i: '⏱️', k: '在空中的时间', v: `${(min / 1440).toFixed(1)} 天`, d: `${Math.round(min / 60)} 小时` });
  const kg = km * 0.09;
  out.push({ i: '🌱', k: '碳排放（估算）', v: kg >= 1000 ? `${(kg / 1000).toFixed(1)} 吨 CO₂` : `${Math.round(kg)} kg CO₂`, d: `约 ${Math.max(1, Math.round(kg / 20))} 棵树一年的吸收量` });
  out.push({ i: '🌍', k: '飞行距离', v: `绕地球 ${(km / 40075).toFixed(2)} 圈`, d: `地月距离的 ${Math.round(km / 384400 * 100)}%` });
  return out;
}

module.exports = { pick, summarize, badges, placeName, fmt };
