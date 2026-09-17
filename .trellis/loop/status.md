# 自循环状态

- 当前任务：T-038（P-11/P-12/P-13/P-14/P-15 + O-06/O-07 七条文案与展示小项打包）——Plan/Implement/Verify/Finish 走完，`gate: none`，已按任务 notes 直推 origin/codex/release-v0.3.6，`status` 改 `done`。七条：①复测原因句改「这次建议的原因」（两处本就取不同字段）；②学习风格取值由后端映射中文（新字段 `learning_style_labels`，原 code 只进 `title`，对方 code 表确认后核对）；③合成 fixture 单位 `count`→`次`；④`date()` 零填充到分钟 + 新增 `dateOnly()`，阶段报告卡与成长观察窗口同口径；⑤成长观察加一行来源说明；⑥运营端家庭列表「家长」列空姓名给「未填写」（新增 `account_name` 过滤器，不再与相邻「手机号」列重复）；⑦首页标签改「近 7 天新建档案（含已归档）」。验证：先失败证据（回退源码后 `2 failed`（`KeyError: learning_style_labels`）+ `3 failed, 3 passed`）→ 修复后 `2 passed` / `6 passed`；前端 `npm run check` exit 0、`test:unit` `65 pass / 0 fail`；真实 Chrome 新增 `tests/t038-copy-and-format.spec.js` `3 passed (43.7s)` + 回归 12 项全过；`ruff` 干净；`audit_documents.py` errors `[]`；截图 10 张。**两处如实记录**：本地开发 Celery Worker 是旧进程（校验旧 `count`），首轮浏览器验收因此报 `UPSTREAM_SCHEMA_INVALID`，重启本地 Worker 后通过（Beat 未重启）；`tests/flows.spec.js` 本轮未跑绿——本地短信频控「验证码请求过多」（按客户端 IP 1 小时 ≥50 次）被本轮多次验收用满，与本轮改动无关，窗口过后可复跑。详见 `.trellis/tasks/T-038/report.md`。
- 上一个任务：T-037（复测回写 500 的模型根因 + 前端失败落点 + 5xx 文案）——已 push，`status` `done`。
- 最近 5 轮（取自 `runs.log`，采样于本 worker 收尾提交前；本轮 T-038 的 `ROUND … DONE` 行由驱动在本 worker 退出后写回）：

| 任务 | 结果 | 耗时 | 提交 | 备注 |
| --- | --- | --- | --- | --- |
| T-034 | DONE | 982s | 4a249de | 成长周期报告，真实 Chrome 1 项 11 步，已 push |
| T-035 | DONE | 2301s | 677c769 | 复测 CTA 与回写闭环，真实 Chrome 3 项，已 push |
| T-024 | GATED | 1594s | 43a68e4 | 巡检 backlog（家长端 6 + 运营端 2 + 稳定性 1），已复看导入 T-037/038/039 |
| T-037 | DONE | 1193s | 9da2a05 | 复测回写 500 根因 + 失败落点 + 5xx 文案，已 push |
| T-038 | DONE | — | d39c37a | 本轮：七条文案与展示小项，真实 Chrome 3 项 + 回归 12 项，已 push |

- 累计（`runs.log` 已记录 46 轮，本轮 DONE 行待驱动写回后变 47）：DONE 30 / RATE_LIMITED 13 / GATED 2 / FAIL 2。
- 待 orchestrator 处理的事：有，三条。
  1. **`REQUEST T-028 external`（09-17 15:24Z）仍待放行**：给 DingDong 的澄清清单已就绪，发送属 external 动作，需 Yihu 放行后由人执行。
  2. **T-038 的 P-12 用的是「我方按取值直译」的中文对照**（imitation→模仿 / open→开放 / reverse→逆向 / cognitive→认知），对方 code 表拿到后要核对；该问题已在 T-028 确认级 C6 里。
  3. **`tests/flows.spec.js` 本轮未跑绿**（本地短信频控用满，非代码问题）：需在频控窗口过后复跑一次补上「探索 / 旅程 / 删除流程 / 移动端布局」这几页的回归证据。
- 下一步：驱动取下一个 `todo`（T-039：T-033/T-034 三条范围判定落定 + 过期截图刷新）；T-028 保持 `gated` 不动。

## 驱动告警
- 需 orchestrator：T-031 连续失败 2 次，已自动标 blocked（2026-09-17T14:22:17Z）。（orchestrator 14:25Z 已解锁、T-031 已 done；按 prompt「原样保留」未改本节。）
