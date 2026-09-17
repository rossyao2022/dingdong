# T-036 报告：loop 账本瘦身

## goal

把 `queue.md` / `gates.md` 瘦身为「活跃任务全文 + 历史归档」，压 worker 每轮读入的上下文，降低 TPM 限流频率：①`gates.md` 决定段的 EXECUTED 历史行移入归档文件，决定段只保留仍生效的常设许可；②`queue.md` 已 done 任务的超长执行结果 notes 压成一行指针（先核对 report.md 已覆盖）；③`status.md` / `runs.log` 的驱动格式不动。

## 实际做了什么

只动了任务允许的三个位置（`queue.md`、`gates.md`、新建归档文件），另加任务目录内的两个脚本。

1. **`gates.md` 95 → 34 行**（22056 → 5098 字节）
   - 决定段 47 行历史移入新增的 `.trellis/loop/gates-archive-20260917.md`：43 条 `EXECUTED ...` 行 + 4 条一次性事后追认（`APPROVE T-002` / `APPROVE R0d` / `APPROVE T-025` / `APPROVE T-020`），逐行原文、未改写。
   - 决定段保留：`APPROVE T-003` 整块（含第一/二批常设直推规则与导入清单）、`APPROVE T-021` 整行（含 A–D 直推规则与收尾授权）、`DENY T-099`。
   - 申请段一行未动（含 5 条 `REQUEST` 行原文）。
2. **`queue.md` 257 → 119 行**（65969 → 16508 字节）
   - 28 个 `done` 任务压成 2 行：`## T-xxx <原标题>` + `- status: done · 见 .trellis/tasks/<id>/report.md`；T-025 无 report.md，指针指向 `.trellis/loop/queue-archive-20260917.md`。
   - 压缩前全文 257 行原文留档 `.trellis/loop/queue-archive-20260917.md`。
   - todo 任务（T-031 / T-028 / T-032 / T-033 / T-034 / T-035 / T-024）与 T-036 自身的 notes 逐字保留，未压。
   - 新增一行「瘦身（T-036）」说明，写清指针约定与留档路径。
3. 脚本：`.trellis/tasks/T-036/slim_ledgers.py`（瘦身，带归档已存在即拒绝重跑的守卫）、`.trellis/tasks/T-036/verify.py`（验证）。
4. 未改：`scripts/worker-loop.sh`、`.trellis/loop/prompt.md`、`.trellis/loop/status.md`、`.trellis/loop/runs.log`。

## 验证命令与真实输出

`python3 .trellis/tasks/T-036/verify.py`（原文 `verify-output.txt`，23 PASS / 0 FAIL）：

```
[PASS] queue.md ≤ 120 行 — 实测 119
[PASS] gates.md ≤ 60 行 — 实测 34
[PASS] `## T-xxx 标题` 计数 36 — 实测 36
[PASS] `- status:` 行计数 36 — 实测 36
[PASS] 36 个 status 值全在词表内 — 值分布 ['done', 'todo']
[PASS] 驱动 next_task 正常返回 — rc=0 返回 'T-031'
[PASS] 驱动 classify(T-036) 判 DONE — 返回 'DONE'
[PASS] 驱动 classify(T-030) 判 DONE — 返回 'DONE'
[PASS] 驱动 classify(T-031) 不再判 DONE（status=todo） — 返回 'FAIL'
[PASS] 驱动 loop_gate_snapshot 正常（申请段指纹 + blocked 列表） — rc=0
      loop_gate_snapshot 输出：
        '7cbe1215c54dc634a0d1b98b365845fd'
        ''
[PASS] blocked 列表为空（T-031 已解锁） — 第二行 ['']
[PASS] 归档含全部被移除行原文 — 移除 47 行，缺失 0 行
[PASS] 归档行序与原文一致 — 索引单调=True
[PASS] 全部 EXECUTED 行（含被移除的）在归档中 — EXECUTED 43 行
[PASS] gates.md 仍含 `## 申请` / `## 决定` 两个切分锚点
[PASS] 决定段保留的 APPROVE 仅 T-003 / T-021 — 实测 ['T-003', 'T-021']
[PASS] 决定段保留 DENY T-099
[PASS] T-030 被压缩内容可在原文留档中找到 — ['已归档', '已暂停', '账号已停用', '登录凭据']
[PASS] T-030 关键事实在 report.md 或原文留档中 — report=['已归档', '已暂停', '账号已停用', '登录凭据']
[PASS] T-022 被压缩内容可在原文留档中找到 — ['LOOP_ORCH_PANE', 'WAKE FAIL', 'w0:p4']
[PASS] T-022 关键事实在 report.md 或原文留档中 — report=['LOOP_ORCH_PANE', 'WAKE FAIL', 'w0:p4']
[PASS] T-025 被压缩内容可在原文留档中找到 — ['line 301: $5: unbound variable', 'fallbacks_today', 'watchdog']
[PASS] T-025 关键事实在 report.md 或原文留档中 — report=[]
结果：全部通过
```

验证方式说明：verify.py 不重新实现驱动逻辑，而是从 `scripts/worker-loop.sh` 里抽出 `next_task` / `classify` / `loop_gate_snapshot` 三段的 python 块原文，用与驱动相同的参数直接执行，确认瘦身后的账本仍被驱动正确解析。逐行归档核对以固定参考提交 `d80891c`（T-030 收尾提交，即 `[T-036]` 瘦身提交的父提交）的 `gates.md` 为瘦身前原文，不随本轮后续提交前移，故本脚本任何时候重跑都得到同一结论（重跑于收尾提交后：`gates.md` 实测 36 行，23 PASS / 0 FAIL）。

`python3 scripts/audit_documents.py`：

```
{"markdown_files": 80, "local_links_checked": 497, "archived_files_checked": 85, "operations": 55, "schemas": 65, "errors": []}
```

## 未验证项

- 未跑真实一轮驱动（会触发一次真实模型调用与提交，属下一轮的事）。兼容性用「直接执行驱动脚本里的解析块」替代，不是端到端跑轮。
- 未验证 herdr / 唤醒钩子行为：本轮没碰 `wake_orchestrator`、`loop_gate_snapshot` 的调用时机，只验证了快照函数本身在新 gates.md 上的输出。
- 归档文件不被任何脚本读取（只作回溯），故其内容未被自动化流程消费，仅人工核对。

## 偏离与理由

1. **done 任务压成 2 行而不是「保留 goal/acceptance + 只压 notes」**：acceptance 要求 `queue.md` ≤ 120 行，同时要求 todo/doing/gated/blocked 任务 notes 保持全文（实测 43 行）、`## T-xxx` 标题与 `- status:` 行各保留一份。28 个 done 任务若保留 goal/acceptance（每条约 3–4 行）会到 140 行以上，必然超标；故 done 任务整体压成「标题 + 一行指针」，压缩前全文留档，逐条信息仍可由 report.md（27 条）或留档（T-025）取回，抽查 3 条已核对命中。
2. **指针写在 `- status:` 行尾**（`- status: done · 见 ...`）：若指针另起一行，done 块会多 28 行同样超标。驱动取 status 用的正则 `^-\s*status\s*[:：]\s*(\S+)` 只读首个 token，实测 `classify` 对 T-036 / T-030 仍返回 `DONE`、对 `todo` 的 T-031 返回 `FAIL`，格式兼容性由真实解析块验证。
3. **done 块连续排布、条目之间不空行**：行数预算所限（119/120），已在 `queue.md` 头部「瘦身（T-036）」一行写明。Markdown 渲染不受影响（ATX 标题可打断列表行）。
4. **移除 4 条一次性事后追认（`APPROVE T-002` / `R0d` / `T-025` / `T-020`）**：任务只要求保留三类常设许可，这 4 条对应任务均已 `done`、账面已闭合，原文在归档中可查。
5. **新增 `queue-archive-20260917.md`**（任务只点名了 gates 归档文件）：作为 done 任务压缩的全文兜底，满足「不得丢信息」。两文件均在 `.trellis/loop/` 下，不被驱动与 prompt 读取。
