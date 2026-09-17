# T-032 报告：展示面 A —— 四个面的数据层与家长端接口

## goal（取自 `queue.md`）

按 `.trellis/tasks/T-021/design.md` 实现数据层：settings 新增 `CA_DISPLAY_DATA_SOURCE`（默认 `synthetic_fixture`，独立于既有 `INTEGRATION_DATA_SOURCE`，不共用值域）；`core/services/ca_display.py` 唯一分派出口（synthetic → `test_fixture` 表新 kind `ca_display_persona/growth/health/reassessment`；dingdong → `dingdong_client`，未配置返回 `not_synced` + `reason=upstream_not_configured`）；`core/api/ca_display.py` 四读两写（companion-persona / growth-cycle / companion-health / reassessment 读，response/complete 两写），一律以 `child_id` 为键 + `owned_child()` 家庭隔离，不向家长端暴露 `ca_account_id`；`inject_fixture` 新增 6 个场景对应 xlsx 表 6 的 6 个 mock 账号；响应统一带 availability / data_origin / source / fetched_at / reason 信封，availability 词表复用 `growth.py` 既有 7 值。

## 实际做了什么

本轮是**核对式续跑**：前任（16:04Z 被限流中断的轮）已把数据层与接口写完但停在 `doing`，`progress.md` 只有 Plan 段。核对后确认磁盘与前任声明一致（9 个已改 + 4 个新文件），前任未落盘的缺口由本轮补齐。

新增：
- `backend/dingdong_ca/core/services/ca_display.py`（唯一数据出口：信封、7 值 availability 判定、`BUSINESS_CODES` 处置、四读两写、复测回写幂等与出站同步标记）
- `backend/dingdong_ca/core/api/ca_display.py`（4 GET + 2 POST；`owned_child()` 家庭隔离；`period` 只允许 15d/30d）
- `backend/dingdong_ca/core/migrations/0009_careassessmentevent.py` + `core/ca_models.py` 的 `CaReassessmentEvent`（复测回写本地状态：`accepted`/`responded_at` 同生同灭、`new_assessment_id`/`completed_at` 同生同灭、`pending_sync`/`last_error` 标记「本地已落库、出站未成功」）
- `backend/dingdong_ca/testsupport/ca_display.py`（6 个场景 + `inject_display_fault` / `clear_display_fixtures`）
- `backend/tests/test_ca_display.py`（51 项）

改动：
- `backend/config/settings/base.py`、`backend/.env.example`：`CA_DISPLAY_DATA_SOURCE`（默认 `synthetic_fixture`）
- `backend/config/urls.py`：6 条路由（4 读 2 写）
- `backend/dingdong_ca/core/models.py`：导出 `CaReassessmentEvent`
- `backend/dingdong_ca/core/management/commands/inject_fixture.py`：`--scenario` 接受 6 个 `ca_display_*` 场景
- `backend/dingdong_ca/ops/labels.py`：新增 `ca_reassessment.response` / `ca_reassessment.complete` 中文词条、`ca_reassessment_event` 对象词条、`humanize_action` 的 `ca_reassessment` 兜底前缀（既有 `test_ops_console.py::test_every_audit_action_has_chinese_label` 从源码扫动作名，不加会直接红）
- `backend/tests/test_m3.py`：openapi 操作数断言 55 → 61（并补注释）
- `设计/API/openapi.json`：+6 路径 / +17 schema（+2267 行，纯新增）
- `设计/API/请求响应与字段字典_V0.1.md`、`设计/数据库实际字段_M5.md`、`文档/文档校验结果.json`、`设计/API/契约检查结果.json`：`--generate` 与 audit 的产物
- `PROJECT_MEMORY.md`：本轮事实、openapi 计数 44/51/62 → 53/61/82、上一轮 C1 段落降为历史

## 验证命令与真实输出

| 命令 | 输出（原样抄） |
| --- | --- |
| `cd backend && uv run python manage.py check` | `System check identified no issues (0 silenced).` |
| `cd backend && uv run python manage.py makemigrations --check --dry-run` | `No changes detected` |
| `cd backend && uv run pytest tests/test_ca_display.py -q` | `51 passed, 1 warning in 189.02s (0:03:09)` |
| `cd backend && uv run pytest tests/test_ca_display.py tests/test_m3.py tests/test_ops_console.py -q` | `1 failed, 121 passed, 1 warning in 562.88s`（唯一失败 = 本轮新增的契约用例抓到 `trigger_label` 缺失，见下「偏离与发现」，修复后见下一行） |
| `cd backend && uv run pytest tests/test_ca_display.py -q -k "reassessment or contract or declined or complete"` | 见下方「修复后复跑」 |
| `cd backend && uv run ruff check .` | `All checks passed!` |
| `cd backend && uv run ruff format --check --target-version py313 .` | `131 files already formatted` |
| `uv run --directory backend python ../scripts/audit_documents.py --generate` | `{"markdown_files": 80, "local_links_checked": 497, "archived_files_checked": 85, "operations": 61, "schemas": 82, "errors": []}` |
| `python3 scripts/audit_documents.py` | 同上；`设计/API/契约检查结果.json` = `{"date": "2026-09-18", "operations": 61, "schemas": 82, "errors": []}` |

### 覆盖到的 acceptance 条目

- 7 个 availability 值：`test_all_seven_availability_values_are_reachable` 断言观察到的集合恰好等于 7 值全集；另有单值用例（unbound / no_consent（含撤回后）/ not_synced / no_data / ready / stale / error）。
- 业务码处置：`test_business_codes_map_to_parent_facing_availability` 逐码断言（42901/50001/40101/40901/40001 有数据→`stale`、无数据→`error`；40401→`no_data`），并同时断言 `BUSINESS_CODES[code][1]` 与期望处置同源；`test_upstream_business_codes_never_show_fake_data` 走真出站路径（假传输层）断言不会出现假数据；`test_upstream_http_404_is_treated_as_no_data` 覆盖 HTTP 404 → `no_data` + `reason=40401`。
- 两条 POST 幂等重放：`test_response_is_idempotent_and_conflicting_answer_is_422`（同 request_id + 同 accepted 返回首次结果、不同 accepted → 422、本地只有一行、审计只写一条）、`test_complete_is_idempotent_and_never_auto_switches`（同 assessment_id 重放、不同 assessment_id → 422、`auto_switch` 恒 false、`persona_switched` 保持 false）、`test_replay_does_not_call_upstream_twice` / `test_complete_replay_does_not_call_upstream_twice`（重放不再出站）。
- 家庭隔离：`test_display_endpoints_are_scoped_to_the_owning_family`（4 读 2 写全 404）。
- `period` 非 15d/30d → 422：`test_growth_period_rejects_anything_but_15d_and_30d`（6 个非法值）、`test_growth_period_missing_is_422`。
- 合成模式零出站：`test_synthetic_mode_makes_zero_outbound_calls`，配合 autouse 的 `no_real_network`（任何一次 `_open` 都 AssertionError），4 读 2 写全部 200。
- 未知健康 `status` 落「不做判断」：`test_unknown_health_status_falls_back_to_not_judged`（`status` → `insufficient_data`、`reason=unknown_health_status`、`reassessment_recommended` 归零）。
- fixture 不含凭据：`test_synthetic_display_payloads_carry_no_credentials`（扫 `DISPLAY_SCENARIOS` 的 JSON，禁 `nfc_token`/`nfc`/`api_key`/`apikey`/`secret`/`password`/`bearer`）。
- 契约同步：`test_responses_match_the_published_contract` 用 `设计/API/openapi.json` 的 schema 校验 4 读的有数据态、空态（no_data）与 no_consent 态，以及两条 POST 的响应。
- 其它：`ca_account_id` 不出现在任何响应（`test_ca_account_id_never_reaches_the_parent_api`）、人设类型/阶段/触发原因的中文映射、八维固定顺序与缺失维度保持 null 不补 0、6 个场景名与 xlsx 表 6 一一对应、每个场景可注入可读、`inject_fixture` 命令接受展示面场景。

## 偏离与发现（3 条）

1. **`ca_display_reassess` 场景的成长报告写成 `days=21`（前任遗留缺陷，本轮修掉）。** 契约只允许 15/30 天，`_growth_fixture` 按 `period.days` 匹配，21 天的行永远取不到 → 改成 `days=15` / `end=2026-09-15`。同时删掉未被任何场景引用的 `_LANGUAGE_DIMS`（死代码）。
2. **`complete` 把同一个副作用端点 POST 了两遍（前任遗留缺陷，本轮修掉）。** 原实现先用一次 `POST .../complete` 当「读结果」，再 `_sync_out` 又 POST 一次同样的端点。契约里没有单独的读结果接口 → 改为一次出站，结果取这一次的响应；`_sync_out` 返回值改成 `(还没同步成功, 对方返回的 data)`，`_complete_body` 从库里重读 `pending_sync`/`last_error`（原实现在 `queryset.update` 后读内存里的旧值，导致 `sync_error` 恒为 null）。新增 `test_complete_write_failure_is_reported_not_swallowed` 覆盖回写失败如实上报。
3. **未知健康态与触发原因的两处收紧（本轮发现并修）。**
   - `_health_out` 在未知 `status` 回退「不做判断」时，把 `reassessment_recommended` 一并归零：判断不了就不该出复测 CTA，不把矛盾负载递给界面（设计 §1.4 的 CTA 条件是 `status == "reassess"` 且 `recommended`，这里只是不给界面制造自相矛盾的输入）。
   - 契约用例发现 `GET reassessment` 的 event 直接透传 fixture/上游原始对象，缺后端映射的 `trigger_label`（只有本地行合并后才补）。新增 `_event_shape`：只留契约字段 + 补中文触发原因，上游多带的字段不透给浏览器（与 T-013 去掉内部 code 同一纪律）。

## 未验证项

- **全量后端套件未跑**（本轮只跑了新增文件与两个受影响文件：`test_ca_display.py` / `test_m3.py` / `test_ops_console.py`）。「后端 266 项」是 2026-09-16 的快照，本轮不做总数声明。
- **前端与浏览器未涉及**：本任务无 UI 变化（`frontend/` 未改），四个面的界面在 T-033/T-034/T-035。
- **真源（`CA_DISPLAY_DATA_SOURCE=dingdong`）只验到「未配置 → `not_synced`」与假传输层下的业务码处置**；没有对真实 DingDong 端点做过任何调用（缺 D10 base URL / D12 key）。**不得把本任务写成「已接通 DingDong」**；T-021 §7 的判定标准仍只能由 D10/D12 解开。
- 合成模式下 `stale` 可达，但真源模式**没有本地缓存**，`stale` 在真源下不可达（服务模块 docstring 已写明；要支持真源 stale 需另落缓存，属后续任务）。
- 6 个展示面场景中**没有携带「部分维度为 null」的成长报告**，八维缺失分支只由测试内临时注入的 fixture 覆盖；T-034 若要按场景走查该分支，需要临时注入（本轮已在 report 记录，未新增场景以免偏离 xlsx 表 6 的 mock 数据）。
