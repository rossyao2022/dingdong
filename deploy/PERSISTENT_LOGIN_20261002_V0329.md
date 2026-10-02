# v0.3.29 家长长期登录（2026-10-02）

状态：2026-10-02 17:26（Asia/Shanghai）v0.3.29已上线。家长入口https://1.15.23.152/dingdong/，运营入口https://1.15.23.152/ops/。沿用用户直接上线、上线后本人手测的安排，本轮仅做本地认证必要验证与发布健康/版本确认，不做生产登录/短信/业务浏览器测试。

## 用户看到的变化
同一浏览器登录后重新打开会自动恢复，不再首次登录7天固定截止；使用时自动延长凭据。当前仍有效的旧登录成功刷新即可升级，已失效的旧登录要重新登录一次。主动退出与账号停用仍即时失效。清cookie、隐身、换设备/浏览器或完全不用超过凭据留存期仍需登录。

## 实现及边界
服务端LoginGrant.expires_at允许NULL代表无固定截止；access保持10分钟，HttpOnly/SameSite=Lax refresh cookie与JWT每次成功签发400天，Secure沿原环境。旧授权验证通过才转NULL，不批量恢复历史授权；严格jti轮换、防重放、CSRF、家庭隔离与其他设备登录保持。已撤销超过24小时授权可清理，活跃NULL授权不删。

前端refresh/login/logout共用同源Web Locks，页内singleflight与epoch防迟到；无Web Locks时模块队列仅保护同页。旧身份迟到401不能在新身份下重发旧操作；身份变化按AUTH_STATE_CHANGED取消，页面忽略，不会把新登录一起清掉；网络/5xx不清持久cookie。服务器已轮换而响应完全丢失时不能保证旧cookie可用，不能称该特殊状态已完全消除。既有启动自动恢复与成功退出广播保留，凭据不放storage。

## 验证
后端认证/边界/运营审计40项、前端149单测（新增15认证协调）与语法检查通过；后端ruff、相关格式、Django check与迁移漂移检查通过。原实现关键用例先红后绿。证据：[后端认证](evidence/v0.3.29/backend-verification.md)、[前端implement时点及最终补记](evidence/v0.3.29/frontend-verification.md)、[独立全范围check与最终149](evidence/v0.3.29/check-verification.md)。Node受控传输测试不等于浏览器/生产登录验收，用户人工验收待本人。字段清单和OpenAPI已同步；原两份脏审计JSON保留。

## 发布与回滚
完整前端版本图0.3.29。发布脚本[release-v0329.sh](release-v0329.sh)先核对源码标记、保留服务器私密DB备份和旧镜像，离线构建；仅执行core0018放宽NULL，不跑init/seed，不批量改授权或家庭；仅替换api/worker/beat/web。配置仅Docker消费，不读取/复制/打印，不改R2/CDN；DB/Redis/Commander容器不替换。

旧版不支持NULL截止，回滚脚本先停新四应用并等待退出，再将NULL截止填为未来400天（保留撤销字段），保持0018可空schema，再切回0.3.28四应用。不能直接回退代码或恢复NOT NULL，也不能删除授权/恢复DB覆盖期间业务。本轮只准备回滚，未执行。

## 实际发布结果

发布源码`92147391e4c78e372bc98388fe1ec14d3fd9144a`；先origin release29/main，再upstream ca-main正常快进，upstream main未动。[同源发布包](evidence/v0.3.29/package.json)479个已提交运行文件、排除Commander，SHA256 `eead06dd4b80f37aecb27d045e1edbd2193b60a153d90930d9dbc80d206f9c03`。

[部署日志](evidence/v0.3.29/production-deploy.txt)确认0018已应用，四应用镜像0.3.29，API healthy，其余三应用running且无独立healthcheck。[源码确认](evidence/v0.3.29/production-source.txt)APP_VERSION及4个后端关键文件与提交一致；[公开版本/模块确认](evidence/v0.3.29/production-health.txt)version.txt=0.3.29，api.js/app.js与提交字节相同且no-store。IP沿用既有自签证书，curl -k只用于发布状态核对，不称证书验收。

DB、Redis与Commander[发布前](evidence/v0.3.29/unchanged-services-before.json)/[发布后](evidence/v0.3.29/unchanged-services-after.json)容器ID和启动时间完全一致。备份仅留服务器`/opt/dingdong/backups/pre-v0.3.29-20261002.dump`，0600且pg_restore列表校验通过；未下载家庭数据。保留0.3.28旧镜像/compose及旧回滚脚本，现回滚脚本含停止新应用与NULL兼容处理。无生产登录、短信、供应商或浏览器功能测试；用户人工验收待本人。
