# 自循环状态

- 当前任务：T-019（O-02 家长姓名为空时 5 处运营界面回落手机号）已完成实现/验证/提交/push（`[T-019]` 提交 `2c00ac1`，远端 sha `2c00ac1d3208ac4e574eaebe21f7b0e0540ebc4f`），收尾记录提交紧随其后同一轮再推。修复：`User.display_name` property（`name → 家长phone → username`），模板 `display_name` 过滤器、审计 `describe_target`、家庭标签 `_family_label` 三处共用。
- 上一个任务：T-018（S-05 本地 e2e 数据漂移变可判定）——FAIL（rc=143，驱动 2406s 超时杀），工作区遗留未提交改动，queue 仍 `doing`，见下方待处理。

- 最近 5 轮（取自 `runs.log`，采样于本 worker 收尾提交前；本轮 T-019 的 DONE 行由驱动在本 worker 退出后写回）：

| 任务 | 结果 | 耗时 | 提交 | 备注 |
| --- | --- | --- | --- | --- |
| T-015 | DONE | 697s | ad78a47 | O-04 机器人账户行 |
| T-016 | DONE | 346s | 0b6b6fe | P-03 同意框四要素 |
| T-017 | DONE | 546s | 9b96c4d | G-02 来源声明 |
| T-018 | FAIL | 2406s | fceab02 | rc=143 超时杀，工作区未收尾 |
| T-019 | RATE_LIMITED | 802s | 7ee99a7 | PRIMARY 限流；本轮由 FALLBACK 完成 |

- 本轮（T-019）验证数字：TDD 红 `3 failed, 57 deselected in 18.42s` → 绿 `3 passed, 57 deselected in 19.70s`；验收 3 文件 `60 passed in 192.05s (0:03:12)`；真实 Chrome `1 passed (12.5s)` 5 处截图；`audit_documents.py` errors `[]`；`ruff check` All checks passed；`manage.py check` 无问题。
- 累计（`runs.log` 已记录 25 轮）：DONE 18 / RATE_LIMITED 5（T-004、T-007、T-008、T-009、T-019）/ GATED 1（T-002）/ FAIL 1（T-018）。
- 待 orchestrator 处理的事：有 1 条——T-018 卡在 `status: doing` 且最后一次运行 FAIL（rc=143 超时杀）：工作区遗留未提交改动 `frontend/tests/flows.spec.js`、`frontend/deployment-tests/ops-public.spec.js`、`frontend/tests/support.js`、`.trellis/spec/frontend/testing-and-acceptance.md` + 未跟踪 `.trellis/tasks/T-018/`（含 progress/report/证据）；驱动只取第一个 `todo`、不会自动续跑 `doing`，需 orchestrator 把 T-018 重置回 `todo`（走核对式续跑）或人工收尾。本轮未触碰这些文件、未混入 T-019 提交。
- 下一步：队列下一个 `todo` = T-020（S-04 阶段画像/同步失败在家长端可见性，第二批可直推）。
