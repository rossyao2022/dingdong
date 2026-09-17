# 质量规范与检查命令

## 检查命令的真实含义（别把 `check` 当质量门）

`frontend/package.json` 里的脚本：

| 命令 | 实际做的事 | 前置条件 |
| --- | --- | --- |
| `npm run check` | `node --check app.js && node --check api.js && node --check playworld.js && node --check server.cjs` —— **只做语法检查** | 无 |
| `npm run test:unit` | `node --test unit/*.test.js` | 无（纯逻辑单测） |
| `npm test` | `playwright test`（`tests/`，本地 4173） | 真实 Chrome + 后端 8017 + 数据库（见 `testing-and-acceptance.md`） |
| `npm run test:public` | `playwright test --config=playwright.public.config.js`（`deployment-tests/`，公网入口） | 公网入口可达 + 环境变量凭据 |
| `npm run dev` / `npm start` | `node server.cjs`（本地预览 + `/api/v1` 代理） | 后端 8017 |

要点：

- `check` 通过**不代表功能对**，它只是 `node --check`。改交互必须跑真实浏览器用例。
- `check` 目前只列了 4 个文件：`ca-link.js` **不在其中**，它的保障来自 `unit/ca-link.test.js` 的 13 条用例。新增顶层模块时注意这个覆盖缺口（要么加进 `check`，要么用单测盯住）。
- 没有 ESLint，也没有 Prettier 配置：`prettier` 只在 `devDependencies` 里，仓库里没有配置文件、也没有任何脚本调用它。**不要**在交付说明里声称“跑了 lint/格式化”。
- 本仓库前端**没有运行时依赖**（`package.json` 只有 `devDependencies`：`@playwright/test`、`prettier`）。加运行时依赖要慎重：静态文件由后端容器直接托管，引入打包器会推翻现有交付方式。

## 代码风格（照现有文件写）

- 2 空格缩进、语句带分号、`app.js` / `api.js` / `ca-link.js` 用双引号（`server.cjs` 同）；模块用 ESM `import` / `export`（`package.json` 里 `"type": "module"`），只有 `server.cjs` 是 CommonJS。
- 注释写“为什么”，不写“做了什么”：`ca-link.js` 的文件头（为什么单独成文件、为什么不用 `URLSearchParams`）、`app.js` 的 `childEdit` 注释、`submitRobotReplacement` 的“第一步不可回退”都是范例。
- 函数名用动词短语，DOM 动作名用 `data-action` 的小写连字符风格。

## 禁止模式

- 引入前端框架、TypeScript、打包器或组件库（`frontend/README.md` 首段：原生 JavaScript 模块，无前端框架）。
- 引入 CDN 资源或外部字体（图片与字体全部本地 `assets/`）。
- 在页面代码里直接写 `crypto.randomUUID()`（用 `API.createRequestId()`，见 `api-conventions.md`）。
- 未 `esc()` 就把服务端/用户文本插进 HTML，或用 `innerHTML` 拼未转义字符串。
- 绕过 `API.request` 直接 `fetch("/api/v1/...")`；唯一现存的直接 `fetch` 是取本地合成样例图 `fetch("assets/sample-N.png")`（`submit-samples` 分支），它不是业务接口。
- 把凭据、令牌、手机号、儿童姓名写进 `localStorage` / `sessionStorage` / URL / 日志 / `console`。`sessionStorage` 只允许 `ca.navigation`（家长 id + 儿童 id）。
- 修改 `styles.css`、`playful.css`（与参考仓库逐字节相同），或改动 `frontend/docs/` 里的历史验收记录。
- 在测试里拦截或伪造业务 API 响应（例外与做法见 `testing-and-acceptance.md`）。
- 把“合成测试数据”显示成正式结论，或在界面上产出天赋/能力分数（`AGENTS.md`、`PROJECT_MEMORY.md` 的边界约束）。
- 为了跑通而放宽断言、跳过用例或把失败用例删掉；实现与预期不符时停下如实报告（`AGENTS.md` 的纪律条款）。

## 需要顺手检查的两件事

- **后端契约**：前端新增字段/枚举前先确认后端接口与 `设计/API/openapi.json` 里存在；契约变更要同步 `设计/API/` 下的文档，而不是只改前端。
- **静态资源缓存**：家长端由后端容器托管，静态文件 URL 不带内容哈希，运营后台靠 `?v={{ ops_asset_version }}` 击穿缓存（见 `PROJECT_MEMORY.md` 的 v0.3.6 一节）。改家长端静态文件后，现场判断加载的是不是新版本要另想办法（例如看接口版本或直接比对文件内容），别假设刷新页面就会生效。

## 交付说明里必须如实写的

- 只报本轮真正跑过的命令与数字；历史绿灯日志不算本轮证据（`PROJECT_MEMORY.md`）。
- 明确区分“本地真实 Chrome”与“公网真实 Chrome”，以及“390×844 视口模拟”与“真机”。
- 浏览器用例会真实创建合成数据且**会留在库里**（`frontend/README.md` 的“测试”一节），交付时要说明留下了什么、后续怎么处理。