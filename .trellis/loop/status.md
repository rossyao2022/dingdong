# 自循环状态

- 当前任务：T-008（P-02 手填绑定补指引与空凭据就地校验）本轮由 FALLBACK 重跑完成（PRIMARY 08:26:06Z 限流 rc=1），`status`=`done`。代码提交 `c58bfe3` 已按第一批直推规则推送（`8348ef8..c58bfe3`，远端 sha `c58bfe32aec5d01ad9156da66b188b03bc568308`）；收尾记录提交紧随其后同一轮再推。
- 上一个任务：T-007（P-01 绑定成功停在账户页并高亮新号）——已推送，`1770127` + 收尾 `8348ef8`。
- 最近 5 轮（取自 `runs.log`；本轮 T-008 的 DONE 行由驱动在 worker 退出后写回）：

| 任务 | 结果 | 耗时 | 提交 | 备注 |
| --- | --- | --- | --- | --- |
| T-022 | DONE | 631s | 531737e | 收尾钩子四场景实测 |
| T-023 | DONE | 521s | 36592bf | ORCHESTRATOR.md 入库 + R0d 核对关闭 |
| T-007 | RATE_LIMITED→FALLBACK | 1227s+1954s | 8348ef8 | PRIMARY 限流，由 deepseek-v4-pro 重跑完成 |
| T-008 | RATE_LIMITED（PRIMARY） | 20s | 8348ef8 | PRIMARY 启动即限流，FALLBACK 接手 |
| T-008 | DONE（FALLBACK） | 本轮 | c58bfe3 | P-02 修复 + 全量 8 条一次全绿 |

- 本轮（T-008）验证数字：`npm run check` exit 0；`test:unit` 16 pass 0 fail；`audit_documents.py` errors `[]`；真实 Chrome 新用例 1 条 `1 passed (4.9s)`，全量 `tests/ca-account.spec.js` `8 passed (51.4s)` 一次全绿；截图 `.trellis/tasks/T-008/shots/empty-credential.png`。验证中途撞一次 `/auth/sms` 同 IP 限流「验证码请求过多」（本地经 ssh 隧道连 dev 库、1 小时 50 次），只读查询确认计数 48→47→44 随窗口滑落、未重置远端库。
- 累计：迭代 9 / 失败 0 / 限流 3（T-004、T-007 PRIMARY、T-008 PRIMARY；本轮退出后驱动再记一轮 DONE，计数随后 +1）。
- 待 orchestrator 处理的事：无门禁申请。工作区有两个非本轮的未跟踪文件 `scripts/loop-watchdog.sh`、`scripts/com.yihu.dingdong.loop-watchdog.plist`，本轮未提交未改动，交由 orchestrator 处置。
- 下一步：队列下一个 `todo` = T-009（P-06 成长观察非法时间区间就地提示，第一批可直推）。
