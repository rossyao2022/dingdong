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
- status: todo
- notes: 设计已批，直推规则同 T-032。文案不得把 match_score 写成天赋分/适合度；不得把 not_synced 说成「暂无数据」。收口项：frontend/README.md 与 PROJECT_MEMORY.md 同步。

## T-034 展示面 C：面二 15/30 天成长报告（家长端 UI）
- goal: 按 design §1.2 实现：`#reports` 新增「成长周期报告」面板（置于既有「成长观察」之上），15/30 天固定 Tab（不提供任意区间，任意区间仍归成长观察）；companion delta 文案「陪伴值增长」、engagement 阶段中文名（映射表放后端）与 stage_progress、八维固定顺序条形（缺失维度显示「本周期无该维度数据」，不补 0 不插值）；八维标注「成长代理（对方算法产出，不是 CA 原始天赋分）」；合成徽标同 T-033。
- acceptance: 真实 Chrome 三态截图到 `.trellis/tasks/T-034/shots/`（正常 15d/30d、new_user 空态、stale 陈旧态，含 390×844）；既有「成长观察」窗口功能回归通过（`tests/growth-window.spec.js` 全绿）；`cd frontend && npm run check && npm run test:unit` 通过；audit errors 为空；改动以首行 `[T-034]` 提交。
- gate: none
- status: todo
- notes: 设计已批，直推规则同 T-032。收口项：frontend/README.md 与 PROJECT_MEMORY.md 同步。非法 period 的 422 行为在 T-032 已覆盖，UI 侧确认错误文案即可。

## T-035 展示面 D：面四复测 CTA 与回写闭环（家长端 UI）
- goal: 按 design §1.4 实现：`health.status == "reassess"` 且 `reassessment_recommended` 时在健康度面板内展示 CTA（全产品唯一入口）；「重新测评 / 先不测」→ POST response 回写（`accepted=false` 后不再重复打扰，一行说明 + 可再次展开）；`accepted=true` 承接既有测评流程（不建第二套测评入口），完成后 POST complete 回写；`switch_recommended` 真假两分支（真=新角色推荐卡、由家长确认后才切换；假=展示保留当前角色、不显新角色名）；`auto_switch` 恒为 false，任何路径不自动切换；合成模式下回写只落我方库 + AuditEvent、零出站，接口响应如实标 `data_origin`。
- acceptance: 真实 Chrome 走完整四步并截图到 `.trellis/tasks/T-035/shots/`（含 390×844）；`switch_recommended` 真假两分支各断言一次（假分支断言不出现新角色名）；用例断言无任何自动切换；幂等与半截态约束有后端用例（同 event_id+同 accepted 重放返回首次结果；本地状态先落库、出站失败留重试）；`cd frontend && npm run check && npm run test:unit` 通过；audit errors 为空；依赖 T-032/T-033；改动以首行 `[T-035]` 提交。
- gate: none
- status: todo
- notes: 设计已批，直推规则同 T-032。收口项：frontend/README.md 与 PROJECT_MEMORY.md 同步。注入的合成数据记 report 供清理；report 不得写成「已接通 DingDong」。

## T-024 产品巡检（常设循环任务：家长与运营双视角走查）
- goal: 以家长第一视角（`http://127.0.0.1:4173/`，任意手机号 + 验证码 `00000`）与运营视角（`http://127.0.0.1:8017/ops/`，`admin` / `dingdong-admin`）把产品再完整走一遍，结合本批已合入的修复（T-005…T-021），找出**新的**真实卡点、困惑或不信任点，产出 `.trellis/tasks/T-024/backlog.md` 并申请 review。这是常设供给任务：每轮修复任务磨完后自动巡检一次，由 orchestrator 复看导入下一批，循环自己喂自己。
- acceptance: backlog 每项含「用户在哪一步卡/困惑/不信任 / 现状 / 建议改法 / 完善还是扩散（判据同 T-003：不新增对对方接口的依赖、不改契约边界、不改数据模型语义）/ 工作量档位」；每条新缺陷有真实 Chrome 复现截图存 `.trellis/tasks/T-024/shots/`；不重复报 T-003 已修条目，除非已修处出现回归（回归单独标「回归」）；稳定性问题单列一节；只产出文档不改代码；本任务 `status` 为 `gated` 且 `gates.md` 有 `REQUEST T-024 review ...`；audit errors 为空。
- gate: review
- status: todo
- notes: 巡检是产品活，属正常队列，不算机制插队。orchestrator 复看批准后：按批次导入修复任务，并在队尾追加下一次巡检任务（编号顺延）；若某轮巡检产出为 0 条新问题，在 report 如实记录并照常 gated，由 orchestrator 决定下一轮巡检是否改走抽查模式。明确排除项不变：8 个出站接口、主动解绑、发版部署、external 类动作。
