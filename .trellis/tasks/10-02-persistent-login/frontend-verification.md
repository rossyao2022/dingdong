# 前端登录协调验证（2026-10-02）

## 实现

- `frontend/api.js` 的 `refresh/login/logout` 共用 `dingdong-auth-session` 同源 Web Lock；不支持 Web Locks 时使用模块内 promise 队列，只保护同页操作，不声称跨标签页互斥。
- 保留 refresh singleflight；login/logout 一开始递增 epoch 清内存。排队及 CSRF 初始化后的旧操作在发 refresh/login 之前检查 epoch；已发送操作返回后再检查，迟到 token 不写回内存。
- logout 等待刷新完成后撤销更新后的 cookie；网络/服务失败继续抛异常。`app.js` 既有成功广播、forget、跳转在 `await API.logout()` 之后，未完成退出不会被显示成退出成功。
- refresh 的网络/5xx 错误保留已有 access；明确401/403才清 access。前端不修改持久 refresh cookie，也不将凭据放入 localStorage/sessionStorage。
- 自动401续期前与重试前检查请求开始时的 epoch，旧身份的迟到401不能在新身份下重发旧写操作。

## TDD 与命令

初始新增10项认证协调测试，修改实现前2通过、8失败；实现后10通过。补充失败退出/CSRF初始化边界。另补旧身份迟到401回归，未加 request epoch 检查时12通过、1失败（出现新身份重发），加检查后通过。

本轮最终命令：

- `npm --prefix frontend run check`：通过，仅代表列出的模块语法检查；仓库未配置前端 lint/typecheck。
- `npm --prefix frontend run test:unit`：147通过、0失败、0跳过；其中新增认证协调13项。

新增用例覆盖：两独立模块实例模拟标签页锁与CSRF重读、无Web Locks同页singleflight、两种锁机制的退出/刷新竞态、排队刷新取消、新登录覆盖旧刷新、登录途中clearAuth、退出网络失败可重试、CSRF途中clearAuth、旧身份401禁止新身份重发、网络/503/401刷新失败后的凭据与重试语义。

## 证据边界

这是 Node 传输与并发协调单元验证，使用受控 fetch/lock harness，不是实际浏览器或真实服务端登录验收；不证明浏览器 Cookie 保存天数或后端授权规则。遵循用户自行手测安排，未运行浏览器/公网业务测试、未发短信、未修改生产数据。无Web Locks的浏览器仍不具备跨页刷新互斥，既有服务器严格轮换拒绝旧token保持。服务端已轮换但响应完全丢失的网络不确定状态，无法仅靠前端保证旧cookie依然有效。

## 独立check后的最终结果

后续check修复AUTH_STATE_CHANGED取消码与页面catch边界，并新增2项实际showError边界测试；最终149/149（新增认证15项），语法通过。原147为implement阶段记录，最新证据见[全范围check](check-verification.md)。
