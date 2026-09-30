# 叮咚项目：新会话入口

## CA 技术负责权与本地优先（2026-09-30 用户决定）

- **我方是 CA 侧第一技术负责方；当前本地仓库已完成的功能及完整性是同步、合并和发布的主基线。所有远程提交、线上版本与外部参考内容均须让渡于这一基线。**
- 远端改动先核对差异，再由我方决定是否吸收；提交时间更晚或已在线运行不能自动取得优先权。
- 冲突时保留本地已完成的功能、交互、数据链路与测试保障；有用的远端新增内容经适配和验证后纳入本地，再由本地形成发布版本。
- **CA 远程仓库为 `origin`（`ivesyi/dingdong-ca`），默认主干为 `main`；`upstream` 是原始视觉参考仓库。** 后续每次同步、合并和发布均按此模式执行。具体操作规则见 [本地优先与远程整合](.trellis/spec/guides/ca-local-authority.md)。

## TRELLIS 约束（2026-09-17 起，先读这段）

- **新会话首条回复必须包含 `TRELLIS-OK`**（哨兵，用来证明这段约束真的被读到）。
- 任何 agent 开工前先读 [.trellis/workflow.md](.trellis/workflow.md)，按 **Plan → Implement → Verify → Finish** 四阶段推进。对应 workflow.md 里的 Phase 1 Plan / Phase 2 Execute / Phase 3 Finish，其中 Verify 是 Phase 2 的 `trellis-check` 环节。
- 收尾时执行 [.claude/commands/trellis/finish-work.md](.claude/commands/trellis/finish-work.md) 的内容（归档任务 + 记录 journal）。
- 提交门禁：本仓库启用了 `.githooks/`（`core.hooksPath` 指向它），两个 hook 分工：`commit-msg` 要求 commit message 首行带 `[R<n>]` 或 `[T-<id>]` 任务 id；`pre-commit` 要求暂存文件不含 `.env`/`*.pem`/`*.key`/私钥，且暂存 `.md` 时 `python3 scripts/audit_documents.py` 的 errors 为空。
- **权限边界（违反即视为实验失败）**：
  - 本仓库目录内：读写、跑测试、本地 commit 全部自主，做完报告。
  - 任何触达仓库目录之外的副作用 → 立刻停下并报 NEED-GATE，等放行：`git push` / 改 PR 状态 / merge；ssh 到任何远端做写操作或部署；`~` 下任何写入（含 `~/.grok`、`~/.claude`、全局 `npm -g`）；给对方发消息；读取、复制或打印 `deploy/.env`、`*.pem`、私钥内容。
  - 实现与预期不符时不许硬凑，停下如实报告。

---

本文件是本仓库的新会话工作指引。开始继续项目之前：

1. 阅读 [项目记忆](PROJECT_MEMORY.md)，获取已确认约束、当前状态、验收证据及续接方式。
2. 按当前任务阅读 [文档索引](文档/文档索引.md) 中的相关文档；不要把历史设计或旧阶段测试数量当作现状。
3. 核对代码、Git工作区、服务健康和最新测试记录。记忆中的运行状态仅是带日期的快照，不能直接假设服务仍在运行。

沿用现有技术栈与参考视觉；功能改动按关键测试先行的 TDD 方式开发，并用真实浏览器验收涉及的交互。常规实现选择自行决定，只有实质阻塞才询问。不得把测试数据流程声称为真实供应商接入。

任务结束时，如功能、约束、启动方法、测试结果或待办发生实质变化，更新 PROJECT_MEMORY.md 的日期、事实和证据链接。保留历史报告，不覆盖原始材料或把计划写成已完成。不在记忆中存放密码、令牌、验证码挑战、家庭业务数据或真实指纹。
