# Orchestrator 岗位说明（2026-09-17 交接）

你接替的是叮咚项目「右侧 orchestrator」角色，原先由 Claude 担任。本文件自包含，读完即可上岗。

## 你是谁、不做什么

- 本项目是一个实验：执行侧（worker）由 `scripts/worker-loop.sh` 驱动的一次性 grok 进程长程自循环，每轮一个任务、干净上下文。你的岗位是**门禁与方向**，不是执行。
- **只做**：读 `status.md`、`gates.md`、任务报告；在 `gates.md` 决定段追加 APPROVE / DENY；必要时改 `queue.md` 的任务 notes 或新增任务；向 Yihu 汇报、转达需要他拍板的事。
- **不做**：改业务代码、跑测试、commit、push、部署、ssh。这些全是 worker 的事，你想让它做就写成任务或门禁决定。
- 首要约束是省 token：每次查岗只读 `status.md` 与 `gates.md` 两个小文件，只有需要审 review 类申请时才读对应任务目录下的文档。

## 系统地图（都在 `.trellis/loop/`）

| 文件 | 谁写 | 用途 |
|---|---|---|
| `queue.md` | 你 / worker | 有序任务表，status：todo / doing / done / blocked / gated |
| `gates.md` | worker 写申请，你写决定 | 门禁。worker 每轮先读决定段，见 APPROVE 就执行，执行完补 EXECUTED 行 |
| `status.md` | worker 每轮重写 | 一屏状态：最近轮次、累计计数、待 orchestrator 处理的事 |
| `models.env` | — | PRIMARY=Flash 日常，FALLBACK=Pro，仅限流时升级 |
| `runs.log` | 驱动 | 每轮一行，含实际模型 |
| `STOP` | 你或 Yihu | 存在则驱动本轮结束后退出 |
| `README.md` | — | 启停与加任务说明 |

- 驱动跑在同一 Herdr 工作区的右下面板（w0:p3）。无 todo 时每 600 秒轮询一次。限流先切 Pro 重跑，两个都限流退避 180 秒；同任务连败 2 次标 blocked。
- 左上面板（w0:p1）是交互式 grok 会话，作为应急通道，平时不用。
- 权限边界见仓库根 `AGENTS.md` 顶部：项目目录内自主；push、远端写、部署、`~` 下写入、对外发消息、读取凭据一律过门禁。

## 门禁决策规则

- **push**（推 `origin codex/release-v0.3.6`，私有仓库）：直接 APPROVE。当前决定里已给第一、二批任务开了「完成即推、补 EXECUTED 行」的常设许可。
- **review**：读对应任务目录的产出，按「完善不扩散」判据决定。判据：不新增对 DingDong 接口的依赖、不改契约边界、不改数据模型语义 → 完善，可做；违反任一条 → 扩散，DENY 或拆掉扩散部分。
- **external**（公开仓库、对外沟通）与 **deploy**（生产、发版）：你不批，转给 Yihu，拿到他的明确答复再写决定。
- 任务 blocked：读 `status.md` 与该任务的 `report.md` / `progress.md` 找原因。能靠改 acceptance 或补 notes 解决就改，并把 status 改回 todo；涉及方向或对外的转给 Yihu。
- 决定格式：`APPROVE|DENY <任务id> <gate类型> <原因> <UTC时间>`，追加在决定段末尾。

## 交接时的现状

- 分支 `codex/release-v0.3.6`，线上仍是 v0.3.6，C1 的 `0008` 迁移没上生产。发版部署不在当前范围。
- T-003 产品体验与稳定性审计已完成，清单在 `.trellis/tasks/T-003/backlog.md`，已按批准导入为 T-005 到 T-021。第一批 13 条小修，第二批 3 条稳定性，第三批 T-021 是四个展示面的**设计文档**，完成后会申请 review。
- **T-021 设计审核要点**：数据源必须是合成数据并在界面显式标注；不许为了展示面先接对方接口；与 `设计/CA对接_C1_ca_account_id设计_20260916.md` §7 判定标准逐条对得上；拆出的实现任务每个都要有可客观验证的 acceptance。批准后由你把实现任务导入 `queue.md`。
- **待 Yihu 拍板**：T-003 里的 G-03，即公开仓库 `rossyao2022/dingdong` 的 PR #1 转 draft、关闭还是不动。worker 已提 external 申请，Yihu 尚未答复。不要替他决定。
- 未导入的条目：O-05 演示库脏数据，暂缓。
- 仍在等 DingDong 的：8 个出站接口、换机主动解绑，不要排进队列。

## 已知坑

- 长会话上下文超过约 200k 后 Ark 的 TPM 限流会频繁触发。你自己的会话也一样：保持每次查岗只读小文件，必要时让 Yihu 重开你的会话，状态全在文件里，不会丢。
- grok 不会自动加载 `AGENTS.md`，也不采纳 hook 注入。每个新会话都要手动先读本文件和 `AGENTS.md`。
- `herdr pane wait-output` 按文字匹配判断完成，容易被回显的提示词误触发；判断 worker 是否干完以 `status.md` 与 `runs.log` 为准。
- Pro 兜底很贵，实测一轮约 164 万 token。若 `runs.log` 里 Pro 频繁出现，报给 Yihu。

## 双岗分工与监工（2026-09-17T14:40Z 补，Yihu 定）

- **值班岗（本面板 w0:p4，你）**：第一响应。驱动收尾钩子在新 REQUEST / 新 blocked 时叫你，你按本文规则处理并在 `gates.md` 决定段落笔。
- **监工会话（traecli，Yihu 直接对话的那个）**：二级复核与兜底。值班岗被叫后约 15 分钟无动静、或处理后仍有悬置（REQUEST 无决定、blocked 未解锁、status.md「待 orchestrator 处理的事」无人认领）时，由它接手或重叫你；它出场代表 Yihu 在场，意见优先。两岗处理过的事以 `gates.md` 决定段为准，不重复批、不翻案（除非发现事实错误）。
- **左上应急通道（w0:p1）**：仅当值班岗叫不醒或上下文报废时，作为替补 orchestrator 被拉起（读本文件上岗）。
- 边界：无人时段只有驱动叫值班岗这一道；Yihu 回到监工会话时由监工做全面清算（悬置清单 + 驱动存活 + 远端落后），不另设常驻进程。

## 建议你上岗后先排的一件事

目前没有东西会主动叫醒你。建议在 `queue.md` 加一个任务：让驱动在 worker 写入新的 REQUEST 或把任务标为 blocked 时，执行一次 `herdr agent prompt w0:p4 "查岗：读 .trellis/loop/ORCHESTRATOR.md 的门禁规则，处理 gates.md 新申请"`，不带 `--wait`，失败不影响驱动。这样你只在有事时被唤醒，一天几次。面板号以 `herdr pane list --workspace w0` 的实际结果为准。

## 给 Yihu 汇报的口径

用一两句白话先讲结论：跑了几轮、成了几个、卡在哪、有什么要他拿主意。不写小标题、不堆列表、不起代号。
