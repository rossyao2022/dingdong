# T-021 进度

- 任务：G-01-设计 四个展示面的设计文档（gate=review，只写设计）
- 状态：Plan 完成 · Implement 完成 · Verify 完成 · Finish 完成

## 已完成阶段

### Plan（完成）

- 读 `AGENTS.md` 顶部约束、`.trellis/workflow.md`、`.trellis/loop/gates.md`、`.trellis/loop/queue.md`、`.trellis/spec/frontend/index.md`、`.trellis/spec/backend/index.md`。
- 核对决定段：所有 `APPROVE` 均有对应 `EXECUTED`，无待执行门禁动作（`T-099` 为 `DENY`）。
- 取队列第一个 `status: todo` = `T-021`，已改 `doing`。
- 现状核查（命令与结果记入 design.md §0）：`grep -rn "persona\|reassess" backend/dingdong_ca --include=*.py -il` → 0 文件；`grep -rn "persona\|reassess\|健康" frontend/*.js frontend/*.html` → 0 命中。
- 读契约材料：`材料/可检索文本/DingDong_CA_数据库字段与接口.md`（表 4 接口、表 5 JSON 示例、表 6 六个 mock 账号、表 7 复测规则 H01–H07 与参数表）、`材料/可检索文本/DingDong_CA_系统开发文档.md`、`设计/CA对接_C1_ca_account_id设计_20260916.md` §7、`需求/后台设计已确认约束.md` 首节。

### Implement（完成）

- 新增 `.trellis/tasks/T-021/design.md`（六节：现状核查 / 四个展示面数据形状 / 合成数据源分层 / 空态与错误态 / §7 逐条对照 / 实现任务拆分 / 未决待澄清）。
- 无代码改动：`git status --short` 只有 `.trellis/loop/queue.md`（status 改 doing）、`.trellis/loop/runs.log`（驱动追加）、`.trellis/tasks/T-021/`（新建）。

### Verify（完成）

命令与原始输出：

```
$ python3 scripts/audit_documents.py
{"markdown_files": 80, "local_links_checked": 497, "archived_files_checked": 85, "operations": 55, "schemas": 65, "errors": []}

$ git diff --stat
 .trellis/loop/queue.md | 2 +-
 .trellis/loop/runs.log | 4 ++++
 2 files changed, 5 insertions(+), 1 deletion(-)
```

- `errors` 为空 ✓
- 无代码改动 ✓（`frontend/`、`backend/`、`设计/API/openapi.json` 均未出现在 `git status`）

## 改动文件列表

- `.trellis/tasks/T-021/design.md`（新建）
- `.trellis/loop/queue.md`（T-021 `status: todo` → `doing`）
- `.trellis/tasks/T-021/progress.md`（新建，本文件）
- `.trellis/tasks/T-021/report.md`（新建）

## 下一步

无。本轮只做 T-021，已完成：`queue.md` 改 `gated`，`gates.md` 申请段追加 `REQUEST T-021 review 四个展示面…… 2026-09-17T13:20Z`，`report.md` 已写，收尾记录（`status.md` / `experiment-log.md`）已更新。**本任务 `gate: review`，未 push**（第三批逐条申请，不适用直推规则）。
