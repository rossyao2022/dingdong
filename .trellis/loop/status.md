# 自循环状态

- 当前任务：T-017（G-02 产品内加一行视觉与插画来源声明）已完成，`status`=`done`。「家长支持」页新增 `SOURCE_CREDIT` 声明行，修复提交 `10d4353` 已按第一批直推规则推送（`0b6b6fe..10d4353`，远端 sha `10d435392442a35d8761a1a920f786c9170e8fa9`）；收尾记录提交紧随其后同一轮再推。
- 上一个任务：T-016（P-03 测评授权同意框补齐四要素）——已推送 `92827af` + 收尾 `ea06a2f`。

- 最近 5 轮（取自 `runs.log`；本轮 T-017 的 DONE 行由驱动在本 worker 退出后写回）：

| 任务 | 结果 | 耗时 | 提交 | 备注 |
| --- | --- | --- | --- | --- |
| T-016 | DONE（PRIMARY） | 346s | 0b6b6fe | P-03 同意框四要素 + 1 条新用例过 |
| T-015 | DONE（PRIMARY） | 697s | ad78a47 | O-04 机器人账户行 + 1 条新用例过 |
| T-014 | DONE（PRIMARY） | 1800s | 0a77472 | O-03 对象词条 + 2 条新用例过 |
| T-013 | DONE（PRIMARY） | 887s | 11ad793 | P-04 版本 code 文案 + 2 条新用例过 |
| T-012 | DONE（PRIMARY） | 767s | 9cd1af5 | P-09 文案 + 1 条新用例过 |

- 本轮（T-017）验证数字：TDD 红 `1 failed`（`locator('[data-source-credit]')` element(s) not found）→ 绿 `1 passed (8.2s)`；临时 7 路由巡检 `1 passed (6.7s)`（声明只在 services 页，跑完已删）；回归 `ca-account.spec.js` + `robot-label.spec.js` `9 passed (1.1m)`；`npm run check` exit 0；`test:unit` 16 pass 0 fail（75.833209ms）；`audit_documents.py` errors `[]`；截图 3 张在 `.trellis/tasks/T-017/shots/`（桌面、390×844 全页、390×844 滚到底）。回归跑重生成的 T-012 三张截图已 `git checkout --` 还原，未混入本轮提交。
- 累计（`runs.log` 已记录 22 轮）：DONE 17 / RATE_LIMITED 4（T-004、T-007、T-008、T-009）/ GATED 1（T-002）/ FAIL 0。
- 待 orchestrator 处理的事：⚠️ 仍未闭环——T-009 直推时连带把此前未推送的 `[T-025]` 提交 `b862317`（盘活7×24 机制改动）推上远端，T-025 notes 原标「push 留 Yihu 放行」（launchd 安装仍未做），需 Yihu/orchestrator 复核是否合规。另三条供后续轮次参考：①T-019 的 5 处清单未含审计「对象」副行（家长未填姓名时仍显示 `parent-<uuid>`，O-02 同类回落），是否并入由 orchestrator 决定；②存量 `backend/tests/test_ops_audit_scope.py` 未过 `ruff format --check --target-version py313`（T-014 遗留），需要时另开任务；③本轮新发现——`.trellis/tasks/T-012/shots/` 三张入库截图相对当前代码已过期（重跑 `ca-account.spec.js` 会重写出可复现的不同内容，已验证与 T-017 改动无关），是否刷新由 orchestrator 决定。本轮无新增门禁申请，无新 blocked 任务。
- 下一步：队列下一个 `todo` = T-018（S-05 本地 e2e 4 项数据漂移失败变成可判定，第二批可直推）。
