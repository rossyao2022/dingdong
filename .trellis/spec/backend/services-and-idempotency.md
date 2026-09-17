# 服务层、事务与幂等

> 需要事务、行锁、多步状态流转或跨请求复用的规则，放 `backend/dingdong_ca/core/services/`，不要写在视图里。
> 现成范例：`services/assessments.py`、`services/sync.py`、`services/ca_account.py`。

## 视图只做边界，服务管规则

对照 `core/api/ca_accounts.py`：视图只做“取家庭范围内的孩子 → `validate(IssueInput)` → 调 `service.issue_account()` → `serialize_account()`”。所有建号/复用/换机判断都在 `services/ca_account.py`。新功能照这个分工写，否则规则会被两个入口各实现一份（`ops/api.py` 顶部注释明确反对“两份业务规则”）。

## 锁的顺序是死的

同一批数据被多处写时，**加锁顺序必须一致**，否则会死锁。现有顺序：

```
Child → ConsentGrant → 业务行（Session / Association）
```

- `services/assessments.lock_session(session_id)`：先锁 `Child`，再锁 `ConsentGrant`，最后锁 `AssessmentSession`。注释写明理由（“All writes/revocations/worker result commits lock the child before consent and session”）。
- `services/sync.lock_association(ident)`：同一顺序（Child → ConsentGrant → `ExternalAssociation`）。
- `services/ca_account.issue_account()`：`Child.objects.select_for_update().get(pk=child.pk)` 串行化同一孩子的并发建号。

新增写路径时**沿用这个顺序**；没有行锁需求就不要顺手加。

## 事务边界与“不要在事务里做网络 IO”

- 写操作用 `with transaction.atomic():` 明确圈出，`select_for_update()` 必须在事务内调用。
- **网络调用放事务外**。`issue_account()` 建号在 `atomic()` 内，绑定调用 `attempt_bind()` 在 `atomic()` 之后，注释：“不要为了绑一次机器人把行锁和事务一起拖住”。同样地，失败不回滚建号——“号码仍然有效，界面按 `bind_state` 显示待接通”。
- 后台任务投递用 `transaction.on_commit(...)`，不要用 `transaction.on_commit` 之外的时机抢跑（`services/assessments.finish_attempt`、`services/sync.schedule_sync`）。

## 幂等：`(操作者, request_id)` + 请求内容比对

统一模式（`core/api/children.py` 的 `children()`、`services/ca_account.issue_account()`）：

1. 用 `(actor, request_id)` 查已有行；
2. 命中且 `create_payload` 与本次一致 → 返回已有行（200 / `created=False`）；
3. 命中但内容不同 → `ApiError("IDEMPOTENCY_CONFLICT", 409, ...)`，**不静默改数据**。

不要用“先查后插”代替唯一约束：并发下会漏。正确做法是唯一约束兜底 + 捕获 `IntegrityError` 后区分“号码撞车”和“并发占用”（`services/ca_account.py` 里对 `IntegrityError` 的两种处理就是范例）。

## 发号器：`ca_account_id`

`services/ca_account.py` 里四件事一起看：

- `new_ulid()`：26 字符 ULID（48 位毫秒 + 80 位随机），Crockford Base32（无 `I/L/O/U`）。模块注释给了选型理由（自增泄露业务量、UUID4 无时序）。
- `new_ca_account_id()` / `is_valid_ca_account_id()`：前缀来自 `settings.CA_ACCOUNT_ID_PREFIX`（默认 `ca_`，`config/settings/base.py` 注明“改前缀等于换契约”）。
- `nfc_token_digest(token)` / `token_fingerprint(digest)`：HMAC-SHA256 摘要 + 前 8 位短指纹。**对外只给短指纹**。
- 建号重试 `_ISSUE_ATTEMPTS = 5`：撞号重试，用尽才报 `CA_ACCOUNT_ISSUE_FAILED`。

号码语义（账户级、一机器人一号、一机器人一孩子、换机发新号）写在 `core/ca_models.py` 模块 docstring，改语义前先读 `设计/CA对接_C1_ca_account_id设计_20260916.md`。

## 咨询锁：`pg_advisory_xact_lock`

运营后台的按内容标识串行化用数据库咨询锁，不引入 Redis 锁：

```python
# dingdong_ca/ops/api.py
def lock_code(kind, code):
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT pg_advisory_xact_lock(hashtextextended(%s,0))", [f"ops-content:{kind}:{code}"]
        )
```

`unique_code()` 的注释说明必须“先取锁再判断”，否则并发创建会留下竞争窗口。**这也是后端不能跑在 sqlite 上的原因之一**（见 [testing.md](./testing.md)）。

`core/api/common.py` 的短信限频同样依赖 PostgreSQL 事务咨询锁（`PROJECT_MEMORY.md`“用户明确的约束”一节）。

## 内容标识与版本号由系统生成

运营不手填技术标识。`ops/api.py`：

- `generated_code(title, prefix)` = `_fit_code(prefix, _title_slug(title), _title_digest(title))`，`_fit_code` **始终保留标题 sha1 摘要前 12 位**（`CODE_LIMIT = 48`）。为什么必须保留写在 docstring 里：早期实现把摘要截掉，`"ABC 观察"` 与 `"ABC 绘画"` 退化成同一个 `code`，发布一份会停用另一份。
- `unique_code(model, kind, prefix, title)`：候选被占用时加 `-2/-3…`，**新建即独立内容**；只有“复制为新版本”才构成版本序列。
- `next_version(model, code)` 在锁内递增 `v1/v2…`。

回归在 `backend/tests/test_ops_content_identity.py`。改这段逻辑必须同时跑它。

## 后台作业：业务键 + 执行令牌 + 租约

`core/tasks.py` 的三道栅栏，改任务代码时都要保住：

- `BackgroundJob.business_key` 唯一（如 `"initial-report:" + str(profile.pk)`、`services/assessments.finish_attempt`），重复投递不会产生第二份。
- 执行前写 `execution_token`（`uuid4`）与 `lease_expires_at`，**每次状态写入前复查 token 是否还是自己那把**（`run_report_job` 里 `if job.status != "running" or job.execution_token != token`），否则直接放弃。
- 超时/失败由 `attempt_count < max_attempts` 决定重排队还是 `failed`；`dispatch_pending` 回收过期租约。失败次数与原因落到 `JobAttempt` 与 `job.error_code`，运营后台按 `ops/labels.job_error()` 翻成中文原因与建议。

## 审计必须写，且要有人能读懂的名字

- 家长端/后台：`common.audit(user, action, obj, label=None, detail=None)`，`target_label` 由 `describe_target(obj)` 生成（标题/编码/用户名，兜底只给短编号）。
- 运营后台：`ops/services.ops_audit(actor, action, target, label, detail)`。
- **新动作码要同步中文**：`dingdong_ca/ops/labels.py` 的 `AUDIT_ACTION` 与 `TARGET_KIND`。回归 `tests/test_ca_accounts.py::test_audit_labels_cover_ca_account_actions` 会直接断言这两张表，缺了会红。
- 清理/停用类操作遵循“只做状态变更、不物理删除、补写审计”（`PROJECT_MEMORY.md` 各轮验收记录）；不要引入未翻译的新动作码。

## 异步与状态机

`AssessmentSession.status`、`AlgorithmAttempt.status`、`BackgroundJob.status` 的取值集合都由 CheckConstraint 固定（见 [models-and-migrations.md](./models-and-migrations.md)）。改状态流转时：先改约束与迁移，再改服务，最后补测试——顺序反过来会先撞数据库异常。