# 任务 R0d 报告：左侧自循环驱动机制 + R0e 规格 + 三轮实测

执行者：左侧执行 worker（grok CLI）。执行时间：2026-09-17 13:2x–14:0x（Asia/Shanghai）。
简报原文：同目录 `brief.md`（两段：R0d 主简报 + R0e 续跑指令）。过程数据：`.trellis/workspace/yihu/experiment-log.md`。

---

## 0. 结论

状态 **DONE**（不 push，已写 gates 申请）。自循环驱动机制建好并真跑通：驱动 `scripts/worker-loop.sh` + `.trellis/loop/{queue,gates,status,prompt,models.env,README,runs.log,runs/}`，R0e 的双模型 / 阶段检查点 / 核对式续跑一并实现，三轮实测（T-001 / T-002 / T-004）全部符合预期，驱动最后停在空转、由 STOP 正常退出。

**本轮实际模型**：PRIMARY = `deepseek-v4-1-flash-260910`，FALLBACK = `deepseek-v4-pro`（Ark 侧实际解析到 `deepseek-v4-pro-ga-260813`，已由 fallback 轮次的 `modelUsage` 字段证实）。T-001 / T-002 全程 Flash 跑完；T-004 的 PRIMARY 被假脚本伪造限流后，驱动自动切 FALLBACK 重跑成功。

## 1. 权限边界与放行

| 动作 | 状态 |
| --- | --- |
| `git push` | **未执行**。已在 `gates.md` 写 `REQUEST R0d push ...`（另有 T-002 的 `REQUEST T-002 push`），等 orchestrator 批 |
| 其它远端写 / 部署 / 改 PR / 给对方发消息 | 无 |
| `~` 下写入 | 无。只读了 `~/.grok/config.toml`、`~/.grok/docs/user-guide/`、`grok models` 输出（取证模型切换） |
| `deploy/.env`、`*.pem`、私钥 | 未读、未复制、未打印 |

## 2. 自救：模型切换调研结果

- **会话内切模型**：TUI 有 `/model <id>` 斜杠命令和 `Ctrl+M` 模型选择器；无头模式用 `-m / --model <id>`（`grok --help` 与 `docs/user-guide/01-getting-started.md`、`11-custom-models.md` 确认）。
- **Ark 模型怎么配**：`grok models` 列出的 id 就是 `--model` 接受的 id。当前可用：`grok-4.6`、`deepseek-v4-pro`（default）、`deepseek-v4-1-flash-260910`、`glm-5-3-flash-260828`、`doubao-seed-2-1-pro-260915`、`doubao-seed-evolving`。`deepseek-v4-pro` 在 config 里映射到 `deepseek-v4-pro-ga-260813`（Ark，`ARK_API_KEY`）。
- **现状**：`~/.grok/config.toml` 的 `models.default` 已是 `deepseek-v4-pro`（本会话中途被改过，不是我改的——我只读不写）。即新会话已默认 Pro；本会话自身无法回改模型，但剩余重活全是通过 `--model` 显式钉模型的一次性 grok 子进程完成。
- 把调研结论落进了 `models.env` 与驱动：Flash 日常、Pro 兜底。

## 3. R0e 规格落地（偏离已注明）

| 规格 | 落地 | 偏离/说明 |
| --- | --- | --- |
| 双模型 | `models.env` 设 `MODEL_PRIMARY=deepseek-v4-1-flash-260910`、`MODEL_FALLBACK=deepseek-v4-pro`；驱动限流即 FALLBACK 重跑同一任务、下轮回 PRIMARY、两个都限流才 sleep 180、只升不降 | 简报写「`deepseek-v4-1-flash`」，但 `grok models` 里实际 id 是 `deepseek-v4-1-flash-260910`，`models.env` 用了后者（否则 `--model` 匹配不上） |
| runs.log 记模型 | ROUND 行增加第 6 列模型名 | — |
| 阶段检查点 | prompt.md：每完成 Plan/Implement/Verify/Finish 就重写 `.trellis/tasks/T-xxx/progress.md`，只写可核对事实 | T-004 真跑时 worker 已实际产出 progress.md |
| 核对式续跑 | prompt.md：取到 `doing` + 有 progress.md 先 git status/diff 对照磁盘、重跑最后一个验证命令、不符记「前任声明与磁盘不符：…」、已完成阶段不重做 | — |
| 换模型实测 | queue 加 **T-004**（简报写「T-00X」，为避免与真实任务 T-003 冲突用 T-004）；假包装脚本伪造首次限流、第二次真跑，跑完已删 | 假脚本 `runs/fake-grok.sh` 只对 `LOOP_TASK_ID=T-004` 触发一次，靠 `.fake-fired` 保证第二次真跑 |

## 4. 实测（真跑，非烟测）

| 轮次 | 模型 | 结果 | 耗时 | 提交 sha（末次） | token 用量（input / cache_read / output / total） |
| --- | --- | --- | --- | --- | --- |
| T-001 | `deepseek-v4-1-flash-260910` | DONE | 85s | `1351692` | 47,857 / 926,080 / 7,523 / **981,460** |
| T-002 | `deepseek-v4-1-flash-260910` | GATED | 95s | `d22eaf5` | 48,464 / 903,424 / 8,939 / **960,827** |
| T-004 PRIMARY | `deepseek-v4-1-flash-260910` | RATE_LIMITED（伪造） | 5s | — | 无（假脚本直接退） |
| T-004 FALLBACK | `deepseek-v4-pro`（→`deepseek-v4-pro-ga-260813`） | DONE | 496s | `e42e25e` | 100,447 / 1,511,168 / 31,224 / **1,642,839** |

验证点逐条核对：

- T-001：`.trellis/loop/README.md` 存在、7 行（≤10 ✓）、四条操作说明齐全；`[T-001]` 提交（`6e89463` + `1351692`）。
- T-002：`.trellis/tasks/T-002/hello.md` 存在；`gates.md` 申请段有 `REQUEST T-002 push ...`；queue 里 T-002 `status: gated`；`[T-002]` 提交（`b7e30d1` + `d22eaf5`）。
- T-004：`runs.log` 里两行同任务不同模型——`ROUND T-004 RATE_LIMITED ... deepseek-v4-1-flash-260910` + `ROUND T-004 DONE ... deepseek-v4-pro`；`[T-004]` 提交（`e42e25e`）；假脚本已删。
- `status.md` 被 worker 重写（一屏内，含最近轮次与待处理事）；`runs/` 有 8 份输出（4 轮 × json/err）。
- 驱动最后进入「无 todo 也无待执行 APPROVE」的空转状态（T-003 仍是 todo，但因为 T-002 是 gated、T-003 被我放 STOP 挡住没被取走）；STOP 命中后正常退出。

一个值得你知道的数字：**FALLBACK（Pro）那一轮烧了 164 万 token、跑了 496s**，比 Flash 两轮加起来还重。Pro 兜底是「能续命」的正确设计，但**贵且慢**；如果后面 Flash 频繁限流、Pro 又兜不住，建议把 Pro 轮次单独在 status.md 里标注让你有数。

## 5. 门禁申请（不 push，等你批）

`gates.md` 申请段现有两条，都在等决定：

1. `REQUEST T-002 push` —— T-002 的联调测试文件与门禁申请（worker 提交）。
2. `REQUEST R0d push` —— R0d 全部成果（驱动机制 + R0e + 三轮实测 + 报告）。

批准方式：在 `gates.md` 决定段写 `APPROVE T-002 push ...` / `APPROVE R0d push ...`（T-xxx 会被驱动自动执行；R0d 这条由你或后续会话手动 push）。

## 6. 已知问题与偏离

- **dirty-worktree 误报**：真跑的四条 ROUND 行都带 `dirty-worktree`，原因是驱动自己每轮 append `runs.log`（该文件入库）后被自己的 `git status --short` 检查当成「worker 没 commit 干净」。已修：检查用 pathspec 排除 `runs.log`（本次收尾提交里）。真跑时带的是旧检查，属无害假阳性。
- **runs.log 提交时机**：驱动每轮追加、会话收尾才 commit（不是字面意义的「一行一提交」）。设计如此——轮次结果要等 worker 退出后才有，只能由下一轮或会话收尾提交。
- **macOS bash 3.2 坑**：`$var（` 的全角括号字节会被算进变量名，`set -u` 下崩驱动（见 experiment-log 卡点 12），已把紧跟全角字符的变量全改成 `${var}`。
- **T-00X → T-004**：避免与真实任务 T-003 撞号。
- **T-003 未执行**：它是「产品体验与稳定性审计」真实任务（gate review，需真实浏览器走家长端/运营后台），按简报只入队、不执行。本轮用 STOP 在 T-004 后挡住它，保证它不会被驱动误跑。

## 7. 记录落点

- 简报 `.trellis/tasks/R0d/brief.md`；报告 `.trellis/tasks/R0d/report.md`。
- 机制文件 `.trellis/loop/`；驱动 `scripts/worker-loop.sh`；模型档位 `.trellis/loop/models.env`。
- 三轮任务报告：`.trellis/tasks/T-001/report.md`、`T-002/`、`T-004/`（含 progress.md）。
- 实验记录：`.trellis/workspace/yihu/experiment-log.md`（R0d 行 + 卡点 11–13）。
- 完成标记 `.trellis/loop/R0d.done`（gitignore 内）。

## 驱动启动命令

```bash
cd ~/Documents/ChatGPT/叮咚 && scripts/worker-loop.sh
```

常驻建议后台化（前台会被终端关掉），例如 `nohup scripts/worker-loop.sh >> .trellis/loop/runs/driver.out 2>&1 &`（`runs/` 已 gitignore）；停用 `touch .trellis/loop/STOP`。
