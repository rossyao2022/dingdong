#!/usr/bin/env bash
# 左侧自循环驱动：反复起一次性 grok 进程，每轮做一个任务，直到 STOP 或达到每日上限。
#
# 用法：
#   scripts/worker-loop.sh                          # 前台常驻（空转轮询 600s）
#   LOOP_IDLE_SLEEP=15 scripts/worker-loop.sh       # 联调时空转调短
# 停止：touch .trellis/loop/STOP（当前轮跑完即退出）
# 可调环境变量：LOOP_IDLE_SLEEP / LOOP_ROUND_TIMEOUT / LOOP_RATE_LIMIT_SLEEP /
#              LOOP_DAILY_LIMIT / LOOP_MODEL（留空 = 沿用 grok 当前配置的默认模型）/ LOOP_GROK_BIN
# 只用 bash + git + python3（stdlib），无新依赖。
set -u

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOOP_DIR="$PROJECT_ROOT/.trellis/loop"
QUEUE="$LOOP_DIR/queue.md"
GATES="$LOOP_DIR/gates.md"
STATUS="$LOOP_DIR/status.md"
PROMPT="$LOOP_DIR/prompt.md"
RUNS="$LOOP_DIR/runs"
RUNS_LOG="$LOOP_DIR/runs.log"
STOP="$LOOP_DIR/STOP"

GROK_BIN="${LOOP_GROK_BIN:-$HOME/.grok/bin/grok}"
IDLE_SLEEP="${LOOP_IDLE_SLEEP:-600}"
ROUND_TIMEOUT="${LOOP_ROUND_TIMEOUT:-2400}"
RATE_SLEEP="${LOOP_RATE_LIMIT_SLEEP:-180}"
DAILY_LIMIT="${LOOP_DAILY_LIMIT:-40}"
MODEL="${LOOP_MODEL:-}"

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

# 判定本轮结果：DONE / GATED / BLOCKED / FAIL / RATE_LIMITED
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

# 同一任务尾部连续失败次数（FAIL / RATE_LIMITED）
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

run_round() {
  local task="$1" ts out err rc dur start pid timed_out=0 result sha note
  ts="$(date -u +%Y%m%dT%H%M%SZ)"
  out="$RUNS/$ts-$task.json"
  err="$RUNS/$ts-$task.err"
  start=$SECONDS

  local args=(-p "$(cat "$PROMPT")" --cwd "$PROJECT_ROOT" --always-approve --no-auto-update --output-format json)
  if [ -n "$MODEL" ]; then
    args+=(--model "$MODEL")
  fi

  say "轮次开始：${task}（超时上限 ${ROUND_TIMEOUT}s）"
  "$GROK_BIN" "${args[@]}" >"$out" 2>"$err" &
  pid=$!

  while kill -0 "$pid" 2>/dev/null; do
    if [ $((SECONDS - start)) -ge "$ROUND_TIMEOUT" ]; then
      say "单轮超时，终止 pid=$pid"
      pkill -TERM -P "$pid" 2>/dev/null || true
      kill -TERM "$pid" 2>/dev/null || true
      sleep 5
      pkill -KILL -P "$pid" 2>/dev/null || true
      kill -KILL "$pid" 2>/dev/null || true
      timed_out=1
      break
    fi
    sleep 5
  done
  wait "$pid"
  rc=$?
  dur=$((SECONDS - start))

  result="$(classify "$task" "$rc" "$out" "$err" "$timed_out")"
  sha="$(git rev-parse --short HEAD 2>/dev/null || echo -)"
  note="rc=$rc"
  [ "$timed_out" = 1 ] && note="$note,timeout"

  if [ -n "$(git status --short)" ]; then
    note="$note,dirty-worktree"
    say "警告：本轮结束工作区仍有未提交改动（worker 应自己 commit 干净）"
  fi

  printf '%s ROUND %s %s %ss %s %s\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$task" "$result" "$dur" "$sha" "$note" >>"$RUNS_LOG"
  say "轮次结束：${task} ${result}（${dur}s，HEAD=${sha}）"

  case "$result" in
    FAIL | RATE_LIMITED)
      local fails
      fails="$(consecutive_failures "$task")"
      if [ "$fails" -ge 2 ]; then
        mark_blocked "$task"
        logline "BLOCKED $task 连续失败 $fails 次，已标 blocked 并记入 status.md"
        say "$task 连续失败 $fails 次 → 已标 blocked，继续下一个任务"
      fi
      if [ "$result" = RATE_LIMITED ]; then
        logline "RATE_LIMITED $task sleep ${RATE_SLEEP}s"
        say "疑似限流，sleep ${RATE_SLEEP}s"
        sleep "$RATE_SLEEP"
      fi
      ;;
  esac
}

say "驱动启动：root=$PROJECT_ROOT 空转间隔=${IDLE_SLEEP}s 单轮上限=${ROUND_TIMEOUT}s 每日上限=${DAILY_LIMIT} 模型=${MODEL:-沿用默认}"
logline "START 驱动启动 idle=${IDLE_SLEEP}s round_timeout=${ROUND_TIMEOUT}s daily_limit=${DAILY_LIMIT} model=${MODEL:-default}"

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
