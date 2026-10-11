# 航迹护照 · 微信小程序（个人主体轻量版）

个人主体小程序不能用 web-view，所以这里是原生实现：首页（成片轮播、示例视频、功能、三步说明）→ 从聊天选择表格 → 手机上解析 → 结果页：统计、成就、**服务器渲染的视频**（`/api/video`，与网页同一引擎，可在小程序内播放并存相册，24 小时删除）、长图海报（存相册）。

- `libs/core.js`、`sub/xlsx/xlsx.full.min.js`（分包，用到时加载）、`libs/qrcode.js` 由 `web/scripts/build_miniprogram.js` 生成，**不要手改**：解析逻辑改 `web/public/js/core.js` 后重新运行 `node web/scripts/build_miniprogram.js`。
- `libs/stats.js`（统计、成就）与 `libs/poster.js`（长图）对应网页版 `engine.js stats()` / `extras.js`。
- 运行时数据从服务器读取：`airports.json`（缓存到本地）和 `mp-world.png`（固定投影的底图，由 `web/public/mapbase.html` 生成）。
- 后台需配置：request / downloadFile 合法域名 `https://passport.nybbq.art`；用户隐私保护指引里声明「选中的文件」和「相册（仅写入）」。

- 视频：`web/server/render.js`（systemd `sky-passport-render`，3 路并行，31 秒片约 80 秒），首页素材由 `web/server/showcase.js` 在服务器生成到 `public/mp/`。
- 预览/上传：在服务器 `/home/ubuntu/mp` 运行 `node mp_ci.js preview|upload`（见 `ci/mp_ci.js`）。
