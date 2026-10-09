# 航迹护照 Sky Passport

把航班记录变成一支约 60 秒的竖屏「飞行护照」动画（1080×1920，带原创配乐）。
Turn a flight history into a ~60 s vertical "flight passport" animation with an original score.

- `web/` — 自助生成网站，纯前端，记录不出浏览器 · Self-serve website, fully client-side
- `video-pipeline/` — 个人版成片的离线渲染管线 · Offline renderer for the personal film
- `data/private/` — 私人数据，已加入 .gitignore · Private data, git-ignored
- `docs/` — 参考成片 · Reference videos

快速开始 / Quick start:

```bash
cd web && npm install && npm run build:data && npm run dev
```

项目约定、架构和待办见 `CLAUDE.md`（Claude Code 会自动读取）。
See `CLAUDE.md` for architecture, conventions and backlog (Claude Code reads it automatically).
