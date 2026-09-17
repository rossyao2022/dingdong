# T-033 report：展示面 B —— 面一（人设）+ 面三（健康度四态），家长端 UI

- 任务：`T-033`（队列原文见 `.trellis/loop/queue.md`）
- 日期：2026-09-18（本地循环自驱轮）
- 依据：`.trellis/tasks/T-021/design.md` §1.1 / §1.3 / §3 / §5 的 B 行；上游数据层为 T-032 已落地的 4 读 2 写接口
- 状态：实现完成、真实 Chrome 验收通过、本地已提交；**未部署、未发版**

## 1. 目标

按设计 §1.1/§1.3 在家长端落地两个展示面：`#reports` 新增「陪学伙伴」面板（人设卡 + 下方「互动健康度」四态），`#settings` 机器人账户面板补一行只读当前人设名；`data_origin=synthetic` 时挂「合成测试数据」徽标；`availability != ready` 不显示数值；面板底部固定「这是互动情况的提示，不是对孩子的评价。」；换机后旧号人设只读展示并标「上一台机器人时期」。

## 2. 实际做了什么

### 2.1 新增纯函数模块（判定与 HTML 分离）

`frontend/companion.js`：`personaSection(data)` / `healthSection(data)` 把后端的信封（`availability` / `data_origin` / `persona` / `health`）判成"这一面该说什么、能不能显分数"，不产生 HTML。放独立模块是为了让四态分支被单测盯住（`.trellis/spec/frontend/index.md` 的开工检查第 2 条：能写成纯函数的规则另立模块）。

- 可用性文案表按设计 §3.1 的 7 值词表给出（`unbound` / `no_consent` / `not_synced` / `no_data` / `ready` / `stale` / `error`），`unbound` 与 `no_consent` 带「去账户与关联」的去向。
- 四态表 `HEALTH_STATES`：`insufficient_data` / `normal` / `watch` / `reassess`，未知 `status` 落「不做判断」分支（后端 T-032 已做同样归并，这里是第二道防线）。
- `stale` 仍按设计 §3.1 显示上次成功的数据并标注「最近一次同步没有成功，下面是上次成功同步的内容。」

### 2.2 `frontend/app.js`

- `#reports` 路由的 `Promise.all` 增加 `companion-persona` 与 `companion-health` 两个真实请求（不拦截、不造响应）。
- 新增 `companionPanel()` / `personaBlock()` / `healthBlock()` / `faceEmpty()` / `staleNotice()`，插在「初始测评」卡之后、「已生成报告」之前（设计 §1.1 指定位置）。
- 人设卡：人设名 + 后端下发的中文类型（`type_label`）+ 公开描述 + `metrics()` 复用现有 `.metric-list` 显示「匹配度 n / 100」+ 一句「匹配度是机器人服务按孩子的互动给出的（0–100），不是天赋分或能力分。」+ 学习风格 code 原样 + 权重版本走 `versionLabel()` 截断。
- 健康度：状态行 + 说明 + 后端下发的 `trigger_label`（「机器人服务给出的原因：近期互动偏少 / 连续多期互动偏少」）+ 分数与观察天数（仅 `normal`）+ 陈旧提示；面板底部固定那句评价边界。
- `#settings`：`robotPanel(rows, companion)` 增加一行只读「当前陪学伙伴：<名> · <中文类型>（只读，由机器人服务下发）」，取不到人设时不显示这一行。

### 2.3 其它

- `frontend/client.css`：新增 `.companion-head` / `.companion-state` / `.companion-health` / `.companion-panel .metric-list`，沿用既有 `--line` 令牌与 `@media (max-width: 760px)` 断点体系（无新断点）。
- `frontend/server.cjs`：静态白名单加 `companion.js`（新增顶层 `.js` 的既有硬要求）。
- `frontend/unit/companion.test.js`：18 项，覆盖四态文案与是否显分、未知 `status`、`stale`、非数字 `health_score`、缺 `availability`、`data_origin` 徽标判定。
- `frontend/tests/companion-panel.spec.js`：2 项真实 Chrome 用例（见 §3）。
- `frontend/README.md` 新增「CA 对接 C2：陪学伙伴面板」一节；`PROJECT_MEMORY.md` 更新最近一轮与当前状态；`.trellis/spec/frontend/testing-and-acceptance.md` 补两条本轮踩到的坑（同 hash 导航不重渲染、证据型 spec 会改写别人任务目录的图）。

## 3. 验证命令与真实输出

单测与语法检查：

```
$ cd frontend && npm run check
> node --check app.js && node --check api.js && node --check playworld.js && node --check server.cjs
（无输出，退出码 0）

$ cd frontend && npm run test:unit
ℹ tests 34
ℹ pass 34
ℹ fail 0
ℹ duration_ms 80.092125
```

真实 Chrome（Playwright `channel: "chrome"`，非拦截、非伪造响应）：

```
$ cd frontend && npx playwright test tests/companion-panel.spec.js tests/growth-window.spec.js tests/ca-account.spec.js tests/robot-account-row.spec.js --reporter=list
  ✓   1 tests/ca-account.spec.js:55:1 › NFC 承接：凭据不在地址栏留下，新号如实显示待接通 (5.4s)
  ✓   2 tests/ca-account.spec.js:91:1 › 同一台机器人再次绑定复用同一个号，不换号 (6.3s)
  ✓   3 tests/ca-account.spec.js:103:1 › 换机：确认弹窗讲清代价，旧号归档可查，新号重新开始 (9.3s)
  ✓   4 tests/ca-account.spec.js:145:1 › 绑定成功后停在账户页并高亮新号，标签不带路由也不跳回探索页 (6.7s)
  ✓   5 tests/ca-account.spec.js:189:1 › 新会话从标签进来：登录建档案后绑定，同样落在账户页 (4.9s)
  ✓   6 tests/ca-account.spec.js:211:1 › 手填绑定：空凭据就地提示，对话框不关 (4.2s)
  ✓   7 tests/ca-account.spec.js:251:1 › 绑定落点截图：桌面与 390×844 (5.1s)
  ✓   8 tests/ca-account.spec.js:283:1 › 窄屏下账户号不撑破页面 (6.3s)
  ✓   9 tests/companion-panel.spec.js:193:1 › 6 个合成场景逐个走查：人设卡与健康度四态（真实 Chrome） (32.0s)
  ✓  10 tests/companion-panel.spec.js:248:1 › 陪学伙伴面板：390×844 不横向溢出，账户页有只读人设行 (16.1s)
  ✓  11 tests/growth-window.spec.js:58:1 › 起 ≥ 止：就地提示 + 两个输入框标红，且不发请求 (4.7s)
  ✓  12 tests/growth-window.spec.js:102:1 › 合法区间照常查询（回归） (5.2s)
  ✓  13 tests/robot-account-row.spec.js:85:1 › 儿童详情给出机器人账户号与绑定状态，并能跳到 CA 账户页 (9.9s)

  13 passed (1.9m)
```

新用例断言的内容（全部通过）：未绑定态说「还没有绑定机器人 / 绑定后这里会显示陪伴数据。」且不显示任何数值；6 个 `ca_display_*` 场景逐个走查人设名 / 中文类型 / 公开描述 / 匹配度 / 学习风格提示；`normal` 显分数与观察天数、`watch` 只出轻提示（断言健康度区块内 `button, a` 数为 0，即不出复测 CTA）、`reassess` 与 `insufficient_data` 断言健康度区块内 `.metric-list` 数为 0（不出现分数，也不出现 0）；`watch` / `reassess` 出现后端下发的中文原因；面板级「合成测试数据」徽标与底部评价边界句存在；390×844 下 `document.documentElement.scrollWidth - innerWidth <= 1`；账户页出现只读人设行；`pageerror` 为空。

截图（8 张，真实 Chrome）：`.trellis/tasks/T-033/shots/` —— `unbound-desktop.png`、`normal-art-desktop.png`、`normal-science-desktop.png`、`watch-desktop.png`、`reassess-desktop.png`、`new-user-desktop.png`、`switch-desktop.png`、`reassess-mobile.png`（390×844）。

文档校验：

```
$ python3 scripts/audit_documents.py
{"markdown_files": 80, "local_links_checked": 500, "archived_files_checked": 85, "operations": 61, "schemas": 82, "errors": []}
```

## 4. 环境事实（本轮发现，与代码无关但影响验收）

本地开发库此前**没有跑过 T-032 的迁移**（`showmigrations` 显示 `[ ] 0009_careassessmentevent`）。因为 `persona_view()` 会查 `CaReassessmentEvent`，绑定机器人后 `/companion-persona` 直接 500，`#settings` 与 `#reports` 两页都变成「暂时无法读取这一页」。本轮补跑：

```
$ cd backend && uv run --no-sync python manage.py migrate
Applying core.0009_careassessmentevent... OK
```

本地库是 `127.0.0.1 55439 dingdong`（先确认过不是生产库才执行）。**生产库仍未迁移**，与 PROJECT_MEMORY 里「未部署、未发版」一致。

## 5. 未验证项与偏离

### 5.1 两处未实现（如实记录，未硬凑）

1. **换机后旧号人设只读展示（标「上一台机器人时期」）未实现。** 原因：四个展示面接口以 `child_id` 为键，服务层 `_resolve()` 只解析 `status="active"` 的 `CaAccount`，旧号的人设没有可读入口；补齐需要新增一个后端读接口（属契约变更，且要同步 openapi 与后端用例），超出本任务「家长端 UI」的范围。建议另开任务时一并决定是否给旧号人设开口子。
2. **`reassess` 态的复测 CTA 未实现（队列 goal 写了「`reassess` 出复测入口」）。** 判定依据：设计 §5 的任务拆分把「CTA 展示 → `response` 回写 → 承接既有测评 → `complete` 回写 → 新角色推荐」整块划给 D 任务（= T-035），§1.3 表内该行本身写「展示「重新测评」入口（见 1.4）」，§5 的 B 行只要求「四态分支与文案」。若在 T-033 里做按钮与回写，会出现两个任务共同拥有同一条写路径。因此本任务只呈现 `reassess` 的状态与文案（「建议重新测评 / 最近一段时间互动偏少。」），CTA 与回写留给 T-035。

### 5.2 一处与验收文本的口径差（按更严的验收实现）

队列 acceptance 写「`insufficient_data`/`watch` 界面不出现 health_score 数值」，设计 §1.3 展示规则写「四态里只有 `normal` / `watch` 展示分数」。两处对 `watch` 的说法不一致。本轮按 **acceptance 的更严口径**实现：`watch` 不出现分数（只出轻提示与观察天数）；这不违反设计 §1.3 表格里 `watch` 那一行的要求（该行只要求「轻提示『继续体验并观察』，不出复测 CTA」）。若后续判定 `watch` 应显分，改 `frontend/companion.js` 的 `HEALTH_STATES.watch.score` 一处即可，单测与浏览器用例会同时变红提醒。

### 5.3 未跑的东西

- 未跑前端全量 Playwright 套件（只跑了新用例 + 同页 `growth-window` + 改动面板所在的 `ca-account` / `robot-account-row`，共 13 项）。`flows.spec.js`、`sync-failure-visibility.spec.js` 等未跑。
- 未跑后端测试（本轮零后端改动）。
- 未做真实手机硬件验收，390×844 是视口模拟。
- 未部署、未发版，生产库未迁移，因此四个展示面在生产仍不可用。

## 6. 结论

面一与面三在合成数据源下可完整走通，四态分支、是否显分、空态/错误态文案都有客观验证（单测 18 项 + 真实 Chrome 2 项 + 回归 11 项）。**不得写成「已接通 DingDong」**：真源仍卡在 D10 base URL / D12 key，`CA_DISPLAY_DATA_SOURCE=dingdong` 未配置时如实返回 `not_synced`。
