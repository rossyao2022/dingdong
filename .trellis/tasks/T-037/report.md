# T-037 报告：复测回写 500 的模型根因 + 前端失败落点与 5xx 文案

## goal（照抄 queue.md）

修 T-024 巡检坐实的真缺陷：①`CaReassessmentEvent.event_id` 从全局唯一改为按 `ca_account` 唯一（orchestrator 已裁定改模型不改 fixture）——新增迁移（含既有重复行处置策略，写进 report）、更新 `ca_models.py` 约束与 docstring；②前端失败反馈落在复测区块自身（「这次没写成功，请重试」+ 重试入口），不再落到「成长观察」区块；③`api.js` 对 5xx 给家长能读懂的统一文案，不再把「服务返回了无法识别的响应。」当用户文案（S-06）。

## 实际做了什么

### 1. 后端模型约束（`backend/dingdong_ca/core/ca_models.py`）

- `event_id = models.CharField(max_length=64)`（去掉 `unique=True`）。
- `Meta.constraints` 新增 `UniqueConstraint(fields=["ca_account", "event_id"], name="ca_reassessment_event_account_unique")`，附一行注释说明「事件 id 由对方发放、跨账户可能重名」。
- 类 docstring 把「同一 `event_id` 只有一行」改成「同一账户下的同一 `event_id` 只有一行」，并说明唯一性按账户的原因（服务层 `_local_event` 本来就按 `ca_account + event_id` 查，约束比服务语义更严会把「第二个账户也能回写」变成 500）。
- 未动对方契约字段、未动 fixture。

### 2. 迁移（`core/migrations/0010_alter_careassessmentevent_event_id_and_more.py`）

`AlterField(event_id)` + `AddConstraint(ca_reassessment_event_account_unique)`。

**既有重复行处置策略：不需要处置。** 唯一性方向是从「全局唯一」放宽到「按账户唯一」，旧约束比新约束更严 ⇒ 既有数据里不可能存在同账户同事件的两行（全局唯一时同事件只有一行）。所以本迁移不写数据迁移、不去重、不回填，也不会删改任何行。该结论写在迁移文件头注释里。

### 3. 后端先失败用例（`backend/tests/test_ca_display.py`）

新增 `test_same_event_id_is_answerable_by_two_accounts`：两个儿童各注入 `ca_display_reassess` 场景（fixture 原样，事件 id 都是 `reassess_mock_001`），先后对同一 `event_id` 回写（甲 `accepted=false`、乙 `accepted=true`），断言：

- 两次都 `200`（修复前第二个是 500）；
- 同账户 + 同 `event_id` + 同 `accepted` 重放返回首次结果、不新增行；
- 同账户换答案仍 `422 REASSESSMENT_ALREADY_ANSWERED`；
- 库里两行、两个账户各自的状态互不影响（读回 `accepted` 分别为 `false` / `true`）。

### 4. 前端 5xx 文案（`frontend/api.js`）

新增导出纯函数 `errorBody(status, data)`：`status >= 500` 时返回 `{code: data?.code, message: "服务暂时不可用，请稍后再试。"}`，否则原样返回后端错误体。`request()` 在 401 续期分支之后、`!response.ok` 之前用它抛 `APIError`。4xx 行为不变。

### 5. 前端失败落点（`frontend/app.js`、`frontend/reassessment.js`）

- `reassessment.js`：新增 `WRITE_FAILED_TEXT = "这次没写成功，请重试。"` 与视图字段 `error`（来自 `options.error`）。
- `app.js`：新增 `state.reassessmentRespondError`（`{message, accepted}`，`forget()` 里复位）；`respondReassessment()` 改成 try/catch——成功清空错误状态，失败把 `errorMessage(e)` 与本次答案存进状态并 `render()`，**不再抛给 `act()`**；`reassessmentBlock()` 在区块内渲染「这次没写成功，请重试。」+ 具体文案 + 「重试」按钮；新增 `reassessment-retry` 动作，按存下来的答案重放（`requestKey` 键含 `eventId + accepted`，同一答案拿同一个 `request_id`，服务端幂等重放）。

### 6. 用例与文档

- 新增 `frontend/unit/api-error.test.js`（4 项，`errorBody` 的 5xx/4xx/无响应体分支）。
- `frontend/unit/reassessment.test.js` 加 1 项（错误落在复测区块视图里、无失败时不出现）。
- 新增 `frontend/tests/reassessment-write-failure.spec.js`（2 项，真实 Chrome）。
- 文档：`PROJECT_MEMORY.md`、`frontend/README.md`、`.trellis/spec/frontend/api-conventions.md`（5xx 文案 + 失败落点跟动作走）、`.trellis/spec/frontend/testing-and-acceptance.md`（`scopeEvent()` 不再必需 + 制造故障只拦一条）、`.trellis/spec/backend/models-and-migrations.md`（新增「约束不许比服务语义更严」一条）、`设计/数据库实际字段_M5.md`（`audit_documents.py --generate` 重新生成，diff 只有约束那一行）。

## 验证命令与真实输出（数字照抄）

先失败证据（临时把 `unique=True` 与旧迁移放回，`--create-db` 复跑，随后从 `/tmp/t037bak` 原样还原）：

```
FAILED tests/test_ca_display.py::test_same_event_id_is_answerable_by_two_accounts - django.db.utils.IntegrityError: duplicate key value violates unique constraint "ca_reassessment_event_event_id_key"
DETAIL:  Key (event_id)=(reassess_mock_001) already exists.
1 failed, 52 deselected, 1 warning in 17.65s
```

修复后同一用例：`1 passed, 52 deselected, 1 warning in 18.50s`

全量：

```
cd backend && uv run --no-sync python -m pytest tests/test_ca_display.py -q --create-db
53 passed, 1 warning in 237.82s (0:03:57)
```

（既有 14 处硬编码 `reassess_mock_002` 断言全部不受影响，无一处需要修改。）

静态检查：

```
uv run --no-sync ruff check .                                   → All checks passed!
uv run --no-sync ruff format --check --target-version py313 .    → 132 files already formatted
uv run --no-sync python manage.py check                         → System check identified no issues (0 silenced).
uv run --no-sync python manage.py makemigrations --check --dry-run → No changes detected
uv run --no-sync python manage.py migrate                        → Applying core.0010_alter_careassessmentevent_event_id_and_more... OK
```

（格式检查首轮报新迁移 `1 file would be reformatted`，已对该文件跑 `ruff format` 后复检通过。）

前端：

```
cd frontend && npm run check        → exit 0
cd frontend && npm run test:unit    → tests 65 / pass 65 / fail 0
cd frontend && npx playwright test tests/reassessment-write-failure.spec.js tests/reassessment-cta.spec.js --reporter=list --output=/tmp/dingdong-pw-out
  ✓ tests/reassessment-cta.spec.js:187 复测四步闭环：…（switch_recommended 真分支） (1.1m)
  ✓ tests/reassessment-cta.spec.js:312 复测四步闭环：switch_recommended 假分支只保留当前角色 (1.2m)
  ✓ tests/reassessment-cta.spec.js:369 选择先不测后不再重复打扰… (26.6s)
  ✓ tests/reassessment-write-failure.spec.js:137 回写 5xx：失败提示落在复测区块内、成长观察无横幅、重试成功 (22.2s)
  ✓ tests/reassessment-write-failure.spec.js:212 两个不同家庭的儿童对同一个 event_id 都能回写（P-10 真实路径）(38.8s)
  5 passed (3.7m)
python3 scripts/audit_documents.py → {"markdown_files": 80, "local_links_checked": 506, "operations": 61, "schemas": 82, "errors": []}
```

浏览器用例具体断言（新 spec 两项）：

- 第 1 项：复测区块出现建议 → 用 `page.route` 让 `POST .../response` 回一次 500 HTML（本地 `DEBUG=True` 的形状，**本用例制造的测试故障**，只拦这一条、用完 `page.unroute`）→ 区块内出现「这次没写成功，请重试。」与「服务暂时不可用，请稍后再试。」和「重试」按钮；整页 `.notice.error` 含该文案的只有 1 条且位于 `.companion-health .reassessment` 内；`#window-form .form-error` 文本为空、「成长观察」窗口表单内不含该文案；`#toast` 不含该文案；页面不含「无法识别的响应」；窄屏 390×844 `scrollWidth - innerWidth === 0`；解除拦截后点「重试」→ 真实 `POST` 返回 `200`、区块变成「已选择暂不重新测评」且「重试」按钮消失；`pageerror` 为空。
- 第 2 项：两个**不同家庭**的儿童（各自登录、建档、绑机器人、同意同步、注入 `ca_display_reassess`）先后对 fixture 原样的同一 `event_id`（`reassess_mock_001`）点「先不测」，两次响应状态都断言为 `200`，区块都变成「已选择暂不重新测评」；全程不拦截任何响应；`pageerror` 为空。

本地库旁证：`CaReassessmentEvent.objects.filter(event_id="reassess_mock_001").count()` = `4`（四个不同 `ca_account`；旧的全局唯一约束下不可能存在）。

截图 4 张在 `.trellis/tasks/T-037/shots/`：`fail-desktop.png`、`fail-mobile.png`、`retry-succeeded-desktop.png`、`same-event-id-second-child.png`（已逐张看过，失败提示位于「互动健康度 → 复测区块」内，「成长观察」无错误横幅）。

## 未验证项

- **生产库未迁移、未部署、未发版**：本轮只对本地开发库（`127.0.0.1:55439`）应用了迁移 `0010`；生产仍是 v0.3.6，没有 `0008`–`0010`。
- **真源模式（`CA_DISPLAY_DATA_SOURCE=dingdong`）未走**：5xx 文案与失败落点在真源下未单独验证（`api.js` 的行为与数据源无关，但未实测）。对方端点本来也没接通（缺 base URL / key）。
- **其他 5xx 场景未逐个走查**：只验证了复测回写这一条路径；`errorBody()` 的规则由单测覆盖（4 项），但其他写操作（建档、题库、活动）在 5xx 下的界面表现未重走。
- **`#assessment/<id>` 完成页的 `complete` 回写失败提示**（`reassessmentWriteBackBlock`）未改动、未复验（属既有实现，本任务只动 `response` 回写路径）。
- 未跑后端全量套件（只跑 `tests/test_ca_display.py`），与 T-032/T-033 口径一致。

## 偏离与理由

1. **模型约束放宽属「动数据模型语义」**：orchestrator 已在 gates.md 的 `APPROVE T-024` 行裁定改模型不改 fixture，本轮照此执行，未提替代方案。迁移方向是放宽（旧约束更严），因此不涉及去重/回填，也不会删改既有行。
2. **5xx 文案对所有 5xx 生效，不区分业务**：按 acceptance「统一文案」实现——5xx 一律用「服务暂时不可用，请稍后再试。」，保留后端 `code` 供排查但不进用户可见文案。若后端将来对某些 5xx 有明确的用户可读文案，需要再放宽这条规则（未做，避免把调试页文本透出去）。
3. **失败落点只改 `response` 回写路径**：acceptance 指的是「先不测 / 重新测评」回写失败的落点，`complete` 回写失败仍走 `#assessment/<id>` 完成页内的既有提示块（那本来就在承接页上，不在「成长观察」）。`showError()` 的通用行为未改（它仍是整页级失败的兜底），只在 spec 里补了一条约定。
4. **`reassessment-cta.spec.js` 的 `scopeEvent()` 未删**：它已不再是必需（约束放宽后 fixture 原值可重复使用），删除属 T-039 的过期截图刷新范围，本轮不动，避免动别人的用例。
5. **report 不写成「已接通 DingDong」**：本轮只改我方内部模型约束与家长端呈现，未接对方任何接口。
