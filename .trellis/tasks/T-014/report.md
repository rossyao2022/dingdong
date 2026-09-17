# T-014 报告：审计页补「登录凭据」对象词条（O-03）

## goal

审计页「对象」列不再显示未翻译内部码 `login_grant`，补「登录凭据」类对象词条与说明，不把表名/英文模型名给运营看。

## 实际做了什么

1. `backend/dingdong_ca/ops/labels.py`
   - `TARGET_KIND` 增两条：`login_grant: 登录凭据`、`algorithm_attempt: 算法尝试`（后者的词条取 `设计/数据库表结构_V0.1.md:176`「algorithm_attempt：一次实际算法调用」的既有叫法）。
   - 新增纯函数 `target_name(value, model_names)`：把 `describe_target` 兜底写出的「英文模型名（关联对象名）」前缀换成中文词条，已经是业务名称 / 词表里没有的模型原样返回，空值返回空串（保证模板 `|default:"—"` 语义不变）。
2. `backend/dingdong_ca/ops/templatetags/ops_labels.py`
   - 新增过滤器 `audit_target` 与 `_model_names_by_verbose_name()`（`lru_cache(maxsize=1)`）：从 Django 模型注册表现取 `verbose_name -> TARGET_KIND[db_table]`，所以英文名表不用手抄、也不会和模型脱节。
3. 模板两处改用该过滤器：`ops/templates/ops/audit.html`（操作审计「对象」列）、`ops/templates/ops/dashboard.html`（首页「最近操作」，同一份数据、同一口径）。
4. 测试：`backend/tests/test_ops_audit_scope.py` 新增页面级 + 过滤器单元级各 1 条；`frontend/tests/audit-object-labels.spec.js` 新增 1 条真实 Chrome 用例。

对象列改后实际渲染（截图 `shots/ops-audit-objects-table.png`）：`登录凭据`／`答卷`／`授权记录`／`儿童档案`／`工作人员账号`，副行分别是 `登录凭据（parent-…）`、`答卷（末题文案测试小芽）` 等，英文模型名与表名全部消失。

## 为什么改在展示层，而不是改 `describe_target`

- 库内已有 154 条 `login_grant` 记录（最早可追到历史验收），改写入层只能修新记录，旧记录在页面上照样是英文；任务 notes 也写明「不改审计数据与模型」。
- `core` 不能反向 import `ops.labels`（分层方向是 ops → core），写入层的词条来源会变成倒挂依赖。
- 展示层改写让新旧记录一起修好，且词条真源仍是 `labels.py` 这一份。

## 验证命令与真实输出（数字照抄）

| 命令 | 输出 |
| --- | --- |
| `cd backend && uv run --no-sync pytest tests/test_ops_audit_scope.py -q -k "object_column or object_label"`（改前） | `2 failed, 9 deselected in 16.17s`；断言 `assert '登录凭据' in '...未知（login_grant）...'`、`ImportError: cannot import name 'audit_target'` |
| `cd frontend && npx playwright test tests/audit-object-labels.spec.js --reporter=list`（改前） | `1 failed`；第一行对象列实际值 `未知（login_grant）` / `login grant（parent-audit-mu5dsnns-72b641）` |
| `cd backend && uv run --no-sync pytest tests/test_ops_audit_scope.py -q`（改后） | `11 passed in 45.38s` |
| `cd frontend && npx playwright test tests/audit-object-labels.spec.js --reporter=list`（改后） | `1 passed (8.2s)` |
| `cd backend && uv run --no-sync pytest -q`（全量回归） | `273 passed in 1013.68s (0:16:53)` |
| `cd backend && uv run --no-sync pytest tests/test_ops_console.py tests/test_ops_filters.py tests/test_ca_accounts.py -q` | `70 passed in 185.56s (0:03:05)` |
| `cd frontend && npm run check` | exit 0 |
| `cd frontend && npm run test:unit` | `tests 16 / pass 16 / fail 0 / duration_ms 71.041042` |
| `python3 scripts/audit_documents.py` | `errors: []`（`markdown_files 80 / local_links_checked 497`） |

命令原文：`red-pytest.txt`、`red-chrome.txt`、`backend-full.txt`（本目录）。

真实 Chrome 证据（`.trellis/tasks/T-014/shots/`）：

- `ops-audit-before-fix.png`：改前失败截图，对象列「未知（login_grant）／login grant（parent-audit-…）」——即 backlog O-03 的原记录形状。
- `ops-audit-objects-table.png` / `ops-audit-objects-desktop.png`：改后对象列全中文；用例同时断言整列不匹配 `/未知（|[a-z][a-z_ ]*（/`，且表格正文不含 `login_grant`、`login grant`、`assessment session`、`consent grant`。
- `ops-dashboard-recent-ops.png`：首页「最近操作」同一份数据，口径一致（「家长登录 · 登录凭据（…）」）。

## 未验证项

- `ops/templates/ops/child_detail.html:294`、`ops/templates/ops/account_detail.html:100` 也渲染 `target_label`，本轮未加过滤器：那两处的审计行按 `target_id`（儿童 / 后台账号）过滤，标签本来就取业务名称（儿童名、账号名），不存在英文模型名（`views.py:227`、`views.py:764` 的查询条件已核对）。若 orchestrator 要求全站统一，可另开一行改动。
- 对象列副行里家长登录显示 `parent-<uuid>`（家长未填姓名时 `describe_target` 退到内部账号名）。这属 O-02 的同类回落，T-019 的 5 处清单里是「操作审计『操作人』列」，未包含「对象」副行——本任务按 goal 未改，留给 orchestrator 决定是否并入 T-019。
- `frontend/deployment-tests/ops-public.spec.js` / `ops-demo-tour.spec.js` 是公网/演示环境用例（需远端账号与域名），本地未跑；它们对审计页只断言日期校验与 403，不涉及对象列文案。

## 偏离与理由

- 比 acceptance 多补了 `algorithm_attempt` 词条与展示层的英文名改写：goal 的第二句是「不把表名/英文模型名给运营看」，而 `algorithm_attempt` 在库内 2 条记录上正显示为「未知（algorithm_attempt）」（表名直接露给运营），`assessment session` / `consent grant` / `external association` / `activity record` 是同一写入路径产出的英文模型名。只补 `login_grant` 一条会让同一列继续出现同款内部码。
- 模板多改了一处 `dashboard.html`：首页「最近操作」渲染同一字段，只改审计页会让同一条记录在首页仍是英文，属同一缺陷的同一渲染点。
- 未把 `TARGET_KIND` 缺的 16 个键一次性补齐：其余 14 张表（`auth_group`、`django_session`、`test_fixture` 等）经全部 `audit(` / `ops_audit(` 调用点核对没有写入路径，凭空造词条属未经验证的词汇扩张。
- 顺带事实：开工时运营端 dev server（8017）进程已不存在（先前的 red 用例还能访问成功，说明是本轮中途退出的），我用 `nohup uv run --no-sync python manage.py runserver 127.0.0.1:8017` 重启并确认 `/ops/login/` 200，日志在 `/tmp/dingdong-ops-8017.log`。后续轮次若发现 8017 不可用，先查这个进程。

## 新增合成数据（本地合成库，供清理参考）

- 真实 Chrome 用例每跑一次会造 1 名家长（用户名 `parent-audit-<随机>`、无姓名）与 1 条 `LoginGrant`，并通过真实写入路径 `core/api/common.audit` 落 1 条 `auth.login` 审计；`finally` 里已删除这三样（收尾核对 `LoginGrant.objects.filter(user__username__startswith="parent-audit-").count() == 0`）。用例账号 `ops-audit-label-*` 已置 `is_active=False`。

## 门禁

`gate: none`，属第一批：按 `gates.md` 决定段「第一批与第二批每完成一个任务 commit 后可直接 push origin/codex/release-v0.3.6，不必逐条申请，但每次 push 在本文件补 EXECUTED 行」执行 push。
