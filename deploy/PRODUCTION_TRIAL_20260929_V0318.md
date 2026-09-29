# v0.3.18 家长端布局修复发布验收

日期：2026-09-29。目标：`1.15.23.152` 的独立 `dingdong-prod-trial` 试用实例。上一版本 v0.3.17。源码分支 `codex/release-v0.3.18`，发布包记录的提交为 `7b50d34af51a4d7b074e33d7190cf9e75d3d9b3a`。

## 发布内容

本版修复窄屏页面切换后的滚动位置、帮助入口按钮排列和 320px 今日陪伴页标题与插画的间距。登录验证码布局沿用 v0.3.17 的修复。完整本地巡检见[家长端布局报告](PARENT_PAGE_LAYOUT_AUDIT_20260929.md)。本版没有数据库迁移、短信业务或 DingDong 接口变更。

## 发布与验收

- 发布前六容器运行 v0.3.17，API、PostgreSQL、Redis 健康。数据库备份 `/opt/dingdong/backups/pre-v0.3.18-20260929.dump` 非空，SHA-256：`bd641dfbcb8f4f71e2da0d6fbf054c5c824b84be51f84cc45f41e04b00adc56c`。
- 发布包 `dingdong-v0.3.18.tar.gz` 的本地与服务器 SHA-256 一致：`9fd5a5830cea5a70dd375f0ff4c218cf79d7e7e30982e8622103ae6b27fec4ce`。从已验证的 v0.3.17 镜像离线构建 v0.3.18 后，Django `manage.py check` 无问题，Compose 配置检查通过。
- 只重建 API、Worker、Beat、Web，沿用 PostgreSQL、Redis 和现有短信、推送、Prototype 环境覆盖。发布后四个应用容器均使用 0.3.18 镜像，API、PostgreSQL、Redis 健康，其余三容器运行中。
- 公网 `https://1.15.23.152/dingdong/version.txt` 返回 200 和 `0.3.18`；家长入口返回 200；`/api/v1/runtime` 返回 `environment=demo`、`sms_mode=aliyun_verify`、`data_source=database_fixture`。运营入口跳转登录页后返回 200。
- 公网 Chrome 登录布局测试在 320/390/430/760/761/800/900/1024/1280px 通过，验证码输入框、发码按钮、登录按钮无重叠或横向溢出。文档审计 `errors: []`。

本次没有发送生产短信，没有用生产家长账号登录，也没有用实体手机或 NFC 标签验收。因此登录后页面的公网回归仍依赖发布前的隔离环境浏览器证据，不能把本次公网未登录检查说成全链路验收。该实例仍为会展演示环境，DingDong 正式账户与真实推送联调条件不因界面发布而改变。

## 回退

保留 v0.3.17 发布目录与镜像。必要时从 `/opt/dingdong/releases/dingdong-v0.3.17` 沿用原四组环境文件、设置 `APP_VERSION=0.3.17`，用 Compose `up -d --no-build --no-deps --force-recreate api worker beat web` 重建四个应用容器。此版无迁移，PostgreSQL/Redis 不需回退。生产 R2/CDN 路径未改。
