# CA 画像上行与运营导出合同复核

2026-10-01，trellis-research，只读源码和原始 DOCX；本稿是判断与建议，不是已实施功能。未调用供应商写接口、未登录生产、未发短信。

## 1. 现在确实实现了什么

CA 有真实儿童级答卷、六岛兴趣结果、八维观察结果、四情境次数、网页伙伴引导偏好、22题的演示 ReportVersion 和活动记录。DingDong 回读/验签快照也已实现。

**没有 CA → DingDong 测评上行闭环。** `dingdong_client.call()` 只有通用传输；生产业务调用位置是 `ca_account.py` 的 bind、`ca_display.py` 的 persona/growth/health/reassessment 查询及回应/complete、`prototype_reports.py` 的 insights。全业务源码无 `/api/v1/ca/profile` 调用、无 Profile DTO 构造/提交队列/送达记录、无 `/api/v1/app/companion/prototype/assessment` Cookie session 调用、无 session/launch 的 SSO 实现。测试里的通用 client GET profile/current 不证明产品具备画像上行。复测 complete 当前接受提供的 ID，也不能证明先完成了 /profile。

家长测评用途文案 `frontend/app.js:1466` 明确“报告保存在你的账户中，不会发送给机器人”。要新增个人上行，必须同时调整具体用途/数据范围/对方接收说明及授权路径，不能把当前回读 `dingdong_sync` 授权自动认定为已经授权新目的。

## 2. 原始文档的两种接口不同

直接读取 `材料/文档/DingDong_CA_API_Integration_Guide_v1.0.docx` 的 word/document.xml。第6.2节：

- 服务端 `POST /api/v1/ca/profile`，X-API-Key。
- `profile_id`≤64、`ca_account_id`≤64、`assessment_id`≤64、ISO8601 `assessment_time`、`learning_style`、`interest_primary`、`interest_secondary`、`profile_version`。
- 八字段：linguistic_score/logical_score/musical_score/spatial_score/bodily_score/intrapersonal_score/interpersonal_score/naturalistic_score；**0–100 或 null，CA 正式测评原始分**。
- 新画像保留历史，不能把 DingDong growth proxy 当 CA 原始测评分。

直接读取 `材料/文档/DingDong_CA_Prototype_Demo_Logic_v1.0.docx`。第4节：

- 手机网页 Cookie Prototype session 的 `POST /api/v1/app/companion/prototype/assessment`。
- JSON 只有 interest_primary、learning_style、personality_preference 示例字段；示例 science/cognitive/gentle。
- 对方**按兴趣类型生成 mock 八维 baseline**，不是导入 CA 8 个原始分。
- 文档明确允许现场先在 DingDong 网页人工选择/填写，双方确认字段后再替换成自动传递。
- 固定 ca_dingdong 与 profile_prototype_001/assessment_prototype_001 是共享演示身份，不能当真实儿童账户或正式 SSO。

正式 /profile 在本项目历史实测曾被 Prototype 拒绝；本轮不重做写接口试探，也不据旧实测承诺当前已开放。若要服务端自动更新 Prototype，应请对方提供带服务鉴权/幂等/明确共享覆盖语义的接口；不能简单把 Cookie 网页端当现有 X-API-Key API。

## 3. 本地结果与合同冲突

| 本地真实结果 | 现有来源和范围 | 上行缺口 |
| --- | --- | --- |
| 六岛兴趣 | `exploration.py:84`，RIASEC R/I/A/S/E/C，选3岛，每岛3题，分数均值0–4；未选岛未测 | 对方 art/science/engineering/philosophy/language/social 不是同一分类，不能 R→engineering、I→science 等当已确认算法。需 CA 业务提供/批准带版本映射、平分处理和不足数据规则，或明确人工选择演示方向 |
| 八维观察 | word/music/logic/space/body/self/social/nature，每维3题，1–5求和3–15 | 名称可做字段语义对照，但数值不是正式专业0–100量表。乘100/15或min-max不能变成正式原始分；不得伪造。可原样展示“日常观察3–15”，不能直接发正式 *_score |
| 四情境 | cognitive/imitative/reverse/open 的4题计数，每类0–4 | 9/22 code 表为 cognitive/imitative/open，但10/1在线OpenAPI为 cognitive/imitation/reverse/open；reverse已在当前schema合法，CA imitative与对方imitation需别名/语义确认。并列与手动偏好优先仍未定义，不可自行折叠reverse |
| 网页伙伴引导 | ChildCompanionPreference 当前手动选择的四模式 | 这是网页活动话术偏好，不是诊断结论，也没有性格量表；不可自动生成 personality_preference=gentle 等性格字段 |
| 22题初始报告 | `assessments.py`/`tasks.py`，真实答卷→fixture/demo adapter→Worker报告；`demo_report.py` 专业结果 value=null | 不是专业八维算法输入结果；演示模板含本次选择和专业结果暂无数据，不能据答卷凭空造8分或正式画像 |
| 指纹指南 | 手动对照/示例/短暂预览和指南选择 | 无算法判型，不得拿指南选择当已识别孩子指纹或专业学习风格 |

对方 Code 表 `设计/CA对接_DingDong_code表_20260922.md:9–31` 定义六类型/三学习方式。正式 DOCX 示例 interest_secondary=robotics 与9/22六值 code 表冲突；10/1当前OpenAPI把兴趣定义为string，而非六值enum，不能仅由schema推出业务支持robotics，也不能仅凭旧表断言当前拒绝。应以当前运行合同结合对方业务确认定义映射。分数字符串72.00旧实测与10/1在线输入schema允许number/string/null相符；这不把CA观察分变成专业分，也不证明范围/模式可写。

## 4. 运营当前能看/导出什么

- `/ops/children/{id}/` 可看答卷、报告、画像；`/ops/reports/` 列表，`/ops/reports/{id}/` 只渲染 ReportVersion sections、来源、任务和模板；可以查看生成失败和允许的任务重试。
- `/ops/dingdong-push/` 是技术接收/投影状态，不是 CA 测评发给对方。
- `/ops/exhibition/` 是家长体验记录及人工跟进，不存专业报告上行文件。
- **没有运营报告 JSON/PDF/CSV 一键下载，也没有“发给 DingDong”按钮/API。** `ops/urls.py`、views/templates 没有 export/download route/action。
- 家长已有“导出成长记录”：`frontend/app.js:469` → `GET /children/{id}/export`。`core/api/exports.py:16` 在 owned_child 下导出 child 基本信息、exploration/interest/talent 三类 session（含真实答案/结果/题库计分来源）、伙伴偏好与活动。
- 该导出**排除 assessment 类型22题 session、ProfileSnapshot、ReportVersion、CaAccount 和 DingDong report**；不是完整“CA报告文件”，也不是对方 /profile 请求DTO。无手机号/NFC/认证密钥/图片。要做运营一键整理，可复用部分数据服务，但需独立运营权限、儿童范围与审计，不可让运营接口绕用家长 JWT 或把现有 JSON 改名冒充正式接口文件。

## 5. 建议最小可用资料包（提案，未实施）

将“给人看的 CA 结果资料”和“给 /profile 的严格DTO”分开。首先做儿童级 **CA 体验结果资料包**，运营一键预览/下载，便于对方与 CA 业务看实际有哪些数据、无需家长重新填写：

- 包版本、生成时间；内部 child ID（分享时用明确案例编号）、session/问卷/计分/content/source版本、完成时间、数据来源。
- 六岛仅已测3岛的原始分/总分/题数、选择岛、平分；未测为未测，不补0。
- 八维保留原始3–15范围和问题来源，标日常观察，不做专业百分数。
- 四情境真实计数和单独的家长网页引导选择；性格数据未采集。
- 如需要22题，完整选择摘要及 CA ReportVersion 内容/版本，专业分无数据明确 null；不能带临时指纹图片。
- 分成“已取得”“未取得”“待确认映射”；可有候选演示 direction，但必须显示人工选择/已批准规则版本，不自动当专业结论。
- 不默认含手机号/NFC/JWT/供应商key/对方共享Cookie；手机号已有后台可查，无需塞对外结果。

**现在不建议自动把所有游客的报告提交共享 ca_dingdong。** 共享账号只存在一份当前画像，后一个游客更新会覆盖前者全场演示方向，当前报告又不反映个人。同一时段要由工作人员显式指定一次演示样本或继续在对方网页人工选择；独立游客CA体验仍可正常用。

如双方要实现演示自动传递，只传已确认的 interest_primary/learning_style 和可选已确认性格偏好，由对方mock生成分数；明确覆盖同一共享演示，不附带个人八维分。不自动做未确认的学习方式别名或兴趣映射；reverse在当前OpenAPI中已合法，不应误称当前接口不接受。

正式上线则待：独立设备/账户接口可创建真实 ca_account_id、真正专业算法或明确已批准的非专业输入合同、字段规则/版本/缺值/并列、发出授权、幂等/状态重查/历史追踪。8专业分未取得时可按正式DTO null，但**不能因此直接声称对方会接收或能完成人设选择**，须双方实证。

## 6. 10/1 当前在线 OpenAPI 补充（覆盖旧表的当前schema判断）

主 agent 在本轮只读获取 `http://122.51.108.225/openapi.json`，证据 `research/ca-report-live-contract-20261001.json`。本 agent 阅读该快照，不调用供应商写接口。

- 当前 LearningStyle enum 为 `cognitive/imitation/reverse/open`。9/22旧表的 `imitative` 已与当前schema不一致；不能继续用旧表断言 reverse 当前非法。CA内部 `imitative` → 对方 `imitation` 可以是候选别名，但须确认同一语义与实际运行接受情况。reverse无需为了迎合旧表偷偷改成cognitive。
- PrototypeAssessmentInput 仅 `interest_primary` 必填；learning_style默认 `open`，personality_preference默认 `either`。文档示例gentle不是当前必填值，也没有当前人格enum。可不发送尚未取得的性格偏好，不应人为编造gentle。字段省略/default适用性仍以实际接口和业务行为核验。
- /profile 的 required 是 profile_id/ca_account_id/assessment_id/assessment_time/learning_style，profile_version默认v1。兴趣为string≤32/null，不是schema枚举；8分均允许number/string/null，在线schema未声明0–100数值上下限。**正式原始分0–100是文档业务语义，当前schema宽松不意味着可传3–15观察分冒充专业分。**
- 两条POST路径虽都在在线OpenAPI中存在，不能证明Prototype模式下正式profile写入开放；没有进行写请求。Prototype Cookie参数是dingdong_ca_session，而正式profile有X-API-Key header，不能混同鉴权。
- 取舍原则：原DOCX记录原始设计与字段语义；旧code表记录9/22约定；当前在线schema作为10/1实时接口字段/enum证据。冲突显式列出并询问对方当前业务语义，不把历史规则或未实测写操作当最新事实。

## 7. 分工

我方开发：资料包预览/受控导出、来源和版本、权限审计；合同确定后建立提交/状态/错误与幂等机制，保留家长无需机器人也能完成CA体验。

CA业务：确认当前探索/观察用途、专业算法是否存在；兴趣与学习风格映射与并列规则、演示选例、允许发送范围。不能让开发凭名称猜分数或人格。

DingDong开发：明确Prototype接收渠道（网页人工/新增服务接口）、正式profile可用性与null行为、人格枚举、共享覆盖语义、真实账户与设备规则、幂等回查；其Mock生成逻辑不可冒充CA正式分。
