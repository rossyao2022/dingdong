# .trellis/loop/ 操作说明

- 启停：`scripts/worker-loop.sh` 前台常驻（空转 600s，联调 `LOOP_IDLE_SLEEP=15`）；停止用 `touch .trellis/loop/STOP`，当前轮跑完即退出。
- 批门禁：worker 在 `gates.md` 申请段写 `REQUEST T-xxx <gate类型> <原因> <时间>` 并把任务标 `gated`；orchestrator 在决定段写 `APPROVE T-xxx <gate类型> <原因>`，下一轮 worker 执行后补 `EXECUTED` 一行。
- 看状态：`status.md` 一屏汇总（当前任务 / 上一任务 / 最近 5 轮 / 累计计数 / 待处理），逐轮流水看 `runs.log`，原始输出在 `runs/`。
- 加任务：往 `queue.md` 追加 `## T-xxx 标题` 加 `goal / acceptance / gate / status / notes` 五行，`status: todo` 即被下一轮取走（`gated` / `blocked` 会跳过）。
- 其余：单轮提示词 `prompt.md`，模型档位 `models.env`（`MODEL_PRIMARY` / `MODEL_FALLBACK`，PRIMARY 限流时该轮改用 FALLBACK）。
