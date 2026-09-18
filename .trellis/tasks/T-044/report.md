# T-044 报告：P-19 归档后状态口径统一 + O-12/O-13/O-14 运营端三小项打包

## goal（摘自 queue.md）

修 T-042 巡检坐实的 P-19 与三条运营端小项。

- **P-19（修法已裁定，见 `gates.md` APPROVE T-042 2026-09-18T01:19Z）**：`retire_account()` 归档账户时一并结束该儿童的已核验 `ExternalAssociation`（模型已有 `status`/`ended_at`，不加迁移、不动对外契约），让 `#settings` 关联区块、`#reports` 成长观察、三个展示面在归档后口径一致；若发现 verified 关联与该账户并非一一对应，以实际数据只收口对应关联并写明判定依据，对不上就停下标 blocked。
- **O-12**：工作首页卡片标签「报告生成异常」改「生成任务异常」对齐区块口径（`failed_report_jobs` 可直接用，按 kind 拆两个计数不强制）。
- **O-13**：服务事项详情 `child_requests` 加 `.exclude(pk=row.pk)`；排除后为空则整块不显示。
- **O-14**：待办清单·服务事项改按提交时间倒序取最新 5 条，说明写明截断与排序。

## 实际做了什么

| 改动 | 文件 |
| --- | --- |
| 新增关联结束动作（唯一实现） | `backend/dingdong_ca/core/services/associations.py`（新文件） |
| 归档时一并结束已核验关联 | `backend/dingdong_ca/core/services/ca_account.py` |
| 「解除本地关联」改调同一函数 | `backend/dingdong_ca/core/api/robots.py` |
| O-12 卡片标签 + 区块标题 | `backend/dingdong_ca/ops/templates/ops/dashboard.html` |
| O-14 排序 + 区块说明 | `backend/dingdong_ca/ops/services.py`、`dashboard.html` |
| O-13 排除当前事项 | `backend/dingdong_ca/ops/views.py` |
| 前端断言同步（原句引用） | `frontend/tests/ops-console.spec.js:137` |
| 新用例（后端） | `backend/tests/test_m3.py`、`test_ops_console.py`、`test_ops_services.py` |
| 新用例（真实 Chrome） | `frontend/tests/t044-archive-consistency.spec.js`、`frontend/tests/t044-ops-labels.spec.js` |
| 文档同步 | `backend/docs/OPS_MANUAL.md`、`frontend/README.md`、`设计/CA对接_C1_ca_account_id设计_20260916.md`、`PROJECT_MEMORY.md` |

### P-19 的关键判据（`notes` 要求「若与代码现实冲突就停下」）

`ExternalAssociation` 的外键只有 `child` / `requested_by` / `consent_grant`，**没有 `ca_account` 外键**，所以「该儿童的已核验关联」是按 `child` 收口：

- `ca_account_one_active_child`（`child` + `status="active"` 条件唯一）保证换机必须先归档旧号才能发新号；
- `child_one_association`（`child` + `provider` + `status="verified"` 条件唯一）保证同一儿童同时最多一条已核验关联。

两条约束合起来 ⇒ 归档那一刻该儿童若还有 `verified` 关联，它就是这台旧机器人的，一对一成立，**未出现对不上的情况，无需 blocked**。归档在 `transaction.atomic()` 内完成，关联按既有锁序 `lock_association()`（Child → ConsentGrant → Association）加锁后再结束。

「结束关联」的三件事（`revoked` + `ended_at`、`SyncCheckpoint` 置 `blocked` + 清 `next_due_at`、写 `association.revoke` 审计）原先是 `robots.revoke` 视图里的实现，本轮抽到 `core/services/associations.py`，两个入口共用——避免归档路径与解绑路径各写一份状态机。**审计动作词沿用 `association.revoke`**（未新增动作词，避免动 `ops/labels.py` 词表与审计页断言）；归档本身另有 `ca_account.retire` 事件，两条记录都在。

## 验证命令与真实输出

### 先失败（改代码前，同一命令）

```
FAILED tests/test_m3.py::test_retiring_account_ends_verified_association
  AssertionError: assert [('verified', 'enabled')] == [('revoked', 'blocked')]
FAILED tests/test_ops_console.py::test_dashboard_failed_job_card_label_matches_all_kinds
  assert '生成任务异常' in '<!doctype html>...'
FAILED tests/test_ops_console.py::test_dashboard_todo_lists_newest_five_service_requests
  NameError: name 'make_service_request' is not defined   # 用例自身漏 import，已补
FAILED tests/test_ops_services.py::test_service_detail_other_requests_exclude_current_row
  assert {UUID('068346c2-...'), UUID('18c9d031-...'), UUID('521a1107-...')} == {UUID('18c9d031-...'), UUID('521a1107-...')}
3 failed in 27.10s      # 前三条同一次运行（第 4 条同轮亦 failed）
1 failed in 34.44s      # P-19 单跑
```

### 修复后

```
4 passed in 48.43s      # 四条新用例（首次合并运行，O-13 因空态是 QuerySet 而非 list 失败）
1 passed in 23.24s      # O-13 断言改 list(...) == [] 后单跑
```

### 回归

```
uv run pytest tests/test_ca_accounts.py tests/test_m3.py tests/test_ops_console.py \
  tests/test_ops_services.py tests/test_ops_ca_accounts.py tests/test_ops_audit_scope.py -q
→ 133 passed in 891.34s (0:14:51)

cd frontend && npm run check            → exit 0
npm run test:unit                       → tests 67 / pass 67 / fail 0 / duration_ms 100.79725

npx playwright test tests/t044-archive-consistency.spec.js --reporter=list
→ 1 passed (26.5s)      # 首轮 1 failed（.account-row nth(1)：该儿童只有 1 个号，归档后只剩 1 行），改断言后通过
npx playwright test tests/t044-ops-labels.spec.js --reporter=list
→ 1 passed (13.6s)      # 首轮 failed（User 无 created_at 字段）、次轮 failed（business_key 固定串撞唯一约束）、三轮 failed（parent_one_family：家长只能属于一个家庭），改种子后通过
npx playwright test tests/ops-console.spec.js tests/ca-account.spec.js --reporter=list
→ 15 passed (2.9m) + 1 failed
  失败项：ops-console.spec.js:184「题库：可视化新建草稿→校验→发布→复制新版本」
  错误：page.goto: net::ERR_ABORTED at http://127.0.0.1:8017/ops/questionnaires/
  单独 --grep 复跑：1 failed (20.4s)，可复现
npx playwright test tests/ops-screenshots.spec.js --reporter=list → 1 passed (45.7s)，已留档 21 张

python3 scripts/audit_documents.py
→ {"markdown_files": 80, "local_links_checked": 518, "archived_files_checked": 85,
   "operations": 61, "schemas": 83, "errors": []}

cd backend && uv run ruff check . → All checks passed!
uv run ruff format --check --target-version py313 . → 133 files already formatted
uv run python manage.py check → System check identified no issues (0 silenced).
uv run python manage.py makemigrations --check --dry-run → No changes detected
```

### 失败归因（不属于本轮改动）

`ops-console.spec.js` 的题库用例失败点与改动前基线逐字相同：[.trellis/.runtime/baseline-frontend.log](../.runtime/baseline-frontend.log)（文件时间 2026-09-17 11:20）第 114 行记录同一个 `net::ERR_ABORTED at .../ops/questionnaires/`、同一行号 246，该基线整体 `18 passed`、`TEST rc=1`。本轮未改题库相关代码（`git diff` 里无 `questionnaires` 相关文件）。

### 浏览器证据（真实 Chrome，不拦截任何响应）

- `.trellis/tasks/T-044/shots/p19-settings-after-desktop.png`：归档后账户页——机器人账户回到「还没有机器人账户号」、上一台机器的账户显示「已归档」、「机器人数据关联」回到「核验并关联」。
- `.trellis/tasks/T-044/shots/p19-reports-after-desktop.png`：归档后「测评与报告」——陪学伙伴 / 互动健康度 / 成长周期报告三处均为「还没有绑定机器人」，成长观察为「尚未关联机器人数据」，整页无「正在等待首次同步」。
- `.trellis/tasks/T-044/shots/p19-reports-after-mobile.png`：390×844，同上且 `scrollWidth - innerWidth <= 1`。
- `.trellis/tasks/T-044/shots/o12-o14-dashboard.png`：运营端工作首页——卡片「生成任务异常」、区块「生成任务异常」逐条列出数据同步与报告生成、服务事项区块「最多显示 5 条（按提交时间从新到旧）。」。
- `.trellis/tasks/T-044/shots/o13-other-requests.png`：事项详情——当前事项提交时间 09:55，「该儿童的其他事项」只列 09:57 与 09:56 两条，不含自身。
- `.trellis/tasks/T-044/shots/o13-single-request.png`：该儿童仅此一条事项时整块不显示。

## 未验证项

1. **「历史初始报告仍可见」只在数据层验证**。浏览器走查用的儿童没有初始报告（本地生成初始报告要走 22 题测评 + 合成样例，即 S-07 记录的本地排队不稳路径），所以浏览器截图里「已生成报告」是空态。数据层证据：`test_retiring_account_ends_verified_association` 断言归档后 `ObservationBatch` 仍有 1 条、`GET /api/v1/children/{id}/reports` 仍列出归档前生成的报告（`kind == "stage"`）。本轮改动不删除任何数据，报告可见性不受影响。
2. **真源模式（`CA_DISPLAY_DATA_SOURCE=dingdong`）与生产未验证**；`frontend/deployment-tests/*` 属权限边界外，未跑。
3. 归档后的**出站**行为（对方侧是否释放旧绑定）属 D20，未接通、未验证。

## 偏离与理由

1. **O-12 除了卡片标签，区块标题也一并改了**（`dashboard.html:137` 「报告生成异常」→「生成任务异常」）。理由：T-042 backlog 的 O-12 建议改法原文是「卡片与区块标题改成『生成任务异常』」，两处装的是同一份数据（全部失败生成任务），只改一处会留下「同一份数据两个名字」；同步更新了引用原句的 `frontend/tests/ops-console.spec.js:137`。
2. **抽了 `core/services/associations.py` 新模块**（而非在 `retire_account` 内联三行）。理由：`robots.revoke` 与归档路径必须落同一个状态，内联会形成两份实现（后端规范 `services-and-idempotency.md` 明确反对「两份业务规则」）。
3. **O-12 的失败任务是用例自造的**（`ops_helpers.make_failed_job(kind="sync")` + `(kind="report")` 各一条）。本地库当时没有 `kind=report` 的失败任务（T-042 实测 `report failed: 0`），按 acceptance 要求自造并在本报告记录。
4. **顺带刷新了运营端交付截图**（`frontend/docs/ops/01-工作首页.png` 等 21 张，由 `ops-screenshots.spec.js` 重新生成）。`frontend/docs/` 在 `.gitignore` 内、不随仓库交付，但本机留档会与新标签不一致，故一并刷新。
5. **未改** `ops/login.html:21` 的登录页说明句「跟进报告生成异常。」——那是登录页的产品说明文字（不是数据标签），且运营端确有「报告管理」页处理报告类失败任务；O-12 的范围是工作首页卡片与区块。
