# 09-20-parent-copy-cleanup 测试报告：家长端文案清理 · 完整前后端 GUI 重测

- 日期：2026-09-20
- 分支：codex/release-v0.3.6
- 方式：真实 Chrome 有头浏览器（Playwright，不拦截、不伪造任何接口响应）
- Jev：`jev-latest`（jev-1.13.0）——run2 时 key 未设（9 项 SKIP），run3 从 shell 配置加载 key 后补跑，9 项全部真实判定并通过
- 证据：截图 `/tmp/t046-gui-shots/`、`summary.json`（run3 覆盖）、日志 `/tmp/t046_gui_full_run3.log`
- 测试脚本：`/tmp/t046_full_gui_test.mjs`（30 项：21 门禁 + 9 Jev）

## 一、清理范围（本轮新增修复）

前一会话已完成 app.js 11 处、growth-cycle.js 1 处、seed.py/robot.py/tasks.py、9 个 spec 断言。本轮完整重测发现并追加修复：

| 位置 | 问题 | 修复 |
|---|---|---|
| `seed_mock.py:93` | 活动标题带「[合成测试]」前缀（8 个已发布活动） | 去前缀 |
| `seed_mock.py:100` | 活动 goal 含「（测试活动）」 | 去后缀 |
| `uploads.py:78` | 家长可见错误文案「当前仅允许指定合成测试图片」 | 改「样例图片不符合要求，请重新提交」 |
| `smoke_http.py:37` | 冒烟脚本建档名「HTTP合成测试儿童」（家长端可见） | 改「HTTP 冒烟儿童」 |
| DB `ActivityContentVersion`×8 | 已发布活动 title/goal 残留 | queryset update 修正 |
| DB `ReportTemplateVersion`×2 | initial-report「合成测试观察」/stage-report「合成阶段观察」+ 测试 intro | update 为「成长观察」「阶段成长观察」 |
| DB `QuestionnaireVersion` | initial-assessment「日常探索问卷（流程测试）」 | 去后缀 |
| 测试脚本 | S7-d 扫描正则命中以上三路由残留；`#reports` 选择器不存在 | 修复来源后改用 `#main` |

注：ops/labels.py「清理合成测试数据」等词条属运营侧词汇，不在家长端清理范围（用户拍板口径：家长端页面）。

## 二、门禁结果

### 1. 静态门禁（全部通过）

- `npm run check` ✓（前一轮，文案修改后）
- `npm run test:unit`（67 tests）✓
- `ruff check`（seed_mock.py / uploads.py / smoke_http.py）✓；`ruff format` ✓（uploads.py 的 except 括号格式为 HEAD 已存问题，非本轮引入，已核实 `git show HEAD` 复现）
- `audit_documents.py` ✓、`manage.py check` ✓
- 全量 Playwright 批次：26/26 ✓（前一轮）
- 本轮追加复核 5 个受影响 spec（flows / reassessment-cta / t038 / companion-panel / growth-cycle-panel）：**17/17 ✓**

### 2. 完整 GUI 测试（run3：30 项全部通过，0 SKIP）

| 场景 | 覆盖 | 结果 |
|---|---|---|
| S1 登录建档 | 手机号+验证码登录、儿童建档 | 2/2 |
| S2 探索四题 | 答题提交、结果页（Jev×5 ✓） | 6/6 |
| S3 活动闭环 | 全流程、旅程页记录（Jev×2 ✓） | 3/3 |
| S4 机器人绑定 | NFC 绑定、凭据核验、同步授权 | 2/2 |
| S5 人设卡（P-20 保持） | 正文话术、title 收纳（Jev ✓） | 4/4 |
| S6 22 题测评 | 同意承接、答题、真实 Celery 报告 | 3/3 |
| S7 家长端路由 | 七路由标题、**文案零残留（S7-d 新门禁）**、Jev 复验 ✓、390×844 无溢出、无 JS 错误 | 5/5 |
| S8 运营后台 | 登录、首页、四列表页、登出、无 JS 错误 | 5/5 |

**S7-d（本轮核心验收）**：七个家长端路由逐页 `body.innerText` 扫描 `/合成|本地测试|测试环境|合成样例/` —— 全部为 0 命中。清理前同一门禁在「今日陪伴/成长旅程/测评与报告」三个路由命中「合成」（来自 DB 活动/模板残留），修复后通过。

### 3. Jev 复验（run3 补跑，9/9 通过）

key 从 shell 配置加载（仍不落盘进仓库）。逐项数值：

| 项 | 判定 | 数值 |
|---|---|---|
| S2-jev-1..4（四题适合儿童） | ✓ | noul=0.02 / 0.02 / 0.02 / 0.03 |
| S2-jev-style（探索体验风格） | ✓ | choice=exploration |
| S3-jev-age（活动适宜发布） | ✓ | score=1.97 |
| S3-jev-safe（活动内容安全） | ✓ | noul=0.02 |
| S5-jev-jargon（无违禁话术/代号直出，产品验收口径） | ✓ | noul=0.05 |
| S7-jev-copy（页面无测试字样泄露） | ✓ | noul=0.06 |
| S7-jev-简洁度（供归因不作门禁） | — | score=1.54（p: 0.08/0.29/0.63，偏「简洁清晰」档） |

严格口径如实记录：S5 测试严格口径 noul=0.89（逐句诊断已证纯日期行「绑定于 2026/09/01 02:05」也 0.89，归因 bind_line p=0.56），产品验收口径 0.05 通过；两者在脚本里分开提问，门禁只取产品验收口径。

## 三、结论

- 家长端文案清理验收通过：所有路由页面零「合成/本地测试/测试环境」字样（S7-d 脚本断言 + Jev S7-jev-copy noul=0.06）。
- 冒长免责精简到位（匹配度、数据来源、代理量均一句以内）。
- 功能回归无损：21 项门禁全过、受影响 specs 17/17、无 JS 错误、移动端无横向溢出。
- **run3 全量 30/30 通过（21 门禁 + 9 Jev，0 SKIP）**，任务验收标准里的「28 项 GUI + Jev 复验」全部闭环。
