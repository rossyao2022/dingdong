# 后端（Django / DRF）开发规范

> 本目录描述 `backend/` 这个 **Django 6 + DRF + PostgreSQL + Celery 后端**在本仓库里实际是怎么干的，供后续 agent 动手前先读。
> 不含前端：家长端在 `frontend/`（见 [../frontend/index.md](../frontend/index.md)），运营后台虽然写在后端仓库里，但它是独立应用 `dingdong_ca/ops/`，界面与维护约定见 [../../../backend/dingdong_ca/ops/README.md](../../../backend/dingdong_ca/ops/README.md)。
> 本目录用中文写，与 `AGENTS.md`、`PROJECT_MEMORY.md`、`backend/README.md` 一致。

## 目录导航

| 规范文件 | 管什么 |
| --- | --- |
| [directory-structure.md](./directory-structure.md) | `config/`、`dingdong_ca/{users,core,ops,testsupport}` 各自职责；新增模型/接口/服务该放哪；不要新建 app |
| [api-conventions.md](./api-conventions.md) | 路由集中在 `config/urls.py`、`@endpoint` 装饰器、家庭隔离与角色、Strict 入参、分页游标、openapi 契约 |
| [error-handling.md](./error-handling.md) | `ApiError` / 统一错误信封与 code→status 表；`contract_exception_handler`；运营后台 `OpsError` 与 HTML 错误页 |
| [models-and-migrations.md](./models-and-migrations.md) | `Entity` 基类与 `db_table`、条件唯一与 CheckConstraint、不可变与已发布模型、`revision`/幂等键、迁移只加不删 |
| [services-and-idempotency.md](./services-and-idempotency.md) | 服务层分工、锁顺序、事务边界与“网络调用放事务外”、幂等模式、ULID 发号器、咨询锁、后台作业栅栏、审计 |
| [external-integrations.md](./external-integrations.md) | 不许 mock 业务 API / 不许伪造成功；fixture 数据源、DingDong 出站客户端、上传与留存边界 |
| [companion-preferences-and-export.md](./companion-preferences-and-export.md) | 网页四种引导、儿童级偏好与记录导出、CA关联删除保护 |
| [prototype-report-and-handover.md](./prototype-report-and-handover.md) | 会展独立CA报告、共享Mock报告、安全推送与跨家庭解绑重绑 |
| [testing.md](./testing.md) | pytest 配置、为什么必须 PostgreSQL、`conftest.py` 与 `ops_helpers.py`、并发用例写法、命令与禁止项 |
| [quality-guidelines.md](./quality-guidelines.md) | ruff 配置与 py314 格式化坑、注释与文案风格、日志与敏感数据、禁止模式、提交门禁、文档同步 |

## 开工前检查（Pre-Development Checklist）

1. 读 `PROJECT_MEMORY.md` 的当前状态与 `backend/README.md`（启动、测试、命令、当前接口）；记忆是带日期的快照，**不能假设服务还在跑**。
2. 确认改动落在哪一层：接口与权限 → `dingdong_ca/core/api/`；规则与事务 → `core/services/`；表结构 → `core/*_models.py`；运营后台 → `dingdong_ca/ops/`。分层边界见 `directory-structure.md`。
3. 涉及数据库的改动先想约束：能不能用条件唯一或 CheckConstraint 把不变量落到库里，而不是靠应用层自觉（`models-and-migrations.md`）。
4. 外部依赖（短信、算法、DingDong）没接通时，**如实报未接通**，不要 mock 业务 API 或伪造成功（`external-integrations.md`）。
5. 功能改动按关键测试先行的 TDD：先在 `backend/tests/` 写会失败的用例，再用真实 HTTP 接口跑通（`testing.md`）。
6. 本地起服务：PostgreSQL `127.0.0.1:55439`、Redis `127.0.0.1:56379`，命令见 `backend/README.md` 与 `PROJECT_MEMORY.md`；不要重复启动端口已占用的服务，也不要为了“初始化”删已有数据。
7. 权限边界：仓库目录内的读写、跑测试、本地 commit 自主；触达仓库外的副作用（push/PR/merge/部署/ssh 远端写/`~` 下写入/发消息/读 `deploy/.env` 与私钥）一律停下报 NEED-GATE（`AGENTS.md`）。

## 收尾检查（Quality Check）

- 静态检查：`python manage.py check` 与 `python manage.py makemigrations --check --dry-run` 无输出/无待生成迁移；`ruff check .` 干净；复核格式用 `ruff format --check --target-version py313 .`（**不要用 py314**，会把 `except (A, B):` 改成无法导入的语法）。
- 测试：按改动范围跑 `tests/` 对应用例（全量 266 项很慢，别无差别重跑）；改标识生成/修订号逻辑时至少带上 `tests/test_ops_content_identity.py` 与 `tests/test_ops_edit_conflicts.py`。
- 接口或模型有实质变化：同步 `设计/API/openapi.json`，跑 `uv run --directory backend python ../scripts/audit_documents.py --generate`，并确认 `python3 scripts/audit_documents.py` 的 errors 为空。
- 自查这份清单：有没有绕过 `@endpoint` 自己拼错误体；有没有在视图里写业务规则；有没有把凭据/验证码/画像写进日志或响应；有没有让旧页面静默覆盖（修订号）；有没有把未接通的能力写成已完成。
- 实质变化（功能、约束、启动方法、测试结果、待办）要更新 `PROJECT_MEMORY.md`；发现新坑或新约定，写回本目录对应文件，不要只留在对话里。