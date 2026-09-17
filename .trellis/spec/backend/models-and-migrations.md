# 模型与迁移

> 真源是代码：`backend/dingdong_ca/core/{models,assessment_models,integration_models,ca_models}.py` 与 `core/migrations/`。
> 字段级清单由脚本从模型 + openapi 生成：`设计/数据库实际字段_M5.md`。

## 基类与命名

- 所有业务实体继承 `core/models.py` 的 `Entity`：UUID 主键（`default=uuid.uuid4`）、`created_at`、`updated_at`。新模型直接 `(Entity)`，不要重复写这三个字段。
- `Meta` 里**显式声明 `db_table`**（如 `"ca_account"`、`"assessment_session"`），不要依赖 Django 自动命名。审计与运营后台按表名关联对象（`AuditEvent.target_kind` 存的就是 `obj._meta.db_table`）。
- 面向运营的模型给中文 `verbose_name`：`CaAccount.Meta` 里注释说明不设会显示英文 "ca account"，审计页会用它生成“CA 账户（小易）”这样的可读名。
- 新增模型后**在 `core/models.py` 末尾 re-export**（见 `directory-structure.md`），否则迁移检测与 Django 应用加载都看不到。

## 约束写在数据库里，不靠应用层自觉

`Meta.constraints` 里两类约束是硬要求：

- **条件唯一**（`UniqueConstraint(..., condition=Q(...))`）表达“某状态下只能有一条”。范例：
  - `CaAccount`：`ca_account_one_active_robot`（同一活跃机器人的 `nfc_token_hash` 唯一）、`ca_account_one_active_child`（同一孩子只有一个活跃账户）。
  - `ActivityRecord`：`child_one_active_activity`（一个孩子同时只有一条进行中的活动）。
  - `Child` / `QuestionnaireVersion` / `ActivityContentVersion`：`(actor, create_request_key)` 幂等唯一。
- **CheckConstraint** 表达枚举与状态机不自洽的情形：
  - 状态枚举（`family_status_valid`、`assessment_status_valid`、`job_status_valid`、`ca_account_status_valid`/`ca_account_bind_state_valid`）。
  - 时间序（`activity_time_order`：`finished_at >= started_at`；`observation_window_valid`：`window_end > window_start`）。
  - 结束态一致性（`association_end_valid`：`verified` 时 `ended_at` 为空、`revoked` 时非空；`ca_account_end_valid` 同型）。
  - 组合条件（`ProfileSnapshot.profile_source_valid` 用 `Q(...) | Q(...)` 区分 initial 与 stage 两种来源各自必填的字段）。

**两个状态维度不要合并**：`CaAccount` 的 `status`（我方用不用）与 `bind_state`（对方接通没接通）刻意分开，`ca_models.py` 的模块 docstring 写明“不许假装已绑定”。同类判断先问自己是不是也在混两个语义。

## 不可变与“发布后不许原地改”

- `assessment_models.ImmutableResult.save()`：非新增一律 `raise ValidationError("结果不可原地修改")`。继承它的有 `ObservationBatch`、`ProfileSnapshot`、`ReportVersion`——结果只能追加新行。
- `assessment_models.PublishedVersion.save()`：`status` 已是 `published`/`retired` 时，改动 `code`/`version`/`data_origin` 或 `frozen_fields` 里声明的字段直接拒绝。子类用 `frozen_fields` 声明哪些字段冻结（`QuestionnaireVersion`：`schema_version, questions, purpose, title, description`）。**改已发布内容 = 建新版本。**
- 既有答卷固定创建时的题库版本：`AssessmentSession.questionnaire_version` 是 `PROTECT` 外键，不要为了“修内容”去改历史行。

## 并发与幂等的字段约定

| 字段 | 语义 | 出现在 |
| --- | --- | --- |
| `revision` | “我这次编辑基于哪一版”。保存时在事务内比较，不一致返回 409 且不落库 | `Child`、`QuestionnaireVersion`、`ActivityContentVersion`、`AssessmentSession`、`ActivityRecord` |
| `create_request_key` + `create_payload` | 幂等键与**不可变原始请求**。重放同 key 返回同一行；payload 不同报 409 | `Child`、`CaAccount`、`AssessmentSession`、`ActivityRecord`、`ExternalAssociation`、`ConsentGrant`、`DataRequest` |
| `execution_token` + `lease_expires_at` | 后台任务的执行栅栏与租约 | `BackgroundJob` |
| `cursor` | 同步游标，只有成功才推进 | `SyncCheckpoint` |

`Child.create_payload` 的注释解释了为什么必须留存原始请求：后续改过档案后，同 `request_id` 的重试仍要能识别成同一次创建（`core/models.py`）。

## 迁移怎么改

- **只加不删**。范例 `core/migrations/0007_activitycontentversion_create_request_key_and_more.py` 全部是 `AddField` / `AddConstraint`，没有 `RemoveField`。加列时给默认值或允许为空，避免已有生产数据迁移失败。
- 迁移文件不改名、不手改语义。`0008_caaccount.py` 由 `makemigrations` 生成，`options.constraints` 里把 `CaAccount.Meta` 的六条约束原样落库（含 `condition=models.Q(("status", "active"))` 的两条条件唯一）。
- 新迁移必须能空库建起：`uv run --directory backend python manage.py migrate`（本地库 `127.0.0.1:55439`，compose 配置在 `backend/compose.yml`）。改完确认无待生成迁移：`python manage.py makemigrations --check --dry-run`。
- **模型变更要同步字段文档**：`uv run --directory backend python ../scripts/audit_documents.py --generate` 会从模型与 `设计/API/openapi.json` 重新生成 `设计/数据库实际字段_M5.md`；不同步会让 `scripts/audit_documents.py` 报错（提交门禁 pre-commit 会跑它）。

## 敏感数据

- **凭据只存摘要**：`CaAccount.nfc_token_hash` 是 `nfc_token_digest()` 的 HMAC-SHA256，明文不落库不进日志（`core/ca_models.py` 注释 + 回归 `tests/test_ca_accounts.py::test_token_plaintext_never_reaches_database`）。
- 不采集、不留存真实指纹；测评输入只接受合成 PNG（见 [external-integrations.md](./external-integrations.md)）。
- 不采集年级，不为普通资料加密（用户已确认的边界，见 `PROJECT_MEMORY.md`“用户明确的约束”）。