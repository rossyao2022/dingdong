# 项目级 grok hooks：Trellis 注入

这里的 `trellis-hooks.json` 把 Trellis 的三条注入 hook 挂到 **grok 侧**，用的是项目级 `.grok/hooks/`：

| 事件 | matcher | 脚本 | 作用 |
| --- | --- | --- | --- |
| `SessionStart` | 无（全部） | `.claude/hooks/session-start.py` | 会话开始注入 Trellis 工作流/任务状态 |
| `UserPromptSubmit` | 无（全部） | `.claude/hooks/inject-workflow-state.py` | 每轮注入当前任务/阶段面包屑 |
| `PreToolUse` | `Task\|Agent` | `.claude/hooks/inject-subagent-context.py` | 派子 agent 前注入任务上下文 |

几点说明：

- 脚本本体仍在 `.claude/hooks/`，**单一来源**，由 `trellis update` 维护；这里只负责在新宿主上注册，不复制文件。
- **命令必须是「不带 `${...}` 的裸相对命令」**。grok 的 hook runner 会对 `command` 字符串做一次变量展开，`${root}` 这类写法会被当成**必需环境变量**，报 `hook not executed: required env var(s) not set` 而根本不执行（fail-open，静默）。实测 `python3 .claude/hooks/session-start.py` 这种写法可用；runner 的工作目录就是仓库根。
- **`SessionStart` 的 matcher 不要写 `startup|resume`**：实测（无头 `-p` 会话）该 matcher 匹配不上，matcher 不匹配时分组会被静默跳过。这里留空匹配全部。
- 项目级 hook 需要 folder trust（本仓库已 trust），且只在**工作目录落在本仓库**的 grok 会话里生效；在别的目录开的会话读不到这里。
- 改动后在 TUI 里按 `Ctrl+L` 打开 Hooks 总览、按 `r` 可从磁盘重载；用 `grok inspect`（在本仓库目录下执行）可以看出 hook 是否被发现。
- 只影响 grok 会话；Claude 侧不再注册这些 hook（`.claude/settings.json` 的 `hooks` 段已在 R0 移除），所以右侧 Claude 会话不会被注入。
- 验证方式（R0b 用过）：在仓库目录跑一次无头会话 `~/.grok/bin/grok -p "..." --cwd <本仓库> --debug --debug-file <日志>`，然后在日志里 grep `hook_name=project/trellis-hooks` 看 `hook completed` / `hook failed`。

## 现状与取舍（R0c 决定，2026-09-17）

**让模型真读到 Trellis 约束的机制是 `AGENTS.md` 自动加载，不是这里的 hook 注入。** 会话的工作目录落在本仓库时，grok 自动加载仓库根的 `AGENTS.md`（含 R0 写的 TRELLIS 约束段），这是当前唯一被证实的通道。

本目录的注册**保留，作为留痕与未来兼容**，不承担「把约束送进模型上下文」的职责。依据（R0b 实测）：

- `UserPromptSubmit` 属允许型 hook，grok 侧明确丢弃其 stdout，每轮面包屑只执行、不进上下文。
- `SessionStart` 脚本确实执行（`hook completed`，stdout 16KB），但该文本在嵌套会话的 `chat_history.jsonl` / `prompt_context.json` / `system_prompt.txt` 里零命中，即**执行成功 ≠ 注入被采纳**。

将来若 grok 支持允许型 hook 的 `additionalContext`，再回来把这两条恢复成有效注入。注意本目录只在 cwd 落在本仓库的会话里被发现；cwd 在别处的会话既不会加载这些 hook，也不会自动加载 `AGENTS.md`。