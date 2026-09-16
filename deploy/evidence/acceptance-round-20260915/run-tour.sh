#!/bin/sh
# 2026-09-15 全量功能验收「逐项演示」复现脚本。
#
# 前置：
#   1) 本机已装 Chrome 与前端依赖（cd frontend && npm ci）
#   2) 已创建本轮三个运营账号，并把凭据导出为 /tmp/dd-demo-creds.env（600）
#   3) 已跑过 prepare-data.py，拿到隔离儿童/失败任务的 id
#
# 凭据只走环境变量，不写进仓库。这里的 echo 只是位置占位，不要把真实值提交进 git。
set -e

# --- 本轮隔离账号（值从 600 权限的临时文件读取）---
. /tmp/dd-demo-creds.env

# --- 本轮隔离数据（值来自 prepare-data.py 的 JSON 输出）---
DD_DEMO_CHILD="${DD_DEMO_CHILD:?set DD_DEMO_CHILD}"
DD_DEMO_CHILD_ID="${DD_DEMO_CHILD_ID:?set DD_DEMO_CHILD_ID}"
DD_DEMO_PHONE="${DD_DEMO_PHONE:?set DD_DEMO_PHONE}"
DD_DEMO_FAILED_JOB="${DD_DEMO_FAILED_JOB:?set DD_DEMO_FAILED_JOB}"
export DD_DEMO_CHILD DD_DEMO_CHILD_ID DD_DEMO_PHONE DD_DEMO_FAILED_JOB

EVIDENCE="$(cd "$(dirname "$0")" && pwd)"
export DD_SHOT_DIR="$EVIDENCE/shots"
export DD_TOUR_LOG="$EVIDENCE/tour-log.jsonl"

cd "$EVIDENCE/../../../frontend"
npx playwright test --config=playwright.public.config.js \
  deployment-tests/ops-demo-tour.spec.js --reporter=list | tee "$EVIDENCE/tour-run.txt"
