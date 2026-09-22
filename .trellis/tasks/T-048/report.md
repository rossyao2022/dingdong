# T-048 报告

## goal

修 T-045 巡检坐实的两条运营端小项与一条用例口径：
- **O-15**：`backend/dingdong_ca/ops/labels.py` 的 `CHECKPOINT_STATUS` 补 `"blocked": "已停用"`，归档/解除关联后儿童详情「同步」列不再显示「未知（blocked）」；「恢复同步」按钮对 blocked 的显示保留。
- **O-16**：`ops/labels.py:26` 的 `QUESTIONNAIRE_PURPOSE["assessment"]` 由「测评流程（测试）」改「初始测评」；`backend/dingdong_ca/core/assessment_models.py:80` 的 choice「正式测评流程（测试）」改「正式测评流程」、默认 title「日常情境问卷（测试）」去「（测试）」；核对本地库 `QuestionnaireVersion.purpose` 实际存值。
- **S-07**：`frontend/tests/flows.spec.js:184` 的 `toBeVisible({ timeout: 20000 })` 放宽到 `120000`，注释写明口径。

## 实际做了什么

1. `labels.py`：`QUESTIONNAIRE_PURPOSE["assessment"]` → `"初始测评"`；`CHECKPOINT_STATUS` 增 `"blocked": "已停用"`（放在 `paused` 之后，与 `enabled`/`paused` 并列）。
2. `assessment_models.py`：`purpose` choices 的 `assessment` → `("assessment", "正式测评流程")`；`title` 默认 → `"日常情境问卷"`。
3. `makemigrations` 生成迁移 `0011_alter_questionnaireversion_purpose_and_more.py`（两个 `AlterField`：purpose 的 choices 文案 + title 默认值；不涉及数据迁移，DB 行值不变）。
4. 核对本地库 `QuestionnaireVersion.purpose`：共 2 行，存值分别是 `'assessment'`（title「日常探索问卷」，`initial-assessment`/`readable-v2`）与 `'exploration'`（「四个小情境：探索偏好体验」）——**存的是英文 code，不是中文**，无需 queryset 清理。
5. `flows.spec.js:184`：`toBeVisible({ timeout: 20000 })` → `toBeVisible({ timeout: 120000 })`，上方加注释「外层 setTimeout 10 分钟、实测报告就绪 75s+；队列积压时 20s 会复现 T-042 红灯，内层等待放宽到 120s，与「实测 75s+」的注释口径一致。」
6. 后端新增 2 条用例（`tests/test_ops_console.py`）：
   - `test_blocked_checkpoint_renders_stopped_label`：构造一条 `blocked` 同步游标走真实 `child_detail` 模板，断言「已停用」出现、整页无「未知（」。
   - `test_questionnaire_purpose_label_and_model_drop_test_wording`：断言词表 `assessment` 与模型 choices/default title 均无「（测试）」且为「初始测评」「正式测评流程」「日常情境问卷」。

## 验证命令与真实输出（数字照抄）

- `uv run pytest tests/test_ops_console.py -k "blocked_checkpoint_renders_stopped_label or questionnaire_purpose_label_and_model_drop_test_wording" -v` → `2 passed, 47 deselected in 1.00s`
- `uv run pytest tests/test_ops_console.py` → `49 passed in 2.32s`
- `uv run pytest tests/test_questionnaires.py tests/test_ops_content.py tests/test_ops_content_identity.py tests/test_ops_filters.py tests/test_m3.py` → `1 failed, 92 passed in 4.31s`（失败项见偏离 1）
- `uv run pytest -q`（后端全量）→ `1 failed, 346 passed, 1 warning in 10.98s`（失败项同偏离 1）
- `uv run ruff check .` → `All checks passed!`
- `uv run ruff format --check --target-version py313 .` → `134 files already formatted`
- `uv run python manage.py makemigrations --check --dry-run` → `No changes detected`
- `cd frontend && npm run check` → exit 0
- `cd frontend && npm run test:unit` → `tests 67 / pass 67 / fail 0`
- `npx playwright test tests/flows.spec.js -g "用途授权、22题、合成输入、真实初始报告"` → `1 passed (24.7s)`
- `node ../.trellis/tasks/T-048/walk-ops-t048.mjs`（真实 Chrome，channel=chrome，1440×900）→ 9 项 PASS、`FAILED []`、`ERRORS []`
- `python3 scripts/audit_documents.py` → `{"markdown_files": 83, "local_links_checked": 523, "archived_files_checked": 85, "operations": 61, "schemas": 83, "errors": []}`

### 真实 Chrome 走查（9 项全 PASS）

- O-16 题库列表：正文含「初始测评」、无「（测试）」；详情页：含「初始测评」、无「（测试）」。截图 `shots/t048-o16-questionnaires-list.png`、`shots/t048-o16-questionnaire-detail.png`。
- O-15 儿童详情（归档旧号后 `SyncCheckpoint.status=blocked`，child `72fcdc16-0501-4e5b-bd3d-b2f5857a9a5c`）：正文含「已停用」、整页无「未知（」、HTTP 200。截图 `shots/t048-o15-child-detail-blocked.png`。

## 未验证项

- 生产环境、真实短信、真源（`CA_DISPLAY_DATA_SOURCE=dingdong`）——本轮全部本地。
- 移动端视口（本轮走查用 1440×900；改动是运营端词表/文案与用例超时，不影响布局）。

## 偏离与理由

1. **后端相关用例中有 1 条既有红灯，与本轮改动无关**：`tests/test_questionnaires.py::test_reference_exploration_is_seeded_and_meaningful` 断言 `"非正式" in q.description`，而 `testsupport/seed.py:38` 的描述已被 T-047（提交 2520abf，2026-09-20）改成「通过日常情境题了解孩子的近期状态；记录本次选择，不评定天赋或能力。」（不再含「非正式」），但该断言自 2a01b74 未改。`git blame` 证实为 T-047 文案清理的遗留，本轮未动 seed/test_questionnaires，也未顺手改这条断言（范围外），如实记录，建议编排侧另立小任务收口。
2. **运营端临时 staff 账号**：本地库无 staff 账号（queue.md 记的 `admin`/`dingdong-admin` 失效），本轮临时建 `t048walk`（superuser + account_kind=staff）完成走查，走查后已 `is_active=False` 停用（账号保留在库供核对，也可删除）。
3. **O-15 场景数据**：为走查新建了一条合成场景（家长/家庭/儿童「小松」/CA 账户 `ca_01M33…`/已核验关联/同步游标），归档后游标落 `blocked`。这属本地开发库的合成测试数据，与历轮走查同类，未删除。
4. **「（测试）」残留不在本轮范围**：`backend/dingdong_ca/ops/templates/ops/questionnaire_new.html:22` 的表单提示与 `backend/docs/OPS_MANUAL.md:112` 仍写「测评流程（测试）20–30 题」。T-045 backlog 的 O-16 范围只到词表 + 模型 choice/title，未含这两处；本轮按批复范围未动，记录供编排侧决定是否后续一并清理（acceptance 的「列表/详情无（测试）」已满足，这两处不在列表/详情页）。
5. **S-07 内层等待**：按批复从 20s 放宽到 120s；本轮队列空实测仍 `1 passed (24.7s)`，属防御性收口，不改产品代码。

## 提交

首行 `[T-048]`，push origin/codex/release-v0.3.7（直推许可见 gates.md APPROVE T-045 2026-09-22T03:56Z），并补 `EXECUTED T-048` 行。
