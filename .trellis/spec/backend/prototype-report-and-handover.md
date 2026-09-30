# 会展报告、推送及换家长绑定契约

## 1. Scope / Trigger

用户2026-09-30确认：无机器人也可完成CA演示测评；当前绑定家长可看DingDong共享Mock报告；原家长解绑后另一手机号可绑定同一NFC。此例外仅适用于会展Prototype，不表示正式多账号/真实成长供应商已经接通。

## 2. Signatures

- `demo_initial_input(questionnaire_id) -> dict | None`：补缺失专业指标输入，仍走真实submit、ProfileSnapshot、BackgroundJob和Worker，不插成品报告。
- `source_account_id(account)`：Prototype本地生命周期号映射供应商固定`ca_dingdong`；正式号保持原ULID。
- `GET /api/v1/children/{id}/prototype-demo?weekly_turns=7`：当前家庭、活跃儿童、活跃绑定账号和有效`dingdong_sync`授权之后读取。
- `POST /api/dingdong/prototype/events`：原body HMAC、时间窗、event ID幂等，接收后校验并保存安全报告投影。
- 新迁移0016：`CaAccount.prototype_demo`；最多一条活跃演示绑定；不可变`PrototypeReportSnapshot`；事件处理状态。旧固定行仅标记，不移动家庭/儿童外键、不改号、不自动解绑。

## 3. Contracts

- `CA_DEMO_REPORTS_ENABLED`基础默认false；会展compose默认true，且仅`APP_ENV=demo`、`INTEGRATION_DATA_SOURCE=database_fixture`、原`initial-assessment` synthetic题库允许补输入。现存fixture或fault优先。专业分数为null，不生成假分。
- `is_prototype_demo`供前端识别后续新ULID；首行固定号与已归档行永久保留。旧request_id重放不复活归档绑定。当前所有者解除后，新家长获得新本地号；向供应商仍发固定Mock来源。
- 报告保留原摘要字段，扩展`assessment.baseline_scores`、`growth.current.dimensions`、`growth.curve`、`growth.weekly_turns`、`weekly_turns/updated_at/sync_source`。八维code严格为linguistic/logical/musical/spatial/bodily/intrapersonal/interpersonal/naturalistic。曲线天数0/7/15/30/60/90/180；周频次3/7/14/21。
- 拉取和推送使用实测shape验证；只接受固定账号、prototype_mock与simulation来源。仅有效事件可投影；重试不重复投影；旧时间不覆盖新结果；网络失败仅回退同周频次有效推送。更换账号/撤权时再次检查访问权限。
- HTTP仅开放精确回调路径；家长和运营其他路径沿用现状。`nginx-push-log.conf`须先在http块加载，再引用双server的location配置。仅记录时间、方法、无查询路径、状态和耗时；应用logger `dingdong_ca.push` INFO只记事件摘要/状态/错误码。

## 4. Validation & Error Matrix

| 情况 | 结果 |
| --- | --- |
| 新未绑定家庭、开启演示、原synthetic问卷 | 提交并由实际Worker生成含本次22题答案的CA报告 |
| 关闭flag/非demo/非原题库/正式来源 | 保留未接通或缺输入错误，不偷偷启用测试算法 |
| 原fixture错误或显式故障 | 保留原失败语义，不被fallback掩盖 |
| 演示机器人已占用 | 409；明确让原绑定家长先解绑，不显示刷新可以解决 |
| 已归档绑定重放创建请求 | 409 CA_ACCOUNT_RETIRED；不重新调用供应商 |
| 无绑定/未接通/无授权/其他家庭 | 拒绝DingDong报告；CA静态探索和已有CA报告独立可用 |
| 错周频次/错误八维/乱序曲线/非有限数 | 不生成报告投影，不补0 |
| 签名无效/时间过期/缺头 | 拒绝并留脱敏状态日志 |
| 有签名但业务内容未知或不合法 | 保存接收证据，ignored/invalid，无可读报告投影 |
| 重复event ID | 2xx幂等，不重复生成快照 |

## 5. Good / Base / Bad Cases

Good：A保留CA答卷与报告，解绑后B以另一手机号绑定，B读取相同供应商共享Mock，A已不能读取当前DingDong报告。

Base：没有机器人，新儿童完成22题，专业指标空值、答案真实保存在CA，实际Worker生成演示报告。

Bad：把旧ca_dingdong行family/child改成B，或让B强抢A，或把模拟180天曲线当正式15/30天报告，或前端自己补曲线，均禁止。

## 6. Tests Required

- Fresh-family无CaAccount/无initial_result输入的真实提交→作业→报告，答案完整、空专业分、幂等；演示flag/题库/数据源/故障边界。
- 两家庭占用→原家长解除→新ULID→固定出站source；永久旧行/关联/CA历史保留，非所有者无权解除。
- 原body签名/时间窗/幂等/有效schema/频次匹配fallback/迟到不倒退；非法事件保留而不投影。
- Chrome真实API、独立Worker和移动布局；本地签名POST到页面曲线。供应商绑定输入若使用本地fixture必须明示，不能算真实供应商握手或实际NFC测试。
- 运营接收列表权限、状态和脱敏；OpenAPI/迁移/日志配置/精确HTTP路径及Docker资源完整。

## 7. Wrong vs Correct

Wrong：本地签名推送通过，就写“叮咚已自动推送成功”。

Correct：记录本地接收→校验→投影→页面闭环；真实供应商自动投递仍需供应商outbox/成功事件和生产接收记录对应证据。

Wrong：测试在每个新儿童上先注入initial_result，再宣称新用户正常。

Correct：新儿童输入为空时开始实际流程，测评报告由真实submit和Worker生成；专业结果未接入就保留缺值。


发布脚本枚举Git路径必须用`git ls-files -z`与NUL分隔；不要解析默认带引号/八进制转义的中文文件名。先排除deploy/evidence及私密docs，再核对所有包内运行文件字节及RELEASE.json实际源码commit。
