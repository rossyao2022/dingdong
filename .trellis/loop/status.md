# 自循环状态

- 当前任务：T-027（存量测试文件过 ruff format）——Plan/Implement/Verify/Finish 全走完，`status` 改 `done` 并已 push。唯一格式差异是 `backend/tests/test_ops_audit_scope.py` 末尾缺行尾换行（改前 `ruff format --check --target-version py313` 报 `unformatted --> tests/test_ops_audit_scope.py:275:36`），`git diff` 只有 1 处（`\ No newline at end of file` → 有换行），断言行一字未动。详见 `.trellis/tasks/T-027/report.md`。
- 上一个任务：T-026（刷新 T-012 三张入库截图）——已完成并 push；其 report 推翻的两处前提（写图用例是 `robot-label.spec.js` 而非 `ca-account.spec.js`；「截图相对当前代码已过期」不成立）仍作为认知更正有效。

- 最近 5 轮（取自 `runs.log`，采样于本 worker 收尾提交前；本轮 T-027 的 DONE 行由驱动在本 worker 退出后写回）：

| 任务 | 结果 | 耗时 | 提交 | 备注 |
| --- | --- | --- | --- | --- |
| T-019 | RATE_LIMITED | 802s | 7ee99a7 | PRIMARY 限流 |
| T-019 | DONE | 1248s | 715979c | FALLBACK 完成 |
| T-020 | RATE_LIMITED | 321s | e84e00b | PRIMARY 限流 |
| T-020 | DONE | 933s | 55d17d7 | FALLBACK 完成 |
| T-026 | DONE | 616s | 3966cb0 | PRIMARY 完成 |

- 本轮（T-027）验证数字：`uv run ruff format --check --target-version py313 tests/test_ops_audit_scope.py` → `1 file already formatted` rc=0；`uv run ruff check tests/test_ops_audit_scope.py` → `All checks passed!` rc=0；`uv run pytest tests/test_ops_audit_scope.py` 改前 `12 passed in 49.07s` → 改后 `12 passed in 46.87s`（原文 `pytest-before.txt` / `pytest-after.txt`）；`python3 scripts/audit_documents.py` → `errors: []`。本任务只与「格式化前基线」比对：T-014 记录该文件 `11 passed`，T-019 又加过用例，故历史数字不沿用。
- 累计（`runs.log` 已记录 29 轮，本轮 DONE 行待驱动写回后变 30）：DONE 21 / RATE_LIMITED 6 / GATED 1 / FAIL 1。
- 待 orchestrator 处理的事：有，五条。
  1. **T-020 的两笔提交仍待复核**（`ed61449` 用例 + `55d17d7` 收尾记录，原经 T-026 push 连带推上远端 `e84e00b..979c145`）。T-020 notes 原标注「未 push，留待 orchestrator 复核后主会话 push」，push 语义推整个分支、非越权单推，已在 `gates.md` EXECUTED 行标明。
  2. **T-008 截图是真漂移，建议另开证据保鲜任务**：`ca-account.spec.js` 会重写 `.trellis/tasks/T-008/shots/empty-credential.png`（197704→188099 字节，可见差异 199203 px 遍布整页，成因是弹窗背后页面滚动位置变化，弹窗文案一致）。T-026 轮已 `git checkout --` 还原，重跑该用例即可复现。
  3. **新：全后端仍有 1 个文件未过 ruff format**——`uv run ruff format --check --target-version py313 .` 报 `1 file would be reformatted, 125 files already formatted`，未格式化者为 `dingdong_ca/core/api/common.py:189`（`name = getattr(...) or ...` 换行风格）。该文件 HEAD 上即如此、工作区干净，最后一次改动它的是 T-019 提交 `2c00ac1`；T-027 acceptance 只覆盖 `tests/test_ops_audit_scope.py`，按范围纪律未顺手改，建议另开一个存量格式化任务。
  4. T-020 注入的合成数据（儿童/家庭/家长/关联/阶段画像/报告/后台任务明细见 `.trellis/tasks/T-020/report.md`）留待按「只做状态变更、不物理删除、补写审计」方式清理。
  5. 认知更正：T-017 report 里「跑 `ca-account.spec.js` 会重写 T-012 三张截图」与「T-012 入库截图相对当前代码已过期」两句均不成立（见 T-026 report），后续引用请以 T-026 report 为准。
- 下一步：队列下一个 `todo` = T-021（四个展示面设计文档，gate=review，逐条申请不直推）。其后 T-028（DingDong 澄清清单，gate=external）、T-024（常设巡检，gate=review）。
