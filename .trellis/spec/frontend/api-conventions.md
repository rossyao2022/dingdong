# 调 API 的约定

所有业务请求都要走 `frontend/api.js` 的 `request()`。它是唯一知道前缀、认证、超时和续期的地方。

## `request()` 已经替你做的事

`API.request(path, { method, body, auth = true, retry = true })`（`api.js`）：

- 路径自动加前缀 `/api/v1`——调用处只写 `/children`、`/assessments/<id>/answers` 这种相对路径；**不要**在页面里手写 `/api/v1/...` 或直接 `fetch()` 业务接口。
- 认证：内存变量 `access` 存在时加 `Authorization: Bearer …`；同时从 `csrftoken` cookie 读值加 `X-CSRFToken`。`auth: false` 用于登录、验证码、政策等公开接口。
- 请求体：`FormData` 原样提交且**不设** `Content-Type`；其他对象 JSON 序列化。
- `credentials: "same-origin"`，`AbortController` 20 秒超时。
- 401 且有 `auth` 时自动 `refresh()` 一次并重试（`retry: false`，只重试一次）。
- 204 返回 `null`；响应不是 JSON 时降级成 `{message: "服务返回了无法识别的响应。"}`。

错误一律抛 `APIError`：`status`、`code`、`fields`（来自响应的 `field_errors`）。断了网/超时是 `status === 0`、`code === "NETWORK_ERROR"`，文案已经写成“操作结果可能尚未返回”，不要改成“失败”。

## 认证与登录态

- `API.refresh()` 用 HttpOnly refresh cookie 换 access；用模块内 `epoch` 防止并发刷新串号，`clearAuth()` 会递增 `epoch`。
- `API.login(challenge, code)` 拿 access 并返回 user；`API.logout()` 调后端后 `clearAuth()`。
- 页面上任何 `401` 都走 `showError()` → `forget()` + 回登录页（`app.js` 的 `showError` 与 `render()` 的 catch 分支都做了这件事）。**不要**在业务分支里自己处理 401。

## 分页

- 列表一律用 `API.all(path)`：按 `page_size=100` + `cursor` 循环取完。`/children`、`/activities`、`/data-requests`、`children/<id>/reports|assessments|consents|associations|ca-accounts` 都用它。
- 需要自己管游标的只有“加载更多”这类交互：`journey` 分支把 `next_cursor` 存进 `nextCursor`，`more-records` 动作再带 `cursor` 请求并 `insertAdjacentHTML` 追加到 `#timeline`。
- 新增列表接口时先看后端是否 `cursor` 分页；是就用 `API.all`，不要在前端自己拼 `page_size`。

## 写操作必须有幂等键 `request_id`

- 幂等键由 `requestKey(k)` 生成：`keys` Map 里按字符串键缓存 `API.createRequestId()` 的结果，同一次提交重试拿到同一个 id；成功后调用处 `keys.delete(k)`。
- 键名是“业务动作 + 参与者 + 关键参数”，例如 `"child-create"`、`"ca-issue:" + child + ":" + token`、`"link:" + child + ":" + proof`、`"assessment-create:" + child`、`"request:" + child + ":" + kind`。
- 切儿童、核验成功、退出、换机等身份/上下文变化的节点会 `keys.clear()`。加新的写操作时先想清楚：**这个键什么时候必须失效**。
- 幂等键只在一次页面会话内有效（`keys` 是内存 Map，刷新即丢），这是既有取舍；服务端另有约束兜底。

## 生成请求 id：必须用 `API.createRequestId()`

`api.js` 的 `createRequestId` 优先用原生 `crypto.randomUUID()`，在没有它的时候（公网明文 HTTP 不是安全上下文）回退到 `getRandomValues` 手工组 v4 UUID。这是 v0.2.3 的真实事故：`crypto.randomUUID is not a function` 让建档表单在绑事件前就抛异常。

因此：

- 页面里**不要**直接写 `crypto.randomUUID()`；要 id 就 `API.createRequestId()`。
- 缺随机源时它必须抛错（`unit/request-id.test.js` 第三条用例断言了这一点），不允许静默生成弱 id。

## 409 冲突：不覆盖、不重建、不自动重试

后端对儿童档案、题库、活动版本用修订号做乐观并发；不一致时返回 `409`。前端规矩：

- 通用兜底：`showError()` 遇到 `409` 会在错误区追加“可刷新读取已保存的最新记录”，并给一个 `data-action="refresh"` 按钮。**不要**自动重发请求。
- 儿童档案编辑（`app.js` 的 `editChild` / `saveChildEdit` / `renderChildConflict` / `childConflictView` / `childConflictLoadLatest` / `childConflictAskApply` / `childConflictApplyMine`）是一套显式恢复流程，规则是：
  - 命中 409 **不重建表单**：家长填的称呼/性别/出生日期留在输入框，只渲染独立的冲突面板 `#child-conflict`（`renderChildConflict` 只改面板，绝不碰输入框）。
  - 三条路径都由家长点：查看最新资料（只读并排对比 `conflictDiff`）、载入最新资料（二次确认后才 `childEditFill` 覆盖输入框并把基准推进到最新 `revision`）、用我的修改保存（基准是**家长看到的那一版** `childEdit.latest.revision`，期间再被改过会**再次** 409，`childEdit.retried` 把提示改成“又被更新了一次”）。
  - 保存基准来自 `childEdit.revision`（编辑开始时读到的版本），提交体里带 `revision`。**不要**在冲突后偷偷用新读到的版本当基准——那等于替家长覆盖别人的修改。
  - 关闭对话框前若冲突未处理，先 `childEdit.prompt = "close"` 问一句；对话框关闭/`stopWork()` 会清 `childEdit`，过期基准不得复用。
- 其他写操作（题库、活动版本）如果服务端返回 409，同样不得自动重试或静默覆盖，要在界面上把“保留输入 + 让用户选”的路径做出来。

## 凭据类参数：读到就从地址栏摘掉

机器人 NFC 标签把凭据写在 URL 里（`?nfc_token=…` 或 `#settings?nfc_token=…`）。规矩：

- 进站第一件事是读出来、存进内存（`hints.nfcToken`），再 `history.replaceState(null, "", stripBindingParams(location.href))` 把凭据从地址栏摘掉（`app.js` 的 `boot()`）。留在地址栏的凭据会跟着浏览历史、截图和转发出去的链接一起走。
- 解析查询串**不用 `URLSearchParams`**：它按表单语义把裸 `+` 读成空格，而凭据是不透明字符串，改写字节会导致后端换到另一把凭据上。用 `ca-link.js` 的 `readParam` / `readNfcToken`（按原样切分、只做百分号解码）。
- 凭据只留内存：不进 `localStorage` / `sessionStorage`，不进日志，不回显在页面上。接口只回短指纹 `nfc_token_fingerprint`，界面显示的也是它。
- 同样的规则适用于核验凭据 `entry_proof`（“账户与关联”的核验表单）——只用于本次请求。

## 展示数据的取值纪律

- 缺失值显示既有占位文案，不要编造：时间用 `date()`（无值输出“尚无记录”）、指标用 `metrics()`（`null` 输出“暂无数据”）、报告列表空态用 `empty(...)`。
- 观察数据里 `availability` 为 `stale` / `error` 时必须显式提示“同步未取得最新结果，已有数据不会当作最新数据展示”（`observationBlock`）。
- 机器人账户里 `bind_state === "unbound"` 就是“待接通”，**不许为了页面好看提前显示“已绑定”**（`app.js` 的 `ROBOT_JOIN_NOTE`、`frontend/README.md`）。
- 契约以服务端为准：字段名、枚举、错误码按 `设计/API/openapi.json` 与后端实现；前端不自己造字段、不把内部契约说成对方（DingDong）已确认的协议。