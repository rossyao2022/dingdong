# 测试与验收

三层，互不替代：纯逻辑单测 → 本地真实 Chrome 端到端 → 公网真实入口验收。

| 层 | 位置 | 跑什么 | 需要什么 |
| --- | --- | --- | --- |
| 单测 | `frontend/unit/*.test.js`（`node --test`） | 纯函数：`ca-link.js` 的 URL 参数与状态词、`api.js` 的 `createRequestId` | 什么都不需要 |
| 本地端到端 | `frontend/tests/*.spec.js`（`playwright.config.js`） | 家长端页面流程、题库后台、运营后台回归、截图留档 | 真实 Chrome + 后端 8017 + PostgreSQL/Redis + Worker/Beat |
| 公网验收 | `frontend/deployment-tests/*.spec.js`（`playwright.public.config.js`） | 打到已部署入口的真实浏览器验收 | 公网入口可达 + `DD_OPS_*` 环境变量凭据 |

## 单测

- 只测**不碰 DOM**的逻辑。`ca-link.js` 是范例：读/摘 URL 参数、状态词、换机信号判定全做成纯函数，所以能用 `node:test` 盯住（`unit/ca-link.test.js` 13 条）。
- 断言要能证明“不许做假”，例如 `replaceFlowNeeded` 只认 `409 + ACCOUNT_REPLACEMENT_REQUIRED` 这一个组合，其他 409 码必须为假。
- `unit/request-id.test.js` 第三条断言“缺随机源要抛错”，是防止有人把降级路径改成静默生成弱 id。

## 本地端到端

前置（`frontend/README.md`、`PROJECT_MEMORY.md`）：

- 后端全家桶：`docker-compose -f backend/compose.yml up -d --wait`、`runserver 127.0.0.1:8017`、Celery Worker / Beat；数据库 55439、Redis 56379。
- 页面服务：`npm --prefix frontend run dev`（4173）。Playwright 的 `webServer` 会自动起它，且 `reuseExistingServer: true`（`playwright.config.js`），所以手动起着也不会冲突。
- 真实 Chrome：`playwright.config.js` 用 `channel: "chrome"`、`workers: 1`、`timeout: 60000`、`screenshot: "only-on-failure"`。

约定与坑：

- 共用工具在 `tests/support.js`：`root`、`uvBin()`、`shell(source)`。`uvBin()` 存在的理由：Playwright 子进程的 PATH 不含 `~/.local/bin`，直接写 `uv` 会 `spawnSync uv ENOENT`。要执行后端命令就用 `uvBin()` + `shell()`。
- 供应商输入必须靠真实命令注入，不能自己造成品数据：`tests/flows.spec.js` 用 `execFileSync(uvBin(), [… "manage.py", "inject_fixture", "--child-id", id, "--scenario", scenario])`。
- 已知环境坑：`tests/flows.spec.js` 的页面请求走 `server.cjs` 代理到 8017，而用例内部的 `inject_fixture` 走 `uv run manage.py`——**两者必须连同一个本地数据库**，否则注入报 “Child does not exist”。v0.3.5 就因此把该 spec 的 3 项记为环境问题而非通过（`PROJECT_MEMORY.md` v0.3.5 节）。
- 机器人凭据每次运行都要随机：后端对“活跃账户的机器人凭据”是**全局**唯一约束，写死 `e2e-token-0001` 这类固定串，第二轮会撞上第一轮留下的活跃号而全红（`tests/ca-account.spec.js` 顶部注释与 `frontend/README.md`）。
- 用例会真实建家长/儿童/答卷/报告并**保留记录**；临时工作人员、临时发布题库在验收后停用而不是删除（`frontend/README.md`）。
- 截图写到 `frontend/docs/`（例如 `tests/flows.spec.js` 的 `docs/m5-mobile-<route>.png`）。该目录不进版本库，正式证据以 `deploy/evidence/**` 为准。
- 跑完若 `frontend/test-results` 堆积失败截图，Playwright 清理可能被本地批量删除保护拦下，用 `--output=/tmp/dingdong-pw-out` 指定输出目录绕开（`frontend/README.md`）。

## 公网验收

- `playwright.public.config.js`：`testDir: "./deployment-tests"`，`baseURL = process.env.PUBLIC_HTTP_URL || "http://110.42.225.196/dingdong/"`，两个 project：`desktop` 与 `mobile`（390×844），同样是真实 Chrome、`workers: 1`。
- 共用辅助在 `deployment-tests/helpers.js`：`ADMIN`（从 `DD_OPS_ADMIN_USER` / `DD_OPS_ADMIN_PW` 读）、`desktopOnly(testInfo)` / `mobileOnly(testInfo)`（写操作只在桌面跑，窄屏另有专项，跳过理由写在 `test.skip` 里）、`watchErrors(...pages)`（收 `pageerror`，用例收尾断言为空）、`waitOpsReady(page)`（等 `document.documentElement.dataset.opsReady === "1"`）。
- 凭据只走环境变量，**不写进仓库、不落到日志**（`deployment-tests/helpers.js` 头注释、`frontend/README.md` 的命令示例）。
- 示例命令（`frontend/README.md`）：

  ```sh
  DD_OPS_ADMIN_USER=… DD_OPS_ADMIN_PW=… \
    PUBLIC_HTTP_URL=http://110.42.225.196/dingdong/ \
    npx playwright test --config=playwright.public.config.js \
    parent-conflict-recovery.spec.js ops-p1-acceptance.spec.js
  ```

- 收集脚本异常是硬要求：`tests/flows.spec.js`、`tests/ops-console.spec.js`、`tests/ops-screenshots.spec.js`、`deployment-tests/helpers.js` 都会收 `pageerror`，任何脚本异常让用例失败，而不是变成模糊超时。

## “不许拦截假响应”这条纪律

`AGENTS.md`、`PROJECT_MEMORY.md`（测试一行：**不得添加 API 拦截假响应**）、`frontend/README.md`（“不拦截或伪造 API 响应”）都写了同一条。落地方式：

- 业务断言一律走真实接口 + 真实数据库，用 `inject_fixture` 之类的真实命令准备输入，不 `route.fulfill()` 造业务响应。
- **唯一现存例外**：`deployment-tests/parent-conflict-recovery.spec.js` 的“读取最新资料失败”用例，用 `page.route("**/api/v1/children/*", …)` 让单个 GET 返回 503，模拟读取失败；用完立刻 `page.unroute(...)`，用例里也写明“这是本用例制造的测试故障，不代表公网真实故障”。
- 新增用例若必须制造故障，照这个形状做：只拦一条、只针对一个请求、可解释、用完解除，且**不能**用它替代对真实路径的断言。
- 真实数据优先：报告与任务要由真实 Worker 跑出来，不能直接插成品记录冒充闭环（`PROJECT_MEMORY.md` 的演示边界）。

## 开发期工具脚本

`frontend/tools/`（不进镜像，说明见 `tools/README.md`）：

- `ops-page-audit.mjs`：真实 Chrome 打开 `/ops/` 下全部页面，记录标题、卡片/表格数量、**裸控件数**（缺 `form-control` 等组件库类的 input/select/textarea，期望为 0）、横向溢出，收集页面错误与控制台错误并写 `report.json`。
- `ops-quick-shots.mjs`：只截图，改一处看一眼用。
- 两者的凭据走 `OPS_USER` / `OPS_PASS` 环境变量，不写进仓库。
- 与断言型 spec 的分工表在 `tools/README.md`：`tests/ops-console.spec.js` 有断言，`tests/ops-screenshots.spec.js` 只留档，`deployment-tests/*` 打公网入口。

## 验收纪律

- 只报本轮真正跑过的用例与数字；不要拿历史绿灯当本轮结果（`PROJECT_MEMORY.md`）。
- 本地与公网的差异要如实区分，别当成缺陷：`http-profile.spec.js` 断言 `window.isSecureContext === false`，在 `127.0.0.1` 上不成立，只有真实 HTTP 公网入口能跑。
- 失败任务重试、服务事项处理这类**一次性状态变更**只能做一次；整轮重跑要重新准备隔离对象（`PROJECT_MEMORY.md` v0.3.6 全量验收一节）。
- 测试用到的临时账号与隔离数据，验收后按“只做状态变更、不物理删除、补写审计”的方式收尾。