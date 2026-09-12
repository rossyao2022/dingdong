# 19 个闭环场景的数据库输入与执行方式

先 migrate → seed_base → seed_mock。登录仍用字符串 `00000`，新建儿童后执行：

```sh
uv run python manage.py inject_fixture --child-id CHILD_UUID --scenario SCENARIO
```

注入命令只写测试输入/内容，不创建关联、画像、报告或伪造 API 响应。核验票据为 `TEST-PROOF-CHILD_UUID`，有效期从注入时起 24 小时；校验绑定的家庭并一次消费。重新注入会明确重置该儿童的测试输入/票据状态，适合隔离测试儿童，不用于生产。

同步样例窗口固定为 `[2026-09-01T00:00:00Z, 2026-09-08T00:00:00Z)`，当前 fixture 游标是递增样例序号，不代表真实 DingDong 游标。一个观察条目代表该窗口完整聚合，未知指标、重叠窗口和不合法修订被拒绝。查询必须传带时区的 from/to，使用同一窗口。

| scenario | 注入内容 / 真实动作 | 验收 |
|---|---|---|
| fresh | 基础内容；登录、新建儿童、GET growth-overview | 空指标与 null 画像，无假零分 |
| sms_invalid | 基础内容；发送挑战后错误码/正确码/重复消费 | 错误、限次及一次消费 |
| family_isolation | 基础内容；两个家庭分别登录 | 跨家庭对象 404、回执隔离 |
| activity_complete | 已发布活动；开始→保存最后一步→finish→重复 finish | 完成数只增一次 |
| activity_skip | 已发布活动；开始→skip→冲突 finish | 跳过不加分，冲突 409 |
| assessment_success | 初始结果输入；授权→22题→指定合成图→Worker | 新画像/报告真实入库 |
| assessment_bad_input | 基础内容；缺题/缺槽/非合成图提交 | 拒绝且无结果 |
| assessment_timeout | 超时故障；提交→查询→取消 | result_unknown，不能盲重传 |
| sync_success | 身份票据、首个观察；授权→verify→Worker | 观察入库，游标到 1，阶段报告生成 |
| sync_duplicate | 两份相同修订；两轮同步 | 游标到 2，但只有一份观察和结果 |
| sync_correction | 第二份为合法新修订；两轮同步 | 产生新来源/画像/报告，旧内容保留 |
| sync_conflict | 同版本不同内容；第二轮同步 | SOURCE_CONFLICT，旧值 stale，游标停在 1 |
| sync_failure | 第二轮超时 | 保留旧值，游标不前进，有限重试 |
| no_consent | 身份及观察输入；verify 后主动撤回授权再处理 | 无新增观察/画像，返回 no_consent |
| rule_missing | 规则停为 draft；同步→阶段任务等待→内容人员发布规则 | 先 waiting_rule，发布后恢复 |
| rule_version | 新规则草稿 v2；先 v1 结果，再发布 v2 | 新画像/报告；比较要求相同规则及相邻等长窗口 |
| report_retry | 连续 5 次渲染失败输入；选择初始或阶段报告其中一条链路，Worker/Beat 自动耗尽预算，再技术人员 retry | failed→pending→成功，历史尝试保留 |
| permission | 初始化固定角色；用独立工作人员登录执行后台动作 | 角色、CSRF、禁止自提权/修改账号管理员 |
| deletion | 测评及机器人输入；完成业务→创建 deletion 事项→技术人员执行 | 实际清理，家长仍能查询 child_id=null 回执 |

`rule_missing` 改变共享测试规则状态，应在独立测试数据库运行。其他无额外外部输入的场景不会替用户执行其业务动作。`permission` 不创建默认密码；本地可用 createsuperuser，业务工作人员按固定角色管理。

另外支持 `assessment_failure`（明确失败后重采）及 `report_failure`（一次失败后恢复）。

pytest 在独立 PostgreSQL 测试库中覆盖上述业务分支。真实进程脚本：

- `scripts/smoke_m3_http.py`：独占本项目测试 Worker；领取任务后 SIGKILL，租约恢复、阶段报告、真实后台登录和删除。
- `scripts/smoke_m3_fencing.py`：两个独立 Worker、相同任务租约切换，旧 Worker 迟到不产生重复结果。

脚本通过短期 PostgreSQL 表锁把 Worker 停在测试输入读取处，不增加应用里的延时开关；使用专用队列，运行前停止本项目常规 Worker/Beat。只在本地合成数据库执行，会新增合成数据；第一个脚本会删除其创建的儿童数据。它们不调用供应商、也不替代供应商联调。

题库更新后，初始结果输入默认引用当前发布版。验证旧会话时，在 assessment_success/assessment_failure/assessment_timeout 场景命令附加 `--questionnaire-version-id UUID`，保持其固定题库版本。
