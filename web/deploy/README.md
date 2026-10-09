# Deploying to a Tencent Cloud server (ICP-filed domain)

Layout on the server: `/srv/sky-passport/{public,api,server}`; Nginx serves `public/`, proxies `/api/` to the Node API on 127.0.0.1:3100 (systemd unit `sky-passport`).

First time (done once over SSH):
1. Node ≥ 18 and Nginx installed; `nginx.conf.template` → `/etc/nginx/conf.d/sky-passport.conf` with the domain and certificate paths filled in (Tencent Cloud free SSL certificate, or Let's Encrypt via the `/.well-known/acme-challenge/` location).
2. `/etc/sky-passport.env` (mode 600): `TYPESAFE_API_KEY=…`, `ALLOWED_ORIGINS=https://<domain>`, `PORT=3100`.
3. `sky-passport.service` → `/etc/systemd/system/`, then `systemctl enable --now sky-passport`.
4. Tencent Cloud security group: open 80 and 443.

Every update: `cd web && DEPLOY_HOST=root@<server-ip> ./deploy/deploy.sh` (runs the tests, rsyncs, restarts the API, reloads Nginx).
Before the first upload run `npm run build:data`, `npm run build:china`, `npm run build:fonts` once so flags/, china.json and fonts/ exist.
