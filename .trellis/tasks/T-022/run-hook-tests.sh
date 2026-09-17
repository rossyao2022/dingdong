#!/usr/bin/env bash
# T-022 收尾钩子实测：用假 grok（LOOP_GROK_BIN）+ 临时自测任务 T-096…T-099 跑驱动，
# 断言钩子的触发条件与「每轮至多一次」。不执行任何真实任务。
#
# 用法：TESTS=all|A|BC|A|B|C [SMOKE=1] bash .trellis/tasks/T-022/run-hook-tests.sh
#   A = 新增 REQUEST（默认走真 herdr；SMOKE=1 改走假唤醒）
#   B = 无门禁变化（假唤醒，应 0 次调用）
#   C = 新出现 blocked 任务（假唤醒）
set -u

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$DIR/../../.." && pwd)"
QUEUE="$ROOT/.trellis/loop/queue.md"
GATES="$ROOT/.trellis/loop/gates.md"
RUNS_LOG="$ROOT/.trellis/loop/runs.log"
FAKE_WAKE_LOG="$DIR/fake-wake-invocations.log"
TESTS="${TESTS:-all}"
PASS=0
FAIL=0
LAST_RC=0

say() { printf '%s\n' "$*"; }

check() { # $1 描述, $2 条件（0=真）
  if [ "$2" -eq 0 ]; then
    PASS=$((PASS + 1))
    say "PASS $1"
  else
    FAIL=$((FAIL + 1))
    say "FAIL $1"
  fi
}

today_rounds() {
  python3 - "$RUNS_LOG" <<'PY'
import datetime, sys
today = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")
print(sum(1 for line in open(sys.argv[1], encoding="utf-8")
          if line.startswith(today) and " ROUND " in line))
PY
}

wake_lines() {
  python3 -c "import sys; print(sum('WAKE' in l for l in open(sys.argv[1], encoding='utf-8')))" "$RUNS_LOG"
}

fake_wake_lines() {
  python3 -c "
import pathlib, sys
p = pathlib.Path(sys.argv[1])
print(p.read_text(encoding='utf-8').count('fake-wake') if p.exists() else 0)
" "$FAKE_WAKE_LOG"
}

pane_state() { # 输出 "revision agent_status"
  herdr pane list --workspace w0 2>/dev/null | python3 -c "
import json, sys
for p in json.load(sys.stdin)['result']['panes']:
    if p['pane_id'] == 'w0:p4':
        print(p['revision'], p['agent_status'])
"
}

# 面板 revision 是异步刷新的：等它超过开工前的值，最多等 15s。
pane_rev_after() { # $1 开工前 revision
  local before="$1" rev=0 i
  for i in 1 2 3 4 5; do
    rev="$(pane_state | cut -d' ' -f1)"
    [ "${rev:-0}" -gt "${before:-0}" ] && break
    sleep 3
  done
  printf '%s %s\n' "${rev:-0}" "$(pane_state | cut -d' ' -f2)"
}

run_driver() { # $1 轮数, $2 FAKE_MODE, $3 LOOP_WAKE_CMD（空=真 herdr）, $4 输出文件
  local rounds="$1" mode="$2" wake="$3" out="$4" today
  today="$(today_rounds)"
  LOOP_GROK_BIN="$DIR/fake-grok.sh" FAKE_MODE="$mode" LOOP_WAKE_CMD="$wake" \
    LOOP_DAILY_LIMIT=$((today + rounds)) LOOP_IDLE_SLEEP=5 \
    bash "$ROOT/scripts/worker-loop.sh" >"$out" 2>&1
  LAST_RC=$?
  say "--- 驱动退出码 ${LAST_RC}（${out}，日上限 $((today + rounds))）---"
}

run_a() {
  local wake_a="" out_a="$DIR/run-A-request.txt" wake_before fake_before rev_before wake_after rev_after after_state
  if [ "${SMOKE:-0}" = "1" ]; then
    wake_a="$DIR/fake-wake.sh"
    out_a="$DIR/run-A-smoke.txt"
  fi
  say "=== A：新增 REQUEST（$( [ -n "$wake_a" ] && echo 假唤醒 || echo 真 herdr )）==="
  python3 "$DIR/gates-test-line.py" clear >/dev/null
  python3 "$DIR/queue-temp-task.py" insert T-099 >/dev/null
  wake_before="$(wake_lines)"
  fake_before="$(fake_wake_lines)"
  rev_before="$(pane_state | cut -d' ' -f1)"
  run_driver 1 request "$wake_a" "$out_a"
  wake_after="$(wake_lines)"
  after_state="$(pane_rev_after "$rev_before")"
  rev_after="$(printf '%s' "$after_state" | cut -d' ' -f1)"
  cat "$out_a"
  check "A 驱动输出出现叫醒记录（新增 REQUEST）" "$(grep -q "已叫醒 orchestrator（T-099 gates.md 新增 REQUEST）" "$out_a"; echo $?)"
  check "A runs.log 新增 1 条 WAKE 行" "$([ $((wake_after - wake_before)) -eq 1 ]; echo $?)"
  if [ -n "$wake_a" ]; then
    say "SKIP A 真 herdr 两项断言（SMOKE 模式）"
  else
    check "A 未走假唤醒通道（假唤醒计数不变）" "$([ "$(fake_wake_lines)" -eq "$fake_before" ]; echo $?)"
    check "A orchestrator 面板 revision 增大（${rev_before}→${rev_after}，状态 ${after_state#* }）" "$([ "${rev_after:-0}" -gt "${rev_before:-0}" ]; echo $?)"
  fi
  check "A 钩子后驱动正常走到下一轮判定（日上限退出）" "$(grep -q "已达每日迭代上限" "$out_a"; echo $?)"
  check "A 驱动退出码 0" "$([ "$LAST_RC" -eq 0 ]; echo $?)"
  python3 "$DIR/queue-temp-task.py" remove T-099 >/dev/null
}

run_b() {
  local out="$DIR/run-B-nochange.txt" wake_before fake_before
  say "=== B：无门禁变化（假唤醒）==="
  python3 "$DIR/queue-temp-task.py" insert T-098 >/dev/null
  python3 "$DIR/queue-temp-task.py" insert T-097 >/dev/null
  wake_before="$(wake_lines)"
  fake_before="$(fake_wake_lines)"
  run_driver 2 done "$DIR/fake-wake.sh" "$out"
  cat "$out"
  check "B 两轮都跑完（2 条轮次记录）" "$([ "$(grep -c '轮次记录' "$out")" -eq 2 ]; echo $?)"
  check "B 未叫醒（runs.log 无新增 WAKE 行）" "$([ "$(wake_lines)" -eq "$wake_before" ]; echo $?)"
  check "B 假唤醒通道 0 次调用" "$([ "$(fake_wake_lines)" -eq "$fake_before" ]; echo $?)"
  check "B 驱动退出码 0" "$([ "$LAST_RC" -eq 0 ]; echo $?)"
  python3 "$DIR/queue-temp-task.py" remove T-098 >/dev/null
  python3 "$DIR/queue-temp-task.py" remove T-097 >/dev/null
}

run_c() {
  local out="$DIR/run-C-blocked.txt" wake_before fake_before
  say "=== C：新出现 blocked 任务（假唤醒）==="
  python3 "$DIR/queue-temp-task.py" insert T-096 >/dev/null
  wake_before="$(wake_lines)"
  fake_before="$(fake_wake_lines)"
  run_driver 1 blocked "$DIR/fake-wake.sh" "$out"
  cat "$out"
  check "C 驱动输出出现叫醒记录（新 blocked 任务）" "$(grep -q "已叫醒 orchestrator（T-096 新 blocked 任务 T-096）" "$out"; echo $?)"
  check "C runs.log 新增 1 条 WAKE 行" "$([ $(( $(wake_lines) - wake_before )) -eq 1 ]; echo $?)"
  check "C 假唤醒通道新增 1 次调用" "$([ $(( $(fake_wake_lines) - fake_before )) -eq 1 ]; echo $?)"
  check "C 驱动退出码 0（钩子不影响驱动）" "$([ "$LAST_RC" -eq 0 ]; echo $?)"
  python3 "$DIR/queue-temp-task.py" remove T-096 >/dev/null
}

run_d() {
  local out="$DIR/run-D-wakefail.txt" wake_before fake_before last_wake
  say "=== D：唤醒命令失败（假唤醒退出 3）==="
  python3 "$DIR/gates-test-line.py" clear >/dev/null
  python3 "$DIR/queue-temp-task.py" insert T-095 >/dev/null
  wake_before="$(wake_lines)"
  fake_before="$(fake_wake_lines)"
  run_driver 1 request "$DIR/fake-wake-fail.sh" "$out"
  cat "$out"
  last_wake="$(grep 'WAKE' "$RUNS_LOG" | tail -1)"
  say "D runs.log 最后一条 WAKE 行：${last_wake}"
  check "D 驱动输出记录唤醒失败（rc=3）" "$(grep -q "叫醒 orchestrator 失败（rc=3）" "$out"; echo $?)"
  check "D runs.log 新增 1 条 WAKE FAIL 行" "$([ $(( $(wake_lines) - wake_before )) -eq 1 ] && printf '%s' "$last_wake" | grep -q "WAKE FAIL T-095 gates.md 新增 REQUEST rc=3"; echo $?)"
  check "D 唤醒失败不阻断后续轮询（走到下一轮判定）" "$(grep -q "已达每日迭代上限" "$out"; echo $?)"
  check "D 驱动退出码 0" "$([ "$LAST_RC" -eq 0 ]; echo $?)"
  check "D 假唤醒被调用 1 次" "$([ $(( $(fake_wake_lines) - fake_before )) -eq 1 ]; echo $?)"
  python3 "$DIR/queue-temp-task.py" remove T-095 >/dev/null
}

case "$TESTS" in
  A) run_a ;;
  B) run_b ;;
  C) run_c ;;
  D) run_d ;;
  BC) run_b; run_c ;;
  all) run_a; run_b; run_c ;;
  *) say "未知 TESTS=$TESTS"; exit 2 ;;
esac

say ""
say "=== 结果：TESTS=${TESTS} PASS=${PASS} FAIL=${FAIL} ==="
say "queue.md 残留自测任务：$(grep -c '驱动收尾钩子自测' "$QUEUE")"
say "gates.md 测试 REQUEST 行：$(grep -c 'T-022 钩子自测，可忽略' "$GATES")"
[ "$FAIL" -eq 0 ]
