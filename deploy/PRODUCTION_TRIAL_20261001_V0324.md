# v0.3.24 家长机器人与展会体验生产发布

日期：2026-10-01。用户在本地交付后明确“go”，放行本版推送、CA 主干整合和生产部署。目标：1.15.23.152 的独立 `dingdong-prod-trial` 实例，发布前为 v0.3.23。

## 已上线

保留登录建档及 CA 主线和导航；我的 DingDong 补机器人聊天、报告和管理入口。已绑定且授权时完整展开机器人报告，自己的 CA 结果在其后；未绑定时自己的测评正常可用，另有独立展会预览。展会页无需绑定、共享演示不保存为个人报告；后台复用已登录手机号记录体验时间和人工跟进，无意向表单或自动联系。

慢供应商报告只影响机器人区域，不能阻塞 CA 或页面启动；切儿童、解绑、撤权与换机刷新目标账号，防止使用旧绑定缓存。完整本地验证见[实施与回归快照](PARENT_ROBOT_EXPERIENCE_20261001_V0324.md)：后端 463、前端 111、部署配置 13，以及真实 HTTP Chrome 新 4、原 CA 9、独立 Worker 1、旧缓存 5；运营与慢接口专项通过。

## Git、包与生产备份

- fetch 时 origin/main 为 d7dbd75，没有远端新增冲突提交。本地功能优先；main 与 codex/release-v0.3.24 原子快进至 6459ac0，未强推或改视觉参考仓库。后续文档提交不改变实际运行源码。
- [发布包核对](evidence/v0.3.24/release-package.json)：实际源码 6459ac0e5ded46d421d730b9c2a8c57e662c4988，444 个运行文件逐字节匹配，SHA256 `74401b9a610130435456afef25d4bdc3a3bc8b44390b4a66c7f7e0c024e446bf`。实际 env、私钥、PDF、证据及 node_modules 排除；仅保留明确本地用途的空密钥 env 示例。
- [部署日志](evidence/v0.3.24/production-deploy.log)：先备份 `/opt/dingdong/backups/pre-v0.3.24-20261001.dump`，191181 字节、0600，pg_restore 清单验证通过；SHA256 `bca9cc04daf17900e052280d5d5dca56c8ba731ff3cd864278b29f50661017df`。业务备份与验证基线只留服务器，没有下载家庭资料。
- 沿用已验证 v0.3.20 基础镜像离线构建。Django check 正常，迁移 `0017_exhibition_visits` 成功，仅新建两个表及四约束；更新 API/Worker/Beat/Web，原 PostgreSQL/Redis 容器及数据卷保留。未重新导入内容、自动解绑、轮换密钥或改 R2/CDN/nginx 回调。

部署脚本由上一版复制，日志末行误保留 `DEPLOY_V0323_FINISHED` 字样，原始日志不改写；实际镜像、迁移、容器 APP_VERSION 和公网均已独立核对为 0.3.24。该文字不作为部署成功判断依据。

## 生产实测证据

| 范围 | 本轮实际结果 |
| --- | --- |
| 六服务与 Worker | [容器状态和实际 pong](evidence/v0.3.24/production-health.log)，API/数据库/Redis 健康，migrate --check 通过 |
| 数据与历史保留 | [备份基线](evidence/v0.3.24/production-backup-baseline.log)、[只读核对](evidence/v0.3.24/production-readiness.json)：原账号关联/NFC 摘要/状态、1 份 CA 报告和 21 次测评保留，已发布题库活动匹配，导入/发布审计未增加；原演示号仍 active/bound |
| DingDong 真接口只读 | weekly=3/7/14/21 均可读取 Nova、陪伴值 22、8 维与 7 趋势点；未调用供应商 bind/chat/profile，未保存新增测试报告或发送短信 |
| 公网版本与旧缓存保护 | [独立 Chrome](evidence/v0.3.24/public-browser/public-browser.json)：version.txt=0.3.24，29 脚本/样式字节匹配且 no-store，实际依赖图统一版本；27 份图片实际 decode |
| 页面与权限 | 六档宽度、七个旧入口、运营验证码及 390px 截图通过；runtime 展会开启且聊天 URL 安全，新展会 API 匿名 401，运营展会/技术页面匿名均要求登录 |
| 副作用及异常 | 公网验收零短信、零业务写入、零已认证生产登录、零 pageerror/意外 console/失败请求；正常匿名 refresh 401 单独记录，不称零鉴权响应 |

生产供应商推送事件仍为 0；已有 4 份报告快照均来自主动 pull，不能当自动 webhook 推送成功。见[来源核对](evidence/v0.3.24/production-push-sources.json)。独立审查见[发布审查](evidence/v0.3.24/production-independent-review.md)。

## 地址与手册

家长：[生产家长端](https://1.15.23.152/dingdong/)。运营：[生产运营后台](https://1.15.23.152/ops/)。使用原账号和原短信登录规则；重新进入时仍先登录并建立或选择儿童。机器人同时只能由一个儿童绑定，换手机号先由原绑定家长主动解绑，个人 CA 历史保留。

两份私密已上线 PDF 位于本机忽略目录 `output/pdf/`：家长 38 页、运营 21 页。登录截图替换为本次实际公网图；登录后图继续明确标注本地合成档案来源。保留已批准的运营账号密码和演示手机号，不进 Git 或包。家长手册去掉人工测评方向匹配的技术步骤，运营手册保留现场准备说明；旧“生产仍 v0.3.20”提示已修正。59 页重新渲染、目视和批准凭据布尔核验通过，见[PDF 核对](evidence/v0.3.24/production-pdf-verification.json)。待发布版另行保留为历史产物。

## 仍待完成与回退

- DingDong 开发：给一次真实 milestone 的投递时间、事件 ID 和 HTTP 结果，与 CA 接收/处理日志对应；正式账号/真实设备规则仍需另提供。
- CA 运营及用户：真实手机短信、实体 NFC、原家长解绑换手机号及多人共享演示彩排。本轮生产只读和匿名验收不能代替现场交互。
- 我方开发：配合真实推送及现场问题排查。保留已发布 CA 功能，父任务保持 in_progress 承接上述尾项。

保留旧镜像、目录与服务器备份。出现故障优先修复新版或关闭展会入口；不逆迁移删表、不整库恢复覆盖发布后的新家庭记录。紧急回退应用可保留新增空表及 v0.3.23 的缓存/启动保护，不回退到不认识新演示账号生命周期的旧 API。
