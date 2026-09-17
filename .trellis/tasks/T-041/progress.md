# T-041 progress

## 取任务与核对式续跑
- 本轮取 queue.md 第一个 `status: todo` = T-041，已改 `doing`。
- 前任声明与磁盘不符：前任 `progress.md` 写「已改 `doing`」，但本轮开工时 `queue.md` 是 `todo`。原因见 `runs.log`：`2026-09-17T22:25:51Z ROUND T-041 FAIL 2406s dbbba00 … rc=143,dirty-worktree` + `RESET T-041 doing→todo（本轮未收口，复位供下一轮重取）`——驱动把上一轮中断的任务复位了，不是前任漏改。
- 磁盘对照（前任声明的改动文件逐条对上，均在）：`backend/dingdong_ca/ops/labels.py`、`ops/templatetags/ops_labels.py`、`ops/templates/ops/{services,service_detail,ca_accounts,child_detail,family_detail,activities,activity_preview}.html`、`core/api/robots.py`、`frontend/app.js`、`backend/tests/{test_ops_services,test_ops_ca_accounts,test_ops_console,test_ops_content,test_m3}.py`、`frontend/tests/t041-dialog-and-labels.spec.js`（新增，未跟踪）、`.trellis/spec/frontend/state-and-rendering.md`、`frontend/README.md`、`.trellis/tasks/T-041/`。前任声明的 `PROJECT_MEMORY.md` 同步**不在**改动里（未做），本轮补上。
- 重跑前任记录的最后一个验证命令：`npx playwright test tests/t041-dialog-and-labels.spec.js --reporter=list` → `3 passed (49.3s)`（前任写到「运行中」后进程被杀）。

## Plan（已完成）
- P-16：`render():651` 调 `stopWork():106`（`$("#dialog").close()` + `childEdit=null`），`#reports` 轮询 3000ms。修法按 gates.md `APPROVE T-040`：拆「离开上下文」与「重渲染」，对话框打开期间挂起轮询。
- P-17：`robots.py` 两处 `ApiError("PROOF_INVALID", 422)`，`common.py` 的 `message = message or code` 导致家长看到 code 本身。
- O-08 四处、O-09 家庭角色、O-10 岛屿/情绪、O-11「指纹」口径，逐处定位到模板行（见前任 progress，本轮复核一致）。
- 验收怎么客观验证：后端模板层用 pytest 断言页面正文计数；P-16/P-17 用真实 Chrome 断言请求计数与 `<dialog>.open`，不靠观感。

## Implement（已完成，本轮追加一处）
- 前任已实现：`ops/labels.py` 新增 `ACTIVITY_ISLAND`/`ACTIVITY_MOOD`/`FAMILY_ROLE`；`ops_labels.py` 的 MAPS 三项 + 新过滤器 `known_label`；七个运营模板；`robots.py` 的 `PROOF_INVALID_MESSAGE`；`frontend/app.js` 拆 `leaveContext()`/`closeDialog()`/`stopWork()` + `schedulePoll()` + `pollPending` + `<dialog>` close 恢复 + 五处显式 `closeDialog()`。
- 本轮追加：`frontend/app.js` 的 `render()` 补回 `window.speechSynthesis?.cancel()`。前任把 `render()` 里 `stopWork()` 整体换掉时，连带去掉了原有的朗读取消——答题/活动步骤重渲染时上一题的朗读不会停，会盖住新一题的内容。朗读与对话框无关，属被牵连的既有行为，补回。同步更新 `.trellis/spec/frontend/state-and-rendering.md`（`render()` 步骤 1 与生命周期小节）与 `frontend/README.md`。
- 收口项补齐：`PROJECT_MEMORY.md` 加「最近一轮工作 T-041」段并把 T-039 段改为「上一轮」；`frontend/README.md` 的 P-16 证据引用从已删截图改为 `.log`。

## Verify（已完成）
- 后端（4 个 ops 文件）：`86 passed in 359.42s`；`tests/test_m3.py`：`29 passed in 389.32s`。
- 前端：`npm run check` exit 0；`npm run test:unit` `tests 67 / pass 67 / fail 0`。
- 真实 Chrome `tests/t041-dialog-and-labels.spec.js`：`3 passed (49.3s)`。
- 先失败证据（临时把 `render()` 换回 `stopWork()`，跑完从备份还原并 `diff` 校验一致）：P-16 用例在 `expect(...#dialog.open).toBe(true)` 处失败 `Expected: true / Received: false`（逐字输出存 `.trellis/tasks/T-041/shots/p16-before-fix-dialog-closed.log`）。
- 回归 `tests/flows.spec.js` + `robot-label` + `parent-name-fallback` + `ca-account`：`16 passed / 2 failed (4.5m)`。两个失败用 pre-fix 版 `app.js`（`git show HEAD:frontend/app.js`）逐字复现，判定与本轮改动无关；根因是本地环境（worker 不消费 + 短信频控 429）。
- `ruff check` / `ruff format --check --target-version py313 .`（132 files）/ `manage.py check` 干净；`audit_documents.py` errors `[]`。
- 未跑：`frontend/deployment-tests/parent-conflict-recovery.spec.js`（指向公网入口、需管理员凭据、会在生产库建账号，权限边界外）。

## 下一步
- 写 `report.md` → commit（首行 `[T-041]`）→ push + `gates.md` 补 `EXECUTED` → `experiment-log.md`/`status.md`/queue 收口。
