# T-021 设计：人设 / 15–30 天成长报告 / 健康度四态 / 复测 CTA

- 任务：`T-021`（G-01-设计，来源 `.trellis/tasks/T-003/backlog.md` 的 G-01）
- 日期：2026-09-17
- 范围：**只写本设计，不写代码**。本轮不改 `frontend/`、`backend/` 任何源文件，不改数据模型，不新增对 DingDong 出站接口的依赖。
- 权威契约：`材料/可检索文本/DingDong_CA_系统开发文档.md`、`材料/可检索文本/DingDong_CA_数据库字段与接口.md`，冲突时以 `需求/后台设计已确认约束.md` 首节「2026-09-16 决定」为准。

## 0. 现状核查（本设计的事实基础）

本轮开工前实际查过（命令与结果）：

| 核查项 | 命令 | 结果 |
| --- | --- | --- |
| 四个概念是否已有代码 | `grep -rn "persona\|reassess" backend/dingdong_ca --include=*.py -il` | 0 个文件 |
| 同上（前端） | `grep -rn "persona\|reassess\|健康" frontend/*.js frontend/*.html` | 0 命中 |
| 家长端路由 | `grep -n 'route === "' frontend/app.js` | `explore` / `home` / `activity` / `journey` / `assessment` / `report` / `reports` / `settings` / `companion` / `services` |
| 现有「成长观察」数据源 | `backend/dingdong_ca/core/api/growth.py` | 任意 `from/to` 窗口 + `ObservationBatch`/`ProfileSnapshot`，与契约的固定 `period=15d\|30d` 不是同一份数据 |
| 合成输入注入方式 | `backend/dingdong_ca/core/management/commands/inject_fixture.py` | `--scenario` 取 `testsupport/robot.py` 的 `SCENARIOS`（8 个）+ `LOCAL_SCENARIOS`；数据落在 `test_fixture` 表 |
| 集成开关 | `backend/config/settings/base.py:20` | `INTEGRATION_DATA_SOURCE`，默认 `database_fixture` |
| 出站客户端 | `backend/dingdong_ca/core/services/dingdong_client.py` | 只覆盖传输与错误码映射；未配置时抛 `DingDongNotConfigured`，不伪造成功 |
| 已落地账户层 | `backend/config/urls.py:97-99` | `GET/POST /api/v1/children/<child_id>/ca-accounts`、`GET /api/v1/ca-accounts/<ca_account_id>`、`POST .../retire` |

结论：四个展示面是**全新工作面**，没有存量实现要改；本设计需要同时定义「数据怎么进来」与「界面怎么呈现」，且必须能在 D10 base URL / D12 key 缺失的前提下**如实**跑起来。

## 1. 四个展示面的数据形状

### 1.0 共同约定

**一、家长端接口一律以 `child_id` 为键，不暴露 `ca_account_id`。**
理由：现有 44 条家长端接口以 `child_id` 为键（`需求/后台设计已确认约束.md`、C1 §3）；`ca_account_id` 是给对方的对外不透明标识，家长端 URL 与请求体里出现它等于把内部键泄漏到浏览器。服务层内部用 `services/ca_account.resolve_account(child)` 拿当前 `active` 号，再调对方。

**二、可用性词表沿用既有取值，不新造。**
`backend/dingdong_ca/core/api/growth.py` 已经在用 `unbound` / `no_consent` / `not_synced` / `no_data` / `ready` / `stale` / `error`，四个新面**复用同一套**，配 `reason` 明细码。新面不引入第二套状态词，避免家长端出现两种说法指同一件事。

**三、每个面都带来源三元组**，与现有 `robot_observation` 一致：

```json
{
  "availability": "ready",
  "data_origin": "synthetic",
  "source": "dingdong",
  "fetched_at": "2026-09-17T10:00:00+08:00",
  "reason": null
}
```

`data_origin` 为 `synthetic` 时，前端必须挂 `合成测试数据` 徽标（`frontend/app.js:107` 的 `testTag()`），不得只在页脚写一行了事。`availability != "ready"` 时**不展示任何数值**（尤其不能把缺失显示成 0 或"— 分"）。

**四、对方字段只做展示映射，不做语义再解释。**
`growth_v1` / `pw_v1` 由对方定义，我们只存与展示（`需求/后台设计已确认约束.md`）；八维成长代理**不是** CA 原始天赋分，界面文案必须写明这一句（与既有「网页活动是家庭自报记录……不能直接混成一个分数」同一纪律）。

### 1.1 面一：人设（当前陪学伙伴）

**契约来源**：`GET /api/v1/ca/persona/current`（`persona_public_view` + `user_persona_binding`）。
**契约字段**：`persona_id`、`persona_name`、`persona_type`、`match_score`、`bind_time`；公开部分另有 `public_description`、`learning_style_tags`、`talent_weight_version`。**不返回、不展示内部 Prompt**。

**落点**：家长端 `#reports` 顶部新增一个面板「陪学伙伴」，位置在「初始测评」卡之后、「已生成报告」之前；`#settings` 的「机器人账户」面板补一行只读的当前人设名（与 T-015 给儿童详情加只读「机器人账户」行同一手法）。

**我方接口形状**（`GET /api/v1/children/<child_id>/companion-persona`）：

```json
{
  "availability": "ready",
  "data_origin": "synthetic",
  "source": "dingdong",
  "fetched_at": "2026-09-17T10:00:00+08:00",
  "reason": null,
  "persona": {
    "persona_id": "persona_art_01",
    "persona_name": "Mia",
    "persona_type": "art",
    "public_description": "艺术创作陪学伙伴",
    "learning_style_tags": ["imitation", "open"],
    "talent_weight_version": "pw_v1"
  },
  "binding": {
    "binding_id": "bind_mock_001",
    "bind_time": "2026-09-16T09:00:00+08:00",
    "match_score": 82,
    "status": "active"
  },
  "persona_switched": false
}
```

`persona` 与 `binding` 在 `availability != "ready"` 时为 `null`。

**展示规则**：
- `persona_type` 按契约 6 值映射中文（`art` 艺术 / `science` 科学 / `engineering` 工程 / `philosophy` 哲学 / `language` 语言 / `social` 社交）。**映射表放后端**（`ops/labels.py` 已有同类做法的先例），前端只渲染后端给的中文，避免两处维护。
- `match_score` 必须带「匹配度」限定词与范围说明（0–100，对方算法产出），不写成「适合度」「天赋分」。
- `learning_style_tags` 是对方 style code，未在契约里给出 code 表（xlsx 内部问题 7），**V1 只按原样展示英文 code + 一句「按对方学习风格 code 展示」**，不自造中文译名。
- `talent_weight_version` 只作为版本号低调展示（复用 `versionLabel()` 的截断手法），不解释权重内容。
- 换机后（旧号 `retired`）：只读展示旧号那一期的人设，标注「上一台机器人时期」。历史入口已在 C1 落地，本面只是补数据。

### 1.2 面二：15–30 天成长报告

**契约来源**：`GET /api/v1/ca/growth/profile?ca_account_id=&period=15d|30d`（`growth_period`，23 字段）。返回字段：`period`、`companion`、`engagement`、`growth_dimensions`、`algorithm_version`，加上 `profile_id`、`persona`、`generated_at`。

**落点**：家长端 `#reports` 新增面板「成长周期报告」，放在现有「成长观察」窗口表单**之上**。两者是**两份数据、两个来源**，不合并、不互相覆盖：
- 「成长周期报告」= 对方的 `growth_period`，固定 `period=15d|30d`，非正式算法、非家庭自报；
- 「成长观察」= 我方 `ObservationBatch` + 任意窗口，保持原样不动。

面板内用两个固定 Tab（`15 天` / `30 天`）切换，**不提供任意日期区间**——任意区间由既有「成长观察」承担，这正是 T-003 里 G-01 指出的「不是同一份数据」的分工。

**我方接口形状**（`GET /api/v1/children/<child_id>/growth-cycle?period=15d`）：

```json
{
  "availability": "ready",
  "data_origin": "synthetic",
  "source": "dingdong",
  "fetched_at": "2026-09-17T10:00:00+08:00",
  "reason": null,
  "period": {"days": 15, "start": "2026-09-01", "end": "2026-09-15"},
  "persona": {"persona_id": "persona_art_01", "persona_name": "Mia", "persona_type": "art", "match_score": 82},
  "companion": {"start": 12, "end": 47, "delta": 35},
  "engagement": {"index": 58.31, "stage": "developing", "stage_progress": 55},
  "growth_dimensions": {
    "linguistic": 64, "logical": 48, "musical": 66, "spatial": 62,
    "bodily": 44, "intrapersonal": 57, "interpersonal": 51, "naturalistic": 42
  },
  "algorithm_version": "growth_v1",
  "generated_at": "2026-09-16T00:10:00+08:00"
}
```

**展示规则**：
- `companion.delta` 是「有效陪伴互动代理量」，文案写「陪伴值增长」，不写「努力程度」。
- `engagement.stage` 按 `initial/exploring/developing/deep/co_creation` 映射中文阶段名（映射表放后端）。`stage_progress` 是 0–100 的阶段进度。
- 八维：八个维度按固定顺序渲染为条形，标注「成长代理（对方算法产出，不是 CA 原始天赋分）」。缺失维度（契约中八维均可空）单独处理：某一维为 `null` 时该条显示「本周期无该维度数据」，**不补 0、不做插值**。
- 换机后 `period_start` 会重新开始（C1 §5 ② 已定代价）：旧号的历史报告按 `child` 保存、仍在报告列表可查，本面板只展示当前 `active` 号的周期。
- 契约里 `period_days` 只允许 15/30，`period` 参数非法值按 422 `VALIDATION_ERROR` 处理（与既有 `window()` 的入参纪律一致）。

### 1.3 面三：健康度四态

**契约来源**：`GET /api/v1/ca/persona/health`（`persona_health`，9 字段）：`status`、`health_score`、`reassessment_recommended`、`trigger_reason`。

**四态取值与界面分支**（`需求/后台设计已确认约束.md` 的「界面分支」行 + xlsx 表 7.1 H01–H07）：

| 态 | 触发（H 规则） | 家长端呈现 |
| --- | --- | --- |
| `insufficient_data` | H01：观察期 < 7 天 | **不做判断**。只显示「还在收集互动数据，暂时不做判断」，不显示分数 |
| `normal` | H02：观察期 ≥ 15 天且 delta ≥ 20 | 正常展示健康度分数与观察天数 |
| `watch` | H03：观察期 ≥ 15 天且 5 ≤ delta < 20 | 轻提示「继续体验并观察」，**不出复测 CTA** |
| `reassess` | H04：观察期 ≥ 21 天且 delta < 5；H05：连续两个 15 天周期 delta 均 < 10 | 展示「重新测评」入口（见 1.4） |

**必须记录的契约内部矛盾**：xlsx 表 3.6 的 `status` 枚举只写了 `normal/watch/reassess`，但表 7.1 的 H01 产出 `insufficient_data`；`switch_candidate` / `keep_current`（H06/H07）也不在表 3.6 枚举里。本设计的处置：
- 四态**以表 7.1 的 H 规则为准**（它是「系统动作」的定义处），表 3.6 视为枚举书写不全；
- `switch_candidate` / `keep_current` **不当作健康度状态处理**，它们是复测**完成后**的结果（H06/H07），界面只消费 `POST .../complete` 响应里的 `switch_recommended` 与 `match_delta`（见 1.4），不依赖这两个枚举值；
- 未知 `status` 值一律落到「不做判断」分支并记 `reason="unknown_health_status"`，**不猜、不按 normal 展示**。

**落点**：与面一同一面板的第二个区块（「互动健康度」），位于人设卡下方。

**我方接口形状**（`GET /api/v1/children/<child_id>/companion-health`）：

```json
{
  "availability": "ready",
  "data_origin": "synthetic",
  "source": "dingdong",
  "fetched_at": "2026-09-17T10:00:00+08:00",
  "reason": null,
  "health": {
    "health_id": "health_mock_002",
    "persona_id": "persona_science_01",
    "observation_days": 21,
    "companion_delta": 3,
    "health_score": 28,
    "status": "reassess",
    "reassessment_recommended": true,
    "trigger_reason": "continuous_low_engagement",
    "evaluated_at": "2026-09-22T09:00:00+08:00"
  }
}
```

**展示规则**：
- `trigger_reason` 只有两个 code（`low_engagement` / `continuous_low_engagement`），后端映射为中文「近期互动偏少」/「连续多期互动偏少」。**不把 code 原样给家长看**（与 T-013 去掉 `readable-v2` 内部 code 同一纪律）。
- `health_score` 必须同时给出观察天数，避免家长把单次分数当成定论；四态里只有 `normal` / `watch` 展示分数。
- 健康度**不是对孩子的评价**：面板底部固定一句「这是互动情况的提示，不是对孩子的评价」，与既有「不应用来评价孩子」的纪律一致。

### 1.4 面四：复测 CTA 与回写

**契约来源**：
- 读：`GET /api/v1/ca/reassessment/current`（200 / 404，`reassessment_event` 11 字段）；
- 写：`POST /api/v1/ca/reassessment/{event_id}/response`（`accepted`）、`POST /api/v1/ca/reassessment/{event_id}/complete`（`new_assessment_id`、`new_profile_id`）。

**落点**：健康度面板内，`health.status == "reassess"` 且 `reassessment_recommended == true` 时展示；不在别处出现第二个入口。

**状态机（家长端可见的四步）**：

1. **展示建议**：文案「最近一段时间互动偏少，要不要重新测一次？」+ 事件时间 `recommended_at`。按钮「重新测评」/「先不测」。
2. **回写选择**：点任一按钮 → `POST .../response {accepted: true|false}`。**`accepted` 为 `null` 时（未回写）每次进页面都展示建议**；回写 `false` 后不再重复打扰，改为一行「已选择暂不重新测评」+ 可再次展开。
3. **承接复测页面**：`accepted == true` → 复用**既有测评流程**（`#reports` 的问卷 → 五张合成样例 → Worker 生成报告），不新建第二套测评入口。完成后把本次测评的 id 作为 `new_assessment_id`、新生成的 profile 作为 `new_profile_id` 回写 `POST .../complete`。
4. **结果与新角色建议**：`complete` 响应给 `new_persona_id`、`new_persona_name`、`match_score`、`current_persona_match_score`、`match_delta`、`switch_recommended`。
   - `switch_recommended == true`（H06，`match_delta ≥ 15`）：展示「新角色推荐」卡，**由家长确认后才切换**；
   - `switch_recommended == false`（H07，`match_delta < 15`）：展示「保留当前角色」，不展示新角色名，避免无谓的换人设冲动。
   - **`auto_switch` 固定 `false`，任何路径都不得自动切换**（`需求/后台设计已确认约束.md` 不变量）。

**我方接口形状**（三条）：

```json
GET  /api/v1/children/<child_id>/reassessment
     → {availability, data_origin, source, fetched_at, reason, event: {...11 字段...} | null}

POST /api/v1/children/<child_id>/reassessment/<event_id>/response
     body {"accepted": true}
     → {event_id, accepted, data_origin, source}

POST /api/v1/children/<child_id>/reassessment/<event_id>/complete
     body {"assessment_id": "<我方测评 id>"}
     → {event_id, new_persona_id, new_persona_name, match_score,
        current_persona_match_score, match_delta, switch_recommended, data_origin, source}
```

**回写的三条硬约束**：
- **幂等**：两条 POST 都带我方生成的 `request_id`（沿用现有幂等键做法）；重复提交同一 `event_id` + 同一 `accepted` 返回首次结果，不重复出站。
- **网络调用放事务外**（`services-and-idempotency.md`），本地状态先落库、出站失败留待重试，不出现「本地已切换、对方不知道」的半截状态。
- **合成数据源下不出站**：`data_origin=synthetic` 时回写只落我方库 + `AuditEvent`，**不调对方接口、不伪造成功**（`external-integrations.md` 第 1 条）。这一点必须在接口响应里如实标注 `data_origin`。

**换机交互**：换机会产生新 `ca_account_id`，旧号的 `reassessment_event` 随之失效。设计上换机后**不复用旧号的事件**（C1 §5 ③ 旧号不回收、只读），新号从 H01 重新累计。

## 2. 合成数据源放哪一层

**结论：放后端服务层，不在前端做 mock。**

### 2.1 分层落点

```
家长端 app.js  ──HTTP──▶  core/api/ca_display.py      （4 个 GET + 2 个 POST，只做鉴权/入参/序列化/错误映射）
                              │
                              ▼
                          core/services/ca_display.py （唯一出口：返回契约形状字典；按开关分派）
                              ├── settings.CA_DISPLAY_DATA_SOURCE == "synthetic_fixture" → 读 test_fixture 表
                              └── settings.CA_DISPLAY_DATA_SOURCE == "dingdong"        → services/dingdong_client.py
```

- **新开关**：`CA_DISPLAY_DATA_SOURCE`，默认 `synthetic_fixture`（本地/演示），生产切 `dingdong`。独立于既有 `INTEGRATION_DATA_SOURCE`（那个管测评/观察的 fixture 闸门，语义不同，不混用同一个值域）。
- **fixture 载体**：复用现有 `test_fixture` 表（`testsupport/models.py`，已有 `dataset/kind/subject_key/sequence/payload` 自然键），新增 `kind` 取值 `ca_display_persona` / `ca_display_growth` / `ca_display_health` / `ca_display_reassessment`，`subject_key` 用 `ca_account_id`，`payload` 是**契约原始 JSON**（与 xlsx 示例同形状）。
- **注入命令**：扩 `inject_fixture` 的 `LOCAL_SCENARIOS`，新增 6 个场景，一一对应 xlsx 表 6 的 6 个 mock 账号，这样「界面该长什么样」有对方给的预期答案可对：

| 场景名 | 对应 mock | 期望界面 |
| --- | --- | --- |
| `ca_display_normal_art` | `ca_mock_001` | 正常成长报告（normal，15 天） |
| `ca_display_normal_science` | `ca_mock_002` | 正常成长报告（normal，30 天） |
| `ca_display_watch` | `ca_mock_003` | 轻提示继续体验（watch） |
| `ca_display_reassess` | `ca_mock_low_001` | 显示重新测评 CTA（reassess） |
| `ca_display_new_user` | `ca_mock_new_001` | 新用户/暂无成长数据（insufficient_data） |
| `ca_display_switch` | `ca_mock_switch_001` | 复测后推荐新角色（switch_recommended，match_delta 17） |

- **不落明文的字段**：fixture 里不放 `nfc_token`、不放任何凭据；契约字段本身没有敏感项。

### 2.2 为什么不放前端 mock

1. **前端 mock 会绕过家庭隔离与审计**。四个面要验的正是「这台机器人的数据算谁的孩子」；`app.js` 里塞假数据，测不到 `owned_child()` 的隔离，也测不到换机后旧号只读。
2. **将来换真源要重写两遍**。开关在后端，切 `dingdong` 只改一个 setting；放前端则 `app.js` 的假数据、真实调用、错误态三套并存。
3. **错误码映射本来就在后端**。`dingdong_client.BUSINESS_CODES` 已把 7 个业务码映射成 `retry/stop/empty/fatal/conflict`，前端只该收到统一信封。
4. 与既有纪律一致：`external-integrations.md` 明确「外部缺失的输入用数据库 fixture 注入，而不是伪造 API 响应」。

### 2.3 与真源切换的关系

`CA_DISPLAY_DATA_SOURCE=dingdong` 时，`services/ca_display.py` 调 `dingdong_client`，未配置（缺 D10/D12）时**返回 `availability="not_synced"` + `reason="upstream_not_configured"`**，前端显示「机器人数据服务尚未接通」。**不抛 500、不显示假数据、不显示 0 分**。这样同一个界面在两种开关下都诚实。

## 3. 空态与错误态

### 3.1 共同词表（复用 `growth.py` 既有取值）

| `availability` | 触发条件 | 家长端文案 | 是否显示数值 |
| --- | --- | --- | --- |
| `unbound` | 该儿童无 `active` 的 `CaAccount` | 「还没有绑定机器人，绑定后这里会显示陪伴数据。」+ 去 `#settings` 的按钮 | 否 |
| `no_consent` | `dingdong_sync` 用途已撤回或未同意 | 「尚未同意机器人数据同步用途。」+ 去 `#settings` | 否 |
| `not_synced` | 已绑定、已授权，但对方还没有数据 / 服务未接通 | 「机器人数据服务尚未接通，稍后自动重试。」 | 否 |
| `no_data` | 对方 40401（契约：当「暂无数据」处理） | 各面自己的空态（见 3.2） | 否 |
| `stale` | 取到过数据但最近一次同步失败（沿用 T-020 先例） | 「显示上次成功同步的数据」+ 同步失败提示 | 是，但必须带「上次成功」前缀 |
| `error` | 40101 / 50001 / 42901 重试耗尽 | 「暂时取不到机器人数据，我们会在后台重试。」 | 否 |
| `ready` | 正常 | 正常展示 | 是 |

### 3.2 各面的空态

- **人设**：`no_data` → 「还没有匹配到陪学伙伴。完成一次测评后，系统会推荐一位。」不显示空白卡片。
- **成长报告**：`no_data` → 区分两种，不混成一句：
  - 绑定不满 15 天 → 「成长周期还没走完，满 15 天后会生成第一份周期报告。」（对应 H01 的 `insufficient_data` 语义）
  - 绑定 ≥ 15 天但对方无该周期数据 → 「这个周期还没有报告。」
- **健康度**：`no_data` / `insufficient_data` → 「还在收集互动数据，暂时不做判断。」**不显示分数、不显示 0**。
- **复测 CTA**：404（契约明确 200/404）→ 就是「没有待处理建议」，**不显示任何 CTA**、不报错、不留空框。

### 3.3 错误态

- **出站失败**：按 `BUSINESS_CODES` 处置，家长端只看到一个统一说法 + 后台可重试：
  - `42901`（`retry`）：指数退避重试，不打扰家长；
  - `50001`（`retry`）：同上；
  - `40101`（`stop`）：**停止调用并告警**（运营后台可见），家长端显示 `error` 文案，不无限重试；
  - `40401`（`empty`）：当 `no_data`，不记失败；
  - `40901`（`conflict`）：复测回写场景下提示「这次复测的状态已经变了，请刷新页面」，不静默吞掉；
  - `40001`（`fatal`）：我方请求有问题，记日志 + 运营告警，不重试。
- **我方入参错误**：`period` 不是 `15d|30d` → 422 `VALIDATION_ERROR`（与既有 `window()` 一致）。
- **权限**：非本人儿童 → 404（沿用 `owned_child()` 的既有行为，不泄漏存在性）。
- **写操作幂等冲突**：同一 `event_id` 重复 `response` 且 `accepted` 不同 → 422，提示「这次复测建议已经处理过了」。
- **不许出现的行为**：静默失败、把错误显示成 0 分、把 `not_synced` 说成「暂无成长数据」（前者是服务没接通，后者是对方确认没有数据，必须分开）。

## 4. 与 `设计/CA对接_C1_ca_account_id设计_20260916.md` §7 判定标准逐条对照

§7 共 11 条（10 条已勾选 + 1 条未勾选）。本设计对每条的关系：

| # | §7 条目 | 本设计的关系 | 结论 |
| --- | --- | --- | --- |
| 1 | §5 ①②③ 经用户确认 → schema 已定稿 | 不动 schema；四个面全部以 `ca_account_id` 为对外键、`child` 为家长端键 | 不受影响 |
| 2 | `CaAccount` 模型 + 迁移（`core/ca_models.py`、`0008`） | 只读复用（取 `active` 号、列 `retired` 号）；不新增字段、不加迁移 | 不受影响 |
| 3 | NFC 承接：`?nfc_token=` → 选孩子 → 生成号 → `bind` | 不涉及；但换机流程会让四个面回到 `unbound`/`insufficient_data`，需在实现任务里覆盖该转换 | 不受影响，需测试覆盖 |
| 4 | 号码生成器（ULID）+ 单元测试 | 不涉及 | 不受影响 |
| 5 | `nfc_token` 摘要（HMAC-SHA256）+ 不落明文断言 | 不涉及；本设计新增的 fixture **也不存 token**（§2.1） | 不受影响，且不引入新的明文风险 |
| 6 | 条件唯一约束 + 错误码映射（`CA_ACCOUNT_CONFLICT` / `ACCOUNT_REPLACEMENT_REQUIRED`） | 不涉及 | 不受影响 |
| 7 | `ca_account_id → child` 解析（`resolve_account`，8 接口共用） | **依赖**：四个面的服务层都走它取当前号；换机后必须解析到新号而不是旧号 | 复用，需测试覆盖 |
| 8 | 换机流程（**「主动解绑」分支仍待 D20**） | 不涉及主动解绑；但换机后的界面状态（面一显示新号人设、面二周期重算、面三/四从 H01 重新累计）要在实现任务里定义并验收 | 不受影响，需测试覆盖 |
| 9 | 旧号只读历史入口（`retired` 号 + 报告按 `child` 保存） | **依赖**：面一需展示旧号时期的人设（标「上一台机器人时期」）；面二只展示当前号周期，旧报告仍走既有报告列表 | 复用并补一处 |
| 10 | 运营后台只读页（`ca_accounts.html`，不展示 token） | **本设计不扩大**：四个面是家长端展示面；运营侧只要求出站失败（40101/40001）可见告警。是否给运营页加人设/健康度只读列，**明确不在本设计范围**，需要时另开任务 | 不扩大范围 |
| 11 | **出站 8 个 DingDong 接口（等 D10 base URL / D12 key）** | 本设计**不代替**它，但把它从「全部未做」推进到「**4 个读 + 2 个写有明确契约形状与错误处置，合成数据源下可完整走通**」。真源切换仍卡在 D10/D12，与 §7 结论一致 | 部分推进，阻塞项不变 |

**与 §7 的两点不一致，如实记录**：
1. §7 第 11 条把「出站 8 个接口」记为唯一未完成项；本设计实际新增了一个**不在 §7 清单里**的工作面（四个展示面，§7 只隐含在「陪伴展示」「复测承接」两条义务里）。这不是 §7 写错，而是 §7 是 C1 的判定标准、四个展示面属于 C5/C6（`PROJECT_MEMORY.md` 建议顺序），本轮只是提前设计。
2. §7 未勾选项的完成判定仍**只能由 D10/D12 解开**；四个面用合成数据源跑通**不等于** §7 第 11 条完成，验收报告里不得写成已完成（`AGENTS.md`：不得把测试数据流程声称为真实供应商接入）。

## 5. 实现任务拆分

建议拆 4 个任务，按序执行（`gate: review`，逐条申请，不适用直推规则）：

| 编号建议 | 任务 | 范围 | 关键验收 |
| --- | --- | --- | --- |
| **A** | 四个面的数据层与家长端接口 | `settings.CA_DISPLAY_DATA_SOURCE`；`services/ca_display.py`；`api/ca_display.py` 的 4 读 2 写；`inject_fixture` 加 6 场景；错误码映射；`设计/API/openapi.json` 同步 | 后端用例覆盖 7 个 `availability` 值 + 5 类业务码处置 + 幂等重放；`audit_documents.py` errors 空 |
| **B** | 面一 + 面三（人设 + 健康度四态） | `#reports` 新增「陪学伙伴」面板；四态分支与文案；`testTag()` 徽标 | 真实 Chrome：6 个 fixture 场景逐个截图；四态断言；390×844 不溢出；`pageerror` 空 |
| **C** | 面二（15/30 天成长报告） | `#reports` 新增「成长周期报告」面板；15/30 Tab；八维条形；与既有「成长观察」并存不干扰 | 真实 Chrome：正常/空/陈旧三态；确认既有「成长观察」窗口功能未回归 |
| **D** | 面四（复测 CTA 与回写） | CTA 展示 → `response` 回写 → 承接既有测评 → `complete` 回写 → 新角色推荐由家长确认 | 真实 Chrome 走完整四步；`switch_recommended` 真/假两分支；`auto_switch` 始终 `false`（用例断言无人设自动切换） |

**为什么 A 单拆**：三个展示面共用同一套 `availability` 语义与错误处置，先定死数据层可以避免 B/C/D 各写一套状态词（正是 T-003 里 G-01 反映的问题根源之一）。B/C/D 之间无代码依赖，可并行，但建议按 B→C→D 顺序——D 依赖 B 定下的健康度分支。

**A 之后每个任务都要带的收口项**（写进各自 acceptance，不另开任务）：`frontend/README.md` 与 `PROJECT_MEMORY.md` 的同步、`.trellis/spec/` 若有新约定则回写。

## 6. 本轮未决（不改清单文件，供 orchestrator 决定是否并入 T-028）

| # | 待澄清 | 为什么要 | 没有它本设计如何降级 |
| --- | --- | --- | --- |
| ① | `new_assessment_id` 的取值语义：是我方测评 id、还是对方期望的某种编号？`complete` 的幂等窗口与重复返回？（现有澄清清单只有 D5 管 `request_id`，没有管这个字段本身） | 复测回写的第 3 步直接依赖它 | 合成数据源下用我方测评 id；真源切换前必须确认 |
| ② | `persona_health.status` 的权威枚举：`insufficient_data` 是否正式属于 `status`？（表 3.6 与表 7.1 不一致） | 决定四态是否要加第五态 | 本设计按表 7.1 处理，未知值落「不做判断」 |
| ③ | `persona_type` 与 `learning_style_tags` 的 code 表（xlsx 内部问题 7 已列） | 决定中文文案是映射还是原样展示 | V1 原样展示英文 code |
| ④ | `growth_period` 八维全部可空时，是否允许只返回部分维度？ | 决定八维条形的空条呈现 | 按「缺哪维就标哪维无数据」处理，不补 0 |
| ⑤ | `reassessment_event.persona_switched` 由谁写（表里标「CA写入：部分」） | 决定家长确认切换后谁落这个标记 | 本设计由我方在家长确认时落本地标记，真源切换前需确认 |

---

**本轮产出边界**：仅本文件。无代码改动、无模型改动、无迁移、未触碰 `frontend/`、`backend/`、`设计/API/openapi.json`。
