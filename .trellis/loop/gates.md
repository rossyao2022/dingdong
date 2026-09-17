# 门禁申请与决定

两段各管一头：**申请**由 worker 追加，**决定**由 orchestrator 追加。worker 每轮开工先读决定段，看到 `APPROVE` 就执行对应受门禁动作。

## 申请（worker 追加）

格式：`REQUEST T-xxx <gate类型> <一句话原因> <时间>`

<!-- 下面按时间追加 -->

REQUEST T-002 push 门禁联调测试文件已就绪，需推送到远端验证 push 门禁闭环 2026-09-17T05:52Z

## 决定（orchestrator 追加）

格式：`APPROVE|DENY T-xxx <gate类型> <原因>`；worker 执行完在下方补一行 `EXECUTED T-xxx ...`

<!-- 下面按时间追加 -->
