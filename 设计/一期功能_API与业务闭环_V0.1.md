# 一期功能、API 与业务闭环 V0.1

> 文档状态：历史设计基线，保留当时的建议与判断，不能把下文“当前/尚未实现”当作现状。2026-09-12 已有 M1–M5 实现；当前入口见 [文档索引与当前状态](../文档/文档索引.md)，实际字段见 [模型字段清单](数据库实际字段_M5.md)。外部供应商尚未接入。

> 请求响应已进一步细化，冲突时以[前后端交互规范](/Users/yihu/Documents/ChatGPT/叮咚/设计/API/前后端交互规范_V0.1.md)与 OpenAPI 为准。当前短信固定 `00000`，其他 API 用真实数据库及初始化/注入数据测试。

本轮为设计评估，不是已实现或已联调结论。已重新 fetch 参考仓库，origin/main 为 `d754a5bf9ea8e71ca64a850d2e26aa321fe8ab38`，仍为 V3 演示代码。以下前端指家长/儿童使用的 Web，后台管理指工作人员使用的 Django Admin，CA 后端指支撑两者的业务服务。

结论：当前代码、字段与 API 还没有形成真实闭环。补齐网页活动记录后，CA 自有功能可按本设计形成完整流程；真实初始测评依赖甲方算法，机器人归属与同步依赖 DingDong，阶段评分还依赖更新规则。不能仅凭建好接口就宣称整体闭环。

## 1 一期产品范围

主流程：家长短信登录→建立儿童档案→阅读并同意本次测评用途→正式问卷＋五枚指纹一次性处理→初始画像与报告→网页小行动与记录；另一路经可靠核验关联 DingDong→同意同步用途→CA 主动获取行为数据→行为观察→按明确规则更新阶段画像→阶段报告。

网页小行动是自报活动，不是机器人下发任务。DingDong 自身成长值与 CA 对儿童的画像维度分别展示；没有明确映射规则不能混为同一个分数。孩子档案不采集年级。姓名/称呼、可选性别与出生信息依据数据库设计，出生精度仍待算法确认。

建议保留参考代码已有的网页活动体验，作为一期产品内容；两张简单业务表即可承接，不增加游戏货币、任务下发、通知平台或推荐算法系统。这是本轮迁移建议，原有演示活动文案仍需内容方确认后发布。

## 2 一期后台管理：五个入口

| 菜单 | 一期可做的功能 | 对应数据 | 角色 |
| --- | --- | --- | --- |
| 家庭档案 | 查询家庭与儿童基本信息、授权状态、外部关联状态；受控修正档案；登记服务问题 | user/family/child/consent/association/data_request | 运营支持；修正走对象校验与日志 |
| 测评与报告 | 查答题/算法进度、失败原因、初始与阶段报告状态；查询网页活动完成记录；重试符合条件的报告生成 | assessment/attempt/profile/report/activity_record/job | 运营看摘要，技术处理失败 |
| 数据同步 | 查关联、最后成功时间、窗口、错误；暂停/恢复同步；允许范围内重新拉取；查看任务尝试 | checkpoint/observation/job/job_attempt | 技术运维；运营仅状态 |
| 内容与规则 | 题库、报告模板、网页活动内容、已明确评分规则的草稿/发布/停用 | questionnaire/template/activity_content/rule | 内容负责人 |
| 系统管理 | 工作人员创建/停用与固定角色、必要操作记录、简单服务与删除处理事项 | user/groups/audit/data_request | 账号管理员或相应业务角色 |

不开放：任意改评分、直接把设备标记为已验证、修改上游原数据、指纹查看/下载、通用文件库、部门岗位体系、机器人远程控制和消息推送。技术运维不默认读完整儿童报告；运营查询活动默认只看时间/状态，不自动获得自由文本备注读取权。

内部 UI 复用 Admin 的列表、表单和 Session＋CSRF，不为每张表再写一套管理 REST CRUD。发布、重试、停止同步和数据处理使用专用 POST 动作，调用与 API/worker 相同的业务服务；查看菜单不等于拥有动作权限。

## 3 前端哪些搬过来，哪些需要改

| 参考代码功能 | 一期处理 | 迁移范围及后端依赖 |
| --- | --- | --- |
| 兴趣岛 explore | 保留 | SVG、动画、选岛交互可复用；岛与活动对应关系从发布内容加载；选岛不自动形成能力结论 |
| 今日陪伴 home | 保留并接数据 | 当日心情只作本次筛选，活动卡片来自内容 API；完成数与进行中活动从服务端获取 |
| 分步活动、反馈、跳过 | 保留并正式存储 | 页面交互可复用；活动版本、步骤进度、完成/跳过、感受、短备注写 activity_record |
| 成长旅程 journey | 保留 | 改为按当前 child 查询云端网页记录；与 DingDong 观察分来源展示；不把本地演示条数迁为正式记录 |
| 我的 DingDong companion | 缩减 | 保留网页形象、引导方式和浏览器朗读；引导选择只是网页选项，不同步机器人配置 |
| 4 题偏好体验 | 替换 | 正式题库 API、动态题量与选项 code；不能把现有 4 题统计当初始画像；不保留两个含混的正式测评入口 |
| 指纹小宇宙 fingerprint | 重做业务流程，复用采集能力 | 复用相机/本地预览/清理；增加正式槽位、质量提示、一次性提交和失败重采；删除以手动选纹型代替算法的正式路径 |
| 家长观察 reports | 保留布局，重写取数 | 分别读取初始报告、行为观察、阶段报告与趋势；缺失/未授权/同步失败分别展示，不填 0 |
| 账户与设备 settings | 重做数据交互 | 增加真实短信登录/退出、儿童档案、授权和核验关联；去掉设备个性化配置与机器人提醒开关 |
| 盲盒 | 保留为纯交互 | 从允许展示的活动中换一个，无奖品、账户余额、抽奖记录表或独立 API |
| services 家长支持 | 保留静态内容 | 陪伴建议和 CA 介绍链接，无咨询预约/付费 API；服务事项可从设置入口提交 |
| 导出/清空本地演示数据 | 一期移除正式入口 | 不把本地 reset 当删除云端数据；提供简单数据处理请求入口。批量下载功能延后，不建设通用导出系统 |
| 成长提醒 | 暂缓 | 不保留会暗示机器人已能提醒的开关；网页只显示进行中活动和处理结果状态 |

可复用：HTML/CSS/素材、响应式布局、对话框、岛屿动画、浏览器朗读、相机生命周期管理。必须迁入后端：账号、家庭归属、授权、题库版本、问卷保存、正式结果、同步、报告、网页活动记录。临时 UI 选择保留前端即可，无需所有按钮都配 API。

现有 localStorage 的 profile/answers/records 不可信且属于 demo，不自动上传到正式账号。登录新账号、切换孩子和退出时清理旧页面数据与内存图片，重新按 child_id 拉取。若保留演示入口，必须隔离存储命名空间，正式 API 不接受 environment=demo 作为真实结果来源。

## 4 API 通用约定

下列 `/api/v1/` 路径均为拟设计的 **Web→CA** 接口，并非现有已部署接口，更不是已确认的 DingDong 路径。

- 家长业务 API 使用 Bearer access JWT；登录/刷新/退出按现有 Cookie、CSRF 和来源校验设计。每次校验有效账号、登录授权及对象归属。匿名只开放发送短信、登录和必要的公共授权说明。
- 详情直接返回对象；分页返回 `{items,next_cursor}`；错误返回 `{code,message,field_errors?,trace_id}`。401 重新认证，403 权限/用途不足，404 对象不存在或不属于本家庭，409 状态/版本冲突，422 字段不合法，429 限频，503 外部服务不可用。
- 标识使用 UUID；时间 ISO8601 带时区。列表限制 page_size。创建资源通常 201；异步业务任务返回 202＋job_id；取消/撤回返回最新状态。pending/unknown 不返回假成功。
- 所有创建/提交关键动作使用 request_id 或 Idempotency-Key。相同键重复请求返回同一资源/执行状态；不同内容复用同键返回冲突。图片仅按 session＋request_id 识别重复，不存图片哈希；同请求号不承诺判断两份图片内容相同，新的采集必须用新的请求号。
- 输出显式列字段，禁止通用 ModelSerializer 暴露整个用户、问卷、日志或供应商 JSON。API 文档中的 child_id 是请求目标，实际 owner 从当前用户确定。

## 5 家长端 API 清单

### 5.1 登录、儿童与用途授权

| 方法与路径 | 请求主要字段 | 返回主要字段 | 表/逻辑 |
| --- | --- | --- | --- |
| POST /auth/sms | phone | challenge_id, expires_in, retry_after | sms_challenge；规范化号码、限频、短信供应商 |
| POST /auth/login | challenge_id, code | access_token, expires_in, user{id}；refresh Cookie | 原子消费验证码、user/family/membership/login_grant |
| POST /auth/refresh | refresh Cookie | access_token, expires_in；轮换 Cookie | 锁 login_grant、固定总有效期 |
| POST /auth/logout | refresh Cookie/当前授权 | 204，清除 Cookie | 撤销本次 grant；重复退出幂等 |
| GET /me | 无 | id, phone_masked, family_id | 当前身份，不返回密码或令牌记录 |
| GET /children | 无 | items[id,name,gender,birth_date,status] | 当前家庭 children |
| POST /children | request_id,name,gender?,birth_date? | child | 服务端设置 family_id；唯一创建键，见补充字段 |
| PATCH /children/{id} | name?,gender?,birth_date? | child | 白名单修改、归属校验，不支持修改 family_id/年级 |
| GET /policies/current?purpose=… | 用途 | id,purpose,version,body | 当前已发布 policy_version |
| GET /children/{id}/consents | 无 | items[id,purpose,policy_version_id,granted_at,revoked_at] | 同用途当前授权及必要状态 |
| POST /children/{id}/consents | request_id,policy_version_id | consent | 父母归属、版本和用途检查；不由客户端设置 granted_by |
| POST /consents/{id}/revoke | 无 | id,purpose,revoked_at | 停止新处理，执行前/保存前再次检查；重复调用幂等 |

建立档案不需要先有机器人；测评与同步用途分别同意。若没有当前授权说明或正式问卷，相关功能返回配置未就绪状态，不能用“默认勾选同意”绕过。

### 5.2 正式测评与一次性图片

| 方法与路径 | 请求主要字段 | 返回主要字段 | 表/逻辑 |
| --- | --- | --- | --- |
| GET /assessment-config | 无 | available,reason?,questionnaire_version_id,questions,input_requirements | 当前发布题库＋算法接入配置；指纹槽位/大小/格式不得由演示推定 |
| POST /children/{id}/assessments | request_id,questionnaire_version_id,consent_grant_id | session_id,status,revision | assessment_session；固定题库和输入年龄口径 |
| GET /assessments/{id} | 无 | id,child_id,status,revision,questions,answers,attempt_status,profile_id?,report_id? | 取本会话固定题库，支持恢复问卷；绝不返回旧图片 |
| PATCH /assessments/{id}/answers | revision,answers | revision,status,missing_question_codes | 乐观锁、按题码校验；不返回正式评分 |
| POST /assessments/{id}/submit | multipart: request_id,revision,files[slot_code] | status,attempt_id,profile_id?,report_status | 正式问卷完整＋输入槽位完整；有界内存调用甲方算法，写 attempt 和允许结果 |
| POST /assessments/{id}/cancel | 无 | status | 取消会话，前端释放图片，迟到响应不再入结果 |

submit 不是把图片加入队列：请求内完成算法处理；算法已成功而报告尚未生成可返回 report_status=processing。外部调用超时返回 result_unknown 或 needs_recapture，前端用 GET 查询安全状态，不自动重新上传。不支持查询结果的供应商需要重新采集；算法 unknown 尝试必须先关闭/核实后再创建新调用。

五个槽位的具体手指、清晰度、单图/总量限制和返回结构待甲方确认。input_requirements 是服务端受控配置，不包含供应商密钥。只有确认处理链路不留存后才开放 submit；不能为实现“稍后继续”保存图片。

### 5.3 网页活动与成长记录（本轮补齐）

| 方法与路径 | 请求主要字段 | 返回主要字段 | 表/逻辑 |
| --- | --- | --- | --- |
| GET /activities?island=…&mood=… | 可选筛选 | items[id,code,version,title,island,mood,duration,steps,guidance] | 已发布 activity_content_version；小规模直接返回完整内容，无推荐服务 |
| POST /children/{id}/activity-records | request_id,activity_version_id,mode,style | id,status,step_index,revision,started_at | 创建自报活动记录，服务端开始时间；同一孩子至多一条进行中 |
| GET /children/{id}/activity-records?status=… | 筛选/分页 | items,next_cursor,completed_count,active_days | 当前孩子记录；统计按同样筛选口径，Asia/Shanghai 日期去重 |
| GET /activity-records/{id} | 无 | record＋固定活动内容 | 继续旧版本活动；原内容停用也不改变已有内容 |
| PATCH /activity-records/{id} | revision,step_index | revision,step_index,status | 保存步骤；只有进行中可修改，范围按固定内容校验 |
| POST /activity-records/{id}/finish | status=completed/skipped,feedback?,note? | 完成记录 | 条件更新一次完成；相同终态重复调用返回原结果，不重复计数 |

note 限制 160 字，与现有体验一致；不主动收集无关资料。mode/style 仅影响网页引导，不得当作算法测评结论。活动跨设备进度由云端记录恢复；切换任务先明确结束/跳过旧活动，再开启新活动。

### 5.4 机器人关联与数据观察

| 方法与路径 | 请求主要字段 | 返回主要字段 | 表/逻辑 |
| --- | --- | --- | --- |
| POST /children/{id}/associations/verify | request_id,consent_grant_id,entry_proof（待定） | association_id,status,reason? | CA 通过已确认的核验方案验证上游数据主体；不能自报 verified |
| GET /children/{id}/associations | 无 | items[id,provider,status,verified_at,last_success_at,sync_status] | association＋checkpoint |
| POST /associations/{id}/revoke | 无 | status,ended_at | CA 本地解除关联并停同步；如上游要求解绑，再按确认协议处理，不伪报上游已解绑 |
| GET /children/{id}/observations?from=…&to=… | 时间窗口 | availability,window,updated_at,source,metrics,schema_version | 只读取已保存的规范化批次，非浏览器直调 DingDong |
| GET /children/{id}/growth-overview?from=…&to=… | 时间窗口 | web_activity_summary,robot_observation,initial_profile,stage_status,latest_reports | 拼装已有表，不增加总览表 |

NFC 是入口，不代表归属证明。entry_proof 是临时接口占位名称：可能是一次性核验码或授权交换结果，不得把它当已确认的 nfc_token 协议。入口凭证在前端短暂内存使用，避免写长期存储或请求日志。没有已确认验证方式时 verify 返回 integration_not_ready，不能创建 verified 记录。

观察 availability 明确区分 unbound/no_consent/not_synced/no_data/ready/stale/error；保留 last_success_at 和必要失败信息，不用 0 代替缺失。旧值可展示但必须标明时间和同步失败。十五/三十天若保留为页面筛选，只是候选展示窗口；服务端返回支持的窗口，不能据此默认正式回测周期。

### 5.5 画像、报告与服务事项

| 方法与路径 | 请求主要字段 | 返回主要字段 | 表/逻辑 |
| --- | --- | --- | --- |
| GET /children/{id}/profiles?kind=… | 类型/分页 | items[id,kind,result,produced_at,window,schema_version] | profile_snapshot；DingDong 指标不混入 initial |
| GET /children/{id}/reports | 分页/类型 | items[id,profile_id,kind,window,generated_at],next_cursor | 仅已生成报告；处理状态从总览/session 获取 |
| GET /reports/{id} | 无 | id,content,profile_id,template_version,generated_at,source_summary | report_version 和明确来源，按 child 归属过滤 |
| POST /children/{id}/data-requests | request_id,kind,reason_code | id,status | 简单服务记录，无多级审批 |
| GET /children/{id}/data-requests | 分页 | items[id,kind,status,resolution_code,completed_at] | 查询自己提交事项的实际处理结果 |

不让家长直接指定分数或调用任意“重算全部画像”。初始报告由初始结果成功自动触发；阶段报告由同步与已发布规则触发；后台只能重试条件满足的任务。没有规则时 stage_status=waiting_rule，不能通过显示模板文字伪装成评分完成。

趋势先不单独增加 CA API：在 growth-overview 中按兼容来源返回比较结果；没有同维度、同单位、兼容规则/版本和可比窗口则给 unavailable_reason。不同算法版本不能不经确认直接相减。以业务层推导状态为主，不为了每个前端提示增加一张表。

## 6 工作人员操作接口

以 Admin 自带 GET 列表/详情/表单为主，路径最终由 Admin 注册确定。以下是动作能力，不要求现在固定为一套 `/admin-api/`。

| 动作 | 必要输入 | 检查与返回 |
| --- | --- | --- |
| 发布题库/活动/模板/规则 | 版本 ID | 内容角色、合法 Schema、必需配置；事务内发布，旧版本保留 |
| 重试任务 | job_id | 技术角色、可重试状态、授权/归属有效、无重复执行；返回 job 状态 |
| 暂停/恢复同步 | association_id | verified、授权有效；paused/enabled，恢复不绕过外部限额 |
| 修正儿童基本资料 | child_id、允许字段 | 运营操作权限与对象范围；记录变更字段名称，不整份复制个人资料 |
| 完成服务/删除事项 | request_id、操作类型 | 身份归属与实际处理条件；执行成功后更新状态，不能只切状态 |
| 管理工作人员 | staff_id、固定角色/启停 | 账号管理员；无自提权或随意赋 superuser；停用同步撤销登录 |

不暴露数据库表任意修改接口，避免后台直接把问卷标记完成、改算法结果、前移同步游标或冒认机器人回执。

## 7 真实外部 API：哪些确定、哪些未定

### A 短信供应商

CA→短信服务：发送验证码，输入手机号、模板及验证码，输出发送受理状态/请求号/错误码。供应商未选定，HTTP 路径、签名和错误码待定；不要求建设短信送达回调，验证码实际验证为登录成功依据。发送受理不等于手机已收到。

### B 甲方初始测评算法

CA→算法：必要儿童年龄等非生物输入、固定问卷版本及答案、五枚图片/槽位、request_id；算法→CA：明确成功/失败状态、algorithm_version、结果 schema_version、可保存的非生物业务结果。图片仅本次内存传递；供应商无留存约定、输入样例、输出字段、时限和错误语义必须确认。可选按 request_id 查询处理状态，不默认假定支持。

阶段规则可能是甲方提供的本地规则，也可能是外部 API，目前不能预先确定路径和协议。必须明确它如何使用初始结果、行为指标、时间窗口及缺失值，才能形成 CA 阶段画像。

### C DingDong 数据服务

现有材料/API 代码列出以下候选定义，**仅为 CA 侧草案，不是上游已确认接口**：

| 草案路径 | 能力 | 目前问题 |
| --- | --- | --- |
| POST /api/v1/ca/account/bind | NFC/账户绑定 | ca_account_id 对应家长还是儿童？nfc_token 能否证明归属？一期是否需要 CA 调用绑定协议尚未确认 |
| POST /api/v1/ca/account/unbind | 上游解绑 | 本地撤回与上游解绑的责任、失败处理未定 |
| GET /api/v1/ca/growth/profile | 机器人阶段数值 | scores 的结构、维度、单位、版本、窗口与数据主体未确认 |
| GET /api/v1/ca/growth/summary | 行为统计 | 文档 task_count 与 task_completed_count 有命名差异；计数范围、去重和空值语义待定 |
| GET /api/v1/ca/growth/trend | 趋势 | 当前/上期是否可比、算法变更处理与时间边界待定；若原始快照足够，可不对接此接口 |

数据获取最终使用 GET 还是 POST，由 DingDong 协议决定。均由 CA 后端发起，不允许前端拿供应商密钥，不增加供 DingDong 调用的 CA 入站业务接口。绑定/解绑如果要向上游交换身份，须明确契约，只发送核验必要标识，不能借此下发儿童画像、偏好或任务。

三份成长数据若分接口返回，必须有共同窗口和快照版本，或能证明它们可共同引用；不能把不同时刻的 profile/summary/trend 拼成同一份确定报告。缺少版本时只能显示单项时间和状态，不能假定跨响应一致。

## 8 现有字段能否闭环：缺口与补齐

| 发现 | 影响 | 本轮处理/待办 |
| --- | --- | --- |
| 没有网页活动内容与记录表 | task/start/finish/journey 无法跨设备，成长足迹仍是演示 | 补 activity_content_version、activity_record 两表，补生命周期 API |
| 前端 age 是年龄段、昵称限 12 字；数据库 name 80 字、birth_date | 直接字段映射会错，无法固定算法年龄 | name 前后端统一 80 字；出生信息按算法契约，旧年龄段不迁成生日 |
| child/授权/处理事项的创建幂等缺字段 | 网络重试可能重复创建 | 增加 created_by/request_id 或 create_request_key，见数据库补充 |
| 同步接口草案以 ca_account_id 查询，数据库按 child 归属 | 多孩子或共享设备可能串档 | 上游必须说明儿童级身份；家长 ID 与设备别名不能直接替代 child |
| 图片演示只有单图＋手选纹型 | 不具备正式五图算法输入 | 复用相机能力，重写正式采集与 submit；不得保存图片填补恢复缺口 |
| 初始算法和成长规则未明确 | 无法形成真实初始/阶段评分 | 分别确认，不用前端偏好统计或机器人成长值代替 |
| 多个来源分数语义不同 | 易出现完成活动就涨分的假闭环 | source/schema/version/window 分开，网页记录不默认进入评分 |
| 偏好/提醒开关暗示向设备传数据 | 违反一期单向获取边界 | 删除设备配置与提醒，只保留网页引导选项 |
| 报告表只有成功内容，页面需要知道等待/失败 | 空白无法解释 | 总览/session 联查任务状态，无需再建报告草稿状态表 |
| 原导出/reset 仅作用浏览器 | 用户误以为云端已删除或已完整导出 | 正式版移除，提供简单处理事项及结果查询 |

网页活动记录默认用于时间线和网页自报统计，不进入正式阶段评分。若甲方未来明确将其纳入规则，必须增加画像对 activity_record 的来源关联及相应任务固定输入；本轮不提前实现未知评分公式。

## 9 闭环评估与验收

| 业务链 | 设计能否闭环 | 还缺什么 | 最小验收 |
| --- | --- | --- | --- |
| 登录→儿童→再次登录读取 | 可以 | 短信供应商接入和代码实现 | 重复验证码拒绝、两个家庭隔离、跨设备同档案 |
| 活动→开始→步骤→完成/跳过→足迹 | 补两表后可以 | 内容方确认活动、实现 API | 断网恢复、重复完成不重复计数、活动版本稳定 |
| 问卷→五图→初始画像→初始报告 | 条件闭环 | 正式题库、年龄要求、算法输入输出、无留存处理契约 | 真正算法输入/输出可回放非图片元信息；失败不落图，成功有报告 |
| 关联→授权→同步→行为观察 | 条件闭环 | 上游核验、儿童身份、字段与分页/窗口语义 | 无授权不取数、重复不累加、失败不前移进度、解绑停止 |
| 行为观察→阶段评分→报告→可比变化 | 尚不能确认完整闭环 | 更新规则责任、基线/指标映射、版本兼容和缺失值规则 | 可解释每份报告来源，缺规则不出假分数，修订生成新版本 |
| 后台改内容→发布→前端新会话生效 | 可以 | 内容配置和发布实现 | 新会话用新版本，旧会话/报告保持旧依据 |
| 撤回/停用/删除→停止处理→查询结果 | 可以按简单流程实现 | 实际删除范围与执行实现 | 撤回并发时不写新结果，重复请求幂等，完成状态有实际结果 |

建议开发顺序：账号/儿童＋固定权限→网页活动与内容发布→问卷与模拟算法状态流→正式算法→DingDong 核验和行为同步→明确规则后的阶段画像与报告。模拟联通只证明内部协议可用，不等于甲方真实算法或 DingDong 联调通过。

上线前端不能保留“已关联”“已测评”“已同步”的固定演示文案；必须由返回状态驱动。API 返回一个 200、数据库有一行、页面显示一个数值，这三件事本身不能证明业务闭环；必须验证归属、输入版本、真实结果来源及失败恢复。

## 10 本轮材料依据

- [参考仓库说明](/Users/yihu/Documents/ChatGPT/叮咚/参考代码/dingdong/README.md)
- [页面与本地业务逻辑](/Users/yihu/Documents/ChatGPT/叮咚/参考代码/dingdong/app.js:52)
- [API 占位代码](/Users/yihu/Documents/ChatGPT/叮咚/参考代码/dingdong/api.js:4)
- [DingDong CA 侧接口草案](/Users/yihu/Documents/ChatGPT/叮咚/材料/可检索文本/DingDong_CA_接口协议与字段定义_CA侧.md)
- [数据库设计（含本轮补充）](/Users/yihu/Documents/ChatGPT/叮咚/设计/数据库表结构_V0.1.md)
- [后台总体设计](/Users/yihu/Documents/ChatGPT/叮咚/设计/后台总体设计_V0.2.md)
