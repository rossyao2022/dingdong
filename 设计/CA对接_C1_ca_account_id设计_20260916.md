# C1 · `ca_account_id` 设计（2026-09-16）

> **决策记录（状态：已定稿，2026-09-16）。** 本文只写一件事：CA 侧对外提供给 DingDong 的账户标识 `ca_account_id` 长什么样、怎么生成、怎么落到现有模型上。三项决定（账户级/一机一号、一台机器人一个孩子、换机发新号）均已确认，schema 不再变动。
>
> **依据**：《DingDong × CA 系统开发接口文档》V1.0 表 0「CA：提供稳定 `ca_account_id`」（该事项被文档明确划为 **CA 侧决定**）；本文把用户的决定落成可实现规格。
> **关联**：[对接澄清清单 V1.0](../需求/CA-DingDong_对接澄清清单_V1.0_20260916.md) §4、[影响分析](../需求/CA对接文档V1.0_影响分析_20260916.md) §3.2 G2 与 §6 C1。

---

## 1. 用户决定（原话）

> **「账户级就可以了　一台机器人一个号」**

拆成两条硬约束：

| # | 约束 | 含义 |
| --- | --- | --- |
| **A1** | **账户级** | 不做「家庭级」聚合层，不按家长账号聚合。`ca_account_id` 是**单一层级**的账户标识。 |
| **A2** | **一台机器人一个号** | 机器人 : `ca_account_id` = **1 : 1**。不做多机共号，也不做一机多号。 |

---

## 2. 形态规格（我们的实现约定）

| 项 | 约定 |
| --- | --- |
| **生成方** | CA 后端。对方只接收与存储，不生成、不解析 |
| **生成时机** | **首次绑定**（`POST /api/v1/ca/account/bind`）之前，在 CA 侧创建 `CaAccount` 行时生成；绑定调用携带它 |
| **建议取值** | `ca_` + **26 位 ULID**（如 `ca_01JC8Z9K3M7QXR2V6TB4NDH5PF`）。备选：`ca_` + UUID4 的 32 位 hex。**推荐 ULID**——时间有序，运维排查与分页友好，长度受控 |
| **不可变** | 一经生成**永不修改、永不回收重用**。格式一旦对外发布即冻结 |
| **不透明** | 对方**不得解析内部结构**（这是文档的硬要求；我们也自我约束：内部实现更换不得改变其语义） |
| **跨设备稳定** | **是**。号码不绑手机号、不绑登录会话、不绑设备指纹。家长换手机、重装 App、重新登录，号码不变 |
| **绑定对象** | 绑定的是**机器人**（通过 NFC token），不是手机 |

**为什么用 ULID 而不是自增/UUID 字符串**：自增会泄露业务量且需要分布式协调；UUID4 hex 无时序、排查困难。ULID 兼顾唯一、时序、长度（26）三者，且天然是不透明字符串。

---

## 3. 载体：新增 `CaAccount`（草案 → **已实现**）

沿用现有 `Entity` 基类（UUID 主键 + `created_at` / `updated_at`）。

```
CaAccount  (db_table = "ca_account")
  ca_account_id   CharField(64)  unique          # 对外暴露的不透明号（ca_ + ULID）
  robot_ref       CharField(64)  null            # 对方给的机器人唯一标识（若提供，见 D18）
  nfc_token_hash  CharField(64)                  # NFC token 的 HMAC-SHA256，一机一码
  family          FK Family      PROTECT
  child           FK Child       PROTECT NOT NULL # 服务的孩子（1:1，见 §5 ①）
  status          CharField(16)  default="active" # active / retired：**我方**是否还在用
  bind_state      CharField(16)  default="unbound"# unbound / bound：**对方**是否已确认接通
  bound_by        FK User        PROTECT null     # 首次绑定人（家长账号）
  create_request_key UUID        NOT NULL         # 幂等键的一半
  create_payload  JSON           NOT NULL         # 幂等键的另一半（内容比对）
  bound_at        DateTimeField  NOT NULL
  unbound_at      DateTimeField  null
```

> **落地时的两处修正（相对草案）**：① `status` 一维拆成两维——草案把 `unbound` 写进 `status`，但"我方还用不用"与"对方接通没接通"是两个正交事实，混在一列会让"已归档但对方未释放"无法表达。② `create_request_key` / `create_payload` 是落地时补的：没有它们，网络中断后的重试会重复建号。迁移文件 `core/0008_caaccount.py` 已包含全部约束。
>
> `nfc_token_hash` **不做无条件唯一**：唯一性挂在 `status='active'` 的条件约束上，这样"旧号留着、机器人换到新号"不会因为历史行而冲突。

**两条与既有约束一致的实现要求**：

1. **明文 `nfc_token` 不落库**。只存 HMAC 摘要（服务端密钥在环境变量，不在代码）。理由与「真实指纹不留存」同源：token 是设备凭据，明文落库等于把设备凭据复制一份到我们的库里。绑定瞬间需要比对时才用摘要查表，可用时**不写日志**。
2. **唯一性由数据库约束保证**，不靠应用层判断。`ca_account_id` 与 `nfc_token_hash` 均为 `unique`；`status='active'` 的行对 `nfc_token_hash` **与 `child`** 各加一条**条件唯一约束**。这样两条不变量由数据库保证：
   - 同一台机器人**不会被两个号同时占用**；
   - 同一个孩子**同一时刻只有一个活跃账户**（即只有一台机器人），换机时旧号必须先置 `retired` 才能为新号让位。

---

## 4. 与现有模型的映射

现状：`User`（家长账号，UUID PK，`account_kind='parent'` + `phone` 唯一）、`Family` + `FamilyMembership`（家长↔家庭，含 `ended_at`）、`Child`（挂 `Family`，UUID PK）。

| 现有对象 | 与 `ca_account_id` 的关系 |
| --- | --- |
| `User`（家长账号） | **1 : N**。一个家长账号可以有多台机器人（因此多个 `ca_account_id`）；但**一台机器人只有一个号**（A2） |
| `Family` | **1 : N**。家庭是「谁付钱、谁有权限」的边界；账户是「哪台机器人」的边界，两者不重合——这正是 A1「不做家庭级」的含义 |
| `Child` | **1 : 1（已定案）**。`ProfileSnapshot` / `ReportVersion` / `AssessmentSession` 全部挂 `child`，所以 `ca_account_id` → `child` 这条边是所有取数路径的必经环节 |
| `ProfileSnapshot` | 挂 `child`、不可变、`generation_key` 唯一。对方的 `GET /profile/current` 对应"该 child 的当前画像"，不是"该家庭的当前画像" |

### 4.1 为什么必须有这张表，不能派生

我现有 **44 条自有 API 全部以 `child_id`(UUID) 为键**，而 8 条对外调用以 `ca_account_id` 为键。两个键域之间**只能靠 `CaAccount` 表建立唯一映射**——不能靠"家长账号 id 拼一下""家庭 id 拼一下"这类派生，因为：

- 派生无法表达"一台机器人换绑到另一个孩子"；
- 派生无法在换机时保持或断开号码（取决于 §5 ② 的选择）；
- 派生无法承载 `status`（解绑/归档），而审计与历史报告可查需要它。

**结论：`CaAccount` 是强约束唯一表，是本次对接的地基。**

---

## 5. 已定案（2026-09-16）

### ① 一台机器人服务**一个孩子**　✅ 定案

**决定**：`child` 是**必填 FK**（`NOT NULL`），机器人 : 账户 : 孩子 = 1 : 1 : 1。家长在绑定时选择这台机器人服务哪个孩子。

**为什么这条重要**：对方的匹配输入是**画像**，而画像在我方是**按 `child` 存的**（`ProfileSnapshot.child`、`AssessmentSession.child`、`ReportVersion` 经 `profile` 也落到 child）。若一个号对应多个孩子，"该号当前人设是谁的"就无法回答，对方返回的 `persona` / `growth_period` 也失去归属。

**落地**：绑定页必须让孩子可选（家庭内多个孩子时）；未选孩子不允许提交绑定。

### ② 换机器人 → **新发一个号**　✅ 定案

**决定**：换机时 **发新 `ca_account_id`**，旧号置 `status='retired'` 归档。号码**跟着机器走，不跟着孩子走**。

**"一台机器人一个号"按字面严格执行**：同一台机器人终身对应同一个号；换一台机器人就是换一个号。

**必须点明的代价（已知并接受）**：

| 影响面 | 后果 |
| --- | --- |
| 对方侧成长数据 | 旧号的 `growth_period` / `reassessment_event` **与新号无法延续**，新号的成长报告会从"数据不足"重新开始 |
| 我方展示 | 若不做处理，家长换机后会觉得"孩子的成长记录没了" |
| 我方历史数据 | 旧号的报告在我方库中**仍在**，只是不再挂在活跃号下 |

**三条缓解措施（建议随 C5 展示面一起实现）**：

1. **换机前确认弹窗**：明确告知"换新设备后，成长记录将从新设备重新开始；旧设备的记录仍可在历史中查看"，由家长确认后再解绑。
2. **保留旧号只读入口**：家长端保留"上一台设备"的历史报告入口（按 `child` + 已 `retired` 的号查询），数据不丢，只是不再延续。
3. **旧号不删除、不重用**：`retired` 行永久保留（含 `bound_at` / `unbound_at`），用于审计与历史查询。
4. **归档一并结束本地关联（T-044 补）**：`retire_account()` 在归档账户的同一事务里把该儿童已核验的 `ExternalAssociation` 置 `revoked` + `ended_at`、并把同步检查点置 `blocked`，与家长点「解除本地关联」落同一个状态。理由：账户是展示面唯一的活跃入口，只改账户状态会让同一页出现「还没有机器人账户号」与「已核验 · 同步已启用」并存。换机流程由 `ca_account_one_active_child` 保证「先归档旧号才能发新号」，所以归档那一刻该儿童最多一条已核验关联，就是这台旧机器人的。

**待对方确认（D20）**：发新号后旧号在对方侧的 `user_persona_binding` 是否释放、旧 `growth_period` 是否仍可查、是否需要我方主动通知解绑。**这一条本设计无法单方面闭环**——若对方要求"解绑必须先调接口"，C4/C6 的状态机要加一步。

### ③ 解绑后旧号**不回收**　✅ 定案

置 `status='retired'` 归档，**永不重用**。理由：历史报告要可查；回收重用会让对方侧的旧 binding 与新绑定撞号。

---

## 6. 给 DingDong 的补充问题（D18–D20）

因本决策新增，已并入[对接澄清清单](../需求/CA-DingDong_对接澄清清单_V1.0_20260916.md)：

| # | 问题 |
| --- | --- |
| **D18** | 机器人是否有**稳定唯一标识**（如 robot_serial）？`nfc_token` 是否一机一码、终身不变、换绑后是否复用？同一 token 绑到另一个家庭时，对方返回 `40901` 还是允许覆盖？ |
| **D19** | `ca_account_id` 是否有**格式/长度约束**？我方准备用 `ca_` + 26 位 ULID，请确认可接受（若不接受请给约束） |
| **D20** | **换机发新号**后（我方已定：换机器人 = 新 `ca_account_id`，旧号置 `retired`），旧号在贵方的 `user_persona_binding` 如何处置——**自动释放**还是**需我方主动调用解绑接口**？旧号的 `growth_period` 是否仍可查？ |

**注**：D20 与 §5 ② 是同一件事的两半——我方已定"发新号、旧号归档"，对方定"他们侧怎么释放旧绑定"。**这一半没定，换机的状态机就闭不了环。**

---

## 7. 落地清单（C1 完成的判定标准）

- [x] §5 ①②③ 经用户确认 → **schema 已定稿**（一台机器人一个孩子、换机发新号、旧号不回收）
- [x] `CaAccount` 模型 + 迁移（`core/ca_models.py`、`core/migrations/0008_caaccount.py`）
- [x] NFC 承接：H5 读取 `?nfc_token=` → 取当前登录家长账号 → **选择服务的孩子** → 生成 `ca_account_id` → 调 `bind`（`frontend/app.js` + `ca-link.js`；出站 bind 调用见下）
- [x] 号码生成器（ULID）+ 单元测试（唯一、时序、格式）
- [x] `nfc_token` 摘要工具（HMAC-SHA256）+ 不落明文的测试断言
- [x] 条件唯一约束的迁移（`active` 行对 `nfc_token_hash` 与 `child` 各唯一）+ 违反时的错误码映射（`CA_ACCOUNT_CONFLICT` / `ACCOUNT_REPLACEMENT_REQUIRED`）
- [x] `ca_account_id → child` 解析函数（`services/ca_account.resolve_account`，8 个接口共用）
- [x] **换机流程**：确认弹窗（告知成长记录重启）→ 旧号置 `retired` → 发新号 → 调 `bind`；**"主动解绑"分支仍待 D20**
- [x] **旧号只读历史入口**：家长端「机器人账户」列出已 `retired` 号；报告本身按 `child` 保存，换机后仍在
- [x] 运营后台只读页：账户列表（号、机器人、家庭、孩子、状态、绑定时间），**不展示 token**（`ops/templates/ops/ca_accounts.html`）
- [ ] **出站 8 个 DingDong 接口**：客户端骨架已就绪（`services/dingdong_client.py`，未配置时显式报"未配置"），**等 D10 base URL / D12 key**

**验证记录（2026-09-16）**：后端 `tests/test_ca_accounts.py` + `tests/test_ops_ca_accounts.py` 共 29 条全绿；
家长端真实 Chrome 闭环 `frontend/tests/ca-account.spec.js` 4 条全绿（凭据不出现在地址栏、新号如实显示"待接通"、同一机器人复用同号、换机两步 + 旧号归档可查 + 390px 不溢出）。

---

## 8. 本文改动 / 未改动

**改动**：新增本文档（含 §5 三项定案与换机代价/缓解措施）并更新交叉引用（[文档索引](../文档/文档索引.md)、[已确认约束](../需求/后台设计已确认约束.md)、[PROJECT_MEMORY](../PROJECT_MEMORY.md)、[澄清清单](../需求/CA-DingDong_对接澄清清单_V1.0_20260916.md) §4 与 D18–D20、[影响分析](../需求/CA对接文档V1.0_影响分析_20260916.md) §6 C1、[API 契约](../设计/API/openapi.json)）。

**§7 清单实施后补充（2026-09-16）**：本文原先声明"未写任何运行代码"，现已按 §7 落地实现（模型/迁移/服务/家长端 API/家长端界面/运营只读页/测试），并把 §3 草案按实现结果校正。**仍未做**：未部署、未发版；出站 8 个 DingDong 接口未接通（缺 D10/D12）；换机的"主动解绑"分支未实现（缺 D20）。

代码落点：`backend/dingdong_ca/core/ca_models.py`、`core/services/ca_account.py`、`core/services/dingdong_client.py`、`core/api/ca_accounts.py`、`core/migrations/0008_caaccount.py`、`ops/templates/ops/ca_accounts.html`、`frontend/ca-link.js`、`frontend/app.js`；测试 `backend/tests/test_ca_accounts.py`、`backend/tests/test_ops_ca_accounts.py`、`frontend/unit/ca-link.test.js`、`frontend/tests/ca-account.spec.js`。
