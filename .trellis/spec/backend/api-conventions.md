# API 与权限约定

> 家长端接口（`/api/v1/*`）、技术后台接口（`/api/v1/staff/*`）、运营后台 JSON 动作（`/ops/api/*`）三套边界都在这里说清。
> 错误信封的字段含义见 [error-handling.md](./error-handling.md)。

## 路由：集中在 `config/urls.py`

- **只有一处注册表**：`backend/config/urls.py` 的 `urlpatterns`。新增接口就在那里加一行，批量同形状的接口用列表推导注册（范例：staff 的 publish / pause·resume / 账号角色状态，见该文件里对 `staff.publish`、`staff.pause_resume`、`staff.staff_user` 的 `*[...]` 块）。
- **路径不带尾斜杠**：`config/settings/base.py` 里 `APPEND_SLASH = False`。写 `/api/v1/children` 而不是 `/api/v1/children/`。
- **路径参数类型要与模型主键一致**：`<uuid:child_id>` 为主；`ca_account_id` 是**不透明字符串**，用 `<str:ca_account_id>`（见 `config/urls.py` 末尾的注释与三条 CA 路由）。
- 运营后台错误页按前缀分流：`handler403` / `handler404` 里判断 `request.path.startswith("/ops/")`，非 `/ops/` 保持 Django 默认行为，家长端 API 的 404/403 契约不受影响。

## 每个视图都必须用 `@endpoint(...)`

`dingdong_ca/core/api/common.py` 的 `endpoint()` 是唯一的接口装饰器，它一次性负责：CSRF、身份、角色、异常信封、`X-Request-ID`、`Cache-Control: no-store`、上传缓冲区关闭。不要手写 `@api_view`。

```python
@endpoint(["GET", "PATCH"])                                  # 家长端：JWT 家长身份
@endpoint(["POST"], staff_roles=["content"], csrf=True)      # 技术后台：会话身份 + 角色 + CSRF
@endpoint(["GET"], anonymous=True)                           # 匿名（runtime / csrf）
@endpoint(["POST"], parsers=[BoundedMultipartParser()])      # 自定义 parser（submit）
```

真实用法见 `core/api/staff.py`（`publish`/`job_detail`/`retry` 等各带 `staff_roles` 与 `csrf=True`）。

## 身份与数据范围

- **家长端**：`authenticate_parent(request)` 校验 JWT 的 `grant_id`，并复查 `LoginGrant`（`revoked_at` / `expires_at` / `user.is_active` / `account_kind == "parent"`）。失败抛 `ApiError`，不返回 DRF 默认 401 体。
- **家庭隔离靠这两个入口**：`family_for(user)` 取用户当前有效家庭；`owned_child(request, child_id)` 在家庭范围内取儿童（`status="active"`，可选 `lock=True` 加 `select_for_update()`）。**跨家庭访问一律 404**，不泄漏“存在但无权”。见 `core/api/children.py` 与 `core/api/ca_accounts.py`。
- **技术后台 / ops 动作**：`staff_roles=[...]` 会检查 `is_staff`、`account_kind == "staff"` 与用户组。`account_admin` 被 `common.STAFF_ADMIN_ROLE` 视为满足任一角色——这是 v0.3.2 修的缺陷（管理员看得到按钮、点下去 403），回归在 `backend/tests/test_ops_admin_role.py`。
- **运营后台页面**：用 `ops.permissions.ops_page(permission)`；权限不足或记录不存在时**直接渲染** `ops/responses.py` 的 `forbidden` / `not_found`，不要抛异常（见该装饰器 docstring 的两条原因）。
- 权限矩阵唯一真源是 `dingdong_ca/ops/permissions.py` 的 `PERMISSIONS`；导航条目 `NAVIGATION` 是五元组 `(标题, 权限点, 视图名, 分组, 图标)`，新增页面必须同步 `urls.py` + `NAVIGATION` + `templates/ops/base.html`。

## 入参：一律走 `inputs.py` 的 Strict 序列化器

- `StrictSerializer`（`core/api/inputs.py`）拒绝未知字段、拒绝非对象体；`partial` 时拒绝空请求体。新接口的入参类写在同一文件，不在视图里临时拼 dict。
- 视图里用 `validate(ChildInput, request.data, partial=True)` 得到 `validated_data`；校验失败由 `endpoint()` 统一转成 `VALIDATION_ERROR` 422 或 `INVALID_JSON` 400。
- **幂等键是显式字段**：写接口的请求体带 `request_id`（`ChildCreate`、`ActivityCreate`、`AssessmentCreate`、`ConsentInput`、`ca_accounts.IssueInput` 都有），不要用客户端时间戳或自增数代替。
- 版本冲突用 `revision` 字段声明基线（`ChildInput`、`AnswersInput`、`ActivityProgress`），语义见 [models-and-migrations.md](./models-and-migrations.md)。

## 响应形状

- 列表接口用 `paginate(queryset, request, serialize, scope)`，返回 `{"items": [...], "next_cursor": ...}`。游标用 Django `signing` 签名并绑定 `scope`（`"children:<family_id>"`、`"ca-accounts:<child_id>"`），**不同资源之间不能复用游标**；`page_size` 只接受 1..100，越界 422（回归：`backend/tests/test_boundaries.py::test_pagination_and_filter_bound_cursor`）。
- 序列化函数就地写在资源模块里（`serialize_child`、`serialize_account`），只输出对外字段。**不要直接 `Response(model_instance)`**，也不要把内部字段（如 `nfc_token_hash` 原文）带出去——CA 账户只回 `token_fingerprint()` 前 8 位。
- 写接口的状态码：新建 201、复用已有（幂等命中/同机复用）200，见 `core/api/ca_accounts.py` 的 `status=201 if created else 200`。
- **multipart 只允许一条路径**：`POST /api/v1/assessments/<id>/submit`（`core/api/uploads.py`）。其余 JSON 写接口收到 multipart 会由 `contract_exception_handler` 统一回 415（回归：`backend/tests/test_http_contract.py::test_json_api_rejects_file_upload_without_parsing`）。

## 契约文件是响应的真源

- `设计/API/openapi.json` 是前后端共同契约。测试用 `backend/tests/conftest.py` 的 `assert_schema(name, data)` 按 `#/components/schemas/<name>` 校验响应体。
- **改了接口就同步 openapi**：新增/删除操作数会改变 operation 计数，`scripts/audit_documents.py` 与契约断言都会看它（当前 55 operations / 65 schemas，见 `PROJECT_MEMORY.md`）。
- 运营后台的 JSON 动作走另一条链：`ops/api.py` 的 `ops_action(permission)`（会话身份 + 角色 + 统一信封），不复用 `endpoint()`，也不要在 ops 里再造一套业务规则。