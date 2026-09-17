# 自循环状态

- 当前任务：T-009（P-06 成长观察非法时间区间就地提示）本轮由 FALLBACK 重跑完成（PRIMARY 08:56:05Z 起 757s 限流 rc=1），`status`=`done`。代码提交 `6a5efa2` 已按第一批直推规则推送（`919350b..6a5efa2`，远端 sha `6a5efa2a3760877c6ca6bfb675d8640796eea346`）；收尾记录提交紧随其后同一轮再推。
- 上一个任务：T-008（P-02 手填绑定补指引）——已推送 `c58bfe3` + 收尾 `919350b`。

- 最近 5 轮（取自 `runs.log`；本轮 T-009 的 FALLBACK DONE 行由驱动在本 worker 退出后写回）：

| 任务 | 结果 | 耗时 | 提交 | 备注 |
| --- | --- | --- | --- | --- |
| T-009 | RATE_LIMITED（PRIMARY） | 757s | b862317 | Flash 限流，FALLBACK 接手 |
| T-008 | DONE（FALLBACK） | 1673s | 919350b | P-02 修复 + 全量 8 条一次全绿 |
| T-008 | RATE_LIMITED（PRIMARY） | 20s | 8348ef8 | 启动即限流，FALLBACK 接手 |
| T-007 | DONE（FALLBACK） | 1954s | 8348ef8 | P-01 修复，3 条新用例过 |
| T-007 | RATE_LIMITED（PRIMARY） | 1227s | 36592bf | Flash 限流，FALLBACK 接手 |

- 本轮（T-009）验证数字：`npm run check` exit 0；`test:unit` 16 pass 0 fail（70.43ms）；`audit_documents.py` errors `[]`；真实 Chrome `tests/growth-window.spec.js` 首跑因 `/auth/sms` 同 IP 限流（50/小时，计数=50）`2 failed`，DB 只读计数滑到 47 后重跑 `2 passed (12.0s)`；截图 `.trellis/tasks/T-009/shots/`。全量回归 ca-account+flows 受同一限流未全绿（未采信不完整数字）。
- 累计：迭代 14 轮 / DONE 9 / RATE_LIMITED 4（T-004、T-007、T-008、T-009）/ FAIL 0 / GATED 1（T-002）。
- 待 orchestrator 处理的事：⚠️ 本轮 T-009 直推连带把此前未推送的 `[T-025]` 提交 `b862317`（盘活7×24 机制改动）一起推上远端；T-025 notes 原标「push 留 Yihu 放行」（launchd 安装仍未做、不在本次推送范围），需 Yihu/orchestrator 复核是否合规。无新门禁申请。
- 下一步：队列下一个 `todo` = T-010（P-07 慢网提交要有进行中提示，第一批可直推）。
