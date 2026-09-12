# 叮咚运营后台权限说明

本文件说明后台的角色划分、权限点、数据可见范围与服务端校验方式。适用于账号审批、权限排障与安全复核。

- 代码位置：`backend/dingdong_ca/ops/permissions.py`（权限定义）、`backend/dingdong_ca/ops/views.py`（页面校验）、`backend/dingdong_ca/ops/api.py`（动作校验）
- 自动化验证：`backend/tests/test_ops_console.py`、`test_ops_content.py`、`test_ops_reports.py`、`test_ops_services.py`

---

## 1. 两层判定：先"能不能进"，再"能做什么"

| 层次 | 判定条件 | 不通过时的行为 |
| --- | --- | --- |
| 第一层：工作人员身份 | `is_authenticated` 且 `is_active` 且 `is_staff` 且 `account_kind == "staff"` | 跳转到后台登录页，并带上 `next` 回到原地址 |
| 第二层：角色权限 | 用户所属 `Group` 与权限点允许集合有交集 | 渲染"权限不足"页（HTTP 403），说明需要什么权限 |

`is_superuser` 视为拥有全部角色。

家长账号（`account_kind == "parent"`）即使被误设为 `is_staff` 也进不了后台——第一层显式检查了 `account_kind`。

---

## 2. 角色

| 角色代码 | 显示名称 | 定位 |
| --- | --- | --- |
| `operations` | 运营 | 家庭查询、服务事项处理、报告查看 |
| `content` | 内容运营 | 题库与活动维护 |
| `technical` | 技术运维 | 生成异常重试、同步暂停恢复、数据删除 |
| `account_admin` | 管理员 | 全部权限，含账号管理 |

账号管理页内置的常用组合（`ROLE_PRESETS`）：

| 组合 | 实际角色 |
| --- | --- |
| 运营专员 | `operations` |
| 运营专员（含题库活动） | `operations` + `content` |
| 内容运营 | `content` |
| 技术运维 | `technical` |
| 管理员（全部权限） | `account_admin` |

---

## 3. 权限点矩阵

服务端权威定义，与代码一一对应。

| 权限点 | operations | content | technical | account_admin | 覆盖页面 / 动作 |
| --- | :-: | :-: | :-: | :-: | --- |
| `dashboard.view` | ✓ | ✓ | ✓ | ✓ | 工作首页 `/ops/` |
| `family.view` | ✓ | | ✓ | ✓ | 家庭列表、家庭详情 |
| `family.edit` | ✓ | | | ✓ | 冻结 / 恢复家庭 |
| `child.view` | ✓ | | ✓ | ✓ | 儿童详情 |
| `child.edit` | ✓ | | | ✓ | 更正儿童档案 |
| `questionnaire.view` | | ✓ | | ✓ | 题库列表、编辑、预览 |
| `questionnaire.edit` | | ✓ | | ✓ | 新建 / 保存 / 复制 / 停用 / 发布题库 |
| `activity.view` | | ✓ | | ✓ | 活动列表、编辑、预览 |
| `activity.edit` | | ✓ | | ✓ | 新建 / 保存 / 复制 / 停用 / 发布活动 |
| `report.view` | ✓ | | ✓ | ✓ | 报告列表、报告详情 |
| `report.retry` | | | ✓ | ✓ | 重试失败的报告生成任务 |
| `job.view` | | | ✓ | ✓ | 生成任务列表、任务详情 |
| `association.manage` | | | ✓ | ✓ | 暂停 / 恢复伙伴同步 |
| `service.view` | ✓ | | ✓ | ✓ | 服务事项列表、事项详情 |
| `service.handle` | ✓ | | ✓ | ✓ | 确认已处理 |
| `service.delete` | | | ✓ | ✓ | 执行数据删除 |
| `audit.view` | ✓ | | ✓ | ✓ | 操作审计 |
| `account.manage` | | | | ✓ | 账号管理全部功能 |

### 侧边导航可见性

导航项按权限点过滤（`NAVIGATION`）：

| 分组 | 导航项 | 所需权限 |
| --- | --- | --- |
| 日常 | 工作首页 | `dashboard.view` |
| 日常 | 家庭与儿童 | `family.view` |
| 日常 | 服务事项 | `service.view` |
| 日常 | 报告管理 | `report.view` |
| 内容 | 题库管理 | `questionnaire.view` |
| 内容 | 活动管理 | `activity.view` |
| 技术 | 生成任务 | `job.view` |
| 管理 | 账号与权限 | `account.manage` |
| 管理 | 操作审计 | `audit.view` |

### 有意为之的设计

- **纯运营角色看不到题库/活动导航**。题库与活动属于内容运营职责，让运营角色误入编辑页只会造成误操作。运营如需处理题库草稿待办，由内容运营处理。
- **报告查看与任务重试分离**。运营可以看报告、看失败原因，但重试是技术动作，保留给 `technical` / `account_admin`。
- **数据删除比一般处理更严**。`service.handle` 允许运营处理求助与更正；`service.delete` 只给技术运维与管理员。

---

## 4. 服务端强制校验

前端隐藏菜单只是体验，不是权限。每个入口都在服务端重新判断：

| 入口类型 | 装饰器 | 校验 |
| --- | --- | --- |
| 页面视图 | `@ops_page(permission)` | 先查 staff 身份（否则跳登录），再查权限（否则 403 页） |
| JSON 动作 | `@ops_action(permission)` | 校验 staff 身份与权限，失败返回 JSON 错误而不是 HTML |

### 复用的既有接口

以下写操作直接复用已通过 TDD 的 `/api/v1/staff/*` 接口，不重复实现业务规则：

| 动作 | 接口 |
| --- | --- |
| 发布题库 / 活动 | `POST /api/v1/staff/questionnaires/<id>/publish`、`.../activities/<id>/publish` |
| 重试失败任务 | `POST /api/v1/staff/jobs/<id>/retry` |
| 处理服务事项 | `POST /api/v1/staff/data-requests/<id>/resolve` |
| 暂停 / 恢复同步 | `POST /api/v1/staff/associations/<id>/pause`、`.../resume` |
| 后台账号管理 | `/api/v1/staff/users*` |

这些接口自身带有 `staff_roles` 角色校验，运营后台的权限点是**在其之上**再加一层页面级收窄，不是替代。

### 新增的后台接口

仅用于后台确实新增的能力：

| 动作 | 路径 |
| --- | --- |
| 题库新建 / 保存 / 校验 / 复制 / 停用 | `/ops/api/questionnaires*` |
| 活动新建 / 保存 / 校验 / 复制 / 停用 | `/ops/api/activities*` |
| 冻结 / 恢复家庭 | `POST /ops/api/families/<id>/status` |
| 更正儿童档案 | `POST /ops/api/children/<id>` |

全部为同源请求，使用 Django 会话认证并强制 CSRF。

---

## 5. 数据可见范围

- **运营后台可见全量家庭数据**，与家长端的"仅本人家庭"隔离是两套不同入口。后台是内部工具，不做按运营账号的数据分片。
- **家长端接口的数据隔离未受影响**。本次改动没有修改家长端的认证与权限逻辑；后台的错误页通过 `config/urls.py` 中按 `/ops/` 前缀分流的 `handler403` / `handler404` 实现，非 `/ops/` 路径仍走 Django 默认行为，家长端 API 的错误契约逐字节未变。
- **家长账号无法进入后台**，后台账号也无法登录家长端（`account_kind` 区分）。

---

## 6. 账号安全

| 事项 | 实现 |
| --- | --- |
| 密码存储 | Django `AbstractUser` 默认 PBKDF2 哈希，不落明文 |
| 首次登录 | 管理员创建账号时设置初始密码，由本人登录后修改 |
| 修改自己密码 | 校验旧密码；改完调用 `update_session_auth_hash`，当前会话不失效 |
| 重置他人密码 | 仅 `account.manage`；重置动作本身写入审计 |
| 停用账号 | 立即禁止登录；已登录会话在下次请求时因 `is_active=False` 失效 |
| 登录日志 | 登录成功 / 失败、退出、密码变更均记录审计 |
| 会话 Cookie | 沿用项目既有配置；HTTP 演示入口下 `COOKIE_SECURE=False`，由部署设置按协议决定 |

---

## 7. 关键操作审计

审计记录写入 `AuditEvent`（`backend/dingdong_ca/core/models.py`），本次为它增加了 `target_label`（业务名称）与 `detail`（结构化补充信息）两个字段，使审计页不出现 UUID。

覆盖范围：

- 登录 / 登录失败 / 退出 / 密码变更
- 题库与活动的创建、保存、复制、停用、发布
- 家庭冻结 / 恢复、儿童档案更正
- 服务事项处理（含处理说明）
- 生成任务重试
- 后台账号创建、角色变更、停用 / 启用、密码重置

审计列表为只读，页面上不提供删除或修改入口。

---

## 8. 权限排障速查

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 登录后侧边栏缺项 | 该角色无对应权限 | 管理员在账号详情页加角色 |
| 打开页面显示"权限不足" | 角色不含该权限点 | 同上；页面会写明需要哪个权限点 |
| 按钮点了报"权限不足" | 页面可看但动作权限更严（如运营看任务但不能重试） | 由技术运维执行该动作 |
| 家长手机号登录后台失败 | 后台只接受 staff 账号 | 使用分配的后台账号 |
| 停用后仍能操作 | 停用前已建立的会话在下一次请求才失效 | 属预期；敏感操作以服务端实时校验为准 |
