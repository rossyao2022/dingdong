# T-005 进度（O-01 修掉 CA 账户页跨行模板注释被当正文渲染）

## 已完成阶段
- Plan：读 backlog O-01 条目、`backend/dingdong_ca/ops/templates/ops/ca_accounts.html` 第 10–11 行、既有 `backend/tests/test_ops_ca_accounts.py`；定验收 = 新用例先失败 → 修后通过 + audit errors 空 + 真实 Chrome 复现原问题消失。
- Implement：模板跨行 `{# … #}` 改 `{% comment %}…{% endcomment %}`；测试文件新增 2 条用例。
- Verify：见下（已跑完）。

## 改动文件
- `backend/dingdong_ca/ops/templates/ops/ca_accounts.html`（第 10–11 行注释形式，1 处）
- `backend/tests/test_ops_ca_accounts.py`（+2 用例、+`re`/`Path` import、+`OPS_TEMPLATES` 常量）
- `.trellis/loop/queue.md`、`.trellis/loop/gates.md`（门禁执行：导入 T-005…T-021、T-003 标 `done`、补 EXECUTED 行）

## 跑过的命令与结果（原样抄）
- `cd backend && uv run pytest tests/test_ops_ca_accounts.py -q`（修复前）→ `2 failed, 5 passed in 27.37s`；`AssertionError: assert ['ops/ca_accounts.html:10'] == []`；渲染断言 `assert '{#' not in '<!doctype h...>\n</html>\n'`，泄漏原文 `{# 注意：Tabler 的 .alert 是 flex 容器，散落的文本节点会各占一列。`
- `cd backend && uv run pytest tests/test_ops_ca_accounts.py -q`（修复后）→ `7 passed in 28.84s`
- `cd backend && uv run pytest tests/test_ops_console.py tests/test_ops_ca_accounts.py -q` → `43 passed in 148.68s (0:02:28)`
- 真实 Chrome（webbridge session `dingdong-T-005`）打开 `http://127.0.0.1:8017/ops/ca-accounts/` → `{"hasComment":false,"hasCommentText":false}`，标题 `CA 账户 · 叮咚`；截图 `.trellis/tasks/T-005/shots/ops-ca-accounts-after.jpeg`（490716 bytes）
- 同基模板页面回归抽查（页面内 `fetch`）→ `/ops/ 200 leak=false | /ops/families/ 200 leak=false | /ops/audit/ 200 leak=false | /ops/accounts/ 200 leak=false | family=200 | child=200 (儿童详情) leak=false`
- `python3 scripts/audit_documents.py` → `{"markdown_files": 80, "local_links_checked": 497, "archived_files_checked": 85, "operations": 55, "schemas": 65, "errors": []}`

## 下一步
- 写 `report.md` → commit `[T-003]`（门禁导入）与 `[T-005]`（修复）→ push `origin/codex/release-v0.3.6`（第一批直推规则）→ `gates.md` 补 EXECUTED 行 → 记录 experiment-log 与 `status.md`。
