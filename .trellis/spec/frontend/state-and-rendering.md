# 状态与渲染

没有框架、没有虚拟 DOM：状态是模块级变量，渲染是“重新生成整段 HTML 字符串再写进 `#main`”。改这块之前先按下面的分层放东西。

## 状态放哪里

| 位置 | 装什么 | 依据 |
| --- | --- | --- |
| `state` 对象 | 跨页面要用的服务端数据与界面选择：`user`、`children`、`child`、`runtime`、`challenge`、`mood`、`island`、`style`、`session`、`question`、`record`、`consents`、`window` | `app.js` 顶部 `const state = {…}` |
| `hints` 对象 | 只给“当前这次操作/这一页”用的临时缓存：`hints.activities`、`hints.accounts`、`hints.config`、`hints.grant`、`hints.policy`、`hints.nfcToken`、`hints.replaceAccount` 等 | `app.js` 的 `const hints = {}`；`forget()` 里整个清空 |
| 模块级局部变量 | 生命周期明确的单值：`childDraft`、`currentActivity`、`nextCursor`、`pollTimer`、`pollPending`、`busy`、`viewEpoch` | `app.js` 顶部 `let viewEpoch = 0, busy = false, …` |
| `childEdit` 对象 | 儿童档案**编辑会话**：基准 `revision`、冲突状态、已读到的最新档案 | `app.js` 的 `let childEdit = null`，`editChild()` 里建、`leaveContext()`（含 `closeDialog()` / `stopWork()`）里清 |
| `keys` Map | 幂等键缓存（见 `api-conventions.md`） | `app.js` 的 `const keys = new Map()` |

判定规则：服务端数据、需要跨页保留 → `state`；只服务当前页或一次对话框 → `hints`。`hints` 存在的意义就是**不要为了一个弹窗把 `state` 撑大**。

## 渲染流程（唯一的更新入口）

`render()`（`app.js`）是唯一的整页渲染入口，顺序固定：

1. `const tick = ++viewEpoch;` 然后 `clearTimeout(pollTimer)`、清 `pollPending`、`speechSynthesis.cancel()`（**不**关对话框、**不**动 `childEdit`，见下节）；
2. 没登录 → `loginPage()`；没有儿童档案 → `childForm()`（`#settings` 例外，会渲染只有家长账户与回执的页面）；
3. 设 `$("#main").setAttribute("aria-busy", "true")`，按 `location.hash` 取 `[route, id]` 分派，拼 `html`；各分支用 `Promise.all` 并发取数据（例：`reports` 一支并发 4 个请求，`settings` 一支并发 4 个请求）；
4. **写 DOM 前先验票**：`if (tick !== viewEpoch || state.child?.id !== child) return;`；
5. `page(html)` 写入 `#main` 并把 `aria-busy` 置回 `false`，随后 `header()` 刷新导航与儿童选择器；
6. `bindForms()` 绑表单事件；
7. 渲染完成后只有一处自动动作：如果 `hints.nfcToken && !hints.nfcPrompted`，自动弹出绑定对话框，并立刻把 `hints.nfcPrompted = true`（只弹一次，家长不必自己找入口）。

改这块的硬规则：**任何 await 之后、任何 DOM 写入之前，都要检查 `tick !== viewEpoch`**（`app.js` 里 `render()` 的 catch 分支、`loadChildren()` 之后的路径都这么做）。否则慢请求返回会把用户已经切走的那一页重新覆盖上去。

## 事件与动作

- 点击统一走事件委托：`document.addEventListener("click", …)` 找最近的 `[data-action]`，交给 `handleAction(action, el)` 的 `switch`。新增交互就在这个 `switch` 里加 `case`，**不要**另外给元素挂 `addEventListener`（弹窗里的表单除外）。
- 动作参数从 `el.dataset` 取（如 `id = el.dataset.id`、`el.dataset.kind`、`el.dataset.value`）。
- 表单事件在 `bindForms()` 里按 `#id` 绑定 `onsubmit`（`#answer-form`、`#window-form`、登录表单、儿童档案表单等）。
- 异步动作统一用 `act(fn, el)` 包：它管 `busy` 重入、按钮 `disabled`、`#child-select` 禁用，并统一 `catch` 到 `showError(e)`。**不要**自己写 try/catch + 手动恢复 `disabled`。
- 弹窗内的异步动作要显式传 `e.submitter`：`act(() => submitRobotBinding(e.target), e.submitter)`。
- `busy` 为真时链接点击会被拦（委托里对 `<a>` 做 `preventDefault`），避免连点导航造成半渲染状态。

## 路由

- hash 路由：`#route` 或 `#route/id`（`explore` / `home` / `journey` / `reports` / `settings` / `services` / `companion` / `activity/<id>` / `assessment/<id>` / `report/<id>`）。导航项清单是 `app.js` 的 `nav` 数组，`header()` 依据它渲染并标 `active`。
- 跳转用 `to(route)`：同 hash 直接 `render()`，否则改 `location.hash` 让 `hashchange` 触发渲染。未知 route 落到“没有找到这个页面”的空态。
- 切儿童用 `#child-select` 的 `onchange`：清 `state.session` / `state.record` / `state.question` / `state.island`、`keys.clear()`、存导航提示，然后回到 `#explore`。
- 页面内锚点（如兴趣岛“测评与报告”入口）是普通 `<a href="#…">`。
- 路由状态只放 hash，不引入 history API 的隐藏中间状态。`history.replaceState` 仅用于摘掉 NFC 凭据（见 `api-conventions.md`），以及从历史探索结果成功建立新答卷后，将同用途的 `#interest/<旧ID>` / `#talents/<旧ID>` 同步为新答卷ID。后一操作必须在真实会话响应、身份/儿童/路由上下文检查及模块接纳状态之后执行，不触发 `hashchange` 或关闭刚打开的题目；刷新读取新答卷，旧答卷仍可按原地址回看。

## 生命周期与跨标签页

- `stopWork()`：清 `pollTimer` + `closeDialog()`。调用它的地方是 `#child-select` 的 `onchange`、以及 `window` 的 `pagehide` 监听。
- **「离开上下文」与「重渲染」是两件事**（T-041 的 P-16）：`leaveContext()` 关对话框并把 `childEdit` 置空（防止过期基准修订号被下次复用），`closeDialog()` = `leaveContext()` + 取消 `speechSynthesis`，`stopWork()` = `clearTimeout(pollTimer)` + `closeDialog()`。
  - 换路由（`to()` 与 `hashchange` 入口）与换儿童才算「离开上下文」，要在 `render()` 之前调 `leaveContext()`；
  - `render()` 自身**只**取消待执行的轮询与还在读的朗读，不关对话框。否则 `#reports` 的 3 秒轮询一重渲染就会把家长刚打开的对话框关掉（实测对话框只开约 1.7 秒）；
  - 「提交成功后重渲染」的对话框流程（核验关联、编辑儿童档案、归档账户号、提交申请事项、`case "close"`）由自己显式调 `closeDialog()` 收尾，不能再指望 `render()` 顺手关掉。
- 对话框打开期间挂起轮询：`schedulePoll(tick, delay)` 发现 `$("#dialog").open` 就只置 `pollPending = true`，不排 `setTimeout`；`<dialog>` 的 `close` 事件里再补一次 `render()`（推迟一个任务，让换路由引起的关闭被紧接着的那次渲染自然吸收）。
- `forget()`：退出/401 时的整体复位——递增 `viewEpoch`、停轮询、清 `state`、清 `hints`、`keys.clear()`、`API.clearAuth()`。
- 轮询只在必要时开：测评处于 `processing` / `result_unknown`（或报告处理中）时 `schedulePoll(tick, 2500)`；成长观察等待同步或阶段画像处理中时 `3000`。回调里必须再验 `tick === viewEpoch`。**不要**加常驻定时器，也不要绕开 `schedulePoll` 自己写 `setTimeout`（那会漏掉「对话框打开期间挂起」这条）。
- 跨标签页同步用 `BroadcastChannel("dingdong-auth")`：登录成功 `postMessage({user})`、退出 `postMessage({logout:true})`，收到消息且身份不符就 `forget()` + `boot()`（`app.js` 末尾）。
- `sessionStorage` 只存导航提示 `ca.navigation`（家长 id + 儿童 id），由 `saveHints()` 写、`loadChildren()` 读。**手机号、儿童姓名、答案、报告、图片、令牌一律不进 storage**（`frontend/README.md` 明确写了这条）。

## 反模式

- 用一个“当前页数据”变量缓存服务端结果再手动局部更新 DOM —— 现有代码一律重新 `render()`。
- 在 `render()` 之外改 `state` 后不重渲染：所有互动动作的最后一步都是 `await render()` 或 `to(route)`。
- 把表单当数据源（唯一例外是冲突恢复里的 `childEditDraft()`，它刻意读输入框，因为要保留家长未保存的填写，见 `ui-conventions.md`）。
- 加长驻 `setInterval` 轮询、或把轮询开在所有状态上。
- 把一次性上下文（凭据、对话框里的对象）塞进 `state`：那会让 `forget()` 覆盖不全。
## 探索适配与指纹生命周期（2026-09-30）

原型模块经统一bridge.run→act，ensure/answer/complete必须等待真实API成功，核对身份+儿童+路由+探索上下文票据后再更新。答卷不进storage。`exploration-session.js`归一化服务端答案，保留合法零分；只在ensure恢复首次未答题号，单题保存不能自动跳题。

`closeDialog()`调用`leaveContext({disposePage:false})`只关闭当前弹窗和编辑会话；同页指纹活动弹窗关闭后必须继续可用。真正换路由、切儿童、退出及pagehide才使用默认disposePage=true清理FingerprintLab及递增探索票据。不要把相机/Blob清理挂在所有弹窗关闭上。


## 网页引导偏好与导出（v0.3.21）

`state.companionPreference`来自当前儿童API，保存guide_mode/revision/child_id；不进storage。加载、保存和导出await后必须检查explorationToken及返回child_id。换儿童、退出清空；伙伴页/活动详情恢复后端偏好。guide_mode为原四种网页方式，活动style保持既有合法值，两者独立；既有活动始终使用创建时的guide_mode。

`guideText(record)`是页面与朗读唯一文案入口：guide用四套原话术，web用实际活动alternative。进度回退仍带revision。旅程筛选改变后丢弃旧cursor，用相同status拉下一页。

导出经真实儿童export API，创建仅本次下载的Blob URL，await后验上下文，下载后和pagehide时释放。全局busy导航门禁只能放行本次trackedBlobURL，不能放行任意href或其他导航；否则原有busy保护会把程序触发的a.click也拦掉，HTTP200不等于下载成功。
