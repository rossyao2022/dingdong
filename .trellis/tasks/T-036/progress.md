# T-036 progress

## Plan（已完成）

- 任务来源：queue.md 第一个 `status: todo` = T-036；开工即改 `doing`。gates.md 决定段无待执行的 APPROVE（每条 APPROVE 均已有 EXECUTED 行）。
- 验收口径：`wc -l` queue.md ≤ 120 行、gates.md ≤ 60 行；`## T-xxx` 标题与 `- status:` 行仍满足驱动正则；归档含被移除的 EXECUTED 行原文；抽查 3 处被压缩 done notes 可在 report 或归档中找到；audit errors 为空。
- 驱动依赖核对（`scripts/worker-loop.sh`）：`next_task` 用 `^##\s+(T-\d+)\s+(.*)$`（标题行必须带标题文本）与 `^-\s*status\s*[:：]\s*(\S+)`（只取首个 token）；决定段按 `## 决定` 切分、`^APPROVE\s+(T-\d+)` 取已批任务；`loop_gate_snapshot` 按 `## 申请` / `## 决定` 切分、取申请段 `^REQUEST` 行指纹。
- 行数预算：done 任务 28 条 × 2 行（标题 + 一行指针）= 56 行；todo 任务 notes 按任务要求逐字保留（43 行），故 done 任务的 goal / acceptance / notes 只能整体压成一行指针。

## Implement（已完成）

- 改动文件：`.trellis/loop/gates.md`、`.trellis/loop/queue.md`，新增 `.trellis/loop/gates-archive-20260917.md`、`.trellis/loop/queue-archive-20260917.md`；瘦身脚本 `.trellis/tasks/T-036/slim_ledgers.py`。
- 未改：`scripts/worker-loop.sh`、`.trellis/loop/prompt.md`、`.trellis/loop/status.md`、`.trellis/loop/runs.log`。
- 实测行数/字节：gates.md 95→34 行、22056→5098 字节；queue.md 257→119 行、65969→16508 字节。

## Verify（已完成）

- `python3 .trellis/tasks/T-036/verify.py` → 23 PASS / 0 FAIL，原文 `verify-output.txt`（含直接跑驱动脚本里真实 `next_task` / `classify` / `loop_gate_snapshot` 解析块的结果）。
- `python3 scripts/audit_documents.py` → `{"markdown_files": 80, "local_links_checked": 497, "archived_files_checked": 85, "operations": 55, "schemas": 65, "errors": []}`。

## Finish（已完成）

- report.md 已写；commit `2dff105`（首行 `[T-036] chore(loop): loop 账本瘦身（gates 决定段归档 + queue done 任务压一行指针）`）；`git push origin codex/release-v0.3.6` → `d80891c..2dff105`，远端 sha `2dff1056288e78045e7f458154a4dc39c17cfa9f`；`gates.md` 补 EXECUTED 行。
- 收尾记录：`status.md` 整文件重写（`## 驱动告警` 一节原样保留）、`.trellis/workspace/yihu/experiment-log.md` 追加 T-036 一行（工具调用计数 ≈53 / ≈44，采样于收尾提交前）。
- 无新门禁申请（机制维护类直推）。
