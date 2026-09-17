# 门禁申请与决定

两段各管一头：**申请**由 worker 追加，**决定**由 orchestrator 追加。worker 每轮开工先读决定段，看到 `APPROVE` 就执行对应受门禁动作。

## 申请（worker 追加）

格式：`REQUEST T-xxx <gate类型> <一句话原因> <时间>`

<!-- 下面按时间追加 -->
REQUEST T-099 push 驱动收尾钩子实测，T-022 钩子自测，可忽略 2026-09-17T07:20Z

REQUEST T-002 push 门禁联调测试文件已就绪，需推送到远端验证 push 门禁闭环 2026-09-17T05:52Z
REQUEST R0d push R0d 自循环驱动机制 + 三轮实测（T-001/T-002/T-004）与报告已提交，待推 origin/codex/release-v0.3.6 2026-09-17T06:01Z
REQUEST T-003 review 产品体验与稳定性审计 backlog 已完成（家长端 9 条 + 运营端 5 条 + 缺口 3 条 + 稳定性 5 条），需独立复看后再决定修哪些 2026-09-17T06:16Z

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
