# T-048 进度

## 已完成阶段

- **Plan**：O-15 补 `CHECKPOINT_STATUS["blocked"]="已停用"`；O-16 改 `QUESTIONNAIRE_PURPOSE["assessment"]="初始测评"` + 模型 choice/title 去「（测试）」+ `makemigrations`；S-07 `flows.spec.js:184` 20s→120s。修法均取自 T-045 backlog、APPROVE T-045 已批复，未重议。
- **Implement**：四处源文件改动 + 迁移 `0011`（见下）。
- **Verify**：后端/前端/lint/makemigrations/audit 全绿；真实 Chrome 走查 O-15/O-16 全 PASS（截图入 `shots/`）；S-07 报告用例通过。
- **Finish**：commit + push origin/codex/release-v0.3.7 + gates.md EXECUTED 行 + 收尾记录。

## 改动文件

- `backend/dingdong_ca/ops/labels.py`：`QUESTIONNAIRE_PURPOSE["assessment"]` 改「初始测评」；`CHECKPOINT_STATUS` 补 `"blocked": "已停用"`。
- `backend/dingdong_ca/core/assessment_models.py`：`purpose` choices `assessment`→「正式测评流程」；`title` 默认「日常情境问卷」（去「（测试）」）。
- `backend/dingdong_ca/core/migrations/0011_alter_questionnaireversion_purpose_and_more.py`：`makemigrations` 生成（AlterField purpose + title）。
- `backend/tests/test_ops_console.py`：新增 `test_blocked_checkpoint_renders_stopped_label`、`test_questionnaire_purpose_label_and_model_drop_test_wording`。
- `frontend/tests/flows.spec.js`：`:184` `toBeVisible({ timeout: 20000 })`→`120000` + 注释。

## 验证命令与结果

- `uv run pytest tests/test_ops_console.py -k "blocked_checkpoint_renders_stopped_label or questionnaire_purpose_label_and_model_drop_test_wording" -v` → `2 passed, 47 deselected in 1.00s`。
- `uv run pytest tests/test_ops_console.py` → `49 passed in 2.32s`。
- `uv run pytest tests/test_questionnaires.py tests/test_ops_content.py tests/test_ops_content_identity.py tests/test_ops_filters.py tests/test_m3.py` → `1 failed, 92 passed in 4.31s`（唯一失败为 T-047 遗留：`test_reference_exploration_is_seeded_and_meaningful` 断言 `"非正式" in q.description`，seed 描述已由 T-047 改掉但断言未改，与本轮无关，详见 report 偏离 1）。
- `uv run pytest -q`（全量后端）→ `1 failed, 346 passed in 10.98s`（同为上述一条）。
- `uv run ruff check .` → `All checks passed!`。
- `uv run ruff format --check --target-version py313 .` → `134 files already formatted`。
- `uv run python manage.py makemigrations --check --dry-run` → `No changes detected`。
- `cd frontend && npm run check` → exit 0（8 个 `node --check` 全过）。
- `cd frontend && npm run test:unit` → `tests 67 / pass 67 / fail 0`。
- `npx playwright test tests/flows.spec.js -g "用途授权、22题、合成输入、真实初始报告"` → `1 passed (24.7s)`。
- `node ../.trellis/tasks/T-048/walk-ops-t048.mjs` → 9 项 PASS、`FAILED []`、`ERRORS []`。
- `python3 scripts/audit_documents.py` → `errors: []`。

## 下一步

收尾：queue.md T-048 → done、gates.md 补 `EXECUTED T-048`、status.md 重写、experiment-log 追加、PROJECT_MEMORY.md 同步，commit + push。
