# T-039 进度

## Plan（已完成）

任务三条 + 一项截图刷新，逐条定下客观验证方式：

1. **① 换机旧号人设只读展示**：orchestrator 已裁定本批不做（无数据通路），只在 `report.md` 记录决定 + 在 `.trellis/tasks/T-028/dingdong-clarifications.md` 的 C6 段追加一行（不改条目结构、不改 33 条计数）。**不改代码。**
2. **② `watch` 态不显 `health_score`**：核对现状。`frontend/companion.js` 的 `HEALTH_STATES.watch.score = false`；断言在 `frontend/unit/companion.test.js` 与 `frontend/tests/companion-panel.spec.js`。验证方式 = 复跑并抄真实输出；若与断言不符才改代码。
3. **③ 八维中文名由后端下发**：后端在 `growth-cycle` 响应里下发 `growth_dimension_labels`（键同 `GROWTH_DIMENSIONS` 固定顺序，做法同 `type_label` / `stage_label` / `learning_style_labels`），前端只保留 key 顺序、中文名一律取 payload。
4. **截图刷新**：重跑 `frontend/tests/companion-panel.spec.js`（输出目录是 `.trellis/tasks/T-033/shots`），把 `reassess-*` / `switch-*` 拷进 `.trellis/tasks/T-039/shots/`。

## Implement（已完成）

- ③ 后端：`core/services/ca_display.py` 新增 `GROWTH_DIMENSION_LABELS`（8 键中文名）+ `_growth_out` 与空态 payload 各加 `growth_dimension_labels`。
- ③ 契约：`设计/API/openapi.json` 的 `GrowthCycleView` 加 `growth_dimension_labels`（含 required）+ 新 schema `GrowthDimensionLabels`；`--generate` 重生成字段字典。
- ③ 前端：`frontend/growth-cycle.js` 的 `DIMENSIONS`（含中文名）改为 `DIMENSION_KEYS`（只有键顺序），`dimensionRows(dimensions, labels)` 中文名取 payload，新增兜底 `DIMENSION_UNKNOWN`。
- ① T-028 清单 C6 段追加一行（换机旧号历史数据如何提供），未改条目结构与代码。
- 文档：`frontend/README.md` 两处（八维中文名来源、单测项数 17→19）。

## Verify（已完成）

- `tests/test_ca_display.py -k dimension`：先红后绿。红 = `1 failed … KeyError: 'growth_dimension_labels'`（`55 deselected in 19.69s`）；绿 = `2 passed, 53 deselected in 26.57s`。
- `tests/test_ca_display.py` 全量：`55 passed, 1 warning in 247.02s`（原 54 + 新增 1）。
- 前端：`npm run check` exit 0；`npm run test:unit` `tests 67 / pass 67 / fail 0`（原 65 + 新增 2）。
- ② 单点：`node --test --test-name-pattern="watch" unit/companion.test.js` → `pass 1 / fail 0`。
- 检索验证：`grep -rn "语言成长代理|…|自然成长代理" frontend/*.js` → 无命中（exit 1）。
- 后端静态：`ruff check` `All checks passed!`；`ruff format --check --target-version py313 .` `132 files already formatted`；`manage.py check` 0 issue；`makemigrations --check --dry-run` `No changes detected`。
- `audit_documents.py`（含 `--generate`）：errors `[]`，61 operations / 83 schemas。
- 真实 Chrome `tests/growth-cycle-panel.spec.js` → `1 passed (45.5s)`（用例 40.6s）。
- 真实 Chrome `tests/companion-panel.spec.js` → `2 passed (51.0s)`（用例 34.1s / 16.2s），T-033 的 8 张截图刷新，4 张副本入库本任务 `shots/`。
- 回归 `tests/growth-window.spec.js` + `tests/reassessment-cta.spec.js` → `5 passed (3.1m)`。
- T-034 / T-035 的 shots 被回归跑脏，已 `git checkout --` 复原。

## Finish（进行中）

- 已写 `report.md`；`queue.md` T-039 改 `done`；`experiment-log.md` / `status.md` 待写；commit + push + `gates.md` `EXECUTED` 行。

## 改动文件

- `backend/dingdong_ca/core/services/ca_display.py`（+ `GROWTH_DIMENSION_LABELS` 与两个字段）
- `backend/tests/test_ca_display.py`（+1 用例）
- `设计/API/openapi.json`、`设计/API/请求响应与字段字典_V0.1.md`、`设计/API/契约检查结果.json`、`文档/文档校验结果.json`
- `frontend/growth-cycle.js`、`frontend/unit/growth-cycle.test.js`、`frontend/README.md`
- `.trellis/tasks/T-028/dingdong-clarifications.md`、`.trellis/loop/queue.md`、本任务记录
