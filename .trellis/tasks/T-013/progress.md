# T-013 进度

## 已完成阶段

- Plan（2026-09-17）：取 queue.md 第一条 `todo`（P-04），T-013 状态改 `doing`。
  - 家长端 `frontend/app.js` 两处渲染版本 code：答题页 note（原 `题库版本 ${esc(s.version)}`）、题库卡片 note（原 `${q.version}`）。
  - 会话接口 `backend/dingdong_ca/core/api/assessments.py:65-67` 已同时下发 `title` 与 `version` → 中文名取题库元数据，前端不建映射表。
  - 运营端 `ops/templates/ops/child_detail.html:90` 渲染 `· 版本 {{ ...version }}`；同区块 :86 已渲染中文标题。
  - 运营端其余页面（`dashboard.html:179`、`questionnaire_edit.html`、`activities.html`）是内容管理面，版本 code 是识别符，按 goal 不在范围。
- Implement（2026-09-17）：新增 `versionLabel()`（`frontend/app.js`）与 `version_label` 过滤器（`ops_labels.py`），三处渲染点改为「中文名/版本号 + 原始 code 进 `title` 属性」。
- Verify（2026-09-17）：见下「跑过的命令与结果」。
- Finish（2026-09-17）：写 report.md、提交、按第一批直推规则 push。

## 改动文件列表

- `frontend/app.js`：新增 `versionLabel()`；答题页 note 与题库卡片 note 两处改用。
- `frontend/tests/questionnaire-version.spec.js`：新增（真实 Chrome，家长端答题页 + 题库卡片 + 运营端儿童详情）。
- `backend/dingdong_ca/ops/templatetags/ops_labels.py`：新增 `version_label` 过滤器（+ `import re`）。
- `backend/dingdong_ca/ops/templates/ops/child_detail.html`：版本行改用过滤器，原始 code 进 `title`。
- `backend/tests/test_ops_console.py`：新增 `test_child_detail_shows_version_number_not_internal_code`（+ `import re`）。
- `.trellis/spec/frontend/ui-conventions.md`：「文案与状态词」补一条内部 code 展示约定。
- `.trellis/tasks/T-013/`：progress.md / report.md / shots/（5 张 PNG）/ red-parent.txt / green-e2e.txt / pytest-ops-console.txt / regression-quiz-last-button.txt。

## 跑过的命令与结果

- TDD 红（先写用例，未改代码）：`cd frontend && npx playwright test tests/questionnaire-version.spec.js --reporter=list` → `2 failed`。
  - 家长端：`Received string: "必填 · 单选 · 题库版本 readable-v2"`（原样抄自 `red-parent.txt`）。
  - 运营端：`summary` 实际值含 `· 版本 readable-v2`。
- TDD 绿（改完代码）：`npx playwright test tests/questionnaire-version.spec.js --reporter=list` → `2 passed (14.3s)`（`✓ 1 … (8.4s)`、`✓ 2 … (5.2s)`）。
- `cd frontend && npm run check` → exit 0（无输出）。
- `cd frontend && npm run test:unit` → `tests 16 / pass 16 / fail 0 / duration_ms 74.0375`。
- `cd backend && uv run --no-sync pytest tests/test_ops_console.py -q` → `37 passed in 139.10s (0:02:19)`。
  - 首次全量跑为 `1 failed, 36 passed in 135.75s`：失败在我的新断言 `"版本 v2" in body`（模板里版本号外面包了 `<span>`，原始 HTML 不含该子串）。改为先剥标签再断言后复跑全绿；产品代码未因此改动。
- `python3 scripts/audit_documents.py` → `errors: []`。
- 回归：`npx playwright test tests/quiz-last-button.spec.js --reporter=list` → `1 passed (13.8s)`（同一答题页）。
- 收尾清理核对：`QuestionnaireVersion.objects.filter(code="e2e-version-label").count()` → `0`（验收临时建的第三份题库已删，本地已发布题库仍只有 exploration / initial-assessment 两份）。

## 下一步

无（本轮任务已收口）。
