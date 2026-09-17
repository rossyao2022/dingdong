# T-034 report：展示面 C —— 面二（15 / 30 天周期成长报告），家长端 UI

- 任务：`T-034`（队列原文见 `.trellis/loop/queue.md`）
- 日期：2026-09-18（本地循环自驱轮）
- 依据：`.trellis/tasks/T-021/design.md` §1.0 / §1.2 / §3.1 / §3.2 / §5 的 C 行；上游数据层为 T-032 已落地的 `GET /children/<child_id>/growth-cycle?period=15d|30d`
- 状态：实现完成、真实 Chrome 验收通过、本地已提交；**未部署、未发版**

## 1. 目标（队列原文）

按 design §1.2 实现：`#reports` 新增「成长周期报告」面板（置于既有「成长观察」之上），15/30 天固定 Tab（不提供任意区间，任意区间仍归成长观察）；companion delta 文案「陪伴值增长」、engagement 阶段中文名（映射表放后端）与 stage_progress、八维固定顺序条形（缺失维度显示「本周期无该维度数据」，不补 0 不插值）；八维标注「成长代理（对方算法产出，不是 CA 原始天赋分）」；合成徽标同 T-033。

## 2. 实际做了什么

### 2.1 新增纯函数模块 `frontend/growth-cycle.js`

`growthCycleSection(data)` 把后端信封判成"这一面该说什么、哪些数值能显示"，不产生 HTML；`dimensionRows()` 按固定顺序转八维行。可用性文案与陈旧提示**直接复用** `companion.js` 的 `AVAILABILITY_TEXT` / `STALE_NOTICE`，同一件事不出现两种说法（设计 §1.0 第二条：复用既有 7 值词表）。

- 八维顺序与中文名：`DIMENSIONS` 固定 8 项，中文名取对方字段注释（`材料/可检索文本/DingDong_CA_数据库字段与接口.md` 的 `*_growth` 行：语言 / 逻辑 / 音乐 / 空间 / 实践 / 自我认知 / 人际 / 自然成长代理）。
- 缺失维度：`null` → 该行 `value: null`，界面只出「本周期无该维度数据」；**值为 `0` 是数据**，照常出条形与数字。
- 空态分两句：`reason == "period_incomplete"` → 「成长周期还没走完，满 15 天后会生成第一份周期报告。」；其余 `no_data` → 「这个周期还没有报告。」。
- 未知阶段码（`stage_label` 为 `null`）→ `stageNote = "机器人服务下发的阶段名暂不可识别。"`，不把英文 code 当阶段名显示。
- `availability` 不是 `ready` / `stale` 时，`period` / `companion*` / `stage*` / `dimensions` 全部为 `null`。

### 2.2 `frontend/app.js`

- `#reports` 的 `Promise.all` 增加 `growth-cycle?period=${state.growthPeriod}`（真实请求，不拦截不伪造）。
- 新增 `state.growthPeriod`（默认 `15d`）、`growthTabs()`、`dimensionBars()`、`growthCyclePanel()`；面板插在「已生成报告」之后、「成长观察」`<h2>` 之前。
- Tab 走 `data-action="growth-period"`，`handleAction` 里改 `state.growthPeriod` 后 `await render()`，重新取该周期的报告；既有「成长观察」的窗口状态不受影响。
- 八维条形用原生 `<progress value=… max="100" aria-label="…">`（无行内样式），数值另给 `<strong>`。

### 2.3 其它改动

- `frontend/client.css`：`.growth-tabs` / `.growth-stage` / `.growth-dimensions`（grid 三列：维度名 / 条形 / 数值；缺失行两列）与 `@media (max-width: 760px)` 下的窄屏列宽（沿用既有断点，无新断点）。
- `frontend/server.cjs`：静态白名单加 `growth-cycle.js`。
- `frontend/package.json`：`check` 脚本补上 `ca-link.js` / `companion.js` / `growth-cycle.js` 三个模块的 `node --check`（原脚本只检查 `app.js` / `api.js` / `playworld.js` / `server.cjs`，T-033 新增的 `companion.js` 也没被覆盖）。
- 文档：`frontend/README.md` 新增「CA 对接 C3」一节并更新「已接入页面」；`PROJECT_MEMORY.md` 更新最近一轮与 T-032 段的"仍未做"；`.trellis/spec/frontend/testing-and-acceptance.md` 补四条本轮踩到的坑（视口不随 reload 复位、模块级状态被 reload 重置、用 `inject_fixture` 打印的账户号改单条 fixture、`bound_at` 决定空态说哪一句）。

## 3. 验证命令与真实输出

单测与语法检查：

```
$ cd frontend && npm run check
> node --check app.js && node --check api.js && node --check ca-link.js && node --check companion.js && node --check growth-cycle.js && node --check playworld.js && node --check server.cjs
（无输出，退出码 0）

$ cd frontend && npm run test:unit
ℹ tests 51
ℹ pass 51
ℹ fail 0
```

（新增 `unit/growth-cycle.test.js` 17 项；先写用例、模块缺失时红，实现后转绿。）

真实 Chrome（Playwright `channel: "chrome"`，非拦截、非伪造响应）：

```
$ cd frontend && npx playwright test tests/growth-cycle-panel.spec.js --reporter=list
  ✓  1 tests/growth-cycle-panel.spec.js:169:1 › 成长周期报告：15/30 天 Tab、周期空态与八维条形（真实 Chrome） (36.6s)
  1 passed (37.7s)
```

回归（本轮改动触及 `#reports` 路由与 `state`）：

```
$ cd frontend && npx playwright test tests/growth-window.spec.js tests/companion-panel.spec.js tests/robot-account-row.spec.js --reporter=list
  ✓  1 tests/companion-panel.spec.js:193:1 › 6 个合成场景逐个走查：人设卡与健康度四态（真实 Chrome） (31.0s)
  ✓  2 tests/companion-panel.spec.js:248:1 › 陪学伙伴面板：390×844 不横向溢出，账户页有只读人设行 (16.4s)
  ✓  3 tests/growth-window.spec.js:58:1 › 起 ≥ 止：就地提示 + 两个输入框标红，且不发请求 (5.4s)
  ✓  4 tests/growth-window.spec.js:102:1 › 合法区间照常查询（回归） (5.8s)
  ✓  5 tests/robot-account-row.spec.js:85:1 › 儿童详情给出机器人账户号与绑定状态，并能跳到 CA 账户页 (9.7s)
  5 passed (1.2m)
```

文档门禁：

```
$ python3 scripts/audit_documents.py
{"markdown_files": 80, "local_links_checked": 502, "archived_files_checked": 85, "operations": 61, "schemas": 82, "errors": []}
```

截图 9 张在 `.trellis/tasks/T-034/shots/`：`unbound-desktop.png`、`no-consent-desktop.png`、`new-user-desktop.png`、`normal-15d-desktop.png`、`tab-30d-empty-desktop.png`、`normal-30d-desktop.png`、`partial-dims-desktop.png`、`growth-mobile-390.png`、`stale-desktop.png`。

### 3.1 浏览器用例覆盖的断言（11 步，同一儿童顺序走完）

0a. 还没绑定机器人 → 空态说「还没有绑定机器人 / 绑定后这里会显示陪伴数据。」并给「管理关联与授权」入口，无任何数值。
0b. 已绑定但未同意同步用途 → 说「尚未同意机器人数据同步用途」，**不出现「暂无」字样**，无任何数值。
1. 新用户（绑定不满周期）→ 空态说「成长周期还没走完…」，面板挂「合成测试数据」徽标，`.metric-list` / `.growth-dimensions` / `progress` 数量均为 0。
2. `ca_display_normal_art`（15 天）→ 周期 `2026-09-01 — 2026-09-15`、当前陪学伙伴 `Mia`、陪伴值增长 `35`、周期初 12 → 周期末 47、阶段「成长 · 阶段进度 55%」、八维 8 行逐行核对标签/数值/`progress@value`（64/48/66/62/44/57/51/42）、成长代理标注句。
3. 断言「成长周期报告」面板的 y 坐标小于「成长观察」heading 的 y 坐标（位置要求）。
4. 切到「30 天」→ 该场景没有 30 天报告 → 空态「成长周期还没走完…」，`aria-pressed` 切到 30 天，无任何数值。
5. `CaAccount.bound_at` 前推 20 天 → `ca_display_normal_science`（30 天）→ 周期 `2026-09-01 — 2026-09-30`、`Newton`、陪伴值增长 `64`、阶段「深入 · 阶段进度 62%」、逻辑维 `79`。
6. 切到「15 天」→ 空态换成「这个周期还没有报告。」且**不出现**「成长周期还没走完」。
7. 改写该账户 15 天那条 fixture：`logical` / `spatial` 置 `null` → `.missing` 行 2 条、各含「本周期无该维度数据」且无 `progress` / `strong`；其余 6 维原样（语言维仍 `64`）。
8. 390×844 → 8 行仍在，`document.documentElement.scrollWidth - window.innerWidth <= 1`。
9. 注入合成故障码 `50001` → 面板出现「最近一次同步没有成功，下面是上次成功同步的内容。」且仍显示陪伴值 `35` 与八维 8 行。

全程收集 `pageerror`，收尾断言为空。

## 4. 未验证项与已知边界

- **真源（`dingdong`）模式未验证**：本轮全部证据都在 `CA_DISPLAY_DATA_SOURCE=synthetic_fixture` 下取得；真源缺 D10 base URL / D12 key，跑不通。
- **真源模式下两种空态无法区分**：`_read()` 在真源侧把 404 / `40401` 归成 `reason="40401"`，前端会落到「这个周期还没有报告。」这句；「绑定不满 15 天」那句只有合成模式会给 `period_incomplete`。未改后端（改它要动 T-032 冻结的响应语义与 openapi/字段字典）。
- **`period_incomplete` 的触发条件来自后端 `bound_at`**，不是「该周期没有数据」；本轮靠前推 `bound_at` 覆盖到第二句空态。这是后端既有行为，未改。
- **`engagement.index`（互动参与指数）未展示**：设计 §1.2 的展示规则只要求 `companion.delta`、`engagement.stage` + `stage_progress` 与八维，故不显示；响应里该字段照常存在。
- **`stale` 只在合成数据源下可达**（后端注释已写明：真源模式没有本地缓存），本轮用合成故障码 `50001` 覆盖。
- **未跑全量前端 Playwright 套件**（只跑了本轮 spec + 3 个相关回归 spec），也未跑后端套件（本轮无后端改动）。
- 复测 CTA 与回写闭环不在本轮范围（设计 §5 的 D = T-035）。

## 5. 偏离与理由

1. **八维中文名放在前端而不是后端**：队列 goal 只对 `engagement` 阶段名写了「映射表放后端」（T-032 已落地 `ENGAGEMENT_STAGE_LABELS`）。对方契约 `GrowthDimensions` 只有 8 个英文键、没有 label 字段（`设计/API/请求响应与字段字典_V0.1.md`、`设计/API/openapi.json`），而中文名在原始材料里是有的（`*_growth` 字段注释）。若走后端下发，就要改 T-032 冻结的响应形状 + 手改 openapi.json + 重生成字段字典 + 补后端用例，超出本任务 goal 与 acceptance。故把这张纯展示映射表放在 `growth-cycle.js` 并注明来源；`frontend/README.md` 与 `PROJECT_MEMORY.md` 都写明了这个取舍。
2. **空态文案依赖 `reason` 字段**：设计 §3.2 只给了两句中文，没说怎么判；本实现按后端已下发的 `reason == "period_incomplete"` 分流，未新增契约字段。
3. **`package.json` 的 `check` 脚本顺带补了 `companion.js` / `ca-link.js`**：新增模块要能过语法检查，而原脚本连 T-033 新增的 `companion.js` 也没覆盖。属本轮新文件的验证闭环，未改其它脚本。
4. **浏览器用例改写单条 fixture / 前推 `bound_at`**：6 个 `ca_display_*` 场景里没有「八维含 `null`」与「绑定已满 15 天但对方没有该周期」这两种输入，用 `inject_fixture` 打印的账户号 + `manage.py shell` 精确改写该账户的 fixture 行与 `bound_at`。这是真实 fixture 注入（与 `inject_fixture` 同一张表、同一机制），不是拦截假响应；已写进 `.trellis/spec/frontend/testing-and-acceptance.md`。
5. **面板内复用 `faceEmpty()` 与 `companion-state` 类名**：空态/错误态的"一句状态 + 可选去向"形状与面一/面三完全一致，复用同一 helper 与样式钩子，避免同一件事出现两套空态样式。

## 6. 注入的合成数据（供清理参考）

浏览器用例在本地开发库（`127.0.0.1:55439`，非生产）创建了 2 个合成儿童（随机手机号，本轮为「周期报告走查儿童」）及其家长账号、`active` CA 账户、`phase1-v1` fixture 行（含 1 条被改写的 15 天 growth 行与 1 条故障码 `50001` 行）、1 份阶段报告；`bound_at` 被前推 20 天。按既有纪律**只做状态变更、不物理删除**；清理方式同 T-030：把该账户的 fixture 行标记为已消费/失效，不删记录。
