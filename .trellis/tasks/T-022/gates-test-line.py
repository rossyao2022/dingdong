#!/usr/bin/env python3
"""T-022 收尾钩子自测：清除 / 统计 gates.md 申请段里的自测 REQUEST 行。

用法：python3 gates-test-line.py clear | python3 gates-test-line.py count
"""
import sys
from pathlib import Path

GATES = Path(__file__).resolve().parents[3] / ".trellis" / "loop" / "gates.md"
MARK = "T-022 钩子自测，可忽略"


def main() -> None:
    if len(sys.argv) != 2 or sys.argv[1] not in ("clear", "count"):
        raise SystemExit(__doc__)
    lines = GATES.read_text(encoding="utf-8").splitlines(keepends=True)
    hits = [l for l in lines if MARK in l]
    if sys.argv[1] == "count":
        print(len(hits))
        return
    kept = [l for l in lines if MARK not in l]
    GATES.write_text("".join(kept), encoding="utf-8")
    print(f"clear {len(hits)} 行")


if __name__ == "__main__":
    main()
