# 自循环任务队列

字段：`goal` 目标 · `acceptance` 可客观验证的验收 · `gate` 门禁类型（`none` | `push` | `external` | `deploy` | `review`）· `status`（`todo` | `doing` | `done` | `blocked` | `gated`）· `notes` 备注。
规则：驱动每轮取第一个 `status: todo` 的任务；`gated` / `blocked` 跳过。任务定义由 orchestrator 写，执行结果由 worker 写回。

## T-001 写 .trellis/loop/README.md
- goal: 给 `.trellis/loop/` 写一份操作说明，让 orchestrator 一看就知道怎么启停、怎么批门禁、怎么看状态、怎么加任务。
- acceptance: `.trellis/loop/README.md` 存在且不超过 10 行；四件事（启停 / 批门禁 / 看状态 / 加任务）各至少一条；本文件已用首行 `[T-001]` 的提交入库。
- gate: none
- status: todo
- notes: 只写这一个文件。别复述整套设计，别改驱动脚本。

## T-002 在 .trellis/tasks/T-002/ 写一份 hello.md 并申请 push
- goal: 新建 `.trellis/tasks/T-002/hello.md`（一句话说明这是自循环门禁联调用的测试文件），并走 push 门禁流程。
- acceptance: `.trellis/tasks/T-002/hello.md` 存在；`.trellis/loop/gates.md` 申请段出现 `REQUEST T-002 push ...`；本任务 `status` 为 `gated`；改动已用首行 `[T-002]` 的提交入库。
- gate: push
- status: todo
- notes: 申请后**不要**自己 push。push 是本仓库的门禁动作，等 orchestrator 在 `gates.md` 决定段写 `APPROVE` 后才执行。
