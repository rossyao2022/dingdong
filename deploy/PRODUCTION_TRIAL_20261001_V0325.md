# v0.3.25 生产发布与验收

2026-10-01。用户明确放行“双仓同步、CA主干和生产部署”。目标为1.15.23.152的独立`dingdong-prod-trial`，发布前v0.3.24。本次已上线v0.3.25。

## 代码与发布包

先推送origin发布分支及CA main，再推送upstream ca-main；均正常快进，未强推。首轮三者均为ca0250c，后续仅同步发布证据与journal。upstream main仍为3b8723e，用户自行决定PR。当前运行源码b935c30505351ecf241f5cf7d4b3e121d91aa7f9；后续任务归档及证据提交没有改变运行文件。

[发布包核对](evidence/v0.3.25/package-verification.json)：458个运行文件与该提交及当前源码逐字节一致。包`dingdong-v0.3.25.tar.gz`，SHA256 `29e91cff35df56905d8549b2a2b52e4535cd05a08eecb368e72e513dd14c3c23`，不含env、密钥或私密手册。没有新数据库迁移。

## 生产执行

[部署日志](evidence/v0.3.25/production-deploy.log)：先备份`/opt/dingdong/backups/pre-v0.3.25-20261001.dump`，196669字节、0600、pg_restore清单验证通过；SHA256 `1e0a909dfeff111a4d71c243193bad16cd8394c54f4b56ea5ba81866efa7c117`。业务备份和验证基线只留服务器，未下载家庭资料。

包在服务器校验后，沿用v0.3.20基础镜像离线构建。Django check无问题、migrate无待执行项、migrate --check通过；只重建API、Worker、Beat、Web，保留PostgreSQL/Redis容器及卷。未覆盖服务器环境配置，沿用aliyun_verify与现有密钥/回调，未发短信、未轮换密钥、未导入题库或重新发布内容、未改R2/CDN或nginx配置。

## 验收证据

| 项目 | 实际结果与证据 |
|---|---|
| 服务 | [健康日志](evidence/v0.3.25/production-health.log)：六容器正常，API/数据库/Redis健康，Worker pong |
| 原绑定 | [只读核对](evidence/v0.3.25/production-readiness.json)：原家庭/儿童关联、NFC摘要和状态不变，固定号仍active/bound，题库活动与源码匹配 |
| 原历史 | [逐行核对](evidence/v0.3.25/production-history-preservation.log)：备份中1条CA报告和21条测评的原ID及全部COPY字段与当前数据库一致，不仅比较总数 |
| 报告预热 | [预热日志](evidence/v0.3.25/production-report-warm.log)：dry-run后apply，3/7/14/21四周期真实GET全部ready，未写供应商 |
| 报告缓存 | [只读核对](evidence/v0.3.25/production-readiness.json)：四周期8维/7点结构有效，首读cached分支不调用供应商；共8快照，事件仍0 |
| CA原始表单 | [只读核对](evidence/v0.3.25/production-readiness.json)：对现有儿童生成JSON/CSV/中文表单，版本/摘要有效；只记录布尔和用途数量，未输出答卷或创建导出审计 |
| 公网Chrome | [浏览器证据](evidence/v0.3.25/public-browser/public-browser.json)：版本0.3.25，30脚本/样式逐字节一致且no-store，27图片解码，六登录宽度无重叠/溢出，七旧入口、运营验证码及匿名权限正常，无异常页面错误/短信/业务写入 |
| 本地完整流程 | [本地验收](evidence/v0.3.25/local-verification.json)：492后端、119前端、13部署、27真实Chrome E2E通过；含独立API/Worker和合成测试档案，不冒充真实供应商握手 |
| 已上线手册 | [PDF核对](evidence/v0.3.25/pdf-published-verification.json)：家长25页、运营16页均含截图，批准账号密码保留，逐页渲染；凭据不进入git或发布包 |

首读缓存减少现场网络依赖；显式刷新才请求最新报告。后台儿童详情的“测评表单”可复制中文或下载JSON/CSV，CA已有体验独立于对方新接口使用。

## 入口与手册

家长：https://1.15.23.152/dingdong/ 。运营：https://1.15.23.152/ops/ 。

本机私密产物：`output/pdf/叮咚家长操作指南_v0.3.25_已上线.pdf`、`output/pdf/叮咚运营操作指南_v0.3.25_已上线.pdf`。登录页为本次生产公网Chrome截图；其他操作页保留本轮本地真实E2E合成档案截图，已明确标注来源。旧版和待发布版保留。

## 剩余现场与联调事项

- 本轮不发送短信，因此没有再次完成生产登录后全流程。现场需用真实手机完成登录→儿童→探索→活动→时间记录→展会/机器人报告，并验证实体NFC入口。
- 固定共享机器人仍由原儿童绑定。换家长使用绑定流程先由原家长解绑；无需绑定的展会预览和CA体验不抢占机器人。
- 真实Webhook事件目前仍0；四周期来自对方实际GET并保存。验签自测不能替代对方自动实发。
- 原始表单导出已可用，CA→DingDong自动上行和字段业务映射没有在本版实现；对方异步确认与适配不阻塞CA展会体验。
- 公网IP证书验收使用ignoreHTTPSErrors，不声称证书有效性已验收。

## 回退

若应用异常，沿用原服务器env与compose项目，回到`/opt/dingdong/releases/dingdong-v0.3.24`，APP_VERSION设为0.3.24并只重建四应用服务。此版没有新迁移，不需要降库或覆盖数据库。数据库备份只作为事故恢复依据，恢复数据须另行放行，避免覆盖发布后的新记录。
