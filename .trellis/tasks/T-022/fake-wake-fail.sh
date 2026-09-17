#!/usr/bin/env bash
# T-022 收尾钩子自测：故意失败的假唤醒命令，验证「唤醒失败只记日志、不影响驱动」。
set -u

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
printf '%s fake-wake-fail reason=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >>"$DIR/fake-wake-invocations.log"
exit 3
