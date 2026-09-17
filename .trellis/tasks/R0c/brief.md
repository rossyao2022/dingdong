# 任务 R0c 简报（原文存档）

> 由右侧 orchestrator 下发，左侧执行 worker 原样保存，供复盘用。
> 保存时间：2026-09-17（Asia/Shanghai）

---

# 任务 R0c：接手上一会话未完成的 R0b 收尾（右侧 orchestrator 下发）

你是新开的左侧执行会话，工作目录应为项目根。上一会话因 TPM 限流三次中断，R0b 改动已在工作区但**未 commit、未 push**。上一会话的报告在 .trellis/tasks/R0b/report.md，实验记录在 .trellis/workspace/yihu/experiment-log.md。权限边界见 AGENTS.md 顶部（项目内自主；push、远端、~ 下写入、凭据读取一律 NEED-GATE）。

## 先自报（一行）
pwd 是否为项目根；本会话启动时是否自动读到了 AGENTS.md（首条回复是否带 TRELLIS-OK）；是否能看到 .grok/hooks 触发痕迹。

## report.md §9 四个待拍板项，我的决定
1. 文档/文档校验结果.json 与 设计/API/契约检查结果.json：按仓库既有惯例处理；惯例不明就一起提交，保持与代码同步。
2. grok hook「会执行但注入不被采纳」：接受现状。生效机制以 AGENTS.md 自动加载为准，.grok/hooks 保留作留痕与兼容，在 .grok/README 里写明这一点。
3. 项目内 .cursor/：本项目不用 Cursor，整个目录删掉，不再产生解析警告。
4. ~/.cursor/hooks.json：在 ~ 下，不碰，report 里提一句即可。

## 步骤
1. `git status --short` 报告工作区状态；确认 .githooks/commit-msg 的正则已放行 `[R0b]`/`[R0c]` 这类带字母后缀的轮次号。
2. 按上面 4 条决定处理。
3. 复跑 `python3 scripts/audit_documents.py`（预期 errors 为空，markdown 篮数回到项目文档本身，报数字）。
4. commit（`[R0c]` 开头，一条即可，把 R0b 遗留改动一并带上）。**push 放行**：`git push origin codex/release-v0.3.6`，报远端 sha。
5. experiment-log 补一行 R0c，卡点栏写清上一会话「TPM 限流 ×3、上下文 248k」这个结构性问题，以及「commit-msg 正则只认数字轮次号」这个门禁自身缺陷（已修）。
6. 简报存 .trellis/tasks/R0c/brief.md，报告 .trellis/tasks/R0c/report.md。

## 收尾格式（pane 里最后只留这几行）
状态: DONE / BLOCKED / NEED-GATE
pwd 项目根: ✓/✗ ；AGENTS.md 自动加载: ✓/✗ ；hooks 痕迹: ✓/✗
审计: markdown N / errors []
commit: <sha> ；push: <远端 sha>
待放行动作: 无 / ...
记录落点: ...
最后一行只写：R0C-FINISHED
