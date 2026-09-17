# T-032 progress

## 阶段：Plan（已完成）

任务：展示面 A —— 四个面的数据层与家长端接口（依据 `.trellis/tasks/T-021/design.md`）。

已读：`AGENTS.md` TRELLIS 约束/权限边界、`.trellis/loop/gates.md`、`.trellis/loop/queue.md`、`.trellis/spec/backend/index.md`、`.trellis/tasks/T-021/design.md` §0/§1/§2/§3/§5/§6、`材料/可检索文本/DingDong_CA_数据库字段与接口.md` 表 3/4/5/6/7。

现状核查（读到的既有事实）：
- 四个展示面在代码里 0 实现（`grep -rn "persona\|reassess" backend/dingdong_ca --include=*.py -il` 0 文件）。
- `core/api/growth.py` 已有 7 值 availability 词表（unbound/no_consent/not_synced/no_data/ready/stale/error）。
- `core/services/dingdong_client.py` 已把 7 个业务码映射成 action（retry/stop/empty/fatal/conflict），未配置抛 `DingDongNotConfigured`。
- `testsupport/models.py` 的 `TestFixture(dataset, kind, subject_key, sequence, payload)` 可复用为 fixture 载体。
- 无 reassessment 本地状态表 → 需新增模型 + 迁移。

## 阶段：Plan 续跑核对（2026-09-18，接 16:04Z 限流中断轮）

- `git status --short` / `git diff --stat` 对照 `progress.md` 声明：磁盘上 9 个已改文件 + 4 个新文件，与前任声明的清单逐条一致（`config/settings/base.py`、`backend/.env.example`、`config/urls.py`、`core/ca_models.py`、`core/models.py`、`inject_fixture.py`、`api/ca_display.py`、`services/ca_display.py`、`migrations/0009_careassessmentevent.py`、`testsupport/ca_display.py`）。
- 前任声明的「最后一个验证命令」= 无（progress.md 未记录任何验证命令，只有 Plan 段与一行 Implement 占位）→ 无可重跑项。
- 前任未落盘的缺口（本轮补齐）：`tests/test_ca_display.py` 不存在、`设计/API/openapi.json` 未同步、`tests/test_m3.py` 操作数未更新、`ops/labels.py` 无新审计动作词条、PROJECT_MEMORY.md 未同步。

## 阶段：Implement（已完成）

改动文件列表（本轮 `[T-032]` 提交）：
- 新增 `backend/dingdong_ca/core/services/ca_display.py`（唯一数据出口；信封；7 值 availability；业务码处置；四读两写）
- 新增 `backend/dingdong_ca/core/api/ca_display.py`（4 GET + 2 POST；`owned_child()`；`period` 严格校验）
- 新增 `backend/dingdong_ca/core/migrations/0009_careassessmentevent.py` + `core/ca_models.py` 新增 `CaReassessmentEvent`
- 新增 `backend/dingdong_ca/testsupport/ca_display.py`（6 个场景 + fault/clear 辅助）
- 新增 `backend/tests/test_ca_display.py`（51 项）
- 改 `backend/config/settings/base.py`、`backend/.env.example`（新开关 `CA_DISPLAY_DATA_SOURCE`）
- 改 `backend/config/urls.py`（6 条路由）、`core/models.py`（导出新模型）、`inject_fixture.py`（接 6 个场景）
- 改 `backend/dingdong_ca/ops/labels.py`（两个审计动作 + 一个对象词条 + 兜底前缀）
- 改 `backend/tests/test_m3.py`（openapi 操作数 55→61）
- 改 `设计/API/openapi.json`（+6 路径 / +17 schema）、`设计/API/请求响应与字段字典_V0.1.md`、`设计/数据库实际字段_M5.md`、`文档/文档校验结果.json`、`设计/API/契约检查结果.json`（`--generate` 与 audit 产物）
- 改 `PROJECT_MEMORY.md`

## 阶段：Verify（已完成）

跑过的命令与结果（原样抄）：
- `cd backend && uv run python manage.py check` → `System check identified no issues (0 silenced).`
- `cd backend && uv run python manage.py makemigrations --check --dry-run` → `No changes detected`
- `cd backend && uv run pytest tests/test_ca_display.py -q` → `51 passed, 1 warning in 189.02s`
- `cd backend && uv run pytest tests/test_ca_display.py tests/test_m3.py tests/test_ops_console.py -q` → `1 failed, 121 passed, 1 warning in 562.88s`（唯一失败=契约用例抓到 `trigger_label` 缺失，修复后全量复跑见下）
- `cd backend && uv run ruff check .` → `All checks passed!`
- `cd backend && uv run ruff format --check --target-version py313 .` → `131 files already formatted`
- `uv run --directory backend python ../scripts/audit_documents.py --generate` → `{"markdown_files": 80, "local_links_checked": 497, "archived_files_checked": 85, "operations": 61, "schemas": 82, "errors": []}`
- `python3 scripts/audit_documents.py` → 同上，`errors: []`

## 阶段：Finish（已完成）

已完成：report.md 已写；`[T-032]` 提交 a7c2035 已 push（远端 sha `a7c20353bc295123c9c32d8f2ab64918e3959925`）；`gates.md` 补 `EXECUTED T-032 push`；`queue.md` 该任务 `status` 改 `done` 并附执行结果；experiment-log 追加一行；`status.md` 已重写。

修复后复跑：`cd backend && uv run pytest tests/test_ca_display.py -q -k "reassessment or contract or declined or complete"` → `6 passed, 46 deselected, 1 warning in 36.91s`；修复后全量复跑 `cd backend && uv run pytest tests/test_ca_display.py -q` → `52 passed, 1 warning in 190.76s (0:03:10)`。

下一步：无（本轮结束）。
