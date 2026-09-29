# v0.3.15 固定账号 NFC 会展演示部署与验收

日期：2026-09-29。目标：`1.15.23.152` 上的独立 `dingdong-prod-trial`，不是 DingDong 正式账号环境。

## 发布范围

- 家长端沿用短信登录、儿童建档和 NFC 参数承接。仅在 demo 开关启用且 token 与受限配置精确相等时，给该儿童绑定 DingDong Prototype 已知的 `ca_dingdong`；普通 token 仍走我方 ULID 发号。
- 固定账号卡片在有效 `dingdong_sync` 授权后，由我方后端读取对方 `/api/v1/ca/prototype/insights`，展示当前角色和陪伴值，并可打开对方 Prototype 页面手动选择演示测评方向、人设及聊天。CA 测评结果尚未自动映射到对方演示测评。
- 新版本继续使用真实阿里云短信模式、现有 PostgreSQL/Redis、既有推送回调配置。供应商测试 Key、随机 NFC token 只在 Git 忽略的本机 0600 overlay 与生产机 0600 overlay；没有写进发布包或版本库。

## 核验记录

- 本地隔离 PostgreSQL 和真实 Chrome：带参页面摘除地址栏 token；登录、建档、绑定 `ca_dingdong`、授权、回读对方真实聚合均通过。对方 Prototype 中人工选方向、人设、配置、聊天后，陪伴值 9→10；回到 CA 刷新看到 10。
- 后端全量 `381 passed, 1 warning`；前端 67 项单测及语法检查通过。Django system check、迁移检查、锁文件检查、Ruff lint、文档审计通过。Ruff format 全库检查存在 12 个未改历史文件的格式差异，本次改动文件已格式化。
- 发布前数据库备份：`/opt/dingdong/backups/pre-v0.3.15-20260929.dump`；SHA-256 `c6bb89cb48e7a4e0c1960b0f1d9c4c13cd8869538dda8e36241fadf323c94bf5`。
- 发布包 `dist/dingdong-v0.3.15.tar.gz`：本机与远端 SHA-256 均为 `cea49750a20a92c87011e9a0b268a281ba575bb013b24d0a308c79a6eeec7ee0`。生产机基于已验收的 v0.3.14 镜像离线构建 v0.3.15 后端与 Web 镜像；Compose 配置与新镜像的 `manage.py check` 均通过。
- 四个应用容器已切到 `dingdong-backend:0.3.15` / `dingdong-web:0.3.15`；API、Web、Worker、Beat、PostgreSQL、Redis 六容器健康。公网 `/dingdong/version.txt` 为 `0.3.15`；`/dingdong/api/v1/runtime` 为 `demo`、`aliyun_verify`、`database_fixture`。
- 生产机后端使用已配置的测试 Key，直接从对方真实 Prototype 读回 `ca_dingdong` 的人设和陪伴聚合；固定账号开关为 true。生产库 `ca_dingdong` 数量为 0，留给工作人员首个手机测试。
- 公网真实 Chrome 打开带参 HTTPS 地址返回 200，进入登录页，URL 中的 `nfc_token` 被前端移除。**本轮未触发用户手机号的新短信、未在生产库持久绑定固定账号**；生产手机收码、首次绑定和 NFC 实物识别须由用户真机走一遍。

## 手机测试

把交付给工作人员的**完整演示 URL**写入 NFC 标签的 URL/NDEF 记录；浏览器直接打开同一 URL 可以先验证网页承接和带参绑定流程。登录、选择或创建儿童档案后按提示连接演示伙伴，同意查看，打开叮咚 Prototype 人工选择人设并聊天，再回 CA 刷新角色和陪伴值。固定账号只能归属一个儿童档案，首次测试请使用正式负责演示的工作人员账号和儿童档案。

浏览器测试覆盖“打开 URL 后的流程”；NFC 标签实际写入、手机碰触识别、系统弹窗及浏览器跳转还需拿到实物后验证。Prototype 固定账号不能据此推出正式环境接受我方 ULID 账号。对方真实 milestone 推送仍需 DingDong 侧配置我方回调并实发，未算完成。

## 回退

上一版镜像 `dingdong-backend:0.3.14`、`dingdong-web:0.3.14` 和 v0.3.14 发布目录保留。用既有基础 env、短信 overlay、推送 overlay 启动 v0.3.14，去掉 Prototype overlay，即关闭固定账号路径；数据库没有本次新迁移。
