# 后端 TDD 用例与分批计划

真实 PostgreSQL，API 不 mock；短信固定字符串 00000。测试通过 HTTP 视图/事务真实写库，种子数据用实际 management commands 注入。参照 workspace 的 OpenAPI 契约检查响应。

## M1 已完成：登录、档案、活动

- AUTH-01：先获得 CSRF，发送挑战，00000 登录；建立真实 user/family/membership/grant。
- AUTH-02：0000/数字0/错误码拒绝；错误计数持久，达到5次锁定。
- AUTH-03：过期、消费后的挑战拒绝；同手机号重发60秒限制；成功登录只消费一次。
- AUTH-04：无 CSRF 拒绝，JWT 伪造/过期/撤销拒绝，staff 不能用家长入口。
- AUTH-05：刷新旧 JTI 失效，刷新不延长7天；退出后原 access 失效；另一个设备不受影响。
- CHILD-01：只允许 name/gender/birth_date；未知 grade/family_id/is_staff 拒绝；未来生日拒绝。
- CHILD-02：同创建键重复返回同一对象，不同内容冲突；A/B家庭列表、修改、详情相关操作隔离。
- ACT-01：只读已发布活动，创建时锁定内容版本；停用后已开始活动仍可恢复。
- ACT-02：一个孩子一个 active；步骤 revision 过期拒绝、越界拒绝。
- ACT-03：完成必须到最后步骤；相同 finish 幂等，变化冲突；跳过无反馈、无计数。
- ACT-04：完成次数与上海日期去重统计来自全匹配数据库记录，分页不影响统计。
- ACT-05：跨家庭活动详情/修改/完成均404；过期JWT不能写数据。
- DATA-01：seed_base/seed_mock重复执行不重复、不覆盖用户编辑；无静态API响应；mock只生成测试家庭/内容。
- DATA-02：PostgreSQL唯一约束阻止重复手机号和同孩子并发active记录。
- CONTRACT-01：M1所有成功响应通过OpenAPI JSON Schema校验；错误统一格式。

## M2 已完成：授权、测评、一次性图片

- PURPOSE-01：授权同用途幂等，跨家庭拒绝，撤回后新处理和结果保存均拒绝。
- ASSESS-01：22道合成题，按题码保存/清空，revision冲突，固定题库版本。
- ASSESS-02：合成五图槽位/格式/内存上限检查，缺槽/未知槽/真实图拒绝。
- ASSESS-03：数据库fixture适配器提供非生物测试结果；真实生成attempt/profile并启动报告任务。
- ASSESS-04：超时unknown、取消、迟到结果、重采；数据库/队列/日志/临时文件不留图片。

- REPORT-M2：真实生成初始报告，重复执行仅一个结果；数据库故障触发重试、达到上限停止；模板缺失等待并恢复。
- RECOVERY-M2：模拟数据库中的过期 Worker 租约，旧尝试标记 abandoned；算法进程中断恢复 unknown，禁止直接重投。
- HTTP-M2：独立本地 HTTP、Redis、Celery Worker 生成并查询真实报告。

## M3 已实现并验证：机器人、阶段画像、报告与后台动作

- SYNC-01：fixture票据真实校验身份/授权，关联唯一，撤回与解绑停止获取。
- SYNC-02：成功/缺失/超时/重复/修订/同版本冲突，失败游标不前进。
- SCORE-01：规则缺失waiting_rule；合成规则固定输入/版本；网页活动不直接加专业分。
- REPORT-01：新画像经真实worker生成报告，重复投递幂等，失败可重试，旧报告不被覆盖。
- STAFF-01：11个后台动作/查询按4固定角色验证；CSRF、禁止自提权、家长JWT拒绝。
- REQUEST-01：删除实际业务对象后仍可查看去标识回执，不只切completed状态。
- RECOVERY-01：真实Redis/Celery进程中断、pending补投、租约到期与迟到worker不覆盖结果。
- CONTRACT-02：其余API逐项校验OpenAPI；数据库注入覆盖19种cold/warm场景。

M3 回归包含全部 48 个 API 路由及角色动作。真实 SIGKILL 恢复与两个 Worker 的迟到提交验证分别见 http-smoke-m3-result.json 和 http-smoke-m3-fencing.json。场景步骤见 M3_SCENARIOS.md；最终数量以 tdd-green-m3.txt 为准。


## M5 已完成：题库用途、编辑与版本闭环

见 tests/test_questionnaires.py：按用途题量、不可变字段、参考四题、可读数据、可视化编辑表单、探索幂等完成且不产画像、发布前后旧答卷隔离、跨家庭/工作人员权限、可选多选、目录与空草稿发布校验。后端总计98项通过，覆盖率92%；9个真实Chrome场景通过，最近启动复验见 [界面记录](../../frontend/docs/UI_FUNCTIONAL_20260912.md)。
