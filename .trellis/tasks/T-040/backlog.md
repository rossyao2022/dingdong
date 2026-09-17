# T-040 产品巡检 backlog（第三轮，2026-09-18）

## 审计方式（可复核）

- 家长端：真实 Chrome（`channel=chrome`）走 `http://127.0.0.1:4173/`（任意手机号 + 验证码 `00000`）；1440×900 与 390×844 两种视口；流程覆盖登录 → 建档 → 绑定机器人 → 核验关联（错凭据 + 真实凭据两条）→ 六个 `ca_display_*` 合成场景 → 各页面 → 复测建议（「先不测」与「重新测评」两条）→ 完整 22 题复测回写。
- 运营端：真实 Chrome 走 `http://127.0.0.1:8017/ops/`（`admin` / `dingdong-admin`），11 个真实一级页 + 服务事项/题库/活动/账号/儿童/家庭/生成任务详情页。第一轮脚本里 `children/`、`observations/`、`content/`、`support/`、`staff/`、`settings/` 六个 404 是我方脚本猜的 URL，不是缺陷，已剔除。
- 源开关：`CA_DISPLAY_DATA_SOURCE=dingdong`（真源未配置）另起后端 8018 + 前端 4174 实例复核，不动 4173/8017 那套；临时前端脚本 `frontend/server-t040.cjs`（`server.cjs` 换端口副本）跑完即删。
- 展示面数据用 `manage.py inject_fixture --child-id <id> --scenario ca_display_*` 注入（6 个合成场景），核验凭据用 `--scenario sync_success` 产出的真实合成凭据；**不拦截、不伪造任何 API 响应**。
- 脚本与原始记录都在 `.trellis/tasks/T-040/`：`walk-parent.mjs` / `walk-parent-c.mjs` / `walk-parent-d.mjs` / `walk-parent-dingdong.mjs`（家长端）、`walk-ops.mjs` / `walk-ops2.mjs`（运营端）、`diag-reassessment-start.mjs`（定点复现），输出同名 `.json` / `.jsonl`。截图在 `shots/`。
- 环境：后端 8017（`manage.py runserver`，`config.settings.local`）、前端 4173（`node server.cjs`）、PostgreSQL 127.0.0.1:55439，全部本机、非生产。
- 本地短信频控（按客户端 IP 1 小时 ≥50 次）本轮触发一次 429（`验证码请求过多`），后续登录脚本带重试等待；这也是 `tests/flows.spec.js` 本轮没跑的原因。

## 一、家长端

### P-16 真缺陷：复测「重新测评 → 开始复测」点下去没反应——同意对话框只闪现约 1.7 秒就被自动重渲染关掉

- **用户在哪一步卡**：测评与报告 → 陪学伙伴 → 互动健康度提示「建议重新测评」→ 点「重新测评」（区块变成「已确认重新测评」+「开始复测」）→ 点「开始复测」。页面没有任何变化：没有对话框、没有报错、地址栏不动、区块文案也不变。家长无从继续，复测闭环断在这里。
- **现状（实测，两次独立复现）**：点「开始复测」后应用确实按设计发了三个请求——`GET /api/v1/assessment-config?purpose=assessment`（200）、`GET /api/v1/children/<id>/consents`（200）、`GET /api/v1/policies/current?purpose=assessment_processing`（200）——并把同意对话框内容写进了 `#dialog-content`；但 `<dialog>` 在约 700ms 时打开、约 2400ms 时被关掉，家长能操作的时间窗口约 1.7 秒（100ms 采样：`[603,false] [701,true] … [2302,true] [2401,false]`，`closedAfterOpen: true`）。
- **机制（读码定位）**：`app.js:628` 的 `render()` 一进来就调 `stopWork()`，而 `app.js:88-91` 的 `stopWork()` 会 `$("#dialog").close()`；`#reports` 路由在「机器人观察未同步 / 阶段画像处理中 / 缺阶段报告」时会挂一个 3 秒轮询重渲染（`app.js:750-760`）。本次复现里观察区块正是 `not_synced`（该儿童没走关联核验），所以点开对话框后紧跟着的一次轮询渲染把它关掉了。同一现象在 `walk-parent-d.mjs`（另一个儿童、有真实关联）里也复现了：点完「开始复测」后 1.2 秒内对话框还没进 DOM，脚本随后找不到任何测评入口。
- **证据**：`diag-reassessment-start.json`（`dialog open timeline` / `dialog open timeline (full)` 的采样数组、`after 开始复测` 的请求与响应表、`dialog dom state` 的 `display: none`）、`shots/diag-01-suggest.png`（点前）、`shots/diag-02-accepted.png`（点「重新测评」后）、`shots/diag-03-after-start.png`（点「开始复测」后：区块停在「开始复测」，无对话框）。
- **建议改法**：①`render()` 里的 `stopWork()` 不要无条件关对话框——只在「离开当前编辑/对话上下文」时关（例如把关闭动作绑到具体的 `to()`/退出动作，而不是每次重渲染）；②或让复测承接的对话框在打开期间挂起轮询（打开时 `clearTimeout(pollTimer)`、关闭后再恢复）；③退一步：`beginAssessment()` 拿到 policy 后先 `showDialog` 再让轮询渲染跳过本次（用 `viewEpoch` 判定）。三条都不动对方接口与数据模型。
- **完善还是扩散**：完善（纯前端时序；不新增对对方接口的依赖、不改契约、不改数据模型语义）。
- **工作量档位**：中（要动 `render()/stopWork()` 的时序，且需要覆盖「轮询渲染与对话框共存」的回归用例）。

### 已核验的正常行为（记录，不作缺陷）

- **未同意同步时四个展示面一致降级**：新建家庭绑定机器人后不做核验时，陪学伙伴 / 互动健康度 / 成长周期报告三处都显示「尚未同意机器人数据同步用途」+「管理关联与授权」，不显示任何数值（`walk-parent-b.mjs` 那次走查拍到的状态）。
- **同步完成前后的观察区块**：核验后同步任务约 20 秒完成；完成前显示「正在等待首次同步／暂无可展示的指标／最近成功同步：尚无记录」，完成后显示「机器人行为观察 · 合成观察次数 3 次 · 最近成功同步：2026/09/18 05:19」+ 来源说明（`shots/40-dingyi-observation-ready.png`）。一度怀疑「账户页说已同步、观察页说尚无记录」是矛盾，查库后证伪：`SyncCheckpoint.last_success_at` 在 21:13:50Z 落库，而那张截图取在其前，属采样时序，不是缺陷。
- **复测「先不测」**：点后区块变成「已选择暂不重新测评」+「查看当时的建议」，不再重复打扰（`shots/02-jia-after-decline.png`）。

## 二、运营端

### O-08 「提交家长」「绑定家长」列在家长没填姓名时把同一个手机号渲染两遍

- **用户在哪一步困惑**：服务事项列表里每一行的「提交家长」列都是 `+8613800881768 +8613800881768`——一次是主体文字，一次是紧随的小字。同类重复还有：CA 账户列表「绑定家长」列（`+86136578… +86136578…`）、服务事项详情「提交家长」（`+8613800881768（+8613800881768）`）、儿童详情「所属家庭」（`家长 +8613629910256（+8613629910256）`）。
- **现状**：模板一处渲染 `{{ x|display_name:"未登记" }}`、紧接着又渲染一次 `{{ x.phone }}`；而 `display_name`（`ops/templatetags/ops_labels.py:154`）在姓名为空时会回落手机号。T-038 已为家庭列表加了不回落手机号的 `account_name`（`families.html:57`），这四处还没换。
- **证据**：`shots/ops2-01-services.png`（服务事项列表，12 行全中）、`shots/ops2-09-ca-accounts.png`（CA 账户列表）、`shots/ops2-detail-services-a65e32ea-762e-418d-b04d-a3b50def07fc-.png`、`shots/ops2-detail-children-81db7832-fe95-4f4f-ae67-6ebf7a78e12b-.png`。
- **建议改法**：这四处的姓名列改用 `account_name`（空姓名给「未填写」），需要手机号的地方保留旁边的独立手机号渲染；或把手机号从姓名单元格里摘掉（列表里已经有手机号列/详情里已有「手机号」行）。
- **完善还是扩散**：完善。**工作量档位**：小（四处模板各一行）。

### O-09 家庭详情「家长」显示 `+8613828918211（owner）`——括号里是内部英文角色名

- **用户在哪一步困惑**：家庭详情「家长」一行写成 `+8613828918211（owner）`，紧接的下一行「手机号」又是同一个号码；`owner` 是库里的内部角色取值（`core/models.py:32` 默认 `owner`），运营看到的是英文内部码。
- **证据**：`shots/ops2-detail-families-8eb8df38-c80d-46be-b4e8-fd77c958bfdc-.png`（家庭详情「家庭信息」卡）。
- **建议改法**：角色给中文（如「主要家长」）或直接去掉括号；姓名空时按 O-08 用「未填写」，手机号只在下行出现。
- **完善还是扩散**：完善。**工作量档位**：小。

### O-10 活动列表「所属岛屿」显示内部英文 code（`imagination · calm`）

- **用户在哪一步困惑**：活动管理列表里 `[合成测试]观察叶子` 一行下方写 `imagination · calm`；家长端同一个取值显示的是「创意想象」「平静如水」（`frontend/app.js:368` 的 `islands` / `moods` 映射），同一活动详情页的「可展示风格」也是中文（认知/情绪/创造/探索）。同一份数据三处口径不一致。
- **现状**：`ops/templates/ops/activities.html:68` 直接渲染 `{{ row.island }} · {{ row.mood }}` 原始值；`ops/labels.py` 只覆盖了可展示风格（`cognitive/emotional/creative/exploratory`）。
- **证据**：`shots/ops2-06-activities.png`、`shots/ops2-detail-activities-348046bd-2143-4da1-9f1c-d4bd1d3af0a3-.png`（详情页「可展示风格」中文）。
- **建议改法**：岛屿/情绪加中文词表（放后端 labels，做法同 `SERVICE_KIND` 等），列表与详情统一显示中文、原始值进 `title`；或明确「岛屿/情绪是运营自由填写的标签」并在列表也按自由文本展示（那也要统一大小写口径）。
- **完善还是扩散**：完善。**工作量档位**：小～中（词表 + 两处渲染）。

### O-11 CA 账户列表仍用「指纹」指代凭据摘要，与家长端已改的口径不一致

- **用户在哪一步困惑**：CA 账户列表「机器人」列写 `未上报 指纹 79a3da0c`。家长端 P-09（T-012）已经因为「指纹」容易被理解成生物特征而把这两个字去掉，运营端还留着。
- **证据**：`shots/ops2-09-ca-accounts.png`。
- **建议改法**：与家长端统一为「凭据前 8 位」之类的说法（家长端账户页现用「机器人标识（前 8 位）」）。
- **完善还是扩散**：完善。**工作量档位**：小（一处模板 + 可能的列头文案）。

## 三、本轮复核通过（不重复申请，只记证据）

- **T-037 端到端复核（acceptance 指定项）：通过。** 两个不同家庭的儿童先后对同一 `event_id`（`reassess_mock_001`）回写：巡检甲（`ca_01M2RK23EA3QC47Q99S74WGWWX`）→ `200 {"event_id":"reassess_mock_001","accepted":false,…}`；巡检丙二（`ca_01M2RKP54HSF4SKT5S64PAS4VH`）→ 同样 `200`。不再出现 T-024 记录的 500 IntegrityError。截图 `shots/02-jia-after-decline.png`、`shots/38-bingyi-childB-after-decline.png`。
- **T-038 五条家长端修复 + 两条运营端修复：通过。** P-11 复测区块改「这次建议的原因」，同一屏「机器人服务给出的原因」只剩健康度一处（`countOldReasonLabel: 1`）；P-12 学习风格显示中文（模仿/开放/逆向/认知），正文无裸 code（`rawCodes: []`，6 个场景逐个探针）；P-13 单位「次」（`合成观察次数 3 次`，`countUnitCount: 0`）；P-14 阶段报告卡与成长观察窗口同为 `2026/09/01 08:00` 口径、正文无 ISO 串；P-15 成长观察区块有来源说明；O-06 家庭列表「家长」列显示「未填写」（`shots/ops-02-families.png`）；O-07 标签改「近 7 天新建档案（含已归档）344」+ 口径说明「与『在册儿童』不同口径，所以可能更大」。
- **T-039 八维中文名：通过。** 六个场景的成长周期报告八维均显示后端下发的中文名（语言/逻辑/音乐/空间/实践/自我认知/人际/自然成长代理），前端无第二套映射（`shots/01-jia-reports-reassess.png`、`shots/22-bingyi-normal-art.png`）。
- **T-035 复测 CTA：部分复核。** 「先不测」分支通过；`switch_recommended` 真/假两分支的结果卡本轮未重走（T-035 已有真实 Chrome 覆盖）。
- **T-033 四态与空态：通过。** `insufficient_data`（「还在收集互动数据，暂时不做判断。」）、`normal`（显分数与观察天数）、`watch`（轻提示、不显分数、不出复测入口）、`reassess`（出复测入口）逐个走查截图。
- **T-003 未修条目**：O-05（演示库残留带 HTML 标签的题库标题）本轮仍在题库列表可见，按 T-024 决定维持暂缓，不重复申请。
- **核验关联的两条路径**：错凭据 → `422 PROOF_INVALID`，对话框内显示 `PROOF_INVALID`；真实凭据 → `201 verified`，账户页显示「已核验 · 同步已启用」。错凭据那处文案另列为 P-17。

### P-17 核验凭据输错时对话框里显示内部错误码 `PROOF_INVALID`

- **用户在哪一步困惑**：账户与关联 → 机器人数据关联 →「核验并关联」→ 输入错误凭据 → 点「确认核验」：对话框底部只多出一行 `PROOF_INVALID`。家长看不懂，也不知道是「凭据不对」还是「系统坏了」。
- **现状**：`POST /children/<id>/associations/verify` 返回 `422 {"code":"PROOF_INVALID","message":"PROOF_INVALID",…}`，前端 `showError()` 把 `message` 原样渲染（`message` 字段本身就是 code，没有中文）。同页其他错误（如 `CONSENT_REQUIRED`）是否同样回落未逐一验证。
- **证据**：`shots/20-bingyi-verify-wrong-proof.png`、`walk-parent-c.json` 的 `bingyi verify wrong proof`（`status 422`、`body` 原文、`dialogText` 末尾 `PROOF_INVALID`）。
- **建议改法**：后端给 `PROOF_INVALID` 一句中文 `message`（如「凭据无法核验，请核对机器人标签上的凭据」），或前端按 code 映射一句家长能读懂的话（做法同 `api.js` 对 5xx 的 `errorBody()`）。
- **完善还是扩散**：完善。**工作量档位**：小。

## 四、稳定性（单列）

- 运营端 11 个一级页 + 7 个详情页：`pageerror` 0、console error 0（`walk-ops.json` / `walk-ops2.json` 的 `errors: []`）。
- 家长端本轮每次走查各有 1 条 `console: Failed to load resource: 401`（未定位到具体请求：请求日志里 `/api/` 无 401，疑为登录前的会话探测；不计为缺陷，如实记录）。其余 `pageerror` 0。
- 窄屏 390×844：家长端 `#reports` / `#home` / `#settings` 与运营端工作首页 / 家庭列表，`scrollWidth` 均 = `innerWidth` = 390，无横向溢出。
- 疑似不一致经查证伪一条：账户页「最近成功同步：2026/09/18 05:13」与测评页观察区块「尚无记录」同时出现——查库为同步任务完成前后的采样时序（`last_success_at` 落库 21:13:50Z），不是缺陷。

## 五、本轮未验证项（如实标注）

- **真源（`CA_DISPLAY_DATA_SOURCE=dingdong`）路径**：另起 8018/4174 实例复核，结论见 §六（本轮已覆盖；真源未配置 ⇒ 四个面应返回 `not_synced` + `reason=upstream_not_configured`）。
- **生产未触碰**：以上全部在本机 4173/4174/8017/8018 与本地库（127.0.0.1:55439）完成。
- **未做的写操作**（按 T-024/T-040 排除项）：8 个出站接口、主动解绑、发版部署、删除儿童数据、发布/停用内容版本、处理服务事项、冻结家庭。
- **`tests/flows.spec.js` 本轮未跑**：本地短信频控（IP 1 小时 ≥50 次）本轮已触发 429，无余量。
- **复测结果卡**：`switch_recommended` 真/假两分支的结果卡、`complete` 回写的界面表现，本轮被 P-16 挡住没走到（T-035 的 spec 已覆盖，但本轮没有独立复核）。

## 六、源开关复核（`CA_DISPLAY_DATA_SOURCE` 两种取值）

- `synthetic_fixture`（默认，4173/8017）：四个展示面按 6 个合成场景正常渲染，面板级「合成测试数据」徽标在位，数值与场景定义一致（`shots/01-jia-reports-reassess.png`、`shots/22-bingyi-normal-art.png`）。
- `dingdong`（真源未配置，8018/4174 独立实例，`shots/50-dingdong-mode-reports.png`）：**行为符合设计**——陪学伙伴、互动健康度、成长周期报告三处一致显示「机器人数据服务尚未接通 / 稍后自动重试。」（`not_synced` + `reason=upstream_not_configured`），不显示任何数值、也不挂「合成测试数据」徽标；本地同步那一路的「成长观察」照常工作（`合成观察次数 3 次` + 最近成功同步 + 来源说明），因为它的数据不来自展示面接口。全程 `pageerror` 0。
- 说明：真源模式本次只覆盖「未配置」这一支；`dingdong` 且已配置 base URL/API key 的真连分支仍未实测（T-028 阻塞级 B1/B2 未解）。
