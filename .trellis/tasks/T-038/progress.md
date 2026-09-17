# T-038 progress

## 阶段：Plan → Implement → Verify → Finish 全部完成

### 已完成阶段
- Plan：读 gates/queue/T-024 backlog 七条与相关源码，定七条改法（report 有逐条理由）。
- Implement：后端四条（P-12 服务层 + P-13 fixture + O-06 过滤器/模板 + O-07 标签与手册）、前端四条（P-11 文案 + P-12 渲染 + P-14 时间格式化 + P-15 来源说明）、契约与派生文档同步。
- Verify：先失败证据 + 修复后定向用例 + ruff + audit + 前端 check/unit + 真实 Chrome 新用例 3 项 + 回归 12 项 + `ca-account`/`parent-name-fallback`。
- Finish：commit `d39c37a` → push（远端 sha `d39c37a8413e1180fa2bed123330e48e571c3cab`）→ gates `EXECUTED T-038 push` → queue `status: done` + 执行结果 → experiment-log 一行 → status.md 重写 → 收尾提交。

### 改动文件列表
后端：`backend/dingdong_ca/testsupport/robot.py`、`backend/dingdong_ca/core/services/ca_display.py`、`backend/dingdong_ca/ops/templatetags/ops_labels.py`、`backend/dingdong_ca/ops/templates/ops/families.html`、`backend/dingdong_ca/ops/services.py`、`backend/docs/OPS_MANUAL.md`、`backend/tests/test_ca_display.py`、`backend/tests/test_m3.py`、`backend/tests/test_ops_console.py`。
前端：`frontend/app.js`、`frontend/tests/t038-copy-and-format.spec.js`（新增）、`frontend/tests/companion-panel.spec.js`、`frontend/tests/growth-cycle-panel.spec.js`、`frontend/tests/reassessment-cta.spec.js`。
文档/契约：`设计/API/openapi.json`、`设计/API/请求响应与字段字典_V0.1.md`、`文档/文档校验结果.json`、`frontend/README.md`、`PROJECT_MEMORY.md`、`.trellis/tasks/T-038/`（progress/report/10 张截图）。
收尾记录：`.trellis/loop/queue.md`、`.trellis/loop/gates.md`、`.trellis/loop/status.md`、`.trellis/workspace/yihu/experiment-log.md`。

### 跑过的命令与结果（原样抄）
- 先失败（stash 掉 5 个后端源文件）：`uv run pytest tests/test_ca_display.py -k "persona" -q` → `2 failed, 52 deselected, 1 warning in 18.51s`（`KeyError: 'learning_style_labels'`）；`uv run pytest tests/test_ops_console.py tests/test_m3.py -k "parent_without_name or families_list_does_not_repeat or dashboard or verify_and_sync_stage_report_contract" -q` → `3 failed, 3 passed, 66 deselected in 44.22s`
- 修复后：`2 passed, 52 deselected, 1 warning in 26.64s`；`6 passed, 66 deselected in 45.49s`
- `ruff check` → `All checks passed!`；`ruff format --check --target-version py313 <7 文件>` → `7 files already formatted`
- `audit_documents.py --generate` 后 `python3 scripts/audit_documents.py` → `{"markdown_files": 80, "local_links_checked": 508, "archived_files_checked": 85, "operations": 61, "schemas": 82, "errors": []}`
- `npm run check` → exit 0；`npm run test:unit` → `tests 65 / pass 65 / fail 0`
- `npx playwright test tests/t038-copy-and-format.spec.js --reporter=list` → `3 passed (43.7s)`
- `npx playwright test tests/t038-copy-and-format.spec.js tests/growth-cycle-panel.spec.js --reporter=list` → `4 passed`（前者 3 + 后者 1）
- 回归：`npx playwright test tests/companion-panel.spec.js tests/growth-cycle-panel.spec.js tests/growth-window.spec.js tests/reassessment-cta.spec.js tests/reassessment-write-failure.spec.js tests/sync-failure-visibility.spec.js tests/robot-account-row.spec.js --reporter=list` → 首轮 `1 failed`（growth-cycle-panel 的 ISO 日期断言，已按 P-14 更新），其余 11 项通过；更新断言后重跑该文件通过
- `npx playwright test tests/flows.spec.js tests/ca-account.spec.js tests/parent-name-fallback.spec.js --reporter=list` → `16 passed / 1 failed`；单独复跑 `tests/flows.spec.js` → `2 passed / 6 failed`，失败页 alert「验证码请求过多」（本地短信频控，非本轮改动）
- 截图 10 张在 `.trellis/tasks/T-038/shots/`

### 环境动作
- 重启本地开发 Celery Worker（旧进程 09-17 09:46 启动，仍校验旧 `unit == "count"`）：`nohup uv run celery -A config worker --pool=solo --loglevel=WARNING --queues=dingdong-ca > /tmp/t038-celery-worker.log 2>&1 &`。Beat 未重启。

### 下一步
无（本轮结束，不取下一个任务）。
