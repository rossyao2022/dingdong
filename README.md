# DingDong · 天赋成长伙伴

一个面向亲子互动的网页产品演示，使用原生 HTML、CSS 和 JavaScript 构建。

线上体验：[https://happykua.com/dingdong/](https://happykua.com/dingdong/)

默认进入「天赋探索」：选择科学、故事、自然或创意兴趣岛，查看目的地反馈，再进入分步小任务。页面还提供四道探索偏好情境、灵感盲盒、机器人伙伴引导演示、成长记录及家长观察入口。

「指纹小宇宙」支持示例纹路、本地选图和主动拍照。纹路由用户手动观察与选择，不进行 AI 识别，不据此判断能力、性格或天赋。图片仅在当前页面临时预览，不上传、不保存；重置或离开页面会释放图片并关闭相机。相机需要 HTTPS 或 localhost 等安全上下文，以及浏览器授权。

当前尚未接入正式后端、正式测评题库或实体机器人。档案、任务和答题记录保存在当前浏览器；界面中的设备与正式成长数据保持待接入状态。

## 本地运行

需要 Node.js 18 或更新版本。无需安装前端依赖或构建：

```sh
npm run dev
```

访问 [http://127.0.0.1:4173/dingdong/](http://127.0.0.1:4173/dingdong/)。开发服务器也兼容 `/TalentRadar/`；无尾斜杠的目录入口会自动重定向。

## 检查

JavaScript 语法检查：

```sh
npm run check
```

用户流程与响应式检查需要 Python、Playwright 和 Chromium。先安装测试工具，并保持本地服务运行：

```sh
python -m pip install playwright
python -m playwright install chromium
python -X utf8 qa/verify.py
python -X utf8 qa/verify_v3.py
```

V3 测试使用完整 Chromium 和原生模拟摄像头，检查拍照、权限拒绝与媒体资源释放；手机实际拍摄清晰度、系统权限和朗读音色仍应在目标设备上体验。测试生成的截图、导出与结果文件已被 `.gitignore` 排除。

## 目录与发布

- `index.html`、`app.js`、`styles.css`：页面、任务流程与基础布局。
- `playworld.js`、`playful.css`：兴趣岛、选择反馈与盲盒动画。
- `fingerprint.js`、`fingerprint.css`：指纹观察与本地媒体处理。
- `assets/`：本地 SVG 角色与岛屿插画，无 CDN 依赖。
- `api.js`：尚未接入的接口适配边界。
- `legacy.js` 与六个兼容 HTML：保留旧入口，其中 `thumb.html` 进入指纹页。
- `server.cjs`、`qa/`：本地预览与回归检查。

发布到静态托管目录时，只需 HTML、CSS、浏览器 JavaScript 与 `assets/`；无需发布开发服务器或 QA 目录。资源使用相对路径，页面采用 hash 路由。
