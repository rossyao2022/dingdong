# 质量、风格与静态检查

> 配置真源：`backend/pyproject.toml`。运行环境提示真源：`backend/README.md` 与 `PROJECT_MEMORY.md`。

## 工具链与命令

```sh
uv run --directory backend ruff check .
uv run --directory backend ruff format --check --target-version py313 .   # 必须显式 py313
uv run --directory backend python manage.py check
uv run --directory backend python manage.py makemigrations --check --dry-run
python3 scripts/audit_documents.py
```

- `pyproject.toml`：`requires-python = ">=3.14,<3.15"`，`[tool.ruff] target-version = "py314"`、`line-length = 100`，lint 选择 `["E4","E7","E9","F","I"]`（含 import 排序 `I`），并对 `config/settings/*.py` 放行 `F403`/`F405`（那里用 `from .base import *`）。
- **必须记住的坑**：`ruff format --target-version py314`（0.16.7，当前最新）会把合法的 `except (A, B):` 改写成 Python 2 语法的 `except A, B:`，**改完文件无法导入**。复核格式一律显式加 `--target-version py313`；仓库里 py314 下有 9 个文件属该误报，不要动（`PROJECT_MEMORY.md` v0.3.4 关键坑、`dingdong_ca/ops/README.md` 开发与自检）。

## 代码风格

- 行宽 100，import 按 ruff `I` 排序；不要手写 import 分组以外的排序习惯差异。
- 注释解释**非显然约束与踩过的坑**，不叙述代码在做什么。好的例子：
  - `core/api/common.py` 里 `STAFF_ADMIN_ROLE` 上方那段：为什么管理员必须被视为满足任一角色（v0.3.2 按钮 403 的成因）。
  - `core/models.py` 的 `Child.create_request_key`/`create_payload` 与 `revision` 注释：为什么必须在后续编辑后仍能识别同一次创建、为什么要靠修订号挡旧页面。
  - `ops/services.py` 的 `parse_date_filter`：为什么只接受 `YYYY-MM-DD`（Python 3.11 起 `fromisoformat` 会吞掉紧凑写法）。
- 不要留 `TODO`、`FIXME`、占位文案或“以后再说”的注释。
- 文案（接口 `message`、页面提示、审计标签）**用中文**，是给家长/运营看的完整句子；不出现 409 / revision / UUID / 表名等内部术语。参照 `core/api/children.py` 的 `EDIT_CONFLICT` 与 `ops/api.py` 的 `expected_revision`。
- 新动作码必须同步中文标签：`dingdong_ca/ops/labels.py` 的 `AUDIT_ACTION` / `TARGET_KIND` / `job_error()`（用例 `tests/test_ca_accounts.py::test_audit_labels_cover_ca_account_actions` 直接断言）。

## 日志与敏感数据

本仓库没有独立日志框架，就是 Django 标准 logging：

```python
# config/settings/base.py
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": "WARNING"},
}
```

- 全仓只有两处 logger：`core/services/ca_account.py`（`logger.warning` 记录绑定未完成，带 `ca_account_id` 与业务码）和 `core/services/dingdong_client.py`（`logger.error` 记录鉴权失败）。新增日志照这个密度来——**只在需要人介入的异常路径打**，不要在正常流程加噪声。
- 日志里不要出现：验证码、JWT/refresh token、NFC token 明文、画像内容、文件字节、真实指纹、数据库口令。NFC token 只以 HMAC 摘要与短指纹存在（`core/services/ca_account.py`）。
- 队列/结果后端不带厂商数据与任务结果：`CELERY_TASK_IGNORE_RESULT = True`，broker 只传 `job_id`（`config/settings/base.py`）。

## 禁止的模式

| 禁止 | 原因 / 替代 |
| --- | --- |
| 直接查询 `settings` 之外的环境变量（`os.environ`） | 环境开关统一在 `config/settings/base.py` 用 `django-environ` 读，测试可用 `override_settings` 覆盖（范例 `tests/test_ca_accounts.py`） |
| 在 `core/api/` 里写业务规则或开事务 | 规则属于 `core/services/`，否则两个入口各实现一份（见 [services-and-idempotency.md](./services-and-idempotency.md)） |
| 用 `timezone.now()` 之外的本地时间 | `USE_TZ = True`，全部用 aware UTC；展示层按 `TIME_ZONE = "Asia/Shanghai"` 折算（回归 `tests/test_boundaries.py`） |
| 在 `ops/` 里重写 `core` 已有实现 | 复用 `/api/v1/staff/*` 或 `core` 的校验（`ops/api.py` 顶部设计原则） |
| 引入前端框架/CDN 到运营后台 | 运营后台是本地化 Tabler 资产 + Django 模板，约定见 `dingdong_ca/ops/README.md` |
| 直接 `git push` / 改 PR 状态 / merge / 部署 / ssh 远端写操作 | 权限边界：先报 NEED-GATE 等放行（`AGENTS.md`） |
| 往仓库写 `.env`、`*.pem`、私钥或任何真实凭据 | `.gitignore` 已排除；验收凭据只经环境变量传递（`PROJECT_MEMORY.md`“凭据边界”） |

## 提交门禁

本仓库 `core.hooksPath` 指向 `.githooks/`，两条 hook 会挡住不合规提交（`AGENTS.md`）：

- `commit-msg`：首行必须带 `[R<n>]` 或 `[T-<id>]` 任务 id。
- `pre-commit`：暂存文件不得含 `.env` / `*.pem` / `*.key` / 私钥；暂存 `.md` 时 `python3 scripts/audit_documents.py` 的 errors 必须为空。

**不确定是否该提交/推送时停下来问**，不要试图绕过 hook。

## 文档同步

- 接口或模型有实质变化：同步 `设计/API/openapi.json`，并跑 `uv run --directory backend python ../scripts/audit_documents.py --generate` 重生成 `设计/数据库实际字段_M5.md`。
- 功能、约束、启动方法或测试结果有实质变化：更新 `PROJECT_MEMORY.md`（日期、事实、证据链接），保留历史报告、不把计划写成已完成（`AGENTS.md`）。
- 发现了新的约定或坑，写回 `.trellis/spec/backend/` 对应文件，不要只留在对话里。