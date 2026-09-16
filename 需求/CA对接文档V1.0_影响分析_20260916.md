# CA 对接文档 V1.0 · 影响分析（2026-09-16）

> **本文为更正版。** 第一版把仓库误判为 DingDong 侧，把 8 个接口当成"我们要实现的 API"、把成长引擎与版本定义当成"我们的活"。经用户更正「**我们是 CA 侧**」并核对仓库证据后已重写。
>
> 判定依据：文档表 12 写「**CA Backend 请求头携带 `X-API-Key`**」、表 13 是「**CA 建议处理**」、表 14 是「**CA 开发验收清单**」、第 11 章是「**CA 侧最小实现范围**」；仓库侧 `ExternalAssociation.provider="dingdong"`、一期 P0-04「把允许共享的画像/评分发送给 DingDong」、前端是 CA 的 TalentRadar/CareerAcademy 血统。两侧一致。

---

## 0. 一句话结论

**我们是调用方与展示方，不是接口的提供方。** 文档里的 8 个 `/api/v1/ca/*` 是**我们要去调用的 DingDong 接口**；7 个实体是**对方的数据模型**（我们大部分只读）；`growth_v1` / `pw_v1` **由 DingDong 侧定义**，我们只消费、存储、展示。

因此真实的差距不是"要不要建这套 API"，而是我们这一侧缺四样东西：**一个带 `X-API-Key` 的 DingDong 客户端、一个稳定的 `ca_account_id`、NFC 入口承接、以及人设/成长/健康度/复测这四个展示与回写面。**

---

## 1. 本次到了什么

| 文件 | 字节 | SHA-256 |
| --- | ---: | --- |
| `材料/文档/DingDong_CA_系统开发文档.docx` | 221752 | `3a717c375245ddfac4a01a032e6ab2cdb3b08e8289c8c93ee9ea81c6dd030c48` |
| `材料/文档/DingDong_CA_数据库字段与接口.xlsx` | 20841 | `e759a91b91e2ef91d419812c6522250d9e17be7dfbc0f6fb60fa7ac756b02454` |

两份都是 **DingDong 出给 CA 的开发对接材料**（文档抬头「CA 开发对接版」，正文「本文档用于 CA 技术团队实现 DingDong 相关功能对接」）。已归档为可检索文本：[系统开发文档](../材料/可检索文本/DingDong_CA_系统开发文档.md)、[数据库字段与接口](../材料/可检索文本/DingDong_CA_数据库字段与接口.md)。

**与历史「未提供材料」清单的关系**：`材料清单.md` 记过三份引用未提供的文件（CA_DingDong_PRD_V2.0、DingDong 机器人对接文档 V1.0、联名 Web 与数据系统 PRD V1.0）。这两份**原名不同**，但内容上正是我们等的那份"对接文档"——它第一次给出了完整的接口契约、字段定义、Mock 数据与验收清单。是否等同上述《DingDong 机器人对接文档 V1.0》仍需向 DingDong 确认（见第 5 节 D1）。

两份**互补**：docx 是主协议（错误码表、HTTPS、幂等、CA 验收清单只在它里面）；xlsx 是落地（`companion_snapshot` 实体、80 字段类型、6 个 mock 账号、H01–H07 阈值只在它里面）。

---

## 2. 双方职责对照（文档表 0 / 表 1）

| 事项 | CA（我们）要做 | DingDong 要做 | 我们现状 |
| --- | --- | --- | --- |
| NFC 入口 | 提供可访问的 H5 路径并解析 `nfc_token` | 提供 NFC 入口 Token 及绑定解析 | ❌ **`nfc_token` 全仓零命中** |
| 账户身份 | 提供稳定 `ca_account_id` | 维护账户与 DingDong 关系映射 | ❌ 我们以 `child_id`(UUID) 为键，无账户级标识 |
| 首次/复测画像 | 生成并保存 CA 测评结果 | 读取画像进行人设匹配 | ⚠️ 有测评与画像（`ProfileSnapshot`），但字段口径与 `ca_user_profile` 不同；**且"对方怎么读到"没有通道** |
| 陪学人设 | 展示当前推荐人设 | 匹配并维护当前有效人设 | ❌ 无 persona 概念 |
| 成长报告 | 展示 15/30 天成长趋势 | 生成成长代理、陪伴变化和状态 | ⚠️ 我们自产 `growth.overview` + `ReportVersion`，与对方的 `growth_period` 是**两套东西** |
| 复测机制 | 承接复测页面、回写用户操作 | 判断是否建议复测并重新匹配人设 | ❌ 无复测建议/承接/回写 |

调用链路（文档表 1）：`NFC → 手机 → CA H5（读 nfc_token）→ CA Backend（取 ca_account_id）→ CA Backend --HTTPS/X-API-Key--> DingDong Data Service`。

---

## 3. 新契约对我们这一侧的要求，逐项落到仓库

### 3.1 已经有的（不用重做）

家长手机号登录 + JWT、儿童档案与家庭归属、问卷与测评会话、画像 `ProfileSnapshot`（不可变）、报告 `ReportVersion`、活动与观察数据、运营后台。这些正是"CA 测评"与"CA 网站"的主体，**不需要因为新契约推翻**。

### 3.2 缺口清单

| # | 缺口 | 证据 | 严重度 |
| --- | --- | --- | --- |
| G1 | **没有 DingDong 客户端**：`dingdong_ca` 里没有任何出站 HTTP 调用（无 `requests`/`httpx`/`urlopen`），也没有 `X-API-Key`、没有 `/api/v1/ca/*` 调用、没有 `{code,message,request_id}` 解析 | 全仓检索 | 阻塞 |
| G2 | **没有 `ca_account_id`**：我们需要"稳定的 CA 用户标识"，现在只有 `child_id` 与家长账号 | `config/urls.py` 全部以 `child_id` 为键 | 阻塞（它决定所有请求的参数） |
| G3 | **NFC 入口承接缺失**：`?nfc_token=` 的读取、保存与后续 `bind` 调用都没有 | `nfc_token` 零命中 | 阻塞 |
| G4 | **`ca_user_profile` 字段口径不符**：对方要 `learning_style`、`interest_primary/secondary`、8 个 `*_score`、`assessment_time`、`profile_version`、`is_current`、`assessment_id`；我们是 `ProfileSnapshot(child, kind, result JSONB, schema_version, produced_at)`，分数埋在 JSON 里，无 `is_current`、无兴趣/学习风格字段 | `assessment_models.py` | 高 |
| G5 | **人设展示面缺失**：无 persona 概念，无法展示 `persona_name / type / description / match_score` | 检索无命中 | 高 |
| G6 | **15/30 天成长报告展示面缺失**：我们自产的成长概览是任意 `from/to` 窗口，与新契约的固定 `period=15d\|30d` + `period_start/end` + `engagement` + 8 维 `growth_dimensions` 不是同一份数据 | `core/api/growth.py` | 高 |
| G7 | **健康度与复测缺失**：`insufficient_data / normal / watch / reassess` 四态分支、复测 CTA、`response` / `complete` 两个回写都没有 | 检索无命中 | 高 |
| G8 | **错误码与重试策略缺失**：对方定义 `0/40001/40101/40401/40901/42901/50001`，其中 `42901` 明确要求延时重试、`40101` 要求停止调用并刷新配置；我们现有 `ApiError` 是**我们自己服务端**的字符串码，与调用对方时的解析无关 | `core/api/common.py` | 中 |
| G9 | **既有集成层的定位要重审**：`ExternalAssociation` + `SyncCheckpoint(cursor)` + `ObservationBatch` 是按一期 P0-04/P0-05 的"双向/行为事件拉取"设计的。新契约把它换成了人设/成长/健康度/复测四类聚合结果，`provider="dingdong"` 的这套模型**是保留、改造还是并存**需要定 | `integration_models.py` | 中 |
| G10 | 我方公网仍是**明文 HTTP**。文档表 12 要求「所有接口必须使用 HTTPS」——该条约束的是**我们调用对方**的链路（对方提供 HTTPS 端点即可），我方入口是否也必须切 HTTPS 属另一件事，但若后续要做对端回连或上生产则迟早要办 | 已知项 | 低（对本期调用链不阻塞） |

### 3.3 八个接口 × 我们要做的事

全部是**我们发起调用**；下表「我方工作」是我们要写的代码。

| # | Method | Path | 我方工作 | 现状 |
| --- | --- | --- | --- | --- |
| 1 | POST | `/api/v1/ca/account/bind` | NFC 进来、用户登录后，用 `ca_account_id + nfc_token` 建立绑定；请求**必须幂等**（表 12「建议携带 `request_id`」）；成功后拿到 `binding_id / persona_id / persona_name / bind_status` | ❌ |
| 2 | GET | `/api/v1/ca/profile/current` | 取当前画像。**xlsx 备注：「也可由 CA 自身 DB 直接读取」**——即我们可以不调，直接读本地 | ❌ 待定 |
| 3 | GET | `/api/v1/ca/persona/current` | 取当前陪学人设并展示（不展示内部 Prompt） | ❌ |
| 4 | GET | `/api/v1/ca/growth/profile?period=15d\|30d` | 取 15/30 天报告主体；解析 `period / companion / engagement / growth_dimensions / algorithm_version`；15 与 30 天**同一个 API，只换参数** | ❌ |
| 5 | GET | `/api/v1/ca/persona/health` | 取健康度，按 `status` 决定界面动作（见 3.4） | ❌ |
| 6 | GET | `/api/v1/ca/reassessment/current` | 取待处理复测建议；**无数据时对方返 404（业务码 40401）**，我们要按"未绑定/暂无数据"处理而非报错 | ❌ |
| 7 | POST | `/api/v1/ca/reassessment/{event_id}/response` | 回写用户接受/拒绝（`accepted`），幂等 | ❌ |
| 8 | POST | `/api/v1/ca/reassessment/{event_id}/complete` | 复测完成后回写 `new_assessment_id` + `new_profile_id`，触发对方重新匹配；响应含 `new_persona_id / match_score / switch_recommended` | ❌ |

### 3.4 `status` 与界面动作的映射（文档表 11，**这是我们前端的实现清单**）

| 条件 | `status` | 我方界面动作 | 现状 |
| --- | --- | --- | --- |
| 观察期不足 | `insufficient_data` | 不做判断，继续收集数据 | ❌ |
| 互动正常 | `normal` | 正常展示成长报告 | ❌ |
| 互动偏少但不持续 | `watch` | 可做轻提示，**不展示复测强提示** | ❌ |
| 持续低互动达触发条件 | `reassess` | 展示"重新测评"入口 | ❌ |
| 复测后新角色明显更匹配 | `switch_candidate` | 展示新角色推荐，**由用户确认**（不自动切换） | ❌ |
| 复测后差异不明显 | `keep_current` | 继续保留当前人设 | ❌ |

**「不自动切换人设」是硬约束**（文档第 8 章 + 参数 `auto_switch=false`）：任何 `switch_candidate` 都只能展示建议，切换必须由用户/家长确认。

### 3.5 我们不必做的事（第一版曾误列）

| 曾经误判为我们的活 | 实际归属 |
| --- | --- |
| 实现 8 个 `/api/v1/ca/*` 接口 | **DingDong 提供**，我们调用 |
| 建 7 个数据库表 | **对方的库**（`ca_user_profile` 我们各自持有一份，其余只读） |
| 定义 `growth_v1` / `pw_v1` | **DingDong 侧定义**（用户 2026-09-16 明确），我们只消费与展示，且不得改名 |
| 实现八维成长代理、人设匹配、健康度、H01–H07 触发 | **DingDong 的 Growth Engine / Health Engine** |
| 产出人设清单 | **DingDong 的"人设配置"**，通过 `/persona/current` 与 `persona_public_view` 给我们 |
| 适配 `{code,message,request_id}` 响应封套（作为服务端） | 我们作为**调用方**解析它 |

---

## 4. 与既有约束的再确认（更正后）

依据[后台设计已确认约束](../需求/后台设计已确认约束.md)：

| 既有约束 | 与新契约的关系 | 更正后的判断 |
| --- | --- | --- |
| 「CA 主动获取 DingDong 数据」 | 8 个接口**全部**是我们主动调用 | ✅ **完全一致**，新契约把这条落成了具体接口 |
| 「没有供 DingDong 调用的入口」 | 文档没有任何 DingDong → CA 的调用 | ✅ 一致 |
| 「不接收推送」 | 无 webhook/push | ✅ 一致 |
| 「不下发画像、配置或任务」 | 我们不对对方做通用的画像/配置/任务下发；只有 `bind` 与复测回写（`response` / `complete`）这两个**契约内的**写操作 | ✅ **基本一致**，无需推翻；仅需明确"复测回写不算画像下发" |
| 「探索体验不产出天赋或能力分数」（demo 边界） | 八维 `growth_dimensions`、`match_score`、`health_score` **全部由 DingDong 产出**，我们只是展示 | ✅ **不需要松动这条边界**——第一版误以为要我们产出分数，现更正 |
| 「画像更新规则由谁提供尚未明确」 | 由对方的 Growth / Health Engine 提供，阈值 H01–H07 我们只按 `status` 做界面反应 | ✅ 已明确 |
| `growth_v1` / `pw_v1` 归属 | **DingDong 侧定义** | ✅ 我们只消费（第一版记成"我们定义"是错的，已改） |
| 指纹一次性处理不留存、不采集/推算年级、`00000` mock 短信、家庭归属隔离 | 新契约不涉及 | ✅ 继续有效 |
| 不接真实供应商 | 本期仍有 mock/production 之分；xlsx 明确给了 6 个 mock 账号 | ✅ 继续有效，且对方提供了 Mock 数据 |

**因此「全部约束遵循新的对接文档」这条决定，不需要推翻上面任何一条既有约束**，只是把它们落成了具体的接口义务。

---

## 5. 待向 DingDong 侧澄清（我们的问题清单）

> **已整理成可直接发出的版本**：[`CA-DingDong_对接澄清清单_V1.0_20260916.md`](./CA-DingDong_对接澄清清单_V1.0_20260916.md)——同一批 D1–D17，加了 P0/P1/P2 优先级、期望回答形式、两份材料不一致点的附表、逐号回复模板与可直接复制的邮件正文。本节保留为内部视角（含"为什么卡住我们"）。

**契约一致性（DingDong 出了两份，口径要统一）**

- D1. 这两份材料是否就是 `材料清单.md` 里「引用但未提供」的《DingDong 机器人对接文档 V1.0》？作为后续开发的唯一基线版本是否已冻结？
- D2. 接口清单以 docx 第 6 节（8 个，含 `account/bind`）还是 xlsx 表 4（7 个，**无** `account/bind`）为准？绑定接口是否属于 V1？
- D3. 实体清单以 docx 第 4 节（6 个）还是 xlsx 表 2（7 个，多 `companion_snapshot`）为准？
- D4. 错误码表只在 docx 第 9 节；xlsx 全文只有 `code: 0`。请给唯一错误码表，并说明 `message` 是否必返（xlsx 示例②③ 没有 `message`）。`40901 绑定或状态冲突` 的具体触发条件是什么？
- D5. 表 12 说绑定、复测回写「建议携带 `request_id`」——请定义该字段名、位置（请求头还是 body）、幂等窗口，以及重复请求的返回（返回首次结果还是 40901）。

**接口语义**

- D6. **首次测评画像通过什么通道给你们做"人设匹配"？** 表 0 写「DingDong：读取画像进行人设匹配」、表 3 写 `ca_user_profile`「CA 写」，但 8 个接口里**没有提交画像的接口**；`account/bind` 的样例请求只有 `ca_account_id + nfc_token`。这是当前最大的缺口。
- D7. `GET /reassessment/current` 无待处理建议时返回 **404（业务码 40401）** 还是 200 空对象？我们要按不同分支写界面。
- D8. `period=15d|30d` 的窗口口径：自然日还是滚动窗口？`period_start/period_end` 是否由你们按调用时刻回推？新用户不足 15 天时返回什么（xlsx 的 `ca_mock_new_001` 是 `companion_delta=0` + `watch`，是否就是"暂无数据"的表示）？
- D9. `POST /reassessment/{event_id}/complete` 之后，`new_persona_id` 何时生效？`switch_recommended=true` 时我们要展示的"新角色推荐"取哪个接口的数据（`/persona/current` 还是 `complete` 的响应）？用户确认切换要不要再调一次接口，还是由你们根据 `persona_switched` 自行推进？
- D10. `X-API-Key` 的签发方式、轮换周期、`mock` / `production` 是否两套 key、失效时的表现（是否就是 `40101`）。
- D11. Mock 环境：xlsx 说 7 个接口「Mock支持=是」——是你们提供 mock 端点，还是我们要用表 6 的 6 个 `ca_mock_*` 账号去调真实沙箱？表 6 账号由谁初始化？
- D12. 表 12 要求「所有接口必须使用 HTTPS」。请给出 `mock` 与 `production` 的 base URL，以及是否要求**我们**的入口也必须 HTTPS。

**数据**

- D13. xlsx「字段定义」里 7 个 datetime 字段的示例值是 Excel 日期序列号（如 `46277.083333333336`），请补 `YYYY-MM-DDTHH:mm:ss+08:00` 文本示例；并统一空值写法（真空单元格 / 字符串 `"null"` / `varchar(64)/null` 三种混用，`"null"` 会被我们当有效值）。
- D14. `interest_primary` / `interest_secondary` 只写「双方约定 code」——请给出 code 表。
- D15. `persona_type` 六档（art/science/engineering/philosophy/language/social）是否已够用、是否可能新增？新增时的兼容策略（我们前端要能容错未识别值）。
- D16. 表 11 里 `switch_candidate` / `keep_current` 出现在 `persona_health.status` 的枚举里，但表 8 的 `status` 枚举只写了 `insufficient_data/normal/watch/reassess`。`switch_candidate` / `keep_current` 到底由 `health.status` 还是 `complete` 响应的 `switch_recommended` 表达？
- D17. `talent_weight_version`（`pw_v1`）与 `algorithm_version`（`growth_v1`）的升级策略：升级后旧的 `growth_period` 是否仍可查、我们会否看到同一周期两个算法版本的数据？

**因 C1（`ca_account_id`）定案新增的 3 问**（详见[C1 设计](../设计/CA对接_C1_ca_account_id设计_20260916.md) §6）：

- D18. 机器人是否有**稳定唯一标识**（如 `robot_serial`）？`nfc_token` 是否一机一码、终身不变、换绑后是否复用？同一 token 绑到另一账户时返回 `40901` 还是允许覆盖？
- D19. `ca_account_id` 是否有**格式/长度约束**？我方准备用 `ca_` + 26 位 ULID，请确认可接受。
- D20. 我方已定**换机发新号**（旧号置 `retired`），那么旧号在对方的 `user_persona_binding` 是**自动释放**还是**需我方主动解绑**？旧 `growth_period` 是否仍可查？

---

## 6. 建议的落地顺序（CA 侧）

| 阶段 | 内容 | 前置 |
| --- | --- | --- |
| **C0 契约澄清** | 把第 5 节 17 个问题发给 DingDong，拿到唯一权威版本（尤其 D6 画像通道、D2/D3 口径、D10 base URL 与 key） | 无需开发 |
| **C1 身份映射** | 定义 `ca_account_id`：它是**我们的决定**（表 0「CA：提供稳定 `ca_account_id`」）。**→ 已定案（2026-09-16）：账户级、一台机器人一个号、`ca_` + 26 位 ULID、生成后永不变不回收、跨设备稳定、对外不透明；载体是新表 `CaAccount`。完整规格见 [`设计/CA对接_C1_ca_account_id设计_20260916.md`](../设计/CA对接_C1_ca_account_id设计_20260916.md)；其中「一台机器人服务几个孩子」「换机是否沿用原号」2 个子项待确认** | 无 |
| **C2 DingDong 客户端** | HTTPS + `X-API-Key` + `{code,message,request_id}` 解析 + 7 个业务码到内部错误/重试策略的映射（`42901` 延时重试、`40101` 停调并告警、`40401` 当作"暂无数据"）+ 超时与幂等键 | C0（base URL/key）、C1 |
| **C3 画像字段对齐** | 让我们的测评产物能被映射成 `ca_user_profile` 的字段；确认"对方怎么读到"（D6）后打通通道 | C0（D6） |
| **C4 NFC 承接** | `/dingdong` H5 读取并保留 `nfc_token`，登录后调 `account/bind` | C2 |
| **C5 四个展示面** | 当前人设、15/30 天成长报告、健康度四态分支、复测 CTA 与"新角色推荐" | C2 |
| **C6 复测回写闭环** | `response`（接受/拒绝）与 `complete`（新 assessment/profile）两个写操作 + 幂等 | C2 |
| **C7 Mock 联调与验收** | 用 xlsx 表 6 的 6 个 mock 账号覆盖 normal / watch / reassess / switch 四条路径，逐条对表 14 的 10 项验收清单 | C0（D11）、C5、C6 |

表 14 的 10 项是我们的**验收清单**：NFC 承接、登录后绑定、当前人设展示、15 天报告、30 天报告（同 API 换参数）、健康度四态、复测入口、复测回写、角色推荐不自动切换、新测评不覆盖旧 profile/binding。

---

## 7. 本轮做过什么 / 没做什么

**做了**：只读读取两份材料；归档为可检索文本并记录 SHA-256；与 `已确认约束`、`config/urls.py`、`设计/API/openapi.json`、核心模型、`integration_models.py` 逐条比对；按"我们是 CA 侧"更正并重写本文。

**没做**：未改任何运行代码、未改数据库与迁移、未部署、未发布版本；未修改两份原始材料；未向 DingDong 发出任何调用（本来也没有出站客户端）。
