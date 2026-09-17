# T-022 报告：驱动加「有新门禁申请或任务 blocked 时叫醒 orchestrator」的钩子

## goal

给 `scripts/worker-loop.sh` 加收尾钩子：每轮 worker 退出后，与本轮开工时的基线对比，若 `gates.md` 申请段新增了 REQUEST 行、或 `queue.md` 有任务被标为 `blocked`，就执行一次 `herdr agent prompt w0:p4 "查岗：读 .trellis/loop/ORCHESTRATOR.md 的门禁规则，处理 gates.md 新申请"`（不带 `--wait`）；该命令失败只记一行日志，不改变驱动退出码、不影响后续轮询。

## 实际做了什么

只改 `scripts/worker-loop.sh` 一个文件：

1. 新增 `loop_gate_snapshot()`：输出两行快照——`gates.md`「申请段」（`## 申请` 到 `## 决定` 之间）全部 REQUEST 行的 md5、`queue.md` 里 `status: blocked` 的任务 id 列表。
2. 新增 `wake_orchestrator()`：调 `herdr agent prompt "$ORCH_PANE" "$ORCH_WAKE_TEXT"`（不带 `--wait`，stdout/stderr 丢弃），rc=0 记 `WAKE OK`、否则记 `WAKE FAIL ... rc=N`，函数恒返回 0。
3. 新增 `notify_orchestrator_if_needed()`：收尾时再取一次快照，REQUEST 指纹变化或 blocked 列表出现新 id（集合差，避免「解锁 blocked」误触发）→ 调 `wake_orchestrator` 一次。
4. `run_round()`：开工处取基线存 `req_before` / `blocked_before`，`case "$result"` 之后调 `notify_orchestrator_if_needed`。每轮至多一次（单条 if + 单次调用）。
5. 新增两个环境变量：`LOOP_ORCH_PANE`（默认 `w0:p4`）、`LOOP_WAKE_CMD`（联调替代命令，默认走 herdr）；文件头注释补了钩子说明。所有新变量展开都用 `${var}`，避免 macOS bash 3.2 把紧跟全角字符的 `$var` 吞进变量名（R0d 卡点 12）。

测试证据（全部在 `.trellis/tasks/T-022/`）：假 grok（`fake-grok.sh`，只改状态文件不做真实任务）、假唤醒（`fake-wake.sh` 成功 / `fake-wake-fail.sh` 退出 3）、临时自测任务 T-095…T-099 的插入删除脚本、四个场景的驱动原始输出、`runs.log.after`（含自测轮次的原始日志）与 `runs.log.before`（测试前快照，其中已含首轮联调的自测行）。

## 验证命令与真实输出

- `bash -n scripts/worker-loop.sh` → exit 0（输出 `bash -n OK`）；全角变量扫描 → 无（修掉 `$reason、` 与 `$rc）` 两处）
- `TESTS=all bash .trellis/tasks/T-022/run-hook-tests.sh`（A 真 herdr + B + C，输出见 `hook-test-transcript.txt`）→ `=== 结果：TESTS=all PASS=13 FAIL=1 ===`
  - A（真 herdr，新增 REQUEST）：`[loop 07:19:16Z] 已叫醒 orchestrator（T-099 gates.md 新增 REQUEST）`、`PASS A runs.log 新增 1 条 WAKE 行`、`PASS A 未走假唤醒通道（假唤醒计数不变）`、`PASS A 驱动退出码 0`、`PASS A 钩子后驱动正常走到下一轮判定（日上限退出）`
  - 唯一 FAIL：`FAIL A orchestrator 面板 revision 增大（30→30）`。原因是断言在驱动退出瞬间读面板 revision，而 revision 异步刷新。事后 1 分钟核对（`pane-after-wake.txt`）：`w0:p4 rev=39 agent_status=working title=- Thinking - 叮咚 orchestrator 接任与 queue 唤醒任务 - grok`，即唤醒确实送达；runner 已改成轮询等 revision 超过开工前值（最多 15s）。
  - B（无门禁变化，两轮）：`PASS B 两轮都跑完（2 条轮次记录）`、`PASS B 未叫醒（runs.log 无新增 WAKE 行）`、`PASS B 假唤醒通道 0 次调用`、`PASS B 驱动退出码 0`
  - C（新出现 blocked）：`[loop 07:19:32Z] 已叫醒 orchestrator（T-096 新 blocked 任务 T-096）`、`PASS C runs.log 新增 1 条 WAKE 行`、`PASS C 假唤醒通道新增 1 次调用`、`PASS C 驱动退出码 0（钩子不影响驱动）`
- `TESTS=D bash .trellis/tasks/T-022/run-hook-tests.sh`（唤醒命令退出 3，追加在 transcript 末尾）→ `=== 结果：TESTS=D PASS=5 FAIL=0 ===`
  - `[loop 07:20:53Z] 叫醒 orchestrator 失败（rc=3），只记日志，继续轮询`；`runs.log` 末行 `2026-09-17T07:20:53Z WAKE FAIL T-095 gates.md 新增 REQUEST rc=3`；`PASS D 唤醒失败不阻断后续轮询（走到下一轮判定）`、`PASS D 驱动退出码 0`
- `TESTS=BC` 单独复跑一次 → `=== 结果：TESTS=BC PASS=8 FAIL=0 ===`
- 首轮 SMOKE 联调（`SMOKE=1 TESTS=A`，假唤醒）→ `PASS=3 FAIL=1`，FAIL 是断言 grep 错了位置（找 runs.log 文案而非驱动 stdout），已修断言后复跑通过；原始输出 `run-A-smoke.txt`
- `python3 scripts/audit_documents.py` → `{"markdown_files": 80, "local_links_checked": 497, "archived_files_checked": 85, "operations": 55, "schemas": 65, "errors": []}`
- `queue.md` 残留自测任务：0（`grep -c '驱动收尾钩子自测'` = 0）；`gates.md` 测试 REQUEST 行：1
- `runs.log` 清理：删除自测轮次 19 行（07:18 窗口 15 行 + 07:20 D 场景 4 行），保留 10 行；`git diff --stat .trellis/loop/runs.log` = `1 insertion(+)`（仅真实 T-006 轮次行）

## 未验证项

- 驱动自己 `mark_blocked`（同任务连续失败 2 次）产生的 blocked 是否也能唤醒：未单独跑该场景（走的是同一处快照对比逻辑；实测的是假 grok 直接标 blocked）。
- 真实 grok worker 自己往 `gates.md` 写 REQUEST 后触发唤醒：未跑真实任务，测试用的是假 grok 写同样格式的 REQUEST 行。
- 本轮在跑的驱动进程（pid 28928）仍按旧代码运行：bash 在执行 `while :; do … done` 前会整体解析该复合命令，改动只对下次启动的驱动生效。此推断未实测验证。
- 面板号变更（`w0:p4` 不再是 orchestrator）时的行为未测；`LOOP_ORCH_PANE` 可覆盖。

## 偏离与理由

- **只改了 `scripts/worker-loop.sh`**（遵守 notes 的单文件约束），因此 `.trellis/loop/README.md` 未同步钩子与两个新环境变量，留给 orchestrator 决定。
- **新增 `LOOP_WAKE_CMD` / `LOOP_ORCH_PANE`**：为了让 B/C/D 三个分支能在不真叫醒 orchestrator 的前提下实测（省 orchestrator 的 token）；A 场景仍用真 herdr，真唤醒一次已发生，orchestrator 面板当前为 working 状态。
- **自测任务 T-095…T-099 与 runs.log 清理**：测试必须真跑驱动，故临时插入自测任务、跑完删除；`runs.log` 里自测轮次行已清理（原始 post-test 日志留 `runs.log.after`），避免合成轮次长期占用每日上限计数与「最近 5 轮」。
- **测试 REQUEST 行留在 `gates.md` 申请段**（acceptance 要求），末尾带「T-022 钩子自测，可忽略」。
- **未更新 `PROJECT_MEMORY.md`**：该文件未记录自循环机制（`grep '自循环\|worker-loop'` 无命中），本次改动属 `.trellis/loop/` 内部机制。
- **未提交 `.trellis/loop/ORCHESTRATOR.md`**：orchestrator 自己的文件，不属本任务范围（T-006 收尾已在 status.md 记过待办）。
