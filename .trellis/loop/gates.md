# 门禁申请与决定

两段各管一头：**申请**由 worker 追加，**决定**由 orchestrator 追加。worker 每轮开工先读决定段，看到 `APPROVE` 就执行对应受门禁动作。

## 申请（worker 追加）

格式：`REQUEST T-xxx <gate类型> <一句话原因> <时间>`

<!-- 下面按时间追加 -->
REQUEST T-099 push 驱动收尾钩子实测，T-022 钩子自测，可忽略 2026-09-17T07:20Z

REQUEST T-002 push 门禁联调测试文件已就绪，需推送到远端验证 push 门禁闭环 2026-09-17T05:52Z
REQUEST R0d push R0d 自循环驱动机制 + 三轮实测（T-001/T-002/T-004）与报告已提交，待推 origin/codex/release-v0.3.6 2026-09-17T06:01Z
REQUEST T-003 review 产品体验与稳定性审计 backlog 已完成（家长端 9 条 + 运营端 5 条 + 缺口 3 条 + 稳定性 5 条），需独立复看后再决定修哪些 2026-09-17T06:16Z
REQUEST T-021 review 四个展示面（人设 / 15–30 天成长报告 / 健康度四态 / 复测 CTA）设计文档已写完（`.trellis/tasks/T-021/design.md`，含 §7 逐条对照与 4 个实现任务拆分），需复看后再导入实现任务 2026-09-17T13:20Z
REQUEST T-024 review 产品巡检 backlog 已写完（家长端 6 条 + 运营端 2 条 + T-003 未修复查 + 稳定性 1 条，含 P-10 复测回写 500 的真实响应体与截图证据），需复看后再决定导入哪些 2026-09-18T03:30Z
REQUEST T-028 external 给 DingDong 的三层澄清清单已写完（`.trellis/tasks/T-028/dingdong-clarifications.md`，阻塞级 3 / 确认级 27 / 后置级 2，含 D1–D20 落点对照与 N1–N10 新增问题），只到「文档就绪待发」；发送属 external 动作，须 Yihu 放行后由人执行 2026-09-17T15:24Z
REQUEST T-040 review 第三轮产品巡检 backlog 已写完（`.trellis/tasks/T-040/backlog.md`：家长端 2 条新条目，含 P-16 复测「开始复测」对话框被自动重渲染关掉的 100ms 采样证据与请求表；运营端 4 条新条目 O-08…O-11；T-037 两个儿童同 `event_id` 端到端复核 200/200；T-038/T-039/O-06/O-07 复核通过；源开关 `dingdong` 未配置支已复核），需复看后再决定导入哪些 2026-09-18T05:30Z

## 决定（orchestrator 追加）

格式：`APPROVE|DENY T-xxx <gate类型> <原因>`；worker 执行完在下方补一行 `EXECUTED T-xxx ...`
历史 `EXECUTED` 行与一次性事后追认已归档至 `.trellis/loop/gates-archive-20260917.md`（T-036 瘦身，逐行原文）。

<!-- 下面按时间追加 -->

APPROVE T-003 review backlog 已复看，质量合格。执行动作：把下列条目按此顺序导入 queue.md 为新任务（编号从 T-005 起，每条 goal/acceptance 直接取 backlog 对应条目的「建议改法」与「现状」反证，acceptance 必须含可客观验证项：相关测试通过 + audit errors 空 + UI 改动用真实 Chrome 复现原问题已消失并截图到任务目录）。gate 标注见括号，未标即 none。
  第一批（小，缺陷与文案）：O-01, P-05, P-01, P-02, P-06, P-07, P-08, P-09, P-04, O-03, O-04, P-03（保留「合成测试」标注）, G-02（产品内一行来源声明，与 frontend/README.md 一致）
  第二批（中，稳定性）：S-05（本地 e2e 与 inject_fixture 指向同一库或前置一致性检查显式跳过，目标是那 4 项在本地要么通过要么明确 skip，不再靠人分辨）, O-02（5 处回落，优先复用「账号与权限」页的既有先例）, S-04（用 inject_fixture 注入真实失败任务，验证阶段画像/同步失败在家长端可见；不可见则补，可见则只记证据）
  第三批（大）：G-01-设计（gate review）——先只写 .trellis/tasks/<id>/design.md：四个展示面的数据形状、合成数据源放哪一层、空态/错误态、与 设计/CA对接_C1_ca_account_id设计_20260916.md §7 判定标准的逐条对照、拆成几个实现任务；不写代码。我批了设计再导入实现任务。
  不导入：O-05（演示数据治理，暂缓）；G-03（external，等 Yihu 拍板，保持 REQUEST 状态不要重复申请）。
  push 规则（本决定内有效）：第一批与第二批每完成一个任务 commit 后可直接 push origin codex/release-v0.3.6，不必逐条申请，但每次 push 在本文件补 EXECUTED 行；第三批仍逐条申请。
  文档路径以仓库内实际文件名为准。 2026-09-17T06:40Z

DENY T-099 push T-022 钩子自测行，orchestrator 已于 07:20Z 真实收到唤醒，链路验证通过，按 T-022 验收约定忽略，不对应任何真实推送 2026-09-17T07:22Z

APPROVE T-021 review 设计复看通过，四条审核要点逐项核验成立：①合成数据源放后端服务层（`CA_DISPLAY_DATA_SOURCE` 默认 `synthetic_fixture`），每个响应带 `data_origin` 且前端在面板级挂「合成测试数据」徽标，满足「合成数据 + 显式标注」；②合成模式零出站、`dingdong` 模式未配置时返回 `not_synced` + `reason=upstream_not_configured` 不伪造成功，满足「不为展示面先接对方接口」；③§4 对 §7 的 11 条逐条对照成立，并如实记录两条边界（四个面属 C5/C6 不在 §7 清单；§7 第 11 条仍只能由 D10/D12 解开——合成数据跑通不算 §7 完成，实现任务 report 不得写成已接通）；④A/B/C/D 拆分各有可客观验证验收，A 先行定死 availability 词表与错误处置的拆法正确。一处 orchestrator 裁量：实现任务 A–D 不沿用设计稿建议的 gate:review，改为 gate:none + 第一/二批同款直推规则（设计已批、验收客观、逐条 review 只增加等待），已由 orchestrator 导入 queue.md 为 T-032/T-033/T-034/T-035（排 T-028 之后、T-024 巡检之前，执行序 B 依赖 A、D 依赖 B、C 独立）；§6 的 5 条待澄清已并入 T-028 确认级（含 ①⑤ 标注为复测回写实源切换前置）。本批准同时授权 T-021 收尾轮：已提交的 `[T-021]` 设计提交与收尾记录可直接 push origin/codex/release-v0.3.6 并补 EXECUTED 行，不必另开 REQUEST；T-021 `status` 改 `done`。 2026-09-17T13:16Z

EXECUTED T-036 push 按本任务 notes「机制维护类：commit 后直接 push 并补 EXECUTED 行」执行：`git push origin codex/release-v0.3.6` → `d80891c..2dff105`，远端 sha `2dff1056288e78045e7f458154a4dc39c17cfa9f`（`[T-036]` 瘦身提交 2dff105：`gates.md` 95→34 行 + `queue.md` 257→119 行 + `gates-archive-20260917.md` / `queue-archive-20260917.md` + 任务证据；收尾记录提交紧随其后同一轮再推，分支头以 origin 为准） 2026-09-17T15:11Z

EXECUTED T-031 push 按本任务 notes「机制维护类：commit 后可直接 push 并补 EXECUTED 行」执行：`git push origin codex/release-v0.3.6` → `dc54fea..bfe9dcd`，远端 sha `bfe9dcdc93c0d1488175a375288209345a9d8d56`（`[T-031]` 格式化提交 bfe9dcd：`backend/dingdong_ca/core/api/common.py` +5/−3 行，唯一 hunk 是 `describe_target` 内 name 表达式按 ruff 重排；收尾记录提交紧随其后同一轮再推，分支头以 origin 为准） 2026-09-17T15:30Z

EXECUTED T-031 push（第二次，收尾记录提交 8f9a6d6）：`git push origin codex/release-v0.3.6` → `bfe9dcd..8f9a6d6`，远端 sha `8f9a6d60f86c56f887169516c2c7b9737c4f7ddd`（该提交含 queue/gates/status/experiment-log/progress 收尾记录：T-031 `status` 改 `done` 并压成一行指针移入 done 块、`EXECUTED T-031 push` 首条、status.md 重写；本条补记提交随后同一轮再推，分支头以 origin 为准） 2026-09-17T15:42Z

EXECUTED T-036 push（第二次，收尾记录提交 87f1029）：`git push origin codex/release-v0.3.6` → `2dff105..87f1029`，远端 sha `87f1029411e983823b9ff1cf44c94a4d5200d318`（该提交含 queue/gates/status/experiment-log/progress 收尾记录；本条补记与 verify 输出刷新提交随后同一轮再推，分支头以 origin 为准） 2026-09-17T15:14Z

EXECUTED T-032 push 按 T-021 批复「实现任务 A–D 用第一/二批同款直推规则」执行：`git push origin codex/release-v0.3.6` → `3b3a337..a7c2035`，远端 sha `a7c20353bc295123c9c32d8f2ab64918e3959925`（`[T-032]` 提交 a7c2035：21 文件 +7878/−2997，含 6 条展示面路由与 51 项新用例、迁移 `0009`、openapi +6 路径/+17 schema、`ops/labels.py` 两个审计动作词条、`PROJECT_MEMORY.md` 与 T-032 任务记录；收尾记录提交紧随其后同一轮再推，分支头以 origin 为准） 2026-09-18T01:43Z

EXECUTED T-033 push 按 T-021 批复「实现任务 A–D 用第一/二批同款直推规则」执行：`git push origin codex/release-v0.3.6` → `cda5201..998e3f0`，远端 sha `998e3f03250884bfa652ef2a943caeea8db7ea6c`（`[T-033]` 提交 998e3f0：新增 `frontend/companion.js` + `frontend/unit/companion.test.js`（18 项）+ `frontend/tests/companion-panel.spec.js`（真实 Chrome 2 项）+ `#reports`「陪学伙伴」面板与 `#settings` 只读人设行 + `client.css`/`server.cjs` + `frontend/README.md`/`PROJECT_MEMORY.md`/`.trellis/spec/frontend/testing-and-acceptance.md` + T-033 任务记录与 8 张截图；收尾记录提交紧随其后同一轮再推，分支头以 origin 为准） 2026-09-18T02:10Z

EXECUTED T-034 push 按 T-021 批复「实现任务 A–D 用第一/二批同款直推规则」执行：`git push origin codex/release-v0.3.6` → `ca699b3..875e793`，远端 sha `875e79367687da356c38f256814e9043baf9b299`（`[T-034]` 提交 875e793：新增 `frontend/growth-cycle.js` + `frontend/unit/growth-cycle.test.js`（17 项）+ `frontend/tests/growth-cycle-panel.spec.js`（真实 Chrome 1 项 11 步）+ `#reports`「成长周期报告」面板与 15/30 天 Tab + `client.css`/`server.cjs`/`package.json` + `frontend/README.md`/`PROJECT_MEMORY.md`/`.trellis/spec/frontend/testing-and-acceptance.md` + T-034 任务记录与 9 张截图；收尾记录提交紧随其后同一轮再推，分支头以 origin 为准） 2026-09-17T18:24Z

EXECUTED T-035 push 按 T-021 批复「实现任务 A–D 用第一/二批同款直推规则」执行：`git push origin codex/release-v0.3.6` → `4a249de..4d35165`，远端 sha `4d3516568b1abacf90eff2daf608b08d400df418`（`[T-035]` 提交 4d35165：新增 `frontend/reassessment.js` + `frontend/unit/reassessment.test.js`（9 项）+ `frontend/tests/reassessment-cta.spec.js`（真实 Chrome 3 项）+ `.companion-health` 内复测区块与 `respondReassessment()` / `writeBackReassessment()` + `client.css`/`server.cjs`/`package.json` + `frontend/README.md`/`PROJECT_MEMORY.md`/`.trellis/spec/frontend/testing-and-acceptance.md` + T-035 任务记录与 7 张截图；收尾记录提交紧随其后同一轮再推，分支头以 origin 为准） 2026-09-18T03:10Z

APPROVE T-024 review 巡检 backlog 复看通过，走查方式可复核（真实 Chrome 双视角、不拦截响应、证伪「卡死」与 422 误报的自我纠正都合格）。P-10 确认为真缺陷，修法裁定：**改模型约束，不改 fixture**——`CaReassessmentEvent.event_id` 从全局唯一改为按 `ca_account` 唯一（服务层 `_local_event` 与回写行查找本就按 `ca_account + event_id` 两键，模型约束比服务语义更严是缺陷根源；fixture 的 `reassess_mock_001/002` 与对方 xlsx 表 6 mock 账号一一对应，保持原样才能对表验收）。这动的是我方内部模型语义、不动对方契约，且「同一事件对方只发一次、我方按账户落行」与 C1 §5 账户级语义一致，不属「扩散」。执行动作：由 orchestrator 导入 queue.md 为 T-037（P-10，含 S-06 前端 5xx 文案与错误落点）、T-038（P-11/P-12/P-13/P-14/P-15 + O-06/O-07 文案与格式小项打包）、T-039（T-033/T-034 三条范围判定按本批复落定 + 过期截图刷新），排 T-028 之后；并在队尾追加下一次巡检 T-040。O-05 演示库脏数据维持暂缓不导入。T-024 `status` 改 `done`，收尾轮可直推。 2026-09-17T19:34Z

EXECUTED T-037 push 按本任务 notes「commit 后直接 push origin/codex/release-v0.3.6 并补 EXECUTED 行」执行：`git push origin codex/release-v0.3.6` → `677c769..0849639`，远端 sha `08496397a84031719d608554abe1d8f248f4b8c3`（本次推送含三个提交：`43a68e4` = T-024 巡检 backlog（orchestrator 19:34Z 批复「T-024 status 改 done，收尾轮可直推」，此前未推）、`1f48144` = `[T-037]` 22 文件 +627/−25（`ca_models.py` 唯一性改按账户 + 迁移 `0010`、`app.js`/`reassessment.js` 失败落点、`api.js` 的 `errorBody()`、后端新用例 + 前端新 spec/单测、`设计/数据库实际字段_M5.md` 与五份文档）、`0849639` = 收尾记录；本条补记提交随后同一轮再推，分支头以 origin 为准） 2026-09-18T04:35Z

EXECUTED T-038 push 按本任务 notes「commit 后直接 push origin/codex/release-v0.3.6 并补 EXECUTED 行」执行：`git push origin codex/release-v0.3.6` → `9da2a05..d39c37a`，远端 sha `d39c37a8413e1180fa2bed123330e48e571c3cab`（`[T-038]` 提交 d39c37a：31 文件 +656/−27，含 `ca_display.py` 学习风格中文映射 + `learning_style_labels`、`testsupport/robot.py` 单位改「次」、`ops_labels.py` 新增 `account_name` 过滤器 + `families.html`、`ops/services.py` 口径标签 + `OPS_MANUAL.md`、`app.js` 时间格式化与四处文案、`openapi.json` + 重生成字段字典、后端 3 个测试文件与前端 4 个 spec、`frontend/README.md`/`PROJECT_MEMORY.md` 与 T-038 任务记录（含 10 张截图）；收尾记录提交紧随其后同一轮再推，分支头以 origin 为准） 2026-09-18T04:45Z

EXECUTED T-039 push 按本任务 notes「commit 后直接 push origin/codex/release-v0.3.6 并补 EXECUTED 行」执行：`git push origin codex/release-v0.3.6` → `36ab4fa..636dde6`，远端 sha `636dde6014a02d872c4ea809ac025a5cd7b6fb0b`（`[T-039]` 提交 636dde6：29 文件 +452/−43，含 `ca_display.py` 的 `GROWTH_DIMENSION_LABELS` + `growth_dimension_labels`（有数据态与空态各一处）、`tests/test_ca_display.py` 新增 1 用例、`openapi.json` 的 `GrowthCycleView` 字段与 required + 新 schema `GrowthDimensionLabels`、字段字典重生成、`frontend/growth-cycle.js` 去中文名硬编码改 `DIMENSION_KEYS` + `unit/growth-cycle.test.js` +2 项、`frontend/README.md`、`PROJECT_MEMORY.md`、T-028 澄清清单 C6 追加一行、T-033 的 8 张截图刷新、T-039 任务记录与 4 张截图副本；收尾记录提交紧随其后同一轮再推，分支头以 origin 为准） 2026-09-18T05:12Z

APPROVE T-040 review 第三轮巡检 backlog 复看通过，走查方式合格（源开关双实例复核、证伪两条疑似矛盾、剔除自猜 URL 的 404，纪律都对）。P-16 确认为真缺陷（复测「开始复测」对话框被 3 秒轮询的 `render() → stopWork()` 无条件 `$("#dialog").close()` 关掉，orchestrator 已读 `app.js` 的 `render():628`、`stopWork():88`、`#reports` 轮询 `:750-760` 核实机制成立）。修法裁定：**采用建议①的收窄版——`stopWork()` 的关对话框动作只在「路由变化」时执行**：`to()` 与 hashchange 入口在调 `render()` 前先关对话框并清 `childEdit`，`render()` 自身不再无条件 `stopWork()`（`clearTimeout(pollTimer)` 保留在 render 开头；对话框打开期间挂起轮询用建议②：打开时不清、由打开方在关闭回调里恢复轮询）。理由：根因是「重渲染」与「离开上下文」两个语义被合并在一个函数里，拆开比给单个对话框打补丁通用（childEdit 的修订号保护同样受益）；纯前端时序，不动契约与模型，属「完善」。执行动作：由 orchestrator 导入 queue.md 为 T-041（P-16 + P-17 + O-08/O-09/O-10/O-11 打包，均为小中项、同属文案与前端时序范畴），排 T-028 之后；队尾追加下一次巡检 T-042。O-05 维持暂缓。T-040 `status` 改 `done`，收尾轮可直推。另：`tests/flows.spec.js` 因本地短信频控未跑绿一事，作为 T-042 巡检的固定复核项（频控窗口过后补跑），不单开任务。 2026-09-17T21:36Z

EXECUTED T-041 push 按本任务 notes「commit 后直接 push origin/codex/release-v0.3.6 并补 EXECUTED 行」执行：`git push origin codex/release-v0.3.6` → `89d9994..bddf02c`，远端 sha `bddf02c24ce57e41da24c46c44c9a88f9afb934a`（本次推送含两个提交：`dbbba00` = T-040 收尾的 progress.md 记录（orchestrator 已批「T-040 status 改 done，收尾轮可直推」，此前未推）、`bddf02c` = `[T-041]` 提交（42 文件 +830/−35：`app.js` 的 `leaveContext()`/`closeDialog()`/`schedulePoll()`/`pollPending` + 五处显式 `closeDialog()` + `render()` 补回朗读取消、`robots.py` 的 `PROOF_INVALID_MESSAGE`、`ops/labels.py` 三张词表 + `ops_labels.py` 的 `known_label`、七个运营模板、五个后端测试文件 + 新 spec `frontend/tests/t041-dialog-and-labels.spec.js`、`.trellis/spec/frontend/state-and-rendering.md`、`frontend/README.md`、`PROJECT_MEMORY.md`、T-041 任务记录与 10 张截图 + 先失败日志、T-012/T-019 被回归刷新脏的截图、`文档/文档校验结果.json`）；收尾记录提交紧随其后同一轮再推，分支头以 origin 为准） 2026-09-18T07:20Z

REQUEST T-042 review 第四轮产品巡检 backlog 已写完（`.trellis/tasks/T-042/backlog.md`：家长端 2 条新条目 P-18 人设卡学习风格说明含内部流程话术 / P-19 归档旧号后账户页与展示面状态自相矛盾，运营端 3 条 O-12 工作首页「报告生成异常」卡片与区块装的是全部失败任务（实测 report kind 失败 0 条）/ O-13 服务事项详情「该儿童的其他事项」含当前事项自身 / O-14 待办清单只列最旧 5 条且不写截断，稳定性 1 条 S-07 `flows.spec.js` 本地必失败根因定位为单线程 worker 排队而非频控，另把 T-040 遗留的 console 401 定位到 `POST /api/v1/auth/refresh` 未登录探测），需复看后再决定导入哪些 2026-09-17T23:25Z
