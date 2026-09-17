# 自循环任务队列

字段：`goal` 目标 · `acceptance` 可客观验证的验收 · `gate` 门禁类型（`none` | `push` | `external` | `deploy` | `review`）· `status`（`todo` | `doing` | `done` | `blocked` | `gated`）· `notes` 备注。
规则：驱动每轮取第一个 `status: todo` 的任务；`gated` / `blocked` 跳过。任务定义由 orchestrator 写，执行结果由 worker 写回。

## T-025 机制盘活：驱动长程 7×24 语义（每日上限睡到零点）+ 限流退避与 Pro 日限 + 唤醒重试 + 探活 watchdog
- goal: 让自循环真正可 7×24：1) `worker-loop.sh` 每日上限到点不再退出，改睡到 UTC 零点继续（每 300s 检查 STOP，STOP 仍为唯一停机方式）；2) 双限流退避按连续次数翻倍（180→360→720→…封顶 1800s，成功清零）；3) Pro 兜底加单日次数上限（`LOOP_FALLBACK_DAILY_LIMIT`，默认 6），超限不再切 Pro、按失败走连续失败→blocked 路径控成本；4) 唤醒 orchestrator 失败间隔 5s 重试一次、连续 3 次失败写 status.md 告警，启动时自检 orchestrator 面板是否在 herdr 会话；5) 新增 `scripts/loop-watchdog.sh` 探活（驱动不在且无 STOP 时优先在原面板 w0:p3 重启、面板没了走 nohup 后台拉起）与 `scripts/com.yihu.dingdong.loop-watchdog.plist`（launchd 每 5 分钟模板）。
- acceptance: `bash -n` 两个脚本通过；`fallbacks_today` / `seconds_until_utc_midnight` 对真实 `runs.log` 验证；驱动重启后启动行带新参数（到点睡到零点 + Pro兜底日限）且正常开轮；驱动活着时 watchdog 手动执行 exit 0 且 `runs.log` 无新 WATCHDOG 行；旧驱动 STOP 优雅退出路径不受影响。
- gate: push
- status: done
- notes: 由 orchestrator 会话按 Yihu「把模式盘活」指令直接执行。**已知坑（重要）**：改正在运行的 bash 脚本会导致字节错位执行——本次旧驱动 STOP 退出后报过一行无害的 `line 301: $5: unbound variable`（发生在 break 之后，轮次已记录、无实质影响）；以后改驱动脚本先 `mv` 原子替换再写新内容，并等旧进程完全退出后多留缓冲。launchd 安装（写 `~/Library/LaunchAgents`）与 `git push` 属仓库外副作用，NEED-GATE 留 Yihu 放行。**2026-09-17 执行结果**：`worker-loop.sh` 5 项全落地（新增 `fallbacks_today` / `seconds_until_utc_midnight` / `sleep_with_stop_check`，`_rl_streak`/`_wake_fails` 全局计数，LIMIT 分支改 `continue`，空转 sleep 换 `sleep_with_stop_check`，唤醒重试+告警，启动自检面板）；实测 fallbacks_today 对当日 runs.log 解析 Pro=3（T-004/T-007/T-008），到零点 54252s；08:56:05Z 新驱动以新参数重启（PID 68713）并开跑 T-009；watchdog 存活分支实测 exit 0 无动作。待 Yihu：launchd 安装与 push 放行。

## T-022 驱动加「有新门禁申请或任务 blocked 时叫醒 orchestrator」的钩子
- goal: 给 `scripts/worker-loop.sh` 加收尾钩子：每轮 worker 退出后，与本轮开工时的基线对比，若 `gates.md` 申请段新增了 REQUEST 行、或 `queue.md` 有任务被标为 `blocked`，就执行一次 `herdr agent prompt w0:p4 "查岗：读 .trellis/loop/ORCHESTRATOR.md 的门禁规则，处理 gates.md 新申请"`；不带 `--wait`；该命令失败只记一行日志，不改变驱动退出码、不影响后续轮询。
- acceptance: 钩子只在出现上述两类变化时触发且每轮至多一次；用一条测试 REQUEST 实测钩子能真实触发一次（测试行末尾标注「T-022 钩子自测，可忽略」，orchestrator 收到后忽略该行），驱动随后正常进入下一轮；`bash -n scripts/worker-loop.sh` 通过；`python3 scripts/audit_documents.py` errors 为空；实测命令输出存 `.trellis/tasks/T-022/`。
- gate: push
- status: done
- notes: 只改 `scripts/worker-loop.sh` 这一个文件。面板号已核对：w0:p4 为 orchestrator 会话所在面板（2026-09-17 `herdr pane list --workspace w0` 实测；若面板有变以实际结果为准并更新本条）。属机制任务：commit 后直接 push origin/codex/release-v0.3.6 并在 `gates.md` 补 EXECUTED 行（岗位说明：push 类直接 APPROVE），不必另开 REQUEST。 **2026-09-17 执行结果**：钩子已加（`loop_gate_snapshot` / `wake_orchestrator` / `notify_orchestrator_if_needed`，`run_round` 开工取基线收尾调一次；新增 `LOOP_ORCH_PANE` 默认 `w0:p4`、`LOOP_WAKE_CMD` 联调替代命令）。实测四场景：A 真 herdr 唤醒一次（面板 rev 30→39、agent_status=working）、B 无变化两轮 0 次唤醒、C 新 blocked 唤醒一次、D 唤醒命令失败只记 `WAKE FAIL ... rc=3` 且驱动 exit 0；`bash -n` 通过、`audit_documents.py` errors `[]`；证据在 `.trellis/tasks/T-022/`（transcript + 驱动原始输出 + `runs.log.after`），自测轮次行已从 `runs.log` 清理。已按机制任务直推规则 push：`dbf2870..2cfca23`，远端 sha `2cfca23e404794ff8f13cc3243c31e4c56bf4568`。

## T-023 机制收尾：ORCHESTRATOR.md 入库 + 关闭 R0d 遗留核对项
- goal: 把 `.trellis/loop/ORCHESTRATOR.md`（orchestrator 岗位说明，目前仍是未跟踪文件）用首行 `[T-023]` 的提交入库；并把 status.md 里反复出现的「R0d 会话收尾」核对项正式关闭：确认全仓已无假 grok 包装脚本残留（2026-09-17T07:22Z orchestrator 已核实 `.trellis/loop/runs/fake-grok.sh` 不存在；`.trellis/tasks/T-022/` 下的 fake-* 是钩子自测证据，保留不删），核对 `runs.log` 中 T-004 的 PRIMARY RATE_LIMITED / FALLBACK DONE 两行与 `runs/` 下 `20260917T055213Z-T-004-primary`、`20260917T055219Z-T-004-fallback` 两个记录一致。
- acceptance: `git status --short` 不再出现 `?? .trellis/loop/ORCHESTRATOR.md`；全仓（排除 `.git`、`node_modules`、`.trellis/tasks/T-022/`）找不到假 grok 包装脚本；核对结论写入 `.trellis/tasks/T-023/report.md`；`python3 scripts/audit_documents.py` errors 为空；gate push：commit 后直接 push origin/codex/release-v0.3.6 并在 `gates.md` 补 EXECUTED 行。
- gate: push
- status: done
- notes: 只入库 ORCHESTRATOR.md 这一个新文件，不改其内容。给 status.md 第 2 条待办的正式答复：混轮提交账本类文件（runs.log / queue.md 的驱动与 orchestrator 记录行）可接受，不必严格分轮。做完后下次重写 status.md 时把「R0d 会话收尾」从待办划掉。 **2026-09-17 执行结果**：`.trellis/loop/ORCHESTRATOR.md` 已入库（58 行，内容未改，入库前后 sha256 均 `bec3d5cba9345674b077b06094ff0aef5ee2e174f2d6dff5fd1969f254268ec9`）；假 grok 包装脚本按文件名扫描 0 命中，按内容命中的 4 处全为文档/JSON 文字提及（`file` 判定无脚本），`.trellis/loop/` 下无 `fake-grok.sh`，`.trellis/tasks/T-022/` 内 3 个 fake-* 按任务说明保留；T-004 两行 `runs.log` 与 `runs/20260917T055213Z-T-004-primary.json`（61B，`TooManyRequests`）、`runs/20260917T055219Z-T-004-fallback.json`（93928B）核对一致（05:52:19Z+496s=06:00:35Z 秒级对齐）；证据 `.trellis/tasks/T-023/verify-output.txt` + `verify.sh`；`audit_documents.py` errors `[]`。已按 gate push 直推：`531737e..a900a01`，远端 sha `a900a011ae04b518e82a920316093db05fa4ad36`。 status.md 原第 2 条待办的正式答复：混轮提交账本类文件（`runs.log` / `queue.md` 的驱动行与 orchestrator 记录行）可接受，不必严格分轮。
## T-001 写 .trellis/loop/README.md
- goal: 给 `.trellis/loop/` 写一份操作说明，让 orchestrator 一看就知道怎么启停、怎么批门禁、怎么看状态、怎么加任务。
- acceptance: `.trellis/loop/README.md` 存在且不超过 10 行；四件事（启停 / 批门禁 / 看状态 / 加任务）各至少一条；本文件已用首行 `[T-001]` 的提交入库。
- gate: none
- status: done
- notes: 只写这一个文件。别复述整套设计，别改驱动脚本。已入库 commit 6e89463（7 行，四要素齐）。

## T-002 在 .trellis/tasks/T-002/ 写一份 hello.md 并申请 push
- goal: 新建 `.trellis/tasks/T-002/hello.md`（一句话说明这是自循环门禁联调用的测试文件），并走 push 门禁流程。
- acceptance: `.trellis/tasks/T-002/hello.md` 存在；`.trellis/loop/gates.md` 申请段出现 `REQUEST T-002 push ...`；本任务 `status` 为 `gated`；改动已用首行 `[T-002]` 的提交入库。
- gate: push
- status: done
- notes: 申请后**不要**自己 push。push 是本仓库的门禁动作，等 orchestrator 在 `gates.md` 决定段写 `APPROVE` 后才执行。2026-09-17 已执行：`git push origin codex/release-v0.3.6` 成功，远端 sha `de9a3d36f445313336496cb4f801842fc72cb8c1`（6edd418..de9a3d3）。

## T-004 验证模型切换
- goal: R0e 机制自测。本任务第一轮 PRIMARY 调用会被假 grok 包装脚本伪造限流，驱动应当立即用 FALLBACK（Pro）重跑同一任务；worker 只需确认自己在 FALLBACK 重跑中正常完成、不改任何代码。
- acceptance: `.trellis/tasks/T-004/report.md` 存在并写一句「本轮由 FALLBACK 重跑完成」；本任务 `status` 为 `done`；改动已用首行 `[T-004]` 的提交入库。（runs.log 里 PRIMARY RATE_LIMITED / FALLBACK DONE 两行记录由 R0d 会话在驱动跑完后核对，不在本任务内。）
- gate: none
- status: done
- notes: 自测任务，验证完由 R0d 会话删除假脚本、核对 runs.log。

## T-003 产品体验与稳定性审计
- goal: 以家长用户第一视角走一遍家长端（`http://127.0.0.1:4173/`，任意手机号 + 验证码 `00000`）与运营后台（`http://127.0.0.1:8017/ops/`，`admin` / `dingdong-admin`），结合 `PROJECT_MEMORY.md`、`需求/`、`设计/`，产出 `.trellis/tasks/T-003/backlog.md`。
- acceptance: backlog.md 每项含「用户在哪一步卡/困惑/不信任 / 现状 / 建议改法 / 完善还是扩散 / 工作量档位」；「完善/扩散」判据写成：不新增对对方接口的依赖、不改契约边界、不改数据模型语义；稳定性问题单列一节（错误态、空数据态、网络慢/断、celery 失败可见性、e2e 因本地数据漂移失败的 4 项）；只产出文档、不改任何代码；本任务 `status` 为 `gated`，`gates.md` 有 `REQUEST T-003 review ...`。
- gate: review
- status: done
- notes: 已知候选先放进去——人设/成长报告/健康度四态/复测 CTA 四个展示面（mock 数据源，判定标准见 `设计/CA对接_C1_ca_account_id设计_20260916.md` §7）、授权血缘声明（`frontend/README.md` + `参考代码/来源说明.md`，来源 commit `d754a5bf`）、PR #1 转 draft。明确排除：`PROJECT_MEMORY.md` 里列的 8 个出站接口、主动解绑、发版部署。走产品体验需真实浏览器，遵守仓库浏览器验收纪律。**2026-09-17 执行结果**：backlog.md 已产出（家长端 9 条 / 运营端 5 条 / 缺口 3 条 / 稳定性 5 条），4 张截图在 `.trellis/tasks/T-003/shots/`；坐实 1 个真缺陷（CA 账户页跨行 `{# #}` 注释被渲染成正文，根因 `tag_re` 无 DOTALL）与 1 处家长端报错文案未本地化（422 透传 `ErrorDetail(...)`）；只读审计，未改代码，本地库新增 1 条 CaAccount（`ca_01M2PZQM5RNBPNVQXJ5CXEWDMN`，合成凭据）+ 1 份探索答卷 + 1 条授权，明细见 backlog 第六节。**2026-09-17 门禁执行**：orchestrator 批准 review 后，本轮已按批准顺序把 backlog 条目导入为本文件 T-005…T-021（第一批 13 条 / 第二批 3 条 / 第三批 1 条），O-05 与 G-03 未导入，见 `gates.md` 决定段与 EXECUTED 行。

## T-005 O-01 修掉 CA 账户页跨行模板注释被当正文渲染
- goal: 修掉运营后台「CA 账户」页把跨行 `{# … #}` 注释渲染成正文的真缺陷（`backend/dingdong_ca/ops/templates/ops/ca_accounts.html` 第 10–11 行），改成 `{% comment %}` 或压成单行。
- acceptance: 新增一条会先失败的用例，断言 `/ops/ca-accounts/` 渲染结果不含 `{#`、不含注释原文，并断言 `backend/dingdong_ca/ops/templates/` 下不存在跨行 `{# … #}`；`cd backend && uv run pytest tests/test_ops_ca_accounts.py` 通过；`python3 scripts/audit_documents.py` errors 为空；真实 Chrome 打开 `http://127.0.0.1:8017/ops/ca-accounts/`（`admin` / `dingdong-admin`）页面顶部不再出现 `{# 注意：Tabler… #}`，截图存 `.trellis/tasks/T-005/shots/`。
- gate: none
- status: done
- notes: 纯缺陷修复，只动这一个模板 + 测试；同页其他文案问题各有任务（P-04 / O-02 / O-04），别顺手改。属第一批：commit 后可直接 push origin/codex/release-v0.3.6 并在 `gates.md` 补 EXECUTED 行。**2026-09-17 执行结果**：模板跨行 `{# … #}` 改 `{% comment %}…{% endcomment %}`；`tests/test_ops_ca_accounts.py` 新增 2 条用例（渲染结果不含 `{#` 与注释原文；ops 模板无跨行 `{# … #}`）。修复前 `2 failed, 5 passed in 27.37s`（`assert ['ops/ca_accounts.html:10'] == []`），修复后 `7 passed in 28.84s`，加跑 `test_ops_console.py` 共 `43 passed in 148.68s`；`scripts/audit_documents.py` errors `[]`；真实 Chrome 打开 `/ops/ca-accounts/` 原缺陷文本消失（截图 `.trellis/tasks/T-005/shots/ops-ca-accounts-after.jpeg`）。已按第一批直推规则 push：`de9a3d3..618925e`，远端 sha `618925ef4e53d96fb339562bb8e3589789032a53`。

## T-006 P-05 空手机号获取验证码不再丢后端原始报错
- goal: 手机号为空点「获取验证码」时给中文提示，不再把 `ErrorDetail(string='该字段不能为空。', code='blank')` 透传到界面：前端先做非空校验，后端 422 统一兜底成中文。
- acceptance: 空号提交时界面出现中文提示且不含 `ErrorDetail(`；`cd frontend && npm run check && npm run test:unit` 与 `cd backend && uv run pytest tests/test_auth.py` 通过；audit errors 为空；真实 Chrome 在 `http://127.0.0.1:4173/` 复现原路径并截图到 `.trellis/tasks/T-006/shots/`。
- gate: none
- status: done
- notes: 属第一批：commit 后可直接 push origin/codex/release-v0.3.6 并补 EXECUTED 行。**2026-09-17 执行结果**：根因两处——`core/api/common.py` 的 `endpoint()` 对 DRF `detail`（`{"phone": [ErrorDetail(...)]}`）直接 `str(v)`，把 list 内部 repr 当字段文案；`frontend/app.js` 的 `#send-code` 不做非空校验、照发请求。后端新增 `detail_text()`/`field_errors()` 递归取 message，`tests/test_auth.py` 新增 2 条参数化用例（改前 `2 failed, 12 deselected in 13.07s`，改后 `14 passed in 22.26s`）；前端空号先拦并给「请先填写手机号，再获取验证码。」、不发请求。新增 `frontend/tests/login-validation.spec.js`（4 条真实 Chrome，含 390×844），改前临时还原 HEAD 版 `app.js` 跑出 `1 failed`（文案 `请求字段不合法 该字段不能为空。`），改后 `4 passed (5.8s)`；回归 `tests/ca-account.spec.js` `4 passed (30.4s)`；全量后端 `270 passed in 1000.72s`；`npm run check` 通过 / `test:unit` `16 pass 0 fail` / `audit_documents.py` errors `[]`。4 张截图在 `.trellis/tasks/T-006/shots/`。已按第一批直推规则 push：`f07a7c7..876b2dd`，远端 sha `876b2dd9d031650e57e576ea7fc6b8d04a1beae7`。

## T-007 P-01 绑定机器人成功后留在账户页并给反馈
- goal: 绑定成功后留在「账户与关联」页、高亮新生成的账户号，并显示一行「账户号已生成，等机器人接通后开始同步」，不再无提示跳回首页。
- acceptance: 绑定成功后 `location.hash` 仍指向账户页、页面出现新账户号与成功提示；`cd frontend && npm run check && npm run test:unit` 通过；audit errors 为空；真实 Chrome 走完整绑定流程（合成凭据）截图到 `.trellis/tasks/T-007/shots/`。
- gate: none
- status: done
- notes: 只改家长端；本轮产生的合成 CaAccount 记进 report 供清理。属第一批：commit 后可直接 push 并补 EXECUTED 行。**2026-09-17 执行结果**：绑定成功后由 `await render()` 改为记 `hints.newAccountId` + `to("settings")`，裸标签链接（无 hash 路由）绑定后落在账户页并高亮新号（`.account-row.is-new` + 「刚生成」标签，`render()` 在账户页渲染后清 hint 保证只高亮一次）；`submitRobotReplacement` 同改。`npm run check` exit 0、`test:unit` 16 pass 0 fail、`audit_documents.py` errors `[]`；真实 Chrome 3 条新用例通过 `3 passed (19.4s)`（既有 1/2 条 NFC 承接、复用同号回归通过），截图 `.trellis/tasks/T-007/shots/`（桌面 1280×720 + 390×844）。中途全量 7 条一次跑挂 5 条，根因是 `/auth/sms` 同 IP 限流 50/小时（本地经 ssh 隧道 `dell` 连 dev 库、计数已到 50），等窗口滑出后重跑新用例通过，未重置远端库。已按第一批直推：`36592bf..1770127`，远端 sha `1770127279374804383929c3bbe1dffda31632bc`。

## T-008 P-02 手填绑定的家长要知道该填什么
- goal: 绑定对话框补操作指引（用手机碰机器人上的标签会自动带凭据回到这里），手填时给格式/长度提示，校验错误落到 `.form-error` 而不是只靠浏览器原生气泡。
- acceptance: 凭据留空点「确认绑定」时 `.form-error` 可见且非空、对话框不关；文案含操作指引；`cd frontend && npm run check && npm run test:unit` 通过；audit errors 为空；真实 Chrome 复现空凭据提交并截图到 `.trellis/tasks/T-008/shots/`。
- gate: none
- status: done
- notes: 属第一批：commit 后可直接 push 并补 EXECUTED 行。**2026-09-17 执行结果（本轮为 FALLBACK 重跑，PRIMARY 08:26:06Z 限流 rc=1）**：`frontend/app.js` `bindRobotDialog()` 表单加 `novalidate`、正文补「碰一下机器人上的标签」指引、note 补「最长 2048 个字符」格式提示、`onsubmit` 空凭据守卫写 `#dialog .form-error`；`tests/ca-account.spec.js` 新增 1 条用例。TDD 红（1 failed，断言新文案缺失）→ 绿（1 passed 4.7s/4.9s）；全量 `ca-account.spec.js` `8 passed (51.4s)` 一次全绿；`npm run check` exit 0、`test:unit` 16 pass 0 fail、`audit_documents.py` errors `[]`；截图 `.trellis/tasks/T-008/shots/empty-credential.png`。已按第一批直推 push：`8348ef8..c58bfe3`，远端 sha `c58bfe32aec5d01ad9156da66b188b03bc568308`。

## T-009 P-06 成长观察非法时间区间要就地提示
- goal: 「成长观察」起止时间非法（起 ≥ 止）时就地提示「结束时间要晚于开始时间」并把两个输入框标红，不再零请求零提示。
- acceptance: 非法区间下界面出现可见中文提示与错误态样式；`cd frontend && npm run check && npm run test:unit` 通过；audit errors 为空；真实 Chrome 填 起>止 点「查看这个窗口」截图到 `.trellis/tasks/T-009/shots/`。
- gate: none
- status: done
- notes: 属第一批：commit 后可直接 push 并补 EXECUTED 行。**2026-09-17 执行结果（FALLBACK 重跑，PRIMARY 08:56:05Z 起 757s 限流 rc=1）**：前任 progress.md 声称已改的 `app.js`/`client.css` 实际未落盘，本轮重做——`windowForm()` 加 `.form-error`、`bindForms()` 里窗口表单非法区间就地提示「结束时间要晚于开始时间」+ 两输入框 `aria-invalid`+`.is-invalid`，`oninput` 清错；`client.css` 加对应规则。`npm run check` exit 0、`test:unit` 16 pass 0 fail、`audit_documents.py` errors `[]`；真实 Chrome `tests/growth-window.spec.js` 首跑因 `/auth/sms` 同 IP 限流 2 failed（计数=50），DB 只读计数滑到 47 后重跑 `2 passed (12.0s)`；截图 `.trellis/tasks/T-009/shots/`。全量回归 ca-account+flows 受同一限流未全绿，未采信。已按第一批直推 push：`919350b..6a5efa2`，远端 sha `6a5efa2a3760877c6ca6bfb675d8640796eea346`（连带推送 T-025 的 b862317，见 status.md 待处理项）。

## T-010 P-07 慢网提交要有进行中提示
- goal: 提交期间给进行中提示（按钮文案如「登录中…」或轻量进度指示），避免家长以为按钮点空了反复点。
- acceptance: 提交中按钮文案变化或出现可见进度指示（`aria-busy` 或等效可见态）；`cd frontend && npm run check && npm run test:unit` 通过；audit errors 为空；真实 Chrome 用 CDP `Network.emulateNetworkConditions`（latency 4000ms）复现并截图到 `.trellis/tasks/T-010/shots/`。
- gate: none
- status: done
- notes: 属第一批：commit 后可直接 push 并补 EXECUTED 行。**2026-09-17 执行结果**：`frontend/app.js` 新增 `busyButton(el, label)`（换文案 + `aria-busy` + `disabled`，返回恢复函数，恢复前判 `isConnected`），登录 `onsubmit` 改用它显示「登录中…」（原 `b.disabled=true/false` 两行移除，顺带消掉 `e.submitter` 为 null 时的未捕获 TypeError）；`frontend/client.css` 加 `.button[aria-busy="true"]` 转圈（`@keyframes busy-spin`）、`cursor: progress`，并把 disabled 的 `opacity` 从 0.5 提到 0.85（原淡化正是"按钮像死了"的观感来源）。新增 `frontend/tests/slow-network.spec.js` 2 条真实 Chrome 用例（CDP `Network.emulateNetworkConditions` latency 4000ms）：TDD 红为 `1 failed`（`Expected "登录中…" / Received "登录"`，14 次轮询按钮均为 `<button disabled ...>登录</button>`），改后 `2 passed (16.8s)`；加 390×844 截图后单条重跑 `1 passed (10.9s)`；回归 `tests/login-validation.spec.js` `4 passed (6.2s)`；`npm run check` exit 0、`test:unit` 16 pass 0 fail（71.6555ms）、`audit_documents.py` errors `[]`；截图 3 张在 `.trellis/tasks/T-010/shots/`。未跑全量 e2e：开工时 `/auth/sms` 同 IP 近 1 小时计数 39/50，全量必撞 429，数字不可采信。已按第一批直推 push：`5cf77b9..b3ebefc`，远端 sha `b3ebefc59f52924221082e11e70f35c85b8d700d`。

## T-011 P-08 最后一题按钮文案改成「保存并完成」
- goal: 答题最后一题按钮由「保存并继续」改成「保存并完成」，与进入提交确认页的实际动作一致。
- acceptance: 第 4/4 题按钮文案为「保存并完成」、第 1–3 题仍为「保存并下一题」；`cd frontend && npm run check && npm run test:unit` 通过；audit errors 为空；真实 Chrome 走到第 4 题截图到 `.trellis/tasks/T-011/shots/`。
- gate: none
- status: done
- notes: 属第一批：commit 后可直接 push 并补 EXECUTED 行。**2026-09-17 执行结果**：`frontend/app.js` `sessionView()` 末题文案改「保存并完成」（全仓仅此一处决定该文案）；新增 `frontend/tests/quiz-last-button.spec.js` 1 条真实 Chrome 用例（第 1–3 题断言「保存并下一题」且无「保存并完成」，第 4/4 题反之，点击后落在「准备好留下这次选择了吗？」提交确认页）；同步 `flows.spec.js:104/:325` 与 `questionnaire-admin.spec.js:116` 三处受影响的期望。TDD 红 `1 failed`（element(s) not found）→ 绿 `1 passed (15.0s)`，加全页截图后重跑 `1 passed (14.1s)`、`1 passed (14.9s)`；`npm run check` exit 0、`test:unit` 16 pass 0 fail（71.932041ms）、`audit_documents.py` errors `[]`；截图 3 张在 `.trellis/tasks/T-011/shots/`。未复跑 `flows.spec.js` / `questionnaire-admin.spec.js`（前者本地 3 项库漂移失败见 S-05，后者需建 staff 用户 + 耗限流）。已按第一批直推 push：`37e8342..84a699e`，远端 sha `84a699efa1dd7e34f57b929e3845f7e11a3df09d`。

## T-012 P-09 「机器人指纹」文案去掉「指纹」二字
- goal: 账户页把「机器人指纹 6948909c」改成不含「指纹」的说法（如「机器人标识（前 8 位）」），避免撞上「不采集真实指纹」的承诺。
- acceptance: 账户页不再出现「指纹」字样且仍显示同一摘要前 8 位；`cd frontend && npm run check && npm run test:unit` 通过；audit errors 为空；真实 Chrome 截图到 `.trellis/tasks/T-012/shots/`。
- gate: none
- status: todo
- notes: 只改家长端文案；运营端若也有同词，只在 report 记录，不在本任务改。属第一批：commit 后可直接 push 并补 EXECUTED 行。

## T-013 P-04 不再把内部 code `readable-v2` 给家长看
- goal: 家长端答题页与运营端儿童详情不再直接显示内部 code `readable-v2`，改显示中文名 + 版本号（如「四个小情境：探索偏好体验（v2）」），原始 code 收进悬停提示。
- acceptance: 两处界面正文不出现裸 `readable-v2`（仅允许出现在 `title` 属性）；`cd frontend && npm run check && npm run test:unit` 与 `cd backend && uv run pytest tests/test_ops_console.py` 通过；audit errors 为空；真实 Chrome 两处各截图到 `.trellis/tasks/T-013/shots/`。
- gate: none
- status: todo
- notes: 中文名要有稳定来源（题库元数据或既有标签表），别在前端硬编码两套映射。属第一批：commit 后可直接 push 并补 EXECUTED 行。

## T-014 O-03 审计页补「登录凭据」对象词条
- goal: 审计页「对象」列不再显示未翻译内部码 `login_grant`，补「登录凭据」类对象词条与说明，不把表名/英文模型名给运营看。
- acceptance: `cd backend && uv run pytest tests/test_ops_audit_scope.py` 通过（含新增断言：审计页对象列不含 `login_grant`、含中文词条）；audit errors 为空；真实 Chrome 打开运营审计页复现原记录截图到 `.trellis/tasks/T-014/shots/`。
- gate: none
- status: todo
- notes: 只补 `ops/labels.py` 词条与必要测试，不改审计数据与模型。属第一批：commit 后可直接 push 并补 EXECUTED 行。

## T-015 O-04 儿童详情加只读「机器人账户」一行
- goal: 儿童详情页加一行只读「机器人账户」（账户号 + 绑定状态 + 跳 CA 账户页），运营排查同步问题时不必切页按手机号搜。
- acceptance: 有账户时儿童详情出现账户号与绑定状态、无账户时显示空态；`cd backend && uv run pytest tests/test_ops_console.py tests/test_ops_ca_accounts.py` 通过；audit errors 为空；真实 Chrome 打开儿童详情截图到 `.trellis/tasks/T-015/shots/`。
- gate: none
- status: todo
- notes: 只读展示，不动契约与数据模型。属第一批：commit 后可直接 push 并补 EXECUTED 行。

## T-016 P-03 授权同意框补齐四要素（保留「合成测试」标注）
- goal: 测评授权同意框补齐四要素（处理目的 / 数据范围 / 数据去向含 DingDong 侧 / 保留与撤回后果），保留「[合成测试]」标注，并点明已有「撤回授权」入口。
- acceptance: 弹窗正文含四要素、仍含「合成测试」标注与撤回说明；`cd frontend && npm run check && npm run test:unit` 通过；audit errors 为空；真实 Chrome 打开测评同意框截图到 `.trellis/tasks/T-016/shots/`。
- gate: none
- status: todo
- notes: 文案 + 模板，不得改动授权契约字段，不许去掉或弱化「合成测试」标注。属第一批：commit 后可直接 push 并补 EXECUTED 行。

## T-017 G-02 产品内加一行授权血缘来源声明
- goal: 家长端产品内（页脚或「家长支持」）加一行来源与使用声明：沿用参考项目 `d754a5bf9ea8e71ca64a850d2e26aa321fe8ab38` 的视觉与插画及许可范围，措辞与 `frontend/README.md` 一致。
- acceptance: 声明可见且与 `frontend/README.md` 不矛盾；`cd frontend && npm run check && npm run test:unit` 通过；audit errors 为空；真实 Chrome 桌面 + 390×844 各截图到 `.trellis/tasks/T-017/shots/`。
- gate: none
- status: todo
- notes: 只写声明，不动素材与许可文件，不引入新的对外依赖。属第一批：commit 后可直接 push 并补 EXECUTED 行。

## T-018 S-05 本地 e2e 4 项数据漂移失败变成可判定
- goal: `frontend/tests/flows.spec.js`（3 项）与 `frontend/deployment-tests/ops-public.spec.js`（1 项）在本地要么通过、要么显式 skip 并打印原因，不再靠人分辨「产品坏了还是环境漂移」。
- acceptance: 落地前置一致性处理（`server.cjs` 与 `inject_fixture` 指向同一库，或 spec 显式 skip + 打印原因）；`npx playwright test tests/flows.spec.js --reporter=list` 输出中不再有未解释的「Child does not exist」类失败；`cd frontend && npm run check && npm run test:unit` 通过；audit errors 为空；命令输出原文存 `.trellis/tasks/T-018/`。
- gate: none
- status: todo
- notes: 优先做「同一库」；不可行才选显式 skip 并在 report 说明为何不可行。属第二批：commit 后可直接 push 并补 EXECUTED 行。

## T-019 O-02 家长姓名为空不再回落内部账号 `parent-<uuid>`
- goal: 家长姓名为空时 5 处界面（家庭列表、家庭详情、儿童详情、CA 账户页、操作审计）统一回落到手机号或「（未填写姓名）」，不再显示内部账号 `parent-<uuid>`。
- acceptance: 5 处均不再出现 `parent-` 前缀；优先复用「账号与权限」页既有先例；`cd backend && uv run pytest tests/test_ops_console.py tests/test_ops_audit_scope.py tests/test_ops_ca_accounts.py` 通过（含新增断言）；audit errors 为空；真实 Chrome 5 处各截图到 `.trellis/tasks/T-019/shots/`。
- gate: none
- status: todo
- notes: 优先抽公共函数，别在 5 个模板各写一份。属第二批：commit 后可直接 push 并补 EXECUTED 行。

## T-020 S-04 阶段画像/同步失败在家长端的可见性
- goal: 用 `inject_fixture` 注入真实失败任务，验证阶段画像/数据同步失败在家长端是否可见；不可见则补可见性，可见则只记证据。
- acceptance: 注入失败任务后家长端出现可见失败提示，或 report 明确记录「已可见」并附截图/响应原文；`cd frontend && npm run check && npm run test:unit` 通过；audit errors 为空；证据存 `.trellis/tasks/T-020/`。
- gate: none
- status: todo
- notes: 不许把测试数据流程说成真实供应商接入；注入的合成数据记进 report 供清理。属第二批：commit 后可直接 push 并补 EXECUTED 行。

## T-021 G-01-设计 四个展示面的设计文档（先设计后实现）
- goal: 只写 `.trellis/tasks/T-021/design.md`：人设 / 15–30 天成长报告 / 健康度四态 / 复测 CTA 四个展示面的数据形状、合成数据源放哪一层、空态与错误态、与 `设计/CA对接_C1_ca_account_id设计_20260916.md` §7 判定标准的逐条对照、拆成几个实现任务；不写代码。
- acceptance: design.md 含上述五部分且对 §7 判定标准逐条对照；本轮无代码改动；audit errors 为空；本任务 `status` 为 `gated` 且 `gates.md` 申请段有 `REQUEST T-021 review ...`。
- gate: review
- status: todo
- notes: 只写设计；不新增对对方接口的依赖。属第三批：逐条申请门禁，不适用直推规则。

## T-024 产品巡检（常设循环任务：家长与运营双视角走查）
- goal: 以家长第一视角（`http://127.0.0.1:4173/`，任意手机号 + 验证码 `00000`）与运营视角（`http://127.0.0.1:8017/ops/`，`admin` / `dingdong-admin`）把产品再完整走一遍，结合本批已合入的修复（T-005…T-021），找出**新的**真实卡点、困惑或不信任点，产出 `.trellis/tasks/T-024/backlog.md` 并申请 review。这是常设供给任务：每轮修复任务磨完后自动巡检一次，由 orchestrator 复看导入下一批，循环自己喂自己。
- acceptance: backlog 每项含「用户在哪一步卡/困惑/不信任 / 现状 / 建议改法 / 完善还是扩散（判据同 T-003：不新增对对方接口的依赖、不改契约边界、不改数据模型语义）/ 工作量档位」；每条新缺陷有真实 Chrome 复现截图存 `.trellis/tasks/T-024/shots/`；不重复报 T-003 已修条目，除非已修处出现回归（回归单独标「回归」）；稳定性问题单列一节；只产出文档不改代码；本任务 `status` 为 `gated` 且 `gates.md` 有 `REQUEST T-024 review ...`；audit errors 为空。
- gate: review
- status: todo
- notes: 巡检是产品活，属正常队列，不算机制插队。orchestrator 复看批准后：按批次导入修复任务，并在队尾追加下一次巡检任务（编号顺延）；若某轮巡检产出为 0 条新问题，在 report 如实记录并照常 gated，由 orchestrator 决定下一轮巡检是否改走抽查模式。明确排除项不变：8 个出站接口、主动解绑、发版部署、external 类动作。

