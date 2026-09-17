# T-008 报告

## goal
绑定对话框补操作指引（用手机碰机器人上的标签会自动带凭据回到这里），手填时给格式/长度提示，校验错误落到 `.form-error` 而不是只靠浏览器原生气泡（backlog P-02）。

## 实际做了什么
- 本轮是 T-008 的 FALLBACK 重跑：`runs.log` 里 `2026-09-17T08:26:06Z ROUND T-008 RATE_LIMITED 20s 8348ef8 deepseek-v4-1-flash-260910 rc=1` 为 PRIMARY 启动即被限流，未留任何改动，本轮从头做。
- `frontend/app.js` 的 `bindRobotDialog()`：
  - 表单加 `novalidate`，禁用浏览器原生气泡，校验改由 JS 控制。
  - 正文改为「用手机碰一下机器人上的标签，凭据会自动带回到这个页面；也可以手动输入。确认后，系统会为这台机器人生成一个账户号。」
  - 凭据说明补格式/长度提示：「凭据通常是一串字母和数字，最长 2048 个字符；只用于本次绑定，不保存在浏览器里，也不写进日志。一台机器人只服务一个孩子。」
  - `onsubmit` 加空凭据守卫：`nfc_token` 去空格后为空时，向 `#dialog .form-error` 写「请先填写机器人凭据，或让手机碰一下机器人上的标签自动带进来。」并直接 return，不发起请求、不关对话框。
  - 非空凭据走原 `act(() => submitRobotBinding(...))` 路径不变；NFC 预填凭据（`value` 非空）与「换机」流程（预填 token 点确认）都不受影响。
- `frontend/tests/ca-account.spec.js` 新增 1 条真实 Chrome 用例「手填绑定：空凭据就地提示，对话框不关」：登录 → 建档 → 进「账户与关联」→ 点「绑定机器人」→ 断言弹窗含指引与「2048」→ 空凭据点「确认绑定」→ 断言 `.form-error` 可见且非空且含「请先填写机器人凭据」→ 断言对话框仍开着 → 截图。

## 验证命令与真实输出
- TDD 红（实现前）：`cd frontend && npx playwright test tests/ca-account.spec.js -g "手填绑定" --reporter=list` → `1 failed`；失败点 `expect(dialog).toContainText("碰一下机器人上的标签")`，实收正文仍是旧文案「机器人上的标签会带着凭据打开这个页面」。
- `cd frontend && npx playwright test tests/ca-account.spec.js -g "手填绑定" --reporter=list` → `1 passed (4.7s)`。
- 修正截图路径到仓库根后复跑同一条：`1 passed (4.9s)`，截图 `.trellis/tasks/T-008/shots/empty-credential.png`（197,704 字节）。
- `cd frontend && npx playwright test tests/ca-account.spec.js --reporter=list` → `8 passed (51.4s)`（全量 8 条一次全绿，逐条 6.1s / 6.9s / 10.0s / 6.7s / 4.7s / 4.4s / 5.4s / 6.5s）。
- `cd frontend && npm run check` → exit 0。
- `cd frontend && npm run test:unit` → `tests 16 / pass 16 / fail 0 / duration_ms 73.248209`。
- `python3 scripts/audit_documents.py` → `{"markdown_files": 80, "local_links_checked": 497, "archived_files_checked": 85, "operations": 55, "schemas": 65, "errors": []}`。

## 未验证项
- 无。全量 `tests/ca-account.spec.js` 8 条（含新增 1 条与既有 7 条）在本轮一次运行里全绿；`check` / `test:unit` / `audit` 均通过。
- 环境注：验证中途曾撞一次 `/auth/sms` 同 IP 限流「验证码请求过多」（本地经 ssh 隧道连远端 dev 库，1 小时 50 次上限）。只做只读查询确认计数随时间滑落（48 → 47 → 44），未重置远端库；等窗口滑出后全量回归一次跑通。

## 偏离与理由
- 无实现偏离。测试截图路径用 `../.trellis/tasks/T-008/shots/...`（playwright 在 `frontend/` 目录运行，`../` 落到仓库根任务目录），避免截图落到 `frontend/.trellis/` 的错误位置。
