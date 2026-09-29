# 生产试用实例 Prototype 推送回调（2026-09-29）

- `1.15.23.152` 的 `dingdong-prod-trial` 已配置新的 `DINGDONG_PUSH_SECRET`，仅重建 API 容器；原 v0.3.14 镜像、短信 overlay、合成展示源、数据库及其他服务未变。密钥在本机忽略的 `dist/dingdong-push-v0.3.14.env` 与生产机权限 0600 的 `/opt/dingdong/shared/dingdong-push-v0.3.14.env`，不入 Git 或文档。
- 公网 `POST https://1.15.23.152/api/dingdong/prototype/events` 的合成签名事件首次返回 201、同一 Event ID 重发返回 200 且 `duplicate=true`。该合成事件已从 `DingDongPushEvent` 删除，余数 0。
- 公网版本为 `0.3.14`，运行时 `demo`、`aliyun_verify`、`database_fixture`；API 中密钥非空、`CA_DISPLAY_DATA_SOURCE=synthetic_fixture`；六个容器运行且健康检查正常。
- 尚未发生 DingDong 真实推送。待对方配置 `CA_PUSH_URL` 和同一 `CA_PUSH_SECRET`，随后实发一条 milestone。当前 Prototype 通过 HTTP 可跑业务；正式跨公网传正式 Key 前按对方文档切 HTTPS，本轮不作为 Prototype 阻塞项。

## 后续重建 API 的命令要点

叠加现有基础 env、短信 env 和 `/opt/dingdong/shared/dingdong-push-v0.3.14.env`，否则重建会清空回调密钥。只重建 API 可用 `up -d --no-deps --no-build --force-recreate --wait api`，不得用 `down -v`。
