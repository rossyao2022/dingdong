#!/usr/bin/env bash
# T-022 收尾钩子自测用的假 grok：只改 .trellis/loop 下的状态文件，不执行任何真实任务。
# 由 FAKE_MODE 控制行为：request = 标 done 并新增一条测试 REQUEST；done = 只标 done；blocked = 标 blocked。
set -u

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$DIR/../../.." && pwd)"
QUEUE="$ROOT/.trellis/loop/queue.md"
GATES="$ROOT/.trellis/loop/gates.md"
MODE="${FAKE_MODE:-done}"
TASK="${LOOP_TASK_ID:-T-000}"
MARK="T-022 钩子自测，可忽略"

printf '%s fake-grok mode=%s task=%s args=%s\n' \
  "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$MODE" "$TASK" "$#" >>"$DIR/fake-grok-invocations.log"

case "$MODE" in
  blocked) STATUS="blocked" ;;
  *) STATUS="done" ;;
esac

python3 - "$QUEUE" "$TASK" "$STATUS" <<'PY'
import re, sys

queue, task, status = sys.argv[1:4]
lines = open(queue, encoding="utf-8").read().splitlines()
cur, out, done = None, [], False
for line in lines:
    m = re.match(r"^##\s+(T-\d+)", line)
    if m:
        cur = m.group(1)
    if cur == task and not done and re.match(r"^-\s*status\s*[:：]", line):
        out.append(f"- status: {status}")
        done = True
        continue
    out.append(line)
if not done:
    raise SystemExit(f"fake-grok: task {task} not found in queue.md")
open(queue, "w", encoding="utf-8").write("\n".join(out) + "\n")
PY

if [ "$MODE" = "request" ]; then
  python3 - "$GATES" "$MARK" <<'PY'
import sys

gates, mark = sys.argv[1:3]
text = open(gates, encoding="utf-8").read()
if mark not in text:
    marker = "<!-- 下面按时间追加 -->\n"
    if marker not in text:
        raise SystemExit("fake-grok: gates.md 申请段锚点缺失")
    ts = __import__("datetime").datetime.now(__import__("datetime").timezone.utc).strftime("%Y-%m-%dT%H:%MZ")
    line = f"REQUEST T-099 push 驱动收尾钩子实测，{mark} {ts}\n"
    text = text.replace(marker, marker + line, 1)
    open(gates, "w", encoding="utf-8").write(text)
PY
fi

printf '{"text":"fake grok: mode=%s task=%s"}\n' "$MODE" "$TASK"
exit 0
