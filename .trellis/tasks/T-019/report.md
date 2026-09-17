# T-019 报告：家长姓名为空时回落手机号，不再显示内部账号 parent-<uuid>

## goal

家长姓名为空时 5 处运营界面（家庭列表、家庭详情、儿童详情、CA 账户页、操作审计）统一回落到手机号，不再显示内部账号 `parent-<uuid>`；优先抽公共函数，别在 5 个模板各写一份。

## 实际做了什么

根因在公共回落链：`ops/templatetags/ops_labels.py` 的 `display_name` 过滤器是 `name → username → fallback`，家长账号的 `username` 恰好是 `parent-<uuid>`，所以姓名一空就露内部账号。审计「对象」列副行另有两条独立回落（`core/api/common.py` 的 `describe_target`、`ops/api.py` 的 `_family_label`），同样会在家长没填姓名时退到 `username`。

改法是把「家长没填姓名 → 手机号」这条规则收进一处公共 property：

1. `backend/dingdong_ca/users/models.py` 给 `User` 加 `display_name` property：`name →（家长）phone → username`。
2. `backend/dingdong_ca/ops/templatetags/ops_labels.py` 的 `display_name` 过滤器改为 `getattr(value, "display_name", "") or fallback`，覆盖 5 处模板中的家长名渲染（家庭列表、家庭详情、儿童详情、CA 账户页、操作审计「操作人」列）。
3. `backend/dingdong_ca/core/api/common.py` 的 `describe_target` 关联对象名改为优先取 `display_name`，覆盖审计「对象」列副行（如 `登录凭据（+8613…）`）。
4. `backend/dingdong_ca/ops/api.py` 的 `_family_label` 同样改取 `display_name`，覆盖家庭冻结/恢复审计的对象标签（`+8613… 的家庭（尾号 xxxx）`）。

staff 账号的回落行为不变（`name → username`），没有破坏操作人/运营人员的显示。

## 验证命令与真实输出

红（把 4 个源文件先 `git checkout --` 还原到 HEAD，跑完 `git apply` 恢复）：

```
cd backend && uv run pytest tests/test_ops_console.py tests/test_ops_ca_accounts.py tests/test_ops_audit_scope.py -k "parent_without_name or audit_object_subline" -q
→ 3 failed, 57 deselected in 18.42s
  （失败断言输出：操作人列与对象列副行都出现 parent-98b4bf42c9）
```

绿：

```
同命令（恢复修复后）
→ 3 passed, 57 deselected in 19.70s

cd backend && uv run pytest tests/test_ops_console.py tests/test_ops_ca_accounts.py tests/test_ops_audit_scope.py -q
→ 60 passed in 192.05s (0:03:12)

python3 scripts/audit_documents.py
→ {"markdown_files": 80, "local_links_checked": 497, "archived_files_checked": 85, "operations": 55, "schemas": 65, "errors": []}

cd backend && uv run ruff check dingdong_ca/users/models.py dingdong_ca/ops/templatetags/ops_labels.py dingdong_ca/core/api/common.py dingdong_ca/ops/api.py tests/test_ops_console.py tests/test_ops_ca_accounts.py tests/test_ops_audit_scope.py
→ All checks passed!

cd backend && uv run python manage.py check
→ System check identified no issues (0 silenced).

cd frontend && npx playwright test tests/parent-name-fallback.spec.js --reporter=list
→ 1 passed (12.5s)

cd frontend && node --check tests/parent-name-fallback.spec.js → exit 0
cd frontend && npm run check → exit 0
```

新增 3 条后端用例（分别锁住家庭列表/详情/儿童详情、CA 账户页、审计对象副行），外加 1 条真实 Chrome 用例一次走完 5 处并截图。

## 未验证项

- 未跑后端全量 266 项：本任务只改展示回落，acceptance 指定 3 个测试文件已全绿，且 `test_ops_console.py` 内含「每个角色点全部后台页面无 500」的用例，覆盖 `display_name` 的其它使用点（operator 头像、services/dashboard/job 等），未另跑全量，符合仓库「别无差别重跑全量」的约定。
- `_family_label` 只在家庭冻结/恢复审计路径使用，未用真实 Chrome 复现「冻结家庭」动作来截图；其回落由 property 与家庭状态用例共同保证，后端测试覆盖该函数所在文件（`test_ops_console.py` 家庭状态相关用例）。
- 现有历史审计记录里已经存进 `target_label` 的 `parent-<uuid>` 字符串不会被本轮改动回填改写（`target_label` 是写入时快照）；本轮只保证新写入的记录回落手机号。库内旧记录如仍有 `parent-<uuid>`，属存量数据，不在本任务范围。

## 偏离与理由

1. 比 5 处模板多改了 `describe_target` 与 `_family_label` 两处回落：orchestrator 2026-09-17T11:48Z 已明确把审计「对象」列副行并入本任务（「一并纳入本任务回落范围，不另开任务」），这两处正是该副行的标签来源，不算额外扩范围。
2. 选择给 `User` 加 property 而不是在 5 个模板各写判断：notes 要求「优先抽公共函数」，property 是唯一一处改完三处回落点同源，避免下次再漏一处。
3. staff 账号回落保持 `name → username` 不变：目标只针对家长账号，staff 的 `username`（如 `admin`、`ops-…`）本就是「登录账号」语义，账号与权限页也会显示，不在回落范围。
