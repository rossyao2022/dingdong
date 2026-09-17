# T-035 progress

## 阶段

- [x] Plan
- [x] Implement
- [x] Verify
- [x] Finish

## Plan（已完成）

事实核对：

- 后端契约已由 T-032 落地并已推送：`GET /api/v1/children/<child_id>/reassessment`、`POST .../reassessment/<event_id>/response`、`POST .../reassessment/<event_id>/complete`（`backend/dingdong_ca/core/api/ca_display.py`、`core/services/ca_display.py`）。
- 合成场景：`ca_display_reassess`（`switch_recommended=false`、`match_delta=6`、新角色 Ada）、`ca_display_switch`（`switch_recommended=true`、`match_delta=17`、新角色 Socrates）。
- 前端现状：`#reports` 已取 companion-persona / companion-health / growth-cycle；`companion.js` 只呈现四态，不含 CTA。

验收标准 → 客观验证方式：真实 Chrome 走完四步 + 两条 POST 断言 + 真假两分支 + 无自动切换 + 单测 + 后端幂等用例复跑 + audit errors 空。

## Implement（已完成）

- 新增 `frontend/reassessment.js`（`reassessmentSection()` / `completionCard()`）。
- 改 `frontend/app.js`（reports 取数 + `.companion-health` 内复测区块 + 4 个 action + `respondReassessment()` / `writeBackReassessment()` + `createAssessment()` 记承接测评 id + 完成页回写提示）、`frontend/client.css`、`frontend/server.cjs`、`frontend/package.json`。
- 新增 `frontend/unit/reassessment.test.js`（9 项）、`frontend/tests/reassessment-cta.spec.js`（3 项）。
- 文档：`frontend/README.md`（CA 对接 C4 一节）、`PROJECT_MEMORY.md`、`.trellis/spec/frontend/testing-and-acceptance.md`。

## Verify（已完成）

改动文件：见上（`git diff --stat` 与首次提交一致）。

跑过的命令与结果（原样）：

- `cd frontend && npm run check` → exit 0
- `cd frontend && npm run test:unit` → `tests 60 / pass 60 / fail 0`
- `cd frontend && npx playwright test tests/reassessment-cta.spec.js --reporter=list` → `3 passed (2.7m)`（1.1m / 1.2m / 24.1s）
- `cd frontend && npx playwright test tests/companion-panel.spec.js tests/growth-cycle-panel.spec.js tests/growth-window.spec.js tests/robot-account-row.spec.js --reporter=list` → `6 passed (1.8m)`
- `cd backend && uv run --no-sync python -m pytest tests/test_ca_display.py -q` → `52 passed, 1 warning in 207.49s (0:03:27)`
- `python3 scripts/audit_documents.py` → `errors []`（`markdown_files 80 / local_links_checked 504 / operations 61 / schemas 82`）
- 截图 7 张在 `.trellis/tasks/T-035/shots/`；已用 `read_file` 看过 `result-switch-desktop.png` / `result-switch-mobile.png` / `declined-expanded-desktop.png` 三张，渲染符合预期（结果卡在互动健康度内、人设卡仍是原角色、窄屏不溢出）。

验证中修掉的三处（首轮真实浏览器全红）：

1. `reassessmentSection()` 的 declined 分支没把 `expanded` 放进返回值，`view.expanded` 恒 `undefined` → 展开点不动（已补 `expanded` 字段 + 单测断言）。
2. 用例断言的原因文案写错（事件 `trigger_type=low_engagement` → 「近期互动偏少」，不是健康度的 `continuous_low_engagement`）。
3. 用例在 `page.reload()` 后断言结果卡的名字与分数——那部分只在会话态存在；改成先点导航（hash 路由）看会话态、再重载看中性说明。

前任声明与磁盘不符：无（本任务首轮即 `doing`，此前无 `progress.md`）。

## 未完成 / 交给编排侧

- 后端 `ca_reassessment_event.event_id` 全局唯一 vs 合成 fixture 共用事件 id → 同一场景全库只能被一个儿童回写一次（第二个 500）。本轮未修（超范围），用例侧用独有 `event_id` 绕开。详见 `report.md`「偏离与理由」第 1 条。

## 下一步

Finish：提交 + 收口（本任务 `gate: none` → `status: done`，无门禁申请）。
