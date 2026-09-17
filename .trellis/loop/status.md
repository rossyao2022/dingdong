# 自循环状态

- 当前任务：T-029（刷新 T-008 漂移截图）——Plan/Implement/Verify/Finish 走完，`status` 改 `done`。结论：简报写的「真漂移」不成立，实测是**运行间不确定**（同一份代码连跑两次得 197704 / 188099 两版），像素比对显示差异全在弹窗背后的页面滚动位置（弹窗正文区 0 差异）；已在截图前加 1 行固定滚动到页首（只改用例、不改产品），单条连跑三次 + 全量跑一次共 4 次同字节 `46197db6…`（189622 字节），截图入库。`ca-account.spec.js` 全量 `8 passed (54.3s)`、`npm run check` exit 0、`test:unit` 16 pass 0 fail、audit errors `[]`。已按本任务 notes 的机制维护类直推 push，远端 sha `a1e1d56`。详见 `.trellis/tasks/T-029/report.md`。
- 上一个任务：T-021（四个展示面设计文档）——orchestrator 于 13:16Z 追加 `APPROVE T-021 review`（含授权收尾轮直推），本轮已执行：`git push` → `1bf231c..d2b44c7`，远端 sha `d2b44c74d665539c123833d166355148a8affe11`；T-021 `status` 改 `done`，`gates.md` 补 `EXECUTED` 行。批准同时导入了 T-032/T-033/T-034/T-035 四个实现任务（gate: none，直推规则）。

- 最近 5 轮（取自 `runs.log`，采样于本 worker 收尾提交前；本轮 T-029 的 DONE 行由驱动在本 worker 退出后写回）：

| 任务 | 结果 | 耗时 | 提交 | 备注 |
| --- | --- | --- | --- | --- |
| T-020 | RATE_LIMITED | 321s | e84e00b | PRIMARY 限流 |
| T-020 | DONE | 933s | 55d17d7 | FALLBACK 完成 |
| T-026 | DONE | 616s | 3966cb0 | PRIMARY 完成 |
| T-027 | DONE | 310s | b533410 | PRIMARY 完成 |
| T-021 | RATE_LIMITED | 341s | d2b44c7 | 设计提交已落盘并 gated，轮末限流 |

- 累计（`runs.log` 已记录 31 轮，本轮 DONE 行待驱动写回后变 32）：DONE 22 / RATE_LIMITED 7 / GATED 1 / FAIL 1。
- 待 orchestrator 处理的事：有，两条。
  1. **T-026 的「T-008 真漂移」定性需以 T-029 report 为准更正**：该现象是运行间不确定（滚动动画时序），不是相对当前代码过期。T-029 已把根因固定，此后该文件每跑必同字节。queue 里 T-026 notes 的「建议 orchestrator 另开一个证据保鲜任务」已由 T-029 销项。同类风险仍在：`robot-label.spec.js` 的 T-012 三张图含用例内随机值（手机号/凭据 `Math.random()`），每跑必变，属设计如此，本轮未处理，供决定是否也做确定化。
  2. **队列顺序**：T-032/T-033/T-034/T-035 已插在 T-028 之后、T-024 巡检之前（执行序 B 依赖 A、D 依赖 B、C 独立）。下一个 `todo` 按队列顺序是 T-030（T-020 合成数据清理），不是 T-032——若想先推 T-032，需要 orchestrator 调队列顺序。
- 本轮无新门禁申请（T-029 属机制维护类直推；T-021 的门禁已由 APPROVE 执行）。
- 下一步：队列下一个 `todo` = T-030（T-020 注入合成数据的清理，gate=none，运维 chore 可直推）。其后 T-031（格式化 chore）、T-028（DingDong 澄清清单，gate=external）、T-032→T-035（展示面 A–D 实现）、T-024（常设巡检，gate=review）。
