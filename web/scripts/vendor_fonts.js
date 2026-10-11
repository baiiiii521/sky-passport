// Self-host the Google Fonts the page uses (Google Fonts is unreachable from mainland China).
// Downloads the CSS as a modern browser would get it (woff2 + unicode-range slices), saves every file under
// public/fonts/ and writes public/fonts/fonts.css pointing at them. Browsers still fetch only the slices they need.
const fs = require('fs');
const path = require('path');
const FAMILIES = 'family=Open+Sans:wght@400;600;700&family=Space+Mono:wght@400;700&family=Noto+Serif+SC:wght@600;900&family=Noto+Sans+SC:wght@400;500;700&display=swap';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const OUT = path.join(__dirname, '..', 'public', 'fonts');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  // FONTS_CSS_BASE=https://fonts.googleapis.cn when running inside mainland China (same files, served from fonts.gstatic.cn)
  let css = await (await fetch((process.env.FONTS_CSS_BASE || 'https://fonts.googleapis.com') + '/css2?' + FAMILIES, { headers: { 'User-Agent': UA } })).text();
  const urls = [...new Set(css.match(/https:\/\/fonts\.gstatic\.(com|cn)\/[^)]+/g) || [])];
  let bytes = 0, i = 0;
  const queue = [...urls];
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (queue.length) {
      const u = queue.shift(), name = u.split('/').slice(-2).join('_').replace(/[^\w.-]/g, '_');
      const file = path.join(OUT, name);
      if (!fs.existsSync(file)) { const r = await fetch(u); if (!r.ok) throw new Error(u + ' ' + r.status); fs.writeFileSync(file, Buffer.from(await r.arrayBuffer())); }
      bytes += fs.statSync(file).size; i++;
      css = css.split(u).join(name);
    }
  }));
  css = css.replace(/\/\*[^*]*\*\//g, '').replace(/\s*([{};:,])\s*/g, '$1').replace(/;}/g, '}').trim();   // 541 rules: minified, the sheet is ~30 % smaller
  fs.writeFileSync(path.join(OUT, 'fonts.css'), css);
  console.log(`fonts: ${i} files, ${(bytes / 1048576).toFixed(1)} MB → public/fonts/`);
})().catch(e => { console.error(e); process.exit(1); });
