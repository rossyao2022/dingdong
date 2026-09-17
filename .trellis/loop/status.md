# 自循环状态

- 当前任务：T-037（复测回写 500 的模型根因 + 前端失败落点与 5xx 文案）——Plan/Implement/Verify/Finish 走完，`gate: none`，已按任务 notes 直推 origin/codex/release-v0.3.6，`status` 改 `done`。三处改动：①`CaReassessmentEvent.event_id` 唯一性从全局收窄为 `(ca_account, event_id)`（迁移 `0010`，只放宽不去重）；②复测「重新测评 / 先不测」回写失败落在**复测区块自己这一块**（「这次没写成功，请重试。」+「重试」，同一答案同一 `request_id` 重放），不再经 `showError()` 写进「成长观察」的窗口表单；③`api.js` 的 `errorBody()` 让 5xx 统一给「服务暂时不可用，请稍后再试。」。验证：先失败证据（回退模型+迁移复跑 → `IntegrityError: … ca_reassessment_event_event_id_key`，`1 failed in 17.65s`）；`tests/test_ca_display.py` `53 passed in 237.82s`；前端 `npm run check` exit 0、`npm run test:unit` `65 pass / 0 fail`；真实 Chrome `tests/reassessment-write-failure.spec.js`（2 项）+ T-035 回归（3 项）`5 passed (3.7m)`；ruff / manage.py check / makemigrations --check 干净；`audit_documents.py` errors `[]`。本地开发库已应用 `0010`，**生产库未迁移**。详见 `.trellis/tasks/T-037/report.md`。
- 上一个任务：T-024（产品巡检第二轮）——只产出 backlog，已申请 review；orchestrator 09-17 19:34Z 复看通过，`status` 已 `done`。
- 最近 5 轮（取自 `runs.log`，采样于本 worker 收尾提交前；本轮 T-037 的 `ROUND … DONE` 行由驱动在本 worker 退出后写回）：

| 任务 | 结果 | 耗时 | 提交 | 备注 |
| --- | --- | --- | --- | --- |
| T-033 | DONE | 1854s | ca699b3 | 人设 + 健康度四态，真实 Chrome 13 项，已 push |
| T-034 | DONE | 982s | 4a249de | 成长周期报告，真实 Chrome 1 项 11 步，已 push |
| T-035 | DONE | 2301s | 4d35165 | 复测 CTA 与回写闭环，真实 Chrome 3 项，已 push |
| T-024 | GATED | 1594s | 43a68e4 | 巡检 backlog（家长端 6 + 运营端 2 + 稳定性 1），已复看导入 T-037/038/039 |
| T-037 | DONE | — | 待提交 | 本轮：复测回写 500 根因 + 失败落点 + 5xx 文案，已 push |

- 累计（`runs.log` 已记录 45 轮，本轮 DONE 行待驱动写回后变 46）：DONE 29 / RATE_LIMITED 13 / GATED 1 / FAIL 2。
- 待 orchestrator 处理的事：有，两条。
  1. **`REQUEST T-028 external`（09-17 15:24Z）仍待放行**：给 DingDong 的澄清清单已就绪，发送属 external 动作，需 Yihu 放行后由人执行。
  2. **T-024 backlog 的其余条目已导入队列**（T-038 七条文案小项、T-039 三条范围判定 + 过期截图刷新、T-040 第三轮巡检），都是 `todo`，驱动会自己往下取；T-024 里两条「未修」记录本轮已消掉一条（P-10 已修，见上），另一条 O-05（演示库脏数据）仍维持暂缓。
- 下一步：驱动取下一个 `todo`（T-038 文案与展示小项打包）；T-028 保持 `gated` 不动。

## 驱动告警
- 需 orchestrator：T-031 连续失败 2 次，已自动标 blocked（2026-09-17T14:22:17Z）。（orchestrator 14:25Z 已解锁、T-031 已 done；按 prompt「原样保留」未改本节。）
