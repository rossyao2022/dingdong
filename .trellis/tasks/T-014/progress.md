# T-014 progress

## 已完成阶段

- Plan（2026-09-17）
- Implement（2026-09-17）
- Verify（2026-09-17）
- Finish（2026-09-17）

## Plan 事实

- 缺陷来源：`.trellis/tasks/T-003/backlog.md` O-03。审计「对象」列实测为「未知（login_grant） login grant（test-phase1-v1-1）」。
- 渲染链路：`backend/dingdong_ca/ops/templates/ops/audit.html:64-68`（`row.target_kind|label:"TARGET_KIND"` + `row.target_label`）。
- 写入链路：`backend/dingdong_ca/core/api/accounts.py:186` `audit(user, "auth.login", grant)` → `core/api/common.py:198-204`：`target_kind=obj._meta.db_table`、`target_label=describe_target(obj)`；`describe_target` 无业务名可借时写 `f"{obj._meta.verbose_name}（{name}）"`（英文模型名）。
- 本地合成库实测（只读查询）：审计共 471 条，`target_kind=login_grant` 154 条，`target_label` 全部形如 `login grant（parent-<uuid>）`；同页还有 `assessment session（…）`、`consent grant（…）`、`external association（…）`、`activity record（…）`；`algorithm_attempt` 未在 `TARGET_KIND` 里，页面显示「未知（algorithm_attempt）」（库内 2 条）。
- 模型注册表与 `TARGET_KIND` 对比：33 张表、`TARGET_KIND` 17 个键，缺 16 个；逐个核对全部 `audit(` / `ops_audit(` 调用点的目标对象后，只有 `login_grant`、`algorithm_attempt` 在审计数据里真实出现。

## Implement 事实（改动文件）

- `backend/dingdong_ca/ops/labels.py`：`TARGET_KIND` 增 `login_grant: 登录凭据`、`algorithm_attempt: 算法尝试`（后者词条取自 `设计/数据库表结构_V0.1.md:176` 的「算法尝试」）；新增纯函数 `target_name(value, model_names)`，把「英文模型名（关联对象名）」的前缀换成中文，换不掉的原样返回。
- `backend/dingdong_ca/ops/templatetags/ops_labels.py`：新增过滤器 `audit_target` + `_model_names_by_verbose_name()`（`lru_cache`，从 Django 模型注册表取 `verbose_name -> TARGET_KIND[db_table]`，不手抄英文名表）。
- `backend/dingdong_ca/ops/templates/ops/audit.html:66`、`ops/dashboard.html:236`：`target_label` 改用 `|audit_target`。
- `backend/tests/test_ops_audit_scope.py`：新增 2 条用例（页面级 + 过滤器单元级），首行加 `import uuid`。
- `frontend/tests/audit-object-labels.spec.js`：新增 1 条真实 Chrome 用例。

## 跑过的命令与结果（原样抄）

- 红：`cd backend && uv run --no-sync pytest tests/test_ops_audit_scope.py -q -k "object_column or object_label"` → `2 failed, 9 deselected in 16.17s`（断言 `assert '登录凭据' in '...'`；`ImportError: cannot import name 'audit_target'`），原文 `.trellis/tasks/T-014/red-pytest.txt`
- 红（真实 Chrome）：`npx playwright test tests/audit-object-labels.spec.js --reporter=list` → `1 failed`，第一行对象列实际值 `未知（login_grant）\n login grant（parent-audit-mu5dsnns-72b641）`，原文 `.trellis/tasks/T-014/red-chrome.txt`，截图 `shots/ops-audit-before-fix.png`
- 绿：`cd backend && uv run --no-sync pytest tests/test_ops_audit_scope.py -q` → `11 passed in 45.38s`
- 绿（真实 Chrome）：`npx playwright test tests/audit-object-labels.spec.js --reporter=list` → `1 passed (8.2s)`
- 回归（后端全量）：`cd backend && uv run --no-sync pytest -q` → `273 passed in 1013.68s (0:16:53)`，原文 `.trellis/tasks/T-014/backend-full.txt`
- 回归（后端定向）：`uv run --no-sync pytest tests/test_ops_console.py tests/test_ops_filters.py tests/test_ca_accounts.py -q` → `70 passed in 185.56s (0:03:05)`
- `cd frontend && npm run check` → exit 0
- `cd frontend && npm run test:unit` → `tests 16 / pass 16 / fail 0 / duration_ms 71.041042`
- `python3 scripts/audit_documents.py` → `{"markdown_files": 80, "local_links_checked": 497, "archived_files_checked": 85, "operations": 55, "schemas": 65, "errors": []}`

## 证据

- `.trellis/tasks/T-014/shots/ops-audit-before-fix.png`（改前，Playwright 失败截图）
- `.trellis/tasks/T-014/shots/ops-audit-objects-desktop.png`、`ops-audit-objects-table.png`（改后审计页，对象列全中文）
- `.trellis/tasks/T-014/shots/ops-dashboard-recent-ops.png`（首页「最近操作」同口径）

## 下一步

收尾：report.md、queue `status: done`、experiment-log、status.md、commit + push + gates.md 补 EXECUTED 行。
