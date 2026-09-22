# T-045 第五轮产品巡检 backlog

## 审计方式（可复核）

- 家长端：真实 Chrome（`channel=chrome`）走 `http://127.0.0.1:4173/`（任意手机号 + 验证码 `00000`）；1440×900 与 390×844 两种视口。本轮走「建档 → 绑机器人 → 核验关联 → 注入展示面数据 → 人设卡复核 → 七路由留档 → 归档探针」一条龙，一次登录（短信 1 次），不跑 22 题（展示面数据用 `inject_fixture` 注入，22 题本身由 T-047 的 GUI 重测与本轮 `flows.spec.js` 覆盖）。
- 运营端：真实 Chrome 走 `http://127.0.0.1:8017/ops/`；12 个一级页 + 6 个详情页留档。**登录凭据有偏离**：queue.md T-045 记的 `admin`/`dingdong-admin` 已失效（本地库无 staff 账号，详见「稳定性与如实记录」），本轮在本地库临时建 `t045walk`（superuser）完成走查。
- 展示面数据用 `manage.py inject_fixture --child-id <id> --scenario ca_display_*` 注入；**不拦截、不伪造任何 API 响应**。
- 脚本与原始记录都在 `.trellis/tasks/T-045/`：`walk-parent-v5.mjs`（`walk-parent-v5.json` / `.log`）、`walk-ops-v5.mjs`（`walk-ops-v5.json` / `.log`）；S-07 证据 `flows-s07-run.log`。截图在 `shots/`（40 张）。
- 环境：后端 8017、前端 4173、Celery worker 存活、beat STOP（已知，未动）、PostgreSQL 127.0.0.1:55439、Redis 56379，全部本机、非生产。分支 `codex/release-v0.3.7`。

## 一、运营端

### O-15 归档/解除关联后，儿童详情「同步」列显示「未知（blocked）」

- **用户在哪一步困惑**：运营打开「家庭与儿童 → 儿童详情 → 伙伴关联与同步」，看到一条已撤回的关联，其「同步」列是「未知（blocked）」。运营不知道「blocked」是什么，也不懂「未知」是不是数据丢了。这条状态恰恰是 T-044 修 P-19 时新引入的，归档或家长点「解除本地关联」后就会出现。
- **现状**：T-044 的 `core/services/associations.py` 里 `end_association()` 把 `SyncCheckpoint.status` 置为 `"blocked"`（`SyncCheckpoint.objects.filter(association=a).update(status="blocked", next_due_at=None)`），但 `ops/labels.py` 的 `CHECKPOINT_STATUS` 词表只有 `enabled`→「同步中」/`paused`→「已暂停」两项；`child_detail.html:206` 用 `{{ checkpoint.status|label:"CHECKPOINT_STATUS" }}` 渲染，落不到词表就兜底成 `labels.py:400` 的 `未知（{code}）`。于是本轮走查里，归档后的儿童 `4b1ea0f5` 详情页「同步」列原文是「未知（blocked）」，旁边还给出「恢复同步」按钮（模板 `child_detail.html:210` 按 `status == "enabled"` 判断，blocked 落到 else 分支）。
- **证据**：`shots/ops-detail-children-4b1ea0f5-01dd-44a4-be4a-055dd8093d9f-.png`；正文见 `walk-ops-v5.json` 的 children 详情页文本。
- **建议改法**：给 `CHECKPOINT_STATUS` 补 `"blocked": "已停用"`（或「已阻断」），与家长端「归档后不再同步」的语义对齐；模型 `SyncCheckpoint.status` 是自由 `CharField`（无 choices），可顺带把 `enabled`/`paused`/`blocked` 落成 choices 固定词表防再漏。「恢复同步」按钮对 blocked 显示是合理的，保留。
- **完善还是扩散**：完善（运营端词表补一项，不动契约、不动数据模型语义）。
- **工作量档位**：小（一行词表 + 一处回归断言）。

### O-16 22 题测评流程的「用途」仍是「测评流程（测试）」，与家长端「初始测评」口径不一致

- **用户在哪一步困惑**：运营在「题库管理」列表/详情看到 22 题问卷「日常探索问卷」的「用途」是「测评流程（测试）」；而家长端已把它呈现为正式「初始测评」（「通过日常情境题了解孩子的近期状态，完成后生成初始报告」）。同一套题两边说法不一致，运营会以为这 22 题测评还没脱离测试阶段。
- **现状**：`ops/labels.py:26` `QUESTIONNAIRE_PURPOSE["assessment"] = "测评流程（测试）"`；`core/assessment_models.py:80` 的 choices 是 `("assessment", "正式测评流程（测试）")`、`:82` 默认 `title` 是「日常情境问卷（测试）」。T-047（09-20 文案清理）按「家长端页面」口径只清了家长端与 DB 里的题库标题，这处运营端词表与模型 choice 还带「（测试）」。本轮「题库管理」页原文「日常探索问卷 … 用途 测评流程（测试）」。
- **证据**：`shots/ops-02-questionnaires.png`（列表「用途」列）；正文见 `walk-ops-v5.json` questionnaires 页。
- **建议改法**：把 `QUESTIONNAIRE_PURPOSE["assessment"]` 改「初始测评」（对齐家长端「初始测评」卡片），模型 choice 改「正式测评流程」、默认 title 去「（测试）」；核对 DB 里 `QuestionnaireVersion.purpose` 是否存了中文（存中文则一并清理为 code）。这与 T-047「家长端先清」不冲突，是同一口径补到运营端/后台。
- **完善还是扩散**：完善（词表与模型 choice 文案，不动契约/数据模型语义）。
- **工作量档位**：小（两处文案 + 一处 DB purpose 值核对）。

## 二、S-07 判断（`flows.spec.js` 报告等待是否放宽）

- **本轮实测**：单独跑「用途授权、22题、合成输入、真实初始报告」用例 → **1 passed (24.6s)**（`flows-s07-run.log`），「查看初始报告」按钮在 20 秒窗口内就绪。当前环境是 beat STOP、单线程 worker 队列空。
- **根因确认**：S-07 的失败根因是本地单线程 Celery worker（`--pool=solo`）队列积压（beat 的 dispatch/recover + 成批 sync 任务），不是产品缺陷、不是短信频控（本轮家长端 1 次登录 + 本用例 1 次登录，共 2 次，远低于 1 小时 50 次）。
- **判断：建议做一次「口径一致性」收口，但不改产品代码**。现状代码自相矛盾：T-047 把外层 `test.setTimeout(600000)`（10 分钟）并写注释「异步报告流水线实测 75s+」，但真正等报告按钮的是 `flows.spec.js:184` 的 `toBeVisible({ timeout: 20000 })`（20 秒）——外层承诺 10 分钟、内层 20 秒就放弃。队列空时 20 秒够（本轮实测通过），队列积压时 20 秒又会复现 T-042 的红灯。建议把内层 20 秒放宽到 120 秒（与「实测 75s+」的注释口径一致），并保留外层 10 分钟；这纯属用例层防御，不碰产品代码。

## 三、复核通过（记录，不作缺陷）

- **T-043 人设卡说明文案**：人设卡原文「学习风格：认知（由机器人服务提供）。」，整页无「我方 / 对方 code 表 / 确认后核对 / 直译」字样（`walk-parent-v5.json` `persona.hasInternalWording=false`）；`title` 仍保留原始取值 `cognitive`，且权重版本 `pw_v1` 也已收进悬停（T-046 保持）。注意：T-047 文案清理把这句话从 T-043 的「来自机器人服务，中文名仅供参考；悬停可看原始取值」进一步精简成「由机器人服务提供」，符合 T-043 的验收（无内部话术、title 保留原值）。证据 `shots/t045-v5-03-persona-card.png`。
- **T-044 归档后三处口径（P-19，端到端复核通过）**：`POST /api/v1/ca-accounts/…/retire` 返回 200。归档后账户页：顶部「还没有机器人账户号」+「绑定机器人」，旧号移入「上一台机器的账户（已归档）」；「机器人数据关联」区块从「已核验 · 同步已启用」变成「使用数据提供方的核验凭据确认儿童归属。+ 核验并关联」；测评与报告页三个展示面（陪学伙伴 / 互动健康度 / 成长周期报告）全部「还没有绑定机器人」，「成长观察」从「正在等待首次同步」变成「尚未关联机器人数据 / 暂无可展示的指标 / 最近成功同步：尚无记录」。五处口径一致，P-19 已修。数据层证据：儿童详情「伙伴关联与同步」状态「已撤回」、同步「blocked」（见 O-15）。证据 `shots/t045-v5-06-settings-after-archive.png`、`t045-v5-08-reports-after-archive.png`。
- **T-044 运营端三项**：O-12 工作首页卡片「生成任务异常 0」+ 口径说明「生成任务中状态为“失败”的数量」（`ops-00-dashboard.png`）；O-14 待办清单说明「最多显示 5 条（按提交时间从新到旧）。」（同页）；O-13 本轮库里无服务事项、无法端到端复核「该儿童的其他事项」排除自身，但代码已含 `.exclude(pk=row.pk)` 且有 T-044 回归用例覆盖，如实记录为「数据层已修、本轮无数据未走 UI」。
- **T-038 O-06/O-07、T-039 八维、T-035 复测拒绝分支**：家庭列表「家长」列显示「未填写」不重复手机号；工作首页「近 7 天新建档案（含已归档）4」带口径说明；`#reports` 八维 8/8 中文名与条形值齐全（语言 40 / 逻辑 52 / 音乐 38 / 空间 47 / 实践 35 / 自我认知 44 / 人际 41 / 自然 39）；复测区块「建议重新测评」+「重新测评 / 先不测」两按钮、健康度不显裸 code、成长观察来源说明一句到位。
- **运营端稳定性**：12 个一级页 + 6 个详情页全部 200、`FAILED []`、`ERRORS []`；家长端八路由（含 `#help` 未知路由回落到「没有找到这个页面」的既有空态）`pageerror` 空、390×844 `scrollWidth - innerWidth` 全 0 无横向溢出。

## 四、稳定性与如实记录（单列）

- **家长端每轮 2 条 `console 401`**：`POST /api/v1/auth/refresh` 未登录启动探测，被 `app.js` catch 接住落登录页（T-042 已定位，非缺陷），本轮 2 次会话各 1 条。
- **fixture 未来时间戳**：`ca_display_reassess` 场景硬编码 `generated_at="2026-09-23T00:10:00+08:00"`（`testsupport/ca_display.py:265`），今天（09-22）走查看到「生成于 2026/09/23 00:10」，随真实时间推移「建议时间 / 生成于 / 观察天数」会漂移失真。属合成 fixture 维护问题，非产品缺陷，供 orchestrator 知晓（生产接真源后不涉及）。
- **短信频控余量**：本轮家长端走查 1 次登录 + S-07 用例 1 次登录，共 2 次验证码，远低于 1 小时 50 次上限，未触发频控。
- **运营端登录凭据偏离（重要，如实记录）**：queue.md T-045 记的 `admin` / `dingdong-admin` 已失效——本地库共 5 个账号，全部 `account_kind=parent`，无 staff 账号。本轮为完成运营端走查，在**本地开发库**临时建了 `t045walk`（superuser + account_kind=staff + 姓名「巡检走查临时账号」），走查结束后已将其 `is_active` 置 `False` 停用（账号仍保留在库供核对，也可直接删除）。未触生产、未触远端、未读 `deploy/.env` 或私钥。此偏离已记入 report.md。
