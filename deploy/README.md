# tigery Docker 演示部署 · v0.3.5

当前公网入口：**http://110.42.225.196/dingdong/**（家长端），运营后台 **http://110.42.225.196/ops/**，Django 后台 http://110.42.225.196/admin/ 。使用上海服务器已开放80端口，访问者无需Tailscale。

部署转发配置、启动与回退见 [上海公网入口](relay/README.md)，回滚步骤见 [回滚说明](ROLLBACK.md)。APP_VERSION=0.3.5，PUBLIC_ORIGIN=http://110.42.225.196。分支codex/release-v0.3.5和标签v0.3.5对应此发布。

发布包内的RELEASE.json记录精确Git提交；密钥和数据库不进包。tigery沿用已有.env密钥和数据卷，仅修改版本和公共Origin。首次部署可使用 `python3 deploy/configure.py http://110.42.225.196 --bind 100.115.66.119`。容器启动：`docker compose --env-file deploy/.env -f deploy/compose.yml up -d --build --wait`。

## 为什么运营后台在根路径 `/ops/` 而不是 `/dingdong/ops/`

Django 生成的是根绝对地址（重定向、`{% url %}`），带前缀剥离的 `/dingdong/` 入口只能撑住第一次请求：页面一渲染，链接和重定向就跳到根路径。这和已有的 `/admin/`、`/static/`、`/api/v1/` 是同一模式——上海 nginx 把运营后台自己的根路径转发给隧道。`/dingdong/ops/` 仍能打开首屏，但后续导航会跳到 `/ops/`，所以对外只说 `/ops/`。

占用根 `/ops/` 前已核对：上海站点 `/www/wwwroot/game` 没有 `ops` 目录，其 index.html 与 JS 资源也没有 `/ops` 引用，该路径此前只会返回原站的 SPA 兜底页。

## v0.3.5 变更

v0.3.5 修复 v0.3.4 第三轮独立验收（见 [第三轮独立验收报告](OPS_INDEPENDENT_REVIEW_20260914.md)）遗留的 P2，交付说明见 [家长端档案冲突恢复交付 v0.3.5](PARENT_CONFLICT_RECOVERY_20260914.md)。

1. **冲突后保留家长未保存的输入（P2）。** v0.3.4 及以前，家长端被 `409` 挡下后立即重新读取最新档案并 `editChild(latest)` 重建整个表单，家长刚填写的称呼、性别、生日被服务端值替换。v0.3.5 起被挡下时**不重建表单**：三个字段原样留在输入框，只渲染独立的冲突提示区，提示用家长能理解的语言（不出现 409 / 修订号 / 数据库），并提供三条显式路径——**查看最新资料**（只读并排对比）、**载入最新资料**（二次确认"无法找回"后才替换）、**用我的修改保存**（基准取家长看到的那一版，期间若再被改过会再次拒绝、不静默覆盖）。读取失败/断网/登录失效只提示、不清空输入；冲突未处理就关闭会先确认。
2. **测试修正。** 原 `ops-p1-acceptance.spec.js` 中"保留输入"用例实际断言表单被替换成服务端值，名实不符；现改为只断言服务端数据未被覆盖，并在新增的 `parent-conflict-recovery.spec.js`（5 项，真实入口）中按真实业务目标断言输入保留。两份 spec 共用辅助抽到 `deployment-tests/helpers.js`。
3. **无后端逻辑与数据库迁移变更。** 复用 v0.3.4 的 `0007`。后端仍为 237 项通过。

版本一致性：`VERSION`、`backend/pyproject.toml`、`backend/uv.lock`、`frontend/package.json`、`frontend/package-lock.json`、镜像标签、Git 分支/标签、发布包统一为 **0.3.5**。

## v0.3.4 变更

v0.3.4 修复 v0.3.3 第二轮独立验收（见 [第二轮独立验收报告](OPS_INDEPENDENT_REVIEW_20260913.md)）遗留的两个 P1，交付说明见 [公网交付与验收 v0.3.4](OPS_CONSOLE_DEPLOYMENT_20260913_V034.md)。

1. **儿童档案修订号在所有入口前进（P1-A）。** 此前只有运营后台推进 `revision`，家长改档后运营手里的旧页面仍能静默覆盖。现在家长端 `PATCH /api/v1/children/<id>` 与 Django 技术后台 `save_model` 都会推进修订号；家长端请求体可带可选 `revision`，不一致返回 `409 EDIT_CONFLICT` 且不落库。**无数据库迁移变更**（复用 v0.3.3 的 `0007`）。
2. **不同标题不再退化成同一内部标识（P1-B）。** `generated_code` 始终保留完整标题的 sha1 摘要，"ABC 观察"与"ABC 绘画"不再同号；新增 `unique_code` 在咨询锁内取唯一标识，撞号加 `-2/-3` 后缀。**每次新建都是独立内容**，只有"复制为新版本"才构成同一内容的版本序列。
3. **家长端冲突恢复路径修复。** 家长端 `409` 后要读最新档案，而 `GET /api/v1/children/<id>` 此前只有 `PATCH`，真实浏览器里必然 `405`，冲突提示成了死路。已补上 `GET`（第 51 个操作），同步 `设计/API/openapi.json`。
4. **新增 P1 专项浏览器验收**：`frontend/deployment-tests/ops-p1-acceptance.spec.js`（6 项，跨入口冲突恢复 + 内容身份独立 + 版本替代）。

版本一致性：`VERSION`、`backend/pyproject.toml`、`backend/uv.lock`、`frontend/package.json`、`frontend/package-lock.json`、镜像标签、Git 分支/标签、发布包统一为 **0.3.4**。

> 工具链注意：`ruff format --target-version py314`（0.16.7）会把合法的 `except (A, B):` 改写成 Python 2 语法，改完文件无法导入。复核格式时显式加 `--target-version py313`。

## v0.3.3 变更

v0.3.3 修复独立验收（见 [独立验收报告](OPS_INDEPENDENT_REVIEW_20260912.md)）发现的全部问题，交付说明见 [公网交付与验收 v0.3.3](OPS_CONSOLE_DEPLOYMENT_20260913.md)。

1. **旧页面保存不再静默覆盖（P1）。** 题库、活动、儿童档案的写入引入修订号 `revision`：服务端在事务内比较客户端携带的修订号，不一致时返回 `409 EDIT_CONFLICT` 并带回服务端当前内容，**不落库**；前端保留运营输入并提供"查看差异 / 加载最新版本 / 用我的内容覆盖"三路径。缺失或非法修订号返回 `422`。新增迁移 `core.0007`：为 `QuestionnaireVersion`、`ActivityContentVersion`、`Child` 增加 `revision` 与 `create_request_key`（可空），**只加不删**。
2. **首页不再泄露审计信息（P1）。** 工作首页的"最近操作"改为按 `audit.view` 在服务端裁剪；无权限角色既打不开审计页，首页也不出现审计区块。
3. **非法日期筛选不再 500（P2）。** 新增 `parse_date_filter` / `parse_date_range` / `parse_keyword` / `parse_int`，严格校验 `YYYY-MM-DD`，非法值返回中文提示并在页面上保留原输入。
4. **新建内容免填技术标识与版本（P2）。** 标识由业务名称派生、版本号在锁内自动递增、请求带幂等键；`code` / `version` 仅保留为脚本可选参数。
5. **验收脚本稳定化。** `frontend/deployment-tests/ops-public.spec.js` 改用 `data-ops-ready` 就绪信号替代脆弱的 `window.Ops` 即时断言，并新增冲突、越权、非法日期三项用例。

版本一致性：`VERSION`、`backend/pyproject.toml`、`backend/uv.lock`、`frontend/package.json`、`frontend/package-lock.json`、镜像标签、Git 分支/标签、发布包统一为 **0.3.3**。

## v0.3.2 变更

公网浏览器验收暴露了两个只有真正跑起来才会出现的缺陷：

1. **管理员按钮点了没用。** 运营后台把 `account_admin` 定义为"全部权限"，页面因此对管理员显示"发布""重试该任务"；但这些动作复用的是 `/api/v1/staff/*`，那里按具体角色放行（发布要 `content`、重试要 `technical`），管理员点下去拿到 403"角色不允许此操作"。修复：复用接口的角色判定把 `account_admin` 视为满足任一角色。新增 `backend/tests/test_ops_admin_role.py` 三项回归，其中一项守住"不能顺手把门开大"。
2. **窄屏把返回路径藏了。** `≤560px` 时 `.ops-crumb` 被 `display:none`，运营在手机上从儿童详情、报告详情退不回去，只能靠抽屉导航绕。修复：改为换行展示，不再隐藏。

另新增 `frontend/deployment-tests/ops-public.spec.js`：面向公网入口的真实 Chrome 验收，覆盖登录退出、家庭查询、儿童详情、题库草稿到发布、活动维护、报告查看与异常处理、服务事项闭环、越权拦截与窄屏。

## v0.3.1 变更

**修复：运营后台在 Docker 部署下打不开（nginx 404）。**

`deploy/nginx.conf.template` 里的代理白名单只列了 `api/|admin/|static/`，漏了 v0.3.0 新增的 `ops/`。结果是：Django 容器内 `/ops/` 正常（`/static/ops/*` 也能取到），但请求在容器 nginx 层就被 `try_files` 判为静态文件、返回 nginx 404，公网与本地 Docker 演示环境都进不去运营后台。

- 修复：白名单补上 `ops/`。
- 防回归：新增 `deploy/tests/test_nginx_routes.py`，从 `backend/config/urls.py` 解析所有顶层前缀，断言 nginx 模板逐条转发；再加一条显式断言 `ops` 在列。以后新增 Django 顶层前缀而忘记改 nginx，测试会直接失败。
- 本版本无代码逻辑变更、无数据库迁移变更。

## v0.3.0 变更

- 新增运营后台应用 `dingdong_ca.ops`，入口 `/ops/`。使用说明见 [运营手册](../backend/docs/OPS_MANUAL.md)，权限见 [权限说明](../backend/docs/OPS_PERMISSIONS.md)，验收见 [M6 验收记录](../backend/docs/M6_OPS_RESULT.md)。
- 新增数据库迁移 `0006`：给 `AuditEvent` 增加 `target_label` 与 `detail` 两个可空字段及索引。只加不删，回滚到旧版本时保留即可。
- 后台账号需要手工创建（见下文）。**不要把测试账号或密码写进仓库、部署包或报告。**

## 运营后台账号

部署包不含任何账号。首次部署后需要在容器内创建：

```sh
docker compose --env-file deploy/.env -f deploy/compose.yml exec api \
  python manage.py shell -c "
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
u = get_user_model().objects.create_user(username='<用户名>', password='<密码>', account_kind='staff', is_staff=True, name='<姓名>')
u.groups.set(Group.objects.filter(name='account_admin'))
"
```

角色取值：`account_admin`（管理员）、`operations`（运营）、`content`（内容运营）、`technical`（技术运维）。密码只在交付时口头或安全渠道给到本人，不落文件。

本版本仍是固定验证码00000、数据库fixture集成的演示版本，非真实供应商接入。历史v0.2.0部署与构建代理说明见 [原始部署记录](DEPLOYMENT_20260912.md)，其中内网URL/Funnel不是最终入口。

需要同时使用Tailscale入口时，在主机deploy/.env设置 `ADDITIONAL_ORIGINS=http://100.115.66.119:18080`。额外入口必须与PUBLIC_ORIGIN使用相同协议；允许的Host和CSRF Origin精确列举，不使用通配符。
