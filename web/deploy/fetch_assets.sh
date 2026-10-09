#!/usr/bin/env bash
# Build the large generated assets ON the server from mirrors reachable in mainland China
# (npmmirror, Aliyun DataV, fonts.googleapis.cn) instead of uploading ~15 MB over a slow link.
# Produces public/{airports.json,world-50m.json,flags/,china.json,fonts/,vendor/}. Run on the server:
#   bash /srv/sky-passport/deploy/fetch_assets.sh
set -euo pipefail
APP=/srv/sky-passport; B=$APP/build; export PATH=/opt/node20/bin:$PATH
mkdir -p "$B" && cd "$B"
cp "$APP/package.json" . && rm -rf scripts && cp -r "$APP/scripts" . && ln -sfn "$APP/public" public
npm install --no-audit --no-fund --no-save --registry=https://registry.npmmirror.com \
  @nwpr/airport-codes@3.0.3 i18n-iso-countries@7.11.3 flag-icons@7.2.3 world-atlas@2.0.2 \
  d3@7.9.0 topojson@3.0.2 xlsx@0.18.5 mp4-muxer@5.2.1 qrcode-generator@1.4.4 >/dev/null
node scripts/build_data.js
node scripts/build_china.js
FONTS_CSS_BASE=https://fonts.googleapis.cn node scripts/vendor_fonts.js
mkdir -p public/vendor
cp node_modules/d3/dist/d3.min.js node_modules/topojson/dist/topojson.min.js node_modules/xlsx/dist/xlsx.full.min.js node_modules/mp4-muxer/build/mp4-muxer.js public/vendor/
cp node_modules/qrcode-generator/qrcode.js public/vendor/qrcode.min.js
ls public/flags | wc -l; du -sh public/fonts public/vendor; ls -la public/*.json
