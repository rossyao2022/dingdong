# 实验记录：Trellis 接线 + 执行 worker 自主度

记录 R0 这一轮实验的真实过程数据。字段含义：**工具调用/轮次** = 本次会话 `.grok` 事件日志里 `tool_started` / `loop_started` 的计数；**门禁触发** = `.githooks` 拦下的提交次数与原因；**右侧介入** = 右侧 orchestrator 在门禁点放行或补发指令的次数。计数采样时点为「收尾提交前」（采样后只剩 add / commit / journal 等收尾调用）。

| 任务 id | 简报摘要 | 工具调用/轮次 | 门禁触发次数与原因 | 卡点 | 右侧介入次数 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| R0 | 装 Trellis、手工接线（AGENTS.md 约束段 + 哨兵、`.githooks` 提交门禁）、实验记录、门禁自测、基线复跑、收尾提交（不 push） | 79 / 64 | 4 次，全部由自测产生：⓪ 首个 pre-commit 版本把合规提交也拒了（hook 放错阶段）；① 无任务 id；② 暂存 `.pem`；③ 暂存 `.md` 时审计有 error | 4 个（见下） | 0 | 完成（除 push 等待放行） |

## 卡点（本轮真实遇到，按发现顺序）

1. **`trellis init` 是交互式 prompt。** 关掉 stdin（`< /dev/null`）时以 `ERR_USE_AFTER_CLOSE: readline was closed` 中止，一个文件都没写；加 `-y` 才落地。简报给的命令需要补 `-y`。
2. **`pre-commit` 阶段读不到新提交消息。** git 2.39.5 下 `.git/COMMIT_EDITMSG` 此刻仍是**上一条**提交的主题，导致带 `[R0]` 的合规提交也被拒。任务 id 检查因此挪到 `commit-msg`（那里的 `$1` 才是新消息）。
3. **Trellis 自带模板与文档审计冲突。** 生成的 `.claude/agents/trellis-research.md` / `.cursor/agents/trellis-research.md` 各含一行模板链接占位（方括号标题 + 括号字面量 url），被 `scripts/audit_documents.py` 判成 2 条 `local_link` error，会让门禁③永久拒绝提交。已改成非链接写法（注意 `trellis update` 可能覆盖回原样）。同一坑咬了本记录一次：`scripts/audit_documents.py` 的链接识别不区分代码块/反引号，**连在文档里引用这段坏语法都会被判违规**，所以收尾提交第一次被自己的门禁③拒了；这两份文档里都不能出现那段字面量语法。
4. **Trellis 的自动提交与门禁①天然冲突。** `add_session.py` / `task.py archive` 的自动提交消息（`chore: record journal`、`chore(task): archive ...`）不含任务 id，会被门禁拒。已在 `.trellis/config.yaml` 设 `session_auto_commit: false`，改由驱动 agent 自己带任务 id 提交。

## 简报与实况不符（未硬凑，照实记）

- 简报 step 10 预期「`npm test` 16 passed」。本仓库 `npm test` = `playwright test`（浏览器端到端，22 项，本轮 18 通过 / 4 失败，依赖完整本地栈与干净库）；16 项那条实际是 `npm run test:unit`（`node --test unit/*.test.js`），本轮 16 通过 / 0 失败。两条都跑了，数字见 report.md。
- 简报 step 8 的两项预期都成立：无任务 id 的空 commit 被拒；合规的空 commit 通过。

## 下一轮要处理的

- `.githooks` 只约束本机 clone（`core.hooksPath` 写在 `.git/config`，不入库）；要团队级强约束得走服务端或 CI。
- 合并提交消息形如 `Merge branch ...`，不带任务 id，会被门禁①拒；需要时给 `commit-msg` 加 `MERGE_HEAD` 豁免。
- 引入 Trellis 后 `scripts/audit_documents.py` 的扫描面从 79 个 markdown 涨到 200 个（Trellis 自己的 `.md` 全进来了），是否把 `.trellis/`、`.claude/`、`.cursor/` 加进审计 SKIP 值得拍板。