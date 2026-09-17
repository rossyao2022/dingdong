# T-026 progress

## 已完成阶段
- Plan
- Implement
- Verify
- Finish

## 改动文件
- `.trellis/tasks/T-012/shots/account-row-desktop.png`、`account-row-mobile.png`、`replace-dialog-desktop.png`（重跑刷新，仅三张二进制）
- `.trellis/tasks/T-026/`（progress.md、report.md、shots-before.sha256、shots-run1.sha256、shots-after.sha256、diff-analysis.txt、git-status-baseline.txt、card-old/new.png、dlg-old/new.png）
- `.trellis/loop/queue.md`（T-026 status: todo → doing → done，notes 补执行结果）
- `.trellis/loop/gates.md`（一条 EXECUTED 行）
- `.trellis/loop/status.md`（整文件重写）
- `.trellis/workspace/yihu/experiment-log.md`（追加 T-026 行）
- 未改产品代码；`.trellis/tasks/T-008/shots/empty-credential.png` 被 `ca-account.spec.js` 连带重写，已 `git checkout --` 还原，未混入本轮提交。

## 跑过的命令与结果
- `shasum -a 256 .trellis/tasks/T-012/shots/*.png`（开工基线）→ 3 个 sha 见 `shots-before.sha256`
- `git status --short`（开工基线）→ 仅 ` M .trellis/loop/runs.log`
- 只读核对截图生成方：`grep -rn "shots" frontend/tests/*.js` → `.trellis/tasks/T-012/shots/` 的唯一写入者是 `frontend/tests/robot-label.spec.js`（第 68/75/96 行）；`ca-account.spec.js` 不写这三张图（它写 `.trellis/tasks/T-008/shots/empty-credential.png`）。
- 只读核对限流余量：`SmsChallenge` 近 1 小时 `client_ip=127.0.0.1` 计数 = 9（上限 50）。三次用例共消耗 10 次 `/auth/sms`（robot-label 2 次 + ca-account 8 次）。
- `cd frontend && npx playwright test tests/robot-label.spec.js --reporter=list`（第 1 次，刷新）→ `1 passed (12.9s)`
- 同命令（第 2 次，无代码改动）→ `1 passed (13.4s)`；三张图 md5 与第 1 次全不相同（desktop `58885c00…` vs `1cb6952a…`，mobile `283c63e5…` vs `90371292…`，dialog `6d00d310…` vs `429f70df…`）
- `cd frontend && npx playwright test tests/ca-account.spec.js --reporter=list` → `8 passed (51.1s)`（8 条逐条 ✓）
- `cd frontend && npm run check` → exit 0
- `cd frontend && npm run test:unit` → `tests 16` / `pass 16` / `fail 0` / `duration_ms 82.047834`
- `python3 scripts/audit_documents.py` → `{"markdown_files": 80, "local_links_checked": 497, "archived_files_checked": 85, "operations": 55, "schemas": 65, "errors": []}`
- 像素级核对（HEAD 版 vs 本轮刷新版，阈值 12）：desktop 可见差异 3399 px、mobile 3167 px、dialog 6851 px，全部落在随机值文本带（手机号 / 账户号 / 摘要 / 时间戳 / 凭据输入框），原文见 `diff-analysis.txt`

## 下一步
- 无。三张截图已刷新并入库；T-026 `status` 改 `done`。队列下一个 `todo` = T-027。
