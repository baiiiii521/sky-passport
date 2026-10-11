#!/usr/bin/env bash
# Push the site to the Tencent Cloud server and restart the API.
#   DEPLOY_HOST=root@1.2.3.4 ./deploy/deploy.sh          (run from web/)
# First-time server setup (Node, Nginx, TLS, env file) is described in deploy/README.md.
set -euo pipefail
: "${DEPLOY_HOST:?set DEPLOY_HOST=user@host}"
KEY="${DEPLOY_KEY:-$HOME/.ssh/sky_passport_deploy}"
APP=/srv/sky-passport
SSH=(ssh -i "$KEY" -o IdentitiesOnly=yes)
cd "$(dirname "$0")/.."
npm test --silent
"${SSH[@]}" "$DEPLOY_HOST" "mkdir -p $APP"
# code only: fonts/, flags/, vendor/ and the data JSON are built on the server from China mirrors (deploy/fetch_assets.sh);
# mp/ and promo/ (540p copies) come from the public assets repo, pulled on the server
rsync -az --delete -e "${SSH[*]}" --exclude fonts/ --exclude flags/ --exclude vendor/ --exclude mp/ --exclude promo/ --exclude "*.json" public/ "$DEPLOY_HOST:$APP/public/"
rsync -az --delete -e "${SSH[*]}" api server scripts deploy package.json "$DEPLOY_HOST:$APP/"
# the server has its own fonts/vendor/data files: stamp index.html with their hashes there
"${SSH[@]}" "$DEPLOY_HOST" "cd $APP && /opt/node20/bin/node scripts/stamp.js"
"${SSH[@]}" "$DEPLOY_HOST" "sudo systemctl restart sky-passport sky-passport-render && sleep 1 && curl -fsS http://127.0.0.1:3100/api/health && sudo nginx -t -q && sudo systemctl reload nginx"
# fonts, vendor, sfx, mp, promo and the data JSON are served from the bucket (deploy/COS.md): upload whatever changed
"${SSH[@]}" "$DEPLOY_HOST" "cd $APP && [ -f cos.env ] && (set -a; . ./cos.env; set +a; /opt/node20/bin/node server/cos_sync.js) || echo 'COS sync skipped or failed: run server/cos_sync.js on the server'"
echo "deployed to $DEPLOY_HOST"
