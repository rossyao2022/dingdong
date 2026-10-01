# 家长机器人报告与展会体验契约

## 1. Scope / Trigger

2026-10-01用户确认：保留登录→儿童建档→CA探索及现有导航；已绑定用户直接看完整机器人报告，未绑定用户独立使用CA功能，展会是可选入口。不按机器人内部类型给家长增加分类。

## 2. Signatures

- `GET /api/v1/runtime` 增加 `exhibition_enabled:boolean`、`exhibition_chat_url:string|null`。
- `GET /api/v1/exhibition/report?weekly_turns=7`：认证家长读取白名单共享Mock，非儿童个人报告。
- `POST /api/v1/exhibition/visits {event,request_id}`：`entered|report_viewed`与UUID；响应id/first_entered_at/last_entered_at/last_report_viewed_at。
- `CaAccount.chat_url:string|null`：有效绑定且当前配置允许时提供，独立于报告网络成功与否。
- 新表 `ExhibitionVisitor`（用户唯一、跟进修订）、`ExhibitionVisit`（用户记录+request_id唯一、保存重放响应），迁移0017。
- `/ops/exhibition/` 列表、`/ops/exhibition/{uuid}/` GET/POST跟进；`revision/status/note`，CSRF、角色与审计。

## 3. Contracts

- 展会启用沿用APP_ENV=demo与DINGDONG_PROTOTYPE_DEMO_ENABLED；其API不创建CaAccount、ReportVersion或伪造个人授权。前端仍执行儿童建档guard。
- 个人机器人报告保留owned-child、active/bound、有效dingdong_sync授权，并在供应商响应后再次校验。
- reports先渲染个人CA内容，报告Promise后台补读，仅当前tick/child可更新唯一机器人slot。首次boot的appReady不等待独立供应商请求；补读不能重建CA区域或收起已展开问卷。
- 切换/新建儿童清理机器人hints；换机总是刷新目标儿童账户并按child过滤，提交前再验归属，不能复用另一儿童缓存归档。
- 完整报告默认展开；横轴按day/180比例，标签错层；频率属于模拟趋势，不是机器人配置。保持数据含义，缺值不补0、不生成能力结论。
- 展会进入与成功报告渲染后异步记录；记录失败不能阻断体验。当前浏览器记录并非供应商真实聊天证明或购买意向。
- 聊天仅服务端配置的安全http(s)地址，拒绝用户信息、query、fragment；不附带JWT/手机号/NFC。不承诺SSO或个人聊天隔离。
- 运营与technical/account_admin可查看跟进，content拒绝；普通跟进不自动发消息。体验时间更新不使运营正在编辑的revision失效。

## 4. Validation & Error Matrix

| 输入/状态 | 行为 |
| --- | --- |
| 匿名展会API | 401 |
| 关闭演示或非demo | 展会API404，URL不下发 |
| 未建档访问展会页面 | 保留建档流程 |
| 未绑定查看个人报告页 | CA结果正常，不发个人机器人报告请求 |
| 报告读取错误/超时 | 仅机器人块提示重试，CA/聊天可用，启动看门不覆盖 |
| 已绑定未授权 | 局部同意入口，不误报未绑定 |
| 切儿童/解绑/撤权 | 旧报告不再出现，已有CA历史保留 |
| 访客相同request_id/event | 200重放；首次201 |
| 相同key不同event/旧ops修订 | 409且不覆盖 |
| 非法事件/额外phone/无效频率 | 422 |
| 运营无CSRF/content角色 | 403 |

## 5. Good / Base / Bad Cases

Good：先建档完成CA问卷，经Worker生成报告；任选展会预览但个人报告仍只有自己的结果。已绑定完整报告直接可见，聊天在我的DingDong。

Base：报告慢5秒，个人结果先显示、问卷展开保持；延迟25秒越过启动看门期限，页面仍可操作。

Bad：用ExternalAssociation伪造绑定；把模拟曲线当真实半年记录；切B后使用A的缓存换机；访问GET就认定购买意向；仅HTTP201即称推送已处理。

## 6. Tests Required

- HTTP鉴权/源数据校验/同频率回退；无个人绑定写入；访客跨用户幂等/并发；ops角色/CSRF/修订/审计。
- Chrome登录建档/原导航、完整展会报告、绑定403授权→报告、换儿童/解绑与换机缓存隔离。
- 本地供应商真实HTTP延时输入测试首次恢复登录appReady、CA早显、局部补读、详情展开保留及20秒超时。
- 真实22题→submit→独立Worker→个人CA报告；既有岛屿/八维/指纹/活动/导出/旧缓存。
- 窄屏、完整报告和ops表单截图；合成输入明确标注，不能替代生产真实供应商自动投递或实体NFC。

## 7. Wrong vs Correct

Wrong：供应商请求后台等待期间bootReady仍未完成，启动看门覆盖已显示CA；或晚响应整页重绘丢失操作。

Correct：首屏完成就resolve，独立Promise只替换当前儿童机器人slot，维持页面已展开状态。

## 2026-10-01 v0.3.25：独立CA主线与体验记录

首页主动作依据当前儿童持久化记录：进行中活动优先，接未完成探索，再首次兴趣探索，完成兴趣后选现有活动。继续入口直接打开未完成题；活动结束的旅程页保留下一步。统一时间记录，真实题名/状态/完成时间，答卷和关联报告去重；22题按原回答回看，不新造综合报告。

机器人报告首读cached=1；显式刷新和周期切换使用局部按钮忙碌，绝不占全局act或锁儿童切换。epoch、child、readTicket一起保护晚返回。网络/502/503可显示同周期stale快照；401退出，403/404/409清除旧机器人内容。未绑定只显示CA记录，保留自愿展会体验入口。

## 2026-10-01：绑定状态与入口可见性

当前儿童的active/bound账号是入口判断的唯一来源；报告是否成功、有无数据或查看授权不替代绑定状态。我的DingDong、测评与报告、直接展会URL和账户操作统一使用同一纯状态规则。

| 当前儿童状态 | 展示 | 隐藏 |
| --- | --- | --- |
| 已绑定 | 个人机器人报告、配置的安全聊天入口、管理/换机/解绑；CA功能保留 | 所有展会体验入口，直接展会URL回个人报告 |
| 未绑定（包括只有归档或其他儿童账号） | CA功能、绑定、开启时的可选展会体验 | 机器人管理/换机/解绑及个人机器人报告 |
| 待接通 | CA功能、继续连接/取消未完成连接、开启时展会体验 | 已绑定报告/聊天/管理/换机/解绑标签 |
| 读取失败或未知状态 | 白话重试，CA内容仍可用 | 不猜未绑，不给绑定/展会/管理快捷入口 |

切儿童、取消连接、解绑后重新读取账号并更新入口；旧展会书签不能让已绑定用户误入共享演示页。管理动作再核对当前儿童绑定，取消连接只允许当前儿童待接通账号。测试需覆盖状态矩阵和真实Chrome转换，不拦截业务响应，不把本地合成bound写入当作供应商握手。

## 2026-10-01：统一确认组件

家长应用确认使用ui-components.confirmDialog，不调用浏览器window.confirm/alert/prompt；运营Ops.confirm/alert/prompt本身是现有dialog组件。确认默认焦点在取消，关闭/Esc/离页/换儿童/退出一律取消；Promise单次收尾、清节点和事件，按钮用局部data-confirm-choice，不能受全局busy分发阻塞。

组合调整先生成候选值，接受且context/session仍相同才应用；取消期间原地图/回答不提前清空。开始新探索才建新session，历史结果保留。Chrome真实API验证取消/Esc/确认、切上下文、嵌套弹窗和焦点；原生dialog事件为0。窄屏机器人入口单列，完整按钮文案不碎字。

## 2026-10-01：供应商天赋陪伴空间入口

1. **Scope / Trigger**：供应商固定 `ca_dingdong` 原型变更，CA 只适配现有入口与配置，不改产品主线或报告更新策略。
2. **Signatures**：四处入口共用 `COMPANION_ENTRY_LABEL="进入 DINGDONG 天赋陪伴空间"`；既有 `chat_url` / `exhibition_chat_url` / `prototype_url` 字段不变。
3. **Contracts**：`DINGDONG_PROTOTYPE_WEB_URL` 默认 `https://www.dingdongrobo.top/dingdong/companion/main`，保留安全显式覆盖与 demo gate。普通新标签、noopener/noreferrer；不传手机号、CA Cookie、JWT、NFC 或 launch code，不用 iframe。供应商负责其共享会话，不能描述成个人 SSO。GET insights 固定号、后台 key、默认7和四频率/cached-first/manual-refresh不改。
4. **Validation / Error Matrix**：非demo或开关关→不下发入口；带userinfo/query/fragment→拒绝；未绑/pending/unknown→不显示已绑个人入口；报告读取失败不影响合法入口。直接进程显式空URL继续原API-base回退；Compose空值采用默认，显式非空覆盖不被更换。
5. **Good / Base / Bad**：完整HTTPS companion路径为本次标准；安全自定义覆盖仍可用；旧生产配置不会因默认修改自动更新，不可声称生产完成。
6. **Tests Required**：确切标签/路径/target/rel与状态矩阵；默认/空/显式覆盖；实际传输GET、两个query、X-API-Key且无Cookie/Authorization/body；390px长标签与报告回归。源码检查、组件浏览器、认证全栈和供应商测试分别报告。
7. **Wrong vs Correct**：错误是把API根地址、launch code或家庭字段拼入入口；正确是直接使用服务端允许的完整公开URL，仅后台请求携带约定API key。
