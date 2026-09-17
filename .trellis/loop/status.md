# 自循环状态

- 当前任务：T-018（S-05 本地 e2e 数据漂移变可判定）——本轮为**核对式续跑**（上一轮 FAIL 遗留 `doing` + 脏工作区），已完成实现/验证/提交/push，`status` 改 `done`。改动：`tests/support.js` 增 `cliDatabaseIdentity()`/`cliPolicyVersionId()`；`flows.spec.js` 增 `test.beforeAll` 前置一致性检查（浏览器侧经代理读用途说明主键 vs CLI 侧 `manage.py` 读同一记录主键）与 `inject()` 的 `Child does not exist` 诊断；`ops-public.spec.js` 增 `LOCAL_ENTRY` + `skipLocalDataGap()`（「报告」用例本地显式 skip 并打印原因，公网仍失败）。
- 上一个任务：T-019（O-02 家长姓名回落）已完成并 push（`[T-019]` 提交 `2c00ac1`，远端 sha `2c00ac1d3208ac4e574eaebe21f7b0e0540ebc4f`）。

- 最近 5 轮（取自 `runs.log`，采样于本 worker 收尾提交前；本轮 T-018 的 DONE 行由驱动在本 worker 退出后写回）：

| 任务 | 结果 | 耗时 | 提交 | 备注 |
| --- | --- | --- | --- | --- |
| T-016 | DONE | 346s | 0b6b6fe | P-03 同意框四要素 |
| T-017 | DONE | 546s | 9b96c4d | G-02 来源声明 |
| T-018 | FAIL | 2406s | fceab02 | rc=143 驱动超时杀，遗留脏工作区（本轮续跑已收口） |
| T-019 | RATE_LIMITED | 802s | 7ee99a7 | PRIMARY 限流 |
| T-019 | DONE | 1248s | 715979c | 由 FALLBACK 完成 |

- 本轮（T-018 续跑）验证数字：`npx playwright test tests/flows.spec.js --reporter=list` → `8 passed (2.4m)`（原文 `flows-green-rerun.txt`，全篇无 `Child does not exist`）；`ops-public.spec.js -g "报告：查看已生成内容"` 本地 → 打印 `[ops-public] 跳过：本地入口没有处于失败态的报告任务…` 后 `1 skipped`（原文 `ops-public-local-report-after-fix-rerun.txt`）；`npm run check` exit 0；`test:unit` 16 pass / 0 fail（84.85ms）；`audit_documents.py` errors `[]`。开工前只读核对 `/auth/sms` 同 IP 近 1 小时计数 `0`（上限 50）。
- 累计（`runs.log` 已记录 26 轮）：DONE 19 / RATE_LIMITED 5 / GATED 1（T-002）/ FAIL 1（T-018，本轮已续跑收口）。
- 待 orchestrator 处理的事：无。上一轮挂起的「T-018 卡 `doing` + 脏工作区」已由本轮核对式续跑收口，不再需要 orchestrator 重置任务状态。
- 下一步：队列下一个 `todo` = T-020（S-04 阶段画像/同步失败在家长端可见性，第二批可直推）。其后 T-026（刷新 T-012 过期截图）、T-027（存量测试文件过 ruff format）为机制维护小任务，同样可直推；T-021（设计，gate=review）与 T-028（澄清清单，gate=external）需门禁，T-024 为常设巡检任务。
