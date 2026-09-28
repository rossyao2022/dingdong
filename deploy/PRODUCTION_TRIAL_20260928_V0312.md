# 叮咚 v0.3.12 · 运营登录限流修复与最终验收

## 当前版本

- 生产机独立运营试用实例 `dingdong-prod-trial` 已升级为 **v0.3.12**，入口为 `https://1.15.23.152/ops/`（运营）和 `https://1.15.23.152/dingdong/`（家长）。登录页图形验证码已替代浏览器 HTTP Basic 弹窗；公网技术管理页 404。v0.3.11 的完整切换过程见 [上一版部署记录](PRODUCTION_TRIAL_20260928_V0311.md)。
- v0.3.11 代码复核发现：若验证码正确但密码字段缺失，表单可能清零该用户名的错误密码计数。v0.3.12 只在**实际认证成功**时清零；新增回归测试覆盖该绕过路径。生产容器中的 `forms.py` SHA-256 与本地修复源码一致（`7830c00d1a0e2c36914bc9c556463fcfb7ae6a28e8871aeb65065204ca5bb560`）。
- 发布提交 `6d950c4dba777d27528b6a32d6b7c87f3b640992`，分支 `codex/release-v0.3.12`；发布包 `dist/dingdong-v0.3.12.tar.gz` SHA-256 `ad59ee792bbaedc132d36e0c159483a96720b13406b556c91e55e57cf10cb00b`。上传后生产机校验通过，无密钥文件。
- 仍为 `APP_ENV=demo`、固定短信验证码 `00000` 和合成数据；只供运营试用，不能输入真实儿童业务数据。公网家长登录可达，不能宣称真实短信或供应商生产接入。

## 验证与回退

- 后端全量测试 365 项通过（在热修前启动）；最终版新增限流绕过测试在独立 SQLite 内存库 3 项通过，PostgreSQL 测试库的运营登录与后台定向 52 项通过。前端 67 项单测、部署配置 10 项和文档审计 0 errors。生产机更新前备份 `/opt/dingdong/backups/pre-v0.3.12-20260928.dump`（153600 字节、0600），原 v0.3.11 镜像和发布目录保留。
- v0.3.12 在原 v0.3.11 镜像上覆盖同一发布包中的源码并重收集静态文件；Web 镜像更新版本标识。沿用 v0.3.10 主机专属 env 文件，未读取、复制、覆盖其内容。`APP_VERSION=0.3.12` 由启动命令覆盖；无数据库迁移。
- `docker compose ... up -d --no-build --wait` 完成；API、Web、Worker、Beat、PostgreSQL、Redis 健康。公网版本 `/dingdong/version.txt` 为 `0.3.12`，`/ops/login/` 为 200，容器内修复文件摘要与本地一致。公网路由未再次改动，继续使用已验证无门禁、技术管理页 404 的 Nginx 模板。

需要回退应用时，先保持 Nginx 路由不变，再运行：

```sh
cd /opt/dingdong/releases/dingdong-v0.3.11
APP_VERSION=0.3.11 docker compose -p dingdong-prod-trial --env-file /opt/dingdong/releases/dingdong-v0.3.10/deploy/.env -f deploy/compose.yml up -d --no-build --wait
```

v0.3.11 有上述限流绕过，不宜长期回退；若需要同时恢复 v0.3.10 的旧浏览器门禁，按 [v0.3.11 记录中的回滚步骤](PRODUCTION_TRIAL_20260928_V0311.md#切换和回滚)操作。**不要运行 `down -v`**，避免删除试用数据库。
