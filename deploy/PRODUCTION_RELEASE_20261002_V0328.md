# v0.3.28 界面精简上线（2026-10-02）

状态：2026-10-02 16:31（Asia/Shanghai）已上线。用户授权直接完成上线，功能验收由用户人工进行；本轮未运行测试套件、浏览器、生产登录、短信或供应商请求。

家长入口：https://1.15.23.152/dingdong/ 。运营入口：https://1.15.23.152/ops/ 。

## 发布范围

本轮部署此前已本地完成的[界面文字与重点修复](../文档/界面精简修复_20261002.md)，没有新功能或数据模型改动。源提交 `6b30b2fa0650baf4afff4ffa19b60c626c1b0741`；发布前按origin发布分支/main、upstream ca-main顺序同步，正常快进，upstream main保留不动。后续证据/记忆/journal同步不改变运行源码。

[发布包](evidence/v0.3.28/package.json)：474个已提交运行文件，SHA256 `9db4570d6c6f3858ca4bdfee101e8c56dcac53a70f240ea30719247275875305`，Commander与证据/文档目录不进入包，RELEASE.json记录精确源码SHA。

## 部署结果

生产既有1.15.23.152 / dingdong-prod-trial实例，仅替换api/worker/beat/web四应用，使用已有0.3.20依赖离线构建。沿用原四个env-file，仅由Docker消费，不读取/复制/输出凭据或修改配置；不运行init、迁移、seed，不改变R2/CDN行为。

[部署日志](evidence/v0.3.28/production-deploy.txt)：四应用镜像0.3.28，API running/healthy，worker/beat/web running（既有无独立healthcheck）。[公开版本确认](evidence/v0.3.28/production-health.txt)：`/dingdong/version.txt` HTTP200，正文0.3.28。这是发布状态确认，不是功能或登录后验收。

数据库、Redis与Commander的容器ID和启动时间[发布前](evidence/v0.3.28/unchanged-services-before.json)/[发布后](evidence/v0.3.28/unchanged-services-after.json)逐项一致；未重建或删除数据卷。未新增生产家庭业务写入。

## 备份、回滚与人工验收

[服务器私密备份](evidence/v0.3.28/production-backup.txt)位于 `/opt/dingdong/backups/pre-v0.3.28-20261002.dump`，201870字节/0600；仅留服务器，不下载家庭资料。旧0.3.27两镜像和compose保留。[回滚准备](evidence/v0.3.28/production-rollback.txt)仅切回旧四应用，沿用原配置，不恢复数据库或删卷；本轮未执行回滚。

用户可直接打开上述两个入口人工检查。本轮没有新增自动功能验收结论；此前本地134前端单测、112运营相关测试、26项Chrome验收的证据见原修复报告，不能混作本次上线后的人工验收。
