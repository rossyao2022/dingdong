# T-035 报告：展示面 D —— 面四复测 CTA 与回写闭环（家长端 UI）

## goal

按 `.trellis/tasks/T-021/design.md` §1.4 实现：`health.status == "reassess"` 且 `reassessment_recommended` 时在健康度面板内展示 CTA（全产品唯一入口）；「重新测评 / 先不测」→ POST response 回写（`accepted=false` 后不再重复打扰，一行说明 + 可再次展开）；`accepted=true` 承接既有测评流程（不建第二套测评入口），完成后 POST complete 回写；`switch_recommended` 真假两分支（真=新角色推荐卡、由家长确认后才切换；假=展示保留当前角色、不显新角色名）；`auto_switch` 恒为 false，任何路径不自动切换；合成模式下回写只落我方库 + AuditEvent、零出站，接口响应如实标 `data_origin`。

## 实际做了什么

新增 `frontend/reassessment.js`（判定纯函数，不产生 HTML）：

- `reassessmentSection(data, {expanded, sync, completion})`：四步状态机 `hidden / suggest / declined / accepted / done`；不可用状态与 `no_data`（契约里 404 就是「没有建议」）整块不显示；`sync_pending` 时给一句可重试说明。
- `completionCard(result)`：`switch_recommended === true` 才带新角色名 / 匹配度 / 匹配度差；`false` 只给「保留当前角色」与当前角色匹配度；`autoSwitch` 恒 `false`（不照抄响应里的 `auto_switch`）。

改 `frontend/app.js`：

- `#reports` 的 `Promise.all` 加 `GET /children/<child_id>/reassessment`，结果存 `state.reassessment`；`companionPanel(persona, health, reassessment)` 在 `.companion-health` 内渲染复测区块（设计 §1.4 的落点），合成徽标仍只挂面板级那一个 `testTag()`。
- 四个 action：`reassessment-accept` / `reassessment-decline`（`respondReassessment()` → `POST .../response`，`request_id` = `reassessment-response:<event_id>:<accepted>`）、`reassessment-expand`（本地展开）、`start-reassessment`（`state.reassessmentStart = true` → `beginAssessment()`）。
- `createAssessment()` 里记下这次测评 id（`state.reassessmentSession`）；`#assessment/<id>` 路由在 `purpose=assessment && status=completed` 时调 `writeBackReassessment()` → `POST .../complete`（`request_id` = `reassessment-complete:<event_id>`），成功置 `state.reassessmentResult`，失败把 `errorMessage` 记进 `state.reassessmentWriteError` 并在完成页给一条「复测结果还没有回写成功」+ 重试按钮（不静默）。
- `frontend/client.css` 加 `.reassessment` 区块样式；`frontend/server.cjs` 静态白名单与 `frontend/package.json` 的 `check` 加 `reassessment.js`。

文档：`frontend/README.md` 新增「CA 对接 C4」一节；`PROJECT_MEMORY.md` 更新最近一轮、日期与 T-032 段落里的待办表述。

## 验证命令与真实输出

```
cd frontend && npm run check
> node --check app.js && … && node --check reassessment.js && …   （exit 0）

cd frontend && npm run test:unit
ℹ tests 60
ℹ pass 60
ℹ fail 0

cd frontend && npx playwright test tests/reassessment-cta.spec.js --reporter=list
  ✓  1 … 复测四步闭环：建议 → 回写 → 承接测评 → 结果（switch_recommended 真分支） (1.1m)
  ✓  2 … 复测四步闭环：switch_recommended 假分支只保留当前角色 (1.2m)
  ✓  3 … 选择先不测后不再重复打扰，可展开看当时的建议；没有建议时不出现入口 (24.1s)
  3 passed (2.7m)

cd frontend && npx playwright test tests/companion-panel.spec.js tests/growth-cycle-panel.spec.js tests/growth-window.spec.js tests/robot-account-row.spec.js --reporter=list
  6 passed (1.8m)      （companion-panel 2 / growth-cycle-panel 1 / growth-window 2 / robot-account-row 1）

cd backend && uv run --no-sync python -m pytest tests/test_ca_display.py -q
52 passed, 1 warning in 207.49s (0:03:27)

python3 scripts/audit_documents.py
{"markdown_files": 80, "local_links_checked": 504, "archived_files_checked": 85, "operations": 61, "schemas": 82, "errors": []}
```

浏览器用例断言的关键事实（全部来自真实 Chrome + 真实接口，没有拦截假响应）：

- 真分支：`POST .../response` 入参 `accepted=true`、响应 `accepted=true / data_origin=synthetic / sync_pending=false`；`POST .../complete` 入参 `assessment_id` = 这次测评 id、响应 `switch_recommended=true / new_persona_name=Socrates / match_score=86 / current_persona_match_score=69 / match_delta=17 / auto_switch=false`；结果卡显示「新角色推荐 · Socrates · 匹配度 86 / 100 · 当前角色匹配度 69 · 匹配度变化 17」；人设卡仍是原角色 Mia（**没有自动切换**）；结果卡上按钮数 0。
- 假分支：响应 `switch_recommended=false / match_delta=6 / auto_switch=false`；结果卡只说「保留当前角色」，整个面板里不出现新角色名 `Ada`；人设卡仍是 Newton。
- 拒绝分支：`POST .../response` 入参 `accepted=false`；界面只剩「已选择暂不重新测评」+ 1 个按钮（展开后仍是 1 个，不给第二个「重新测评」）；重载后仍是这一行。
- 无建议（`ca_display_normal_art`）：`.reassessment` 元素数 0。
- 390×844：`scrollWidth - innerWidth ≤ 1`；三项用例 `pageerror` 全为空。
- 截图 7 张：`.trellis/tasks/T-035/shots/`（`suggest-desktop` / `accepted-desktop` / `writeback-desktop` / `result-switch-desktop` / `result-switch-mobile` / `result-keep-desktop` / `declined-expanded-desktop`）。

## 未验证项

- 真源（`CA_DISPLAY_DATA_SOURCE=dingdong`）路径没跑：缺 D10 base URL / D12 key，本轮全部在合成数据源下验收。**不得写成「已接通 DingDong」**。
- 设计 §1.4 第 4 步的「由家长确认后才切换」没有实现：已冻结的三条接口（1 读 + 2 写）里没有切换落点，澄清清单 D9 仍在等对方答复，所以结果卡只呈现建议并写明「确认入口尚未开放」，没有做点了不生效的按钮。
- 刷新后的结果卡只有中性说明：`GET` 的事件字段（`EVENT_FIELDS`）不含 `new_persona_name` / `match_score` / `switch_recommended`，完整结果只在本轮会话的 `complete` 响应里。
- 未跑全量后端套件与公网验收。

## 偏离与理由

1. **用例给每次注入换独有 `event_id`**（`scopeEvent()`）。原因：本地表 `ca_reassessment_event.event_id` 是**全局**唯一（T-032 的模型 + 迁移 `0009`），而两个复测 mock 账号共用一份 fixture，所以同一个合成场景在全库只能被一个儿童回写一次——第二个儿童回写时撞唯一约束，接口返回 500 `IntegrityError`（首轮真实浏览器验收就是这么挂的：`test-results/…/error-context.md` 与探针输出都记到了这一条）。用例按既有「不写死测试数据」纪律（`~/.workbuddy/skills/dingdong-local-browser-acceptance/SKILL.md` 硬规矩 1）绕开它，于是任何库上都能重复跑。
   **这是后端的数据模型问题，本轮没有修**：改成「按 `ca_account` 唯一」要动 T-032 已冻结的模型 + 新迁移，改 fixture 生成按儿童唯一的 id 要动 `backend/tests/test_ca_display.py` 里 14 处硬编码事件 id 的断言，两者都超出本任务「家长端 UI」的范围。请编排侧决定由谁修。
2. **`accepted=false` 后不给第二个「重新测评」按钮**：设计只写「一行说明 + 可再次展开」，展开内容未定义。后端对「同一事件换个答案」返回 422（`REASSESSMENT_ALREADY_ANSWERED`），给按钮等于给死路，所以展开只复述当时的建议并注明「这条建议已经处理过，不会重复提示。要再测一次，可以从「初始测评」重新开始。」
3. **回写只认本次承接的测评**：`state.reassessmentSession` 记的是「开始复测」创建出来的测评 id；刷新过页面就认不出来，此时宁可不回写（面板仍显示「已确认重新测评 + 开始复测」，可重新点）也不把别的测评 id 写过去。

## 注入的合成数据（供清理）

本轮真实浏览器验收在**本地开发库**（`127.0.0.1:55439`，非生产）新建了 3 个临时家长账号 / 儿童（`复测闭环儿童`、`复测保留儿童`、`复测拒绝儿童`）与 3 个机器人账户，并写入 `test_fixture`（`ca_display_*` / `sync_success` / `assessment_success`）与 3 行 `ca_reassessment_event`（事件 id 形如 `reassess-e2e-switch-*` / `-keep-*` / `-decline-*`，由用例生成、每次不同）。按既有约定（T-030）只做状态变更、不物理删除；如需清理请按这 3 个儿童姓名定位。
