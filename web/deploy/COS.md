# 成片走腾讯云 COS（对象存储）

服务器上行只有 3 Mbps。开启后，渲染完成的 MP4 会从服务器内网上传到 COS，用户从 COS 下载；小程序和接口都不用改，
`/v/<id>.mp4` 这个地址不变，由 nginx 302 跳转到存储桶。上传失败时自动退回原来的本地下载。

## 1. 控制台（一次性）
1. 对象存储 COS → 创建存储桶：地域选**和服务器同一个地域**（内网上传免流量费），访问权限「公有读私有写」。
2. 存储桶 → 基础配置 → 生命周期：新增规则，前缀 `v/`，「1 天后删除」。
3. 访问管理 CAM → 新建子用户（编程访问），只授予这个桶的 `cos:PutObject`（资源 `qcs::cos:<地域>:uid/<APPID>:<桶名>/v/*`），记下 SecretId / SecretKey。
4. 小程序后台 → 开发管理 → 服务器域名 → downloadFile 合法域名，加上 `https://<桶名>-<APPID>.cos.<地域>.myqcloud.com`。

## 2. 服务器
```bash
sudo tee /srv/sky-passport/cos.env >/dev/null <<'ENV'
COS_BUCKET=<桶名>-<APPID>
COS_REGION=ap-guangzhou
COS_SECRET_ID=<SecretId>
COS_SECRET_KEY=<SecretKey>
ENV
sudo chmod 600 /srv/sky-passport/cos.env && sudo chown ubuntu /srv/sky-passport/cos.env
```
systemd：`sky-passport-render.service` 的 `[Service]` 里加 `EnvironmentFile=-/srv/sky-passport/cos.env`。

nginx（`/etc/nginx/sites-available/sky-passport`，把原来的 `location /v/ {…}` 换成）：
```nginx
location ~ "^/v/([a-f0-9]{24}\.mp4)$" {   # quoted: a regex with braces must be
  root /srv/sky-passport; types { video/mp4 mp4; } add_header Cache-Control "public, max-age=86400";
  try_files /videos/$1 @cos;          # still on the box (upload failed or COS off) → serve it; otherwise → the bucket
}
location @cos { return 302 https://<桶名>-<APPID>.cos.<地域>.myqcloud.com$request_uri; }
```
然后 `sudo nginx -t && sudo systemctl reload nginx && sudo systemctl daemon-reload && sudo systemctl restart sky-passport-render`。

## 3. 以后想再加 CDN
给桶绑一个已备案的子域名（如 `v.nybbq.art`）并开 CDN 加速，把上面 302 的域名和小程序 downloadFile 域名换成它即可。

## 静态文件也走存储桶（2026-10-11）

字体、第三方库、音效、小程序图片、介绍视频和三份数据 JSON 放在桶的 `static/` 目录，服务器只负责把请求 302 过去，不再占 3 Mbps 带宽。

- 子用户策略要允许 `static/*` 的 PutObject；桶的跨域规则：Origin `https://passport.nybbq.art`，GET/HEAD（字体、JSON、音效是跨域读取）。
- 同步：`server/cos_sync.js`（在服务器上运行，自己读 `cos.env`；文本文件 gzip 后上传；只传有变化的文件，清单 `cos_sync.json`）。`deploy.sh` 每次部署后自动运行；服务器上单独重建了字体或数据（`fetch_assets.sh`）之后要手动运行一次。`--check` 逐个核对桶里是否齐全。
- nginx（443 站点）：`^/(fonts|vendor|sfx|mp|promo)/` 一律 302；三份数据 JSON 也一律 302（存储桶域名已加入小程序的 request 合法域名和 downloadFile 合法域名）。带 `?v=` 的地址原样带过去，所以换版本不会读到旧缓存。
- 127.0.0.1:8088（渲染器用的站点副本）不跳转，继续读本机文件：`public/` 里的这些文件不能删。
- 回退：把 nginx 里那两段 location 删掉重载即可（备份在 `/home/ubuntu/sky-passport.nginx.bak.*`）。
