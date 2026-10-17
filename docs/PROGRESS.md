# 航迹手帐 Sky Passport · 项目进度总览

更新：2026-10-17 · 维护人：Claude（与项目负责人 Barry 协作）

> 这份文件给人看，也给接手的 AI agent 看。技术细节和长期规则在根目录 `CLAUDE.md`（Claude Code 会自动读取）；本文件讲"现在做到哪了、东西在哪、怎么接着做"。
> **本文件不含任何密钥。** 密钥只在服务器上，见第 5 节。

---

## 1. 一句话
把一个人的航班记录（表格 / 行程截图 / 手动输入）变成一条约 30–60 秒的竖屏「飞行护照」动画（原创配乐），并出长图海报、小红书卡片和 33 枚飞行勋章。

## 2. 东西在哪

| 内容 | 位置 |
|---|---|
| 项目根目录（Mac） | `/Users/bai/Downloads/sky-passport` |
| 代码仓库（私有） | `https://github.com/baiiiii521/sky-passport`，工作分支 `feat/v3-vercel`，`main` 与之同步 |
| 素材仓库（公开，只放视频和监控） | `https://github.com/baiiiii521/sky-passport-assets` |
| 小程序开发者工具里的副本 | `~/WeChatProjects/miniprogram-2`（从 `miniprogram/` 用 rsync 同步） |
| 宣传片成片（不进 git） | `promo/v5`（介绍片 A/B/C 旧版）、`promo/v6`（品牌片 20s/30s）、`promo/v7`（介绍片新版）、`promo/mp/`（预览码、卡片预览图） |
| 私人数据（绝不提交） | `data/private/` |

### 目录
```
web/            网页（public/ 静态页 + js/），服务器代码（server/），部署脚本（deploy/），测试（tests/），宣传片脚本（promo/）
miniprogram/    微信小程序源码
video-pipeline/ 早期离线渲染管线（参考用）
docs/           文档（本文件、AUDIT 报告、参考视频）
.github/        CI（自动测试）
```

## 3. 线上环境

| 环境 | 地址 | 说明 |
|---|---|---|
| 国内网页 | https://passport.nybbq.art | 腾讯云轻量服务器 49.233.168.199，含截图识别、服务器生成视频、匿名统计 |
| 海外网页 | https://sky-passport.vercel.app | Vercel，英文界面，AI 检查表格 |
| 小程序 | 「航迹手帐」AppID wx49f39c4e21487f55 | **1.0.18 已于 2026-10-16 提交审核** |
| 存储桶 | 腾讯云 COS `sky-passport-1252289725`（北京） | 成片 `v/`（1 天自动删）、静态文件 `static/` |
| 文字识别 | 腾讯云 OCR（GeneralBasicOCR） | 赠送资源包约 44,000 次 |
| 在线监控 | `sky-passport-assets` 仓库的 GitHub Actions，每 10 分钟 | 出问题自动开 issue 并发邮件 |

## 4. 当前版本与功能
- 网页 v3.3.0（页脚显示版本号）；小程序 1.0.18（每个标签页底部显示版本号）
- **导入**：表格（航旅纵横 / Flighty / myFlightradar24 / OpenFlights / CSV 模板）、行程截图识别（国内）、手动输入
- **视频**：网页本机生成；小程序由服务器生成（约 25–50 秒），可选封皮颜色、配乐、片长、国籍（可搜索，含中国香港 / 澳门 / 台湾）、护照照片、结尾文案
- **成就**：33 枚勋章，可全选印到长图
- **分享**：长图海报（网页两种风格）、小红书 3:4 卡片 ×3、单枚勋章卡、小程序个性化转发卡
- **其他**：待出行倒计时、记住上次导入、匿名使用统计、国内静态文件走存储桶
- **品牌**：小程序全部叫「航迹手帐」；网页长图标题保留「航迹护照」（负责人决定）；英文名 Sky Passport

## 5. 账号与密钥（只写位置，不写内容）
- 服务器 SSH 私钥：Mac 上 `~/.ssh/sky_passport_deploy`，用户 `ubuntu`
- COS / OCR 子账号密钥：服务器 `/srv/sky-passport/cos.env`（不要拷出服务器）
- 小程序代码上传密钥：服务器 `/home/ubuntu/.wx/private.key`；上传脚本 `/home/ubuntu/mp/mp_ci.js`
- Vercel：本机 `vercel` 命令已登录；TypeSafe 密钥在 Vercel 环境变量
- **待办**：COS 子账号密钥曾在聊天里出现过，建议负责人在腾讯云「访问管理」轮换

## 6. 常用操作
```bash
# 测试（每次改完必跑）
cd web && npm test
cd web/public && python3 -m http.server 5190 &      # 本地预览
uv run --with playwright python web/tests/e2e/smoke.py   # 浏览器全流程测试（含导出视频）

# 发布网页（先 npm run stamp，再测试）
cd web && npm run stamp
vercel deploy --prod                                    # 海外
DEPLOY_HOST=ubuntu@49.233.168.199 ./deploy/deploy.sh    # 国内（会自动同步存储桶）

# 小程序：把 miniprogram/ 打包传到服务器 /home/ubuntu/mp/src，再在服务器上
/opt/node20/bin/node /home/ubuntu/mp/mp_ci.js upload <版本号> "<说明>"
/opt/node20/bin/node /home/ubuntu/mp/mp_ci.js preview   # 生成预览二维码 /home/ubuntu/mp/preview.jpg

# 看使用统计（服务器上）
cd /srv/sky-passport && /opt/node20/bin/node server/ev.js report 7
```
注意：从海外往国内服务器传文件很慢，传小包、用 md5 校验；打包小程序要加 `COPYFILE_DISABLE=1`。

## 7. 必须遵守的规则
1. `data/private/` 永不提交；示例只用虚构旅客「林小舟 / LIN XIAOZHOU」，不出现负责人真名。
2. 中国地图规则不能改（标准国界含台湾和南海诸岛、九段线、台湾不显示旗帜），见 `CLAUDE.md`。
3. 视频的动效和配乐规则改之前先问负责人。
4. 小程序审核期间不上传新版本，除非负责人要求。
5. 不要碰服务器上的 MySQL 和 `bbq-shop` nginx 配置。
6. 页面脚本共享全局变量：不要用 `L`、`S`、`AP`、`LAND` 等做局部变量名；长单行里不要写 `//` 注释。
7. 回复负责人用简洁中文。

## 8. 待办与下一步（按优先级）
1. 等 1.0.18 审核结果；通过后检查线上版本号
2. 负责人轮换 COS 子账号密钥
3. 截图识别补其他 App 的样本（航司 App、携程、飞常准），需要负责人提供截图
4. 年度飞行报告模板（建议 11 月中旬前上线）
5. 双人 / 家庭合并航线
6. 地图审图号：大规模推广前评估
7. 更多想法见 `docs/AUDIT-2026-10-10.md` 第 6–7 节

## 9. 交给其他 agent 接着做的流程

### 给接手 agent 的规则（请原样转给它）
1. 先读根目录 `CLAUDE.md` 和本文件 `docs/PROGRESS.md`。
2. 从 `feat/v3-vercel` 拉一个新分支，名字写清楚任务，例如 `task/annual-report`；**不要直接改 `feat/v3-vercel` 或 `main`**。
3. 只做被分配的任务，改动尽量小；每次提交写清楚做了什么。
4. 完成后必须跑 `cd web && npm test`，涉及网页的再跑 `web/tests/e2e/smoke.py`，把结果写进说明。
5. **不要部署**（不跑 `vercel deploy`、`deploy.sh`），**不要上传小程序**，不要改服务器——这些等审查通过后由 Claude 做。
6. 推送分支后开一个 Pull Request 到 `feat/v3-vercel`，说明里写：做了什么、怎么测的、还有什么没做完。
7. 有新的长期规则或架构变化，在 `CLAUDE.md` 里补一句。

### 负责人这边怎么操作
1. 打开新的 Claude Code 会话（或其他 agent），工作目录选 `/Users/bai/Downloads/sky-passport`，把任务和上面"给接手 agent 的规则"一起发给它。
2. 它做完后会给你一个分支名或 PR 链接。
3. 回到这个会话（或任何一个 Claude 会话），对我说：「检查分支 task/xxx」或「检查 PR #N」。
4. 我会审查代码、跑测试、在浏览器里实测，有问题直接修或告诉你；没问题再合并、部署、上传小程序。

同时开多个 agent 时，每个用自己的分支；如果它们在同一台 Mac 上同时改代码，建议每个 agent 用独立的 git worktree（Claude Code 里可以让它"在 worktree 里工作"），避免互相覆盖文件。
