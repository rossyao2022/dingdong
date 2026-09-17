# 任务 R0b 简报（原文存档）

> 由右侧 orchestrator 下发，左侧执行 worker 原样保存，供复盘用。
> 保存时间：2026-09-17（Asia/Shanghai）

---

## 第一段（主简报）

# 任务 R0b：R0 验收结论 + 补丁轮（右侧 orchestrator 下发）

R0 验收：DONE 接受。两处偏离（任务 id 检查挪到 commit-msg；npm test 实为 playwright e2e）判断正确，停下报告而不硬凑正是我要的纪律，记进 experiment-log 作为正面样本。

## 门禁放行
- **push 放行**：`git push origin codex/release-v0.3.6`（仅这个分支、仅 origin，push 完把远端 sha 报我）。以后每轮收尾都要单独申请 push，这次放行不延续。

## report.md §14 五个待拍板项，我的决定
1. merge commit 豁免任务 id 检查：**是**。commit-msg hook 对以 `Merge ` 开头的消息放过，其余检查不放。
2. 那 4 个 e2e 失败：**不单开轮**，作为「本地开发库数据漂移导致 e2e 不稳」这一条纳入下一轮 R1 稳定性审计清单，R0b 不碰。
3. 审计跳过 .trellis/.claude/.cursor：**是**。`scripts/audit_documents.py` 加排除，让 markdown 篇数回到项目文档本身（预期回到 79 左右）。回滚你之前对 Trellis 模板占位的两处最小改动（既然不扫了就不该动模板）。
4. init 补 `--grok`：**是**。先查 Trellis 的 init --help 确认该 flag 真存在、会生成什么；存在就补跑，结果 diff 报我；不存在就如实说。
5. Trellis spec 正式立项：**是**，用它自带的 spec-bootstrap 流程（`.agents/skills/` 或 `.claude/skills/` 里 trellis-spec-bootstrap 的说明），基于本仓库真实代码生成 backend / frontend 两个包的 spec，不许占位文本。这是给后续 worker 的护栏，写实不写虚。

## 新增接线（利用你的发现：grok 会读项目 .grok/hooks/ 与 .claude/settings.json 的 hooks）
6. 把 R0 从 .claude/settings.json 去掉的 Trellis hooks，改挂到**项目级** `.grok/hooks/`（不碰 ~/.grok）。目的：左侧 grok 吃到自动门禁，右侧 Claude 会话不受影响。挂好后用一次真实工具调用验证 hook 确实触发，把触发证据（hook 输出行）贴进 report。
7. 你自报「会话工作目录不在项目里」。这条不由你修（需要重启会话），只在 report 里写清：当前 cwd 是什么、这对 AGENTS.md 自动加载和权限边界判定有什么影响。

## 权限边界与纪律同 R0。收尾格式同 R0，另加一行：
push: <远端 sha> / 未 push（原因）
--grok: 存在✓已补 / 不存在
.grok/hooks 触发证据: ✓/✗
spec 生成: backend N 篇 / frontend N 篇
审计: markdown N / errors []

简报存 .trellis/tasks/R0b/brief.md，报告写 .trellis/tasks/R0b/report.md，commit 以 `[R0b]` 开头，本轮 push 只包含 R0 三条提交之外的内容也一并推（即 push 放行覆盖 R0 + R0b 全部本地提交）。

---

## 第二段（续跑指令）

继续 R0b：上一回合因 TPM 限流中断。从断点接着做（验证 .grok/hooks 探针是否触发、完成收尾提交、如需 push 则 push），然后按 R0b 收尾格式输出报告。把「TPM 限流中断一次」如实记进 experiment-log 的卡点栏。
