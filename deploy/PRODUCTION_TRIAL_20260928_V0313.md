# 叮咚 v0.3.13 · 生产机试用实例切换阿里云短信认证

## 已上线范围

- 目标主机 `1.15.23.152`，独立 Compose 项目 `dingdong-prod-trial`。家长入口 `https://1.15.23.152/dingdong/`，运营入口 `https://1.15.23.152/ops/`。
- 家长登录由固定码切到 `SMS_MODE=aliyun_verify`；运营后台仍使用账号、密码和四位图形验证码。`APP_ENV=demo`、数据库演示内容和机器人联调边界均未变；不能把这次短信接入说成机器人或真实测评数据已正式上线。
- 发布包 `dist/dingdong-v0.3.13.tar.gz` 的 `RELEASE.json` 指向 `7e875f4`，SHA-256 `18c04721a502f8a00f8c1d5e0bce9d16bd77337e387c8a00d7de024312989213`。远端上传后摘要一致，包内没有 `.env`、`.pem`、`.key`。分支 `codex/release-v0.3.13` 已推送 `origin`。
- 短信用叮咚专属 RAM 用户与仅允许 `dypns:SendSmsVerifyCode` 的策略。密钥置于主机受限的 `/opt/dingdong/shared/aliyun-sms-v0.3.13.env`（0600），启动时叠加旧版主机 env；没有读取、复制或覆盖旧 env 的内容。最初密钥曾在聊天中暴露，用户明确要求本轮不轮换。

## 切换和验证

- 切换前备份 `/opt/dingdong/backups/pre-v0.3.13-20260928.dump`，权限 0600、大小 155531 字节，SHA-256 `44aecdc8411c46c7b378fb873363b0f72e9b4eb8cb2c9b45d20c00cda08062eb`。原 v0.3.12 后端/Web 镜像与发布目录保留。
- 标准 Docker 构建访问 Docker Hub 的 `python:3.14-slim` 元数据超时，因此使用包内 `deploy/Dockerfile.backend.from-v0312` 与 `deploy/Dockerfile.web.from-v0312` 从主机已核验的 v0.3.12 镜像构建。后端成功安装阿里云 SDK 依赖；仓库 `.dockerignore` 增加 `backend/.env*`，阻止本地密钥进入构建上下文。
- 新镜像独立运行 `python manage.py check` 为 0 issues，配置探针确认 `SMS_MODE=aliyun_verify`、签名和模板配置已装入；随后迁移 `core.0013_extend_sms_challenge_states` 成功。Compose `up -d --no-build --wait` 后 API、Web、Worker、Beat、PostgreSQL、Redis 均健康。
- 公网 `/api/v1/runtime` 为 200，返回 `environment=demo`、`sms_mode=aliyun_verify`、`data_source=database_fixture`；`/dingdong/version.txt` 为 `0.3.13`。`/dingdong/`、`/ops/login/`、`/api/v1/auth/csrf` 为 200，技术管理页 `/admin/` 为 404。真实浏览器已打开家长登录页，能看到手机号、5 位验证码与“获取验证码”入口。
- 本次部署**未再次发送公网测试短信**，也未用生产机完成收码登录。此前本地以同一 RAM 密钥向授权手机号实发并完成登录 200、重复使用 422；此次线上证据限于配置、服务健康、入口和浏览器页面。
- 两份本机 PDF 指南已更新为 v0.3.13：`output/pdf/叮咚家长操作指南_生产机试用版_v0.3.13.pdf`、`output/pdf/叮咚运营操作指南_生产机试用版_v0.3.13.pdf`。各 9 页；文本检查无固定码 `00000`；运营版含后台试用账号密码，家长版不含。运营 PDF 权限 0600，不入 Git；公开 Markdown 手册已改为真实短信流程。

## 回退

若新版本出现故障，在生产机运行以下命令切回 v0.3.12 固定码演示镜像；旧 env 和数据卷保持原状，不运行 `down -v`：

```sh
cd /opt/dingdong/releases/dingdong-v0.3.12
APP_VERSION=0.3.12 docker compose -p dingdong-prod-trial --env-file /opt/dingdong/releases/dingdong-v0.3.10/deploy/.env -f deploy/compose.yml up -d --no-build --wait
```

`core.0013` 只扩展短信挑战状态和字段；回退应用时保留已迁移的数据结构，不恢复数据库备份覆盖新的家庭记录。切回固定码后必须按演示环境处理，不能对外称其为真实短信认证。
