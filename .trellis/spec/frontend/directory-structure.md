# 目录结构与文件职责

家长端是**原生 JavaScript**：无框架、无 TypeScript、无构建步骤，`index.html` 直接引用 `.js`，浏览器跑源码（`frontend/README.md` 首段）。因此这里的“模块组织”指的是文件级别的职责划分，不是组件目录。

## 布局

```
frontend/
├── index.html          唯一入口：侧栏 / 顶栏 / 移动端底部导航外壳 + #main + #dialog + #toast
├── app.js              家长端全部页面逻辑：状态、视图、事件、hash 路由
├── ui-components.js    生产页面与 Storybook 共用的原生 HTML 构件
├── api.js              传输与认证：request() / refresh() / login() / logout() / all() / createRequestId()
├── ca-link.js          NFC 承接与 CA 账户的纯函数（不碰 DOM，可 node:test 单测）
├── playworld.js        兴趣岛（IIFE，挂 window.PlayWorld）
├── server.cjs          本地预览：静态白名单 + /api/v1 流式代理到 127.0.0.1:8017
├── styles.css          参考仓库原样式（与 参考代码/dingdong/styles.css 逐字节相同，不改）
├── playful.css         参考仓库原样式（同上）
├── client.css          本仓库新增/覆盖的样式，全部写这里
├── assets/             mark.svg、dingdong.svg、islands/*.svg、sample-1..5.png
├── unit/               node:test 单测（纯逻辑，不需要浏览器）
├── tests/              本地真实 Chrome 端到端（共用 tests/support.js）
├── deployment-tests/   公网真实入口验收（共用 deployment-tests/helpers.js）
├── tools/              开发期自检脚本（不进镜像）
├── .storybook/ stories/ 开发期组件预览，不进镜像
├── docs/               浏览器验收截图与本机记录（不进版本库）
├── playwright.config.js / playwright.public.config.js
└── package.json / package-lock.json
```

## 每个文件的边界

- `index.html`：只有页面外壳。`#main` 是内容容器（`aria-busy` 由 `app.js` 控制）、`#dialog` 承载所有弹窗、`#toast` 是轻提示。导航链接是 `<a href="#route">`，由 `app.js` 的 `header()` 按 `nav` 表渲染。
- `app.js`：单文件装载全部页面。`render()` 按 `location.hash` 的 `route/id` 分派并生成 HTML 字符串，交给 `page(html)` 写入 `#main`。**不要**在这里引入路由库或组件库——现有分派就是这个项目的路由。
- `ui-components.js`：基础 HTML 构件为原生 ES 模块，`app.js` 和 `stories/` 共用；Storybook 只用于开发期预览，不参与生产路由或业务请求。
- `api.js`：只做传输与认证（Bearer、CSRF、超时、401 续期、分页），不认识业务实体。业务语义（重试、冲突恢复、中文提示）留在 `app.js`。
- `ca-link.js`：URL 参数读取/摘除、状态词、服务端错误信号判定，全是纯函数。文件头注释说明了单独成文件的唯一理由——“这几条规则要被单元测试盯住”。**能写成纯函数且规则重要的，优先放这种模块，而不是塞进 `app.js`。**
- `playworld.js`：兴趣岛的视觉、选中与动效，自身不调后端；选中结果通过 `window.PlayWorld.bind({ island(id) {…} })` 交回 `app.js`（在 `app.js` 末尾调用 `bind`）。
- `server.cjs`：**开发用**，不是生产服务器。生产由后端容器托管静态文件（见 `deploy/`、`frontend/tools/README.md` 对 `.dockerignore` 的说明）。
- `tools/`：开发期脚本，不进镜像。`.dockerignore` 只放行 `frontend/index.html`、`frontend/*.js`、`frontend/*.css` 与 `frontend/assets/`。

## 新增文件必须同步的清单

1. `frontend/server.cjs` 顶部的 `files` 白名单（当前列出 `index.html`、`styles.css`、`playful.css`、`client.css`、`app.js`、`api.js`、`ca-link.js`、`playworld.js`）。
2. `frontend/index.html` 的 `<link>` / `<script>`：`playworld.js` 用 `defer`，`app.js` 用 `type="module"`（顺序不能颠倒，`app.js` 依赖 `window.PlayWorld`）。
3. 新资源放 `assets/`，文件名必须匹配 `server.cjs` 里的白名单正则 `^assets/(islands/)?[a-z0-9_-]+\.(svg|png)$` —— 即只允许小写字母、数字、`_`、`-`，扩展名只允许 `svg` / `png`。
4. 运行时需要的新文件类型（不是 js/css/svg/png 或 `assets/` 下的 svg/png）：要同时改仓库根的 `.dockerignore`（它用 `!frontend/index.html`、`!frontend/*.js`、`!frontend/*.css`、`!frontend/assets/**` 逐条放行），否则不会进镜像。

反例（真实发生过）：新增顶层模块没同步 `server.cjs` 白名单，本地 4173 预览直接 404（`PROJECT_MEMORY.md` 的 “C1 落地” 踩坑第 3 条、`frontend/README.md` CA 一节）。

## 本地预览服务的既有行为（不要想改就改）

- 只监听 `127.0.0.1:4173`，`Cache-Control: no-store`，并带 `X-Content-Type-Options: nosniff` 与 `Referrer-Policy: no-referrer`。
- 只有 `/api/v1/` 前缀转发到 `127.0.0.1:8017`（ `host` 头被改写成 `127.0.0.1:8017`）；后端不可达时返回 `503` 与 `{code:"BACKEND_UNAVAILABLE"}`。
- 静态文件只允许 `GET` / `HEAD`，其余方法返回 `405`。
- 它不做 SPA fallback：未知路径返回 `404`。家长端本身只有一个页面，路由靠 hash，所以不需要 fallback。
