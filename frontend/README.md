# DingDong 家长端 · M4

沿用参考仓库 `d754a5bf9ea8e71ca64a850d2e26aa321fe8ab38` 的兴趣岛、伙伴插画和视觉布局，业务逻辑重新接到 CA 后端。参考仓库未修改。使用原生 JavaScript 模块，无前端框架或业务 API mock。

## 本地启动

先按 `../backend/README.md` 启动 PostgreSQL、Redis、Django（8017）、Celery Worker 和 Beat，并执行 base/mock 初始化。然后在本目录执行：

```sh
npm ci
npm run dev
```

打开 http://127.0.0.1:4173 。使用未注册的测试手机号，点击获取验证码，输入字符串 `00000`。系统自动建立家长账户，再填写儿童称呼。可选性别、出生日期，没有年级。

前端服务只监听本机，静态文件采用允许清单，`/api/v1/` 流式转发到本机 8017；multipart 不落盘。当前配置仅供本地合成数据验证，不能用于公开部署。

## 验证报告和机器人关联

新儿童没有默认算法/机器人结果。创建后，从请求响应或浏览器 sessionStorage 的 `ca.navigation.child` 取得儿童 UUID，执行：

```sh
uv run --no-sync --directory ../backend python manage.py inject_fixture --child-id CHILD_UUID --scenario assessment_success
```

到“测评与报告”同意用途、按本次题库实际题量填写日常情境测试题，再提交五张确定性合成样例。真实指纹采集未开放。报告由实际 Worker 生成，失败/处理中/结果未知分别展示。

机器人链路另用新测试儿童：

```sh
uv run --no-sync --directory ../backend python manage.py inject_fixture --child-id CHILD_UUID --scenario sync_success
```

“账户与关联”使用凭据 `TEST-PROOF-CHILD_UUID`，同意同步用途并核验；CA 主动同步、生成阶段画像和报告。默认观察窗口是合成输入的 2026-09-01 至 2026-09-08（UTC），页面按设备时区展示。重复注入会重置该儿童测试输入，请使用隔离的测试儿童。

## 已接入页面

- 兴趣岛进入后端已发布活动；今日陪伴可筛选、开始、保存步骤、继续、完成或跳过。
- 成长旅程显示真实活动记录和统计；儿童切换分别读取各自档案。
- 测评固定服务端题库版本，答案逐题保存，刷新和再次登录可恢复会话；初始/阶段报告读取服务端版本。
- 「测评与报告」的「陪学伙伴」面板展示当前人设与互动健康度四态（见下节），「成长周期报告」面板展示对方的 15/30 天周期（见下下节）。
- 账户页编辑儿童资料、管理用途授权和本地机器人关联、提交帮助/修正/删除事项。
- 删除由后台技术人员执行；即使最后一个儿童被删除，家长账户页仍可查看去除儿童标识的回执。
- 伙伴引导方式和朗读仅影响网页，未接入机器人配置功能。

JWT access 只在内存，refresh 为 HttpOnly Cookie。sessionStorage 仅保存家长/儿童 UUID 导航提示，不保存手机号、儿童姓名、答案、报告、图片或令牌。退出清理页面状态并通知同源其他标签页。

## 测试

```sh
npm run check
npm test
```

浏览器测试需要本机 Google Chrome、已启动的后端/Worker/Beat。测试创建独立合成账户和儿童，通过初始化命令注入供应商输入，不拦截或伪造 API 响应；会保留合成测试记录。删除用例创建临时技术人员，真实登录后台处理，最后清理该工作人员。

结果与截图位于 `docs/`。后端完整回归、权限、并发和故障场景仍在 `../backend/tests/`。未接入真实短信、DingDong 字段协议和专业算法；本轮完成的是数据库合成输入下的业务闭环。


## M5 更新

“测评与报告”提供独立探索体验、测评流程测试与运营新发布题库入口。原参考四题已在后台维护，体验只展示本次选择，不生成天赋或能力结论。已发布版本固定，旧答卷不随新发布题干变化。可多选/选填、返回修改、从服务器恢复和读取冲突后的最新记录；已完成体验可从历史入口查看。

手机账户页可进入伙伴引导与家长支持。后台实际编辑/发布/复制、家长端新旧版本隔离及桌面/移动验收见 `tests/questionnaire-admin.spec.js`、`tests/flows.spec.js` 与 `../backend/docs/M5_RESULT.md`。运行 `npm test` 使用真实 Chrome 和当前数据库，临时内容工作人员会停用，测试题库发布后在验收结束停用，不删除旧答卷。


## M6 运营后台与共享测试工具

家长端本身在 M6 未改动，认证与权限逻辑保持原样。M6 新增的是运营后台（`/ops/`，独立 Django 应用，模板与静态资源都在后端，不在本目录），以及本目录下的浏览器验收用例 `tests/ops-console.spec.js`（8 项真实 Chrome 场景）。

三个 spec 共用 `tests/support.js`，其中 `uvBin()` 解析 `~/.local/bin/uv` 等绝对路径——Playwright 子进程的 PATH 不含 `~/.local/bin`，直接写 `uv` 会 `spawnSync uv ENOENT`。

```sh
npx playwright test tests/flows.spec.js tests/questionnaire-admin.spec.js tests/ops-console.spec.js --reporter=list
```

若 `frontend/test-results` 里堆了大量失败截图，Playwright 清理该目录可能被本地批量删除保护拦下，用 `--output=/tmp/dingdong-pw-out` 指定输出目录即可绕开。

M6 浏览器验收共 17 项通过（家长端 8 + 后台题库 1 + 运营后台 8）。运营后台用例覆盖登录失败与退出、家庭查询与儿童详情、题库草稿到发布、活动维护、报告查看与生成异常重试、服务事项处理、越权拦截、窄屏可用性，并收集 `pageerror`：任何脚本异常都会让用例失败，而不是变成模糊超时。结果见 `../backend/docs/M6_OPS_RESULT.md` 与 `../backend/docs/evidence-ops/`。

## M7 家长端档案冲突恢复（v0.3.5）

家长在「账户与关联」编辑儿童档案时，如果这份档案在你打开编辑之后被其他页面（运营后台、技术后台或另一个标签页）改过，服务端会拒绝这次保存，**不会覆盖对方的内容**。v0.3.4 及以前，家长端一被拒绝就重新读取最新档案并重建整个表单，家长刚填写的称呼、性别、生日会被服务端值直接替换——数据没被覆盖，但这次填写被静默丢弃。

v0.3.5 起，被拒绝时**不重建表单**：

- 家长填写的称呼、性别、出生日期原样留在输入框里；
- 提示区出现「资料已被更新，本次修改没有保存」，用家长能理解的语言说明，不出现 409 / 修订号 / 数据库这类词；
- 提供三条路径：
  - **查看最新资料** —— 并排显示"我的填写（还没保存）"与"最新资料"，只读，不动输入框；
  - **载入最新资料** —— 二次确认（说明"无法找回"）后才用服务端内容替换输入框，并在最新修订上继续编辑；
  - **用我的修改保存** —— 先看最新资料，再确认；提交基准是家长看到的那一版，所以这期间若又有人改过会**再次**被拒绝，输入继续保留，提示更新为"资料又被更新了一次"。
- 读取最新资料失败、连接中断或登录失效时只给提示，不清空输入、也不显示保存成功；
- 冲突还没处理完就点"关闭"，会先问一句"你还有没有保存的修改"，避免新增丢失路径。

公网真实浏览器验收用例在 `deployment-tests/parent-conflict-recovery.spec.js`（5 项：字段保留与服务端未被覆盖 / 查看与取消不丢输入 + 明确确认才替换 + 在最新修订上保存成功 / 恢复期间再次冲突 / 读取失败不清空 / 窄屏同一流程）。凭据走环境变量，不写入仓库：

```sh
DD_OPS_ADMIN_USER=... DD_OPS_ADMIN_PW=... \
  PUBLIC_HTTP_URL=http://110.42.225.196/dingdong/ \
  npx playwright test --config=playwright.public.config.js \
  parent-conflict-recovery.spec.js ops-p1-acceptance.spec.js
```

`deployment-tests/helpers.js` 是这两份 spec 共用的辅助函数（登录、家庭检索、家长建档、编辑档案对话框等）。交付与验收记录见 `../deploy/PARENT_CONFLICT_RECOVERY_20260914.md`。

## CA 对接 C1：机器人账户（`ca_account_id`）与 NFC 承接（2026-09-16）

对接文档 V1.0 表 0 要求 CA 侧提供稳定 `ca_account_id`。本目录实现的是**家长侧承接与展示**，号码本身的生成规则见 `../设计/CA对接_C1_ca_account_id设计_20260916.md`。

- **承接入口**：机器人上的 NFC 标签把凭据写进 URL（`?nfc_token=…` 或 `#settings?nfc_token=…` 两种写法都认）。页面读到后**立即用 `history.replaceState` 把凭据从地址栏摘掉**，只留在内存里——否则它会跟着浏览历史、截图和转发出去的链接一起走。家长未登录时先登录，页面渲染完自动弹绑定框，不必自己找入口。
- **绑定要选孩子**：一台机器人只服务一个孩子，所以对话框里必须选服务对象。同一台机器人再次绑定**复用原来的号**，不换号。
- **两个状态维度分开显示**：`使用中 / 已归档` 说的是我方还用不用；`待接通 / 已绑定` 说的是对方有没有确认接通。新号建出来就是「待接通」（对方端点还没开通），**不是出错**，界面不会为了让页面好看提前显示「已绑定」。
- **换机是显式两步**：确认弹窗讲清代价（换号后对方侧成长周期与阶段对比不会延续到新号），确认后先归档旧号、再为新机器人发新号。归档的旧号在「机器人账户」里只读可查，**永不重用**；换机前生成的报告按孩子保存，仍在「测评与报告」里。
- **归档一并结束本地关联**：归档旧号时服务端同时把该儿童已核验的机器人关联置为结束态（`revoked` + 停用同步检查点），所以归档后账户页的「机器人数据关联」回到「核验并关联」、成长观察说「尚未关联机器人数据」、三个展示面说「还没有绑定机器人」——同一页不会一边说没绑机器人一边说同步已启用。
- **模块与白名单**：读/摘 URL 参数、状态词、换机信号判定都在 `ca-link.js`（纯函数，可单测，不碰 DOM）。**新增顶层文件必须同步 `server.cjs` 的静态允许清单**，否则本地预览 404。

测试：

```sh
node --test unit/*.test.js                                   # ca-link 纯函数 13 项
npx playwright test tests/ca-account.spec.js --reporter=list  # 真实 Chrome 4 项
```

浏览器用例覆盖：凭据不在地址栏留下且 hash 路由还在 / 新号如实「待接通」且接口不回凭据原文 / 同机复用同号 / 换机两步 + 旧号归档可查 / **390px 下 29 位定长号码不撑破页面**。

用例里的机器人凭据**每次运行都随机生成**：后端对「活跃账户的机器人凭据」是**全局**唯一约束，写死固定串会让第二轮跑的时候撞上第一轮留下的活跃号而全红——那是设计使然，不是缺陷。

验收截图（真实 Chrome，隔离库）：`docs/ca-account-settings-desktop.png`（账户与关联 · 机器人账户）、`docs/ca-account-settings-mobile.png`（390px）、`docs/ca-account-replace-dialog.png`（换机确认）、`docs/ops/ca-account-list.png` 与 `docs/ops/ca-account-note.png`（运营后台只读页）。

想在不碰共享演示库的情况下跑这组用例，见技能 `dingdong-local-browser-acceptance`（自建临时库 → 常驻起 8017/4173 → 跑用例 → 丢库）。

## CA 对接 C2：陪学伙伴面板（人设 + 互动健康度，2026-09-18）

「测评与报告」在「初始测评」卡之后、「已生成报告」之前新增**陪学伙伴**面板：上半是人设卡，下半是「互动健康度」。数据来自后端 `GET /api/v1/children/<child_id>/companion-persona` 与 `.../companion-health`（后端实现见 `backend/dingdong_ca/core/services/ca_display.py`），本目录只做呈现。

- **四态分支**：`insufficient_data` 只说「还在收集互动数据，暂时不做判断。」；`normal` 显健康度分数与观察天数；`watch` 只出轻提示、**不出复测 CTA**；`reassess` 只出「建议重新测评」文案。四态里只有 `normal` 出现分数，其余连 0 都不显示。未知 `status` 落「不做判断」分支，不按 `normal` 展示。
- **判定逻辑在 `companion.js`**：`personaSection()` / `healthSection()` 是纯函数（不碰 DOM），负责四态分支、是否显分、空态与错误态文案，由 `unit/companion.test.js` 盯住；`app.js` 只把返回值拼成 HTML。新增顶层 `.js` 要同步 `server.cjs` 的静态白名单（照 C1 那节）。
- **文案纪律**：`match_score` 写「匹配度 n / 100」并注明由机器人服务产出、不是天赋分或能力分；`persona_type` / `trigger_reason` / 学习风格取值的中文由后端下发（`type_label` / `trigger_label` / `learning_style_labels`），前端不维护映射表；学习风格正文只给中文对照，对方原始 code 只进 `title`（见 C5 一节）；内部 code 不进正文。**家长端只说「来自机器人服务，中文名仅供参考」**——「我方直译 / 对方 code 表尚未确认」这类对接状态是内部信息，不进家长端（T-043 的 P-18）。
- **合成标注纪律（2026-09-20 新口径）**：家长端**不再显示**合成标注——`testTag()` 为空实现（app.js 里保留调用点），`data_origin == "synthetic"` 不挂任何徽标；「不冒充真实供应商接入」的底线不变，但约束移到测试与运营侧（测试脚本断言家长端页面无「合成/本地测试/测试环境」字样，运营侧文案不受影响）。`availability != "ready"`（含 `stale`）按后端给的说法显示，不显示任何数值——尤其不把 `not_synced`（服务没接通）说成「暂无数据」。
- **复测 CTA 不在本面板的这一步**：`reassess` 态的回写闭环（按钮 → `response` → 承接测评 → `complete`）是后续任务，本面板只呈现四态本身。

测试：

```sh
npm run check && npm run test:unit                              # 单测含 companion 18 项
npx playwright test tests/companion-panel.spec.js --reporter=list   # 真实 Chrome 2 项
```

浏览器用例走 6 个 `ca_display_*` 合成场景（`inject_fixture --scenario ca_display_normal_art` 等）逐个截图到 `../.trellis/tasks/T-033/shots/`，覆盖未绑定态、四态文案与是否显分、390×844 不横向溢出、账户页只读人设行，并收集 `pageerror`。

两个踩过的坑：**同一个 hash 的 `page.goto()` 与点导航不会触发重渲染**（`to()` 只在 hash 变化时 render），用例要真正 `page.reload()` 才看得到新注入的输入；建档成功后应用会自己 `to("explore")`，不等它落稳就导航会被覆盖。

## CA 对接 C3：成长周期报告（15 / 30 天，2026-09-18）

「测评与报告」在「已生成报告」之后、「成长观察」之上新增**成长周期报告**面板。数据来自后端 `GET /api/v1/children/<child_id>/growth-cycle?period=15d|30d`（后端实现见 `backend/dingdong_ca/core/services/ca_display.py`），本目录只做呈现。

- **两份数据、两个来源，不合并**：本面板是对方的 `growth_period`（固定 15 / 30 天，非正式算法、非家庭自报）；「成长观察」是我方观察记录 + 任意窗口，保持原样不动。面板内只给「15 天 / 30 天」两个固定 Tab，**不提供任意日期区间**——任意区间归「成长观察」。
- **Tab 状态在 `state.growthPeriod`**：默认 `15d`，切 Tab 走 `data-action="growth-period"` 重新取该周期的报告。它是模块级状态，所以 `page.reload()` 会把它复位（浏览器用例每次重载后都要重新点 Tab）。
- **判定逻辑在 `growth-cycle.js`**：`growthCycleSection()` 是纯函数（不碰 DOM），负责空态/错误态文案、哪些数值能显示、八维顺序与缺失维度，由 `unit/growth-cycle.test.js` 盯住；可用性文案与陈旧提示直接复用 `companion.js` 的 `AVAILABILITY_TEXT` / `STALE_NOTICE`，同一件事不出现两种说法。
- **八维成长代理**：按固定顺序渲染条形（原生 `<progress>`），某一维为 `null` 时该行显示「本周期无该维度数据」，**不补 0、不插值**（值为 `0` 是数据，照常显示）；区块下方固定标注「成长代理（对方算法产出，不是 CA 原始天赋分）。」。**中文维度名由后端 `growth_dimension_labels` 下发**（键与 `growth_dimensions` 同序同集，映射表在 `ca_display.py`，与 `type_label` / `stage_label` 同一做法，见 T-039）；前端只保留八维的固定**键顺序** `DIMENSION_KEYS`，不再维护第二套中文映射，后端没给该维名字时兜底「未识别维度」、不把英文 code 当维度名显示。
- **空态分两句**：`reason == "period_incomplete"`（绑定不满 15 天）说「成长周期还没走完，满 15 天后会生成第一份周期报告。」；其余 `no_data` 说「这个周期还没有报告。」。真源模式下 404 只带回业务码 `40401`，区分不出两者，会落到后一句（只有合成模式会给 `period_incomplete`）。
- **数值纪律同 C2**：`availability` 不是 `ready` / `stale` 时不显示任何数值（连 0 都不显示），也不出八维条形。`stale` 照常显示上次成功的数据并标注。合成徽标已按 2026-09-20 新口径取消（`testTag()` 空实现）。
- **不展示的字段**：`engagement.index`（互动参与指数）与 `period.days` 的原始字段名不进界面——设计 §1.2 的展示规则只要求 `companion.delta`、`engagement.stage` + `stage_progress` 与八维。

测试：

```sh
npm run check && npm run test:unit                                  # 单测含 growth-cycle 19 项
npx playwright test tests/growth-cycle-panel.spec.js --reporter=list # 真实 Chrome 1 项（11 步走查）
```

浏览器用例覆盖：未绑定与未授权两种空态、新用户空态、15 天与 30 天各自的正常态、Tab 切换后的两种空态（周期没走完 / 这个周期还没有报告）、缺失维度（改写单条 fixture 造出两个 `null`）、陈旧态、390×844 不横向溢出，并断言「成长周期报告」在「成长观察」之上、收集 `pageerror`。截图在 `../.trellis/tasks/T-034/shots/`。

## CA 对接 C4：复测 CTA 与回写闭环（2026-09-18）

「测评与报告」的**陪学伙伴面板 → 互动健康度**这一段里新增复测区块（设计 §1.4 规定的位置，全产品唯一的复测入口）。数据来自后端 `GET /api/v1/children/<child_id>/reassessment` 与两条回写 `POST .../reassessment/<event_id>/response`、`POST .../reassessment/<event_id>/complete`（后端实现见 `backend/dingdong_ca/core/services/ca_display.py`），本目录只做呈现与承接。

- **四步状态机**：`accepted` 为 `null` → 建议文案 + 建议时间 + 原因 + 「重新测评 / 先不测」；`accepted=false` → 一行「已选择暂不重新测评」+「查看当时的建议」（**不再给第二个「重新测评」按钮**：同一事件换个答案会被后端按 422 拒绝，给按钮就是给死路）；`accepted=true` 未回写 → 「开始复测」；已回写 → 结果卡。没有待处理建议（含 `no_data`：契约里 404 就是「没有建议」）时整块不出现，不留空框、不报错。
- **承接既有测评流程**：点「开始复测」走的就是 `beginAssessment()`（用途授权 → 22 题 → 合成样例），不新建第二套测评入口；这次测评跑完后由 `writeBackReassessment()` 用它的 id 回写 `complete`，`request_id` 用 `reassessment-complete:<event_id>`（重放安全）。
- **只回写本次承接的那次测评**：`state.reassessmentSession` 记下「开始复测」创建出来的测评 id，回写只认它——刷新过页面就认不出来，宁可不回写也不把别的测评 id 写过去。
- **结果卡两个分支**：`switch_recommended=true` 展示新角色名 + 匹配度 + 当前角色匹配度 + 匹配度变化，并注明「确认入口尚未开放」；`false` 只说「保留当前角色」，**不展示新角色名**。`auto_switch` 恒为 `false`：对方响应里出现别的值也不照抄，前端没有任何自动切换路径（设计 §1.4 的不变量）。设计第 4 步的「由家长确认后才切换」在已冻结的三条接口里没有落点（澄清清单 D9 待对方答复），所以这里只呈现建议、不做假按钮。
- **刷新后只剩中性说明**：`GET` 的事件字段里没有 `new_persona_name` / `match_score` / `switch_recommended`（只有 `new_assessment_id` / `new_persona_id`），完整结果只存在于本轮会话的 `complete` 响应里；重载后说「这次复测的结果已经回写。换不换陪学伙伴由你决定，我们不会自动更换。」
- **回写失败的落点就在复测区块自己这一块**（T-037）：失败时不抛给 `act()` 的 catch——`showError()` 只写页面上第一个 `#main .form-error`，在 `#reports` 里那是「成长观察」的窗口表单，家长会在那儿看到一句跟自己操作无关的报错。现在 `respondReassessment()` 把错误存进 `state.reassessmentRespondError`，区块内渲染「这次没写成功，请重试。」+「重试」按钮；重试按同一个答案、同一个 `request_id` 重放（幂等），成功即回到正常状态。5xx 的文案由 `api.js` 的 `errorBody()` 统一成「服务暂时不可用，请稍后再试。」，不再把解析 HTML 调试页失败得到的「服务返回了无法识别的响应。」当用户文案。
- **判定逻辑在 `reassessment.js`**：`reassessmentSection()` / `completionCard()` 是纯函数（不碰 DOM），由 `unit/reassessment.test.js` 盯住；徽标沿用面板级那一个 `testTag()` 空实现（同一个面板不挂第二个，2026-09-20 起家长端不显示合成标注）。

测试：

```sh
npm run check && npm run test:unit                                          # 单测含 reassessment 10 项 + api.js 的 errorBody 4 项
npx playwright test tests/reassessment-cta.spec.js --reporter=list           # 真实 Chrome 3 项
npx playwright test tests/reassessment-write-failure.spec.js --reporter=list # 真实 Chrome 2 项（失败落点 + 同一 event_id 两个账户）
```

浏览器用例覆盖：真/假两个 `switch_recommended` 分支各走一遍完整四步（含真实 22 题测评与两条真实 POST 的入参、响应断言）、`accepted=false` 后只剩一行且可展开、无建议时整块不出现、390×844 不横向溢出、结果卡上没有切换按钮、人设卡仍是原角色（没有自动切换），并收集 `pageerror`。截图 7 张在 `../.trellis/tasks/T-035/shots/`。

**同一个 `event_id` 现在可以由多个账户各自回写**（T-037 改的模型约束）：`ca_reassessment_event.event_id` 的唯一性从**全局**收窄为 `(ca_account, event_id)`（迁移 `0010`）——事件 id 由对方发放、跨账户可能重名（两个复测 mock 账号就共用一份 fixture），而服务层的读写一直按这两键查，约束比服务语义更严会让第二个儿童回写时撞唯一约束拿 500。`reassessment-cta.spec.js` 里的 `scopeEvent()` 留着不影响，只是不再是必需；`reassessment-write-failure.spec.js` 就用 fixture 原样的 `reassess_mock_001`，两个不同家庭的儿童先后回写都通过。

## T-041：复测承接对话框被轮询关掉 + 核验失败文案（2026-09-18）

- **对话框不再被重渲染关掉（P-16）**：`render()` 以前一进来就调 `stopWork()`，而 `stopWork()` 会 `$("#dialog").close()`；`#reports` 在观察未就绪（`not_synced` / 阶段画像处理中）时每 3 秒重渲染一次，于是复测「开始复测」打开的同意对话框只开约 1.7 秒就被关掉，家长无从继续。现在把「离开上下文」与「重渲染」拆开：`leaveContext()`（关对话框 + 清 `childEdit`）只由 `to()` 与 `hashchange` 入口在 `render()` 之前调用；`render()` 自身只 `clearTimeout(pollTimer)`；对话框打开期间轮询由 `schedulePoll()` 挂起（置 `pollPending`），`<dialog>` 的 `close` 事件里再补一次渲染。「提交成功后重渲染」的对话框流程（核验关联、编辑儿童档案、归档账户号、提交申请事项、`case "close"`）改为自己显式调 `closeDialog()` 收尾。`render()` 仍保留取消待执行轮询与 `speechSynthesis.cancel()`（朗读不跟着重渲染停会盖住新一题/下一步的内容），拆开的只是「关对话框 + 清 `childEdit`」这两件属于「离开上下文」的事。
- **核验凭据输错给中文（P-17）**：`PROOF_INVALID` 的文案改由后端给（`backend/dingdong_ca/core/api/robots.py` 的 `PROOF_INVALID_MESSAGE`：凭据无法核验，请核对机器人标签上的凭据，或重新绑定机器人。），前端照旧渲染 `message`，不再把内部码丢给家长。选后端而不是前端映射，是因为运营端与其它客户端读的是同一个 `message`。

测试：

```sh
npm run check && npm run test:unit                                            # 单测 67 项
npx playwright test tests/t041-dialog-and-labels.spec.js --reporter=list      # 真实 Chrome 3 项（P-16 / P-17 / 运营端四条）
```

P-16 用例的判定不靠截图：先等 `#reports` 的 `growth-overview` 轮询真实发生，点「开始复测」后断言对话框打开期间又跨过一次轮询周期且 `#dialog.open` 仍为 `true`，再完成「同意并开始」进入测评。回退 `app.js` 后该用例在 `#dialog.open` 处失败（逐字输出见 `../.trellis/tasks/T-041/shots/p16-before-fix-dialog-closed.log`）。截图 10 张在 `../.trellis/tasks/T-041/shots/`。

**这条用例的已知脆弱点**：它靠「观察还没同步/阶段画像还没出」这段时间里真实存在的轮询，所以断言分两段——先要求轮询确实又走了一轮（`overviewCalls` 变大），再要求对话框还开着。如果点「开始复测」之前轮询已经停了（阶段报告已生成），它会卡在前一段而不是后一段，报 `Expected: > N / Received: N` 这种与对话框无关的失败。这类失败只会假红、不会假绿（对话框没打开或已被关掉时后一段必然失败）。要彻底去掉这个时序依赖，得让「观察未就绪」在断言窗口内可控（例如改用 `not_synced` 场景），留给下一次巡检评估。
