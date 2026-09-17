# T-009 P-06 成长观察非法时间区间就地提示

## goal

「成长观察」起止时间非法（起 ≥ 止）时就地提示「结束时间要晚于开始时间」并把两个输入框标红，不再零请求零提示。

## 实际做了什么

- 本轮为 FALLBACK 重跑（PRIMARY deepseek-v4-1-flash 08:56:05Z–09:08:42Z 限流 rc=1）。核对式续跑发现前任 progress.md 声称已改的 `frontend/app.js`、`frontend/client.css` 在磁盘上无对应改动，实际只落了测试文件与截图目录 → 重做实现。
- `frontend/app.js`：
  - `windowForm()` 表单内加 `<div class="form-error" role="alert"></div>`。
  - `bindForms()` 中 `#window-form` 改块级绑定：新增 `windowRangeError(show)`（写 `.form-error` 文案、给 `from`/`to` 两个输入框 set/remove `aria-invalid` 与 `is-invalid` 类）；两个输入框 `oninput` 清错；`onsubmit` 非法时调 `windowRangeError(true)` 就地提示并 return（不发查询、不再 toast），合法时先清错再发查询。
- `frontend/client.css`：新增 `.window-form .form-error { flex-basis: 100%; margin: 0 }` 与 `.window-form input.is-invalid { border-color: #cf6a56; background: #fff6f3 }`。
- `frontend/tests/growth-window.spec.js`：2 条真实 Chrome 用例（前任已建，内容保留未改）。

## 验证命令与真实输出（数字照抄）

- `cd frontend && npm run check` → exit 0（`node --check app.js && api.js && playworld.js && server.cjs`）。
- `cd frontend && npm run test:unit` → `tests 16 / pass 16 / fail 0`，`duration_ms 70.432667`。
- `python3 scripts/audit_documents.py`（仓库根）→ `{"markdown_files": 80, "local_links_checked": 497, "archived_files_checked": 85, "operations": 55, "schemas": 65, "errors": []}`。
- `cd frontend && npx playwright test tests/growth-window.spec.js --reporter=list`：
  - 首跑 `2 failed`：两条都卡在登录步，`.form-error` 文案为「验证码请求过多」（`/auth/sms` 同 IP 限流 50/小时，环境性，非本改动；`SmsChallenge.client_ip=127.0.0.1` 近一小时计数当时 =50）。
  - DB 只读计数滑落到 47（`count_1h_ip= 47`，`now= 2026-09-17T09:19:03Z`）后重跑 → `2 passed (12.0s)`。
- 截图：`frontend/docs/t009-illegal-window-desktop.png`（109797 字节）与 `t009-illegal-window-mobile.png`（70584 字节）拷入 `.trellis/tasks/T-009/shots/`（同名为证）。

## 未验证项

- 全量回归 `npx playwright test tests/ca-account.spec.js tests/flows.spec.js` 受 `/auth/sms` 同 IP 限流（50/小时）影响，多次登录把 `SmsChallenge.client_ip=127.0.0.1` 近一小时计数推到 50，后续用例卡在登录「验证码请求过多」60s 超时，未能一次全绿。此为 T-007 已记录的环境性约束，非本改动引入；本轮在回归跑约 13 分钟后终止，未采信不完整数字。

## 偏离与理由

- 前任 progress.md 声称的 `app.js`/`client.css` 改动未落盘，以磁盘为准重做；测试文件与截图目录保留。
- 原实现用 `toast("结束时间需要晚于开始时间。")`，按 goal「就地提示」改为就地 `.form-error` + 输入框标红，不再弹 toast。
