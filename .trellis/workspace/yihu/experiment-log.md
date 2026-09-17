# 实验记录：Trellis 接线 + 执行 worker 自主度

记录 R0 这一轮实验的真实过程数据。字段含义：**工具调用/轮次** = 本次会话 `.grok` 事件日志里 `tool_started` / `loop_started` 的计数；**门禁触发** = `.githooks` 拦下的提交次数与原因；**右侧介入** = 右侧 orchestrator 在门禁点放行或补发指令的次数。计数采样时点为「收尾提交前」（采样后只剩 add / commit / journal 等收尾调用）。

| 任务 id | 简报摘要 | 工具调用/轮次 | 门禁触发次数与原因 | 卡点 | 右侧介入次数 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| R0 | 装 Trellis、手工接线（AGENTS.md 约束段 + 哨兵、`.githooks` 提交门禁）、实验记录、门禁自测、基线复跑、收尾提交（不 push） | 79 / 64 | 4 次，全部由自测产生： 首个 pre-commit 版本把合规提交也拒了（hook 放错阶段）；① 无任务 id；② 暂存 `.pem`；③ 暂存 `.md` 时审计有 error | 4 个（见下） | 0 | 完成（除 push 等待放行） |
| R0b | 按验收结论打补丁：push 放行、门禁①豁免 merge、审计跳过工具脚手架并回滚模板改动、补 `init --grok`、写 backend/frontend 真 spec、把 Trellis hooks 改挂项目级 `.grok/hooks/` | 72 / 65（本会话两轮累计 171 / 146） | 0 次（本轮没有正常提交被拦；一次收尾提交因文档里引用了坏链接语法被门禁③拦下，属自伤，见卡点 3 附注） | 4 个（卡点 5–8：TPM 限流 ×2、hook 变量展开、SessionStart matcher） | 0 | 完成（已 push） |
| R0c | 接手 R0b 未落盘的收尾：按 4 条决定处理（提交两个校验结果 JSON、hooks 现状写进 README、删项目 `.cursor/`、不碰 `~/.cursor`）、复跑审计、一条 `[R0c]` 提交并 push、补实验记录 | 27 / 27（采样于写记录前；此后只剩写记录 / 提交 / 推送等收尾调用） | 0 次（本轮没有提交被拦。门禁①的轮次号正则缺陷在 R0b 已事前修掉，本轮只做放行验证：`[R0c]` / `[R0b]` exit 0，无任务 id exit 1） | 2 个（卡点 9–10：上一会话 TPM 限流 ×3 + 上下文 248k；门禁①正则只认数字轮次号） | 0 | 完成（已 push） |
| T-001 | 写 `.trellis/loop/README.md`（≤10 行，覆盖启停/批门禁/看状态/加任务四件事），不碰驱动脚本 | 21 / 21（本会话工具调用计数，采样于收尾提交前） | 0 次 | 0 个 | 0 | 完成（已本地提交，未 push） |
| T-002 | 新建 `.trellis/tasks/T-002/hello.md`（门禁联调测试文件），在 `gates.md` 申请 push 门禁，任务停 `gated` 等批 | 24 / 24（本会话工具调用计数，采样于收尾提交前） | 0 次（本地 commit `b7e30d1` 一次通过 commit-msg 与 pre-commit） | 0 个 | 0 | 完成（本地已提交，push 待批；停在 `gated`） |
| T-004 | 验证模型切换自测：PRIMARY 被假 grok 脚本伪造限流（`TooManyRequests`）后由 FALLBACK（Pro）重跑；worker 确认 FALLBACK 身份、写报告标 `done`、不改代码 | 30 / 18（`events.jsonl` 计数，采样于收尾提交前） | 0 次 | 0 个 | 0 | 完成（本地已提交，未 push） |

## 正面样本（orchestrator 2026-09-17 验收确认）

**R0 的两处「停下报告而不硬凑」被记为正面样本**：

1. 任务 id 检查被实测证明不能放在 `pre-commit`（git 阶段问题），我改放 `commit-msg` 并把原因写进 hook 注释，而不是硬凑一个能过检的写法。
2. 简报预期 `npm test` = 16 项单测，实况是 Playwright 端到端；我没有把 `test:unit` 的数字冒充成 `npm test` 的结果，而是两条都跑、分开报。

结论提炼：**当「简报预期」与「仓库实况」冲突时，正确动作是两边都测、如实分列、把差异交回决策者**，不是挑一个能对上预期的数字报上去。后续轮次沿用这条。

## 卡点（本轮真实遇到，按发现顺序）

1. **`trellis init` 是交互式 prompt。** 关掉 stdin（`< /dev/null`）时以 `ERR_USE_AFTER_CLOSE: readline was closed` 中止，一个文件都没写；加 `-y` 才落地。简报给的命令需要补 `-y`。
2. **`pre-commit` 阶段读不到新提交消息。** git 2.39.5 下 `.git/COMMIT_EDITMSG` 此刻仍是**上一条**提交的主题，导致带 `[R0]` 的合规提交也被拒。任务 id 检查因此挪到 `commit-msg`（那里的 `$1` 才是新消息）。
3. **Trellis 自带模板与文档审计冲突。** 生成的 `.claude/agents/trellis-research.md` / `.cursor/agents/trellis-research.md` 各含一行模板链接占位（方括号标题 + 括号字面量 url），被 `scripts/audit_documents.py` 判成 2 条 `local_link` error，会让门禁③永久拒绝提交。已改成非链接写法（注意 `trellis update` 可能覆盖回原样）。同一坑咬了本记录一次：`scripts/audit_documents.py` 的链接识别不区分代码块/反引号，**连在文档里引用这段坏语法都会被判违规**，所以收尾提交第一次被自己的门禁③拒了；这两份文档里都不能出现那段字面量语法。
4. **Trellis 的自动提交与门禁①天然冲突。** `add_session.py` / `task.py archive` 的自动提交消息（`chore: record journal`、`chore(task): archive ...`）不含任务 id，会被门禁拒。已在 `.trellis/config.yaml` 设 `session_auto_commit: false`，改由驱动 agent 自己带任务 id 提交。
5. **R0b：模型限流中断 2 次（TPM 429）。** 两次都是把重活派给子代理时撞上 `deepseek-v4-1-flash` 的每分钟 token 上限：第一次后端 spec 子代理跑 20 轮后 429 挂掉（输入 136 万 token），第二次是收尾阶段整轮被打断。处置：后端 spec 用 `resume_from` 接着原会话跑（不重读全部代码，省 token）后成功；收尾改成不再开新实验、不再读大文件。**教训：单轮内并派多个「要通读代码」的子代理会撞 TPM，重活要串行或错峰。**
6. **R0b：grok 的 hook runner 会对 `command` 做变量展开。** `.grok/hooks/` 里把命令写成 `sh -c '... ${root} ...'` 时，runner 把 `${root}` 当**必需环境变量**，报 `hook not executed: required env var(s) not set: ${root}` 而**根本不执行**（fail-open，日志里才有）。改成裸相对命令 `python3 .claude/hooks/session-start.py` 后 `hook completed`。runner 的工作目录就是仓库根，所以相对路径够用。
7. **R0b：`SessionStart` 的 matcher 写 `startup|resume` 匹配不上无头会话。** 分组被静默跳过（debug 日志里连派发记录都没有）。去掉 matcher 后正常 `hook completed`。
8. **R0b：Trellis 生成的 `.cursor/hooks.json` 在 grok 里解析失败。** grok 读项目与全局的 `.cursor/hooks.json` 时报 `invalid matcher groups for event 'sessionStart': missing field 'hooks'`（Cursor 的扁平格式与 grok 期望的 matcher-group 结构不同）。不影响本仓库的 grok 接线（我们用的是 `.grok/hooks/`），但这条会在每次会话启动时刷警告。**R0c 已处置**：项目内 `.cursor/` 整个删掉（本轮不再出现该警告）；`~/.cursor/hooks.json` 在 home 下、按边界未碰，警告仍会刷。
9. **R0c：上一会话（R0b）的结构性卡点——TPM 限流 ×3 + 上下文涨到 248k。** R0b 单会话内被模型限流打断三次（第一次是后端 spec 子代理输入 136 万 token 后 429，后两次在收尾阶段），同时会话上下文涨到 248k，逼近单会话可继续操作的边界。直接后果：**R0b 的全部改动只落在工作区，未 commit、未 push，收尾被整体拆到新会话（R0c）才完成**。教训：①重活串行、不并派多个「要通读代码」的子代理（同卡点 5）；②收尾动作（审计 → 提交 → 推送 → 写记录）要尽早做，一旦拖到会话末尾被打断，代价从「丢一段分析」变成「整轮成果未落盘」；③长任务切成「产出即落盘」的小段，每段结束就提交。
10. **R0c：门禁①的轮次号正则只认纯数字，会误拒 `[R0b]` / `[R0c]`。** 原正则 `\[R[0-9]+\]` 只匹配 `[R0]`，轮次号一旦带字母后缀就被判「缺少任务 id」——这是**门禁自身的缺陷**，不是使用者的错。R0b 已事前把正则改成 `\[R[0-9]+[A-Za-z]*\]` 并同步了拒绝提示文案（**未实际触发**，因为 R0b 的提交一直没做成）。R0c 做放行验证：首行 `[R0c]` exit 0、`[R0b]` exit 0、`chore: no id` exit 1。

## 简报与实况不符（未硬凑，照实记）

- 简报 step 10 预期「`npm test` 16 passed」。本仓库 `npm test` = `playwright test`（浏览器端到端，22 项，本轮 18 通过 / 4 失败，依赖完整本地栈与干净库）；16 项那条实际是 `npm run test:unit`（`node --test unit/*.test.js`），本轮 16 通过 / 0 失败。两条都跑了，数字见 report.md。
- 简报 step 8 的两项预期都成立：无任务 id 的空 commit 被拒；合规的空 commit 通过。

## 下一轮要处理的

- `.githooks` 只约束本机 clone（`core.hooksPath` 写在 `.git/config`，不入库）；要团队级强约束得走服务端或 CI。
- 合并提交消息形如 `Merge branch ...`，不带任务 id，会被门禁①拒；需要时给 `commit-msg` 加 `MERGE_HEAD` 豁免。
- 引入 Trellis 后 `scripts/audit_documents.py` 的扫描面从 79 个 markdown 涨到 200 个（Trellis 自己的 `.md` 全进来了），是否把 `.trellis/`、`.claude/`、`.cursor/` 加进审计 SKIP 值得拍板。→ **已拍板（R0b 决定③、R0c 收尾）**：四个脚手架目录 `.trellis` / `.claude` / `.cursor` / `.grok` 全部进 SKIP，审计面回到项目文档本身（R0c 复跑：80 篇、errors 空）。
- **每个执行会话收尾必须落盘再交棒**：R0b 因限流 ×3 + 上下文 248k 未提交就中断，R0c 花了一整轮做「捡起来 + 提交 + 推送」。后续轮次把「审计 → 提交」提前到会话中段做，别攒到最后。