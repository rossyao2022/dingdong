# 门禁申请与决定

两段各管一头：**申请**由 worker 追加，**决定**由 orchestrator 追加。worker 每轮开工先读决定段，看到 `APPROVE` 就执行对应受门禁动作。

## 申请（worker 追加）

格式：`REQUEST T-xxx <gate类型> <一句话原因> <时间>`

<!-- 下面按时间追加 -->

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
