# v0.3.16 移动界面与 Storybook 发布验收

日期：2026-09-29。目标：`1.15.23.152` 的独立 `dingdong-prod-trial` 试用实例。上一版本 v0.3.15。

## 变更

- 家长端报告页使用统一纵向节奏，相邻卡片/空态保持间距；按钮与正文分离。320px/390px 的验证码与成长观察日期表单改为清晰单列，窄屏导航不折行；未登录时不显示空的底部导航栏。
- 生产页面与开发期 Storybook 共用 `frontend/ui-components.js` 的按钮、操作组、面板、页头和空态 HTML。Storybook 使用现有三层 CSS，仅随源码交付，不进入生产 Web 镜像。
- 没有改业务接口、数据库模型或 DingDong 协议。版本号统一到 0.3.16。

## 本地验收

- 真实 Chrome 先在旧版得到 320px 登录按钮间距 0 的失败结果，修复后 `frontend/tests/mobile-layout.spec.js` 通过：320×700、390×844、430×932 的登录、建档、探索、今日陪伴、成长旅程、测评报告、账户关联、伙伴引导和家长支持；活动、测评、绑定、编辑弹窗；768/1280 抽查。使用隔离本地后端和合成测试账户，未拦截业务 API。
- 受影响的浏览器回归合计 7 passed（移动布局 1、登录校验 4、家长文案/退出 2）；前端单测 67 passed，语法检查通过。`npm ci` 与 Storybook 10.6.0 静态构建通过；静态 Storybook iframe 实际打开 320px 故事，两张面板可见、无横向溢出、按钮前间距 16px。
- `uv lock --check`、Django system check、部署测试 10 passed、文档审计 `errors: []`。本次未重新跑后端全量业务测试，因为后端只有版本号变更。

## 发布与公网核验

- 发布前旧版六容器健康，`/dingdong/version.txt` 为 0.3.15。备份 `/opt/dingdong/backups/pre-v0.3.16-20260929.dump`，SHA-256 `78948cae461dd630a03340803098767687cbb434cb646b19c1ab384be77ebcf8`。
- 发布包 `dist/dingdong-v0.3.16.tar.gz` 在本机和生产机 SHA-256 一致：`0c81959a729f371eeb544bd60587ea12562f747b202942e6e1c2bb5d7a8db938`。生产机从已验证的 v0.3.15 镜像离线构建新镜像；Compose 配置检查和新后端 `manage.py check` 通过。
- API、Worker、Beat、Web 切到 0.3.16，PostgreSQL/Redis 沿用；六容器健康。公网版本 0.3.16，`ui-components.js` 返回 HTTP 200，运行模式仍为 demo / `aliyun_verify` / `database_fixture`。
- 公网真实 Chrome 320px 与 390px 登录页均 HTTP 200、无 `pageerror`、无横向溢出；验证码与发码按钮间距 12px，发码与登录按钮间距 16px；未登录底部导航隐藏。带测试 NFC 参数的公网入口仍 HTTP 200，参数打开后从 URL 中移除，落在 `#settings`。
- 本轮未向用户手机号发送短信，也未在公网新建家长或固定演示账户。公网登录后的页面以本地真实后端 E2E 验证；用户手机与实物 NFC 仍由用户验收。

## 回退

v0.3.15 的发布目录和镜像保留。用上一版发布目录、同一组基础/短信/推送/Prototype overlay 和 `APP_VERSION=0.3.15` 重新创建 API、Worker、Beat、Web 即可回退；没有新迁移。生产 R2/CDN 配置未参与本次变更。
