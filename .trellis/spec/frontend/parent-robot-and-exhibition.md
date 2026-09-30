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
