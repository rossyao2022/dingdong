#!/usr/bin/env python3
"""T-036 验证：瘦身后的 queue.md / gates.md 仍满足驱动解析，且归档逐行原文、信息未丢。

1) 行数达标；2) 每个任务仍是 `## T-xxx 标题` + `- status:` 行；3) 直接跑驱动脚本里
真实的 python 解析块（next_task / classify / loop_gate_snapshot）；4) 归档含全部被移除行原文且顺序一致；
5) 抽查被压缩的 done notes 能在 report.md 或归档中找到对应内容。
"""

import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(".").resolve()
LOOP = ROOT / ".trellis/loop"
QUEUE, GATES = LOOP / "queue.md", LOOP / "gates.md"
GATES_ARCHIVE = LOOP / "gates-archive-20260917.md"
QUEUE_ARCHIVE = LOOP / "queue-archive-20260917.md"
WORK = ROOT / ".trellis/tasks/T-036"
DRIVER = ROOT / "scripts/worker-loop.sh"

fails = []


def check(label, ok, detail=""):
    print(f"[{'PASS' if ok else 'FAIL'}] {label}{' — ' + detail if detail else ''}")
    if not ok:
        fails.append(label)


# ---- 1. 行数 ----
ql = len(QUEUE.read_text(encoding="utf-8").splitlines())
gl = len(GATES.read_text(encoding="utf-8").splitlines())
check("queue.md ≤ 120 行", ql <= 120, f"实测 {ql}")
check("gates.md ≤ 60 行", gl <= 60, f"实测 {gl}")

# ---- 2. 任务标题与 status 行 ----
qtext = QUEUE.read_text(encoding="utf-8")
heads = re.findall(r"^##\s+(T-\d+)\s+(.*)$", qtext, re.M)
statuses = re.findall(r"^-\s*status\s*[:：]\s*(\S+)", qtext, re.M)
check("`## T-xxx 标题` 计数 36", len(heads) == 36, f"实测 {len(heads)}")
check("`- status:` 行计数 36", len(statuses) == 36, f"实测 {len(statuses)}")
check(
    "36 个 status 值全在词表内",
    all(s in {"todo", "doing", "done", "blocked", "gated"} for s in statuses),
    f"值分布 {sorted(set(statuses))}",
)

# ---- 3. 驱动真实解析块 ----
src = DRIVER.read_text(encoding="utf-8")


def extract(func):
    i = src.index(f"{func}() {{")
    j = src.index("\n}\n", i)
    m = re.search(r"<<'PY'\n(.*?)\nPY\n", src[i:j] + "\n", re.S)
    if not m:
        sys.exit(f"未能从 {func} 抽出 python 块")
    return m.group(1)


def run(func, *args):
    r = subprocess.run([sys.executable, "-c", extract(func), *args], capture_output=True, text=True)
    return r.returncode, r.stdout, r.stderr


rc, out, err = run("next_task", str(QUEUE), str(GATES))
check("驱动 next_task 正常返回", rc == 0 and bool(out.strip()), f"rc={rc} 返回 {out.strip()!r} {err.strip()}")

out_file, err_file = WORK / "classify-empty.out", WORK / "classify-empty.err"
out_file.write_text("", encoding="utf-8")
err_file.write_text("", encoding="utf-8")
for task, expect in (("T-036", "DONE"), ("T-030", "DONE"), ("T-031", "TODO")):
    rc, out, err = run("classify", str(QUEUE), task, "0", str(out_file), str(err_file), "0")
    if expect == "TODO":
        check(f"驱动 classify({task}) 不再判 DONE（status=todo）", rc == 0 and out.strip() != "DONE", f"返回 {out.strip()!r}")
    else:
        check(f"驱动 classify({task}) 判 DONE", rc == 0 and out.strip() == "DONE", f"返回 {out.strip()!r} {err.strip()}")

rc, out, err = run("loop_gate_snapshot", str(GATES), str(QUEUE))
snap = out.splitlines()
check("驱动 loop_gate_snapshot 正常（申请段指纹 + blocked 列表）", rc == 0 and len(snap) == 2, f"rc={rc} {err.strip()}")
print("      loop_gate_snapshot 输出：")
for line in snap:
    print(f"        {line[:120]!r}")
check("blocked 列表为空（T-031 已解锁）", len(snap) == 2 and snap[1].strip() == "", f"第二行 {snap[1:]!r}")

# ---- 4. 归档逐行原文 ----
orig = subprocess.run(
    ["git", "show", "HEAD:.trellis/loop/gates.md"], capture_output=True, text=True, cwd=ROOT
).stdout
_, decision = orig.split("## 决定", 1)
body = decision.split("<!-- 下面按时间追加 -->", 1)[1]
removed, in_t003 = [], False
for line in body.splitlines():
    s = line.strip()
    if not s:
        in_t003 = False
        continue
    if s.startswith("APPROVE T-003"):
        in_t003 = True
    if in_t003 or s.startswith("APPROVE T-021") or s.startswith("DENY T-099"):
        continue
    removed.append(line)

arch_lines = GATES_ARCHIVE.read_text(encoding="utf-8").splitlines()
missing = [l for l in removed if l not in arch_lines]
check("归档含全部被移除行原文", not missing, f"移除 {len(removed)} 行，缺失 {len(missing)} 行")
idx = [arch_lines.index(l) for l in removed if l in arch_lines]
check("归档行序与原文一致", idx == sorted(idx), f"索引单调={idx == sorted(idx)}")
exec_orig = [l for l in removed if l.startswith("EXECUTED")]
check(
    "全部 EXECUTED 行（含被移除的）在归档中",
    all(l in arch_lines for l in exec_orig),
    f"EXECUTED {len(exec_orig)} 行",
)

gates_text = GATES.read_text(encoding="utf-8")
check("gates.md 仍含 `## 申请` / `## 决定` 两个切分锚点", "## 申请" in gates_text and "## 决定" in gates_text)
kept_approve = re.findall(r"^APPROVE\s+(T-\d+)", gates_text.split("## 决定", 1)[1], re.M)
check("决定段保留的 APPROVE 仅 T-003 / T-021", kept_approve == ["T-003", "T-021"], f"实测 {kept_approve}")
check("决定段保留 DENY T-099", bool(re.search(r"^DENY\s+T-099", gates_text, re.M)))

# ---- 5. 抽查被压缩的 done notes ----
q_arch = QUEUE_ARCHIVE.read_text(encoding="utf-8")
print("\n== 抽查：被压缩 done 任务的原文留档 + report 覆盖 ==")
for task, needles in (
    ("T-030", ["已归档", "已暂停", "账号已停用", "登录凭据"]),
    ("T-022", ["LOOP_ORCH_PANE", "WAKE FAIL", "w0:p4"]),
    ("T-025", ["line 301: $5: unbound variable", "fallbacks_today", "watchdog"]),
):
    entry_start = q_arch.index(f"## {task} ")
    entry_end = q_arch.find("\n## T-", entry_start + 1)
    entry = q_arch[entry_start:] if entry_end == -1 else q_arch[entry_start:entry_end]
    archived = [n for n in needles if n in entry]
    report = ROOT / f".trellis/tasks/{task}/report.md"
    in_report = [n for n in needles if report.exists() and n in report.read_text(encoding="utf-8")]
    print(f"  {task}: 原文留档命中 {archived}；report.md 命中 {in_report}")
    check(f"{task} 被压缩内容可在原文留档中找到", len(archived) == len(needles), f"{archived}")
    check(f"{task} 关键事实在 report.md 或原文留档中", bool(in_report or archived), f"report={in_report}")

print(f"\n结果：{'全部通过' if not fails else '失败项 ' + str(fails)}")
sys.exit(1 if fails else 0)
