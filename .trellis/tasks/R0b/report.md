# 任务 R0b 报告：验收结论落地 + 补丁轮

执行者：左侧执行 worker（grok CLI）。执行时间：2026-09-17 11:1x–12:4x（Asia/Shanghai）。
简报原文：同目录 `brief.md`。过程数据：`.trellis/workspace/yihu/experiment-log.md`。

---

## 0. 结论

七件事全部落地：push 已放行执行；门禁①豁免 merge；审计跳过工具脚手架并把模板改动回滚干净；`init --grok` 补跑成功；backend / frontend 两份 spec 写成真内容；Trellis hooks 已改挂项目级 `.grok/hooks/`，**并实测跑通**（`hook completed`）。

**两个新发现值得你知道**：

1. **grok 的 hook runner 会对 `command` 做变量展开** —— 命令里出现 `${root}` 这类写法会被当成**必需环境变量**，hook 直接不执行（fail-open，只在 debug 日志里留一行 `hook not executed: required env var(s) not set`）。我第一版就是这么写的，等于挂了个永远不跑的 hook；改裸相对命令后才真正执行。
2. **hook 跑通 ≠ 注入内容被采纳**：脚本执行成功了，但 SessionStart 注入的 16KB 文本在嵌套会话的上下文里**找不到**（chat_history / prompt_context / system_prompt 全零命中），UserPromptSubmit 那条更是被 grok 官方文档明确写死「允许型 hook 的 stdout 会被丢弃」。所以「左侧 grok 吃到自动门禁」目前只到「hook 会执行」，没到「模型真的读到了 Trellis 上下文」。**未验证项在 §6 逐条列清。**

## 1. 权限边界与放行（本轮的对外动作）

| 动作 | 状态 |
| --- | --- |
| `git push origin codex/release-v0.3.6` | 已执行（R0 三条提交），远端 sha `6b03eda593df5deef1a6895cb196d46ebb91be49` |
| R0b 的收尾提交 push | 已执行（见 §8 的 sha） |
| 其它远端写操作 / 部署 / 改 PR | 无 |
| `~` 下写入 | 无主动写入（只有 npx 缓存与运行中 harness 的日志，口径同 R0） |
| `deploy/.env`、`*.pem`、私钥 | 未读、未复制、未打印 |

## 2. 五项决定的落地

**① merge commit 豁免任务 id：已做。** `.githooks/commit-msg` 增加：首行以 `Merge ` 开头时直接放行，**只豁免任务 id 这一项**；凭据文件与文档审计两项仍在 `pre-commit` 里照常执行（本就在另一个 hook，不受影响）。

**② 那 4 个 e2e 失败：未碰。** 按你的决定不单开轮，R0b 没有运行 playwright、没有清理本地库。已作为「本地开发库数据漂移导致 e2e 不稳」记入下一轮 R1 稳定性审计清单（本条我在 R0b 里只登记、未执行）。

**③ 审计跳过脚手架 + 回滚模板改动：已做。**

- `scripts/audit_documents.py` 的 `SKIP` 增加 `.trellis`、`.claude`、`.cursor`、`.grok`（第四项是补跑 `--grok` 后必须加的，否则新生成的 `.grok/**/*.md` 会重新把审计面撑大）。
- 回滚了两处模板占位改动（`.claude/agents/trellis-research.md`、`.cursor/agents/trellis-research.md`）。**回滚是逐字节干净的**：两个文件的 sha256 与 `.trellis/.template-hashes.json` 里记录的模板哈希完全一致。
- 审计结果：**markdown 80 篇 / errors []**。比你说的「79 左右」多 1 篇，多出来的是 `.workbuddy-ai/memory/2026-09-11.md`（项目自己的备忘目录，本就在扫描范围内，不是脚手架）。

**④ `init --grok`：flag 存在，已补跑。**

- `trellis init --help` 确认有 `--grok`（说明是 "Include Grok Build skills and agents"）。
- 补跑 `npx @mindfoldhq/trellis@latest init -u yihu -y --grok`，输出 `📝 Configuring Grok Build...`、`📋 Tracking 203 template files for updates`（此前 136）。
- 新增 **49 个文件**：`.grok/agents/`（3，implement/check/research）、`.grok/commands/`（3，比 Claude/Cursor 多一个 `trellis-start.md`）、`.grok/skills/`（43）。
- **既有文件零改动**：`.trellis/config.yaml`、`AGENTS.md`、`.claude/settings.json` 补跑前后 md5 完全一致（`session_auto_commit: false` 等我的本地改动都在）。唯一被更新的是 `.trellis/.template-hashes.json`（模板清单，属正常刷新）。

**⑤ spec 正式立项：已做，两包共 17 篇。**

- 走的 `.claude/skills/trellis-spec-bootstrap/SKILL.md` 流程（含 `references/spec-writing.md` 的写法要求与「Done Criteria」）。
- **backend 9 篇**：`index` / `directory-structure` / `api-conventions` / `error-handling` / `models-and-migrations` / `services-and-idempotency` / `external-integrations` / `testing` / `quality-guidelines`。删掉模板的 `database-guidelines.md`（改名重写为 models-and-migrations）与 `logging-guidelines.md`（**本仓库没有独立日志规范，直接删，不为凑数编规则**）。
- **frontend 8 篇**：`index` / `directory-structure` / `state-and-rendering` / `api-conventions` / `ui-conventions` / `styling-and-responsive` / `quality-guidelines` / `testing-and-acceptance`。删掉 4 个不适用的模板：`hook-guidelines.md`（React Hooks，本仓库原生 JS）、`type-safety.md`（TypeScript，本仓库无类型系统）、`component-guidelines.md`（无组件文件，有效内容并入 ui-conventions）、`state-management.md`（改名 state-and-rendering）。
- 自检：整棵 `.trellis/spec/` 里 `To be filled` / `TODO: fill` / `placeholder` / `待填` **零命中**；两包 `index.md` 的链接集合与目录实际文件**逐一对齐**。
- **我自己抽查了 6 条断言，全部属实**（不采信子代理自述）：`@endpoint` 装饰器在 `backend/dingdong_ca/core/api/common.py` 且被各 api 文件使用；`backend/tests/test_boundaries.py` 里 `assert connection.vendor == "postgresql"`；`backend/config/settings/base.py:98` 的 `APPEND_SLASH = False`；`frontend/package.json` 的 `check` 只覆盖 4 个文件；`frontend/app.js` 的 `viewEpoch` / `tick !== viewEpoch` 竞态验票；`frontend/server.cjs` 的 `files` 白名单。
- 语言选择：**写中文**（本仓库所有文档都是中文），与 Trellis 模板默认的英文不同——按仓库现状来，特此报备。

## 3. 项目级 `.grok/hooks/` 接线（第 6 项）

新增两个文件：`.grok/hooks/trellis-hooks.json`（三条 hook 注册）、`.grok/hooks/README.md`（为什么这么写、怎么验证）。

| 事件 | matcher | 命令 |
| --- | --- | --- |
| `SessionStart` | 无 | `python3 .claude/hooks/session-start.py` |
| `UserPromptSubmit` | 无 | `python3 .claude/hooks/inject-workflow-state.py` |
| `PreToolUse` | `Task\|Agent` | `python3 .claude/hooks/inject-subagent-context.py` |

脚本本体仍只在 `.claude/hooks/`（单一来源，`trellis update` 维护），这里只做注册，不复制文件。**没有碰 `~/.grok`。**

## 4. 未验证项（拿不到就说拿不到）

| 项 | 结论 |
| --- | --- |
| `PreToolUse`（`Task\|Agent`）在真实派子代理时是否触发 | **未验证**。没有在嵌套会话里真派子代理去验（收尾令已停新实验）。已做的是：手工喂 grok 形状的 `PreToolUse` 载荷给 `inject-subagent-context.py`，退出码 0、无输出（不注入、不拦），说明脚本本身不会挂，但**注册是否被选中没实测**。 |
| SessionStart 注入的 16KB 文本是否真进了模型上下文 | **未验证 / 大概率否**。嵌套会话的 `chat_history.jsonl`、`prompt_context.json`、`system_prompt.txt` 里对 `Trellis compact SessionStart context` 全零命中。 |
| UserPromptSubmit 的面包屑是否生效 | **否（有文档依据）**。grok 官方文档明写「允许型 hook 的 stdout 会被丢弃（no additionalContext）」，所以那条每轮面包屑在 grok 侧等于只执行、不生效。 |
| 右侧 Claude 会话是否受影响 | **无影响**（设计如此）：`.claude/settings.json` 里没有 hooks 段，项目级 `.grok/hooks/` 只被 grok 读。 |

## 5. `.grok/hooks` 触发证据（第 6 项要的「hook 输出行」）

**发现层（`grok inspect`，在本仓库目录执行）** —— 三条 hook 被识别为 project 级：

```
  Hooks (17)
  └ command matcher=startup|resume  project     ← SessionStart（当时还带 matcher）
  └ command                         project     ← UserPromptSubmit
  └ command matcher=Task|Agent      project     ← PreToolUse
```

**执行层（在仓库目录跑一次无头会话 `grok -p ... --cwd <本仓库> --debug --debug-file <日志>`）**：

第一版（命令里用了 `${root}`）—— 被 runner 拒跑，这是根因证据：

```
WARN hook_name=project/trellis-hooks:user_prompt_submit[0].hooks[0] hook_event=user_prompt_submit
     : xai_grok_hooks::dispatcher: gate hook failed; ignoring (fail-open)
     hook_failure=hook not executed: required env var(s) not set: ${root}
```

改成裸相对命令后 —— 真正执行：

```
INFO hook_name=project/trellis-hooks:session_start[0].hooks[0] hook_event=session_start
     : xai_grok_hooks::dispatcher: hook completed
INFO hooks.dispatch{hook_event=session_start hook_count=2 num_success=2 num_failed=0 num_skipped=0
     total_duration_ms=120}

INFO hook_name=project/trellis-hooks:user_prompt_submit[0].hooks[0] hook_event=user_prompt_submit
     : xai_grok_hooks::dispatcher: hook completed
```

另有一条同轮踩到的坑（已修）：`SessionStart` 的 matcher 写 `startup|resume` 时，无头会话**匹配不上**，整个分组被静默跳过（debug 日志里连派发记录都没有）；去掉 matcher 后才出现上面那条 `hook completed`。原因与修法都写进了 `.grok/hooks/README.md`，免得后来者再踩。

顺带一条与接线无关但每次会话都会刷的警告：Trellis 生成的 `.cursor/hooks.json`（项目级与全局各一份）在 grok 里解析失败 —— `invalid matcher groups for event 'sessionStart': missing field 'hooks'`（Cursor 扁平格式 ≠ grok 期望的 matcher-group 结构）。不影响本仓库 grok 接线，只是噪声。

## 6. 第 7 项：本会话 cwd 的影响

- **当前 cwd = `/Users/yihu/zero/WorkSpace`**（不是本仓库；本会话的 workspace root 就是它，且它不是 git 仓库）。本仓库是 `/Users/yihu/Documents/ChatGPT/叮咚`。
- **对 AGENTS.md 自动加载的影响**：grok 从「仓库根 → 当前目录」逐级加载 AGENTS.md，**启动加载需要 folder trust**。因为 cwd 不在本仓库，**本会话启动时没有自动加载本仓库的 AGENTS.md**（我是按简报手动读的）。旁证：我在本仓库目录下跑了一次无头会话做 hook 验证，那个会话的 `prompt_context.json` 里**确实带了 `Agents.md` 全文**（含 R0 写的 TRELLIS 约束段）——说明只要会话落在本仓库，自动加载是生效的。本仓库在 trust 库里（`grok inspect` 报 `Project trusted: yes`）。
- **对权限边界判定的影响**：本次简报的边界是「项目目录内可写、目录外一律停」。因为 cwd 在外，**边界不能靠工具自带的目录限制兜底**，只能靠我逐条自查路径——所以 R0/R0b 里所有跨目录动作（读 `~/.grok/docs`、`grok inspect`、`find ~`）都只读不写，唯一写到 `~` 之外的是 npx 缓存。另外「项目级」surface（`.grok/hooks/`、项目 `.claude/settings.json` 的 hooks）在本会话**都不会被加载**，我这次是靠**另开一个 cwd 落在本仓库的无头会话**才拿到 hook 的实测证据——这也是为什么 hook 验证必须嵌套跑。
- 影响面仅限本会话；你要修的话就是重启一个 cwd 落在本仓库的会话（你自己也说了这条不由我修）。

## 7. 偏离与未做的事

- 第 5 项 spec 用了子代理（backend / frontend 各一个）来写，我自己做验收抽查；**没有**逐行通读全部 17 篇。抽查 6 条断言全部属实，未核实的部分见 §4 与 experiment-log。
- 收尾令要求「不再做任何新实验、不再读大文件」，我据此停掉了 PreToolUse 的实派子代理验证（§4 记为未验证），没有为凑证据再跑一轮。
- 没有动 `.cursor/hooks.json`（那个解析失败是 Trellis 模板的事，不在本轮范围）。

## 8. 收尾提交与推送

- commit message 以 `[R0b]` 开头，内容含：`.grok/`（49 个模板文件 + hooks 接线 + README）、`.trellis/spec/` 两包改写（17 篇，含删 6 篇模板）、`.trellis/.template-hashes.json`、`.githooks/commit-msg`（merge 豁免）、`scripts/audit_documents.py`（SKIP）、两处模板回滚、R0b 简报/报告、experiment-log 更新。
- **已 push 到 origin 同一分支**（`codex/release-v0.3.6`），sha 见收尾消息。
- 未提交、刻意留着的仍是 `文档/文档校验结果.json` 与 `设计/API/契约检查结果.json`（跑审计会重写，按本仓库既有惯例还原；**库里那份仍是旧值**，要不要提交新结果等你一句话）。

## 9. 需要你拍板的

1. `文档/文档校验结果.json` 要不要提交新结果（现在库里的 markdown 篇数已过时）。
2. grok 侧「hook 会执行但注入不被采纳」这件事怎么处理：接受现状（hook 只作为留痕/未来兼容），还是改用别的机制（比如把 Trellis 约束直接写进 AGENTS.md 让 grok 自动加载——R0 已经这么做了，效果已被 §6 的旁证证实）。
3. `.cursor/hooks.json` 的解析警告要不要处理（改写成 grok 认的 matcher-group 结构，或把项目里那份删掉）。
4. `~/.cursor/hooks.json` 也报同样的解析错误，但那是你 home 下的文件，按边界我没碰。