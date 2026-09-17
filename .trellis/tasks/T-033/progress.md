# T-033 progress

## 阶段：Plan（已完成）

任务：展示面 B —— 面一（人设）+ 面三（健康度四态），家长端 UI（依据 `.trellis/tasks/T-021/design.md` §1.1/§1.3/§3，设计 §5 的 B 行）。

已读：`AGENTS.md` TRELLIS 约束/权限边界、`.trellis/loop/gates.md`、`.trellis/loop/queue.md`、`.trellis/workflow.md`、`.trellis/spec/frontend/index.md` 与 `ui-conventions.md`/`styling-and-responsive.md`/`testing-and-acceptance.md`、`.trellis/tasks/T-021/design.md` §1.0–§1.3/§2.3/§3/§5、`frontend/README.md`、`frontend/app.js`（render/reports/settings/robotPanel/observationBlock）、`backend/dingdong_ca/core/api/ca_display.py`、`backend/dingdong_ca/core/services/ca_display.py`（`_resolve`/`_read`/`persona_view`/`health_view`）、`backend/dingdong_ca/testsupport/ca_display.py`（6 场景）、`frontend/tests/sync-failure-visibility.spec.js`。

现状核查（读到的既有事实）：
- `frontend/app.js` 无 persona/健康度相关代码（0 命中）。
- `#reports` 路由已并行取 4 份数据（reports/sessions/growth-overview/assessment-config），HTML 顺序：grid（题库卡 + 探索卡 + 初始测评卡）→ 已完成的探索体验 → 已生成报告 → 成长观察。
- `#settings` 路由已并行取 4 份数据（consents/associations/data-requests/ca-accounts），`robotPanel(rows)` 渲染机器人账户面板。
- 后端接口已就绪（T-032）：`GET /api/v1/children/<child_id>/companion-persona`、`.../companion-health`，响应带 `availability`/`data_origin`/`source`/`fetched_at`/`reason` 信封；`persona` 与 `health` 在 `availability != ready|stale` 时为 `null`。
- `persona.type_label` 与 `health.trigger_label` 已由后端映射中文（前端不维护映射表）。
- `_resolve()` 只解析 `status="active"` 的 `CaAccount`；接口以 `child_id` 为键，不暴露 `ca_account_id`。

验收标准如何客观验证：
1. 纯函数层（四态分支/是否显分/文案/空态）→ 新增 `frontend/companion.js` + `frontend/unit/companion.test.js`（`npm run test:unit` 盯住）。
2. 界面层 → 新增真实 Chrome 用例 `frontend/tests/companion-panel.spec.js`：注入 6 个 `ca_display_*` 场景逐个走查、截图到 `.trellis/tasks/T-033/shots/`、390×844 不横向溢出、`pageerror` 为空。
3. 既有页面不回归 → 复跑 `tests/growth-window.spec.js`（同页「成长观察」）、`tests/ca-account.spec.js` 与 `tests/robot-account-row.spec.js`（改动面板所在页），加 `npm run check`。

范围判定（两处与任务文本的差异，理由见 report §5.1）：
- `reassess` 态只做状态与文案，不实现「重新测评 / 先不测」按钮与 POST 回写：设计 §5 把 CTA 与回写整块划给 D（T-035），§1.3 表内该行本身写「见 1.4」。
- 「换机后旧号人设只读展示」缺数据通路：接口只解析 `active` 号，旧号人设没有可读入口，补齐需新增后端读接口（属契约变更），本任务不做。

## 阶段：Implement（已完成）

改动文件列表（`[T-033]` 提交）：
- 新增 `frontend/companion.js`（四态分支、是否显分、空态/错误态文案的纯函数）
- 新增 `frontend/unit/companion.test.js`（18 项）
- 新增 `frontend/tests/companion-panel.spec.js`（2 项真实 Chrome）
- 改 `frontend/app.js`（import `companion.js`；`companionPanel`/`personaBlock`/`healthBlock`/`faceEmpty`/`staleNotice`；`#reports` 加两个请求与面板；`#settings` 加一个请求与 `robotPanel(accounts, companion)` 只读人设行）
- 改 `frontend/client.css`（`.companion-head`/`.companion-state`/`.companion-health`/`.companion-panel .metric-list`）
- 改 `frontend/server.cjs`（静态白名单加 `companion.js`）
- 改 `frontend/README.md`（「CA 对接 C2：陪学伙伴面板」一节 + 已接入页面一行）
- 改 `PROJECT_MEMORY.md`（最近一轮/上一轮/更早一轮，最后更新时间）
- 改 `.trellis/spec/frontend/testing-and-acceptance.md`（两条本轮踩到的坑）

## 阶段：Verify（已完成）

跑过的命令与结果（原样抄）：
- `cd frontend && npm run check` → 退出码 0（`node --check app.js && api.js && playworld.js && server.cjs` 无输出）
- `cd frontend && npm run test:unit` → `ℹ tests 34 / ℹ pass 34 / ℹ fail 0 / duration_ms 80.092125`
- `cd frontend && npx playwright test tests/companion-panel.spec.js tests/growth-window.spec.js tests/ca-account.spec.js tests/robot-account-row.spec.js --reporter=list` → `13 passed (1.9m)`（新用例 2 项：32.0s / 16.1s；回归 11 项）
- `python3 scripts/audit_documents.py` → `{"markdown_files": 80, "local_links_checked": 500, "archived_files_checked": 85, "operations": 61, "schemas": 82, "errors": []}`
- 环境修复：`cd backend && uv run --no-sync python manage.py migrate` → `Applying core.0009_careassessmentevent... OK`（本地库 127.0.0.1:55439，非生产）
- 截图 8 张落 `.trellis/tasks/T-033/shots/`

## 阶段：Finish（已完成）

已完成：report.md 已写；`[T-033]` 提交已按 T-021 批复的直推规则 push origin/codex/release-v0.3.6（远端 sha 见 `gates.md` 的 `EXECUTED T-033 push`）；`queue.md` 该任务 `status` 改 `done` 并附执行结果；experiment-log 追加一行；`status.md` 已重写。

下一步：无（本轮结束）。
