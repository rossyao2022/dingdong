# v0.3.28 发布记录独立复核

2026-10-02。trellis-check 仅阅读任务、Git 提交/引用与已有脱敏发布证据；遵照用户要求，没有执行测试、浏览器、业务 API、生产登录、短信、供应商请求或数据库写入。

## 复核结论

现有证据支持 **v0.3.28 已完成生产部署**，无发布阻塞项。此结论限于提交同步、包与源码标识、应用进程和公开版本确认；上线后功能验收由用户人工完成，不称功能测试通过。

## 核对结果

- 发布基线为 `6b30b2fa0650baf4afff4ffa19b60c626c1b0741`，`VERSION` 为 `0.3.28`。该提交相对已完成界面修复及归档/journal的 `1dba681` 只增加本次发布任务材料，没有新增业务改动。
- Git 本地远端引用均指向同一发布源码：`origin/codex/release-v0.3.28`、`origin/main`、`upstream/ca-main`。引用 reflog 记录分别为 16:28:40、16:28:43、16:28:51（Asia/Shanghai），符合 fork 先行。原 `c691ec1` 是发布源码祖先，既有引用更新可快进；`upstream/main` 仍为 `3b8723e`，未改其历史。后续发布文档/归档提交需沿用相同顺序。
- `deploy/evidence/v0.3.28/package.json` 记录 474 个已提交运行文件、排除 Commander，包 SHA256 为 `9db4570d6c6f3858ca4bdfee101e8c56dcac53a70f240ea30719247275875305`。部署日志服务器校验值和 `RELEASE.json` 源码标识与其一致。本复核未另行逐文件验证镜像字节。
- 构建日志显示沿用原离线依赖镜像，更新代码与静态文件；仅重建/启动 `api`、`worker`、`beat`、`web` 四应用，镜像版本均为 `0.3.28`。API 为 `running/healthy`，其余三个为 `running` 且原本没有独立健康探针；不把 running 写成额外功能验收。
- `production-health.txt` 记录公开 `https://1.15.23.152/dingdong/version.txt` 返回 HTTP 200、正文 `0.3.28`。使用既有 IP 自签入口的 `-k`，不是证书有效性验证。
- `unchanged-services-before.json` 与 `unchanged-services-after.json` 中 PostgreSQL、Redis、Commander 的容器 ID、启动时间与镜像逐项一致。日志明确没有 init、迁移、播种、数据库恢复或卷删除。本复核未读业务行，不额外宣称逐行数据比对通过。
- 部署实现记录明确沿用四个原 env-file，仅 Docker 消费，未读/复制/输出/改写内容；脱敏证据中没有密钥或家庭业务数据。既有 R2/CDN 配置没有本轮替换项。
- 数据库备份仅留服务器私密目录，201870 B、0600，记录 SHA256 `f7d00cc127ff046b23b0fc67a7bcb555f57dc9281b2dfc82883b3b6a0ebf88cd`；未下载业务数据。旧 `0.3.27` 两镜像、compose 与四应用回滚脚本保留，未执行回滚，不回退数据库。
- 两份原未提交审计 JSON 仍留工作区，不属于本次发布提交；运行包取自精确已提交源码，不夹带未提交工作区内容。既有 v0.3.28 缓存测试文件属于先前界面修复证据，本轮没有重跑或将其写成上线后验收。

## 文档复核与收尾

已读 `deploy/PRODUCTION_RELEASE_20261002_V0328.md`、`PROJECT_MEMORY.md` 最新条目以及文档索引/原修复报告的本轮差异：明确已上线、准确源码 SHA 与两个入口，将前次“本地完成、未部署”限定为历史时点；没有把本次发布状态确认写成上线后完整功能验收。人工测试明确待用户完成。归档与 journal 由主代理执行，记录提交可晚于运行源码，不应因此改写实际发布源码 SHA。

证据位置：`deploy/evidence/v0.3.28/{package.json,production-deploy.txt,production-health.txt,production-backup.txt,production-rollback.txt,unchanged-services-before.json,unchanged-services-after.json}`，以及本任务 `research/production-deployment.md`。
