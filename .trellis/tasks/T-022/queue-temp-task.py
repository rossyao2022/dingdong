#!/usr/bin/env python3
"""T-022 收尾钩子自测：往 queue.md 临时插入 / 删除自测任务（T-096…T-099）。

用法：python3 queue-temp-task.py insert T-099 | python3 queue-temp-task.py remove T-099
"""
import re
import sys
from pathlib import Path

QUEUE = Path(__file__).resolve().parents[3] / ".trellis" / "loop" / "queue.md"

BLOCK = """## {tid} 驱动收尾钩子自测（T-022 钩子自测，可忽略）
- goal: 仅供 T-022 收尾钩子实测使用，不产出任何东西。
- acceptance: 无（自测任务）。
- gate: none
- status: todo
- notes: T-022 钩子自测，可忽略；测完由 T-022 从 queue.md 删除。
"""


def insert(text: str, tid: str) -> str:
    if f"## {tid} " in text:
        raise SystemExit(f"{tid} 已存在，不重复插入")
    lines = text.splitlines(keepends=True)
    for i, line in enumerate(lines):
        if re.match(r"^##\s+T-\d+\s", line):
            return "".join(lines[:i]) + BLOCK.format(tid=tid) + "\n" + "".join(lines[i:])
    raise SystemExit("queue.md 里找不到任务段起点")


def remove(text: str, tid: str) -> str:
    lines = text.splitlines(keepends=True)
    start = None
    for i, line in enumerate(lines):
        if re.match(rf"^##\s+{tid}\s", line):
            start = i
            break
    if start is None:
        raise SystemExit(f"{tid} 不在 queue.md 里")
    end = len(lines)
    for j in range(start + 1, len(lines)):
        if re.match(r"^##\s+T-\d+\s", lines[j]):
            end = j
            break
    return "".join(lines[:start] + lines[end:])


def main() -> None:
    if len(sys.argv) != 3 or sys.argv[1] not in ("insert", "remove"):
        raise SystemExit(__doc__)
    action, tid = sys.argv[1], sys.argv[2]
    text = QUEUE.read_text(encoding="utf-8")
    QUEUE.write_text(insert(text, tid) if action == "insert" else remove(text, tid), encoding="utf-8")
    print(f"{action} {tid} ok")


if __name__ == "__main__":
    main()
