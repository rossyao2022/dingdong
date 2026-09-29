# v0.3.17 家长登录验证码布局修复

日期：2026-09-29。目标：`1.15.23.152` 的独立 `dingdong-prod-trial` 试用实例。上一版本 v0.3.16。

## 原因与修改

用户截图中发码按钮低于验证码输入框，并贴近登录按钮。当前公网在常见视口未复现相同位移，但旧样式以字段和按钮各自的 18px 外边距抵消来对齐；另在 761px 真实 Chrome 下验证码输入框仅约 100px。登录表单现在用容器对齐、显式按钮间距；761–1100px 采用单列，避免中等宽度输入框被挤窄。登录业务请求、短信和 DingDong 配置未改。

## 验证

- 浏览器用例先在 761px 红灯（输入框 99.67px），修复后本地 Chrome 的 320/390/430/760/761/800/900/1024/1280px 均通过宽度、对齐、间距与横向溢出断言；相关浏览器回归 6 项通过，前端单测 67 项、语法检查与 Prettier 通过。390/1024/1280px 表单截图已人工查看。
- `uv lock --check`、Django `manage.py check`、部署测试 10 项、文档审计 `errors: []` 通过；后端只变更版本号，未重复全量业务测试。
- 发布前六容器为 v0.3.16 且运行正常。数据库备份 `/opt/dingdong/backups/pre-v0.3.17-20260929.dump`，SHA-256 `a06cd2e17050bb82e9aa8b8b6c8ea25b1d3233573f87b48f1b627f3de216774c`。发布包本地与服务器 SHA-256 一致：`2a91090d4ed908245a45e28c3169e85ea8e17e229a15088afc552a642940a58b`。
- 以已验证的 v0.3.16 镜像离线构建 0.3.17，Compose 配置检查和新镜像 Django 检查通过。仅重建 API、Worker、Beat、Web，沿用 PostgreSQL、Redis 和现有短信/推送/Prototype 环境覆盖。公网 `/dingdong/version.txt` 返回 0.3.17，`/api/v1/runtime` 为 `sms_mode=aliyun_verify`、`data_source=database_fixture`；六容器正常，API/PostgreSQL/Redis 健康；公网九档未登录布局用例通过。

本次未发送短信，未用生产家长账号登录，也未以实体手机或 NFC 标签验收。该实例仍服务于会展演示，DingDong 正式生产联调条件不因本次界面修复而改变。

## 回退

v0.3.16 发布目录和镜像保留。沿用原四组环境文件，以 `APP_VERSION=0.3.16` 在上一版目录重新创建 API、Worker、Beat、Web 即可回退；本次没有数据库迁移。生产 R2/CDN 路径未改。
