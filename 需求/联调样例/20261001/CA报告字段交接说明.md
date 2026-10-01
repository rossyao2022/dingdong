# CA 报告字段交接说明

2026-10-01，供双方核对。**样例/方案，不是已上线的提交接口**；本轮没有给对方发消息、发送画像或改共享演示状态。

## 建议随样例发给对方的说明

我们现在 CA 端已经有兴趣探索、八维日常观察和问卷回答记录。这次给你们一份结构化样例，字段里带了完成时间、题库/计分版本、原始范围和缺失说明，方便对照你们需要的内容。样例是合成数据，计算用当前代码，不是真实儿童资料。

需要先对齐两点：我们的兴趣是 RIASEC 六岛中的所选三类、分数 0–4；八维日常观察是每维 3–15，不是你们 /profile 文档里的专业 0–100 分，所以这里没有直接转换或填造分数。学习方式和兴趣到你们 code 的映射也需要业务确认。

请帮忙按字段标出现在 Prototype 实际能接哪些。你们文档里的 Prototype 测评接口目前走网页 Session Cookie，只接兴趣、学习方式、性格偏好；如果要 CA 后端自动传，请给适合后端调用的鉴权/接口和应用回执，并确认更新会不会影响现有角色及共享演示记录。我们确认映射后再接，不会让每位游客完成问卷就自动改共用账号。

## 样例与对照

文件：[结构化合成样例](CA报告结构化样例_合成.json)。`ca-report-handoff-draft-v1` 是我们本次提出的资料包格式，不是对方现有接口 schema；`dingdong_mapping_review` 是核对信息，不应直接原样作为对方请求。原始答案用于本次合成结构说明，未来常规输出默认只含获准同步的结果字段。

| 我方当前输出 | 原始范围/性质 | 对方候选字段 | 当前是否可直接提交 |
| --- | --- | --- | --- |
| 各次 assessment_id、完成时间、题库版本 | 稳定本地记录、ISO 时间 | assessment_id、assessment_time；版本留交接记录 | 可以对照，绑定目标和协议确认后纳入 DTO |
| 所选 R/I/A/S/E/C 与喜欢程度 | 六选三、只测所选三类，均值 0–4 | interest_primary/secondary（art/science/engineering/philosophy/language/social） | 不可直接一一转换；需映射/缺值/并列规则 |
| word/music/logic/space/body/self/social/nature | 每维三题累计 3–15，日常观察 | linguistic/musical/logical/spatial/bodily/intrapersonal/interpersonal/naturalistic 的 *_score | 名称可对照，语义及量纲不等；不能当专业 0–100 分 |
| 四情境计数、手选网页方式 | cognitive/imitative/reverse/open 的选择/偏好 | learning_style | 不是已验证自动画像；CA imitative 与线上 imitation 别名、业务映射须确认（线上现已列 reverse，9月22日 code 表未列） |
| 性格偏好 | 当前没有专门输出 | personality_preference（Prototype 专用） | 需用户选择或业务另提供，不能用网页方式冒充 |
| 22 题报告 | 真实答案；当前专业结果 null | 正式八维专业原始分 | 当前无此专业结果；只能如实缺失 |
| 手机号/儿童称呼/生日/照片/NFC token/API key | 本次交接不需要 | 无 | 不包含 |

## 对应的家长结果示意（合成样例，非线上截图）

六岛兴趣探索 · 本次所选方向：动手、研究、艺术。

**这次的发现**：在这次选择的三个方向里，动手类回答的喜欢程度较高，研究类其次。这只表示本次回答，不代表已经确定孩子的能力或天赋。

**一起试试**：选择一个已发布的动手小活动。产品实施时须链接真实活动，目前这份示意不包含可执行入口。

**做完留个发现**：孩子喜欢吗？还愿意再试吗？可以留下一句话。

详情保留：本次合成数据中 R=3.6667、I=3.3333、A=2.3333（均值 0–4）；未选择的方向没有结果。八维观察另为一次记录，不合并成这次兴趣分，也不合成机器人成长分。

## 对方两份契约的区别

### 正式画像接口

`POST /api/v1/ca/profile`，X-API-Key，字段依据对方 Integration Guide 6.2：

- profile_id、ca_account_id、assessment_id、assessment_time、profile_version。
- learning_style：本轮只读线上 OpenAPI 为 cognitive/imitation/reverse/open；9月22日 code 表为 cognitive/imitative/open，需确认差异，不能只依据旧表。
- interest_primary、interest_secondary：对方六个类型 code 或按契约允许缺值。
- linguistic_score、logical_score、musical_score、spatial_score、bodily_score、intrapersonal_score、interpersonal_score、naturalistic_score：**专业原始 0–100/null**。

当前样例不能组成有效的正式请求，尤其必填学习风格和目标账号未确定。不得把全 null 结构宣称已可以发送或假造 profile_id 作为已存在的对方记录。

### Prototype 测评切换

`POST /api/v1/app/companion/prototype/assessment`，DingDong Prototype 网页 Session Cookie；interest_primary、learning_style、personality_preference。线上 schema 只必填 interest_primary，learning_style 默认 open、personality_preference 默认 either；默认不是测评结果。对方生成 Mock 八维，未接受 CA 原始八维分；与正式 /profile 不是同一提交通道。

## 请双方确认的内容

- DingDong：允许同步字段、当前实际枚举/null/必填、后端鉴权路径、幂等与应用回执、共享状态/重置影响。
- CA 业务：哪些是观察而非专业结论、兴趣和学习方式如何合法映射、专业评分是否有供应方，以及并列/缺失如何处理。
- 我方开发：据确认表生成正式 DTO 和可复制/下载预览；现阶段仅资料包核对，不发出请求。
