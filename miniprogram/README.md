# 航迹护照 · 微信小程序（个人主体轻量版）

个人主体小程序不能用 web-view，所以这里是原生实现：从聊天选择表格 → 手机上解析 → 统计、成就、长图海报（存相册）；视频引导到网页版 https://passport.nybbq.art 生成。

- `libs/core.js`、`libs/xlsx.full.min.js`、`libs/qrcode.js` 由 `web/scripts/build_miniprogram.js` 生成，**不要手改**：解析逻辑改 `web/public/js/core.js` 后重新运行 `node web/scripts/build_miniprogram.js`。
- `libs/stats.js`（统计、成就）与 `libs/poster.js`（长图）对应网页版 `engine.js stats()` / `extras.js`。
- 运行时数据从服务器读取：`airports.json`（缓存到本地）和 `mp-world.png`（固定投影的底图，由 `web/public/mapbase.html` 生成）。
- 后台需配置：request / downloadFile 合法域名 `https://passport.nybbq.art`；用户隐私保护指引里声明「选中的文件」和「相册（仅写入）」。
