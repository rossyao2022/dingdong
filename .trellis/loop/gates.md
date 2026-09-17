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
