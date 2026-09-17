# T-004 报告：验证模型切换

## goal

R0e 双模型机制自测：本任务第一轮 PRIMARY 会被假 grok 包装脚本伪造限流，驱动应立即用 FALLBACK（Pro）重跑同一任务；worker 只需确认自己在 FALLBACK 重跑中正常完成，不改任何代码。

## 实际做了什么

- 确认本轮是 FALLBACK 重跑，依据三条可核对事实：
  1. 驱动环境 `LOOP_TASK_ID=T-004`；
  2. `.trellis/loop/runs/20260917T055213Z-T-004-primary.json` 与同名 `.err` 内容均为 `{"error":{"message":"TooManyRequests: rate limit exceeded"}}`，即 PRIMARY 已触发伪造限流；
  3. `.trellis/loop/runs.log` 在本次运行开始前已有 `ROUND T-004 RATE_LIMITED 5s d22eaf5 deepseek-v4-1-flash-260910 rc=42` 一行；按 `scripts/worker-loop.sh` 的 `run_round` 逻辑，RATE_LIMITED 后立即用 `MODEL_FALLBACK=deepseek-v4-pro` 重跑同一任务。
- 本轮由 FALLBACK 重跑完成。
- 未改任何代码；仅写 `.trellis/` 下的任务进度/报告与 loop 收尾文件。

## 验证命令与真实输出

- `echo $LOOP_TASK_ID` → `T-004`
- `cat .trellis/loop/runs/20260917T055213Z-T-004-primary.json` → `{"error":{"message":"TooManyRequests: rate limit exceeded"}}`
- `grep -c '本轮由 FALLBACK 重跑完成' .trellis/tasks/T-004/report.md` → `2`（该句在正文出现 1 次、在验证命令描述中出现 1 次）
- `awk '/^## T-004/{f=1} /^## / && !/^## T-004/{f=0} f' .trellis/loop/queue.md | grep -E '^- (status|notes):'` → 输出两行：`- status: done` / `- notes: 自测任务，验证完由 R0d 会话删除假脚本、核对 runs.log。`

## 未验证项

- `.trellis/loop/runs.log` 里的 `FALLBACK DONE` 行由驱动在 worker 退出后写回，本任务内不核对（任务 notes 明确该核对在 R0d 会话执行）。
- 假 grok 包装脚本的删除由 R0d 会话执行，不在本任务内。

## 偏离与理由

无。严格按 goal 范围：确认 FALLBACK 身份 + 写报告 + 标 `done` + 提交，未改任何代码。
