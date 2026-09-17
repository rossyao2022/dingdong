# T-030 进度

## 已完成阶段

- Plan
- 核对（续跑核对：上一轮 2026-09-17T13:33Z 被限流中断，本轮接着做）
- Implement
- Verify
- Finish

## 续跑核对（前任声明与磁盘对照）

- `progress.md` 的「改动文件」「跑过的命令与结果」两节为空（上一轮未填），磁盘实际已有：`backend/dingdong_ca/ops/labels.py`（+3 词条）、`backend/tests/test_ops_console.py`（+1 用例）、`.trellis/tasks/T-030/`（脚本与证据 16 个文件 + `shots/` 11 张）、未跟踪的 `frontend/tests/t030-batch-disposal.spec.js`。
- `progress.md` 未记录任何验证命令，无「最后一个验证命令」可重跑；改以重跑 `state_snapshot.py` 复核库内状态：输出与 `after-state.txt` 一致（Child `archived`、Family `closed`、家长 `is_active=False`、`failed_jobs=0`、家庭 active 233、儿童 active 224）。
- 库内与 `after-state.txt` 的差异（以磁盘为准）：家长未失效登录凭据 2 条（`login_grant/aec9ff58-…` 创建于 13:30:19Z、`login_grant/96563219-…` 创建于 13:32:16Z），即上一轮处置后该家长仍有可用登录凭据；`after-state.txt` 只打印了最新一条（`96563219`）故未暴露第二条。

## 本轮实际改动

- `backend/dingdong_ca/ops/labels.py`：新增 `AUDIT_ACTION["synthetic.dispose"]`、`TARGET_KIND["sync_checkpoint"]`、`TARGET_KIND["family_membership"]`。
- `backend/tests/test_ops_console.py`：新增 `test_synthetic_dispose_audit_vocabulary`。
- `.trellis/tasks/T-030/dispose_synthetic_batch.py`（上一轮写、本轮改）：处置脚本，默认预演，`T030_APPLY=1` 写库，`T030_REPAIR_AUDIT=1` 修审计文案；本轮把 background_job 的 note 缩短为「失败证据见 T-020 报告与失败快照」（超过 32 字符的含「-」文本会被 `humanize_value` 当内部编号截断）。
- `.trellis/tasks/T-030/state_snapshot.py`、`audit_rows_snapshot.py`（新增，后者本轮写）：状态与审计行快照。
- `frontend/tests/t030-batch-disposal.spec.js`（上一轮写）：真实 Chrome 两阶段验收用例（`T030_PHASE=before|after`）。
- 证据文件：`before-state.txt`、`after-state.txt`、`resume-state.txt`、`final-state.txt`、`dispose-output.txt`、`dispose-apply-final.txt`、`repair-dryrun.txt`、`audit-repair-apply.txt`、`audit-rows-before-repair.txt`、`audit-rows-after-repair.txt`、`after-phase-run.txt`、`after-phase-rerun.txt`、`after-phase-final.txt`、`shots/`（before 4 张 + after 7 张）。

## 跑过的命令与结果（原样抄）

- `cd backend && uv run python manage.py shell < ../.trellis/tasks/T-030/state_snapshot.py` → Child `archived`、Family `closed`、`User is_active=False`、`failed_jobs=0`、家庭 active 233、儿童 active 224。
- `cd backend && uv run python manage.py shell < ../.trellis/tasks/T-030/audit_rows_snapshot.py` → `AuditEvent(synthetic.dispose)=8`、`家长未失效登录凭据=2 条`。
- `cd backend && T030_REPAIR_AUDIT=1 T030_APPLY=1 uv run python manage.py shell < ../.trellis/tasks/T-030/dispose_synthetic_batch.py` → `已写库：状态变更 2 项，审计 synthetic.dispose × 2 条`（2 条为漏网登录凭据）、`审计文案待修正 8 条，跳过 0 条（已写库）`、`AuditEvent(synthetic.dispose)=10`。
- `cd backend && T030_REPAIR_AUDIT=1 T030_APPLY=1 …`（改 note 后复跑）→ `审计文案待修正 1 条，跳过 0 条（已写库）`，其余 9 条「文案已是当前形态」。
- `cd frontend && T030_PHASE=after npx playwright test tests/t030-batch-disposal.spec.js` → `3 passed (13.1s)`。
- `cd backend && T030_APPLY=1 uv run python manage.py shell < ../.trellis/tasks/T-030/dispose_synthetic_batch.py`（末次幂等复跑）→ `汇总：状态变更 0 项，已是目标状态 4 项，无状态字段 3 项`。
- `cd backend && uv run pytest tests/test_ops_console.py` → `41 passed in 150.08s (0:02:30)`。
- `python3 scripts/audit_documents.py` → `{"markdown_files": 80, "local_links_checked": 497, "archived_files_checked": 85, "operations": 55, "schemas": 65, "errors": []}`。
- `cd backend && uv run pytest tests/test_ops_audit_scope.py tests/test_ca_accounts.py` → `36 passed in 81.30s (0:01:21)`。
- 末次快照：`家长未失效登录凭据=0 条`、`家长 is_active=False`、`AuditEvent(synthetic.dispose)=10`。

## 下一步

无（任务完成）：`status` 改 `done`，`gates.md` 补 `EXECUTED T-030 push`，提交并推送 `c893a3d..b95ecf2`，远端 sha `b95ecf2d3d9351666d7d822b8ecb81cca9c9b211`。
