# T-007 进度

## 阶段
- Plan：完成
- Implement：完成
- Verify：完成
- Finish：进行中

## 核对式续跑（fallback，2026-09-17）
- 前任声明与磁盘不符：前任 progress.md 写「Implement：未开始」「改动文件：待填」「跑过的命令与结果：待填」，但磁盘已有三处改动（`git diff --stat`：frontend/app.js 14 行、frontend/client.css 12 行、frontend/tests/ca-account.spec.js 102 行），即 Implement 实际已做完、未回写 progress。
- progress.md 未记录任何验证命令，无可重跑命令，该步跳过。
- 以磁盘为准，从 Verify 阶段接着做。

## Plan（前任结论，核对后沿用）
- 任务 goal 拆 3 件事：①绑定成功后停在「账户与关联」页；②高亮新生成的账户号；③显示一行「账户号已生成，等机器人接通后开始同步」。
- 开工前实测（真实 Chrome，已登录 + 已有儿童档案，POST 返回 201）三份临时 spec（已删除）：
  - 标签带路由 `/?nfc_token=X#settings`：`HASH_AFTER="#settings"`、`TOAST_TEXT="账户号已建立，正在等待机器人确认接通。"`、`ACCOUNT_ROWS=1`、`HIGHLIGHT=0`。
  - 从「账户与关联」页按钮手填：同上。
  - 标签不带路由 `/?nfc_token=X`：`HASH_AFTER=""`、`#page-label="天赋探索"`、`ACCOUNT_ROWS=0`、toast 非空。
  - 标签不带路由且未登录（登录 → 建档案）：`HASH_AFTER="#explore"`、`#page-label="天赋探索"`、`ACCOUNT_ROWS=0`。
- 结论：backlog P-01「现状」里「无成功提示 / `#toast` 为空」不成立（`toast()` + `await render()` 自 `03f3d38` 起就在）；真实缺陷是**不带 hash 路由的标签链接绑定后停在天赋探索页，看不到新号**，且**新号没有高亮**。
- 验收映射：hash 落点 → `new URL(page.url()).hash === "#settings"`；新号 → `.account-row.is-new` 文本等于接口返回的 `ca_account_id`；成功提示 → `#toast` 与「机器人账户」面板提示文案；截图 → 桌面 + 390×844。
- 实现落点：`frontend/app.js` 的 `submitRobotBinding` / `submitRobotReplacement` 成功分支（`await render()` → 记 `hints.newAccountId` + `to("settings")`）、`accountRow()`（加 `is-new` 类与「刚生成」标签）、`frontend/client.css`（`.account-row.is-new` 样式）。

## 改动文件
- frontend/app.js
- frontend/client.css
- frontend/tests/ca-account.spec.js

## 跑过的命令与结果
- `cd frontend && npm run check` → exit 0
- `cd frontend && npm run test:unit` → 16 pass 0 fail（duration 90.17ms）
- `python3 scripts/audit_documents.py` → `"errors": []`
- `cd frontend && npx playwright test tests/ca-account.spec.js --reporter=list`（全 7 条）→ 2 passed, 5 failed；5 个失败均卡在 `login()` 里「登录」按钮 disabled，页面快照 `.form-error` 为「验证码请求过多」（后端 `/auth/sms` 同 IP 1 小时 50 次上限；本地经 ssh 隧道 `dell` 连远端 dev 库，计数已到 50）。既有测试 1/2（NFC 承接、复用同号）通过，绑定主流程无回归。
- 等限流窗口滑出后，`cd frontend && npx playwright test tests/ca-account.spec.js -g "绑定成功后停在账户页|新会话从标签进来|绑定落点截图" --reporter=list` → `3 passed (19.4s)`（逐条 7.7s / 5.5s / 5.6s）。
- 截图已由本次通过运行的用例生成并抄入 `.trellis/tasks/T-007/shots/`：`t007-bind-landed-desktop.png`（1280×720）、`t007-bind-landed-mobile.png`（390×844）。

## 下一步
- 提交（code + 任务目录）→ 按第一批规则直推 → 收口记录（queue/gates/status/experiment-log）→ 再推。
