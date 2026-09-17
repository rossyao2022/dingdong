# 后端目录与分层

> 适用范围：`backend/` 这个 Django 6 + DRF + PostgreSQL + Celery 后端。
> 运营后台（`/ops/`）也在后端仓库里，但它是独立应用 `dingdong_ca/ops/`，界面约定另见 `backend/dingdong_ca/ops/README.md`。
> 家长端前端不在本目录，见 [../frontend/index.md](../frontend/index.md)。

## 顶层布局

```
backend/
├── config/                       # 项目配置，不放业务
│   ├── settings/{base,local,test,deployment}.py
│   ├── urls.py                   # 全部 HTTP 路由集中注册（唯一入口）
│   ├── celery_app.py
│   └── wsgi.py
├── dingdong_ca/                  # 业务代码
│   ├── users/                    # 自定义 User（account_kind=parent|staff）
│   ├── core/                     # 家长端业务：模型、接口、服务、任务、后台
│   ├── ops/                      # 运营后台（独立应用，自带模板与静态资源）
│   └── testsupport/              # 测试数据源（TestFixture），随核心应用一起装
├── tests/                        # pytest 用例
├── scripts/                      # 人工 smoke 脚本（直接打 HTTP，不进 CI）
└── docs/                         # 阶段结果与 TDD 日志（历史证据，不是现状说明）
```

## core：按“模型 / 接口 / 服务”三块切

| 位置 | 管什么 | 放什么 |
| --- | --- | --- |
| `core/models.py` | 基础实体与用户可见主数据 | `Entity` 抽象基类、`Family`/`Child`/`ActivityRecord`/`AuditEvent` 等 |
| `core/assessment_models.py` | 测评与报告 | `AssessmentSession`、`AlgorithmAttempt`、`ProfileSnapshot`、`ReportVersion`、`QuestionnaireVersion`、`PublishedVersion`/`ImmutableResult` |
| `core/integration_models.py` | 与外部主体的集成 | `ExternalAssociation`、`SyncCheckpoint`、`ObservationBatch`、`DataRequest`、`RuleVersion` |
| `core/ca_models.py` | CA × DingDong 账户 | `CaAccount`（`ca_account_id` 载体） |
| `core/api/` | HTTP 边界：鉴权、入参校验、序列化、调服务 | 一个资源一个模块：`children.py`、`assessments.py`、`activities.py`、`ca_accounts.py`、`staff.py`… |
| `core/api/common.py` | 所有接口共用的边界工具 | `endpoint()` 装饰器、`ApiError`、`authenticate_parent()`、`family_for()`、`paginate()`、`audit()`、`contract_exception_handler` |
| `core/api/inputs.py` | 请求体形状 | `StrictSerializer` 及全部 `*Input` |
| `core/api/uploads.py` | multipart 特殊路径 | 内存上传处理器与 `validate_synthetic_input()` |
| `core/services/` | 跨请求的业务规则、事务与锁 | `assessments.py`、`sync.py`、`ca_account.py`、`dingdong_client.py`、`deletion.py` |
| `core/tasks.py` | Celery 任务与后台作业栅栏 | `run_report_job`、`dispatch_pending`、`schedule_due_syncs`、`recover_assessments` |
| `core/migrations/`、`core/management/commands/` | 迁移与运维命令 | `seed_base`、`seed_mock`、`inject_fixture`、`cleanup_auth` |

模型拆成四个模块后，**必须在 `core/models.py` 末尾显式 re-export**，否则 Django 应用加载与迁移检测看不到它们：

```python
from .assessment_models import AlgorithmAttempt, AssessmentSession, ...
from .ca_models import CaAccount  # noqa: E402,F401
from .integration_models import DataRequest, ExternalAssociation, ...
```

（见 `dingdong_ca/core/models.py` 文件末尾的导入块）

## 新增东西该放哪

- **新接口**：在 `core/api/<资源>.py` 写视图函数，再到 `config/urls.py` 注册。路由不写在应用内 `urls.py`（`core` 没有自己的 urls 模块；只有 `ops` 例外，见 `dingdong_ca/ops/urls.py`）。
- **新表**：先判断属于哪一类——测评/报告 → `assessment_models.py`；对外集成 → `integration_models.py`；CA 账户 → `ca_models.py`；其余主数据 → `models.py`。然后补 `models.py` 末尾的 re-export 与迁移。
- **新业务规则**（需要事务、行锁、多步状态流转）：进 `core/services/`，不要写在视图里。范例：`core/services/assessments.py` 的 `lock_session()`/`merge_answers()`/`finish_attempt()`。
- **运营后台新页面**：只动 `dingdong_ca/ops/`（`views.py` + `urls.py` + `permissions.py` 的 `NAVIGATION` + `templates/ops/`），且模板继承 `ops/base.html`。
- **测试数据源**：放 `dingdong_ca/testsupport/`（有独立迁移与 `TestFixture` 模型），不要往业务模型里塞测试字段。

## 不要做的事

- 不要新建 Django app。现有四个（`users`/`core`/`ops`/`testsupport`）就是全部边界，见 `config/settings/base.py` 的 `INSTALLED_APPS`。
- 不要在 `core/api/` 里写业务规则：那里只应出现“鉴权 → `validate()` → 调 `services` → 序列化”的骨架，对照 `core/api/ca_accounts.py`（视图只调 `service.issue_account` / `service.retire_account`）。
- 不要把运营后台的东西放进 `core`。`core` 服务家长端 API 与技术后台；`ops` 只做“用运营看得懂的方式呈现与触发”，需要复用时调用 `core` 已有实现（见 `dingdong_ca/ops/services.py` 顶部说明）。
- 不要在 `config/settings/` 之外读环境变量。所有环境开关走 `settings`（如 `CA_ACCOUNT_ID_PREFIX`、`DINGDONG_BASE_URL`，见 `config/settings/base.py`）。