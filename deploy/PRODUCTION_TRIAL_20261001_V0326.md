# v0.3.26 生产发布与验收

2026-10-01。用户明确“部署”放行后，已部署到 1.15.23.152 / dingdong-prod-trial。

家长端：https://1.15.23.152/dingdong/；运营后台：https://1.15.23.152/ops/。

## 本版修复与发布来源

当前儿童已绑定时隐藏展会体验；未绑定时隐藏管理机器人；待接通及读取失败有独立处理。组合调整使用共享组件确认，取消或离开保留原回答；家长与运营应用无原生 alert/confirm/prompt 调用。详见[功能与本地验收](BINDING_AND_DIALOGS_20261001_V0326.md)。

运行源码 e82401e，包内464个已提交文件与源码、当前运行代码一致。包SHA256：`da9ad82cc976696613e2a049d29a96af1a8edb31b6823c5efbcdd1c14cc2b3a0`。部署前代码已按origin先、upstream ca-main后同步，未改upstream main；本报告及journal随后沿用同一流程同步。

## 备份及更新

- 服务器私密备份 `/opt/dingdong/backups/pre-v0.3.26-20261001.dump`：198212字节、0600，pg_restore清单验证通过；SHA256 `cebb7b239cce5edefdf7a28cd24730950237000ca3432c490f0d326c9f135119`。家庭原始数据未下载。
- 离线构建0.3.26镜像，仅更新api、worker、beat、web。PostgreSQL/Redis原容器和卷保留。本版无新增迁移，Django检查及迁移检查通过。
- 沿用服务器现有环境配置、短信密钥、推送配置及R2/CDN路径，未轮换、未重播种题库、未恢复或改变业务绑定。

证据：[部署](evidence/v0.3.26/production-deploy.log)、[备份基线](evidence/v0.3.26/production-backup-baseline.log)、[服务健康](evidence/v0.3.26/production-health.log)。

## 数据与服务核对

六服务健康/运行，Worker pong。原1条报告、21条测评的ID及所有字段逐行保持；原账号儿童/家庭归属、NFC摘要、账号状态以及已发布内容保持。[核对结果](evidence/v0.3.26/production-readiness-combined.log)。

原固定演示号在本次备份时已经是retired，bind_state历史值bound；部署后保持相同状态。这不代表当前活跃绑定，也不是本次部署将其解绑。界面以当前儿童active/bound为准，没有自动恢复账号。

3/7/14/21四周期已有缓存报告可读，各8维、7个曲线点，cached首读零供应商调用；没有重新预热或声称新拉取。原始测评表单JSON/CSV/中文只读生成正常，没有新增业务或审计记录。

## 公网验收

真实Chrome读取公网0.3.26：30个脚本/样式逐字节匹配源码且no-store，27图片加载解码；320/390/430/768/1024/1280六宽度登录布局无溢出或验证码按钮重叠；七个旧入口跳转、运营验证码及匿名保护正常。无异常脚本/静态请求错误。

实际生产组件390px烟测：默认取消焦点、Esc返回false并移除弹窗、浏览器原生dialog事件0。该项未登录、不提交探索；登录后的绑定矩阵及探索保存由本版本地真实API/Chrome10项验证。后端498、前端123、部署13通过。

证据：[公网结果](evidence/v0.3.26/public-browser/public-browser.json)、[组件截图](evidence/v0.3.26/public-browser/shots/public-component-confirm-390.png)、[独立复核](evidence/v0.3.26/independent-production-review.md)。

## 验收范围及剩余事项

本次没有发送短信、生产登录后业务写入、实体NFC或供应商写入。生产Webhook事件仍0，不宣称对方自动推送到达。真实手机/NFC现场彩排和CA上行映射/发送仍是父任务待办。公网测试沿用ignoreHTTPSErrors，不作为IP证书有效性证明。

应用回退可沿用既有环境配置切回0.3.25镜像，仅更新四应用；本版无新迁移，正常应用回退不需要还原数据库。恢复数据库另需明确放行，不能覆盖用户在上线后产生的新记录。
