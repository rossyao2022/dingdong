# T-044 progress

## 取任务
- 第 1 节门禁：`gates.md` 决定段最后两条 `APPROVE`（T-042 2026-09-18T01:19Z、T-040 2026-09-17T21:36Z）都已有对应 `EXECUTED`（T-042/T-043 push），无待执行的 APPROVE → 跳过第 1 节。
- 本轮取 `queue.md` 第一个 `status: todo` = T-044（P-19 归档后状态口径统一 + O-12/O-13/O-14 打包），已改 `doing`。

## Plan（已完成）
- 客观验证：①P-19 后端「归档后」回归用例（关联结束态 + 成长观察 + 展示面三处口径 + 报告不被删）；②O-12/O-13/O-14 各一个后端用例（卡片数字与标签同口径、详情页排除自身且仅一条时整块不显示、待办最新 5 条倒序且说明含截断）；③真实 Chrome 归档探针 spec（含 390×844）；④`uv run pytest` 相关模块；⑤`npm run check` + `npm run test:unit`；⑥`audit_documents.py` errors 为空。
- 判据核对（P-19 是否与代码现实冲突）：`ExternalAssociation` 只有 `child` 外键、没有 `ca_account` 外键；`ca_account_one_active_child` 条件唯一保证「换机必须先归档旧号」，`child_one_association` 条件唯一保证同一儿童同时最多一条 `verified` 关联 ⇒ 归档那一刻该儿童的 `verified` 关联就是这台旧机器人的，一对一成立，无需 blocked。

## Implement（已完成）
- 新增 `backend/dingdong_ca/core/services/associations.py`：`end_association(a, user)`（`revoked` + `ended_at` + 检查点 `blocked` + `association.revoke` 审计）。
- `backend/dingdong_ca/core/services/ca_account.py`：`retire_account()` 包进 `transaction.atomic()`，归档后遍历该儿童 `verified` 关联，按 `lock_association` 锁序调 `end_association`。
- `backend/dingdong_ca/core/api/robots.py`：`revoke()` 改调同一个 `end_association`（去掉视图里那份重复实现）。
- `backend/dingdong_ca/ops/templates/ops/dashboard.html`：卡片标签与区块标题「报告生成异常」→「生成任务异常」；服务事项区块加「最多显示 5 条（按提交时间从新到旧）。」
- `backend/dingdong_ca/ops/services.py`：`open_service_items` 改 `order_by("-created_at")[:5]`。
- `backend/dingdong_ca/ops/views.py`：`child_requests` 加 `.exclude(pk=row.pk)`。
- `frontend/tests/ops-console.spec.js:137`：断言文案同步为「生成任务异常」。
- 新增 `frontend/tests/t044-archive-consistency.spec.js`（真实 Chrome）。
- 文档：`backend/docs/OPS_MANUAL.md`（标签与 5 条截断）、`frontend/README.md`（归档口径一句）、`设计/CA对接_C1_ca_account_id设计_20260916.md`（§5② 缓解措施第 4 条）。
- 新增后端用例：`tests/test_m3.py::test_retiring_account_ends_verified_association`、`tests/test_ops_console.py::test_dashboard_failed_job_card_label_matches_all_kinds` / `::test_dashboard_todo_lists_newest_five_service_requests`、`tests/test_ops_services.py::test_service_detail_other_requests_exclude_current_row`。

## Verify（已完成）
- 先失败（改代码前）：4 项新用例全红——`test_retiring_account_ends_verified_association` → `assert [('verified', 'enabled')] == [('revoked', 'blocked')]`；`test_dashboard_failed_job_card_label_matches_all_kinds` → `assert '生成任务异常' in body`；`test_dashboard_todo_lists_newest_five_service_requests` → `NameError: make_service_request`（用例自身漏 import，已补）；`test_service_detail_other_requests_exclude_current_row` → 集合多出当前事项 pk。
- 修复后：4 项 `4 passed in 48.43s`（其中 O-13 一项因 `child_requests` 为空时是空 QuerySet，断言改 `list(...) == []` 后单跑 `1 passed in 23.24s`）。
- 真实 Chrome：`npx playwright test tests/t044-archive-consistency.spec.js --reporter=list` → 第一轮失败于 `.account-row` nth(1)（该儿童只有 1 个号，归档后只剩 1 行）→ 改断言后 `1 passed (26.5s)`；截图 3 张在 `.trellis/tasks/T-044/shots/`（桌面账户页 / 桌面报告页 / 390×844 报告页），逐张看过。
- `cd frontend && npm run check` exit 0；`npm run test:unit` → `tests 67 / pass 67 / fail 0`。
- 后端回归（已完成）：`uv run pytest tests/test_ca_accounts.py tests/test_m3.py tests/test_ops_console.py tests/test_ops_services.py tests/test_ops_ca_accounts.py tests/test_ops_audit_scope.py -q` → `133 passed in 891.34s (0:14:51)`。
- 静态检查：`ruff check` `All checks passed!`、`ruff format --check --target-version py313 .` `133 files already formatted`（首轮 1 file would be reformatted = 本轮新增用例，已 format）、`manage.py check` 0 issue、`makemigrations --check --dry-run` `No changes detected`。
- 真实 Chrome 回归：`npx playwright test tests/ops-console.spec.js tests/ca-account.spec.js --reporter=list` → `15 passed (2.9m)` + `1 failed`；失败项 `ops-console.spec.js:184` 题库用例 `page.goto: net::ERR_ABORTED at http://127.0.0.1:8017/ops/questionnaires/`，单独 `--grep` 复跑 `1 failed (20.4s)`；归因证据：改动前基线日志 `.trellis/.runtime/baseline-frontend.log`（2026-09-17 11:20）第 114 行同一文件同一行号逐字相同，该基线 `18 passed`、`TEST rc=1`。
- 新增真实 Chrome `tests/t044-ops-labels.spec.js`（运营端 O-12/O-13/O-14）→ `1 passed (13.6s)`，截图 3 张。
- `python3 scripts/audit_documents.py` → `{"markdown_files": 80, "local_links_checked": 518, "archived_files_checked": 85, "operations": 61, "schemas": 83, "errors": []}`。
- 修复后新用例最终复跑：`4 passed in 50.33s`。
- 顺带 `npx playwright test tests/ops-screenshots.spec.js --reporter=list` → `1 passed (45.7s)`，刷新 `frontend/docs/ops/` 21 张留档截图（该目录在 `.gitignore` 内，不入库）。

## Finish（已完成）
- 提交与推送：见 report.md 与 `gates.md` 的 `EXECUTED T-044 push`；`queue.md` T-044 `status` 改 `done` 并补执行结果；`experiment-log.md` 追加 T-044 一行；`status.md` 整文件重写（末尾 `## 驱动告警` 原样保留）。
- 本任务 `gate: none`，无门禁申请；按 notes 直推并补 `EXECUTED` 行。
