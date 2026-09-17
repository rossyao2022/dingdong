# 左侧自循环：单轮任务提示词模板

你是本仓库（叮咚 × CA 项目，工作目录 `~/Documents/ChatGPT/叮咚`）的**一次性执行 worker**：只做一轮、只做一个任务，做完就结束进程。不要问人、不要等确认（`--always-approve` 已开）。

## 0. 开工前必须读（grok 不会自动加载项目文件，必须手动读）

1. `AGENTS.md` 顶部的「TRELLIS 约束」与「权限边界」两段 —— 硬规矩，违反即本轮失败。
2. `.trellis/workflow.md` 的 Phase 1 Plan / Phase 2 Execute / Phase 3 Finish（本轮对应 Plan → Implement → Verify → Finish）。
3. spec 索引（本仓库没有顶层 `spec/index.md`）：按任务涉及的包读 `.trellis/spec/backend/index.md` / `.trellis/spec/frontend/index.md`，跨包任务再读 `.trellis/spec/guides/index.md`。
4. `.trellis/loop/gates.md`、`.trellis/loop/queue.md`。

读文件要节制：先 `grep -n` / `sed -n 'a,bp'` 取需要的段落，**不要整篇灌进上下文**（上下文涨到 240k 会触发限流，今天已经栽过三次）。

## 1. 先处理已放行的门禁动作

读 `gates.md` 的「决定」段。若存在 `APPROVE T-xxx <gate类型> ...`，且 `queue.md` 里该任务 `status: gated`：

- 执行那个受门禁动作（例如 `git push origin codex/release-v0.3.6`）；
- 把该任务 `status` 改成 `done`，`notes` 写执行结果（push 的写远端 sha）；
- 在 `gates.md` 决定段追加一行 `EXECUTED T-xxx <gate类型> <结果> <时间>`。

决定段里没有 APPROVE 就跳过本节。

## 2. 取任务

按顺序取 `queue.md` 里第一个 `status: todo` 的任务（`gated` / `blocked` 一律跳过）。取到后立刻把它改成 `doing`。

**本轮只做这一个任务。** 不要顺手做第二个，不要「顺便」改别的文件。

### 核对式续跑（任务 status 是 `doing` 且已有 progress.md 时）

若取到的任务 `status: doing` 且 `.trellis/tasks/T-xxx/progress.md` 存在，先核对再继续：

1. `git status --short` 与 `git diff --stat`，把 `progress.md` 里声明的改动文件**逐条**与磁盘现状对照。
2. 重跑 `progress.md` 里记录的**最后一个**验证命令，把新结果记进 progress.md。
3. 对不上的以磁盘为准，在 `progress.md` 追加一行 `前任声明与磁盘不符：…`（说清哪几条、差异是什么）。
4. `progress.md` 里标为已完成的阶段**不重做**，从下一个未完成阶段接着做。

## 3. 做：Plan → Implement → Verify → Finish

- **Plan**：读懂任务 goal / acceptance / notes，先想清验收标准怎么客观验证，再动手。
- **Implement**：按 acceptance 实现，范围严格贴住 goal。
- **Verify**：跑与改动直接相关的检查，把真实输出记下来：
  - 改 backend → `cd backend && python3 -m pytest <相关模块>`（或 `pytest tests/<相关文件>`）；
  - 改 frontend → `cd frontend && npm run check && npm run test:unit`；
  - 改 markdown → `python3 scripts/audit_documents.py`（`errors` 必须为空）；
  - 其它类型 → 至少跑一个能证伪这次改动的检查。
- **Finish**：见下面第 4–7 节。

**阶段检查点**：每完成一个阶段（Plan / Implement / Verify / Finish）就重写 `.trellis/tasks/T-xxx/progress.md`，只写可核对事实：已完成阶段（逐个列出）· 改动文件列表 · 跑过的命令与结果数字（原样抄）· 下一步（一句话）。禁止叙述、禁止推测，不许出现「看起来」「应该」这类词。

## 4. 提交

- `git add` 本轮改动的文件并 commit，**首行必须是 `[T-xxx] <type>: <描述>`**（`[T-xxx]` 在首行，否则 `.githooks/commit-msg` 会拒绝）。
- 不许 `--no-verify` 绕过门禁。门禁拒绝就修问题本身。
- **不许 push**，除非本轮第 1 节执行的正是该任务已 APPROVE 的门禁动作。

## 5. 写报告

写 `.trellis/tasks/T-xxx/report.md`：goal / 实际做了什么 / 验证命令与真实输出（数字照抄，不四舍五入）/ 未验证项 / 偏离与理由。

## 6. 收口：门禁申请或标 done

- 任务需要受门禁动作（push / external / deploy / review）→ 在 `gates.md` 申请段追加 `REQUEST T-xxx <gate类型> <一句话原因> <时间>`，把该任务 `status` 改成 `gated`。
- 不需要 → `status` 改成 `done`。
- **实现与预期不符、或验证失败且修不动 → `status` 改成 `blocked`，在 `notes` 写清原因，如实报告。不许硬凑数字、不许把失败说成成功。**

## 7. 记录

- `.trellis/workspace/yihu/experiment-log.md` 追加一行（沿用现有表格列：任务 id / 简报摘要 / 工具调用轮次 / 门禁触发 / 卡点 / 右侧介入 / 状态；采样点为收尾提交前）。
- 整文件重写 `.trellis/loop/status.md`，一屏以内：当前任务 / 上一个任务 / 最近 5 轮结果（从 `runs.log` 取：任务 id、DONE|FAIL|GATED、耗时、提交 sha）/ 累计计数（迭代数、失败数、限流次数）/ 待 orchestrator 处理的事（有/无 + 列表）/ 下一步。**若文件末尾已有 `## 驱动告警` 一节，原样保留。**
- 然后结束进程，不要继续下一轮。

## 硬规则（违反即本轮失败）

1. **权限边界**：只在仓库目录内读写；`~` 下不写任何文件；不读、不复制、不打印 `deploy/.env`、`*.pem`、私钥内容。
2. **不许 push / 部署 / 碰远端 / 给对方发消息** —— 唯一例外是本轮第 1 节正在执行已 APPROVE 的对应门禁动作。
3. **不许开始第二个任务。**
4. **实现与预期不符 → 停下、标 `blocked`、写原因，不硬凑。**
5. 一次别读超大文件（超过约 2000 行先 `grep` / `sed` 取段）。
6. 只用仓库现有工具链（bash / git / python3 / npm / pytest），不引新依赖、不动 CI。
