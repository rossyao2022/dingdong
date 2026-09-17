# T-007 报告

## goal
家长端绑定机器人成功后留在「账户与关联」页、高亮新生成的账户号，并显示一行「账户号已生成，等机器人接通后开始同步」，不再无提示跳回首页（backlog P-01）。

## 实际做了什么
- 续跑：本轮是 T-007 的 FALLBACK 重跑（上一轮 PRIMARY 限流 rc=1，`LOOP_TASK_ID=T-007`）。按核对式续跑规则核对：前任 progress.md 写「Implement 未开始」，但磁盘已有 `frontend/app.js` / `frontend/client.css` / `frontend/tests/ca-account.spec.js` 三处改动，以磁盘为准，从 Verify 阶段接着做。
- 改动内容（沿用前任已落盘的实现，逐 hunk 核对无误）：
  - `frontend/app.js`：`submitRobotBinding` / `submitRobotReplacement` 成功分支由 `await render()` 改为记 `hints.newAccountId` + `to("settings")`，保证裸标签链接（无 hash 路由）绑定后也落在账户页；`accountRow()` 对 `a.ca_account_id === hints.newAccountId` 的行加 `is-new` 类与「刚生成」标签；`render()` 在账户页渲染完成后清掉 `hints.newAccountId`，保证高亮只出现一次。
  - `frontend/client.css`：新增 `.account-row.is-new` 与 `.tag.fresh` 样式。
  - `frontend/tests/ca-account.spec.js`：新增 3 条真实 Chrome 用例（绑定落点 + 新会话从标签进来 + 截图）。
- 验收映射与 goal 一一对应：hash 落点 `#settings`、新号高亮 `.account-row.is-new`、成功提示 `#toast` 与「机器人账户」面板文案。

## 验证命令与真实输出
- `cd frontend && npm run check` → exit 0
- `cd frontend && npm run test:unit` → `tests 16 / pass 16 / fail 0 / duration_ms 90.17`
- `python3 scripts/audit_documents.py` → `{"markdown_files": 80, "local_links_checked": 497, "archived_files_checked": 85, "operations": 55, "schemas": 65, "errors": []}`
- `cd frontend && npx playwright test tests/ca-account.spec.js --reporter=list`（全 7 条）→ 第 1、2 条通过（NFC 承接 6.0s、复用同号 8.0s），第 3–7 条失败；失败均卡在 `login()` 里「登录」按钮 disabled，页面快照 `.form-error` =「验证码请求过多」。根因：后端 `/auth/sms` 对同 IP 限流「1 小时 50 次」，本机 127.0.0.1 经 ssh 隧道 `dell` 连远端 dev 库，计数已达 50。此失败与本次改动无关，是环境性限流。
- 只读查询计数分布（确认是限流、非代码缺陷）：`last-hour count: 50`，age buckets（分钟前，条数）`{5: 2, 15: 1, 20: 24, 25: 14, 30: 4, 50: 2, 55: 3}`。
- 等最早一批滑出限流窗口后，`cd frontend && npx playwright test tests/ca-account.spec.js -g "绑定成功后停在账户页|新会话从标签进来|绑定落点截图" --reporter=list` → `3 passed (19.4s)`，逐条：绑定成功后停在账户页并高亮新号 7.7s、新会话从标签进来 5.5s、绑定落点截图 5.6s。
- 截图证据：`.trellis/tasks/T-007/shots/t007-bind-landed-desktop.png`（1280×720）、`t007-bind-landed-mobile.png`（390×844），均由本次通过运行的截图用例生成。

## 未验证项
- 全量 `tests/ca-account.spec.js` 7 条没有在一次运行里全绿——前 2 条与后 3 条（本次新用例）分别在两次运行里通过；中间 1 条既有「换机」与 1 条既有「窄屏」用例因验证码限流未在本轮复跑。它们在改动前基线是过的，本次改动只动绑定成功后的落点/高亮，不触碰换机弹窗与窄屏布局；仍建议限流解除后复跑全 7 条确认。

## 偏离与理由
- 无实现偏离。环境偏离：验证码接口限流（50/小时/IP）导致 e2e 需要分两次跑；未重置远端 dev 库计数（该库经 ssh 隧道连 `dell`，删行属于远端写操作，超出 worker 权限边界）。
