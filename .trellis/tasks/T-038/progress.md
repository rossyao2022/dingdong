# T-038 progress

## 阶段：Implement 完成，Verify 进行中

### 已完成阶段
- Plan：读 gates/queue/T-024 backlog 七条与相关源码，定改法（见下表）。
- Implement：后端四条 + 前端四条全部落盘。
- Verify（部分）：后端定向用例、ruff、audit、前端 check/unit、真实 Chrome 新用例 3 项已通过；回归套件在跑。

### 改动文件列表
后端：
- `backend/dingdong_ca/testsupport/robot.py`：合成观察指标 `unit` 由 `count` 改 `次`（fixture 与同文件校验器两处）。
- `backend/dingdong_ca/core/services/ca_display.py`：新增 `LEARNING_STYLE_LABELS`；`_persona_out()` 增加 `learning_style_labels`（与 `learning_style_tags` 同序，未知取值 null）。
- `backend/dingdong_ca/ops/templatetags/ops_labels.py`：新增 `account_name` 过滤器（只认姓名，空则「未填写」，不回落手机号）。
- `backend/dingdong_ca/ops/templates/ops/families.html`：「家长」列改用 `account_name`。
- `backend/dingdong_ca/ops/services.py`：`new_children` 标签改「近 7 天新建档案（含已归档）」+ 口径说明补「与在册儿童不同口径」。
- `backend/docs/OPS_MANUAL.md`：指标表同步改名与口径。
- `backend/tests/test_ca_display.py`：新增 `test_persona_view_leaves_unknown_learning_style_label_null`，既有 `test_persona_view_maps_type_to_chinese` 增加 `learning_style_labels` 断言。
- `backend/tests/test_ops_console.py`：新增 `test_families_list_does_not_repeat_phone_in_parent_column`、`test_dashboard_new_children_metric_states_its_scope`；既有 T-019 用例 docstring 校正（断言不变）。
- `backend/tests/test_m3.py`：`test_verify_and_sync_stage_report_contract` 增加 `metrics[0]["unit"] == "次"` 断言。
- `设计/API/openapi.json`：`CompanionPersonaValue` 增 `learning_style_labels`（含 required）+ `learning_style_tags` 描述更新。
- `设计/API/请求响应与字段字典_V0.1.md`、`设计/数据库实际字段_M5.md`、`文档/文档校验结果.json`、`设计/API/契约检查结果.json`：`--generate` 重生成。

前端：
- `frontend/app.js`：`date()` 改零填充到分钟 + 新增 `dateOnly()`；`personaBlock()` 用 `learning_style_labels`（原 code 只进 `title`）；`growthCyclePanel()` 周期起止走 `dateOnly()`；`reassessmentBlock()` 原因句改「这次建议的原因」；`observationBlock()` 增来源说明一行。
- `frontend/tests/t038-copy-and-format.spec.js`：新增（3 项）。
- `frontend/tests/companion-panel.spec.js`：学习风格断言改为「学习风格：」。
- `frontend/tests/reassessment-cta.spec.js`：原因断言改为「这次建议的原因：近期互动偏少」。
- `frontend/README.md`：C2 文案纪律一行更新 + 新增 C5 一节。

### 跑过的命令与结果（原样抄）
- `cd backend && uv run pytest tests/test_ca_display.py -k "persona" -q` → `2 passed, 52 deselected, 1 warning in 26.64s`
- 先失败复核（`git stash push` 掉五个后端源文件后同命令）→ `2 failed … KeyError: 'learning_style_labels'`
- `cd backend && uv run pytest tests/test_ops_console.py tests/test_m3.py -k "parent_without_name or families_list_does_not_repeat or dashboard or verify_and_sync_stage_report_contract" -q` → `6 passed, 66 deselected in 45.49s`
- 先失败复核（同上 stash 状态）→ `3 failed, 3 passed, 66 deselected in 44.22s`（`assert 2 == 1`（手机号出现两次）/ `assert '近 7 天新增儿童' == '近 7 天新建档案（含已归档）'` / `assert 'count' == '次'`）
- `cd backend && uv run ruff check <7 个改动文件>` → `All checks passed!`；`uv run ruff format --check --target-version py313 <同上>` → `7 files already formatted`
- `uv run --no-sync --directory backend python ../scripts/audit_documents.py --generate` 后 `python3 scripts/audit_documents.py` → `{"markdown_files": 80, "local_links_checked": 506, "archived_files_checked": 85, "operations": 61, "schemas": 82, "errors": []}`
- `cd frontend && npm run check` → exit 0；`npm run test:unit` → `tests 65 / pass 65 / fail 0`
- `cd frontend && npx playwright test tests/t038-copy-and-format.spec.js --reporter=list` → `3 passed (34.1s)`（家长端五条 17.4s / 空态 5.3s / 运营端两条 10.8s）
- 截图 5 张在 `.trellis/tasks/T-038/shots/`：`p11-p15-reports-desktop.png`、`p11-p15-reports-mobile.png`、`p15-reports-unbound.png`、`o06-families.png`、`o07-dashboard.png`

### 环境动作（如实记录）
- 本地开发 Celery Worker 是 2026-09-17 09:46 启动的旧进程，仍加载改动前的 `robot.py`（校验 `unit == "count"`），与新 fixture 的 `次` 冲突，导致第一轮真实 Chrome 验收里同步报 `UPSTREAM_SCHEMA_INVALID`、阶段报告不出现。已按 `backend/README.md` 的记录命令重启本地 Worker（`nohup uv run celery -A config worker --pool=solo --loglevel=WARNING --queues=dingdong-ca`，日志 `/tmp/t038-celery-worker.log`）；Beat 未重启。重启后同一用例通过。

### 下一步
跑完回归套件（companion-panel / growth-cycle-panel / growth-window / reassessment-cta / reassessment-write-failure / sync-failure-visibility / robot-account-row），补逐条元素截图，再写 report 与收尾记录。
