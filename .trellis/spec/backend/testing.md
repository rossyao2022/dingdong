# 测试约定

> 用例在 `backend/tests/`，配置在 `backend/pyproject.toml` 的 `[tool.pytest.ini_options]`。
> 全量后端套件很慢（当前 266 项，量级十几到二十分钟），**按改动范围挑文件跑**，不要无差别重跑；但也不许拿历史绿灯日志当本轮证据（`PROJECT_MEMORY.md`）。

## 配置与前置

```toml
# backend/pyproject.toml
[tool.pytest.ini_options]
DJANGO_SETTINGS_MODULE = "config.settings.test"
pythonpath = ["."]
testpaths = ["tests"]
addopts = "--strict-markers"
```

- `config/settings/test.py` 的关键差异：`CELERY_TASK_ALWAYS_EAGER = True`（任务同步执行）、去掉 WhiteNoise、`PASSWORD_HASHERS` 换 MD5、`COOKIE_SECURE = False`。它继承 `base.py` 的 `DATABASES`，所以**测试直接用 PostgreSQL 的 `test_dingdong` 库**，跑完清理测试库、不动开发库（`backend/README.md`“测试”）。
- 前置：本地 PostgreSQL（`127.0.0.1:55439`）在跑，起法见 `backend/compose.yml`。

## 必须用 PostgreSQL，不能用 sqlite

- 有显式断言守住这条：`tests/test_boundaries.py::test_postgres_and_phone_constraint` 第一行 `assert connection.vendor == "postgresql"`。
- 代码里有 sqlite 跑不了的东西：`ops/api.py` 的 `lock_code()` 用 `pg_advisory_xact_lock(hashtextextended(...))`；短信限频同样依赖 PostgreSQL 事务咨询锁（`PROJECT_MEMORY.md`“本地隔离库手法”一节也写明 sqlite 不可行）。
- 条件唯一约束（`UniqueConstraint(condition=Q(...))`）是模型层的核心机制，改 `DATABASES` 会改动整个测试基线的语义。

## 公共工具（先看这两个文件，不要重复造）

`tests/conftest.py`：

- `client` fixture：`APIClient(enforce_csrf_checks=True)`。**CSRF 是真开着的**，写接口前必须先 `csrf(client)`。
- `sign_in(client, phone=...)`：走完整的 `GET /auth/csrf` → `POST /auth/sms` → `POST /auth/login`（码固定 `00000`），返回登录响应并设好 Bearer + CSRF 头。
- `create_child(client, **changes)`：走真实 `POST /api/v1/children`，自动带 `request_id`。
- `assert_schema(name, data)`：按 `设计/API/openapi.json` 的 `#/components/schemas/<name>` 做 Draft202012 校验。契约文件路径是仓库根的 `设计/API/openapi.json`（`parents[2]`），**单独拷走 backend 目录会找不到它**。

`tests/ops_helpers.py`：`roles_ready()`（跑 `seed_base` 造角色）、`make_staff(*roles, superuser=False)`、`make_parent()`、`make_family()`、`make_session()`、`make_service_request()`、`make_failed_job()`、`ops_client(user)`（`force_login` + CSRF，页面与 `/api/v1/staff/*`、`/ops/api/*` 共用）、`post_json(client, url, payload, revision=None)`（未显式给修订号时自动取库内当前值）。

## 用例怎么写

- 数据库标记统一 `pytestmark = pytest.mark.django_db`（文件级），单例需要时再加装饰器。
- **走真实 HTTP 接口**，不要直接调内部函数绕过边界；跨家庭、越权、幂等这些性质只能从接口层验。范例 `tests/test_ca_accounts.py`：建号、重放同 `request_id`、换机两步、归档后仍可读但不再可解析，全部打接口。
- 断言要用 `code` 而不只是状态码：`assert repl.json()["code"] == "ACCOUNT_REPLACEMENT_REQUIRED"`。
- 需要精确构造历史状态时可以用 ORM（`ops_helpers.make_*`），但**业务结果必须真实生成**——不许直接插 `ReportVersion`/完成记录来冒充闭环。
- 时间相关用例注意时区：`USE_TZ = True`、`TIME_ZONE = "Asia/Shanghai"`。`tests/test_boundaries.py::test_activity_summary_uses_whole_result_and_shanghai_dates` 专门守住“按上海日期分组，不要按 UTC 分组”。
- 并发用例的固定写法：`@pytest.mark.django_db(transaction=True)` + `ThreadPoolExecutor` + 每个线程 `close_old_connections()`；断言两个结果的**具体组合**（`sorted(results) == [200, 422]`、`[201, 409]`）以及库里只留一行。范例见 `tests/test_boundaries.py` 的三个并发用例。
- 出站调用在测试里必须被挡死：`tests/test_ca_accounts.py` 的 autouse fixture `no_real_network` 把 `dingdong_client._open` 换成抛 `AssertionError` 的函数，需要假响应时用 `transport` fixture 注入。
- 后台管理命令在用例里用 `call_command("seed_base")` / `call_command("seed_mock", dataset="phase1-v1", mode="cold", verbosity=0)` 准备数据。

## 运营后台相关用例

- 用例文件按主题切：`test_ops_console.py`（页面与导航）、`test_ops_content.py`（题库/活动编辑）、`test_ops_content_identity.py`（内容标识与版本）、`test_ops_edit_conflicts.py`（并发编辑）、`test_ops_child_revision.py`、`test_ops_audit_scope.py`（审计越权）、`test_ops_admin_role.py`（account_admin 角色）、`test_ops_ca_accounts.py`（只读页）、`test_ops_filters.py`（筛选参数）、`test_ops_reports.py`、`test_ops_services.py`。
- 改动 `ops/api.py` 的标识生成或修订号逻辑时，**至少一起跑 `test_ops_content_identity.py` 与 `test_ops_edit_conflicts.py`**：这两组分别守着“不同标题不能退化成同一内容”和“旧页面不许静默覆盖”。
- 页面文案断言用正文精确文本（如“没有找到这条记录”），不要只断言状态码——面包屑与错误页措辞不同（`PROJECT_MEMORY.md` 2026-09-15 那轮踩过）。

## 命令

```sh
uv run --directory backend pytest -q                       # 全量（慢）
uv run --directory backend pytest tests/test_ca_accounts.py -q
cd backend && .venv/bin/python -m pytest ../deploy/tests -q # 部署配置测试：必须在 backend 目录里跑
```

- 部署配置测试必须从 `backend/` 运行：`deploy/tests/test_settings.py` 的子进程要能 `import config`（`PROJECT_MEMORY.md`）。
- 沙箱里 tmpdir 报错时加 `--basetemp=/tmp/dd-pytest/bt`。
- 改完模型/接口再补两条静态检查：`python manage.py check` 与 `python manage.py makemigrations --check --dry-run`（见 [quality-guidelines.md](./quality-guidelines.md)）。

## 禁止

- 不要为了“跑绿”而放宽 fixture 校验、跳过用例或把失败标成 `skip` 后计入通过数（`backend/README.md`：“没有把 M2/M3 写成 skip 再计入通过数”）。
- 不要写拦截接口响应的假测试来代替真实链路；真实浏览器验收的纪律见 [../frontend/testing-and-acceptance.md](../frontend/testing-and-acceptance.md)。
- 不要在用例里连真实外部端点（见 [external-integrations.md](./external-integrations.md)）。