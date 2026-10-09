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
rsync -az --delete -e "${SSH[*]}" public/ "$DEPLOY_HOST:$APP/public/"
rsync -az --delete -e "${SSH[*]}" api server "$DEPLOY_HOST:$APP/"
"${SSH[@]}" "$DEPLOY_HOST" "systemctl restart sky-passport && sleep 1 && curl -fsS http://127.0.0.1:3100/api/health && nginx -t -q && systemctl reload nginx"
echo "deployed to $DEPLOY_HOST"
