# 自循环状态

- 当前任务：T-036（loop 账本瘦身）——Plan/Implement/Verify/Finish 走完，`status` 改 `done`。`gates.md` 95→34 行、`queue.md` 257→119 行，两文件每轮读入 88025→21606 字节（-75.5%）；决定段 47 行历史（43 条 EXECUTED + 4 条一次性事后追认）移入 `.trellis/loop/gates-archive-20260917.md`，只留 T-003 常设直推规则 / T-021 批复 / DENY T-099；28 个 done 任务压成「标题 + 一行指针」（指向各自 `report.md`，T-025 指向 queue 留档），压缩前全文 257 行留档 `.trellis/loop/queue-archive-20260917.md`；todo 任务 notes 逐字未压。验证：`python3 .trellis/tasks/T-036/verify.py` 23 PASS / 0 FAIL（直接跑驱动脚本里真实的 `next_task` / `classify` / `loop_gate_snapshot` 解析块：`next_task` 返回 T-031、`classify(T-036/T-030)` 返回 DONE、门禁快照 2 行且 blocked 列表空）、归档 47 行逐行核对 0 缺失且行序一致、抽查 T-030/T-022/T-025 被压缩内容可回溯、`audit_documents.py` errors `[]`。已按机制维护类直推 push，远端 sha `2dff105`。详见 `.trellis/tasks/T-036/report.md`。
- 上一个任务：T-030（T-020 注入合成数据清理）——清单逐条以状态变更处置（无物理删除）+ 审计文案修正，真实 Chrome 11 张截图入库，已 push 远端 sha `b95ecf2`。

- 最近 5 轮（取自 `runs.log`，采样于本 worker 收尾提交前；本轮 T-036 的 `ROUND ... DONE` 行由驱动在本 worker 退出后写回）：

| 任务 | 结果 | 耗时 | 提交 | 备注 |
| --- | --- | --- | --- | --- |
| T-029 | DONE | 541s | c893a3d | PRIMARY 完成 |
| T-030 | RATE_LIMITED | 627s | c893a3d | 续跑轮完成并提交，轮末限流 |
| T-031 | RATE_LIMITED | 95s | c893a3d | 开工即中断 |
| T-031 | RATE_LIMITED | 320s | c893a3d | 连续第 2 次，驱动标 blocked |
| T-028 | RATE_LIMITED | 702s | d80891c | 两个模型都限流（连续第 5 次） |

- 累计（`runs.log` 已记录 36 轮，本轮 DONE 行待驱动写回后变 37）：DONE 23 / RATE_LIMITED 11 / GATED 1 / FAIL 1；「两个模型都限流」连续计数行 5 次，Pro 兜底单日上限触顶（`FALLBACK_LIMIT`）5 次。
- 待 orchestrator 处理的事：有，两条。
  1. **T-028 上一轮被限流（14:33:59Z，702s）**，`status` 仍是 `todo`、未产出文档；它 gate=external（只产出文档、不发送），下一轮会被重新取到，无需动作。
  2. **本文件末尾「## 驱动告警」一节的 T-031 blocked 已过期**（orchestrator 14:25Z 已解锁回 `todo`，T-031 现在就是下一个 `todo`）；按 prompt「原样保留」的要求未改该节，仅在此说明。
- 本轮无新门禁申请（T-036 属机制维护类直推，已补 EXECUTED 行）。
- 下一步：队列下一个 `todo` = T-031（存量 `core/api/common.py` 过 ruff format）；其后 T-028（DingDong 澄清清单，gate=external）、T-032→T-035（展示面 A–D 实现）、T-024（常设巡检，gate=review）。

## 驱动告警
- 需 orchestrator：T-031 连续失败 2 次，已自动标 blocked（2026-09-17T14:22:17Z）。
