# 任务 R0 简报（原文存档）

> 由右侧 orchestrator 下发，左侧执行 worker 原样保存，供复盘用。
> 保存时间：2026-09-17（Asia/Shanghai）

---

# 任务 R0：给本项目落地 Trellis 约束机制 + 给 grok 手动接线（由右侧 orchestrator 下发）

你是叮咚 × CA 项目的执行 worker（左侧）。我是右侧 orchestrator，只下简报、在门禁点放行、验收收尾。这轮是实验：验证你这种 loop 能独立执行到什么程度，所以**过程要自己记录**。

## 权限边界（贯穿所有任务，违反即实验失败）
- 项目目录 /Users/yihu/Documents/ChatGPT/叮咚 内：读写、跑测试、本地 commit 全部自主，做完报告。
- 任何触达项目目录之外的副作用 → 立刻停下，在收尾里报 NEED-GATE，等我放行：git push / 改 PR 状态 / merge；ssh 到任何远端做写操作或部署；~ 下任何写入（含 ~/.grok、~/.claude、全局 npm -g）；给对方发消息；读取、复制或打印 deploy/.env、*.pem、私钥内容。
- 实现与预期不符时不许硬凑，停下如实报告。

## 步骤
0. 先读 PROJECT_MEMORY.md 前 60 行和 AGENTS.md，知道仓库规矩（分支名不许动、凭据不入库、文档路径写相对路径）。
1. 自报：你当前的权限模式（是否每次工具调用要人确认 / 自动批准）；grok CLI 有没有 hooks 配置机制、会不会自动读 AGENTS.md（查自己文档或 --help，查不到就说查不到，不许猜）。
2. 备份 AGENTS.md、README.md、.gitignore 到 .trellis-backup/（临时目录，最后删掉）。在 ~ 下 touch 一个时间标记不允许——改为记录 `date` 时间戳即可。
3. 安装 Trellis，只允许项目内：`npx @mindfoldhq/trellis@latest init -u yihu`（在项目根执行，不用 npm -g）。init 后：`git status --short` 全量列出新增/修改文件；对被修改的既有文件逐个 diff，既有内容一律保留合并，不许覆盖。
4. 核实 ~ 是否干净：`find ~ -newermt "<步骤2时间戳>" -not -path "$HOME/.npm/*" -not -path "$HOME/Library/Caches/*" -maxdepth 3 2>/dev/null`，结果如实列出（npx 缓存除外）。
5. 处置 .claude/：保留 .claude/commands/；若 .claude/settings.json 含自动 hooks，把 hooks 段去掉（右侧会话不需要 spec 注入）。报告你去掉了什么。
6. 接线：
   a. AGENTS.md 顶部加一段：任何 agent 开工先读 .trellis/workflow.md，按 Plan → Implement → Verify → Finish 四阶段走；收尾执行 .claude/commands/ 里 finish-work 对应文件的内容；本文件权限边界同上（把上面「权限边界」抄进去）。
   b. 项目内 git hook：新建 .githooks/pre-commit，`git config core.hooksPath .githooks`（只写本仓库 .git/config）。检查项：① commit message 含 `[R<n>]` 或 `[T-<id>]` 形式的任务 id；② 暂存文件名不匹配 `\.env($|\.)`（.env.example 例外）、`\.pem$`、`\.key$`、`id_rsa`、`id_ed25519`；③ 若暂存里有 .md 文件，跑 `python3 scripts/audit_documents.py` 且 errors 必须为空。Trellis 自带的 detect_changes 类脚本能复用就复用，说明用没用。
   c. 在 AGENTS.md 里放哨兵：「新会话首条回复必须包含 TRELLIS-OK」。
7. 实验记录：在 .trellis/workspace/yihu/ 下写 journal（Trellis 自己的格式）一条 + 新建 experiment-log.md 汇总表。每条字段：任务 id、简报摘要、工具调用/轮次数、门禁触发次数与原因、卡点、右侧介入次数、状态。禁写 IP、密钥、/Users/ 绝对路径。
8. 门禁自测：做一次不带任务 id 的空 commit（`git commit --allow-empty -m "test"`），预期被 pre-commit 拒绝，记录结果；再做一次合规提交。
9. 把这份简报原文存到 .trellis/tasks/R0/brief.md，把你的完整报告写到 .trellis/tasks/R0/report.md。
10. 基线复跑（数字必须真实来自本次运行）：`cd backend && uv run pytest -q`（uv 可能在 ~/.local/bin/uv）；`cd frontend && npm run check && npm test`；`python3 scripts/audit_documents.py`。预期 266 passed / check 通过 / 16 passed / errors 为空。
11. 收尾提交：包含 Trellis 文件、AGENTS.md、.githooks、.trellis 记录，以及现有未提交的 .gitignore 改动，commit message 以 `[R0]` 开头。**不 push**。删掉 .trellis-backup/。

## 收尾格式（pane 里最后只留这 ≤15 行，详细内容全在 report.md）
状态: DONE / BLOCKED / NEED-GATE
权限模式: ...
grok 读 AGENTS.md: 是/否/查不到 ；grok hooks: 有/无/查不到
Trellis 改了哪些既有文件: ...
~ 下新增: 无 / 列表
.claude hooks 处置: ...
pre-commit 自测: 拒绝✓/✗ , 合规通过✓/✗
基线: pytest N passed / check ✓ / npm test N passed / audit errors []
commit: <sha 短码>
待放行动作: 无 / ...
记录落点: .trellis/tasks/R0/report.md, .trellis/workspace/yihu/...
