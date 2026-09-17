#!/usr/bin/env bash
# 左侧自循环驱动：反复起一次性 grok 进程，每轮做一个任务，直到 STOP 或达到每日上限。
#
# 用法：
#   scripts/worker-loop.sh                          # 前台常驻（空转轮询 600s）
#   LOOP_IDLE_SLEEP=15 scripts/worker-loop.sh       # 联调时空转调短
# 停止：touch .trellis/loop/STOP（当前轮跑完即退出）
#
# 双模型（R0e）：启动时读 .trellis/loop/models.env 的 MODEL_PRIMARY / MODEL_FALLBACK。
#   - 每轮先用 PRIMARY 跑；该轮 grok 进程疑似限流（TooManyRequests / rate limit / 429）时，
#     立刻用 FALLBACK 重跑同一任务；下一轮回到 PRIMARY。两个都限流才 sleep 退避。
#   - 只允许 Flash→Pro 升级，不写降级路径。
# 收尾钩子（T-022）：每轮 worker 退出后，与本轮开工时的基线对比——`gates.md` 申请段
#   新增了 REQUEST 行、或 `queue.md` 里新出现 `status: blocked` 的任务——就调一次
#   `herdr agent prompt <面板> "查岗：…"`（不带 --wait）叫醒 orchestrator。每轮至多一次；
#   该命令失败只记一行日志，不改变驱动退出码、不影响后续轮询。
# 可调环境变量：LOOP_IDLE_SLEEP / LOOP_ROUND_TIMEOUT / LOOP_RATE_LIMIT_SLEEP /
#              LOOP_DAILY_LIMIT / LOOP_GROK_BIN（联调可指向假 grok 包装脚本）/
#              LOOP_ORCH_PANE（orchestrator 面板，默认 w0:p4）/
#              LOOP_WAKE_CMD（联调可指向假唤醒命令，默认调 herdr）
# 只用 bash + git + python3（stdlib），无新依赖。
set -u

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOOP_DIR="$PROJECT_ROOT/.trellis/loop"
QUEUE="$LOOP_DIR/queue.md"
GATES="$LOOP_DIR/gates.md"
STATUS="$LOOP_DIR/status.md"
PROMPT="$LOOP_DIR/prompt.md"
MODELS_ENV="$LOOP_DIR/models.env"
RUNS="$LOOP_DIR/runs"
RUNS_LOG="$LOOP_DIR/runs.log"
STOP="$LOOP_DIR/STOP"

GROK_BIN="${LOOP_GROK_BIN:-$HOME/.grok/bin/grok}"
IDLE_SLEEP="${LOOP_IDLE_SLEEP:-600}"
ROUND_TIMEOUT="${LOOP_ROUND_TIMEOUT:-2400}"
RATE_SLEEP="${LOOP_RATE_LIMIT_SLEEP:-180}"
DAILY_LIMIT="${LOOP_DAILY_LIMIT:-40}"
ORCH_PANE="${LOOP_ORCH_PANE:-w0:p4}"
WAKE_CMD="${LOOP_WAKE_CMD:-}"
ORCH_WAKE_TEXT="查岗：读 .trellis/loop/ORCHESTRATOR.md 的门禁规则，处理 gates.md 新申请"

MODEL_PRIMARY="deepseek-v4-1-flash-260910"
MODEL_FALLBACK="deepseek-v4-pro"
if [ -f "$MODELS_ENV" ]; then
  # models.env 只有 `KEY=VALUE` 与注释，安全 source（不执行任意命令：逐行读取）。
  while IFS='=' read -r key val; do
    case "$key" in
      MODEL_PRIMARY) MODEL_PRIMARY="$val" ;;
      MODEL_FALLBACK) MODEL_FALLBACK="$val" ;;
    esac
  done < <(grep -vE '^\s*#|^\s*$' "$MODELS_ENV")
fi

cd "$PROJECT_ROOT" || exit 1
mkdir -p "$RUNS"
touch "$RUNS_LOG"

say() { printf '[loop %s] %s\n' "$(date -u +%H:%M:%SZ)" "$*"; }
logline() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >>"$RUNS_LOG"; }

# 取下一个要做的任务：优先「已 APPROVE 且仍 gated」的任务，其次第一个 todo。
next_task() {
  python3 - "$QUEUE" "$GATES" <<'PY'
import re, sys

queue = open(sys.argv[1], encoding="utf-8").read()
gates = open(sys.argv[2], encoding="utf-8").read()

tasks, cur = [], None
for line in queue.splitlines():
    m = re.match(r"^##\s+(T-\d+)\s+(.*)$", line)
    if m:
        cur = {"id": m.group(1), "status": ""}
        tasks.append(cur)
        continue
    if cur is not None:
        f = re.match(r"^-\s*status\s*[:：]\s*(\S+)", line)
        if f:
            cur["status"] = f.group(1)

decision = gates.split("## 决定", 1)[1] if "## 决定" in gates else ""
approved = set(re.findall(r"^APPROVE\s+(T-\d+)", decision, re.M))

for t in tasks:
    if t["status"] == "gated" and t["id"] in approved:
        print(t["id"])
        raise SystemExit
for t in tasks:
    if t["status"] == "todo":
        print(t["id"])
        raise SystemExit
PY
}

# 判定一次 grok 调用的结果：DONE / GATED / BLOCKED / FAIL / RATE_LIMITED
classify() {
  python3 - "$QUEUE" "$1" "$2" "$3" "$4" "$5" <<'PY'
import re, sys

queue, task, rc, out, err, timed_out = sys.argv[1:7]
rc, timed_out = int(rc), int(timed_out)

status = ""
cur = None
for line in open(queue, encoding="utf-8"):
    m = re.match(r"^##\s+(T-\d+)", line)
    if m:
        cur = m.group(1)
        continue
    if cur == task:
        f = re.match(r"^-\s*status\s*[:：]\s*(\S+)", line)
        if f:
            status = f.group(1)

blob = ""
for path in (out, err):
    try:
        blob += open(path, encoding="utf-8", errors="replace").read()
    except FileNotFoundError:
        pass
rate = bool(re.search(r"TooManyRequests|too many requests|rate limit|rate_limit|429", blob, re.I))

if status == "done":
    print("DONE")
elif rate:
    print("RATE_LIMITED")
elif timed_out == 1 or rc != 0:
    print("FAIL")
elif status == "gated":
    print("GATED")
elif status == "blocked":
    print("BLOCKED")
else:
    print("FAIL")
PY
}

# 同一任务尾部连续失败次数（FAIL / RATE_LIMITED），用于「连续 2 次 → blocked」。
consecutive_failures() {
  python3 - "$RUNS_LOG" "$1" <<'PY'
import sys

n = 0
for line in reversed(open(sys.argv[1], encoding="utf-8").read().splitlines()):
    parts = line.split()
    if len(parts) < 4 or parts[1] != "ROUND":
        continue
    if parts[2] != sys.argv[2]:
        break
    if parts[3] in ("FAIL", "RATE_LIMITED"):
        n += 1
    else:
        break
print(n)
PY
}

iterations_today() {
  python3 - "$RUNS_LOG" <<'PY'
import datetime, sys

today = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")
print(sum(1 for line in open(sys.argv[1], encoding="utf-8")
          if line.startswith(today) and " ROUND " in line))
PY
}

mark_blocked() {
  python3 - "$QUEUE" "$1" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" <<'PY'
import re, sys

queue, task, ts = sys.argv[1:4]
lines = open(queue, encoding="utf-8").read().splitlines()
cur, out, done = None, [], False
for line in lines:
    m = re.match(r"^##\s+(T-\d+)", line)
    if m:
        cur = m.group(1)
    if cur == task and not done and re.match(r"^-\s*status\s*[:：]", line):
        out.append(f"- status: blocked")
        out.append(f"- notes: 驱动自动标记——同一任务连续失败 2 次（{ts}）。需 orchestrator 介入后再改回 todo。")
        done = True
        continue
    out.append(line)
open(queue, "w", encoding="utf-8").write("\n".join(out) + "\n")
PY
  {
    echo ""
    echo "## 驱动告警"
    echo "- 需 orchestrator：$1 连续失败 2 次，已自动标 blocked（$(date -u +%Y-%m-%dT%H:%M:%SZ)）。"
  } >>"$STATUS"
}

# 门禁快照：两行——申请段 REQUEST 行的指纹、queue.md 里 blocked 任务 id 列表。
loop_gate_snapshot() {
  python3 - "$GATES" "$QUEUE" <<'PY'
import hashlib, re, sys

gates = open(sys.argv[1], encoding="utf-8").read()
queue = open(sys.argv[2], encoding="utf-8").read()

apply_sec = gates.split("## 申请", 1)[1].split("## 决定", 1)[0] if "## 申请" in gates else ""
reqs = "\n".join(re.findall(r"^REQUEST\s+\S+.*$", apply_sec, re.M))

blocked, cur = [], None
for line in queue.splitlines():
    m = re.match(r"^##\s+(T-\d+)", line)
    if m:
        cur = m.group(1)
        continue
    if cur and re.match(r"^-\s*status\s*[:：]\s*blocked\b", line):
        blocked.append(cur)

print(hashlib.md5(reqs.encode()).hexdigest())
print(",".join(blocked))
PY
}

# 叫醒 orchestrator：不带 --wait，失败只记日志，不影响驱动退出码与后续轮询。
wake_orchestrator() {
  local reason="$1" rc=0
  if [ -n "$WAKE_CMD" ]; then
    "$WAKE_CMD" "$reason" >/dev/null 2>&1
    rc=$?
  else
    herdr agent prompt "$ORCH_PANE" "$ORCH_WAKE_TEXT" >/dev/null 2>&1
    rc=$?
  fi
  if [ "$rc" -eq 0 ]; then
    logline "WAKE OK $reason"
    say "已叫醒 orchestrator（${reason}）"
  else
    logline "WAKE FAIL $reason rc=$rc"
    say "叫醒 orchestrator 失败（rc=${rc}），只记日志，继续轮询"
  fi
  return 0
}

# 与本轮开工基线对比：新增 REQUEST 行或新出现 blocked 任务 → 叫醒一次（每轮至多一次）。
notify_orchestrator_if_needed() {
  local task="$1" req_before="$2" blocked_before="$3" snap req_after blocked_after reason new_blocked
  snap="$(loop_gate_snapshot)"
  req_after="$(printf '%s\n' "$snap" | sed -n 1p)"
  blocked_after="$(printf '%s\n' "$snap" | sed -n 2p)"

  reason=""
  if [ "$req_after" != "$req_before" ]; then
    reason="gates.md 新增 REQUEST"
  fi
  new_blocked="$(python3 - "$blocked_before" "$blocked_after" <<'PY'
import sys

before = [x for x in sys.argv[1].split(",") if x]
after = [x for x in sys.argv[2].split(",") if x]
print(",".join(x for x in after if x not in before))
PY
)"
  if [ -n "$new_blocked" ]; then
    reason="${reason:+${reason}、}新 blocked 任务 ${new_blocked}"
  fi

  if [ -n "$reason" ]; then
    wake_orchestrator "$task $reason"
  fi
}

# 跑一次 grok。输出到 $3/$4；全局 _rc / _timed_out / _dur 返回。
run_once() {
  local task="$1" model="$2" out="$3" err="$4" start pid
  local args=(-p "$(cat "$PROMPT")" --cwd "$PROJECT_ROOT" --always-approve --no-auto-update --output-format json --model "$model")

  start=$SECONDS
  export LOOP_TASK_ID="$task"
  "$GROK_BIN" "${args[@]}" >"$out" 2>"$err" &
  pid=$!

  _timed_out=0
  while kill -0 "$pid" 2>/dev/null; do
    if [ $((SECONDS - start)) -ge "$ROUND_TIMEOUT" ]; then
      say "单轮超时，终止 pid=${pid}（模型=${model}）"
      pkill -TERM -P "$pid" 2>/dev/null || true
      kill -TERM "$pid" 2>/dev/null || true
      sleep 5
      pkill -KILL -P "$pid" 2>/dev/null || true
      kill -KILL "$pid" 2>/dev/null || true
      _timed_out=1
      break
    fi
    sleep 5
  done
  wait "$pid"
  _rc=$?
  _dur=$((SECONDS - start))
}

record_round() {
  # $1 task, $2 result, $3 dur, $4 model, $5 note
  local sha note
  sha="$(git rev-parse --short HEAD 2>/dev/null || echo -)"
  note="$5"
  if [ -n "$(git status --short -- . ':(exclude).trellis/loop/runs.log')" ]; then
    note="$note,dirty-worktree"
    say "警告：本轮结束工作区仍有未提交改动（worker 应自己 commit 干净）"
  fi
  printf '%s ROUND %s %s %ss %s %s %s\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" "$2" "$3" "$sha" "$4" "$note" >>"$RUNS_LOG"
  say "轮次记录：$1 $2（${3}s，模型=$4，HEAD=${sha}）"
}

run_round() {
  local task="$1" ts out err result snap req_before blocked_before
  ts="$(date -u +%Y%m%dT%H%M%SZ)"

  # 开工基线：收尾钩子据此判断本轮有没有新门禁申请 / 新 blocked 任务。
  snap="$(loop_gate_snapshot)"
  req_before="$(printf '%s\n' "$snap" | sed -n 1p)"
  blocked_before="$(printf '%s\n' "$snap" | sed -n 2p)"

  # 第一次：PRIMARY
  out="$RUNS/$ts-$task-primary.json"
  err="$RUNS/$ts-$task-primary.err"
  say "轮次开始：${task}（模型=${MODEL_PRIMARY}，超时上限 ${ROUND_TIMEOUT}s）"
  run_once "$task" "$MODEL_PRIMARY" "$out" "$err"
  result="$(classify "$task" "$_rc" "$out" "$err" "$_timed_out")"
  record_round "$task" "$result" "$_dur" "$MODEL_PRIMARY" "rc=$_rc"

  # 限流 → 立即用 FALLBACK 重跑同一任务（只做 Flash→Pro 升级）
  if [ "$result" = "RATE_LIMITED" ]; then
    local ts2 out2 err2 result2
    ts2="$(date -u +%Y%m%dT%H%M%SZ)"
    out2="$RUNS/$ts2-$task-fallback.json"
    err2="$RUNS/$ts2-$task-fallback.err"
    say "疑似限流，立即用 FALLBACK（${MODEL_FALLBACK}）重跑 ${task}"
    run_once "$task" "$MODEL_FALLBACK" "$out2" "$err2"
    result2="$(classify "$task" "$_rc" "$out2" "$err2" "$_timed_out")"
    record_round "$task" "$result2" "$_dur" "$MODEL_FALLBACK" "rc=$_rc"
    result="$result2"

    if [ "$result" = "RATE_LIMITED" ]; then
      logline "RATE_LIMITED $task 两个模型都限流，sleep ${RATE_SLEEP}s"
      say "两个模型都限流，sleep ${RATE_SLEEP}s"
      sleep "$RATE_SLEEP"
    fi
  fi

  case "$result" in
    FAIL | RATE_LIMITED)
      local fails
      fails="$(consecutive_failures "$task")"
      if [ "$fails" -ge 2 ]; then
        mark_blocked "$task"
        logline "BLOCKED $task 连续失败 $fails 次，已标 blocked 并记入 status.md"
        say "$task 连续失败 $fails 次 → 已标 blocked，继续下一个任务"
      fi
      ;;
  esac

  notify_orchestrator_if_needed "$task" "$req_before" "$blocked_before"
}

say "驱动启动：root=$PROJECT_ROOT 空转间隔=${IDLE_SLEEP}s 单轮上限=${ROUND_TIMEOUT}s 每日上限=${DAILY_LIMIT} PRIMARY=$MODEL_PRIMARY FALLBACK=$MODEL_FALLBACK"
logline "START 驱动启动 idle=${IDLE_SLEEP}s round_timeout=${ROUND_TIMEOUT}s daily_limit=${DAILY_LIMIT} primary=$MODEL_PRIMARY fallback=$MODEL_FALLBACK"

while :; do
  if [ -f "$STOP" ]; then
    say "检测到 STOP，驱动退出"
    logline "STOP 驱动退出"
    break
  fi

  today="$(iterations_today)"
  if [ "$today" -ge "$DAILY_LIMIT" ]; then
    say "已达每日迭代上限 ${DAILY_LIMIT}（今日 ${today} 轮），退出"
    logline "LIMIT 达到每日上限 ${DAILY_LIMIT}，驱动退出"
    break
  fi

  task="$(next_task)"
  if [ -z "$task" ]; then
    say "无 todo 任务、也无待执行的 APPROVE，空转 ${IDLE_SLEEP}s"
    sleep "$IDLE_SLEEP"
    continue
  fi

  run_round "$task"
done
