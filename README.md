# 叮咚 × CA 天赋成长伙伴 · CA 侧完整实现

本分支是 **CA 侧**在仓库 `main`（DingDong 天赋探索网页原型）基础上完成的完整实现：家长端应用 + 后端服务。

`main` 分支持有原始静态原型（根目录的 `index.html`、`app.js`、`styles.css`、`playworld.js` 等）。本分支为**独立提交线**，不改动 `main` 的任何文件，便于并排对照与评审。

## 目录

| 路径 | 内容 |
| --- | --- |
| `backend/` | Django + DRF 后端：家庭与儿童档案、活动记录、日常情境测评、成长画像与报告、运营后台、异步任务 |
| `frontend/` | 家长端应用（原生 JS，无框架构建）及其单元测试 |
| `deploy/` | 容器化与配置：两个 Dockerfile、compose 编排、环境变量生成脚本、nginx 模板 |

- 后端运行说明、接口清单与约定：`backend/README.md`
- 运营后台的组件体系与类名约定：`backend/dingdong_ca/ops/README.md`
- 第三方前端资源的版本与许可：`backend/dingdong_ca/ops/static/ops/vendor/THIRD_PARTY_NOTICES.md`

`frontend/` 的样式与图形资源以 `main` 分支的同名文件为起点继续演进，其余为本次新增。

## 本地启动

### 后端

```sh
cd backend
uv sync --locked                     # Python 3.14；依赖精确版本见 uv.lock
docker-compose up -d --wait          # PostgreSQL 与 Redis
uv run python manage.py migrate
uv run python manage.py seed_base
uv run python manage.py seed_mock --dataset phase1-v1 --mode cold
uv run python manage.py runserver 127.0.0.1:8017
```

登录走短信挑战 + 固定验证码（本地开发态有效）：先 `GET /api/v1/auth/csrf`，带 `X-CSRFToken` 调 `POST /api/v1/auth/sms`，再用 `00000` 调 `POST /api/v1/auth/login`。运营后台入口 `/ops/`，Django 后台 `/admin/` —— 管理员需自行 `createsuperuser`，没有预设密码。

报告生成与同步任务另开两个终端：

```sh
uv run celery -A config worker --pool=solo --loglevel=WARNING --queues=dingdong-ca
uv run celery -A config beat --loglevel=WARNING --schedule=/tmp/dingdong-ca-celerybeat
```

### 前端

`frontend/` 为静态资源，由任意静态服务器托管即可，接口地址指向上面启动的后端。

## 测试

```sh
cd backend  && uv run pytest -q && uv run ruff check .
cd ../frontend && npm ci && npm test
```

后端测试使用独立的测试数据库，结束即清理，不重置开发库；并发相关用例用独立连接与线程验证锁与唯一约束。

## 需要知道的几点

- **必须用 PostgreSQL。** 实现依赖 `pg_advisory_xact_lock` 与 `hashtextextended`，SQLite 不可用。
- **本分支不含内部运维与交付材料。** 部署与验收记录、运营手册、原始对接材料与项目分析未纳入。因此 `backend/README.md` 里指向 `docs/OPS_MANUAL.md`、`docs/M6_OPS_RESULT.md`、`../frontend/README.md` 的三处链接在本分支内点不开。
- **不含任何真实凭据、服务器地址或私有端点。** `deploy/configure.py` 在首次部署时于本机生成密钥（不覆盖已有文件、权限 600），密钥不随仓库分发。
- `backend/docs/seed-manifest.local.json` 记录的是合成测试数据（虚构儿童与手机号），不是真实用户数据。
