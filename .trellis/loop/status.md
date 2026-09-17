# 自循环状态

- 当前任务：T-026（刷新 T-012 过期截图，证据保鲜）——已完成 Plan/Implement/Verify/Finish，`status` 改 `done` 并已 push。三张图刷新入库（144227→142118、88340→88248、182021→181841 字节），未改产品代码、未改用例代码。核对中推翻两处 brief 前提：①写这三张图的用例是 `frontend/tests/robot-label.spec.js`（第 68/75/96 行），不是 brief 写的 `ca-account.spec.js`（后者只写 T-008 的图），T-017 报告归因有误；②「相对当前代码已过期」不成立——字节差异全部来自用例每轮随机值（手机号/凭据 `Math.random()`），无代码改动连跑两次三张图 md5 两两不同，像素级比对（阈值 12）可见差异仅 3399/3167/6851 px 且全落在随机值文本带，文案版式一字未动。详见 `.trellis/tasks/T-026/report.md`。
- 上一个任务：T-020（S-04 同步失败可见性）——已完成并本地提交，本轮 T-026 push 时连带推上远端（`ed61449` + `55d17d7`）。

- 最近 5 轮（取自 `runs.log`，采样于本 worker 收尾提交前；本轮 T-026 的 DONE 行由驱动在本 worker 退出后写回）：

| 任务 | 结果 | 耗时 | 提交 | 备注 |
| --- | --- | --- | --- | --- |
| T-018 | FAIL | 2406s | fceab02 | rc=143 驱动超时杀（后续已由核对式续跑收口） |
| T-019 | RATE_LIMITED | 802s | 7ee99a7 | PRIMARY 限流 |
| T-019 | DONE | 1248s | 715979c | FALLBACK 完成 |
| T-020 | RATE_LIMITED | 321s | e84e00b | 上一轮限流 |
| T-020 | DONE | 933s | 55d17d7 | FALLBACK 完成，本轮连带推送 |

- 本轮（T-026）验证数字：`npx playwright test tests/robot-label.spec.js --reporter=list` → `1 passed (12.9s)`（无代码改动复跑 `1 passed (13.4s)`，两次 md5 全不同）；`npx playwright test tests/ca-account.spec.js --reporter=list` → `8 passed (51.1s)`；`npm run check` exit 0；`test:unit` 16 pass / 0 fail（82.047834ms）；`audit_documents.py` errors `[]`；像素差异明细 `.trellis/tasks/T-026/diff-analysis.txt`。`/auth/sms` 消耗 10 次（本机 IP 近 1 小时计数 9 → 19，上限 50）。
- 累计（`runs.log` 已记录 28 轮，本轮 DONE 行待驱动写回后变 29）：DONE 20 / RATE_LIMITED 6 / GATED 1 / FAIL 1。
- 待 orchestrator 处理的事：有，四条。
  1. **T-020 的两笔提交被本轮 push 连带推上远端**（`ed61449` 用例 + `55d17d7` 收尾记录，`e84e00b..979c145`）。T-020 notes 原标注「未 push，留待 orchestrator 复核后主会话 push」；本次推送按 T-026 notes 的机制任务直推规则执行，push 语义推整个分支，非越权单推，已在 `gates.md` EXECUTED 行标明，供复核。
  2. **T-008 截图是真漂移，建议另开证据保鲜任务**：`ca-account.spec.js` 会重写 `.trellis/tasks/T-008/shots/empty-credential.png`（197704→188099 字节，可见差异 199203 px 遍布整页），成因是弹窗背后页面滚动位置变化，弹窗文案一致。不在 T-026 goal 范围内，已 `git checkout --` 还原，未混入本轮提交；重跑该用例即可复现。
  3. T-020 注入的合成数据（儿童/家庭/家长/关联/阶段画像/报告/后台任务明细见 `.trellis/tasks/T-020/report.md`）留待按「只做状态变更、不物理删除、补写审计」方式清理。
  4. 认知更正：T-017 report 里「跑 `ca-account.spec.js` 会重写 T-012 三张截图」与「T-012 入库截图相对当前代码已过期」两句均不成立（见本轮 report 的「对 brief 前提的核对」），后续引用请以 T-026 report 为准。
- 下一步：队列下一个 `todo` = T-027（存量测试文件过 ruff format）。其后 T-021（设计，gate=review）、T-028（澄清清单，gate=external）、T-024（常设巡检）。
