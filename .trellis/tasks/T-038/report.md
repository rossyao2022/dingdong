# T-038 报告：P-11/P-12/P-13/P-14/P-15 + O-06/O-07 文案与展示小项打包

## goal

按 T-024 backlog 的建议改法修七条小项：

| 条目 | goal 给的改法 |
| --- | --- |
| P-11 | 复测区块的原因句改成「这次建议的原因」，或与健康度同字段（二选一，report 记明选择） |
| P-12 | 学习风格 code：后端加中文映射表（原 code 进 `title`），或家长端不展示该行（记明选择与理由） |
| P-13 | 合成 fixture 的 `"unit": "count"` 改 `"次"`（`testsupport/robot.py`） |
| P-14 | 阶段报告卡时间走与成长观察同一个格式化函数 |
| P-15 | 成长观察区块加一行来源说明 |
| O-06 | 家庭列表「家长」列空姓名回落「未填写」（沿用 T-019 思路） |
| O-07 | 工作首页「近 7 天新增儿童」标签写全口径 |

## 实际做了什么

### P-11 选了「改成『这次建议的原因』」

两处原因本来就是**两个不同字段**：健康度那句取 `health.trigger_reason`（`continuous_low_engagement` → 「连续多期互动偏少」），复测区块那句取事件 `trigger_type`（`low_engagement` → 「近期互动偏少」）。改成同一字段会丢信息，所以选「改名」：`frontend/app.js` 的 `reassessmentBlock()` 把 `· 机器人服务给出的原因：` 改成 `· 这次建议的原因：`。真实 Chrome 用例断言同一页「机器人服务给出的原因」只出现一次。

### P-12 选了「后端加中文映射表」

- `backend/dingdong_ca/core/services/ca_display.py` 新增 `LEARNING_STYLE_LABELS`（`imitation`→模仿、`open`→开放、`reverse`→逆向、`cognitive`→认知），与 `PERSONA_TYPE_LABELS` / `ENGAGEMENT_STAGE_LABELS` 同一做法。
- `_persona_out()` 增加 `learning_style_labels`：与 `learning_style_tags` **同序同长**，不在映射表里的取值给 `null`（前端不猜中文，也不把英文 code 当正文）。
- 前端 `personaBlock()`：正文渲染中文对照，原始 code 放进 `<span title="cognitive">`；未知取值显示「未识别取值」并把原 code 放 `title`。文案改成「学习风格：认知（中文对照由我方按取值直译，对方 code 表确认后核对；悬停可看原始取值）。」
- **为什么不去掉这一行**：这一行是设计 §1.1 要求展示的人设信息（对方 xlsx 表 6 里每个 mock 账号都带 `learning_style_tags`），删掉等于少给家长一项对方已下发的信息；映射表放后端还能与 `type_label` / `stage_label` 保持同一处维护。
- **如实记录**：对方 code 表还没确认（T-028 澄清清单确认级 C6 已列「`persona_type` 与 `learning_style_tags` 的 code 表」），这四个中文是按取值直译，文案里写明了这一点，拿到对方表后要核对。
- 契约同步：`设计/API/openapi.json` 的 `CompanionPersonaValue` 增加 `learning_style_labels`（含 `required`），`learning_style_tags` 的描述改成「界面不把它当正文（原始 code 只进 title）」；`scripts/audit_documents.py --generate` 重生成 `设计/API/请求响应与字段字典_V0.1.md` 与 `设计/数据库实际字段_M5.md`。**响应形状是加字段（向后兼容），没有改已冻结字段的含义。**

### P-13

`backend/dingdong_ca/testsupport/robot.py`：合成观察样例的 `"unit": "count"` 改 `"次"`（第 87 行），同文件校验该样例形状的 `validate_observation`（第 189 行）同步改成 `m["unit"] != "次"`——这两处是同一份合成输入的产出与自检，不改校验器新 fixture 会被自己的校验判成 `UPSTREAM_SCHEMA_INVALID`（本轮真实浏览器验收第一轮就是这么挂的，见「环境动作」）。这是**合成数据**，不是对方契约：openapi 里 `unit` 只是自由字符串，没有改契约语义。

### P-14

`frontend/app.js`：

- `date()` 改成零填充到分钟：`toLocaleString("zh-CN", {hour12:false, year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit"})` → `2026/09/01 08:00`（原来是 `2026/9/1 08:00:00`）。
- 新增 `dateOnly()` 给纯日期：`2026-09-01` 这类字符串直接改写成 `2026/09/01`，**不经 `new Date()` 解析**（否则会按 UTC 解析，西半球时区会差一天）；带时间的值走 `toLocaleDateString("zh-CN", …)`。
- `growthCyclePanel()` 的「本周期 … — …」改走 `dateOnly()`（原来是原始 ISO `2026-09-01 — 2026-09-15`）。
- 效果：`#reports` 上所有时间都是「`YYYY/MM/DD HH:mm`（本地时区、零填充、不显示秒）」或「`YYYY/MM/DD`」，与「成长观察」两个 `datetime-local` 输入框的显示口径一致。用例断言：页面正文里所有日期时间串都匹配 `^\d{4}/\d{2}/\d{2}( \d{2}:\d{2})?$`，且阶段报告卡的窗口文案等于两个输入框的值按同一规则改写后的字符串（`2026-09-01T08:00` → `2026/09/01 08:00`）。
- 这一改动同时作用于其它家长端页面的 `date()` 调用点（绑定时间、最近成功同步、建议时间、报告生成时间等），已用真实 Chrome 回归。

### P-15

`observationBlock()`（「成长观察」区块）在「最近成功同步」下加一行：

> 数据来源：这里是本机同步到的机器人行为观察；上面的「陪学伙伴」与「成长周期报告」来自机器人服务。两份来源不同，不能直接混成一个分数。

所有可用性状态（含 `unbound` / `no_consent` 空态）都带这一行，与「家长支持」页既有的同义句保持一致。

### O-06

- `backend/dingdong_ca/ops/templatetags/ops_labels.py` 新增 `account_name` 过滤器：只认 `user.name`，空则给「未填写」，**不回落手机号**（`display_name` 保持原行为，需要手机号的地方继续用它）。
- `backend/dingdong_ca/ops/templates/ops/families.html` 的「家长」列改用 `account_name`。
- 没有改 `User.display_name` property：它同时服务家庭详情、儿童详情、审计对象列等处，那些位置手机号是唯一可核对的标识（T-019 的成果不能一起回退）；「家长」列相邻就是「手机号」列，重复才是问题所在。
- T-019 的既有用例 `test_parent_without_name_falls_back_to_phone_not_internal_account` 断言不变（手机号仍出现在列表的「手机号」列），只校正了 docstring。

### O-07

`backend/dingdong_ca/ops/services.py`：指标标签改「**近 7 天新建档案（含已归档）**」，口径说明补成「创建时间在过去 7 天内的儿童档案数，含已归档；与“在册儿童”不同口径，所以可能更大。」`backend/docs/OPS_MANUAL.md` 的指标表同步。没有把两个数改成同口径：`在册儿童` 是「状态为正常的档案数」，`新建档案` 是「7 天内创建的档案数（含已归档）」，是两件不同的事，改口径会丢掉「新建」这个信息。

## 验证命令与真实输出

先失败（把 5 个后端源文件 `git stash push` 掉再跑，跑完 `git stash pop` 恢复）：

```
cd backend && uv run pytest tests/test_ca_display.py -k "persona" -q
→ 2 failed, 52 deselected, 1 warning in 18.51s
  （tests/test_ca_display.py:696: KeyError: 'learning_style_labels'）

cd backend && uv run pytest tests/test_ops_console.py tests/test_m3.py -k "parent_without_name or families_list_does_not_repeat or dashboard or verify_and_sync_stage_report_contract" -q
→ 3 failed, 3 passed, 66 deselected in 44.22s
  （test_families_list_does_not_repeat_phone_in_parent_column: assert 2 == 1
    test_dashboard_new_children_metric_states_its_scope: assert '近 7 天新增儿童' == '近 7 天新建档案（含已归档）'
    test_verify_and_sync_stage_report_contract: assert 'count' == '次'）
```

修复后：

```
cd backend && uv run pytest tests/test_ca_display.py -k "persona" -q
→ 2 passed, 52 deselected, 1 warning in 26.64s

cd backend && uv run pytest tests/test_ops_console.py tests/test_m3.py -k "parent_without_name or families_list_does_not_repeat or dashboard or verify_and_sync_stage_report_contract" -q
→ 6 passed, 66 deselected in 45.49s

cd backend && uv run ruff check dingdong_ca/core/services/ca_display.py dingdong_ca/ops/services.py dingdong_ca/ops/templatetags/ops_labels.py dingdong_ca/testsupport/robot.py tests/test_ca_display.py tests/test_m3.py tests/test_ops_console.py
→ All checks passed!
cd backend && uv run ruff format --check --target-version py313 <同上 7 个文件>
→ 7 files already formatted

cd backend && uv run --no-sync --directory backend python ../scripts/audit_documents.py --generate   # 重生成派生文档
python3 scripts/audit_documents.py
→ {"markdown_files": 80, "local_links_checked": 506, "archived_files_checked": 85, "operations": 61, "schemas": 82, "errors": []}

cd frontend && npm run check
→ exit 0
cd frontend && npm run test:unit
→ tests 65 / pass 65 / fail 0

cd frontend && npx playwright test tests/t038-copy-and-format.spec.js --reporter=list
→ 3 passed (43.7s)
  家长端五条（P-11 原因标签、P-12 学习风格、P-13 单位、P-14 时间口径、P-15 来源说明）(29.4s)
  家长端空态：成长观察还没关联也有来源说明（P-15 边界）(5.7s)
  运营端两条：O-06 家长列不重复手机号、O-07 新增口径标签 (7.8s)

cd frontend && npx playwright test tests/companion-panel.spec.js tests/growth-cycle-panel.spec.js tests/growth-window.spec.js tests/reassessment-cta.spec.js tests/reassessment-write-failure.spec.js tests/sync-failure-visibility.spec.js tests/robot-account-row.spec.js --reporter=list
→ 12 passed（首次 1 failed：growth-cycle-panel 断言写的是原始 ISO「本周期 2026-09-01 — 2026-09-15」，
   已按 P-14 改成「本周期 2026/09/01 — 2026/09/15」；改后 `npx playwright test tests/t038-copy-and-format.spec.js tests/growth-cycle-panel.spec.js` → 4 passed）
```

截图 10 张在 `.trellis/tasks/T-038/shots/`：`p11-reassessment-reason.png`、`p12-persona-learning-style.png`、`p13-observation-unit.png`、`p14-report-window.png`、`p15-observation-source.png`、`p11-p15-reports-desktop.png`、`p11-p15-reports-mobile.png`（390×844）、`p15-reports-unbound.png`、`o06-families.png`、`o07-dashboard.png`。逐张看过：P-11 只剩「这次建议的原因：近期互动偏少」；P-12 显示「学习风格：认知」；P-13 显示「合成观察次数 3 次」；P-14 报告卡显示「2026/09/01 08:00 — 2026/09/08 08:00」（与窗口输入框同口径）；P-15 来源说明整行可见；O-06「家长」列全部「未填写」、手机号只在「手机号」列；O-07 卡片显示「近 7 天新建档案（含已归档）317」与「在册儿童 316」，口径说明写明「含已归档；与“在册儿童”不同口径，所以可能更大」。

## 环境动作（不在改动清单里，如实记录）

1. **本地开发 Celery Worker 是 2026-09-17 09:46 启动的旧进程**，进程里还是改动前的 `testsupport/robot.py`（校验 `unit == "count"`）。新 fixture 写 `次`，于是第一轮真实 Chrome 验收里第一次同步直接 `UPSTREAM_SCHEMA_INVALID`、阶段报告不出现（用例在「查看阶段报告」处超时）。已按 `backend/README.md` 记录的命令重启本地 Worker（`nohup uv run celery -A config worker --pool=solo --loglevel=WARNING --queues=dingdong-ca`，日志 `/tmp/t038-celery-worker.log`），Beat 未重启；重启后同一用例通过。**生产不受影响**（fixture 只在 development/test/demo 可用）。
2. 本地开发库留下了本轮浏览器用例造的合成记录：若干「T038 文案与格式儿童 / T038 空态儿童 / T038 空姓名家长儿童 <随机后缀>」家庭与儿童、一个停用的运营账号（`ops-t038-*`，用例 finally 里 `is_active=False`）。

## 未验证项

- **`frontend/tests/flows.spec.js` 本轮未能跑完**：第一次混跑（flows + ca-account + parent-name-fallback）`16 passed / 1 failed`（flows 的「用途授权、22题、合成输入、真实初始报告」在「查看初始报告」处 20s 超时，页面停在「报告正在生成，页面会自动更新。」）；随后单独复跑 flows 时 `6 failed / 2 passed`，失败页面的 alert 是 **「验证码请求过多」**——本地短信频控按客户端 IP 1 小时内 ≥50 次拒绝（`core/api/accounts.py`），本轮多次浏览器验收把这个额度用满了，与本轮改动无关（页面根本没能登录）。**因此 `flows.spec.js` 覆盖的页面（探索、旅程、删除流程、移动端布局）本轮没有跑绿**；其中与本轮改动相关的只有 `date()` 的显示格式，已由 `t038` / `companion-panel` / `growth-cycle-panel` / `growth-window` / `reassessment-*` / `sync-failure-visibility` / `robot-account-row` / `ca-account` / `parent-name-fallback` 的用例覆盖到真实渲染。频控窗口（1 小时滚动）过后可复跑 flows 补上。
- 未跑后端全量套件（本轮只动文案、合成 fixture、两个运营展示点与契约加字段；已跑定向用例 + ruff + audit + 契约用例）。
- 真源模式（`CA_DISPLAY_DATA_SOURCE=dingdong`）下的展示面表现未用真实 Chrome 复核（对方未接通，缺 D10/D12）；P-12 的中文对照在真源模式下同样由后端映射，未单独验收。
- 生产未部署、生产库未迁移（本轮无迁移）。

## 偏离与理由

1. **P-12 选了「后端加中文映射表」而不是「不展示该行」**：见上文理由（对方已下发该字段、设计 §1.1 要求展示）。代价是响应加了一个字段并同步 openapi + 重生成派生文档；收益是与 `type_label` / `stage_label` 同一处维护、家长看得到中文。
2. **P-14 顺手把 `date()` 本身改了口径**（不只改阶段报告卡）：任务要求「走同一个格式化函数」，而页面上的「同页不一致」正是两套写法造成的；只改报告卡会留下「报告卡零填充、绑定时间不零填充」的新不一致。影响面是家长端所有 `date()` 调用点，已用真实 Chrome 回归。
3. **O-06 没有改 `User.display_name`**：那个 property 是 T-019 特意做的公共回落，家庭详情/儿童详情/审计对象列都需要手机号；本任务只解决「相邻两列重复」，「家长」列单点改用新过滤器，T-019 的既有断言全部保持通过。
4. **P-13 同时改了同文件的校验器**：不改就自相矛盾（新 fixture 会被自己的校验拒掉），这是同一份合成输入的产出与自检，不是放宽对方契约。
