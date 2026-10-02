# v0.3.28 生产部署

2026-10-02 16:31（Asia/Shanghai）完成。用户授权直接上线并由用户人工测试；本轮仅确认发布状态，未运行功能测试、浏览器、生产登录、短信或供应商请求。

发布源码 `6b30b2fa0650baf4afff4ffa19b60c626c1b0741`，包 SHA256 `9db4570d6c6f3858ca4bdfee101e8c56dcac53a70f240ea30719247275875305`；服务器上传校验一致，RELEASE.json 同源。仅 api/worker/beat/web 镜像改为 0.3.28，api running/healthy，其余三应用 running（原本无独立健康探针）。公开 `https://1.15.23.152/dingdong/version.txt` HTTP 200，正文 0.3.28。IP 入口沿用既有自签，curl -k 不构成证书验收。

沿用现有四个 env-file，仅 Docker 消费，未读取、复制、输出或改写内容；没有 init、迁移或播种。DB、Redis、Commander 容器 ID 与启动时间发布前后逐项一致。离线构建以原有 0.3.20 镜像依赖为基础，更新代码与 collectstatic；无安装新依赖。

私密备份仅留服务器 `/opt/dingdong/backups/pre-v0.3.28-20261002.dump`，201870 B，0600，SHA256 `f7d00cc127ff046b23b0fc67a7bcb555f57dc9281b2dfc82883b3b6a0ebf88cd`；未下载业务数据。旧 0.3.27 两镜像及 compose 保留。`/opt/dingdong/releases/rollback.sh` 更新为仅切回 0.3.27 四应用，不改配置、不回退数据库；旧脚本保留 `rollback-before-v0.3.28.sh`。仅准备，未执行回滚。

脱敏证据：`deploy/evidence/v0.3.28/production-deploy.txt`、`production-health.txt`、`production-backup.txt`、`production-rollback.txt`、`unchanged-services-before.json`、`unchanged-services-after.json`。没有家庭数据或密钥内容。实现代理不提交或推送，交由主代理记录发布结果与完成归档。
