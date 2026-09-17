# T-037 progress

## 阶段

- [x] Plan
- [x] Implement
- [x] Verify
- [ ] Finish

## Plan（已完成）

事实核对：

- 缺陷坐实（T-024 backlog P-10）：`CaReassessmentEvent.event_id` 全局唯一，两个复测合成场景共用 fixture 事件 id（`reassess_mock_001` / `reassess_mock_002`）⇒ 全库只有第一个儿童能回写，第二个撞唯一约束拿 500。
- 服务层读写本来就按 `ca_account + event_id` 两键（`core/services/ca_display.py` 的 `_local_event` / `reassessment_view` / `respond` / `complete`），模型约束比服务语义更严是根源。
- 前端错误落点：`respondReassessment()` 不 catch ⇒ 抛到 `act()` 的 catch ⇒ `showError()` 写进 `$("#main .form-error")`（页面上第一个），而 `#reports` 里复测区块自身没有 `.form-error`，第一个落在「成长观察」的窗口表单。
- `frontend/api.js` 第 70 行把非 JSON 响应回落成「服务返回了无法识别的响应。」，5xx（本地 `DEBUG=True` 的 HTML 调试页）也走这句。

验收标准 → 客观验证方式：先失败的后端用例（两账户同一 `event_id`）+ `tests/test_ca_display.py` 全量 + 前端单测 + 真实 Chrome 5xx 走查（只拦一条、用完解除）+ audit errors 空。

## Implement（已完成）

- `backend/dingdong_ca/core/ca_models.py`：`event_id` 去掉 `unique=True`；新增约束 `ca_reassessment_event_account_unique`（`(ca_account, event_id)`）；docstring 写明「事件 id 由对方发放、跨账户可能重名」。
- `backend/dingdong_ca/core/migrations/0010_alter_careassessmentevent_event_id_and_more.py`：`AlterField` + `AddConstraint`，文件头注明方向是放宽、既有数据不可能有同账户同事件重复行、不需要去重或回填。
- `backend/tests/test_ca_display.py`：新增 `test_same_event_id_is_answerable_by_two_accounts`（两个儿童各自 `ca_display_reassess` 场景先后回写同一 `reassess_mock_001`，第二个 200；同账户重放返回首次结果；换答案仍 422；两行互不影响）。
- `frontend/api.js`：新增纯函数 `errorBody(status, data)`，5xx 统一文案「服务暂时不可用，请稍后再试。」；`request()` 用它抛 `APIError`。
- `frontend/reassessment.js`：新增 `WRITE_FAILED_TEXT` 与视图字段 `error`（`options.error`）。
- `frontend/app.js`：`state.reassessmentRespondError`（含 `forget()` 复位）；`respondReassessment()` 改 try/catch 把失败存进状态、不再冒泡；`reassessmentBlock()` 在区块内渲染「这次没写成功，请重试。」+「重试」；新增 `reassessment-retry` 动作按同一答案重放。
- 新增 `frontend/unit/api-error.test.js`（4 项）、`frontend/unit/reassessment.test.js` 加 1 项、新增 `frontend/tests/reassessment-write-failure.spec.js`（2 项）。
- 文档：`PROJECT_MEMORY.md`、`frontend/README.md`、`.trellis/spec/frontend/api-conventions.md`、`.trellis/spec/frontend/testing-and-acceptance.md`、`.trellis/spec/backend/models-and-migrations.md`、`设计/数据库实际字段_M5.md`（`audit_documents.py --generate` 重新生成）。

## Verify（已完成）

跑过的命令与结果（原样）：

- 先失败证据（临时把 `unique=True` 与旧迁移放回、`--create-db` 复跑）：`FAILED tests/test_ca_display.py::test_same_event_id_is_answerable_by_two_accounts - django.db.utils.IntegrityError: duplicate key value violates unique constraint "ca_reassessment_event_event_id_key"` / `DETAIL:  Key (event_id)=(reassess_mock_001) already exists.` / `1 failed, 52 deselected, 1 warning in 17.65s`（随后已从 `/tmp/t037bak` 原样还原模型与迁移）。
- 修复后同一用例：`1 passed, 52 deselected, 1 warning in 18.50s`。
- `cd backend && uv run --no-sync python -m pytest tests/test_ca_display.py -q --create-db` → `53 passed, 1 warning in 237.82s (0:03:57)`。
- `cd backend && uv run --no-sync ruff check .` → `All checks passed!`
- `cd backend && uv run --no-sync ruff format --check --target-version py313 .` → `132 files already formatted`（首轮报迁移文件 `1 file would be reformatted`，已 `ruff format` 该文件）。
- `cd backend && uv run --no-sync python manage.py check` → `System check identified no issues (0 silenced).`
- `cd backend && uv run --no-sync python manage.py makemigrations --check --dry-run` → `No changes detected`。
- `cd backend && uv run --no-sync python manage.py migrate` → `Applying core.0010_alter_careassessmentevent_event_id_and_more... OK`（本地开发库 `127.0.0.1:55439`）。
- `cd frontend && npm run check` → exit 0。
- `cd frontend && npm run test:unit` → `tests 65 / pass 65 / fail 0`。
- `cd frontend && npx playwright test tests/reassessment-write-failure.spec.js tests/reassessment-cta.spec.js --reporter=list --output=/tmp/dingdong-pw-out` → `5 passed (3.7m)`（新增 2 项 22.2s / 38.8s，T-035 回归 3 项 1.1m / 1.2m / 26.6s）。
- `python3 scripts/audit_documents.py` → errors 为空（`markdown_files 80 / local_links_checked 506 / operations 61 / schemas 82`）。
- 本地库证据：`CaReassessmentEvent.objects.filter(event_id='reassess_mock_001').count()` = `4`（四个不同 `ca_account`，旧全局唯一约束下不可能）。
- 截图 4 张在 `.trellis/tasks/T-037/shots/`，已逐张 `read_file` 看过（失败提示在复测区块内、窄屏不溢出、重试成功后回到「已选择暂不重新测评」、第二个儿童同 event_id 回写成功）。

## 未完成 / 交给编排侧

- 生产库未迁移（本轮只动本地库）；未 push（按 T-021 批复的直推规则，收尾提交后直接 push 并补 `EXECUTED` 行）。
- `scopeEvent()`（`tests/reassessment-cta.spec.js`）不再是必需，未删（属 T-039 的过期截图刷新范围）。

## 下一步

Finish：提交 + push + 补 `EXECUTED T-037 push` 行 + `status` 改 `done`。
