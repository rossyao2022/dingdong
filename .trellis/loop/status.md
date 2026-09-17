# 自循环状态

- 当前任务：T-021（G-01-设计 四个展示面设计文档）——Plan/Implement/Verify/Finish 走完，**只写 `.trellis/tasks/T-021/design.md`，无代码改动**；`status` 改 `gated`，已在 `gates.md` 申请段追加 `REQUEST T-021 review`。设计要点：合成数据源放后端服务层（新开关 `CA_DISPLAY_DATA_SOURCE`，`api/ca_display.py` → `services/ca_display.py` → `test_fixture` 表或 `dingdong_client`），扩 `inject_fixture` 新增 6 场景对应 xlsx 表 6 的 6 个 mock 账号；可用性词表复用 `growth.py` 既有 7 值；健康度四态按 xlsx 表 7.1 的 H01–H07（`insufficient_data`/`normal`/`watch`/`reassess`），`switch_candidate`/`keep_current` 不当作健康度状态；`auto_switch` 始终 `false`。建议实现任务 A（数据层+接口）/ B（人设+健康度）/ C（成长报告）/ D（复测 CTA）。详见 `.trellis/tasks/T-021/report.md`。
- 上一个任务：T-027（存量测试文件过 ruff format）——已完成并 push（远端 sha `a9d00de`）。

- 最近 5 轮（取自 `runs.log`，采样于本 worker 收尾提交前；本轮 T-021 的 DONE 行由驱动在本 worker 退出后写回）：

| 任务 | 结果 | 耗时 | 提交 | 备注 |
| --- | --- | --- | --- | --- |
| T-019 | DONE | 1248s | 715979c | FALLBACK 完成 |
| T-020 | RATE_LIMITED | 321s | e84e00b | PRIMARY 限流 |
| T-020 | DONE | 933s | 55d17d7 | FALLBACK 完成 |
| T-026 | DONE | 616s | 3966cb0 | PRIMARY 完成 |
| T-027 | DONE | 310s | b533410 | PRIMARY 完成 |

- 本轮（T-021）验证数字：`python3 scripts/audit_documents.py` → `{"markdown_files": 80, "local_links_checked": 497, "archived_files_checked": 85, "operations": 55, "schemas": 65, "errors": []}`；`git diff --stat` → `.trellis/loop/queue.md | 2 +-` 与 `.trellis/loop/runs.log | 4 ++++`（驱动追加），`frontend/`、`backend/`、`设计/API/openapi.json` 零改动。本轮无代码，故无测试类数字。
- 累计（`runs.log` 已记录 30 轮，本轮 DONE 行待驱动写回后变 31）：DONE 22 / RATE_LIMITED 6 / GATED 1 / FAIL 1。
- 待 orchestrator 处理的事：有，三条。
  1. **T-021 设计文档待复看**（`gate: review`，第三批逐条申请）。复看要点：四个面的数据形状与既有 `growth.py` 词表是否对齐、合成数据源放后端服务层的判断是否认可、建议的 4 个实现任务拆分粒度是否合适。批了再导入实现任务。
  2. **设计 §6 有 5 条新待澄清项**（`new_assessment_id` 取值语义与幂等窗口、`persona_health.status` 权威枚举是否含 `insufficient_data`、`persona_type`/`learning_style_tags` 的 code 表、八维全可空时是否允许部分返回、`persona_switched` 由谁写）。本轮**未改**澄清清单文件（起草属 T-028 范围），请决定是否并入 T-028 清单。
  3. **两条如实记录的边界，供复核时留意**：①四个展示面**不在** C1 §7 的 11 条清单内，属 C5/C6 提前设计；②§7 第 11 条「出站 8 个 DingDong 接口」仍只能由 D10 base URL / D12 key 解开——合成数据源跑通**不算** §7 完成，实现任务的 report 不得写成已完成。
- 已销项（上轮遗留）：T-020 两笔提交复核（gates.md `APPROVE T-020 push` 事后追认，账面闭合）；T-008 截图漂移 → T-029；`core/api/common.py` ruff format → T-031；T-020 合成数据清理 → T-030。T-017/T-026 的认知更正仍有效：T-017 report 里「跑 `ca-account.spec.js` 会重写 T-012 三张截图」与「T-012 入库截图相对当前代码已过期」两句均不成立，引用以 T-026 report 为准。
- 下一步：队列下一个 `todo` = T-029（刷新 T-008 漂移截图，gate=none，机制维护类可直推）。其后 T-030、T-031（均 gate=none）、T-028（DingDong 澄清清单，gate=external）、T-024（常设巡检，gate=review）。
