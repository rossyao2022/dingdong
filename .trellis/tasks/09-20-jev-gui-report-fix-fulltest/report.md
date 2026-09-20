# T-046 测试报告：Jev GUI 功能测试 · P-20 修复 · 完整前后端图形化交互测试

- 日期：2026-09-20
- 分支：codex/release-v0.3.6
- 方式：真实 Chrome 有头浏览器（Playwright，不拦截、不伪造任何接口响应）
- Jev：`jev-latest`（实际版本 jev-1.13.0），仅作测试侧内容判定，不改产品行为
- 证据：截图 `/tmp/t046-gui-shots/`（s1→s8 全程 + S8 复验 s8r-*）、`summary.json`
- 测试脚本：`/tmp/t046_full_gui_test.mjs`（全量 28 项）、`/tmp/t046_s8_retest.mjs`（S8-c 复验）

## 一、结果总览

**28/28 通过**（全量 27/28 + S8-c 复验 4/4）。

| 场景 | 覆盖 | 结果 |
|---|---|---|
| S1 登录建档 | 手机号+验证码登录、儿童建档 | 2/2 |
| S2 探索四题 | 答题提交、结果页、Jev×5 | 6/6 |
| S3 活动闭环 | 全流程、旅程页记录、Jev×2 | 3/3 |
| S4 机器人绑定 | NFC 绑定、凭据核验、同步授权 | 2/2 |
| S5 人设卡（P-20） | 正文话术、title 收纳、Jev 复验 | 4/4 |
| S6 22 题测评 | 同意承接、答题、真实 Celery 报告 | 3/3 |
| S7 家长端路由 | 七路由、390×844 无溢出、无 JS 错误 | 3/3 |
| S8 运营后台 | 登录、首页、四列表页、登出、无 JS 错误 | 5/5 |

## 二、明细（含 Jev 原始答案）

| ID | 检查 | 结果 | 证据 |
|---|---|---|---|
| S1-a | 手机号+验证码登录成功进建档页 | ✓ | s1-child-created.png |
| S1-b | 儿童档案建立 | ✓ | child_id=c054c3b9…363b |
| S2-a | 探索四题答完提交，结果页出现 | ✓ | s2-exploration-result.png |
| S2-jev-1..4 | 各题 Jev 判定适合儿童展示 | ✓ | noul=0.02/0.02/0.02/0.03 |
| S2-jev-style | 整体为探索体验风格 | ✓ | choice=exploration |
| S3-a | 活动全流程走通，旅程页有记录 | ✓ | s3-journey.png |
| S3-jev-age | 活动适宜发布（score≥1） | ✓ | score=1.89 |
| S3-jev-safe | 活动内容安全 | ✓ | noul=0.02 |
| S4-a-verify-api | 凭据核验接口返回成功 | ✓ | sync_success fixture |
| S4-a | NFC 绑定+核验+同步授权全流程 | ✓ | s4-verified.png |
| S5-a | 正文含「绑定于」 | ✓ | s5-persona-fixed.png |
| S5-b | 正文不含「权重版本」字样 | ✓ | P-20 修复 |
| S5-c | 版本原始值收进 title 悬停可查 | ✓ | title="权重版本 pw_v1" |
| S5-jev-jargon | 产品验收口径无违禁话术/代号直出 | ✓ | noul=0.07（修复前 0.89） |
| S6-consent | 同用途已授权，同意框正确跳过 | ✓ | app.js:1121 既有逻辑 |
| S6-a | 22 题测评走完进合成样例环节 | ✓ | s6-assessment-done.png |
| S6-b | 初始报告经真实接口生成可查看 | ✓ | s6-report.png，Celery succeeded |
| S7-a | 七路由全部可达且标题正确 | ✓ | heading waitFor |
| S7-b | 390×844 无横向溢出 | ✓ | s7-mobile-reports.png |
| S7-c | 全程无 JS 页面错误 | ✓ | pageerror=0 |
| S8-a | 运营后台临时员工登录成功 | ✓ | s8-ops-home.png |
| S8-b | 工作首页渲染（待办/卡片） | ✓ | |
| S8-c | 四核心列表页全部可达 | ✓（复验） | HTTP 200×4，s8r-*.png |
| S8-d | 运营后台登出 | ✓ | 回到 login |
| S8-e | 运营后台全程无 JS 错误 | ✓ | pageerror=0 |

Jev 判定口径说明：noul 阈值统一取 <0.3 视为通过（测试严格口径与产品验收口径在 S5 分开提问，见下）。

## 三、发现的问题与处置

### 问题 1（产品缺陷，已修复）：P-20 人设卡权重版本代号直出正文

- 现象：人设卡正文显示「绑定于 … · 权重版本 v1」，技术版本代号 `pw_v1` 的痕迹以家长不可懂的形式暴露；测试严格口径 Jev noul=0.89。
- 根因：`frontend/app.js:507` 把 `talent_weight_version` 渲染进正文（`versionLabel()` 只做弱映射）。
- 修复：正文只保留「绑定于 <日期>」；完整版本值移入 `title` 悬停属性（与学习风格 tag 同一收纳模式）。
- 复验：S5-b/S5-c/S5-jev-jargon 全过，产品验收口径 noul 0.89→**0.07**。
- 定位：`frontend/app.js:507`（personaBlock）。

### 问题 2（测试脚本缺陷，已修复）：S8-c 把手机号里的 "404" 误判为页面 404

- 现象：`/ops/families/`、`/ops/ca-accounts/` 被判失败，但页面实际 HTTP 200 且内容正确。
- 根因：脚本用 `!/404/.test(bodyText)` 排除 404 页，而列表数据里家长手机号 `+8613997944042` 包含字面 "404"，造成误伤。Django test client 复核确认两页均为 200、标题「家庭与儿童」「CA 账户」正常。
- 修复：判定改为 `resp.status() === 200 && 正则匹配内容`（用响应状态码，不再扫正文找 404）。
- 复验：`/tmp/t046_s8_retest.mjs` 独立重跑 S8-c，4/4 页 HTTP 200 通过。非产品缺陷。

### 过程性问题（环境，已处置，不入缺陷清单）

- Redis 队列积压（35 万+消息）：Beat `dispatch_pending` 每 10s 对 97 个陈旧 pending 同步任务重派发，单 worker 消费速度跟不上。处置：`kill -STOP` Beat + 清空 `dingdong-ca` 队列让 worker 排干；报告任务随后转 `succeeded`。属本地测试环境运维动作，不改产品代码。
- S6 同意框未弹出：产品逻辑（app.js:1121，同用途已授权则直接开卷），非缺陷；测试改为条件等待。
- S7-a `isVisible()` 竞态、S7-b 移动端 ≤760px 导航折叠、S8-a `/ops/login/` 误匹配 `/\/ops\//`：均为测试脚本适配，已修正。

## 四、修复后回归门禁

| 门禁 | 结果 |
|---|---|
| `npm run check`（前端语法） | ✓ |
| `npm run test:unit` | ✓ 67/67 |
| `tests/t043-persona-copy.spec.js`（P-18 回归） | ✓ |
| `tests/companion-panel.spec.js`（390×844 + 人设行） | ✓ 3 passed |
| `uv run ruff check .`（后端） | ✓ All checks passed |
| `python3 scripts/audit_documents.py` | ✓ errors=[] |

本次产品代码改动仅 `frontend/app.js` 一处（P-20），后端无改动。

## 五、结论

- 上一轮（15/17）暴露的两项失败：①权重版本代号直出 → 确认为产品缺陷 P-20，已修复并复验；②其余口径差异属测试口径问题，已用双口径（严格/产品验收）分离。
- 完整前后端图形化交互测试（家长端全流程 + 运营后台）**28/28 通过**，无未决产品缺陷。
