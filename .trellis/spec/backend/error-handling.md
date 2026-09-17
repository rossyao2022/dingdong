# 错误处理

> 三套边界（家长端 API、技术后台 API、运营后台）各自有信封，但**同一套边界内必须有同一个形状**。
> 实现在 `backend/dingdong_ca/core/api/common.py` 与 `backend/dingdong_ca/ops/services.py`。

## 家长端 / 技术后台：`ApiError` + `@endpoint`

业务代码只 `raise ApiError(code, status, message, fields=None, headers=None)`，返回体由 `endpoint()` 统一包：

```json
{"code": "...", "message": "...", "field_errors": [], "trace_id": "<uuid4>"}
```

同时必带响应头 `X-Request-ID: <trace_id>` 与 `Cache-Control: no-store`（`core/api/common.py` 里 `endpoint()` 的 `finally` 之后三行）。测试会断言两者一致：`backend/tests/test_http_contract.py::test_runtime_csrf_and_malformed_json`。

`message` 是**要给人看的完整中文句子**，能直接上界面；`code` 才是机器判断依据。测试应断言 `response.json()["code"]`，不要只断言状态码（范例：`backend/tests/test_ca_accounts.py`）。

## 本仓库在用的 code → status

| status | code | 用在什么场景 | 出处 |
| --- | --- | --- | --- |
| 401 | `AUTH_REQUIRED` | 没有 Bearer token / token 无效 / 登录已失效 | `common.authenticate_parent` |
| 401 | `LOGIN_REVOKED` | 授权被撤销、过期、账号停用或不是家长 | 同上 |
| 403 | `CONSENT_REQUIRED` | 授权缺失/撤回、孩子或家庭非 active | `services/assessments.require_authorized` |
| 403 | `PERMISSION_DENIED` | 家庭不可用、角色不允许该动作 | `common.family_for`、`endpoint(staff_roles=...)` |
| 404 | `NOT_FOUND` | 记录不存在**或跨家庭**（不区分，避免泄漏存在性） | `common.endpoint` 的 `Http404` 分支 |
| 409 | `IDEMPOTENCY_CONFLICT` | 同一 `request_id` 内容不一致 | `core/api/children.py`、`services/ca_account.issue_account` |
| 409 | `REVISION_CONFLICT` / `EDIT_CONFLICT` / `STATE_CONFLICT` | 版本过期、旧页面保存、状态不允许 | `services/assessments.py`、`core/api/children.py`、`ops/api.py` |
| 409 | `ACCOUNT_REPLACEMENT_REQUIRED` / `CA_ACCOUNT_CONFLICT` | 换机器人要先归档旧号 / 机器人或孩子已被占用 | `services/ca_account.issue_account` |
| 422 | `VALIDATION_ERROR` | 字段不合法、题码无效、选项无效、分页参数越界 | `endpoint()`、`common.paginate` |
| 413 / 415 | `INPUT_TOO_LARGE` / `UNSUPPORTED_MEDIA_TYPE` | 上传超限 / JSON 接口收到 multipart | `core/api/uploads.py`、`contract_exception_handler` |
| 503 | `INTEGRATION_NOT_READY` | 真实算法/供应商未接入 | `services/assessments.begin_attempt` |
| 503 | `CA_ACCOUNT_ISSUE_FAILED` | 号码生成重试次数用尽（80 位随机下几乎不可能） | `services/ca_account.issue_account` |

新增 code 时**沿用这张表的语义**，不要为同一情形造第二个 code。

## 视图之外的错误由 `contract_exception_handler` 兜

`config/settings/base.py` 的 `REST_FRAMEWORK["EXCEPTION_HANDLER"]` 指向 `common.contract_exception_handler`。它把 DRF 在进入视图前抛出的错误（405 方法、415 媒体类型、解析错误、限流）也转成同一个信封：

- 已知状态码有映射表（400/401/403/404/405/415/429），其余落到 `REQUEST_REJECTED`。
- `exception_handler` 返回 `None` 时**故意不吞**（“Unexpected programming errors remain visible to Django/test failures”）——未知异常必须让测试响亮失败，不要包装成 500 信封掩盖掉。

## 运营后台：`OpsError` + JSON 信封 / HTML 错误页

- JSON 动作统一用 `ops/services.py` 的 `json_ok(payload)`（`{"ok": true, ...}`）与 `json_error(code, message, status, fields, trace_id, extra)`（`{"ok": false, ...}`）。业务错误抛 `OpsError`，由 `ops_action` 装饰器转成 `json_error`（见 `dingdong_ca/ops/api.py` 的 `ops_action`）。
- `OpsError` 支持 `extra`：编辑冲突要把服务端当前内容带回给页面，用 `ops/api.py` 的 `edit_conflict(row, payload, label)` 构造（返回当前内容 + 中文说明 + `{"field": "revision"}`）。
- HTML 页面不抛异常：`ops_page(permission)` 捕获 `Http404` 渲染 `ops/not_found.html`(404)，权限不足渲染 `ops/forbidden.html`(403)。原因写在 `ops/permissions.py` 的 `ops_page` docstring：全局 `handler404` 只在 `DEBUG=False` 生效，本地会退回 Django 调试页并暴露 URL 配置。
- 运营后台的错误文案**不出现内部术语**：不写 409 / revision / UUID / 数据库。对照 `core/api/children.py` 的 `EDIT_CONFLICT` 文案与 `ops/api.py` 的 `expected_revision`。

## 常见错误做法

- 在视图里 `try/except Exception` 自己拼 JSON：会绕过 `@endpoint`，丢掉 `trace_id`、`X-Request-ID` 与 `Cache-Control`。
- 用 `raise Http404` 表达“无权限”：跨家庭场景要求 404 是对的，但要由 `owned_child()` / `family_for()` 这类范围受控的查询自然产生，不要在视图里手工判断后决定返回 404 还是 403。
- 把 `ValidationError` 直接抛给 DRF：`endpoint()` 会把它转成 422 `VALIDATION_ERROR`，这正是想要的行为；但业务冲突（状态、并发、幂等）必须用 `ApiError` 并显式给 code，不要靠 422 表达。