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

## 决定（orchestrator 追加）

格式：`APPROVE|DENY T-xxx <gate类型> <原因>`；worker 执行完在下方补一行 `EXECUTED T-xxx ...`

<!-- 下面按时间追加 -->

APPROVE T-002 push 门禁联调测试，推 origin/codex/release-v0.3.6 2026-09-17T06:10Z
APPROVE R0d push 自循环驱动机制已验收（三轮实测过），推 origin/codex/release-v0.3.6 2026-09-17T06:10Z

EXECUTED T-002 push 成功：git push origin codex/release-v0.3.6，6edd418..de9a3d3，远端 sha de9a3d36f445313336496cb4f801842fc72cb8c1 2026-09-17T06:07Z
EXECUTED R0d push 成功（同一次推送，R0d 的 9 个 commit 随分支一同上远端）：远端 sha de9a3d36f445313336496cb4f801842fc72cb8c1 2026-09-17T06:07Z

APPROVE T-003 review backlog 已复看，质量合格。执行动作：把下列条目按此顺序导入 queue.md 为新任务（编号从 T-005 起，每条 goal/acceptance 直接取 backlog 对应条目的「建议改法」与「现状」反证，acceptance 必须含可客观验证项：相关测试通过 + audit errors 空 + UI 改动用真实 Chrome 复现原问题已消失并截图到任务目录）。gate 标注见括号，未标即 none。
  第一批（小，缺陷与文案）：O-01, P-05, P-01, P-02, P-06, P-07, P-08, P-09, P-04, O-03, O-04, P-03（保留「合成测试」标注）, G-02（产品内一行来源声明，与 frontend/README.md 一致）
  第二批（中，稳定性）：S-05（本地 e2e 与 inject_fixture 指向同一库或前置一致性检查显式跳过，目标是那 4 项在本地要么通过要么明确 skip，不再靠人分辨）, O-02（5 处回落，优先复用「账号与权限」页的既有先例）, S-04（用 inject_fixture 注入真实失败任务，验证阶段画像/同步失败在家长端可见；不可见则补，可见则只记证据）
  第三批（大）：G-01-设计（gate review）——先只写 .trellis/tasks/<id>/design.md：四个展示面的数据形状、合成数据源放哪一层、空态/错误态、与 设计/CA对接_C1_ca_account_id设计_20260916.md §7 判定标准的逐条对照、拆成几个实现任务；不写代码。我批了设计再导入实现任务。
  不导入：O-05（演示数据治理，暂缓）；G-03（external，等 Yihu 拍板，保持 REQUEST 状态不要重复申请）。
  push 规则（本决定内有效）：第一批与第二批每完成一个任务 commit 后可直接 push origin codex/release-v0.3.6，不必逐条申请，但每次 push 在本文件补 EXECUTED 行；第三批仍逐条申请。
  文档路径以仓库内实际文件名为准。 2026-09-17T06:40Z

EXECUTED T-003 review 已按批准顺序导入 queue.md 为 T-005…T-021（第一批 13 条：O-01/P-05/P-01/P-02/P-06/P-07/P-08/P-09/P-04/O-03/O-04/P-03/G-02；第二批 3 条：S-05/O-02/S-04；第三批 1 条：G-01-设计 gate=review），O-05 与 G-03 未导入；T-003 `status` 已改 `done` 2026-09-17T06:41Z

EXECUTED T-005 push 按决定段「第一批与第二批每完成一个任务 commit 后可直接 push，不必逐条申请」执行：`git push origin codex/release-v0.3.6` → `de9a3d3..618925e`，远端 sha `618925ef4e53d96fb339562bb8e3589789032a53`（含 `[T-003]` 门禁导入提交 730e2d0 与 `[T-005]` 修复提交 618925e；随后同一轮再推收尾记录提交）2026-09-17T06:46Z

EXECUTED T-006 push 按决定段「第一批每完成一个任务 commit 后可直接 push origin/codex/release-v0.3.6，不必逐条申请」执行：`git push origin codex/release-v0.3.6` → `f07a7c7..876b2dd`，远端 sha `876b2dd9d031650e57e576ea7fc6b8d04a1beae7`（`[T-006]` 修复提交；收尾记录提交紧随其后同一轮再推）2026-09-17T07:05Z

DENY T-099 push T-022 钩子自测行，orchestrator 已于 07:20Z 真实收到唤醒，链路验证通过，按 T-022 验收约定忽略，不对应任何真实推送 2026-09-17T07:22Z
EXECUTED T-022 push 成功：`git push origin codex/release-v0.3.6` → `dbf2870..2cfca23`，远端 sha `2cfca23e404794ff8f13cc3243c31e4c56bf4568`（按 T-022 notes 的机制任务直推规则执行，未另开 REQUEST；收尾记录提交紧随其后同一轮再推）2026-09-17T07:22Z
EXECUTED T-022 push（第二次，收尾记录提交）：`git push origin codex/release-v0.3.6` → `2cfca23..b55244d`，远端 sha `b55244de32456feb019e34f8ed4d57cc955d19df`（本条记录提交自身随后同一轮再推，分支头以 origin 为准）2026-09-17T07:24Z
EXECUTED T-023 push 按本任务 `gate: push` 与机制任务直推规则执行：`git push origin codex/release-v0.3.6` → `531737e..a900a01`，远端 sha `a900a011ae04b518e82a920316093db05fa4ad36`（含 `[T-023]` ORCHESTRATOR.md 入库提交 a900a01；收尾记录提交紧随其后同一轮再推，分支头以 origin 为准） 2026-09-17T07:44Z
EXECUTED T-023 push（第二次，收尾记录提交 b8e4bb0）：`git push origin codex/release-v0.3.6` → `a900a01..b8e4bb0`，远端 sha `b8e4bb090c323fd19c396be63d50ebf5a6de5985`（该提交含 queue/gates/status/experiment-log 收尾记录；本条记录提交随后同一轮再推，分支头以 origin 为准） 2026-09-17T07:30Z
EXECUTED T-007 push 按决定段「第一批每完成一个任务 commit 后可直接 push，不必逐条申请」执行：`git push origin codex/release-v0.3.6` → `36592bf..1770127`，远端 sha `1770127279374804383929c3bbe1dffda31632bc`（`[T-007]` 代码提交；收尾记录提交紧随其后同一轮再推） 2026-09-17T08:22Z
EXECUTED T-008 push 按决定段「第一批每完成一个任务 commit 后可直接 push，不必逐条申请」执行：`git push origin codex/release-v0.3.6` → `8348ef8..c58bfe3`，远端 sha `c58bfe32aec5d01ad9156da66b188b03bc568308`（`[T-008]` 代码提交；收尾记录提交紧随其后同一轮再推） 2026-09-17T08:41Z
EXECUTED T-009 push 按决定段「第一批每完成一个任务 commit 后可直接 push」执行：`git push origin codex/release-v0.3.6` → `919350b..6a5efa2`，远端 sha `6a5efa2a3760877c6ca6bfb675d8640796eea346`（`[T-009]` 代码提交 6a5efa2）。⚠️ 本次 push 连带把此前未推送的 `[T-025]` 提交 b862317（盘活7×24 机制改动）一起推上远端——T-025 notes 原标注「push 留 Yihu 放行」，见 status.md 待处理项，供 orchestrator/Yihu 复核。 2026-09-17T09:35Z
EXECUTED T-010 push 按决定段「第一批每完成一个任务 commit 后可直接 push origin/codex/release-v0.3.6，不必逐条申请」执行：`git push origin codex/release-v0.3.6` → `5cf77b9..b3ebefc`，远端 sha `b3ebefc59f52924221082e11e70f35c85b8d700d`（`[T-010]` 修复提交 b3ebefc；收尾记录提交紧随其后同一轮再推，分支头以 origin 为准） 2026-09-17T09:50Z
EXECUTED T-010 push（第二次，收尾记录提交 1bb91ea）：`git push origin codex/release-v0.3.6` → `b3ebefc..1bb91ea`，远端 sha `1bb91eaa6efc5ab26d0f245a71f08ea93d51e660`（该提交含 queue/gates/status/experiment-log 收尾记录；本条记录提交随后同一轮再推，分支头以 origin 为准） 2026-09-17T09:55Z
EXECUTED T-011 push 按决定段「第一批每完成一个任务 commit 后可直接 push origin/codex/release-v0.3.6，不必逐条申请」执行：`git push origin codex/release-v0.3.6` → `37e8342..84a699e`，远端 sha `84a699efa1dd7e34f57b929e3845f7e11a3df09d`（`[T-011]` 修复提交 84a699e；收尾记录提交紧随其后同一轮再推，分支头以 origin 为准） 2026-09-17T09:49Z
EXECUTED T-011 push（第二次，收尾记录提交 8bc3b8c）：`git push origin codex/release-v0.3.6` → `84a699e..8bc3b8c`，远端 sha `8bc3b8c5fad728ad20264461a9fb5ec55cc55a46`（该提交含 queue/gates/status/experiment-log 收尾记录；本条记录提交随后同一轮再推，分支头以 origin 为准） 2026-09-17T09:52Z
EXECUTED T-012 push 按决定段「第一批每完成一个任务 commit 后可直接 push origin/codex/release-v0.3.6，不必逐条申请」执行：`git push origin codex/release-v0.3.6` → `eabb0f2..9bfb49a`，远端 sha `9bfb49a4226ad58a40504d496cd669846bc6cb1d`（`[T-012]` 修复提交 9bfb49a；收尾记录提交紧随其后同一轮再推，分支头以 origin 为准） 2026-09-17T10:05Z
EXECUTED T-012 push（第二次，收尾记录提交 d02c3b6）：`git push origin codex/release-v0.3.6` → `9bfb49a..d02c3b6`，远端 sha `d02c3b60fbbf58c3edfcf3ce02666d7b03e44a3c`（该提交含 queue/gates/status/experiment-log/runs.log 收尾记录；本条记录提交随后同一轮再推，分支头以 origin 为准） 2026-09-17T10:07Z
EXECUTED T-013 push 按决定段「第一批每完成一个任务 commit 后可直接 push origin/codex/release-v0.3.6，不必逐条申请」执行：`git push origin codex/release-v0.3.6` → `9cd1af5..452ce71`，远端 sha `452ce712e19a74b0ec791f32cf93f078467b5c4f`（`[T-013]` 修复提交 452ce71；收尾记录提交紧随其后同一轮再推，分支头以 origin 为准） 2026-09-17T10:16Z
EXECUTED T-013 push（第二次，收尾记录提交 8460ff8）：`git push origin codex/release-v0.3.6` → `452ce71..8460ff8`，远端 sha `8460ff85c2f9202821ec2324cf1dcd736082468b`（该提交含 queue/gates/status/experiment-log 收尾记录；本条记录提交随后同一轮再推，分支头以 origin 为准） 2026-09-17T10:19Z

EXECUTED T-014 push 按决定段「第一批每完成一个任务 commit 后可直接 push origin/codex/release-v0.3.6，不必逐条申请」执行：`git push origin codex/release-v0.3.6` → `11ad793..f4a4d6c`，远端 sha `f4a4d6c014251e2b497be1990ab7f56150469b24`（含 `[T-014]` 修复提交 d351372 与收尾记录提交 f4a4d6c；本条记录提交随后同一轮再推，分支头以 origin 为准） 2026-09-17T10:55Z
EXECUTED T-014 push（第二次，补记远端 sha 的收尾记录提交）：`git push origin codex/release-v0.3.6` → `f4a4d6c..1c37f14`，远端 sha `1c37f14e7c4a04971bb95fb919e2e0169d80f3ed`（该提交含 gates.md EXECUTED 行；本条记录与 progress 收尾提交随后同一轮再推，分支头以 origin 为准） 2026-09-17T10:57Z
EXECUTED T-015 push 按决定段「第一批每完成一个任务 commit 后可直接 push origin/codex/release-v0.3.6，不必逐条申请」执行：`git push origin codex/release-v0.3.6` → `0a77472..f9287bc`，远端 sha `f9287bcd4b572c8b634c1bea2e77262efdab8dcd`（`[T-015]` 功能提交 f9287bc；收尾记录提交紧随其后同一轮再推，分支头以 origin 为准） 2026-09-17T11:20Z
EXECUTED T-015 push（第二次，收尾记录提交 b447e2d）：`git push origin codex/release-v0.3.6` → `f9287bc..b447e2d`，远端 sha `b447e2dab3e653ce2633475ce904dc191f637a20`（该提交含 queue/gates/status/experiment-log 收尾记录；本条补记提交随后同一轮再推，分支头以 origin 为准） 2026-09-17T11:26Z
EXECUTED T-016 push 按决定段「第一批每完成一个任务 commit 后可直接 push origin/codex/release-v0.3.6，不必逐条申请」执行：`git push origin codex/release-v0.3.6` → `ad78a47..92827af`，远端 sha `92827aff0aafdf80ac63dfe8169119d9e6039b07`（`[T-016]` 修复提交 92827af；收尾记录提交紧随其后同一轮再推，分支头以 origin 为准） 2026-09-17T11:34Z
EXECUTED T-016 push（第二次，收尾记录提交 ea06a2f）：`git push origin codex/release-v0.3.6` → `92827af..ea06a2f`，远端 sha `ea06a2fe1fa2647c1a0307886802d8f1e1eb342c`（该提交含 queue/gates/status/experiment-log 收尾记录；本条补记提交随后同一轮再推，分支头以 origin 为准） 2026-09-17T11:36Z
EXECUTED T-017 push 按决定段「第一批与第二批每完成一个任务 commit 后可直接 push origin/codex/release-v0.3.6，不必逐条申请」执行：`git push origin codex/release-v0.3.6` → `0b6b6fe..10d4353`，远端 sha `10d435392442a35d8761a1a920f786c9170e8fa9`（`[T-017]` 功能提交 10d4353；收尾记录提交紧随其后同一轮再推，分支头以 origin 为准） 2026-09-17T11:14Z
EXECUTED T-017 push（第二次，收尾记录提交 d42edf7）：`git push origin codex/release-v0.3.6` → `10d4353..d42edf7`，远端 sha `d42edf77c7f84472b2d2d8facf8a8c43ee5e3307`（该提交含 queue/gates/status/experiment-log/runs.log 收尾记录；本条补记提交随后同一轮再推，分支头以 origin 为准） 2026-09-17T11:18Z

APPROVE T-025 push（事后追认）：`[T-025]` 机制提交 `b862317` 已随 T-009 直推连带上远端（push 语义推整个分支，非越权单推）；内容为 Yihu 2026-09-17「把模式盘活」指令下的 5 项机制改动，Yihu 复核本条时口头追认（「OK，继续推进」）。watchdog 的 launchd 安装仍待 Yihu 执行，不属本追认范围。 2026-09-17T11:48Z
EXECUTED T-025 push（追认补记）：随 T-009 直推 `git push origin codex/release-v0.3.6` → `919350b..6a5efa2`，远端 sha `6a5efa2a3760877c6ca6bfb675d8640796eea346`（含 `[T-025]` b862317） 2026-09-17T11:48Z

EXECUTED G-03 external Yihu 2026-09-17 拍板「干掉」：`gh pr close 1 --repo rossyao2022/dingdong` ✓（OPEN→CLOSED，head 分支 feat/parent-app-backend-integration，PR 标题「feat: 原型继续演进为接入后端的家长端应用（机器人账户 / NFC 承接 / 换机流程）」）。公开仓库无其他操作，head 分支未删。至此 T-003 backlog 全部条目处置完毕（含未导入的 O-05 暂缓）。
EXECUTED R0g push Yihu 明确指令「提交并 push」：`git push origin codex/release-v0.3.6` → `9b96c4d..fce3f67`，远端头 `fce3f67`（三笔 orchestrator 账面：`905ea3e` T-025 追认 / `fceab02` R0f 补给 / `fce3f67` R0g launchd 销项）。另核实：`feat/ca-full-stack-v0.3.6` 为早期 squash 快照（1 个独有提交，内容已被当前分支 106 个提交演进取代），经说明后不推。

EXECUTED T-019 push 按决定段「第二批每完成一个任务 commit 后可直接 push origin/codex/release-v0.3.6，不必逐条申请」执行：`git push origin codex/release-v0.3.6` → `7ee99a7..2c00ac1`，远端 sha `2c00ac1d3208ac4e574eaebe21f7b0e0540ebc4f`（`[T-019]` 修复提交；收尾记录提交紧随其后同一轮再推） 2026-09-17T12:25Z
EXECUTED T-019 push（第二次，收尾记录提交 f61828f）：`git push origin codex/release-v0.3.6` → `2c00ac1..f61828f`，远端 sha `f61828ff378ccbdb56693b8d12cf941f00f8fc49`（该提交含 queue/gates/status/experiment-log 收尾记录；本条记录提交随后同一轮再推，分支头以 origin 为准） 2026-09-17T12:27Z

EXECUTED T-018 push 按决定段「第一批与第二批每完成一个任务 commit 后可直接 push origin/codex/release-v0.3.6，不必逐条申请」执行：`git push origin codex/release-v0.3.6` → `715979c..c092dee`，远端 sha `c092dee5e3e296d9d3f0f9787e35d65523256d6f`（`[T-018]` 代码+任务证据提交 c092dee，含 `flows-green-rerun.txt` 等原文；本条记录提交紧随其后同一轮再推，分支头以 origin 为准） 2026-09-17T12:45Z

EXECUTED T-026 push 按本任务 notes「机制维护类：commit 后可直接 push 并补 EXECUTED 行」执行：`git push origin codex/release-v0.3.6` → `e84e00b..979c145`，远端 sha `979c145a1274891be91c76e0b476744327fe5f2d`（`[T-026]` 证据提交 979c145：T-012 三张刷新截图 + T-026 任务证据）。⚠️ 本次 push 连带把此前未推送的 T-020 两笔提交（`ed61449` 用例 + `55d17d7` 收尾记录）一起推上远端——T-020 notes 标注「未 push，留待 orchestrator 复核后主会话 push」，见 status.md 待处理项，供 orchestrator/Yihu 复核。 2026-09-17T12:58Z
EXECUTED T-026 push（第二次，收尾记录提交 034a7c8）：`git push origin codex/release-v0.3.6` → `979c145..034a7c8`，远端 sha `034a7c898286e79ea6eb7ce1b0cbbf44c7335478`（该提交含 queue/gates/status/experiment-log 收尾记录；本条补记提交随后同一轮再推，分支头以 origin 为准） 2026-09-17T13:02Z
EXECUTED T-027 push 按本任务 notes「机制维护类：commit 后可直接 push 并补 EXECUTED 行」执行：`git push origin codex/release-v0.3.6` → `3966cb0..a9d00de`，远端 sha `a9d00de06771a6c4e5873896cdcd7380061b1e92`（`[T-027]` 格式化提交 a9d00de：`backend/tests/test_ops_audit_scope.py` 补行尾换行 + 任务证据 pytest-before/after.txt；收尾记录提交紧随其后同一轮再推，分支头以 origin 为准） 2026-09-17T13:03Z

APPROVE T-020 push（事后追认）：T-020 属第二批 `gate: none`，T-003 决定已给第二批常设直推许可；worker 轮内谨慎未自推，两笔提交（`ed61449` 用例 + `55d17d7` 收尾记录）随 T-026 push 连带上远端（`e84e00b..979c145`），push 语义推整个分支，非越权单推。复核通过，账面闭合，无需补推。 2026-09-17T13:15Z
EXECUTED T-027 push（第二次，收尾记录提交 f7a6ea7）：`git push origin codex/release-v0.3.6` → `a9d00de..f7a6ea7`，远端 sha `f7a6ea778187d18c44e034c1733ab6ba37ce3d31`（该提交含 queue/gates/status/experiment-log 收尾记录；本条补记提交随后同一轮再推，分支头以 origin 为准） 2026-09-17T13:04Z
EXECUTED T-027 push（第三次，progress 收尾提交 0bd86e1）：`git push origin codex/release-v0.3.6` → `b6e427a..0bd86e1`，远端 sha `0bd86e1b71405ae64e30de2b450198aa480b1678`（该提交把 `progress.md` 的 Finish 阶段从「进行中」改为已完成并记推送 sha；本条补记提交随后同一轮再推，分支头以 origin 为准） 2026-09-17T13:04Z

APPROVE T-021 review 设计复看通过，四条审核要点逐项核验成立：①合成数据源放后端服务层（`CA_DISPLAY_DATA_SOURCE` 默认 `synthetic_fixture`），每个响应带 `data_origin` 且前端在面板级挂「合成测试数据」徽标，满足「合成数据 + 显式标注」；②合成模式零出站、`dingdong` 模式未配置时返回 `not_synced` + `reason=upstream_not_configured` 不伪造成功，满足「不为展示面先接对方接口」；③§4 对 §7 的 11 条逐条对照成立，并如实记录两条边界（四个面属 C5/C6 不在 §7 清单；§7 第 11 条仍只能由 D10/D12 解开——合成数据跑通不算 §7 完成，实现任务 report 不得写成已接通）；④A/B/C/D 拆分各有可客观验证验收，A 先行定死 availability 词表与错误处置的拆法正确。一处 orchestrator 裁量：实现任务 A–D 不沿用设计稿建议的 gate:review，改为 gate:none + 第一/二批同款直推规则（设计已批、验收客观、逐条 review 只增加等待），已由 orchestrator 导入 queue.md 为 T-032/T-033/T-034/T-035（排 T-028 之后、T-024 巡检之前，执行序 B 依赖 A、D 依赖 B、C 独立）；§6 的 5 条待澄清已并入 T-028 确认级（含 ①⑤ 标注为复测回写实源切换前置）。本批准同时授权 T-021 收尾轮：已提交的 `[T-021]` 设计提交与收尾记录可直接 push origin/codex/release-v0.3.6 并补 EXECUTED 行，不必另开 REQUEST；T-021 `status` 改 `done`。 2026-09-17T13:16Z

EXECUTED T-021 push 按决定段「授权 T-021 收尾轮：已提交的 `[T-021]` 设计提交与收尾记录可直接 push origin/codex/release-v0.3.6 并补 EXECUTED 行」执行：`git push origin codex/release-v0.3.6` → `1bf231c..d2b44c7`，远端 sha `d2b44c74d665539c123833d166355148a8affe11`（含 `e1e582e` 设计提交、`d2b44c7` 收尾记录提交，以及此前未推送的 `b533410` R0i 记账提交；远端头即 `d2b44c7`）。T-021 `status` 已改 `done`。 2026-09-17T13:19Z

EXECUTED T-029 push 按本任务 notes「机制维护类：commit 后可直接 push 并补 EXECUTED 行」执行：`git push origin codex/release-v0.3.6` → `d2b44c7..a1e1d56`，远端 sha `a1e1d5604c4c7999c35ef5481045ee470ebfad23`（`[T-029]` 提交 a1e1d56：`frontend/tests/ca-account.spec.js` 截图前固定滚动位置 1 行 + 刷新后的 `.trellis/tasks/T-008/shots/empty-credential.png` 189622 字节 + T-029 任务证据；收尾记录提交紧随其后同一轮再推，分支头以 origin 为准） 2026-09-17T13:21Z
EXECUTED T-029 push（第二次，收尾记录提交 c177781）：`git push origin codex/release-v0.3.6` → `a1e1d56..c177781`，远端 sha `c17778120464cbf170b020c5720a82633352c85d`（该提交含 queue/gates/status/experiment-log 收尾记录，并带入 orchestrator 本轮追加的 T-021 APPROVE 记账与 T-032..T-035 导入；本条补记自身亦随本轮推送，分支头以 origin 为准） 2026-09-17T13:24Z

EXECUTED T-030 push 按本任务 notes「运维 chore：commit 后可直接 push 并补 EXECUTED 行」执行：`git push origin codex/release-v0.3.6` → `c893a3d..b95ecf2`，远端 sha `b95ecf2d3d9351666d7d822b8ecb81cca9c9b211`（`[T-030]` 处置提交 b95ecf2：词表 3 条 + 用例 1 条 + 任务脚本/证据/11 张截图 + 未跟踪的 `frontend/tests/t030-batch-disposal.spec.js`；收尾记录提交紧随其后同一轮再推，分支头以 origin 为准） 2026-09-17T14:32Z
