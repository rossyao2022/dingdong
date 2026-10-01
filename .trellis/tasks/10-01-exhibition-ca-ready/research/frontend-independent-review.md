# 前端独立复核

2026-10-01，缓存实现agent按根agent要求，对其他agent的前端实现独立只读检查；未改前端代码。本记录检查的是当时工作区，期间根agent已开始按发现补回归，最终绿灯由根agent再验证。

## 实质发现（已即时通知根agent）

1. **显式机器人刷新仍占用全局 busy**：click→act→await refreshRobotReport，act全程禁用child-select；document click在busy时取消所有普通链接。供应商慢时CA导航、切儿童被阻断，即使机器人区域显示“其他内容可以继续查看”。须改局部只读动作busy，保留robotReadEpoch/child/viewEpoch晚回保护；补慢刷新期间导航、切儿童和旧响应不注入新儿童用例。
2. **主线继续探索没有直接打开下一题**：nextExperience给interest/talent返回模块hash，loadExplorers恢复正确firstMissing，但render只绘模块地图/介绍。继续主按钮之后仍需第二次点模块按钮。须主线resume action载入具体session后调用正确Explorer.start；历史回看不自动开答题。第一题未答、答到一半、ready未完成均验证。

## 已确认正确的链路

- 后端serialize_session对completed且purpose=assessment生成choice_summary，22题标题/实际所选option label按原题库顺序输出，不需要专业评分或机器人绑定。
- submissionView对completed assessment显示实际题名、完成时间、逐题回答；报告旧深链找到关联session时同样进入该raw-answer视图。
- experienceRecords按child_id过滤sessions/activities，按report_id去重关联报告；同名不同测评保留独立ID与时间。时间按上海时区呈现，未记录时间不捏造。活动completed/skipped进入时间列表。
- 报告列表使用children scoped API；切儿童重置state.session、record、question、explorer state、robot context，异步写入检查viewEpoch和当前child；机器人初次cache读取还检查robotReadEpoch。
- cached=1首读不挂住CA记录绘制。显式刷新仅替换机器人slot，错误时有旧报告保留，同期权限拒绝不保留旧报告；但全局busy问题需修。
- stale renderer接受ready/stale且显示保留记录提示，图表不自行补值。
- Storybook注册主线首次/继续探索/继续活动/选活动/完成回看、时间列表、空列表、320px状态，使用共用CSS和实际纯组件。

## 验证 checkpoint

`npm run check`通过。`node --test unit/experience-flow.test.js unit/dingdong-report.test.js`在根agent同步加入resume回归时为14通过/1失败，失败为新要求task.action=journey-resume仍未实现（不是最终结果）。根agent已收到结果，将修复后重跑。

本次只读检查不等于已跑真实浏览器E2E或Storybook完整build；根agent负责集成验收和最终证据。无供应商调用、无生产修改。

## 增量复核：三项已解决（代码检查）

根agent修复后再次只读核对：

- 机器人刷新/切周期click分流为局部只读操作，不调用全局act；只禁用触发按钮，不设置全局busy，不禁用儿童选择。robotReadEpoch、viewEpoch及child检查仍在。第一项resolved。
- nextExperience输出journey-resume/sessionId/purpose；action读取指定真实session核对child/purpose，然后恢复explorerState、改变hash、渲染，最后在同儿童/同hash且draft/ready时调用Explorer.start；四情境回到assessment并重置状态。从已存firstMissing继续，历史回看不自动答题。第二项resolved。
- 刷新错误403/404/409均清除旧机器人数据，STATE_CONFLICT另有友好绑定改变提示，DINGDONG_BIND_PENDING保留连接入口。第三项（后续即时反馈）resolved。

增量`npm run check`通过；`node --test unit/experience-flow.test.js unit/dingdong-report.test.js` **15通过/0失败**。这是语法与纯组件测试、静态数据流复核，不是Chrome E2E。

## 后台表单独立扫描

- 来源为当前child的completed sessions，默认每purpose最近一次；历史选择严格UUID且用child-scoped queryset。题目通过session_questions取对应已发布版本，答案来自已保存session.answers；原始result/score_range/计分与内容版本保留，不映射或构造叮咚分数。
- professional_result只白名单输出已保存ProfileSnapshot metrics，不返回算法输入、照片或原始采集材料；无专业结果明确缺值。
- 同页面复制/JSON/CSV都带签名的session-ID/digest快照；再导出不会自动换成后续新测评。陪伴方式等依赖改变后返回409重开，失效token422，跨儿童拒绝；预览textarea转义，CSV对公式字符转义，JSON canonical且摘要一致。
- ops_page要求child.view，额外report.view；下载/复制也重新验证权限，响应private/no-store/nosniff，审计仅摘要和测评数量，无家庭答案。浏览器复制从服务端校验后的同快照拉取，并有HTTP手动选择兜底。
- 未发现需阻断本地交付的新增缺口；根agent正在执行真实浏览器和全量回归，不能把本扫描写成那些验收已通过。
