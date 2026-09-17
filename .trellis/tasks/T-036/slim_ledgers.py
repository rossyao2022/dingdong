#!/usr/bin/env python3
"""T-036：loop 账本瘦身。

- gates.md 决定段的历史行（EXECUTED 执行记录 + 两条一次性事后追认）移入
  `.trellis/loop/gates-archive-20260917.md`，逐行原文；决定段只留仍生效的常设许可
  （T-003 批准的第一/二批直推规则、T-021 批复及其收尾授权、DENY T-099）。
- queue.md 已 done 任务压成一行指针（原文全文留档 `queue-archive-20260917.md`），
  todo / doing / gated / blocked 任务逐字保留。
- 申请段、status.md、runs.log、驱动脚本、prompt.md 一律不动。
"""

import pathlib
import re
import sys

LOOP = pathlib.Path(".trellis/loop")
QUEUE = LOOP / "queue.md"
GATES = LOOP / "gates.md"
GATES_ARCHIVE = LOOP / "gates-archive-20260917.md"
QUEUE_ARCHIVE = LOOP / "queue-archive-20260917.md"

for path in (GATES_ARCHIVE, QUEUE_ARCHIVE):
    if path.exists():
        sys.exit(f"归档文件已存在，拒绝重复瘦身：{path}")

gates_text = GATES.read_text(encoding="utf-8")
queue_text = QUEUE.read_text(encoding="utf-8")

# ---------- gates.md ----------
apply_head, decision = gates_text.split("## 决定", 1)
dec_body = decision.split("<!-- 下面按时间追加 -->", 1)[1]

kept_blocks, block, removed, in_t003 = [], [], [], False
for line in dec_body.splitlines():
    s = line.strip()
    if not s:
        in_t003 = False
        if block:
            kept_blocks.append(block)
            block = []
        continue
    if s.startswith("APPROVE T-003"):
        in_t003 = True
    if in_t003 or s.startswith("APPROVE T-021") or s.startswith("DENY T-099"):
        block.append(line)
        continue
    removed.append(line)
    if block:
        kept_blocks.append(block)
        block = []
if block:
    kept_blocks.append(block)
kept = ["\n".join(b) for b in kept_blocks]

GATES_ARCHIVE.write_text(
    "# 门禁决定段归档（T-036 瘦身，2026-09-17）\n\n"
    "本文件保存 `gates.md` 决定段在 T-036 瘦身时移除的行，逐行原文、未改写。\n\n"
    "- 移除内容：全部 `EXECUTED ...` 执行记录行 + 两条一次性事后追认（`APPROVE T-025` / `APPROVE T-020`）。\n"
    "- 仍留在 `gates.md` 的常设许可：T-003 批准的第一/二批直推规则、T-021 批复及其收尾授权、`DENY T-099`。\n\n"
    "## 移除行原文\n\n" + "\n".join(removed) + "\n",
    encoding="utf-8",
)

new_gates = (
    apply_head.rstrip("\n")
    + "\n\n## 决定（orchestrator 追加）\n\n"
    + "格式：`APPROVE|DENY T-xxx <gate类型> <原因>`；worker 执行完在下方补一行 `EXECUTED T-xxx ...`\n"
    + "历史 `EXECUTED` 行与一次性事后追认已归档至 `.trellis/loop/gates-archive-20260917.md`（T-036 瘦身，逐行原文）。\n\n"
    + "<!-- 下面按时间追加 -->\n\n"
    + "\n\n".join(kept)
    + "\n"
)
GATES.write_text(new_gates, encoding="utf-8")

# ---------- queue.md ----------
lines = queue_text.splitlines()
first_task = next(i for i, ln in enumerate(lines) if re.match(r"^##\s+T-\d+\s", ln))
header = lines[:first_task]

sections, cur = [], None
for line in lines[first_task:]:
    m = re.match(r"^##\s+(T-\d+)\s+(.*)$", line)
    if m:
        cur = {"id": m.group(1), "lines": [line]}
        sections.append(cur)
        continue
    cur["lines"].append(line)
for sec in sections:
    while sec["lines"] and not sec["lines"][-1].strip():
        sec["lines"].pop()
    sec["status"] = ""
    for line in sec["lines"]:
        m = re.match(r"^-\s*status\s*[:：]\s*(\S+)", line)
        if m:
            sec["status"] = m.group(1)
            break

out = list(header) + [
    "瘦身（T-036）：已 done 任务压成一行指针，逐条执行结果见 `.trellis/tasks/<id>/report.md`，"
    "压缩前全文留档 `.trellis/loop/queue-archive-20260917.md`；todo / doing / gated / blocked 任务保持全文。",
    "",
]
compressed = []
for sec in sections:
    if sec["status"] == "done" and sec["id"] != "T-036":
        report = pathlib.Path(f".trellis/tasks/{sec['id']}/report.md")
        pointer = (
            f"- status: done · 见 `.trellis/tasks/{sec['id']}/report.md`"
            if report.exists()
            else "- status: done · 见 `.trellis/loop/queue-archive-20260917.md`（本任务无 report.md，原文留档）"
        )
        out.append(sec["lines"][0])
        out.append(pointer)
        compressed.append((sec["id"], "report.md" if report.exists() else "archive"))
        continue
    out.extend(sec["lines"])
    out.append("")
while out and not out[-1].strip():
    out.pop()
QUEUE.write_text("\n".join(out) + "\n", encoding="utf-8")

QUEUE_ARCHIVE.write_text(
    "# queue.md 归档（T-036 瘦身，2026-09-17）\n\n"
    "本文件是 T-036 瘦身前 `.trellis/loop/queue.md` 的全文原文（未改写）。\n"
    "瘦身后的 `queue.md` 把已 done 任务的 goal / acceptance / notes 压成一行指针，逐条执行结果见对应 `.trellis/tasks/<id>/report.md`。\n"
    "回溯口径：任一被压缩条目若在 report.md 中找不到对应内容，以本文件为准。\n\n"
    "---\n\n" + queue_text,
    encoding="utf-8",
)

print(f"gates.md: {len(gates_text.splitlines())} -> {len(new_gates.splitlines())} 行")
print(f"queue.md: {len(queue_text.splitlines())} -> {len(out)} 行")
print(f"gates 归档移除行 {len(removed)} 条；queue 压缩 done 任务 {len(compressed)} 条")
print("压缩去向：", ", ".join(f"{i}->{w}" for i, w in compressed))
