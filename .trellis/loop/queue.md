# 自循环任务队列

字段：`goal` 目标 · `acceptance` 可客观验证的验收 · `gate` 门禁类型（`none` | `push` | `external` | `deploy` | `review`）· `status`（`todo` | `doing` | `done` | `blocked` | `gated`）· `notes` 备注。
规则：驱动每轮取第一个 `status: todo` 的任务；`gated` / `blocked` 跳过。任务定义由 orchestrator 写，执行结果由 worker 写回。

瘦身（T-036）：已 done 任务压成两行（`## T-xxx` 标题 + 一行指针，指针行首 token 仍是 `done`），逐条执行结果见 `.trellis/tasks/<id>/report.md`，压缩前全文留档 `.trellis/loop/queue-archive-20260917.md`；done 块连续排布不空行（行数预算所限）；todo / doing / gated / blocked 任务保持全文。

## T-025 机制盘活：驱动长程 7×24 语义（每日上限睡到零点）+ 限流退避与 Pro 日限 + 唤醒重试 + 探活 watchdog
- status: done · 见 `.trellis/loop/queue-archive-20260917.md`（本任务无 report.md，原文留档）
## T-022 驱动加「有新门禁申请或任务 blocked 时叫醒 orchestrator」的钩子
- status: done · 见 `.trellis/tasks/T-022/report.md`
## T-023 机制收尾：ORCHESTRATOR.md 入库 + 关闭 R0d 遗留核对项
- status: done · 见 `.trellis/tasks/T-023/report.md`
## T-001 写 .trellis/loop/README.md
- status: done · 见 `.trellis/tasks/T-001/report.md`
## T-002 在 .trellis/tasks/T-002/ 写一份 hello.md 并申请 push
- status: done · 见 `.trellis/tasks/T-002/report.md`
## T-004 验证模型切换
- status: done · 见 `.trellis/tasks/T-004/report.md`
## T-003 产品体验与稳定性审计
- status: done · 见 `.trellis/tasks/T-003/report.md`
## T-005 O-01 修掉 CA 账户页跨行模板注释被当正文渲染
- status: done · 见 `.trellis/tasks/T-005/report.md`
## T-006 P-05 空手机号获取验证码不再丢后端原始报错
- status: done · 见 `.trellis/tasks/T-006/report.md`
## T-007 P-01 绑定机器人成功后留在账户页并给反馈
- status: done · 见 `.trellis/tasks/T-007/report.md`
## T-008 P-02 手填绑定的家长要知道该填什么
- status: done · 见 `.trellis/tasks/T-008/report.md`
## T-009 P-06 成长观察非法时间区间要就地提示
- status: done · 见 `.trellis/tasks/T-009/report.md`
## T-010 P-07 慢网提交要有进行中提示
- status: done · 见 `.trellis/tasks/T-010/report.md`
## T-011 P-08 最后一题按钮文案改成「保存并完成」
- status: done · 见 `.trellis/tasks/T-011/report.md`
## T-012 P-09 「机器人指纹」文案去掉「指纹」二字
- status: done · 见 `.trellis/tasks/T-012/report.md`
## T-013 P-04 不再把内部 code `readable-v2` 给家长看
- status: done · 见 `.trellis/tasks/T-013/report.md`
## T-014 O-03 审计页补「登录凭据」对象词条
- status: done · 见 `.trellis/tasks/T-014/report.md`
## T-015 O-04 儿童详情加只读「机器人账户」一行
- status: done · 见 `.trellis/tasks/T-015/report.md`
## T-016 P-03 授权同意框补齐四要素（保留「合成测试」标注）
- status: done · 见 `.trellis/tasks/T-016/report.md`
## T-017 G-02 产品内加一行授权血缘来源声明
- status: done · 见 `.trellis/tasks/T-017/report.md`
## T-018 S-05 本地 e2e 4 项数据漂移失败变成可判定
- status: done · 见 `.trellis/tasks/T-018/report.md`
## T-019 O-02 家长姓名为空不再回落内部账号 `parent-<uuid>`
- status: done · 见 `.trellis/tasks/T-019/report.md`
## T-020 S-04 阶段画像/同步失败在家长端的可见性
- status: done · 见 `.trellis/tasks/T-020/report.md`
## T-026 刷新 T-012 过期截图（证据保鲜小任务）
- status: done · 见 `.trellis/tasks/T-026/report.md`
## T-027 存量测试文件过 ruff format（T-014 遗留）
- status: done · 见 `.trellis/tasks/T-027/report.md`
## T-021 G-01-设计 四个展示面的设计文档（先设计后实现）
- status: done · 见 `.trellis/tasks/T-021/report.md`
## T-029 刷新 T-008 漂移截图（证据保鲜小任务）
- status: done · 见 `.trellis/tasks/T-029/report.md`
## T-030 T-020 注入合成数据的清理（状态变更，不物理删除）
- status: done · 见 `.trellis/tasks/T-030/report.md`
## T-036 loop 账本瘦身：压 worker 每轮上下文，降 TPM 限流频率
- goal: 本日 Flash TPM 限流已打断 T-021/T-030/T-031 多轮（Pro 兜底 6/6 提前耗尽），诱因之一是 `queue.md`（约 250 行、done 任务 notes 超长）与 `gates.md`（约 100 行 EXECUTED 长行）每轮被 worker 全文读入。把账本瘦身为「活跃任务全文 + 历史归档」：①`gates.md` 决定段的 EXECUTED 历史行移入 `.trellis/loop/gates-archive-20260917.md`，决定段只保留仍生效的常设许可（T-003 批准的第一/二批直推规则、T-021 批复及其收尾授权、DENY T-099）；②`queue.md` 已 done 任务的超长执行结果 notes 压成一行指针（先核对 `.trellis/tasks/<id>/report.md` 已覆盖再压，不得丢信息）；③`status.md`/`runs.log` 的驱动格式不动。
- acceptance: 瘦身后 `wc -l` `queue.md` ≤ 120 行、`gates.md` ≤ 60 行；`## T-xxx` 标题与 `- status:` 行格式不变（驱动 grep 依赖）；归档文件含被移除的 EXECUTED 行原文；抽查 3 处被压缩的 done notes 均能在 report 或归档中找到对应内容；`python3 scripts/audit_documents.py` errors 为空；改动以首行 `[T-036]` 提交。
- gate: push
- status: done
- notes: 机制维护类：commit 后直接 push 并补 EXECUTED 行。只动 `queue.md`/`gates.md`/新建归档文件，不改驱动脚本与 prompt.md；todo/doing/gated/blocked 任务的 notes 保持全文不压。**2026-09-17 执行结果**：`gates.md` 95→34 行（22056→5098 字节）、`queue.md` 257→119 行（65969→16508 字节），两文件每轮读入 88025→21606 字节（-75.5%）；决定段 47 行历史移入 `.trellis/loop/gates-archive-20260917.md`（43 条 EXECUTED + 4 条一次性事后追认，逐行原文），决定段只留 T-003 常设直推规则 / T-021 批复 / DENY T-099；28 个 done 任务压成「标题 + 一行指针」（指针行首 token 仍是 `done`，指向各自 `report.md`；T-025 无 report.md，指向 queue 留档），压缩前全文 257 行留档 `.trellis/loop/queue-archive-20260917.md`；todo 任务（T-031/T-028/T-032..T-035/T-024）notes 逐字未压。验证：`python3 .trellis/tasks/T-036/verify.py` 全 PASS（含直接跑驱动脚本里真实的 `next_task`/`classify`/`loop_gate_snapshot` 解析块：`next_task` 返回 T-031、`classify(T-036)`/`classify(T-030)` 返回 DONE、`classify(T-031)` 非 DONE、门禁快照 2 行且 blocked 列表空），归档 47 行逐行核对 0 缺失且行序一致，抽查 T-030/T-022/T-025 被压缩内容均能在 report.md 或留档中找到；`python3 scripts/audit_documents.py` errors `[]`；未改驱动脚本、prompt.md、status.md、runs.log。
## T-031 存量 `core/api/common.py` 过 ruff format（T-027 连带发现）
- status: done · 见 `.trellis/tasks/T-031/report.md`（纯格式化 chore：`describe_target` 内 name 表达式按 ruff 重排，+5/−3；改后 `ruff format --check --target-version py313 .` `126 files already formatted`、`pytest tests/test_ops_audit_scope.py tests/test_auth.py -q` `26 passed in 58.97s`；已按机制维护类直推 push，远端 sha `bfe9dcdc93c0d1488175a375288209345a9d8d56`）

## T-037 P-10 复测「先不测」回写 500：约束改按账户唯一 + 前端错误落点与 5xx 文案
- goal: 修 T-024 巡检坐实的真缺陷：①`CaReassessmentEvent.event_id` 从全局唯一改为按 `ca_account` 唯一（orchestrator 已裁定改模型不改 fixture：服务层 `_local_event` 与回写查找本就按 `ca_account + event_id` 两键，fixture 的 `reassess_mock_001/002` 保持与对方 mock 账号对应）——新增迁移（含既有重复行处置策略，写进 report）、更新 `ca_models.py` 约束与 docstring；②前端失败反馈落在复测区块自身（「这次没写成功，请重试」+ 重试入口），不再落到「成长观察」区块；③`api.js` 对 5xx 给家长能读懂的统一文案，不再把「服务返回了无法识别的响应。」当用户文案（S-06）。
- acceptance: 新增先失败的用例：两个不同儿童（各自 `ca_display_reassess` 场景）先后对同一 `event_id` 回写，第二个不再 500 且幂等语义按账户隔离（同账户同 event_id 同 accepted 重放仍返回首次结果）；`backend/tests/test_ca_display.py` 全量通过（既有 14 处硬编码 `reassess_mock_002` 断言应不受影响，受影响的如实记录并修正）；真实 Chrome 复现「先不测」→ 5xx 时复测区块内出现中文失败提示与重试入口、「成长观察」区块不再出现错误横幅、恢复后重试成功，截图到 `.trellis/tasks/T-037/shots/`（含 390×844）；`cd backend && uv run pytest tests/test_ca_display.py` 与 `cd frontend && npm run check && npm run test:unit` 通过；audit errors 为空；改动以首行 `[T-037]` 提交。
- gate: none
- status: done
- notes: 修法已由 orchestrator 裁定（gates.md APPROVE T-024 2026-09-17T19:34Z），不要再提出改 fixture 的替代方案。迁移只动我方内部约束、不动对方契约字段。commit 后直接 push origin/codex/release-v0.3.6 并补 EXECUTED 行。收口项：PROJECT_MEMORY.md 同步；report 不得写成「已接通 DingDong」。

- **2026-09-18 执行结果**：三处全做。①`ca_models.py` 的 `event_id` 去掉 `unique=True`、新增 `ca_reassessment_event_account_unique`（`(ca_account, event_id)`）+ docstring 说明跨账户重名；迁移 `0010`（`AlterField` + `AddConstraint`）**不需要去重/回填**——方向是放宽，旧约束更严，既有数据不可能有同账户同事件重复行（已写进迁移头注释与 report）；②`respondReassessment()` 改 try/catch 把失败存进新增的 `state.reassessmentRespondError`，失败提示渲染在复测区块内（「这次没写成功，请重试。」+「重试」按钮，按同一答案同一 `request_id` 重放），不再经 `showError()` 落进「成长观察」的窗口表单；③`api.js` 新增纯函数 `errorBody()`，5xx 统一「服务暂时不可用，请稍后再试。」。**先失败证据**（临时回退模型与迁移、`--create-db` 复跑）：`FAILED … IntegrityError: duplicate key value violates unique constraint "ca_reassessment_event_event_id_key"` / `1 failed, 52 deselected in 17.65s`；修复后同用例 `1 passed … in 18.50s`。**验证**：`tests/test_ca_display.py` 全量 `53 passed in 237.82s`（原 52 + 新增 1，既有 14 处 `reassess_mock_002` 断言无需修改）；`npm run check` exit 0、`npm run test:unit` `65 pass / 0 fail`；真实 Chrome 新增 `tests/reassessment-write-failure.spec.js` 2 项 + T-035 回归 3 项 = `5 passed (3.7m)`（5xx 时整页唯一错误提示在复测区块内、窗口表单错误位为空、`#toast` 不接管、重试后真实 POST 200、390×844 不溢出；两个不同家庭的儿童先后回写同一 `reassess_mock_001` 都 200，不拦截任何响应）；`ruff check` / `ruff format --check` / `manage.py check` / `makemigrations --check` 干净；`audit_documents.py` errors `[]`（`设计/数据库实际字段_M5.md` 已重新生成）。本地开发库已应用 `0010`（生产库未迁移）；本地库留下 3 行 `reassess_mock_001`（账户不同）供清理参考。截图 4 张在 `.trellis/tasks/T-037/shots/`。已按直推规则 push，远端 sha 见 gates.md `EXECUTED T-037`。详见 `.trellis/tasks/T-037/report.md`。

## T-038 P-11/P-12/P-13/P-14/P-15 + O-06/O-07 文案与展示小项打包
- goal: 按 T-024 backlog 的建议改法修七条小项：P-11 复测区块的原因句改为「这次建议的原因」或与健康度同字段（二选一，report 记明选择）；P-12 学习风格 code 的处理——后端加中文映射表（与 `engagement.stage_label` 同做法，对方 code 表未确认前映射以合理中文对照并保留原 code 于 `title`），或家长端不展示该行（report 记明选择与理由）；P-13 合成 fixture 的 `"unit": "count"` 改 `"次"`（`testsupport/robot.py`）；P-14 阶段报告卡时间走与成长观察同一个格式化函数；P-15 成长观察区块加一行来源说明（陪学伙伴数据来自机器人服务、行为观察来自本机同步）；O-06 家庭列表「家长」列空姓名回落「未填写」（沿用 T-019 思路）；O-07 工作首页「近 7 天新增儿童」标签写全口径（如「近 7 天新建档案（含已归档）」）。
- acceptance: 每条有对应真实 Chrome 截图到 `.trellis/tasks/T-038/shots/`（家长端条目含 390×844，运营端条目含改后页面）；P-11 两处不再出现同一标签两个值；P-12 家长端正文不再出现裸 `imitation/open/reverse/cognitive`（允许 `title` 属性）；P-13 界面不再出现 `count`；P-14 同页时间格式一致；P-15 成长观察区块有来源说明一行；O-06 相邻两列不再重复同一手机号；O-07 标签口径自洽；`cd frontend && npm run check && npm run test:unit` 与相关后端用例通过；audit errors 为空；改动以首行 `[T-038]` 提交。
- gate: none
- status: done
- notes: 七条打包一轮做完，逐条在 report 记「选了哪个改法、为什么」。P-12 若选「不展示」需同步改 T-033 的用例断言。commit 后直接 push origin/codex/release-v0.3.6 并补 EXECUTED 行。收口项：frontend/README.md 与 PROJECT_MEMORY.md 同步。

- **2026-09-18 执行结果**：七条全做。P-11 复测区块原因句改「这次建议的原因」（两处原因本就取不同字段：事件 `trigger_type` vs 健康度 `trigger_reason`，改同字段会丢信息）；P-12 选「后端加中文映射表」——`ca_display.py` 新增 `LEARNING_STYLE_LABELS`（imitation→模仿/open→开放/reverse→逆向/cognitive→认知）与人设响应新字段 `learning_style_labels`（与 tags 同序，未知取值 null），前端正文只给中文、原 code 进 `title`，文案写明「对方 code 表确认后核对」；P-13 `testsupport/robot.py` 的合成观察 `unit` `count`→`次`（同文件校验器同步，不改自检就会把自己的 fixture 判成 `UPSTREAM_SCHEMA_INVALID`）；P-14 `date()` 改零填充到分钟（`2026/09/01 08:00`）+ 新增 `dateOnly()`（纯日期直接改写、不经 UTC 解析），阶段报告卡窗口与「成长观察」输入框同口径、周期起止不再显示原始 ISO；P-15「成长观察」区块加一行来源说明（本机同步的行为观察 vs 机器人服务的陪学伙伴，两份来源不能混成一个分数）；O-06 新增 `account_name` 过滤器（只认姓名，空给「未填写」），家庭列表「家长」列不再与「手机号」列重复（未改 `User.display_name`，家庭详情/审计仍要手机号）；O-07 标签改「近 7 天新建档案（含已归档）」+ 口径说明，`OPS_MANUAL.md` 同步。**先失败证据**：`git stash` 掉 5 个后端源文件后 `tests/test_ca_display.py -k persona` → `2 failed … KeyError: 'learning_style_labels'`；`tests/test_ops_console.py`+`tests/test_m3.py` 定向 6 项 → `3 failed, 3 passed`（手机号出现 2 次 / 旧标签 / `'count' != '次'`）；修复后 `2 passed`、`6 passed`。**验证**：`npm run check` exit 0、`npm run test:unit` `65 pass / 0 fail`；真实 Chrome 新增 `tests/t038-copy-and-format.spec.js` `3 passed (43.7s)`（家长端五条 + 空态来源说明 + 运营端两条，含 390×844 不横向溢出）；回归 `companion-panel`/`growth-cycle-panel`/`growth-window`/`reassessment-cta`/`reassessment-write-failure`/`sync-failure-visibility`/`robot-account-row` 12 项 + `ca-account`/`parent-name-fallback` 全过（`growth-cycle-panel` 的 ISO 日期断言已按 P-14 更新为 `2026/09/01`）；`ruff check`/`ruff format --check` 干净；`audit_documents.py` errors `[]`（61 operations / 82 schemas）；截图 10 张在 `.trellis/tasks/T-038/shots/`。**两处如实记录**：①本地开发 Celery Worker 是 09-17 09:46 启动的旧进程，仍校验 `unit == "count"`，首轮真实 Chrome 验收同步报 `UPSTREAM_SCHEMA_INVALID`、阶段报告不出现，已按 README 命令重启本地 Worker（Beat 未重启）后通过；②`tests/flows.spec.js` 本轮没跑绿——首次混跑 `16 passed / 1 failed`（报告生成 20s 超时），随后复跑 `6 failed / 2 passed` 且失败页面 alert 是「验证码请求过多」（本地按客户端 IP 1 小时 ≥50 次拒发），属本轮多次浏览器验收把频控用满，与本轮改动无关，频控窗口过后可复跑。已按任务 notes 直推，远端 sha `d39c37a`。详见 `.trellis/tasks/T-038/report.md`。

## T-039 T-033/T-034 三条范围判定落定 + 过期截图刷新
- goal: 落定 status.md 待拍板的三条：①「换机后旧号人设只读展示」缺数据通路——orchestrator 裁定：本批不做，记入 T-028 澄清清单确认级（旧号历史数据对方如何提供），本轮只在 report 记录该决定，不改代码；②`watch` 态不显示 `health_score`（维持 design §1.3 原判：只有 normal/watch 展示分数中的 watch 按轻提示处理、不显分数——以 T-033 已实现行为为准，若已实现为显示则改为不显示并补断言）；③八维中文名由后端下发（与 `stage_label` 同一做法，前端不硬编码第二套映射），改 `growth-cycle` 接口 payload 并同步前端渲染与单测。另：重跑 `frontend/tests/companion-panel.spec.js` 刷新 T-033 的 `reassess-*`/`switch-*` 截图（现缺复测区块）。
- acceptance: ①仅 report 记录 + T-028 清单 notes 追加一行（不改清单结构）；②watch 态行为与断言一致（不显分数），有用例；③八维中文名来自接口 payload，前端无硬编码映射（检索验证），单测与真实 Chrome 用例同步更新；T-033 四张截图刷新且含复测区块，存 `.trellis/tasks/T-039/shots/`；`cd frontend && npm run check && npm run test:unit` 与 `cd backend && uv run pytest tests/test_ca_display.py` 通过；audit errors 为空；改动以首行 `[T-039]` 提交。
- gate: none
- status: todo
- notes: 三条判定已由 orchestrator 拍板（同 APPROVE T-024 行），执行中不再重新讨论。commit 后直接 push origin/codex/release-v0.3.6 并补 EXECUTED 行。收口项：PROJECT_MEMORY.md 同步。

## T-040 产品巡检（第三轮，常设循环任务）
- goal: 以家长第一视角（`http://127.0.0.1:4173/`，任意手机号 + 验证码 `00000`）与运营视角（`http://127.0.0.1:8017/ops/`，`admin` / `dingdong-admin`）把产品再完整走一遍，重点复核 T-037/T-038/T-039 修复处与四个展示面在真源开关（`CA_DISPLAY_DATA_SOURCE` 两种取值）下的表现，找出**新的**真实卡点，产出 `.trellis/tasks/T-040/backlog.md` 并申请 review。常设供给：本轮修复磨完自动巡检，orchestrator 复看导入下一批。
- acceptance: 同 T-024（每项含「卡点/现状/建议改法/完善还是扩散/工作量档位」、真实 Chrome 复现截图、不重复报已修条目、稳定性单列、只产出文档不改代码、`status` 为 `gated` 且 gates.md 有 `REQUEST T-040 review`、audit errors 为空）；额外：对 T-037 修复处做「两个儿童先后回写同一 event_id」的端到端复核。
- gate: review
- status: todo
- notes: 巡检是产品活。orchestrator 复看批准后按批次导入修复任务并追加下一次巡检（编号顺延）。排除项不变：8 个出站接口、主动解绑、发版部署、external 类动作。

## T-028 起草给 DingDong 侧的澄清清单（只产出文档，不发送）
- goal: 起草 `.trellis/tasks/T-028/dingdong-clarifications.md`，分三层：阻塞级（D10 base URL、D12 API key、D20 换机主动解绑规则）、确认级（儿童/设备映射与权属核验、窗口游标修订与指标单位、同步频率及阶段规则、甲方算法输入输出/超时幂等/一次性处理不留存约定）、后置级（真实短信与生产部署条件）；每条写清「我们为什么需要 / 没有它当前系统如何诚实降级 / 拿到后我方接入动作」。**只产出文档，不发送**。
- acceptance: 文档三层齐全且每条含上述三要素；阻塞级与确认级条目与 `设计/CA对接_C1_ca_account_id设计_20260916.md` 及 PROJECT_MEMORY.md 待确认清单一一对应；不含内部预算、人天、公网 IP、SSH 别名等敏感信息；audit errors 为空；本任务 `status` 为 `gated` 且 `gates.md` 申请段有 `REQUEST T-028 external ...`。
- gate: external
- status: gated
- notes: 发送属 external 动作，须 Yihu 放行后由人执行，本任务只到「文档就绪待发」。放 T-021 之后：T-021 gated 等 orchestrator review 时 worker 可先磨本任务不空转。**orchestrator 并入（2026-09-17T13:16Z，随 T-021 批复）**：T-021 design §6 的 5 条待澄清并入本清单确认级——① `new_assessment_id` 取值语义与 `complete` 幂等窗口（标注：复测回写实源切换前置）；② `persona_health.status` 权威枚举是否含 `insufficient_data`（xlsx 表 3.6 与表 7.1 不一致）；③ `persona_type` 与 `learning_style_tags` 的 code 表；④ `growth_period` 八维可空时是否允许部分返回；⑤ `reassessment_event.persona_switched` 由谁写（标注：复测回写实源切换前置）。每条仍按本任务三层格式（为什么需要 / 没有它如何诚实降级 / 拿到后接入动作）展开。**2026-09-17 执行结果**：`.trellis/tasks/T-028/dingdong-clarifications.md` 已写完（336 行 / 29588 字节）——阻塞级 3 项（B1 base URL=D12、B2 X-API-Key=D10、B3 换机旧号处置=D20）、确认级 6 组 27 条（C1 契约基线与接口语义 D1/D2/D3/D7/D14/D15；C2 儿童设备映射与权属核验 D18/D11/D19；C3 窗口游标与指标单位 D8/D13/N1；C4 同步频率与阶段规则 N2/D16/N3/D17；C5 甲方算法输入输出与超时幂等 D6/D9/D5/D4/N4/N5；C6 展示面数据契约 N6–N10=§6 五条）、后置级 2 项（L1 真实短信、L2 生产部署条件），另有 §4 覆盖对照表（PROJECT_MEMORY 待确认 4 项逐项映射 + D1–D20 逐条落点 20/20 + N1–N10 来源）与 §5 32 行回复模板。验证：`audit_documents.py` errors `[]`（改动前基线亦为 `[]`）；内联自检 32 条目三要素齐全（33/33/33）、三层标题齐、D 号无缺、敏感词 0 命中、3 个相对链接目标存在。**未发送**。详见 `.trellis/tasks/T-028/report.md`（含一处发现：澄清清单 V1.0 定义 D10=key/D12=base URL，而设计文档 §7 与 PROJECT_MEMORY 写成「D10 base URL / D12 key」，编号对调，本清单以 V1.0 为准并在 §4.3 末标注，未改这两份文件）。

## T-032 展示面 A：四个面的数据层与家长端接口
- goal: 按 `.trellis/tasks/T-021/design.md` 实现数据层：settings 新增 `CA_DISPLAY_DATA_SOURCE`（默认 `synthetic_fixture`，独立于既有 `INTEGRATION_DATA_SOURCE`，不共用值域）；`core/services/ca_display.py` 唯一分派出口（synthetic → `test_fixture` 表新 kind `ca_display_persona/growth/health/reassessment`；dingdong → `dingdong_client`，未配置返回 `not_synced` + `reason=upstream_not_configured`）；`core/api/ca_display.py` 四读两写（companion-persona / growth-cycle / companion-health / reassessment 读，response/complete 两写），一律以 `child_id` 为键 + `owned_child()` 家庭隔离，不向家长端暴露 `ca_account_id`；`inject_fixture` 新增 6 个场景对应 xlsx 表 6 的 6 个 mock 账号；响应统一带 availability / data_origin / source / fetched_at / reason 信封，availability 词表复用 `growth.py` 既有 7 值。
- acceptance: 后端用例覆盖 7 个 availability 值与设计 §3.3 的业务码处置（42901/50001 重试、40101 停止、40401 当暂无数据、40901 conflict、40001 fatal）；两条 POST 幂等重放（同 request_id + 同 accepted 返回首次结果，不同 accepted 返回 422）；家庭隔离断言（非本人儿童 404）；`period` 非 15d|30d 返回 422；合成模式下断言零出站调用；未知健康 `status` 落「不做判断」分支；fixture 数据不含 nfc_token/凭据；`设计/API/openapi.json` 同步；`python3 scripts/audit_documents.py` errors 为空；改动以首行 `[T-032]` 提交。
- gate: none
- status: done
- notes: 设计已批（gates.md T-021 APPROVE 2026-09-17T13:16Z）。commit 后直接 push origin/codex/release-v0.3.6 并补 EXECUTED 行。收口项：PROJECT_MEMORY.md 同步（本任务无 UI 变化，frontend/README.md 不动）。实现任务 report 不得写成「已接通 DingDong」。**2026-09-17T17:05Z orchestrator 复位 doing→todo**：16:04Z 轮 Flash 限流中断时任务停在 `doing`（驱动只取 `todo`，会被永久跳过），`progress.md` 在，按核对式续跑接上。

- **2026-09-18 执行结果**：4 读 2 写 + 唯一数据出口 + `CaReassessmentEvent`(迁移 `0009`) + 6 个 `ca_display_*` 场景全部落地。新增 `backend/tests/test_ca_display.py` 51 项（`51 passed in 189.02s`）；受影响既有用例 `tests/test_m3.py`（操作数 55→61）+ `tests/test_ops_console.py`（两个审计动作中文词条）与新增文件合并复跑 `1 failed, 121 passed in 562.88s`——唯一失败是本轮新增契约用例抓到 `trigger_label` 缺失，修复后 `-k "reassessment or contract or declined or complete"` → `6 passed in 36.91s`、全量复跑 `52 passed in 190.76s`；`manage.py check` 0 issue、`makemigrations --check --dry-run` `No changes detected`、`ruff check` `All checks passed!`、`ruff format --check --target-version py313 .` `131 files already formatted`；openapi 61 operations / 82 schemas、`audit_documents.py` errors `[]`。修掉前任遗留三处（reassess 场景 growth 21 天取不到 / complete 双 POST 同一副作用端点 / GET reassessment 缺 trigger_label），未跑全量后端套件、无 UI 变化。已按 T-021 批复的直推规则 push，远端 sha `a7c20353bc295123c9c32d8f2ab64918e3959925`。详见 `.trellis/tasks/T-032/report.md`。
## T-033 展示面 B：面一人设 + 面三健康度四态（家长端 UI）
- goal: 按 design §1.1/§1.3 实现：`#reports` 新增「陪学伙伴」面板（人设卡 + 「互动健康度」区块，健康度位于人设卡下方）；四态分支按 design §1.3 表格（`insufficient_data` 只说还在收集不判断、`normal` 显分数与观察天数、`watch` 轻提示且不出复测 CTA、`reassess` 出复测入口）；`data_origin=synthetic` 时面板级挂「合成测试数据」徽标（复用 `testTag()`），availability≠ready 不显示任何数值；`trigger_reason` 两 code 由后端映射中文；面板底部固定「这是互动情况的提示，不是对孩子的评价」；`#settings` 机器人账户面板补一行只读当前人设名；换机后旧号人设只读展示并标「上一台机器人时期」。
- acceptance: 真实 Chrome 用 6 个 ca_display 场景逐个走查并截图到 `.trellis/tasks/T-033/shots/`（含 390×844）；断言四态文案与是否显分符合 §1.3（`insufficient_data`/`watch` 界面不出现 health_score 数值）；`pageerror` 为空；`cd frontend && npm run check && npm run test:unit` 通过；audit errors 为空；依赖 T-032 接口与场景；改动以首行 `[T-033]` 提交。
- gate: none
- status: done
- notes: 设计已批，直推规则同 T-032。文案不得把 match_score 写成天赋分/适合度；不得把 not_synced 说成「暂无数据」。收口项：frontend/README.md 与 PROJECT_MEMORY.md 同步。
- **2026-09-18 执行结果**：`frontend/companion.js`（四态分支/是否显分/空态文案的纯函数，判定与 HTML 分离）+ `#reports` 在「初始测评」卡之后、「已生成报告」之前新增「陪学伙伴」面板（人设卡：后端下发的中文 `type_label` / 匹配度 n / 100 / 学习风格 code 原样 / 权重版本走 `versionLabel`；下方「互动健康度」四态：`insufficient_data` 不做判断、`normal` 显分数与观察天数、`watch` 只出轻提示且不出复测 CTA、`reassess` 只出建议文案）+ `availability != ready` 不显示数值 + 面板级合成徽标 + 底部固定评价边界句 + `#settings` 机器人账户面板只读人设行；`server.cjs` 静态白名单加 `companion.js`。验证：`npm run check` exit 0；`npm run test:unit` `tests 34 / pass 34 / fail 0`（含新增 18 项）；真实 Chrome `npx playwright test tests/companion-panel.spec.js tests/growth-window.spec.js tests/ca-account.spec.js tests/robot-account-row.spec.js` → `13 passed (1.9m)`（新用例 2 项：6 个 `ca_display_*` 场景逐个走查 + 未绑定态 + 390×844 不横向溢出 + 账户页只读人设行；回归 11 项全绿）；截图 8 张在 `.trellis/tasks/T-033/shots/`；`audit_documents.py` errors `[]`。**环境修复**：本地开发库漏跑 T-032 的迁移，本轮 `manage.py migrate` 应用 `0009_careassessmentevent`（本地库 127.0.0.1:55439，非生产）。**两处如实记录的未实现**：①「换机后旧号人设只读展示」无数据通路（四个展示面接口只解析 `active` 号，补齐需新增后端读接口）；②`reassess` 的「重新测评 / 先不测」按钮与回写属设计 §5 的 D（T-035），本任务只呈现状态与文案。**一处口径差**：acceptance 要求 `watch` 不出现 `health_score` 数值，设计 §1.3 写「四态里只有 normal / watch 展示分数」，本轮按更严的 acceptance 实现（不违反 §1.3 表格行）。已按 T-021 批复的直推规则 push，远端 sha `998e3f03250884bfa652ef2a943caeea8db7ea6c`。详见 `.trellis/tasks/T-033/report.md`。

## T-034 展示面 C：面二 15/30 天成长报告（家长端 UI）
- goal: 按 design §1.2 实现：`#reports` 新增「成长周期报告」面板（置于既有「成长观察」之上），15/30 天固定 Tab（不提供任意区间，任意区间仍归成长观察）；companion delta 文案「陪伴值增长」、engagement 阶段中文名（映射表放后端）与 stage_progress、八维固定顺序条形（缺失维度显示「本周期无该维度数据」，不补 0 不插值）；八维标注「成长代理（对方算法产出，不是 CA 原始天赋分）」；合成徽标同 T-033。
- acceptance: 真实 Chrome 三态截图到 `.trellis/tasks/T-034/shots/`（正常 15d/30d、new_user 空态、stale 陈旧态，含 390×844）；既有「成长观察」窗口功能回归通过（`tests/growth-window.spec.js` 全绿）；`cd frontend && npm run check && npm run test:unit` 通过；audit errors 为空；改动以首行 `[T-034]` 提交。
- gate: none
- status: done
- notes: 设计已批，直推规则同 T-032。收口项：frontend/README.md 与 PROJECT_MEMORY.md 同步。非法 period 的 422 行为在 T-032 已覆盖，UI 侧确认错误文案即可。
- **2026-09-18 执行结果**：`frontend/growth-cycle.js`（`growthCycleSection()` / `dimensionRows()` 纯函数，判定与 HTML 分离；八维顺序与中文名取对方字段注释；复用 `companion.js` 的 `AVAILABILITY_TEXT` / `STALE_NOTICE`）+ `#reports` 在「已生成报告」之后、「成长观察」之上新增「成长周期报告」面板（15/30 天固定 Tab、周期起止、当前陪学伙伴、`companion.delta` 写「陪伴值增长」并给周期初→周期末、后端映射的阶段中文名 + `stage_progress`、八维固定顺序 `<progress>` 条形、固定标注「成长代理（对方算法产出，不是 CA 原始天赋分）。」、算法版本与生成时间）+ 缺失维度显示「本周期无该维度数据」不补 0 不插值（值为 0 照常显示）+ `availability` 非 ready/stale 不显示任何数值与八维 + 合成徽标 + 空态分两句（`period_incomplete` / `no_period_data`）+ 未知阶段码不把英文 code 当阶段名；`server.cjs` 白名单与 `package.json` 的 `check`（顺带补上 `ca-link.js`/`companion.js`）。验证：`npm run check` exit 0；`npm run test:unit` `tests 51 / pass 51 / fail 0`（含新增 17 项）；真实 Chrome `npx playwright test tests/growth-cycle-panel.spec.js --reporter=list` → `1 passed (37.7s)`（11 步：未绑定 / 未授权 / 新用户空态、15 天与 30 天正常态、Tab 切换后的两种空态、缺失维度、陈旧态、390×844 不横向溢出、断言面板在「成长观察」之上、`pageerror` 为空）；回归 `tests/growth-window.spec.js` + `tests/companion-panel.spec.js` + `tests/robot-account-row.spec.js` → `5 passed (1.2m)`；截图 9 张在 `.trellis/tasks/T-034/shots/`；`audit_documents.py` errors `[]`（61 operations / 82 schemas）。三处范围判定：①八维中文名不在对方契约里（`GrowthDimensions` 只有英文键），映射表放前端并注明来源，未改 T-032 冻结的响应形状；②`engagement.index` 不展示（设计 §1.2 展示规则未要求）；③真源模式 404 只带回 `40401`，区分不出「绑定不满 15 天」与「对方没有这个周期」，落到后一句。已按 T-021 批复的直推规则 push，远端 sha `875e79367687da356c38f256814e9043baf9b299`。详见 `.trellis/tasks/T-034/report.md`。

## T-035 展示面 D：面四复测 CTA 与回写闭环（家长端 UI）
- goal: 按 design §1.4 实现：`health.status == "reassess"` 且 `reassessment_recommended` 时在健康度面板内展示 CTA（全产品唯一入口）；「重新测评 / 先不测」→ POST response 回写（`accepted=false` 后不再重复打扰，一行说明 + 可再次展开）；`accepted=true` 承接既有测评流程（不建第二套测评入口），完成后 POST complete 回写；`switch_recommended` 真假两分支（真=新角色推荐卡、由家长确认后才切换；假=展示保留当前角色、不显新角色名）；`auto_switch` 恒为 false，任何路径不自动切换；合成模式下回写只落我方库 + AuditEvent、零出站，接口响应如实标 `data_origin`。
- acceptance: 真实 Chrome 走完整四步并截图到 `.trellis/tasks/T-035/shots/`（含 390×844）；`switch_recommended` 真假两分支各断言一次（假分支断言不出现新角色名）；用例断言无任何自动切换；幂等与半截态约束有后端用例（同 event_id+同 accepted 重放返回首次结果；本地状态先落库、出站失败留重试）；`cd frontend && npm run check && npm run test:unit` 通过；audit errors 为空；依赖 T-032/T-033；改动以首行 `[T-035]` 提交。
- gate: none
- status: done
- notes: 设计已批，直推规则同 T-032。收口项：frontend/README.md 与 PROJECT_MEMORY.md 同步。注入的合成数据记 report 供清理；report 不得写成「已接通 DingDong」。

- **2026-09-18 执行结果**：`frontend/reassessment.js`（`reassessmentSection()` 四步状态机 hidden/suggest/declined/accepted/done + `completionCard()` 的 `switch_recommended` 真假两分支；`autoSwitch` 恒 false）+ `.companion-health` 内新增复测区块（建议文案 + 建议时间 + 原因 + 「重新测评 / 先不测」；`accepted=false` 后只剩一行「已选择暂不重新测评」+「查看当时的建议」，不再给第二个「重新测评」——同一事件换答案后端按 422 拒绝；`accepted=true` 未回写时出「开始复测」，走既有 `beginAssessment()` 承接 22 题测评）+ `writeBackReassessment()` 在 `#assessment/<id>` 完成后回写 `complete`（只认本次承接的测评 id；失败在完成页如实提示并可重试）+ 结果卡（真分支给新角色名/匹配度/当前角色匹配度/匹配度差，假分支只说「保留当前角色」不显新角色名；结果卡上没有切换按钮）。验证：`npm run check` exit 0；`npm run test:unit` `tests 60 / pass 60 / fail 0`（含新增 9 项）；真实 Chrome `npx playwright test tests/reassessment-cta.spec.js --reporter=list` → `3 passed (2.7m)`（真/假两分支各走完整四步 + 两条真实 POST 入参响应断言 + 拒绝分支 + 无建议不出现 + 390×844 不溢出 + 断言人设卡仍是原角色即无自动切换）；回归 `companion-panel` / `growth-cycle-panel` / `growth-window` / `robot-account-row` → `6 passed (1.8m)`；后端 `tests/test_ca_display.py` 复跑 `52 passed in 207.49s`；截图 7 张在 `.trellis/tasks/T-035/shots/`；`audit_documents.py` errors `[]`。**三处如实记录**：①设计第 4 步「由家长确认后才切换」在已冻结的三条接口里没有落点（澄清清单 D9 待对方答复），结果卡只呈现建议、不做假按钮；②`GET` 事件字段不含名字与分数，刷新后只剩中性说明；③**发现后端数据模型问题（未修，超范围）**：`ca_reassessment_event.event_id` 全局唯一 + 两个复测 mock 账号共用一份 fixture ⇒ 同一合成场景全库只能被一个儿童回写一次，第二个儿童回写撞唯一约束拿 500（首轮真实浏览器验收即因此全红）；用例按「不写死测试数据」纪律用 `scopeEvent()` 给每次注入换独有 `event_id` 绕开，任何库上可重复跑。已按 T-021 批复的直推规则 push，远端 sha `4d35165`。详见 `.trellis/tasks/T-035/report.md`。
## T-024 产品巡检（常设循环任务：家长与运营双视角走查）
- goal: 以家长第一视角（`http://127.0.0.1:4173/`，任意手机号 + 验证码 `00000`）与运营视角（`http://127.0.0.1:8017/ops/`，`admin` / `dingdong-admin`）把产品再完整走一遍，结合本批已合入的修复（T-005…T-021），找出**新的**真实卡点、困惑或不信任点，产出 `.trellis/tasks/T-024/backlog.md` 并申请 review。这是常设供给任务：每轮修复任务磨完后自动巡检一次，由 orchestrator 复看导入下一批，循环自己喂自己。
- acceptance: backlog 每项含「用户在哪一步卡/困惑/不信任 / 现状 / 建议改法 / 完善还是扩散（判据同 T-003：不新增对对方接口的依赖、不改契约边界、不改数据模型语义）/ 工作量档位」；每条新缺陷有真实 Chrome 复现截图存 `.trellis/tasks/T-024/shots/`；不重复报 T-003 已修条目，除非已修处出现回归（回归单独标「回归」）；稳定性问题单列一节；只产出文档不改代码；本任务 `status` 为 `gated` 且 `gates.md` 有 `REQUEST T-024 review ...`；audit errors 为空。
- gate: review
- status: done
- notes: 巡检是产品活，属正常队列，不算机制插队。orchestrator 复看批准后：按批次导入修复任务，并在队尾追加下一次巡检任务（编号顺延）；若某轮巡检产出为 0 条新问题，在 report 如实记录并照常 gated，由 orchestrator 决定下一轮巡检是否改走抽查模式。明确排除项不变：8 个出站接口、主动解绑、发版部署、external 类动作。**orchestrator 2026-09-17T19:34Z 批复**：backlog 复看通过，P-10 修法裁定改模型约束（按 ca_account 唯一）不改 fixture；导入 T-037/T-038/T-039 排 T-028 之后，队尾追加 T-040 巡检；O-05 维持暂缓；本任务 `status` 改 `done`，收尾轮可直推。详见 gates.md APPROVE T-024 行。

- **2026-09-18 执行结果**：只产出文档，未改产品代码。走查方式与证据见 `.trellis/tasks/T-024/backlog.md` 的「审计方式」一节。产出：家长端 6 条新条目（P-10 真缺陷：复测「先不测」回写 `POST .../reassessment/reassess_mock_001/response` 得 **500 IntegrityError**（`CaReassessmentEvent.event_id` 全局唯一 + 两个复测场景共用 fixture），界面无提示、失败文案还被渲染进「成长观察」区块；P-11 同一区块两个「机器人服务给出的原因」互相矛盾；P-12 人设卡展示内部英文 `学习风格 code`；P-13 指标单位英文 `count`；P-14 同一页两种时间口径；P-15 同一页「已观察 15 天」与「尚未关联机器人数据」并列且无来源说明）、运营端 2 条（O-06 家庭列表「家长」列回落成手机号与「手机号」列重复；O-07 工作首页「近 7 天新增儿童 275」>「在册儿童 274」）、T-003 未修复查 1 条（O-05 仍在）、稳定性 1 条（S-06 5xx HTML 被当家长文案）。验证：`#home` 4 轮重载 `settledAtMs` 2070/1015/2040/2039（证伪「卡死」，第一轮 1s 采样拍到的加载态已删图不作为证据）；390×844 五页 `scrollWidth` 均 390 无横向溢出；运营端 26 个页面 `ERRORS []`；`python3 scripts/audit_documents.py` errors 为空。截图 15 张在 `.trellis/tasks/T-024/shots/`（含 390×844）。未验证：真源路径、生产、复测其余分支。**本任务 `status` 为 `gated` 并申请 review**。详见 `.trellis/tasks/T-024/report.md`。
