#!/usr/bin/env bash
# T-022 收尾钩子自测用的假唤醒命令（LOOP_WAKE_CMD）：只记录调用，不真的叫醒 orchestrator。
set -u

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
printf '%s fake-wake reason=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >>"$DIR/fake-wake-invocations.log"
exit 0
