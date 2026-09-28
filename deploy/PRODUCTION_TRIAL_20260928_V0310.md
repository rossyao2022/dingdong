# 叮咚 v0.3.10 · 生产机运营试用部署记录

## 范围

- 目标主机：`1.15.23.152`（晴幂生产机，Ubuntu 24.04.4）。
- 交付形态：独立的 **运营试用实例**。现有 `config.settings.deployment` 固定 `APP_ENV=demo`，`SMS_MODE=fixed_code`，观察数据为 `synthetic_fixture`；此实例不代表真实短信、真实机器人或供应商生产接入已上线。
- 家长端：`https://1.15.23.152/dingdong/`；运营后台：`https://1.15.23.152/ops/`。两者都需先过独立 HTTP 访问门禁。账号与密码不入库，另行交付。
- 版本：`v0.3.10`，发布包 SHA-256 `8d4331a6bf2029cb67b3d3a57ef6d96b81b5ca184eca965b72511823129e1c7a`。

## 隔离方式

- Docker Compose 项目名 `dingdong-prod-trial`，不同于 tigery 的 `dingdong-demo`。数据卷、数据库、Redis 和密钥独立。
- 生产机 Nginx 的 IP HTTPS server 使用现有可信 IP 证书，叮咚仅新增 `/dingdong/`、`/ops/`、`/api/`、`/admin/`、`/static/` 路由。Web 容器只绑定 `127.0.0.1:18080`。其他业务域名和原 IP 根路由不改。
- 浏览器页面、后台页面与 `/api/v1/auth/` 均有 HTTP 访问门禁；其他 `/api/` 请求依靠应用自身的 JWT 或会话鉴权。原因：家长端业务请求使用 `Authorization: Bearer`，若外层对全部 API 强制 HTTP Basic，会在登录成功后把儿童接口拦成 401。无门禁请求 `/api/v1/auth/csrf` 返回 401；无令牌请求 `/api/v1/children` 返回 401。不要改成全量 Basic Auth。
- 发布目录：`/opt/dingdong/releases/dingdong-v0.3.10`；仅主机保存的配置文件为该目录下 `deploy/.env`，权限 0600；Nginx 门禁哈希在 `/etc/nginx/.dingdong-prod-trial.htpasswd`。
- 路由模板在 [nginx-locations.conf](production-trial/nginx-locations.conf)。
- Nginx worker 用户为 `nginx`，门禁哈希文件属主组需为 `root:nginx`、权限 0640；第一次误用 `root:www-data` 导致授权请求 500，查错误日志后已修正。
- 现有 IP 证书在本机验证成功，当前有效期至 2026-10-04；主机的 `starfire-cert-renew.timer` 为 active，上次服务结果 success。证书续期仍需日常监控。

## 运维操作

```sh
# 在生产机上看服务健康
cd /opt/dingdong/releases/dingdong-v0.3.10
docker compose -p dingdong-prod-trial --env-file deploy/.env -f deploy/compose.yml ps

# 看日志（不要打印 deploy/.env）
docker compose -p dingdong-prod-trial --env-file deploy/.env -f deploy/compose.yml logs --tail=100 api worker web

# 检查配置并重载公网入口
nginx -t && systemctl reload nginx
```

## 回滚

此实例目前为首次部署，无旧版叮咚需要恢复。若验收不通过，仅撤销 IP HTTPS server 内对 `/etc/nginx/snippets/dingdong-prod-trial.conf` 的 include，执行 `nginx -t && systemctl reload nginx`，然后在发布目录运行：

```sh
docker compose -p dingdong-prod-trial --env-file deploy/.env -f deploy/compose.yml stop
```

**不要执行 `down -v`**：它会删除独立试用数据库。回滚前先保留 `/opt/dingdong/backups/` 中的数据库备份。其他生产应用无需回滚。

## 验收记录

- 2026-09-28：生产机安装 Docker 29.1.3 和 Compose 2.40.3；未安装或改动其他业务的容器。上传包的 SHA 与本地一致。导入的 backend/web 镜像 ID 分别为 `69bf41b02f2d…`、`6aa28aa2a191…`，与 tigery 测试机相同。
- `init` 首次迁移至 `core.0012`，初始化角色和合成测试数据；API、PostgreSQL、Redis 健康，Worker、Beat、Web 正常运行。`/dingdong/version.txt` 返回 `0.3.10`；`/api/v1/runtime` 返回 `demo`、`fixed_code`、`database_fixture`。
- 创建独立的 `ops_trial_admin` 后台账号（管理员角色），密码仅在交付时单独提供，不写入仓库。初始化备份 `/opt/dingdong/backups/baseline-v0.3.10-20260928.dump`，149767 字节、0600，SHA-256 `cd07d4feb273801abf97988c23c766daf6a37002dbd4b64e02fd96becc980ed2`。
- 公网无门禁访问 `/ops/`、`/dingdong/` 和 `/api/v1/auth/csrf` 均 401；通过门禁后 `/ops/login/` 200；不带令牌的 `/api/v1/children` 仍 401。主机 IP 根路径仍 404，既有 `www.happykua.com` 返回 200；Nginx、Lifebook、AgentSMS、Starfire 服务均 active。
- 公网真实 Chrome：运营后台登录 → 工作首页 → 家庭与儿童、服务事项、题库、活动、报告页面（全部 200）→ 退出登录；家长端测试手机号登录 → 创建合成儿童档案 → 退出登录。两组均无页面 JavaScript 错误。未执行对真实供应商的 NFC、推送或短信验证。
- 运行后可用内存约 2.4 GiB。当前实例只允许合成数据测试，不用于真实儿童业务。
