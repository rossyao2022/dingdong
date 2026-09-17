# T-022 progress

## 已完成阶段

- Plan：完成。读 `AGENTS.md` 约束段、`.trellis/loop/gates.md`（决定段无待执行 APPROVE）、`queue.md`、`scripts/worker-loop.sh`（299 行）、`.trellis/loop/ORCHESTRATOR.md`、`status.md`、`runs.log`；确认本轮任务 = T-022（`LOOP_TASK_ID=T-022`，驱动 pid 28928 启动的本进程）。
- Implement：完成。钩子加在 `scripts/worker-loop.sh`：`loop_gate_snapshot` / `wake_orchestrator` / `notify_orchestrator_if_needed` 三个函数 + `run_round` 开工取基线、收尾调一次；新增 `LOOP_ORCH_PANE`（默认 `w0:p4`）与 `LOOP_WAKE_CMD`（联调替代命令）两个环境变量。
- Verify：完成。见下命令与数字。
- Finish：进行中。

## 改动文件列表

- `scripts/worker-loop.sh`（唯一业务改动）
- `.trellis/tasks/T-022/`：`fake-grok.sh`、`fake-wake.sh`、`fake-wake-fail.sh`、`queue-temp-task.py`、`gates-test-line.py`、`run-hook-tests.sh`、`hook-test-transcript.txt`、`run-A-request.txt`、`run-A-smoke.txt`、`run-B-nochange.txt`、`run-C-blocked.txt`、`run-D-wakefail.txt`、`fake-grok-invocations.log`、`fake-wake-invocations.log`、`pane-after-wake.txt`、`runs.log.after`
- `.trellis/loop/gates.md`（测试 REQUEST 行）、`queue.md`（T-022 status）、`runs.log`（仅真实 T-006 轮次行，自测轮次已清）

## 跑过的命令与结果

- `bash -n scripts/worker-loop.sh` → exit 0（"bash -n OK"）；裸变量紧跟全角字符扫描 → 无（修掉 `$reason、` 与 `$rc）` 两处）
- `TESTS=all bash .trellis/tasks/T-022/run-hook-tests.sh` → `PASS=13 FAIL=1`；唯一 FAIL 是「面板 revision 增大（30→30）」——断言在驱动退出瞬间读取，revision 异步刷新，事后核对为 `w0:p4 rev=39 agent_status=working`（`pane-after-wake.txt`）；runner 已改为轮询等待
- `TESTS=BC bash ...run-hook-tests.sh` → `PASS=8 FAIL=0`
- `TESTS=D bash ...run-hook-tests.sh` → `PASS=5 FAIL=0`
- `TESTS=A`（SMOKE=1，首轮联调）→ `PASS=3 FAIL=1`（当时断言 grep 的是 runs.log 文案而非驱动 stdout，已修）
- `python3 scripts/audit_documents.py` → `{"markdown_files": 80, "local_links_checked": 497, "archived_files_checked": 85, "operations": 55, "schemas": 65, "errors": []}`
- `runs.log` 自测轮次清理：删除 15 行（07:18 窗口）+ 4 行（07:20 D 场景），保留 10 行；`git diff --stat` = `1 insertion(+)`（仅真实 T-006 轮次行）

## 下一步

收尾：commit（`[T-022]`）→ push → 回填 EXECUTED / queue status done / status.md / experiment-log。
