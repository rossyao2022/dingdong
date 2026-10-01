# 绑定展示纠正实施（2026-10-01，本地 v0.3.26）

## 事实与修复

- `renderRobotEntry` 原先不论绑定都追加展会；`robotPanel` 将 active/pending 当已绑定提供换机和解绑；reports 读取失败被当成未绑定；`#exhibition` 未读取当前儿童绑定状态。
- 增加纯规则 `robotVisibility`：当前儿童 active+bound 可管理且无展会；pending 可继续/取消且无换机/解绑；归档/其他儿童不授予当前儿童的管理权限；读取错误或未知状态无展会/绑定/管理捷径。报告可用性和授权不能代替绑定状态。
- 我的 DingDong、测评与报告、账户与关联统一规则；已绑直接展会路由回 reports，未知时不加载共享报告；局部刷新也检查当前绑定规则。保留CA导航、建档、探索及原授权，不按演示机器人类型分类。
- pending 的取消使用既有 retire 服务，额外 `expected_bind_state=unbound`。服务事务按 child→account 行锁，先核对当前绑定状态再处理幂等；已变 bound 拒绝409 STATE_CONFLICT，无账户/关联/审计写入。普通 `{}` 解绑保持兼容，明确bound预期也支持。API/OpenAPI/字段字典已同步。
- 取消/解绑清 NFC token、robot_ref、replacement临时字段与pending标记；主动放弃NFC也清robot_ref，避免下一台手填凭据沿用旧标识。
- 旧换机与标识测试补明确合成 bound 前提；不再用未接通账号证明换机。旧 parent/robot-label 截图改用当前VERSION目录，不覆盖v0.3.25证据。

## 先红后绿

- 单元：新增绑定状态矩阵与组件 assertions，首次27项中3失败，修后27通过。RED日志 `deploy/evidence/v0.3.26/binding-visibility-unit-red.txt`。
- 后端：取消竞态/非法输入先红4失败、正常pending一项通过；修复后 ca_accounts+ops_ca_accounts 共44通过，含默认解绑兼容、幂等、拒绝改变后的bound和已归档错误前提、合法bound枚举。
- 后端RED/GREEN：`binding-cancel-backend-red.txt` / `binding-cancel-backend.txt`（同v26 evidence目录）；Ruff check通过、格式已修。
- Chrome 新4项：390/1280未绑→真实NFC建立pending（带旧robot_ref）→取消真正retired→手填新token不沿用ref→显式本地合成bound→展会直达redirect→另儿童未绑→回原儿童解绑；实际Chrome offline未知态与恢复；取消弹窗期间本地合成接通后旧取消409保留active/bound。所有case收集pageerror并断言空。
- Chrome初始环境固定码IP小时限额被既有50条challenge占满；仅在无供应商、fixed_code/synthetic_fixture隔离库将旧合成challenge时间移出限流窗口，不删记录，重跑通过。此操作不在生产进行。
- 带NFC的pending原reconnect文案“重新连接”与无token“继续连接”不同，实测发现后统一“继续连接”。

## 验收边界

使用本地8025/4177的真实CA API、PostgreSQL和Chrome；绑定确认通过明确带安全guard的本地fixture改变状态，非供应商实投/实体NFC。故障使用浏览器offline，无业务API伪响应。未发送真实短信或进行生产写入。父任务真实Webhook/手机NFC尾项保留。

最终Chrome日志与settled-toast截图在本轮main汇总；不以旧版本绿灯作为本轮证据。

## 最终收尾结果

- `binding-visibility-browser.txt`：4个不同业务Chrome用例全绿（22.7秒）。
- `binding-visibility-shots.txt`：只重复390/1280两个闭环以采集toast结束后的截图，2绿（23.2秒），不追加独立用例计数。
- `replacement-regression-browser.txt`：旧换机、跨儿童换机隔离、设备编号/换机弹窗3个不同用例全绿（17.9秒）；均用明确合成bound前提和新取消契约加载后的真实API。
- `binding-visibility-unit.txt`：27个focused单测绿色；`binding-visibility-syntax.txt`当前完整前端语法检查绿色；后端相关44绿色。
- `shots/bound-companion-390.png` / `bound-companion-1280.png`：聊天（若服务下发）、个人报告、管理；无展会。bound报告截图已等待旧合成pendingtoast到期。未绑报告390/1280保留CA记录及展会入口，无机器人报告或管理。
- 新绑定4 + 旧影响3 = 7个不同Chrome验收用例；2个截图重跑不重复计数。所有新绑定用例pageerror为空。
