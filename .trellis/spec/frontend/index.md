# 前端（家长端）开发规范

> 本目录描述 `frontend/` 这个**原生 JavaScript 家长端**在本仓库里实际是怎么干的，供后续 agent 动手前先读。
> 不适用于运营后台：`/ops/` 是 Django 模板 + 本地化 Tabler 组件，代码在 `backend/dingdong_ca/ops/`，维护约定见 `backend/dingdong_ca/ops/README.md`。
> 本目录用中文写，与 `frontend/README.md`、`PROJECT_MEMORY.md` 一致。

## 目录导航

| 规范文件 | 管什么 |
| --- | --- |
| [directory-structure.md](./directory-structure.md) | `frontend/` 各文件职责与边界；新增文件必须同步哪些清单 |
| [state-and-rendering.md](./state-and-rendering.md) | 无框架下的状态存哪、怎么触发重渲染、事件与 hash 路由、竞态防护 |
| [api-conventions.md](./api-conventions.md) | 请求一律走 `api.js` 的规矩、错误与 409 冲突恢复、幂等键、凭据类参数读完即摘 |
| [ui-conventions.md](./ui-conventions.md) | “组件”= 返回 HTML 字符串的函数；转义、弹窗、动作分发、文案与状态词、无障碍 |
| [styling-and-responsive.md](./styling-and-responsive.md) | 三层 CSS 的边界、断点与 390×844 视口约定、本地资源 |
| [quality-guidelines.md](./quality-guidelines.md) | 检查命令的真实含义、禁止模式、依赖与代码风格 |
| [testing-and-acceptance.md](./testing-and-acceptance.md) | 单测 / 本地端到端 / 公网验收三层怎么跑、各自前置条件、“不许拦截假响应”这条纪律 |

## 开工前检查（Pre-Development Checklist）

1. 读 `frontend/README.md`（本地启动、验收命令、各模块说明）与根 `PROJECT_MEMORY.md` 的当前状态。记忆是带日期的快照，**不能假设服务还在跑**。
2. 先判断改动落在哪：视图与交互在 `app.js`；请求与认证在 `api.js`；能写成纯函数的规则另立模块（范例 `ca-link.js`），因为它要被单测盯住。
3. 新增顶层 `.js` / `.css`：同步 `frontend/server.cjs` 的 `files` 白名单，并在 `frontend/index.html` 里引入，否则 4173 预览直接 404。
4. 涉及真实交互的改动按 TDD：先写会失败的用例，放 `frontend/tests/`（本地真实 Chrome）或 `frontend/deployment-tests/`（公网入口）。
5. 本地要能跑起来：后端 `127.0.0.1:8017`、PostgreSQL `55439`、Redis `56379`，启动命令见 `PROJECT_MEMORY.md` 与 `backend/README.md`。

## 收尾检查（Quality Check）

- `npm --prefix frontend run check` 与 `npm --prefix frontend run test:unit` 都过。注意 `check` 只是 `node --check` 语法检查（见 `quality-guidelines.md`）。
- 改到交互的，用真实 Chrome 跑对应 spec：`npx playwright test tests/<文件>.spec.js --reporter=list`。**不要拿历史绿灯日志当本轮证据**（`PROJECT_MEMORY.md` 明确要求）。
- 窄屏：改动涉及新增长串、面板或表格时，至少看一次 390×844（见 `styling-and-responsive.md`）。
- 自查：有没有引入框架/CDN、有没有未 `esc()` 的插值、有没有写死 `crypto.randomUUID()`、有没有把凭据留在地址栏或 storage 里。
- 发现了新的约定或坑，写回本目录对应文件；不要只留在对话里（Trellis 的 Phase 3 要求）。