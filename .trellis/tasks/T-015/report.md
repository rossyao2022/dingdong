# T-015 O-04 儿童详情加只读「机器人账户」一行

## goal

儿童详情页加一行只读「机器人账户」（账户号 + 绑定状态 + 跳 CA 账户页），运营排查同步问题时不必切页按手机号搜。

acceptance：有账户时儿童详情出现账户号与绑定状态、无账户时显示空态；`cd backend && uv run pytest tests/test_ops_console.py tests/test_ops_ca_accounts.py` 通过；audit errors 为空；真实 Chrome 打开儿童详情截图到 `.trellis/tasks/T-015/shots/`。

## 实际做了什么

1. `backend/dingdong_ca/ops/services.py` — `child_bundle()` 增 `CaAccount` 导入，返回两个新键：
   - `ca_account`：该孩子 `status="active"` 的账户（无则 `None`）。同一孩子同一时刻只有一个活跃号由数据库条件唯一约束保证，这里不再过滤多行。
   - `retired_accounts`：该孩子 `status="retired"` 的旧号计数（换机后保留、不再使用，只用于说明）。
2. `backend/dingdong_ca/ops/views.py` — `child_detail()` 把 `ca_account` / `retired_accounts` 传进模板上下文。
3. `backend/dingdong_ca/ops/templates/ops/child_detail.html` — 「基本信息」定义列表「所属家庭」之后新增一行「机器人账户」：
   - 有活跃账户：`<code>账户号</code>` + 绑定状态徽章（`CA_ACCOUNT_BIND_STATE` 词条）+ 状态徽章（`CA_ACCOUNT_STATUS` 词条）+「在 CA 账户页查看」链接（`{% url 'ops:ca_accounts' %}?q=<账户号>`，即按该账户号筛过的列表）+ 一行说明「绑定状态说的是与 DingDong 是否已接通；对方端点未开通时会一直是『待接通』，不是故障」（口径与 CA 账户页顶部说明一致）。
   - 无活跃账户：空态「还没有机器人账户」+ 说明账户号何时生成；若该孩子有换机后的旧号，附「已归档 N 个旧号（换机器人后保留，可到 CA 账户页按儿童称呼查）」——避免把 retired 旧号误当在用账户展示，也避免把「有旧号」说成「从没绑过」。
4. 测试（TDD 先红后绿）：
   - `backend/tests/test_ops_console.py` 新增 `test_child_detail_shows_robot_account_row`、`test_child_detail_robot_account_empty_state`。
   - `frontend/tests/robot-account-row.spec.js` 新增 1 条真实 Chrome 用例（有账户行 → 点链接跳 CA 账户页筛选结果 → 无账户孩子空态 → 390×844 窄屏），5 张截图落 `.trellis/tasks/T-015/shots/`。

权限：本行不需要额外权限门——`PERMISSIONS` 里 `child.view` 与 `ca_account.view` 允许的角色集合相同（operations / technical / account_admin）。

## 验证命令与真实输出

TDD 红（实现前）：

```
$ cd backend && uv run --no-sync pytest tests/test_ops_console.py -k robot_account -q
2 failed, 37 deselected in 18.27s
```
失败原因原文：`AssertionError: assert '机器人账户' in '...儿童详情 · 叮咚...'`、`AssertionError: assert '还没有机器人账户' in '...儿童详情 · 叮咚...'`。

TDD 绿（实现后）：

```
$ cd backend && uv run --no-sync pytest tests/test_ops_console.py -k robot_account -q
2 passed, 37 deselected in 19.24s
```

acceptance 指定的两个文件：

```
$ cd backend && uv run --no-sync pytest tests/test_ops_console.py tests/test_ops_ca_accounts.py -q
46 passed in 156.21s (0:02:36)          # 首次（格式整理前）
46 passed in 154.39s (0:02:34)          # 复跑（ruff format 整理测试文件后）
```

真实 Chrome（`npx playwright test tests/robot-account-row.spec.js --reporter=list`）：

```
  ✓  1 tests/robot-account-row.spec.js:85:1 › 儿童详情给出机器人账户号与绑定状态，并能跳到 CA 账户页 (9.9s)
  1 passed (10.7s)
```
用例内断言：基本信息卡出现「机器人账户」+ 账户号 + 「待接通」+「使用中」且不含 `unbound`；点「在 CA 账户页查看」后 URL 为 `/ops/ca-accounts/?q=<账户号>`、筛选框值等于该账户号、列表含该账户号与儿童称呼；无账户孩子的页面出现「还没有机器人账户」且不含别人的账户号；390×844 下该行仍可读。

截图 5 张（像素尺寸实测）：

| 文件 | 尺寸 |
| --- | --- |
| `ops-child-detail-account-desktop.png` | 1280×1763 |
| `ops-child-detail-account-card.png` | 996×333 |
| `ops-ca-accounts-filtered.png` | 1280×779 |
| `ops-child-detail-account-empty.png` | 1280×1763 |
| `ops-child-detail-account-mobile.png` | 390×2026 |

前端与文档门禁：

```
$ cd frontend && npm run check
> dingdong-parent@0.3.6 check
> node --check app.js && node --check api.js && node --check playworld.js && node --check server.cjs
（exit 0）

$ cd frontend && npm run test:unit
ℹ tests 16 / ℹ pass 16 / ℹ fail 0 / ℹ duration_ms 74.191417

$ python3 scripts/audit_documents.py
{"markdown_files": 80, "local_links_checked": 497, "archived_files_checked": 85, "operations": 55, "schemas": 65, "errors": []}
```

后端静态检查：

```
$ cd backend && uv run --no-sync python manage.py check
System check identified no issues (0 silenced).

$ cd backend && uv run --no-sync ruff check .
All checks passed!
```

Chrome 用例造的合成数据已清理（`finally` 内按账户号删除 CA 账户及其审计行、删两个儿童 / 家庭 / 成员关系 / 运营与家长账号）：

```
ca_account_t015 0
child_t015 0
staff_t015 0
parent_t015 0
```

## 未验证项

- 未跑后端全量回归（`tests/` 全量约 17 分钟）。改动只落在 `ops/` 的儿童详情聚合与模板，跑的是 acceptance 指定的两个文件（46 项，含 `test_ops_console.py` 全量与 `test_ops_ca_accounts.py` 全量）。
- 未在真实「换机后旧号归档」的家长端流程里走一遍再回看儿童详情（空态分支里「已归档 N 个旧号」是用 `ca_service.retire_account()` 直接归档造出来的，走的是真实服务函数，但没经过家长端换机交互）。
- 未验证其它角色（technical / account_admin）看这一行的表现：该行不按角色隐藏，`child.view` 与 `ca_account.view` 角色集合相同，用 operations 角色覆盖。

## 偏离与理由

- **超 acceptance 的范围（同文件内）**：`backend/tests/test_ops_console.py` 里 T-013 留下的 ruff `I001`（导入未排序）被 `ruff check --fix` 顺手修掉（只挪了一行 import 的位置，见 diff 顶部）。理由：本任务的质量检查要求 `ruff check` 干净，而这是全仓唯一一条 lint 错误，且就在本任务正在改的文件里。
- **未动**：`backend/tests/test_ops_audit_scope.py` 存在一条存量 `ruff format --check --target-version py313` 未格式化（T-014 遗留），与本次改动无关，按「不顺手改别的文件」留在原处，仅在此记录。
- **`retired_accounts` 的引入**：acceptance 只要求「有账户 / 无账户」两态，但只按 `status="active"` 判断会让「换机后只剩旧号」的孩子显示成「还没有机器人账户」。加了旧号计数说明，仍属只读展示，不动契约与数据模型。
