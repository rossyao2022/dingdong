# 任务 R0d 简报（原文存档）

> 由右侧 orchestrator 下发（两段：主简报 + R0e 续跑指令），左侧执行 worker 原样保存。
> 保存时间：2026-09-17（Asia/Shanghai）

---

## 第一段：主简报（R0d）

# 任务 R0d：建「左侧自循环」驱动机制并实测（右侧 orchestrator 下发）

背景：今天三次 TPM 限流都因为交互会话上下文涨到 240k+。目标：让左侧不靠我催也能长程干活，我一天只看几次。

设计（照此实现，偏离要说明理由）——所有文件在项目内，目录 `.trellis/loop/`：
1. `queue.md` 有序任务表（`## T-<三位数> <标题>`，字段 goal / acceptance / gate / status / notes）。
2. `gates.md` 申请段（worker 追加 `REQUEST T-xxx <gate类型> <原因> <时间>`）与决定段（orchestrator 追加 `APPROVE|DENY ...`）。
3. `status.md` 每轮整文件重写、一屏以内。
4. `prompt.md` 单轮提示词模板（读 AGENTS.md / workflow / spec 索引 / gates / queue；先处理 APPROVE；取一个 todo 标 doing；Plan→Implement→Verify→Finish；只做一个任务；按改动类型跑测试；commit 首行 `[T-xxx]`；写 report.md；门禁申请或标 done；experiment-log 追加；重写 status.md）。
5. `runs/` 每轮 JSON 与 stderr（gitignore），`runs.log` 一行一轮入库。
6. `STOP` 存在则本轮结束后退出。

驱动 `scripts/worker-loop.sh`：绝对路径 cd 项目根；空转 600s；单轮上限 40 分钟；限流 sleep 180；连续失败 2 次标 blocked；每日迭代上限 40；每轮后 git status 有未提交改动记 warning；只用 bash+git+python3。附 `.trellis/loop/README.md`（10 行以内）。

实测：queue 放 T-001（写 README，gate none）、T-002（hello.md + 申请 push，gate push）。前台跑两轮，预期 T-001 done 有 `[T-001]` 提交；T-002 gated 有 REQUEST；status 重写；runs/ 两份输出；驱动空转。然后 STOP 退出删 STOP。真实耗时与 token 用量写进 report。

收尾：queue 追加真实任务 T-003「产品体验与稳定性审计」（gate review，详情见 queue.md）；全部 commit（`[R0d]` 开头）不 push；简报/报告存 `.trellis/tasks/R0d/`；`touch .trellis/loop/R0d.done`（gitignore）；pane 输出收尾格式 + 驱动启动命令。

## 第二段：续跑指令（R0e）

续 R0d（又被 TPM 打断一次，记卡点）。先做一件自救：查 grok CLI 有没有会话内切模型的命令（/model 或类似）以及 -p 模式的 --model 参数怎么配 Ark 模型（只读 ~/.grok 配置，不改）。若能切，你自己先切到 deepseek-v4-pro（或当前配置里可用的 Pro 型号）把 R0d 做完，report 里写明实际用了哪个模型。

R0d 的驱动与提示词模板追加以下规格（编号 R0e，一并实现，不另开轮）：
1. 双模型：驱动读 `.trellis/loop/models.env`（`MODEL_PRIMARY=deepseek-v4-1-flash`，`MODEL_FALLBACK=<Pro>`）。某轮因 TooManyRequests/rate limit 失败 → 立刻用 FALLBACK 重跑同一轮；下一轮回 PRIMARY。两个都限流才 sleep 180。只允许 Flash→Pro 升级，不做降级。runs.log 每行记实际模型。
2. 阶段检查点：worker 每完成一个阶段（Plan/Implement/Verify/Finish）就重写 `.trellis/tasks/T-xxx/progress.md`，只写可核对事实（已完成阶段、改动文件列表、跑过的命令与结果数字、下一步一句话）。禁止叙述与推测。
3. 核对式续跑：prompt.md 加一段——若所取任务 status=doing 且 progress.md 存在，先 git status --short 与 git diff --stat，把 progress.md 声称的改动逐条与磁盘对照，重跑最后一个验证命令；对不上的以磁盘为准并在 progress.md 记「前任声明与磁盘不符：…」；已完成阶段不重做。
4. 换模型实测：queue 加 T-00X「验证模型切换」：假 grok 包装脚本第一次固定输出 TooManyRequests、退出码非 0，第二次真跑，验证驱动用 FALLBACK 重跑且 runs.log 记两个模型名。实测完删假脚本。

其余按 R0d 简报收尾：全部 commit 不 push、写 gates 申请、`touch .trellis/loop/R0d.done`、pane 输出收尾格式 + 驱动启动命令。
