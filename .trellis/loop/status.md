# 自循环状态

- 当前任务：T-033（展示面 B：面一人设 + 面三健康度四态，家长端 UI）——Plan/Implement/Verify/Finish 走完，`status` 改 `done`。产出：新纯函数模块 `frontend/companion.js`（四态分支、是否显分、空态/错误态文案的判定，判定与 HTML 分离）+ `#reports` 在「初始测评」卡之后、「已生成报告」之前新增「陪学伙伴」面板（人设卡 + 下方「互动健康度」四态；`insufficient_data` 不做判断、`normal` 显分数与观察天数、`watch` 只出轻提示且不出复测 CTA、`reassess` 只出建议文案；`availability != ready` 不显示数值；面板级合成徽标；底部固定「这是互动情况的提示，不是对孩子的评价。」）+ `#settings` 机器人账户面板只读人设行 + 新用例（单测 18 项、真实 Chrome 2 项）。验证：`npm run check` exit 0；`npm run test:unit` `tests 34 / pass 34 / fail 0`；真实 Chrome `companion-panel` + 回归 `growth-window`/`ca-account`/`robot-account-row` → `13 passed (1.9m)`；截图 8 张入库；`audit_documents.py` errors `[]`。**两处未实现已如实记录**（换机后旧号人设无数据通路；`reassess` 的 CTA 与回写属 T-035），**一处口径差**（acceptance 要求 `watch` 不显分，设计 §1.3 写「只有 normal / watch 展示分数」，按更严的 acceptance 实现）。另修环境：本地开发库漏跑 T-032 的迁移，补跑 `manage.py migrate` 应用 `0009_careassessmentevent`（本地库，非生产）。详见 `.trellis/tasks/T-033/report.md`。
- 上一个任务：T-032（展示面 A：四个面的数据层与家长端接口）——`status` 已 `done` 并 push，远端 sha `a7c2035`。
- 最近 5 轮（取自 `runs.log`，采样于本 worker 收尾提交前；本轮 T-033 的 `ROUND ... DONE` 行由驱动在本 worker 退出后写回）：

| 任务 | 结果 | 耗时 | 提交 | 备注 |
| --- | --- | --- | --- | --- |
| T-028 | RATE_LIMITED | 436s | bf5c48b | 连续第 6 次，两个模型都限流 |
| T-032 | RATE_LIMITED | 491s | bf5c48b | 开工即中断（rc=1, dirty-worktree），orchestrator 17:05Z 复位 doing→todo |
| T-033 | FAIL | 240s | bf5c48b | 驱动错序轮（T-032 被卡在 doing），手动终止（rc=143） |
| T-032 | DONE | 1980s | cda5201 | 数据层完成并 push（a7c2035），补修复证据 |
| T-033 | 进行中 | — | 998e3f0 | 本轮：人设 + 健康度四态，真实 Chrome 13 项通过，已 push |

- 累计（`runs.log` 已记录 41 轮，本轮 DONE 行待驱动写回后变 42）：DONE 26 / RATE_LIMITED 13 / GATED 1 / FAIL 2。
- 待 orchestrator 处理的事：有，两条。
  1. **`REQUEST T-028 external`（09-17 15:24Z）仍待放行**：给 DingDong 的澄清清单已就绪，发送属 external 动作，需 Yihu 放行后由人执行。放行前它保持 `gated`，驱动会跳过。
  2. **T-033 的两处范围判定需要拍板**：①「换机后旧号人设只读展示」缺数据通路（四个展示面接口只解析 `active` 号），要补就得新增后端读接口（契约变更）——是否单开任务；②`watch` 态是否显 `health_score`，acceptance 与设计 §1.3 说法不一致，本轮按更严的 acceptance（不显分）实现，改一处 `HEALTH_STATES.watch.score` 即可反转。
- 下一步：队列下一个 `todo` = T-034（展示面 C：面二 15/30 天成长报告，家长端 UI，gate=none，可直推）；其后 T-035、T-024（常设巡检，gate=review）。T-034/T-035 都需要真实 Chrome 走查与截图。

## 驱动告警
- 需 orchestrator：T-031 连续失败 2 次，已自动标 blocked（2026-09-17T14:22:17Z）。（orchestrator 14:25Z 已解锁、T-031 已 done；按 prompt「原样保留」未改本节。）
