# T-001 报告：写 .trellis/loop/README.md

## goal

给 `.trellis/loop/` 写一份操作说明，让 orchestrator 一看就知道怎么启停、怎么批门禁、怎么看状态、怎么加任务。

## 实际做了什么

新建 `.trellis/loop/README.md`，共 7 行：标题 + 5 条要点，覆盖启停、批门禁、看状态、加任务四件事，外加一条「其余」（单轮提示词位置、模型档位）。内容全部来自仓库现有文件，未改驱动脚本：启停与 STOP 语义抄自 `scripts/worker-loop.sh` 头部注释（第 4–7 行、第 278–280 行），门禁申请/决定格式抄自 `.trellis/loop/gates.md` 说明段，状态与流水来源抄自 `scripts/worker-loop.sh` 第 22–26 行的路径定义，加任务的字段格式抄自 `.trellis/loop/queue.md` 的字段说明行，模型档位抄自 `.trellis/loop/models.env`。

另外把 `.trellis/loop/queue.md` 里 T-001 的 `status` 从 `todo` 改为 `doing`，收尾时改为 `done`。

## 验证命令与真实输出

```
$ wc -l .trellis/loop/README.md
       7 .trellis/loop/README.md

$ python3 scripts/audit_documents.py
{"markdown_files": 80, "local_links_checked": 497, "archived_files_checked": 85, "operations": 55, "schemas": 65, "errors": []}
```

acceptance 逐条核对：

- `.trellis/loop/README.md` 存在且不超过 10 行 → 存在，7 行。
- 四件事各至少一条 → 启停（第 3 行）、批门禁（第 4 行）、看状态（第 5 行）、加任务（第 6 行），各一条。
- 首行 `[T-001]` 的提交入库 → commit `6e89463`，首行 `[T-001] docs: 补 .trellis/loop/README.md 操作说明（启停/批门禁/看状态/加任务）`。

## 未验证项

- 未实际执行 `touch .trellis/loop/STOP` 验证驱动退出（那会终止正在跑的驱动进程，属本轮之外的副作用）。
- 未验证 orchestrator 侧写 `APPROVE` 后的完整闭环（本轮 `gates.md` 决定段为空，无可执行门禁）。

## 偏离与理由

无偏离。除 README 外只改了 `queue.md` 的任务状态字段（本提示词第 2 节要求取到任务即标 `doing`）。
