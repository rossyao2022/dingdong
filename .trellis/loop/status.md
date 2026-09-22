# 自循环状态

- 当前任务：T-048（O-15 同步状态词表补 blocked + O-16 测评用途口径 + S-07 用例等待收口）——已 done、已 push（`9b6ee67`）。三条全做：`CHECKPOINT_STATUS` 补 `"blocked": "已停用"`；`QUESTIONNAIRE_PURPOSE["assessment"]`→「初始测评」+ 模型 choice/title 去「（测试）」+ 迁移 `0011`；`flows.spec.js:184` 20s→120s。真实 Chrome 走查 9 项全 PASS，截图 3 张在 `.trellis/tasks/T-048/shots/`。
- 上一个任务：T-045（第五轮产品巡检，O-15/O-16 backlog + S-07 判断）——`APPROVE T-045 review` 已批复（2026-09-22T03:56Z），`status` 已 `done`。
- 最近 5 轮（取自 `runs.log`；本轮 T-048 的 `ROUND … DONE` 行由驱动在本 worker 退出后写回）：

| 任务 | 结果 | 耗时 | 提交 | 备注 |
| --- | --- | --- | --- | --- |
| T-041 | FAIL | 2406s | dbbba00 | rc=143,dirty-worktree，驱动复位 doing→todo |
| T-041 | DONE | 2406s | 9954d2e | P-16 对话框不再被重渲染关掉 + P-17/O-08…O-11 |
| T-042 | RATE_LIMITED | 1283s | 09bc2ca | 第四轮巡检 backlog，限流打断收尾 |
| T-042 | DONE | 1688s | e6d940a | 收尾：`status` 改 `done` + 直推 |
| T-044 | DONE | 2335s | 59888f2 | P-19 归档口径统一 + O-12/O-13/O-14 |

- 累计（`runs.log` 已记录 55 轮）：DONE 35 / RATE_LIMITED 15 / GATED 2 / FAIL 3。
- 待 orchestrator 处理的事：有，四条。
  1. **T-048 发现一条 T-047 遗留红灯**：`tests/test_questionnaires.py::test_reference_exploration_is_seeded_and_meaningful` 断言 `"非正式" in q.description`，而 `testsupport/seed.py:38` 的描述已被 T-047（2520abf）改成「通过日常情境题…」，断言未改，故后端全量 `1 failed, 346 passed`。与本轮无关，建议另立小任务收口（改断言或改 seed）。
  2. **「（测试）」残留两处未在本轮范围**：`ops/templates/ops/questionnaire_new.html:22` 表单提示与 `backend/docs/OPS_MANUAL.md:112` 仍写「测评流程（测试）20–30 题」。T-045 backlog 的 O-16 只到词表 + 模型 choice/title，本轮未动，是否后续一并清理请编排侧定。
  3. **`REQUEST T-028 external`（09-17 15:24Z）仍待放行**：给 DingDong 的澄清清单已就绪，发送属 external 动作，需 Yihu 放行后由人执行。
  4. **两条既有环境项**：`ops-console.spec.js` 题库用例本地必失败（`net::ERR_ABORTED`，既有环境问题）；`frontend/deployment-tests/parent-conflict-recovery.spec.js` 仍无本地可跑法（指向公网、要管理员凭据、会在生产库建账号，权限边界外）。
- 下一步：queue.md 第一条 `todo` 是 T-049 第六轮产品巡检（gate:review），复核 T-048 修复处，由 orchestrator 驱动下一轮。

## 驱动告警
- 需 orchestrator：T-031 连续失败 2 次，已自动标 blocked（2026-09-17T14:22:17Z）。（orchestrator 14:25Z 已解锁、T-031 已 done；按 prompt「原样保留」未改本节。）
