# tigery Docker 演示部署 · v0.3.1

当前公网入口：**http://110.42.225.196/dingdong/**，使用上海服务器已开放80端口，访问者无需Tailscale。运营后台：http://110.42.225.196/dingdong/ops/ ，Django 后台：http://110.42.225.196/admin/。

部署转发配置、启动与回退见 [上海公网入口](relay/README.md)，回滚步骤见 [回滚说明](ROLLBACK.md)。APP_VERSION=0.3.1，PUBLIC_ORIGIN=http://110.42.225.196。分支codex/release-v0.3.1和标签v0.3.1对应此发布。

发布包内的RELEASE.json记录精确Git提交；密钥和数据库不进包。tigery沿用已有.env密钥和数据卷，仅修改版本和公共Origin。首次部署可使用 `python3 deploy/configure.py http://110.42.225.196 --bind 100.115.66.119`。容器启动：`docker compose --env-file deploy/.env -f deploy/compose.yml up -d --build --wait`。

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
