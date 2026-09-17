# 自循环任务队列

字段：`goal` 目标 · `acceptance` 可客观验证的验收 · `gate` 门禁类型（`none` | `push` | `external` | `deploy` | `review`）· `status`（`todo` | `doing` | `done` | `blocked` | `gated`）· `notes` 备注。
规则：驱动每轮取第一个 `status: todo` 的任务；`gated` / `blocked` 跳过。任务定义由 orchestrator 写，执行结果由 worker 写回。

## T-001 写 .trellis/loop/README.md
- goal: 给 `.trellis/loop/` 写一份操作说明，让 orchestrator 一看就知道怎么启停、怎么批门禁、怎么看状态、怎么加任务。
- acceptance: `.trellis/loop/README.md` 存在且不超过 10 行；四件事（启停 / 批门禁 / 看状态 / 加任务）各至少一条；本文件已用首行 `[T-001]` 的提交入库。
- gate: none
- status: done
- notes: 只写这一个文件。别复述整套设计，别改驱动脚本。已入库 commit 6e89463（7 行，四要素齐）。

## T-002 在 .trellis/tasks/T-002/ 写一份 hello.md 并申请 push
- goal: 新建 `.trellis/tasks/T-002/hello.md`（一句话说明这是自循环门禁联调用的测试文件），并走 push 门禁流程。
- acceptance: `.trellis/tasks/T-002/hello.md` 存在；`.trellis/loop/gates.md` 申请段出现 `REQUEST T-002 push ...`；本任务 `status` 为 `gated`；改动已用首行 `[T-002]` 的提交入库。
- gate: push
- status: todo
- notes: 申请后**不要**自己 push。push 是本仓库的门禁动作，等 orchestrator 在 `gates.md` 决定段写 `APPROVE` 后才执行。

## T-004 验证模型切换
- goal: R0e 机制自测。本任务第一轮 PRIMARY 调用会被假 grok 包装脚本伪造限流，驱动应当立即用 FALLBACK（Pro）重跑同一任务；worker 只需确认自己在 FALLBACK 重跑中正常完成、不改任何代码。
- acceptance: `.trellis/tasks/T-004/report.md` 存在并写一句「本轮由 FALLBACK 重跑完成」；本任务 `status` 为 `done`；改动已用首行 `[T-004]` 的提交入库。（runs.log 里 PRIMARY RATE_LIMITED / FALLBACK DONE 两行记录由 R0d 会话在驱动跑完后核对，不在本任务内。）
- gate: none
- status: todo
- notes: 自测任务，验证完由 R0d 会话删除假脚本、核对 runs.log。

## T-003 产品体验与稳定性审计
- goal: 以家长用户第一视角走一遍家长端（`http://127.0.0.1:4173/`，任意手机号 + 验证码 `00000`）与运营后台（`http://127.0.0.1:8017/ops/`，`admin` / `dingdong-admin`），结合 `PROJECT_MEMORY.md`、`需求/`、`设计/`，产出 `.trellis/tasks/T-003/backlog.md`。
- acceptance: backlog.md 每项含「用户在哪一步卡/困惑/不信任 / 现状 / 建议改法 / 完善还是扩散 / 工作量档位」；「完善/扩散」判据写成：不新增对对方接口的依赖、不改契约边界、不改数据模型语义；稳定性问题单列一节（错误态、空数据态、网络慢/断、celery 失败可见性、e2e 因本地数据漂移失败的 4 项）；只产出文档、不改任何代码；本任务 `status` 为 `gated`，`gates.md` 有 `REQUEST T-003 review ...`。
- gate: review
- status: todo
- notes: 已知候选先放进去——人设/成长报告/健康度四态/复测 CTA 四个展示面（mock 数据源，判定标准见 `设计/CA对接_C1_ca_account_id设计_20260916.md` §7）、授权血缘声明（`frontend/README.md` + `参考代码/来源说明.md`，来源 commit `d754a5bf`）、PR #1 转 draft。明确排除：`PROJECT_MEMORY.md` 里列的 8 个出站接口、主动解绑、发版部署。走产品体验需真实浏览器，遵守仓库浏览器验收纪律。

