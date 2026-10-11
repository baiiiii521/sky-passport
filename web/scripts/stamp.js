// Stamp index.html with content hashes so browsers can cache scripts and data for a long time and still get every update:
//   <script src="js/core.js?v=1a2b3c4d">, the fonts stylesheet, and an inline block with ASSET_V (data files, sound sprite)
//   and LIBS (libraries that are only downloaded when needed).   Run: npm run stamp   (npm test fails if it is stale)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const PUB = path.join(__dirname, '..', 'public');
const h = f => crypto.createHash('md5').update(fs.readFileSync(path.join(PUB, f))).digest('hex').slice(0, 8);
const hOpt = f => (fs.existsSync(path.join(PUB, f)) ? h(f) : '0');   // fonts.css and the JSON are generated files: absent in a fresh clone
function stamp(html) {
  html = html.replace(/(src|href)="((?:js|vendor|fonts)\/[\w.\-/]+\.(?:js|css))(?:\?v=\w+)?"/g, (m, a, f) => `${a}="${f}?v=${hOpt(f)}"`);
  const data = crypto.createHash('md5').update(['airports.json', 'world-50m.json', 'china.json', 'sfx/film.mp3'].map(hOpt).join()).digest('hex').slice(0, 8);
  const block = `<script>/*stamp*/var ASSET_V="${data}",LIBS={xlsx:"vendor/xlsx.full.min.js?v=${hOpt('vendor/xlsx.full.min.js')}",muxer:"vendor/mp4-muxer.js?v=${hOpt('vendor/mp4-muxer.js')}"};</script>`;
  if (!/<script>\/\*stamp\*\/.*?<\/script>/.test(html)) throw new Error('stamp block missing in index.html');
  return html.replace(/<script>\/\*stamp\*\/.*?<\/script>/, block);
}
module.exports = { stamp };
if (require.main === module) { const p = path.join(PUB, 'index.html'), a = fs.readFileSync(p, 'utf8'), b = stamp(a); if (a !== b) fs.writeFileSync(p, b); console.log(a === b ? 'index.html: stamps are current' : 'index.html: stamped'); }
