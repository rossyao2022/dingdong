# 自循环状态

- 当前任务：T-020（S-04 阶段画像/同步失败在家长端的可见性）——已完成实现/验证/提交，`status` 改 `done`。结论：数据同步失败在家长端已可见（`robot_observation.availability=stale` + 提示「同步未取得最新结果，已有数据不会当作最新数据展示。」），无需改产品代码；新增 `frontend/tests/sync-failure-visibility.spec.js` 1 条真实 Chrome 回归用例。阶段画像 `failed` 分支代码存在但无 fixture 场景可端到端复现，如实标未验证（见 T-020 report）。
- 上一个任务：T-019（O-02 家长姓名回落）已完成并 push（`[T-019]` 提交 `2c00ac1`，远端 sha `2c00ac1d3208ac4e574eaebe21f7b0e0540ebc4f`）。

- 最近 5 轮（取自 `runs.log`，采样于本 worker 收尾提交前；本轮 T-020 的 DONE 行由驱动在本 worker 退出后写回）：

| 任务 | 结果 | 耗时 | 提交 | 备注 |
| --- | --- | --- | --- | --- |
| T-017 | DONE | 546s | 9b96c4d | G-02 来源声明 |
| T-018 | FAIL | 2406s | fceab02 | rc=143 驱动超时杀（后续已由核对式续跑收口） |
| T-019 | RATE_LIMITED | 802s | 7ee99a7 | PRIMARY 限流 |
| T-019 | DONE | 1248s | 715979c | FALLBACK 完成 |
| T-020 | RATE_LIMITED | 321s | e84e00b | 上一轮限流（本轮为干净重跑） |

- 本轮（T-020）验证数字：`npx playwright test tests/sync-failure-visibility.spec.js --reporter=list --output=/tmp/dingdong-pw-out` → `1 passed (26.7s)`；`npm run check` exit 0；`test:unit` 16 pass / 0 fail（74.844916ms）；`audit_documents.py` errors `[]`。证据 `.trellis/tasks/T-020/growth-overview-after-failure.json`（`availability=stale / reason=UPSTREAM_TIMEOUT`）+ 桌面/390×844 两张截图。
- 累计（`runs.log` 已记录 27 轮，本轮 DONE 行待驱动写回后变 28）：DONE 19 / RATE_LIMITED 6 / GATED 1 / FAIL 1。
- 待 orchestrator 处理的事：有，两条。① T-020 两个本地 commit（`ed61449` 代码与证据 + 收尾记录 commit）**未 push**——worker 硬规则「不许 push（唯一例外是 gated+APPROVE 门禁动作）」，T-020 `gate: none` 不属例外；queue 备注与 gates.md APPROVE T-003 的「第二批可直推」授权仍在，如需推送由 orchestrator 复核后主会话 `git push origin codex/release-v0.3.6`。② T-020 注入的合成数据（儿童/家庭/家长/关联/阶段画像/报告/后台任务明细见 `.trellis/tasks/T-020/report.md`）留待按「只做状态变更、不物理删除、补写审计」方式清理。
- 下一步：队列下一个 `todo` = T-026（刷新 T-012 过期截图）。其后 T-027（存量测试文件过 ruff format）、T-021（设计，gate=review）、T-028（澄清清单，gate=external）、T-024（常设巡检）。
