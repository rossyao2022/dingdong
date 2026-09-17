# T-010 progress

## 阶段

- Plan：完成
- Implement：完成
- Verify：完成（TDD 红→绿；限流余量核对后再跑）
- Finish：完成

## 改动文件

- `frontend/app.js`：新增 `busyButton(el, label)`（换文案 + `aria-busy="true"` + `disabled`，返回恢复函数，恢复前判 `el.isConnected`）；`#login-form` 的 `onsubmit` 用它把提交期间文案改成「登录中…」，`finally` 调恢复函数（原 `b.disabled = true/false` 两行移除）。
- `frontend/client.css`：新增 `.button[aria-busy="true"]`（`cursor: progress`）、`.button[aria-busy="true"]:disabled { opacity: 0.85 }`、`.button[aria-busy="true"]::after` 转圈与 `@keyframes busy-spin`。
- `frontend/tests/slow-network.spec.js`：新建 2 条真实 Chrome 用例，用 CDP `Network.emulateNetworkConditions`（latency 4000ms）复现慢网。
- `.trellis/loop/queue.md`：T-010 `status` 由 `todo` 改 `doing`（收尾改 `done`）。

## 命令与结果

- 红：`cd frontend && npx playwright test tests/slow-network.spec.js --reporter=list -g "4 秒延迟"` → `1 failed`，断言 `Expected: "登录中…" / Received: "登录"`，14 次轮询均为 `<button disabled type="submit" class="button primary">登录</button>`。
- 绿（全文件）：`npx playwright test tests/slow-network.spec.js --reporter=list` → `2 passed (16.8s)`（4 秒延迟用例 10.2s、失败恢复用例 6.0s）。
- 加窄屏截图后重跑单条：`npx playwright test tests/slow-network.spec.js --reporter=list -g "4 秒延迟"` → `1 passed (10.9s)`。
- `cd frontend && npm run check` → exit 0。
- `cd frontend && npm run test:unit` → `tests 16 / pass 16 / fail 0`，`duration_ms 71.6555`。
- 回归：`npx playwright test tests/login-validation.spec.js --reporter=list` → `4 passed (6.2s)`。
- `python3 scripts/audit_documents.py` → `{"markdown_files": 80, "local_links_checked": 497, "archived_files_checked": 85, "operations": 55, "schemas": 65, "errors": []}`。
- 限流余量（只读）：`SmsChallenge` 近 1 小时 `client_ip=127.0.0.1` 计数 42（上限 50），本轮共消耗 6 条。
- 截图：`.trellis/tasks/T-010/shots/` 三张 —— `t010-login-busy-desktop.png` 168421 字节、`t010-login-busy-mobile.png` 84271 字节、`t010-login-restored-desktop.png` 168339 字节。

## 下一步

- 写 report.md、commit、按第一批直推规则 push 并在 `gates.md` 补 EXECUTED 行。
