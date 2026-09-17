# T-010 报告：P-07 慢网提交要有进行中提示

## goal

提交期间给进行中提示（按钮文案如「登录中…」或轻量进度指示），避免家长以为按钮点空了反复点。

## 实际做了什么

`frontend/app.js`

- 新增 `busyButton(el, label)`：记下按钮原本文案，置 `disabled`、`aria-busy="true"`、文案换成 `label`，返回一个恢复函数；恢复前判 `el.isConnected`（页面已重渲染时按钮已脱离文档，直接跳过）。
- `#login-form` 的 `onsubmit` 改用它：`const restore = busyButton(e.submitter, "登录中…")`，`finally` 调 `restore()`；原来那两行 `b.disabled = true` / `b.disabled = false` 去掉。
- 改动只落在登录提交这一条路径，其它提交按钮（绑定机器人、编辑档案等）未动。

`frontend/client.css`

- `.button[aria-busy="true"] { cursor: progress }`；`:disabled` 时把 `opacity` 从 0.5 提到 0.85（原来的淡化正是"按钮像死了"的观感来源）；`::after` 画一个 14px 的转圈（`border-top-color: transparent` + `@keyframes busy-spin` 旋转）。
- 仓库既有的 `@media (prefers-reduced-motion: reduce)` 会关掉这个动画，不需要另加分支。

`frontend/tests/slow-network.spec.js`（新建，2 条真实 Chrome 用例）

- 用例 1：CDP `Network.emulateNetworkConditions`（latency 4000ms）下点「登录」，断言按钮文案变「登录中…」、`aria-busy="true"`、`disabled`，桌面与 390×844 各截图，最后确认慢网请求回来后照常进入「建立儿童档案」。
- 用例 2：错误验证码 + 4 秒延迟，确认失败后按钮回到「登录」、`aria-busy` 摘掉、重新可点（防止"进行中态卡死"这类新回归）。
- 截图路径用 `import.meta.url` 解析到仓库根，直接落 `.trellis/tasks/T-010/shots/`。

## 验证命令与真实输出

红（改前，TDD 第一步）：

```
cd frontend && npx playwright test tests/slow-network.spec.js --reporter=list -g "4 秒延迟"
```

```
    Locator:  locator('#login-form button[type=submit]')
    Expected: "登录中…"
    Received: "登录"
    Timeout:  5000ms
      14 × locator resolved to <button disabled type="submit" class="button primary">登录</button>
         - unexpected value "登录"
  1 failed
    tests/slow-network.spec.js:35:1 › 4 秒延迟下点「登录」：按钮给出可见进行中态，慢网结束后照常登录
```

绿（改后，全文件）：

```
cd frontend && npx playwright test tests/slow-network.spec.js --reporter=list
```

```
  ✓  1 tests/slow-network.spec.js:35:1 › 4 秒延迟下点「登录」：按钮给出可见进行中态，慢网结束后照常登录 (10.2s)
  ✓  2 tests/slow-network.spec.js:65:1 › 登录失败时按钮回到「登录」原样，可再次提交 (6.0s)
  2 passed (16.8s)
```

加窄屏截图后重跑单条：`1 passed (10.9s)`。

```
cd frontend && npm run check
```

exit 0。

```
cd frontend && npm run test:unit
```

```
ℹ tests 16
ℹ pass 16
ℹ fail 0
ℹ duration_ms 71.6555
```

回归（与登录提交路径直接相关）：

```
cd frontend && npx playwright test tests/login-validation.spec.js --reporter=list
```

```
  ✓  1 tests/login-validation.spec.js:14:1 › 空手机号点「获取验证码」：中文提示，且不发请求 (933ms)
  ✓  2 tests/login-validation.spec.js:27:1 › 空手机号在 390×844 窄屏同样给中文提示 (819ms)
  ✓  3 tests/login-validation.spec.js:35:1 › 格式不合法的手机号：界面提示是中文，不含内部 repr (870ms)
  ✓  4 tests/login-validation.spec.js:45:1 › 填了合法手机号仍能拿到验证码并登录（回归） (2.9s)
  4 passed (6.2s)
```

```
python3 scripts/audit_documents.py
```

```
{"markdown_files": 80, "local_links_checked": 497, "archived_files_checked": 85, "operations": 55, "schemas": 65, "errors": []}
```

截图（`.trellis/tasks/T-010/shots/`）：

| 文件 | 字节 | 内容 |
| --- | --- | --- |
| `t010-login-busy-desktop.png` | 168421 | 1280×720，按钮「登录中…」+ 转圈 |
| `t010-login-busy-mobile.png` | 84271 | 390×844，同上 |
| `t010-login-restored-desktop.png` | 168339 | 错误验证码失败后按钮回到「登录」 |

限流余量（只读查询，未重置远端库）：`SmsChallenge` 近 1 小时 `client_ip=127.0.0.1` 计数 42（上限 50，`backend/dingdong_ca/core/api/accounts.py` 的 `sms` 视图）。本轮四次要验证共消耗 6 条。

## 未验证项

- 未跑全量 e2e 回归（`tests/ca-account.spec.js` / `tests/flows.spec.js`）：本轮开始时近 1 小时计数已 39/50，全量跑必然撞 429，跑出来的失败无法分辨是产品坏了还是限流，故不采信、也不声称通过。
- 慢网是 CDP 模拟（latency 4000ms），不是真实弱网链路。
- 其它提交按钮（绑定机器人、编辑档案、答题提交）在慢网下仍是"只变灰"，未验证也**未修改**——不在本任务 goal 内。
- 窄屏截图里 toast（「验证码已准备好…」）压住按钮下半部，是既有的 `.toast` 定位在 390 宽下的表现，本轮未改，仅记录备查。

## 偏离与理由

1. 截图直接写任务目录，没有走 T-006/T-009 的「先落 `frontend/docs/` 再拷进 `.trellis/tasks/`」两步。理由：acceptance 明确要求截图在 `.trellis/tasks/T-010/shots/`，单点落盘不留两份副本。
2. 顺手修掉一个未捕获异常：原 `onsubmit` 的 `b.disabled = true` 在 `try` 之外，回车提交时 `e.submitter` 为 `null` 会抛 TypeError。新写法 `busyButton(null, …)` 返回空函数，这条路径不再抛错。属于同一段代码的必要改动，未扩大范围。
