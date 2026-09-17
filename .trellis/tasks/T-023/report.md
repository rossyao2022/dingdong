# T-023 报告：ORCHESTRATOR.md 入库 + 关闭 R0d 遗留核对项

## goal（照抄队列）

把 `.trellis/loop/ORCHESTRATOR.md`（orchestrator 岗位说明，目前仍是未跟踪文件）用首行 `[T-023]` 的提交入库；并把 status.md 里反复出现的「R0d 会话收尾」核对项正式关闭：确认全仓已无假 grok 包装脚本残留（2026-09-17T07:22Z orchestrator 已核实 `.trellis/loop/runs/fake-grok.sh` 不存在；`.trellis/tasks/T-022/` 下的 fake-* 是钩子自测证据，保留不删），核对 `runs.log` 中 T-004 的 PRIMARY RATE_LIMITED / FALLBACK DONE 两行与 `runs/` 下 `20260917T055213Z-T-004-primary`、`20260917T055219Z-T-004-fallback` 两个记录一致。

## 实际做了什么

1. `git add .trellis/loop/ORCHESTRATOR.md` 入库，**内容一字未改**：入库前 `shasum -a 256` = `bec3d5cba9345674b077b06094ff0aef5ee2e174f2d6dff5fd1969f254268ec9`（58 行），提交后 `git show HEAD:.trellis/loop/ORCHESTRATOR.md | shasum -a 256` 同值。
2. 假 grok 包装脚本残留核对（两级扫描，见下「验证」）：按文件名 0 命中；按内容命中的 4 处全是文档/JSON 里的文字提及（`file` 判定为 UTF-8 文本或 JSON，无一可执行）。`.trellis/loop/runs/fake-grok.sh` 确认不存在（`.trellis/loop/` 下无任何 `.sh`）。
3. T-004 两行 `runs.log` 与 `runs/` 两个记录核对一致（时间线闭合，见下）。
4. 关闭 status.md「R0d 会话收尾」核对项，并对 status.md 原第 2 条待办给出正式答复：混轮提交账本类文件（`runs.log` / `queue.md` 的驱动行与 orchestrator 记录行）可接受，不必严格分轮——已写入本轮重写的 `status.md`。
5. 只改了 `.trellis/loop/` 与 `.trellis/tasks/T-023/` 下的文件，未碰业务代码、驱动脚本、门禁文件既有内容（`gates.md` 只追加 EXECUTED 行，`queue.md` 只改本任务 status/notes）。

## 验证命令与真实输出（原文存 `.trellis/tasks/T-023/verify-output.txt`，脚本 `verify.sh`）

### 命令1：按文件名扫描假 grok 包装脚本（排除 `.git` / `node_modules` / `.trellis/tasks/T-022`）

```
$ find . -path ./.git -prune -o -path ./node_modules -prune -o -path ./.trellis/tasks/T-022 -prune -o -type f \( -name '*fake*grok*' -o -name '*grok*wrap*' -o -name 'fake-*' \) -print
(无输出 = 0 个命中)
```

### 命令2：内容级扫描 `fake-grok|FAKE_MODE`（排除 `.git` / `node_modules` / `T-022` / `T-023`）

命中 4 处，逐条 `file` 判定如下（均为文字提及，不是脚本）：

```
./.trellis/tasks/R0d/report.md -> Unicode text, UTF-8 text
./.trellis/loop/queue.md -> Unicode text, UTF-8 text, with very long
./.trellis/loop/runs/20260917T071332Z-T-022-primary.json -> JSON data
./.trellis/loop/runs/20260917T054913Z-T-001-primary.json -> JSON data
```

### 命令3：T-022 目录内的假脚本（自测证据，按任务说明保留）

```
-rwxr-xr-x@ 1 yihu  staff  2039 Sep 17 15:17 .trellis/tasks/T-022/fake-grok.sh
-rwxr-xr-x@ 1 yihu  staff   319 Sep 17 15:20 .trellis/tasks/T-022/fake-wake-fail.sh
-rwxr-xr-x@ 1 yihu  staff   313 Sep 17 15:17 .trellis/tasks/T-022/fake-wake.sh
```

### 命令4：T-004 两行 `runs.log` 与 `runs/` 记录核对

```
$ grep 'T-004' .trellis/loop/runs.log
2026-09-17T05:52:19Z ROUND T-004 RATE_LIMITED 5s d22eaf5 deepseek-v4-1-flash-260910 rc=42,dirty-worktree
2026-09-17T06:00:35Z ROUND T-004 DONE 496s e42e25e deepseek-v4-pro rc=0,dirty-worktree

$ ls -l .trellis/loop/runs/20260917T055213Z-T-004-primary.json .trellis/loop/runs/20260917T055219Z-T-004-fallback.json
-rw-r--r--@ 1 yihu  staff     61 Sep 17 13:52 .trellis/loop/runs/20260917T055213Z-T-004-primary.json
-rw-r--r--@ 1 yihu  staff  93928 Sep 17 14:00 .trellis/loop/runs/20260917T055219Z-T-004-fallback.json

$ cat .trellis/loop/runs/20260917T055213Z-T-004-primary.json
{"error":{"message":"TooManyRequests: rate limit exceeded"}}

$ head -c 60 .trellis/loop/runs/20260917T055219Z-T-004-fallback.json
{
  "text": "TRELLIS-OK\n\n我是本轮一次性 worker。�
```

核对结论（一致，4 条对齐）：

| 项 | runs.log 行 | runs/ 记录 | 对齐方式 |
|---|---|---|---|
| PRIMARY 结果 | `RATE_LIMITED`、`rc=42`、模型 `deepseek-v4-1-flash-260910` | `20260917T055213Z-T-004-primary.json` 内容 `TooManyRequests: rate limit exceeded` | 记录内容即限流错误体，与 `classify` 判 RATE_LIMITED 一致 |
| PRIMARY 时间/耗时 | 行时间 `05:52:19Z`、`5s` | 文件名 ts `05:52:13Z` | `ts` 在 `run_round` 开工时取（`worker-loop.sh` 第 314 行），`record_round` 在 `classify`+取 sha 之后写（第 307 行）；05:52:13+5s=05:52:18，写行 05:52:19，晚 1s 属写行开销 |
| FALLBACK 结果 | `DONE`、`rc=0`、模型 `deepseek-v4-pro` | `20260917T055219Z-T-004-fallback.json`（93928 字节，`text` 为完整答卷） | 非限流错误体 → DONE；模型列取自 `MODEL_FALLBACK` |
| FALLBACK 时间/耗时 | 行时间 `06:00:35Z`、`496s` | 文件名 ts `05:52:19Z` | 05:52:19+496s=06:00:35，与行时间秒级完全一致；`ts2` 与 primary 的 ROUND 行同一秒，说明是紧接 primary 判限流后立即重跑 |

### 命令5：ORCHESTRATOR.md 入库状态

提交前：

```
$ git status --short
 M .trellis/loop/queue.md
 M .trellis/loop/runs.log
?? .trellis/loop/ORCHESTRATOR.md
?? .trellis/tasks/T-023/

$ git ls-files --error-unmatch .trellis/loop/ORCHESTRATOR.md
error: pathspec '.trellis/loop/ORCHESTRATOR.md' did not match any file(s) known to git
```

提交后（本轮收尾复跑，输出追加在 `verify-output.txt` 末尾）：

```
$ git status --short
（无 `?? .trellis/loop/ORCHESTRATOR.md`）

$ git ls-files --error-unmatch .trellis/loop/ORCHESTRATOR.md
.trellis/loop/ORCHESTRATOR.md
```

### 命令6：文档审计

```
$ python3 scripts/audit_documents.py
（errors: [] 见下方「收尾复跑」小节）
```

## 卡点

- 收尾记录提交推送时 ssh 走 `ssh.github.com:443`，被本机 TUN fake-ip 掐断两次：`Connection closed by 198.18.0.10 port 443` / `fatal: Could not read from remote repository.`（两次均为瞬时失败，非权限问题）。重试循环第 1 次即成功 `a900a01..b8e4bb0`，远端 sha `b8e4bb090c323fd19c396be63d50ebf5a6de5985`，与本地 HEAD 一致。首个提交 `a900a01` 的推送一次成功。

## 未验证项

- `status.md` 里「环境事实：钩子从下次启动驱动起生效」那条按 bash 解析行为的推断，本轮未实测（不在本任务范围，原样保留在 status.md）。
- `runs.log` 中历史行的驱动写入时序只按 `worker-loop.sh` 源码推得，未重跑驱动复现 T-004 那两行（重跑需要伪造限流包装脚本，本任务明确不保留该脚本）。

## 偏离与理由

- 无偏离（唯一插曲是上面的网络瞬时失败，靠重试解决，未改任何配置）。未新增任何依赖、未改驱动与业务代码、未 push 之外触达远端；push 按本任务 `gate: push` + notes 的「机制任务直推」规则执行，并在 `gates.md` 补 EXECUTED 行。
