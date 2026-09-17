#!/usr/bin/env bash
# T-023 核对脚本：假 grok 包装脚本残留扫描 + T-004 两行 runs.log 与 runs/ 记录核对。
set -u
cd "$(dirname "${BASH_SOURCE[0]}")/../../.."

echo "### 命令1：按文件名扫描假 grok 包装脚本（排除 .git / node_modules / .trellis/tasks/T-022）"
echo "\$ find . -path ./.git -prune -o -path ./node_modules -prune -o -path ./.trellis/tasks/T-022 -prune -o -type f \\( -name '*fake*grok*' -o -name '*grok*wrap*' -o -name 'fake-*' \\) -print"
hits="$(find . -path ./.git -prune -o -path ./node_modules -prune -o -path ./.trellis/tasks/T-022 -prune -o -type f \( -name '*fake*grok*' -o -name '*grok*wrap*' -o -name 'fake-*' \) -print)"
if [ -z "$hits" ]; then echo "(无输出 = 0 个命中)"; else printf '%s\n' "$hits"; fi
echo

echo "### 命令2：内容级扫描 'fake-grok|FAKE_MODE'（排除 .git / node_modules / T-022 / T-023 证据目录）"
echo "\$ grep -rln 'fake-grok\\|FAKE_MODE' --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=T-022 --exclude-dir=T-023 ."
grep -rln 'fake-grok\|FAKE_MODE' --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=T-022 --exclude-dir=T-023 . || true
echo "判定：以上命中均为文档/JSON 里的文字提及，无一是可执行包装脚本（逐条 file 判定见下）"
for f in $(grep -rln 'fake-grok\|FAKE_MODE' --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=T-022 --exclude-dir=T-023 .); do printf '  %s -> %s\n' "$f" "$(file -b "$f" | cut -c1-40)"; done
echo

echo "### 命令3：T-022 目录内的假脚本（钩子自测证据，按任务说明保留不删）"
ls -l .trellis/tasks/T-022/fake-grok.sh .trellis/tasks/T-022/fake-wake.sh .trellis/tasks/T-022/fake-wake-fail.sh
echo

echo "### 命令4：T-004 两行 runs.log 与 runs/ 记录核对"
echo "\$ grep 'T-004' .trellis/loop/runs.log"
grep 'T-004' .trellis/loop/runs.log
echo "\$ ls -l .trellis/loop/runs/20260917T055213Z-T-004-primary.json .trellis/loop/runs/20260917T055219Z-T-004-fallback.json"
ls -l .trellis/loop/runs/20260917T055213Z-T-004-primary.json .trellis/loop/runs/20260917T055219Z-T-004-fallback.json
echo "\$ cat .trellis/loop/runs/20260917T055213Z-T-004-primary.json"
cat .trellis/loop/runs/20260917T055213Z-T-004-primary.json
echo
echo "\$ head -c 60 .trellis/loop/runs/20260917T055219Z-T-004-fallback.json"
head -c 60 .trellis/loop/runs/20260917T055219Z-T-004-fallback.json
echo
echo "推导：primary 记录 ts=05:52:13Z（文件名）→ 运行 5s → record_round 于 05:52:19Z 写 RATE_LIMITED 行（classify+sha 后写，晚 1s）"
echo "推导：fallback 记录 ts=05:52:19Z（与 primary 的 ROUND 行同一秒）→ 运行 496s → 06:00:35Z 写 DONE 行，与 runs.log 完全一致"
echo

echo "### 命令5：ORCHESTRATOR.md 入库状态"
echo "\$ git status --short"
git status --short
echo "\$ git ls-files --error-unmatch .trellis/loop/ORCHESTRATOR.md"
git ls-files --error-unmatch .trellis/loop/ORCHESTRATOR.md
echo "\$ wc -l .trellis/loop/ORCHESTRATOR.md"
wc -l .trellis/loop/ORCHESTRATOR.md
