# 界面与“组件”约定

家长端组件仍是返回 HTML 字符串的原生函数。v0.3.16 起，按钮、操作组、基础面板、页头和空态放在 `frontend/ui-components.js`；页面和 Storybook 共用这些函数，其他业务视图仍由 `app.js` 拼装。

## 现成的构件（先找它们，不要再造）

| 函数 | 作用 | 位置 |
| --- | --- | --- |
| `esc(v)` | 统一的 HTML 转义（`& < > " '`） | `ui-components.js` |
| `$(s)` | `document.querySelector` 简写 | `app.js` 顶部 |
| `head(title, desc, action)` | 页头包装，调用 `pageHead()` | `app.js` / `ui-components.js` |
| `empty(title, text, action)` | 空态包装，调用 `emptyState()` | `app.js` / `ui-components.js` |
| `button(action, label, data, secondary)` | `button.button[data-action]` | `ui-components.js` |
| `actions(...items)` / `panel(title, body)` | 操作组与基础面板 | `ui-components.js` |
| `testTag()` | “合成测试数据”标签 | `app.js` |
| `showDialog(title, html)` | 打开 `<dialog>` 并注入内容，自带标题、关闭按钮与 `.form-error[role=alert]` | `app.js` |
| `toast(text)` | 5 秒轻提示（`#toast`，`role="status"`） | `app.js` |
| `accountRow(a)` / `robotPanel(rows)` | 机器人账户行与面板 | `app.js` |
| `reportCards(rows)` / `timeline(rows)` / `receiptList(rows)` / `metrics(rows)` | 列表类区块 | `app.js` |
| `filters()` / `observationBlock(obs)` / `windowForm()` | 活动筛选 / 观察区块 / 时间窗表单 | `app.js` |

新增页面先看能不能用这些拼；确实需要新构件就照它们的形状写（返回字符串、参数决定内容、不持有状态）。

## 转义与属性拼接

- 任何来自服务端或用户的文本插入 HTML 前必须 `esc()`。整份文件都按这个规则做，没有例外。
- 属性值同样要 `esc()`：`value="${esc(c.name)}"`、`data-value="${k}"`。
- `button(action, label, data, secondary)` 的第 3 个参数是**原样拼接的属性片段**（如 `data-id="${a.id}"`），调用方负责转义。涉及外部字符串时照 `robotPanel` 的写法：`data-id="${esc(active.ca_account_id)}"`。这是最容易漏的一处。
- 表格/列表里的长串（29 位 `ca_…` 号码、UUID）依赖 CSS 折行，不要靠截断掩盖（见 `styling-and-responsive.md`）。

## 交互动作的接法

- 新交互 = 一个 `data-action="xxx"` + `handleAction` 的 `switch` 里加 `case`。动作名用“动词-名词”小写连字符风格，现有取值可作参照：`begin-exploration`、`child-conflict-load-confirm`、`confirm-retire`、`more-records`。
- 需要参数就加 `data-*`（`data-id` / `data-kind` / `data-purpose` / `data-value`），在 case 里从 `el.dataset` 取。
- 弹窗里的表单在打开时绑 `onsubmit`，用 `act(...)` 包住异步逻辑并传 `e.submitter`。
- 只有“关闭”这一个动作是全局共用（`data-action="close"`）；儿童档案冲突未处理时会先转成确认提示再关（见 `api-conventions.md`）。

## 文案与状态词

- 全部面向家长的简体中文，不出现技术词。冲突提示的措辞是基准：`renderChildConflict` 里写“资料已被更新，本次修改没有保存”，`conflictReadMessage` 里写“现在连不上服务，没能读到最新资料。你填写的内容还在这里。”——**不出现 409、修订号、数据库、API**。
- 家长日常页面只放当前能做的事、操作后果和必须告知的限制。题库发布过程、算法版本、来源对照、同步时间戳、内部账户规则等内容若不帮助家长做决定，就直接删掉；不要换成白话继续占页面。排障编号和报告依据确需保留时，收进可主动展开的详情。
  - 错误示例：体验卡在「开始探索体验」按钮后再写“题目来自后台已发布的体验题库”。正确做法：卡片只保留体验性质与按钮；题库如何发布属于运营界面。
  - 机器人卡默认只显示绑定状态和操作；支持排障时才展开 `<details><summary>查看设备信息</summary>…</details>` 查看编号。
- 状态词集中成映射，不要在模板里散写中文：
  - `statusNames`（会话状态：`draft` / `ready` / `processing` / `needs_recapture` / `result_unknown` / `completed` / `cancelled` / `expired`）
  - `GENDER_TEXT`、`islands`、`moods`、`styles`
  - `ca-link.js` 的 `ACCOUNT_STATUS`（`active: "使用中"` / `retired: "已归档"`）与 `BIND_STATE`（`unbound: "待接通"` / `bound: "已绑定"`）——这两个必须与运营后台用同一套说法，`unit/ca-link.test.js` 最后一条用例就是在钉这一点。
- 两个状态维度不许合并成一句话：`status` 说“我方还用不用这个号”，`bind_state` 说“对方接通没接通”（`accountRow` 的标签、`ROBOT_JOIN_NOTE` 的说明）。
- 内部版本 code 不进正文：题库/内容的版本一律显示「中文名 + 版本号」（`versionLabel()`；运营端对应过滤器 `version_label`，见 `ops/templatetags/ops_labels.py`），原始 code（如 `readable-v2`）只放进 `title` 属性。中文名取服务端下发的 `title`，不在前端维护映射表。
- 需要留在页面上、不能只是一闪而过的说明用 `.notice` 块（活动准备材料、换号代价、同步异常、合规提醒）；只在片刻确认用 `toast()`。

## 合规与边界必须显示在界面上

- 合成/测试数据必须带 `testTag()`（活动卡、测评会话、报告、机器人账户面板都带了）。不得把测试流程说成真实供应商已接入（`AGENTS.md`/`PROJECT_MEMORY.md` 的硬约束）。
- 探索体验到此为止只展示“这次的选择”，并明确写“不代表固定类型、天赋或能力”（`submissionView` 的 `exploration` 分支）。**不要**在界面上产出天赋分、能力分或专业结论。
- 报告页要展示来源与版本：`r.template_version`、`r.window`、`r.source_summary`（`report` 分支）。
- 撤回授权、解除关联、删除申请这类动作，弹窗里要讲清后果（“撤回会阻止后续处理；需要清除已有数据请提交删除事项”“申请提交后不会立即删除”）。

## 无障碍与既有约定

- 内容容器 `#main` 有 `tabindex="-1"` 与 `aria-busy`：`page()` 写完会置 `false`，取数前置 `true`；未渲染完成时显示 `<div class="loading">正在连接成长空间…</div>`。
- 首屏有跳转链接 `.skip-link`（`index.html`），点击后聚焦 `#main`（委托里的第一条分支）。
- 反馈位固定：表单错误 `role="alert"`（`#dialog .form-error` 或 `#main .form-error`），轻提示 `role="status" aria-live="polite"`。写新表单就复用这两处，不要再发明一个错误容器。
- 有开关语义的按钮要带 `aria-pressed`：兴趣岛 `.island-stop`（`playworld.js` 的 `select()`）与伙伴引导的 `.chip`（`app.js` 的 `companion` 分支）都带了。注意心情筛选的 `.chip`（`filters()`）目前只靠 `active` class，**不要照它抄**。
- 有朗读按钮的场景用 `speak(text)`：先 `speechSynthesis.cancel()`，不支持时 `toast("当前浏览器无法朗读，可以继续阅读文字。")`，出错也要给提示。
- 键盘可见焦点由 CSS 统一处理（`client.css` 里那条覆盖 button/a/input/select/textarea 的 `:focus-visible` 规则），不要在行内 `style` 里另写焦点样式。

## 反模式

- 把整页 HTML 交给第三方模板字符串库或引入框架“重构”——技术栈是定死的（`frontend/README.md`）。
- 用 `innerHTML` 拼未转义的动态文本（含服务端返回的 `message`）。
- 在 `app.js` 之外直接操作 `#main` 的内容或另起一套事件绑定。
- 为新状态新写一个中文词，而不是加进上面的映射表。
