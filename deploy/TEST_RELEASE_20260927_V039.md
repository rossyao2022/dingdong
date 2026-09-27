# DingDong v0.3.9 测试环境发布与验收（2026-09-27）

## 发布范围与来源

- 目标：现有 `tigery` 的 `dingdong-demo` 测试环境，经上海公网入口 `http://110.42.225.196/dingdong/` 访问；未触碰晴幂生产机。
- 源码：`codex/release-v0.3.9` 的 `c531e870cc4b889200e8a75e5dafd3b219821ee5`。发布包 `dist/dingdong-v0.3.9.tar.gz`，SHA-256 `c5bacff08a5d3d009f609a4f160d7a27ddd144259b8e6521cfd80c30af6e52ed`；`RELEASE.json` 指向同一提交。
- 六张 WebP 与 `upstream/main@3b8723e` 的对应 Git blob 一致。参考仓库与本仓库无共同历史，因此只择取素材并适配现有四岛页面，没有整分支合并。
- 发布前备份：`/home/tigery/services/dingdong/backups/pre-v0.3.9-20260927.dump`（407 KiB，权限 600）；未读取、复制或打印部署密钥内容。

## 回归结果

- 后端全量：362 passed，覆盖率 90%（本轮最终 `character_name` 与字符串分数补丁又以 `test_ca_display.py` 56 passed 定向验证）；1 条已知 PytestCollectionWarning。覆盖率与供应商真链路均不能称作“完美”。
- 前端语法和单测：67 passed；部署配置测试：9 passed；Ruff、Django system check、迁移检查通过，无新增迁移。
- 真实 Chrome 的 64 项按文件段及失败项复测覆盖：61 passed，3 skipped。跳过的是需显式 `T030_PHASE` 的历史一次性批次处置。整轮曾受共享开发库短信 IP 限流、失联的旧 Celery 进程与浏览器用例导航竞争干扰；隔离本地回归来源地址、启用健康的回归 worker 并修正用例后，所有失败项定向重跑通过。
- 本地 Chrome 桌面与 390×844 移动视口：紫色机器人、四岛地图及活动卡片图片载入，页面无横向溢出、无控制台错误。

## 测试环境部署与公网验收

- 在原 `dingdong-demo` Compose 项目上以 `APP_VERSION=0.3.9` 构建并执行 `up -d --build --wait`，沿用 v0.3.8 的主机侧配置与原数据卷。`init` 完成，`api` 健康，`web/worker/beat/postgres/redis` 正常运行；镜像为 `dingdong-web:0.3.9` 与 `dingdong-backend:0.3.9`。
- 公网 `/dingdong/version.txt` 返回 `0.3.9`，`/api/v1/runtime` 返回 `demo`、固定码和数据库 fixture，`/ops/login/` 返回 200。
- 公网六张 WebP 均返回 `200 image/webp` 且为 RIFF 图片。真实 Chrome 打开公网页面，品牌图加载完成，桌面及 390px 手机断点无横向溢出，控制台无 error。
- 测试部署的 `CA_DISPLAY_DATA_SOURCE` 实测仍为 `synthetic_fixture`；公网页面数据不代表四个 DingDong 正式展示接口已接通。

## 联调仍待对方与双方完成

- Prototype 的 `growth/profile` 和 `persona/health` 为 40401，`reassessment/current` 为 `data:null`；正式四子接口展示契约待确认。
- 固定 `ca_dingdong` 与任意 NFC token 在 Prototype 中能 bind，我方 ULID 账号被拒且错误文案不准；正式账号及 NFC 校验规则待确认。
- Webhook 接收端的验签、幂等、时间窗及公网请求自测通过；密钥尚未交给对方、对方推送目标尚未配置，真实 milestone 尚未到达。
- Prototype 测评切换入口与正式 `/ca/profile` 不同，`configure` 正式枚举和分数类型仍待对方书面确认。

回退时使用原 v0.3.8 发布目录和主机侧配置重新启动同一 Compose 项目；本版无迁移，备份文件可用于核查数据状态。不要在回退时删除数据卷。
