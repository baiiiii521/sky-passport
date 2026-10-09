// China outline for the map, following the mainland standard map (incl. Taiwan, 藏南, 阿克赛钦, South China Sea islands)
// plus the nine-dash line. Source: Aliyun DataV.GeoAtlas (AutoNavi data). Writes public/china.json.
const fs = require('fs');
const path = require('path');
const URL_BOUND = 'https://geo.datav.aliyun.com/areas_v3/bound/100000.json';
const URL_FULL = 'https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json';
const round = g => JSON.parse(JSON.stringify(g, (k, v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v)));

(async () => {
  const [bound, full] = await Promise.all([URL_BOUND, URL_FULL].map(u => fetch(u).then(r => { if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); })));
  const cn = bound.features[0].geometry;
  const jd = full.features.find(f => String(f.properties.adcode) === '100000_JD');
  if (!jd) throw new Error('nine-dash line feature missing');
  const out = { source: 'Aliyun DataV.GeoAtlas (AutoNavi)', cn: round(cn), jd: round(jd.geometry) };
  fs.writeFileSync(path.join(__dirname, '..', 'public', 'china.json'), JSON.stringify(out));
  console.log('china.json', JSON.stringify(out).length, 'bytes');
})().catch(e => { console.error(e); process.exit(1); });
