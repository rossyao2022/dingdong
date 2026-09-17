#!/usr/bin/env bash
# 探活 watchdog：驱动进程不在且无 STOP 时把它拉起来。
#
# 用法：
#   scripts/loop-watchdog.sh            # 手动跑一次（有动作时打印）
#   由 launchd 每 5 分钟调一次（见 scripts/com.yihu.dingdong.loop-watchdog.plist）
# 语义：
#   - 驱动活着（pgrep 命中）→ 什么都不做，exit 0。
#   - .trellis/loop/STOP 存在 → 人为停机是唯一合法停机方式，不拉起，exit 0。
#   - 驱动死了且无 STOP → 优先在原驱动面板（默认 w0:p3）重启，保住 pane 可见性；
#     面板不存在（tab 被关）→ nohup 后台拉起，输出续写 driver.out。
#   - 每次拉起在 runs.log 记一行 WATCHDOG，便于追溯。
# 环境变量：LOOP_DRIVER_PANE（默认 w0:p3，面板号变了就改这里或 plist）。
set -u

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOOP_DIR="$PROJECT_ROOT/.trellis/loop"
STOP="$LOOP_DIR/STOP"
RUNS_LOG="$LOOP_DIR/runs.log"
DRIVER_PANE="${LOOP_DRIVER_PANE:-w0:p3}"
DRIVER_WS="${DRIVER_PANE%%:*}"

# 用 \. 防止 pgrep -f 匹配到自身命令行。
if pgrep -f 'scripts/worker-loop\.sh' >/dev/null 2>&1; then
  exit 0
fi

if [ -f "$STOP" ]; then
  echo "watchdog：STOP 存在，视为人为停机，不拉起（$(date -u +%Y-%m-%dT%H:%M:%SZ)）"
  exit 0
fi

logline() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >>"$RUNS_LOG"; }

START_CMD="cd '$PROJECT_ROOT' && rm -f '$STOP' && scripts/worker-loop.sh 2>&1 | tee -a '$LOOP_DIR/runs/driver.out'"

if command -v herdr >/dev/null 2>&1 \
   && herdr pane list --workspace "$DRIVER_WS" 2>/dev/null | grep -q "\"$DRIVER_PANE\""; then
  echo "watchdog：驱动不在，在面板 $DRIVER_PANE 重启（$(date -u +%Y-%m-%dT%H:%M:%SZ)）"
  if herdr pane run "$DRIVER_PANE" "$START_CMD"; then
    logline "WATCHDOG 在面板 $DRIVER_PANE 重启驱动"
  else
    logline "WATCHDOG pane run 失败，改走 nohup 后台拉起"
    (cd "$PROJECT_ROOT" && rm -f "$STOP" && nohup bash scripts/worker-loop.sh >>"$LOOP_DIR/runs/driver.out" 2>&1 &)
    logline "WATCHDOG nohup 后台拉起驱动"
  fi
else
  echo "watchdog：驱动面板 $DRIVER_PANE 不在 herdr 会话，nohup 后台拉起（$(date -u +%Y-%m-%dT%H:%M:%SZ)）"
  (cd "$PROJECT_ROOT" && rm -f "$STOP" && nohup bash scripts/worker-loop.sh >>"$LOOP_DIR/runs/driver.out" 2>&1 &)
  logline "WATCHDOG nohup 后台拉起驱动（面板 $DRIVER_PANE 不可用）"
fi
exit 0
