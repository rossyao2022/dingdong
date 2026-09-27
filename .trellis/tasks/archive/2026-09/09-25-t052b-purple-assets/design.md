# T-052B 技术设计

- 来源 `upstream/main@3b8723e`。仅按 blob 路径取 `robot-front.webp`、`robot-wave.webp`、按需 `gift.webp`、四张 V5 岛图；不做 `git merge`。
- 目标 `frontend/assets/dingdong/` 与 `frontend/assets/islands/`；后者以本地四个活动 ID 命名，避免将 RIASEC 字母混为业务 ID。
- `frontend/app.js`、`frontend/playworld.js`、`frontend/index.html` 切换图片；示例报告 PNG 保留。
- `frontend/server.cjs` 的 allowlist 与 MIME 增加 WebP；仍只允许明确目录与安全文件名。
- 在 `frontend/client.css` 调整软紫色背景、焦点色和导航强调色，与紫色机器人匹配；按真实浏览器画面决定图片尺寸。原 SVG 暂保留，以免旧文档引用失效。
