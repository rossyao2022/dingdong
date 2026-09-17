# T-015 O-04 儿童详情加只读「机器人账户」一行

## 已完成阶段
- Plan：读任务 goal/acceptance/notes、`.trellis/spec/backend/index.md` 开工前检查；确认 `PERMISSIONS` 里 `child.view` 与 `ca_account.view` 允许的角色集合相同（operations/technical/account_admin），本行不需要额外权限门；确认 `child_bundle()` 只被 `views.child_detail` 使用。
- Implement：
  - `backend/dingdong_ca/ops/services.py`：`child_bundle()` 增 `CaAccount` 导入，返回 `ca_account`（该孩子 `status="active"` 的账户，无则 None）与 `retired_accounts`（已归档旧号计数）。
  - `backend/dingdong_ca/ops/views.py`：`child_detail()` 把 `ca_account` / `retired_accounts` 传入模板上下文。
  - `backend/dingdong_ca/ops/templates/ops/child_detail.html`：「基本信息」定义列表「所属家庭」之后新增一行「机器人账户」——有活跃账户时显示 `ca_account_id` + 绑定状态词条 + 状态词条 + 「在 CA 账户页查看」链接（`/ops/ca-accounts/?q=<账户号>`）；无活跃账户时显示「还没有机器人账户」空态并说明账户号何时生成；仅有换机后的旧号时附「已归档 N 个旧号」。
  - `backend/tests/test_ops_console.py`：新增 `test_child_detail_shows_robot_account_row`、`test_child_detail_robot_account_empty_state`；`ruff check --fix` 顺手修掉 T-013 遗留的 `I001`（同文件内一行 import 排序）。
  - `frontend/tests/robot-account-row.spec.js`：真实 Chrome 用例（有账户行 + 跳转落点 + 空态 + 窄屏 390×844 + 5 张截图）。
- Verify（已完成）：
  - TDD 红：`uv run --no-sync pytest tests/test_ops_console.py -k robot_account -q` → `2 failed, 37 deselected in 18.27s`。
  - TDD 绿：同命令 → `2 passed, 37 deselected in 19.24s`。
  - 验收指定文件：`uv run --no-sync pytest tests/test_ops_console.py tests/test_ops_ca_accounts.py -q` → `46 passed in 156.21s (0:02:36)`；格式整理后复跑 `46 passed in 154.39s (0:02:34)`。
  - 真实 Chrome：`npx playwright test tests/robot-account-row.spec.js --reporter=list` → `1 passed (10.7s)`；截图 5 张在 `.trellis/tasks/T-015/shots/`（尺寸实测：desktop 1280×1763、card 996×333、ca-accounts 1280×779、empty 1280×1763、mobile 390×2026）。
  - `npm run check` exit 0；`npm run test:unit` 16 pass 0 fail（74.191417ms）；`python3 scripts/audit_documents.py` errors `[]`；`python manage.py check` 无问题；`ruff check .` All checks passed。
  - Chrome 合成数据清理核对：`ca_account_t015 0`、`child_t015 0`、`staff_t015 0`、`parent_t015 0`。
- Finish：见 `report.md`；queue/gates/status/experiment-log 收尾记录待写。

## 改动文件
- backend/dingdong_ca/ops/services.py
- backend/dingdong_ca/ops/views.py
- backend/dingdong_ca/ops/templates/ops/child_detail.html
- backend/tests/test_ops_console.py
- frontend/tests/robot-account-row.spec.js
- .trellis/tasks/T-015/progress.md、report.md、shots/（5 张 png）

## 下一步
- commit（`[T-015]`）→ 按第一批直推规则 push → 回填 gates.md EXECUTED 行 → queue `status: done` → 写 status.md / experiment-log.md 收尾记录。
