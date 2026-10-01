# v0.3.26 绑定入口与组件弹窗修复

2026-10-01。用户纠正已绑定/未绑定展示，并要求所有页面弹窗使用组件。本次沿用已批准原型整合父任务完成本地修复、真实Chrome验收；尚未推送/部署，生产仍v0.3.25。

## 界面规则

| 当前儿童 | 显示 | 隐藏 |
| --- | --- | --- |
| 已绑定 | 机器人报告、配置可用时的对话、管理/换机/解绑；CA功能保留 | 展会体验；直接展会地址回个人报告 |
| 未绑定 | CA探索、活动、记录、绑定入口、开启时展会体验 | 管理、换机、解绑、个人机器人报告 |
| 待接通 | CA功能、继续连接、取消连接、开启时展会体验 | 已绑定管理/换机/解绑与个人机器人报告/聊天 |
| 读取失败或未知 | 重读提示，CA区域保留 | 不猜未绑，不展示绑定/管理/展会捷径 |

判断仅依据当前儿童active/bound账号，归档和其他儿童不算绑定；不依据报告读取是否成功或授权状态。报告页、我的DingDong、账户页、展会直达统一规则。手机机器人入口单列，不再将“查看机器人报告”末字挤到下一行。

## 取消连接闭环

取消待接通连接携带可选expected_bind_state=unbound。后端沿用child→account锁顺序，账户行锁内检查早于所有更新、关联停用和审计；已接通则409保持active/bound。普通空JSON解绑与幂等兼容，归属校验不变。成功取消/解绑清NFC token、robot_ref和换机临时值，后续手工新号不沿用旧识别信息。OpenAPI和字段字典已同步，无数据库迁移。

## 组件弹窗

组合确认改共享ui-components异步dialog：取消、关闭、Esc默认保留；离页/切儿童/退出取消；独立局部按钮不受全局busy分发阻塞。组合先生成候选，确认且原context/session仍相同才应用；开始才创建新探索，旧答案与已完成结果保留。提供无障碍标题、说明、安全默认焦点、焦点返回，Storybook同步。

[原生弹窗扫描](evidence/v0.3.26/native-dialog-audit.json)：家长与运营应用代码无原生alert/confirm/prompt调用；运营现有Ops弹窗为组件，保留。没有增加框架/CDN依赖或改R2/CDN。

## 验证

[汇总](evidence/v0.3.26/local-verification.json)：后端498、前端123、部署13全部通过；10个不同真实Chrome用例通过（绑定4、旧换机/标识/跨儿童3、组件确认3），重复截图不额外计数。语法与Storybook构建通过。

- [绑定4项](evidence/v0.3.26/binding-visibility-browser.txt)：390/1280未绑→待接通→取消归档→合成bound→切儿童→解绑；NFC带旧robot_ref后取消并手填新token的ref为空；离线不猜状态；迟到取消409不归档已接通账号。
- [原有3项](evidence/v0.3.26/replacement-regression-browser.txt)：换机、设备信息和跨儿童隔离仍正常。以前将pending当已绑的测试改为明确合成确认前提。
- [组件3项](evidence/v0.3.26/component-confirm-browser.txt)：390/1280取消/Esc/关闭、9个真实保存答案、旧记录保留、新组合独立会话；离页、实际第二儿童、嵌套/单实例/跨标签消息取消与焦点。无浏览器原生dialog事件或pageerror。不拦截/伪造业务API响应。
- [手机按钮复核](evidence/v0.3.26/robot-entry-mobile-layout.txt)与[截图](evidence/v0.3.26/shots/bound-companion-390.png)：全字按钮及入口区分正确。
- [后端全量](evidence/v0.3.26/backend-tests.txt)；[前端全量](evidence/v0.3.26/frontend-unit.txt)；[部署检查](evidence/v0.3.26/deploy-tests.txt)。仅已有TestFixture收集警告，无测试失败。

所有Chrome使用隔离本地API/数据库与合成手机号、固定验证码，绑定确认明示为合成夹具；不代表供应商真实握手或实体NFC验收。早期旧测试IP限流、候选新测试异步等待失败已修测试环境/等待，最终记录只按实际通过声明，研究保留原因。没有真实短信、供应商写入、生产数据改动；真实自动推送和现场手机/NFC仍是父任务尾项。

## 发布

版本图统一0.3.26，沿用双仓顺序origin先、upstream ca-main后，禁止强推或直接改upstream main。本次发布须AGENTS远端放行，按既有生产备份/应用更新/数据保留/公网验收执行；本次未改部署环境配置。
