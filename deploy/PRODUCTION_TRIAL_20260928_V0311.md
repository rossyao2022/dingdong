# 叮咚 v0.3.11 · 运营登录验证码与生产试用更新

> 此版上线后检查发现空密码提交可能清除登录失败计数；当日已由 [v0.3.12 修复版](PRODUCTION_TRIAL_20260928_V0312.md) 替换。下文记录 v0.3.11 当时的部署过程，不代表当前线上版本。

## 范围和现状

- 目标机：`1.15.23.152`，独立 Docker Compose 项目 `dingdong-prod-trial`。仍是 `APP_ENV=demo`、固定短信码和合成数据的**运营试用实例**，不代表真实短信或 DingDong 供应商生产接入。
- 公网：`https://1.15.23.152/ops/`、`https://1.15.23.152/dingdong/`。浏览器 HTTP Basic 访问弹窗已移除；运营在应用登录页输入账号、密码和四位图形验证码。验证码两分钟有效、提交即失效；账号密码连续输错 10 次后限制 15 分钟。失败计数和挑战重放标记共用 Redis DB1，跨两个 Gunicorn worker 生效。
- 技术管理页 `/admin/`、`/dingdong/admin/` 在公网 Nginx 返回 404；其他生产域名和 IP 根路径不变。运营手册见 [生产机运营试用操作手册](../dist/guides/生产机运营试用操作手册.md)。
- 源码提交 `07174ea6dc50253394664ba62b74304f701098b5`，分支 `codex/release-v0.3.11`；发布包 `dist/dingdong-v0.3.11.tar.gz` 的 SHA-256 为 `bdd74cb3437e30ae12d111944586669c13608ba45508c3158691473bede2cf2e`。包内 `RELEASE.json` 指向同一提交；无 `.env`、`.pem` 或 `.key`。

## 切换和回滚

- 切换前备份：`/opt/dingdong/backups/pre-v0.3.11-20260928.dump`（151723 字节、0600）和 `/opt/dingdong/backups/nginx-dingdong-pre-v0.3.11-20260928.conf`（0600）。原 v0.3.10 镜像和发布目录仍在。
- 新版目录：`/opt/dingdong/releases/dingdong-v0.3.11`。生产机以已核验的 v0.3.10 镜像为基底覆盖本版源码，重新收集后台静态资源；Web 镜像只更新版本标识。无新增 Python 依赖或数据库迁移。Compose 继续使用旧版目录中的主机专属 env 文件，**未读取、复制或覆盖其内容**；启动命令通过 shell 覆盖 `APP_VERSION=0.3.11`。密钥与数据卷均沿用原实例。
- 先用新版镜像单独运行 Django `check`、Redis 原子 `cache.add` 探针；再升级 Compose，确认 API 和验证码本机可用后才更新 `/etc/nginx/snippets/dingdong-prod-trial.conf`，`nginx -t` 通过再 reload。旧 Basic 哈希文件暂留主机供紧急回退，当前公网路由不引用它，也不再向运营分发门禁账号。

回滚时先恢复旧路由，再回到旧镜像；不要运行 `down -v`：

```sh
cp /opt/dingdong/backups/nginx-dingdong-pre-v0.3.11-20260928.conf /etc/nginx/snippets/dingdong-prod-trial.conf
nginx -t && systemctl reload nginx
cd /opt/dingdong/releases/dingdong-v0.3.10
APP_VERSION=0.3.10 docker compose -p dingdong-prod-trial --env-file deploy/.env -f deploy/compose.yml up -d --no-build --wait
```

## 验收

- 后端运营登录定向测试 52 项、部署配置测试 10 项、Ruff 和 Django system check 已通过；本轮全量后端测试结果见任务报告。
- 公网无浏览器门禁：`/ops/login/`、`/ops/captcha/`、`/dingdong/`、`/dingdong/version.txt` 均 200，版本 `0.3.11`；`/admin/` 和 `/dingdong/admin/` 均 404；未登录儿童接口 401，`/api/v1/auth/csrf` 200。生产 IP 根路径 404，原有 `www.happykua.com` 本机 Host 路由 200。
- 真实 Chrome：后台验证码图片可辨认，使用临时运营账号完成“验证码→登录工作首页→退出”，家长端入口 200，页面无 JS 错误；验收后临时运营账号已删除。390px Chrome 使用一次性合成手机号完成固定码登录、建儿童档案和退出，无 JS 错误。
- 生产机的新 API、Web、Worker、Beat、PostgreSQL、Redis 容器均健康。全量后端测试与最终文档审计结果另在任务报告中记录。
