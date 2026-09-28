# 叮咚 v0.3.14 · 生产机试用实例短信频控热修

## 原因与范围

- 目标为 `1.15.23.152` 上的独立 Compose 项目 `dingdong-prod-trial`。生产日志两次显示阿里云拒绝码 `biz.FREQUENCY`；旧版没有把它映射为频控，家长看到“服务不可用”。旧版本地 60 秒间隔还漏算登录后已消费的挑战。
- v0.3.14 把供应商频控返回为 HTTP 429 和“短信发送太频繁，请稍后再试”；已消费的验证码挑战继续计入 60 秒重发间隔。其他供应商服务故障继续走 503。没有修改短信密钥、运营后台登录或演示数据边界。
- 代码分支 `codex/release-v0.3.14` 已推送 `origin`。运行时代码提交 `d9219ea`，本地定向 26 项短信/登录测试、前端 67 项单测，以及 Django、Ruff、锁文件、迁移和文档检查通过。

## 发布与验收

- 切换前 v0.3.13 六个容器运行正常。数据库预备份 `/opt/dingdong/backups/pre-v0.3.14-20260929.dump`，权限 0600、大小 157270 字节、SHA-256 `ef019b7724d02e972bfbbb1e98ed2948a7c9153ca9c4e8f3095b7f41e243da8f`。
- 发布包 `dist/dingdong-v0.3.14.tar.gz` 上传后 SHA-256 核对一致：`0b8376ca423f926bb1e997e5e8b292822ee74ee676604c8f8b85a46caf1618fd`；包内没有 `.env`、`.pem` 或 `.key` 文件。生产机沿用原有受限 env 文件，未读取或打印其内容。
- 从生产机现有 v0.3.13 镜像构建 v0.3.14 后端和 Web 镜像；Compose 配置检查与新镜像 `manage.py check` 通过。`up -d --no-build --wait` 后 API、Web、Worker、Beat、PostgreSQL、Redis 全部健康。初始化报告无待应用迁移。
- 公网 `/dingdong/version.txt` 返回 `0.3.14`；`/api/v1/runtime` 返回 `sms_mode=aliyun_verify`，`environment=demo`，`data_source=database_fixture`；家长入口 `/dingdong/`、运营登录 `/ops/login/`、CSRF 接口均为 HTTP 200。运行中的 API 容器含 `biz.FREQUENCY` 处理代码，启动日志未见异常。
- **本次没有额外发送短信。** 因此线上频控后的 HTTP 429 与家长实际收码登录未在此次发布中触发验证；对应行为由本地回归测试覆盖。当前仍是使用演示数据的生产机试用实例。

## 回退

如需回退应用，在生产机切回保留的 v0.3.13 镜像和发布目录；两个现有 env 文件继续叠加，数据库卷保持不变，不执行 `down -v`：

```sh
cd /opt/dingdong/releases/dingdong-v0.3.13
APP_VERSION=0.3.13 docker compose -p dingdong-prod-trial --env-file /opt/dingdong/releases/dingdong-v0.3.10/deploy/.env --env-file /opt/dingdong/shared/aliyun-sms-v0.3.13.env -f deploy/compose.yml up -d --no-build --wait
```

此版没有数据库结构变更，回退应用不需恢复备份；备份保留用于灾难恢复。
