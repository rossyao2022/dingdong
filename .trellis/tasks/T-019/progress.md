# T-019 进度（只记可核对事实）

## 已完成阶段

- Plan：完成。读 `AGENTS.md` TRELLIS 约束/权限边界、`.trellis/workflow.md` Phase 索引、`.trellis/spec/backend/index.md`、`.trellis/loop/gates.md`、`.trellis/loop/queue.md`。决定段无待执行 APPROVE（T-003 决定含「第二批每完成一个任务 commit 后可直接 push」直推规则，本任务属第二批）。取队首 `status: todo` = T-019，已改 `doing`。
- Implement：完成。给 `User` 模型加 `display_name` property，模板过滤器 / 审计对象标签 / 家庭标签三处共用，家长没填姓名时回落手机号，不再显示 `parent-<uuid>`。
- Verify：完成。三条新用例红→绿，3 个验收测试文件全绿，audit / ruff / manage.py check 干净，真实 Chrome 5 处截图通过。
- Finish：进行中（report.md 已写，待 commit + push + 收尾记录）。

## 改动文件

1. `backend/dingdong_ca/users/models.py` —— `User.display_name` property（`name → 家长phone → username`）。
2. `backend/dingdong_ca/ops/templatetags/ops_labels.py` —— `display_name` 过滤器改用 property。
3. `backend/dingdong_ca/core/api/common.py` —— `describe_target` 的关联对象名改用 property（审计「对象」列副行）。
4. `backend/dingdong_ca/ops/api.py` —— `_family_label` 改用 property（家庭状态审计的对象标签）。
5. `backend/tests/test_ops_console.py` —— 新增 `test_parent_without_name_falls_back_to_phone_not_internal_account`。
6. `backend/tests/test_ops_ca_accounts.py` —— 新增 `test_parent_without_name_shows_phone_not_internal_account`。
7. `backend/tests/test_ops_audit_scope.py` —— 新增 `test_audit_object_subline_parent_name_falls_back_to_phone`；同步修正一处过时注释。
8. `frontend/tests/parent-name-fallback.spec.js`（新增）—— 真实 Chrome 5 处断言 + 截图。
9. `.trellis/tasks/T-019/shots/` 5 张截图（families / family-detail / child-detail / ca-accounts / audit）。

## 跑过的命令与结果（原样抄）

红（先 `git checkout --` 还原 4 个源文件跑，跑完 `git apply` 恢复）：

- `cd backend && uv run pytest tests/test_ops_console.py tests/test_ops_ca_accounts.py tests/test_ops_audit_scope.py -k "parent_without_name or audit_object_subline" -q` → `3 failed, 57 deselected in 18.42s`（失败断言显示 `parent-98b4bf42c9` 出现在操作人列与对象列副行）。

绿：

- 同命令（恢复修复后）→ `3 passed, 57 deselected in 19.70s`。
- `cd backend && uv run pytest tests/test_ops_console.py tests/test_ops_ca_accounts.py tests/test_ops_audit_scope.py -q` → `60 passed in 192.05s (0:03:12)`。
- `python3 scripts/audit_documents.py` → `{"markdown_files": 80, "local_links_checked": 497, "archived_files_checked": 85, "operations": 55, "schemas": 65, "errors": []}`。
- `cd backend && uv run ruff check <7 个改动文件>` → `All checks passed!`。
- `cd backend && uv run python manage.py check` → `System check identified no issues (0 silenced)`。
- `cd frontend && npx playwright test tests/parent-name-fallback.spec.js --reporter=list` → `1 passed (12.5s)`。
- `cd frontend && node --check tests/parent-name-fallback.spec.js` → exit 0；`npm run check` → exit 0。

## 下一步

Commit `[T-019]` + 按第二批直推规则 push + gates.md 补 EXECUTED + 收尾记录。
