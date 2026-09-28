# 外部依赖与出站调用纪律

> 阿里云短信已在生产机试用实例启用；测评算法仍是测试模式。DingDong Prototype 已做主动调用实测，但四展示面及真实 webhook 推送尚未闭环；测试部署的展示数据仍取 `synthetic_fixture`。这一节规定缺依赖时怎么表现，以及不许用什么方式“让它看起来通了”。

## 三条硬纪律

1. **不许 mock 业务 API**。业务结果必须由真实 HTTP 接口 + 真实数据库 + 真实 Worker 产生；外部缺失的输入用**数据库 fixture**（`dingdong_ca/testsupport/`）注入，而不是伪造 API 响应或直接插成品报告/完成记录。
2. **不许伪造成功**。能力没接通就如实显示“未接通”，返回明确的错误码，不编造数据、不静默降级成 200。
3. **不许把 fixture 流程说成真实供应商接入**（`AGENTS.md`、`PROJECT_MEMORY.md`“用户明确的约束”）。

## 短信：演示固定码与阿里云真实码分开

- `SMS_MODE=fixed_code` 只供显式演示/测试，登录码 `00000`；`SMS_MODE=aliyun_verify` 通过号码认证 `Dypnsapi/SendSmsVerifyCode` 发送随机 5 位码，真实模式明确拒绝 `00000`。两种模式都保留挑战、限频、消费、JWT 与权限流程（`core/api/accounts.py`）。
- 真实模式由本地 HMAC 摘要校验验证码，不调用阿里云 Check 接口；发送失败不产生可登录挑战、不回退固定码。验证码只存校验摘要、消费后清除，不打印验证码或令牌（`backend/README.md`）。
- 本地同号码重发冷却必须把已用于登录的 `consumed` 挑战也算入；消费验证码不等于供应商发送间隔已结束。阿里云的 `biz.FREQUENCY` 表示发送过频，映射为家长可理解的 `RATE_LIMITED` 429；不能把所有供应商拒绝都写成“服务不可用”。
- 专属 RAM 用户只授予 `dypns:SendSmsVerifyCode`，签名和模板来自号码认证服务，不能把短信服务试用包当成同一额度。生产机启用真实模式不代表公网收码登录已验；本地实发与生产机配置验收必须分开记录。
- 生产开关硬拒绝：`APP_ENV == "production"` 时 `base.py` 直接 `raise ImproperlyConfigured`，避免误用固定验证码上线。

## 算法/画像：数据库 fixture，不是 HTTP mock

- 开关是 `INTEGRATION_DATA_SOURCE`（默认 `database_fixture`）。`services/assessments.begin_attempt()` 在数据源不是 `database_fixture` 或题库 `data_origin != "synthetic"` 时抛 `INTEGRATION_NOT_READY` 503，**不返回假结果**。
- 输入来自 `dingdong_ca/testsupport/` 的 `TestFixture` 行，读取入口是 `testsupport/adapter.initial_result()`；`adapter.py` 顶部注释写明“Database inputs for real business services; not HTTP endpoint mocks”。
- 注入用命令：`python manage.py inject_fixture --child-id <UUID> --scenario assessment_success`（另有 `assessment_timeout`/`assessment_failure`/`report_failure`）。fixture 的 schema 校验很严（字段集、`test_` 前缀、数值有限性），不合法直接 `UPSTREAM_SCHEMA_INVALID`——**不要为了让测试过而放宽校验**。
- `settings.APP_ENV` 必须是 `development`/`test`/`demo` 之一，fixture 才生效（`adapter.initial_result` 第一段判断）。

## 出站 DingDong：`services/dingdong_client.py`

CA 侧是主动调用方，8 个 `/api/v1/ca/*` 都是我方发起（`PROJECT_MEMORY.md`“CA 对接文档 V1.0 到货”）。客户端约定：

- **未配置就抛，不装成功**：`is_configured()` 为假时 `call()` 抛 `DingDongNotConfigured`。回归 `tests/test_ca_accounts.py::test_client_refuses_to_call_when_not_configured`。
- **强制 HTTPS**：`_endpoint()` 检查 scheme，明文 base URL 抛 `INSECURE_ENDPOINT`（回归 `test_client_rejects_plaintext_base_url`）。
- **鉴权与幂等**：请求头 `X-API-Key`（`settings.DINGDONG_API_KEY`），幂等调用带 `X-Request-Id`。位置是临时约定，待澄清项 D5 回复后调整（模块 docstring 说明为何不额外塞 body）。
- **业务码映射**：`BUSINESS_CODES` 把封套 `code` 映射成 `(中文含义, 处置)`，处置取值 `ok/retry/stop/empty/fatal/conflict`；`DingDongError.action` / `.retryable` / `.means_empty` 供调用方决策。`40101` 要 `logger.error` 停止调用并告警；`42901` 退避用 `retry_delay_seconds()`。
- **绑定状态如实反映**：`services/ca_account.attempt_bind()` 只在对方确认成功后把 `bind_state` 改成 `bound`；未配置或失败都保持 `unbound`（回归 `test_bind_failure_keeps_account_and_stays_unbound`）。
- 测试里**禁止真实出站**：`tests/test_ca_accounts.py` 用 autouse fixture `no_real_network` 把 `dingdong_client._open` 换成会 `AssertionError` 的函数；需要假传输层时用 `transport` fixture（monkeypatch `_open`，不是 monkeypatch `call`）。

### Prototype 实测与展示适配（2026-09-27）

- `persona/current` 在 Prototype 中把 `persona_id`、`character_name`、`persona_type`、`match_score`、`bind_time` 放在顶层；我方展示 API 的 `persona_name` 应取 `character_name`，同时继续兼容原有 `persona`/`binding` 嵌套 fixture。缺失的学习风格和绑定状态应留空，不自行编造。
- 曾实测 `match_score` 返回数字字符串 `"72.00"`。展示边界把整数值字符串转成 0–100 的整数；非整数字符串和越界值留空。正式分数类型仍待对方确定。
- Prototype 的 `growth/profile`（15d/30d）和 `persona/health` 返回 40401，`reassessment/current` 为 `data:null`，`prototype/insights` 才有聚合数据。不可因后者有数便把四个正式展示子接口标为已接通。
- `ca_dingdong` 对任意 NFC token 可 bind，而我方 ULID 账号被拒并收到不准确的 NFC 报错。正式账号和 NFC 校验规则未确认。webhook 接收端自测通过，但双方尚未共享密钥并配置推送目标，真实 milestone 未到达。

### 生产机一次性真源探针（2026-09-29）

- 生产机的实际 v0.3.14 镜像通过标准输入接收测试配置，在单独进程中运行 `dingdong_client` 与 `ca_display`，可验证网络与代码真源路径，不把测试 Key 写入正在服务的容器或报告。临时账户和授权须在事务末回滚。
- 固定 Prototype 号可读人设和聚合 insights、可启动会话与聊天；我方 `ca_` ULID 的 bind/launch 均为 40401，正式画像 POST 为 50001，成长和健康子接口为 40401。**不能因为固定号的 canary 成功就全局切换 `CA_DISPLAY_DATA_SOURCE`**；真实家长账号仍无法绑定。
- 对方复测 `data:null` 时，我方真源展示当前返回 `event=null` 却标 `availability=ready`；这是待修的我方空态语义。里程碑前后 `DingDongPushEvent` 无新增，且生产 webhook 未配置密钥；不得称推送已通过。

## 生成任务被外部依赖卡住时的表现

`core/tasks.py` 的 `render_report` 遇到 fixture 故障会走真实失败路径（`FixtureFailure` → `job.status="failed"` + `error_code`），运营后台按 `ops/labels.job_error()` 给出中文失败原因与建议，并可经 `/api/v1/staff/jobs/<id>/retry` 真的重试。**不要用“直接置成功”的方式让失败任务消失**（`PROJECT_MEMORY.md` v0.3.3 的验收就是靠真实失败任务重试闭环）。

## 上传与留存

- 只接受 `testsupport.synthetic.synthetic_png(1..5)` 生成的五张确定性 PNG；`core/api/uploads.py` 的 `validate_synthetic_input()` 逐个比对字节，内容不符即 `INPUT_SLOTS_INVALID` 422。
- 单图 1 MiB、总量 5 MiB；`MemoryOnlyUploadHandler` 只用内存，**没有临时文件回退**；请求结束或异常都在 `endpoint()` 的 `finally` 里关闭缓冲区。
- 不采集、不留存真实指纹；图片、可重建特征与相关凭据不得写入数据库、缓存、日志或队列。
- 队列里只传 `job_id`：`CELERY_TASK_IGNORE_RESULT = True` 且 `CELERY_TASK_SERIALIZER = "json"`（`config/settings/base.py` 注释：“Never include vendor data, file payloads or task results”）。

## 部署与环境的边界

- 本地演示用 `config/settings/local.py`（`from .base import *`），公网演示用 `config/settings/deployment.py`。
- `deployment.py` 会在启动时校验：`PUBLIC_ORIGIN` 必须是干净的 http(s) origin、`DJANGO_SECRET_KEY`/`JWT_SIGNING_KEY` 长度 ≥50 且互不相同、`ADDITIONAL_ORIGINS` 同协议。这些校验是**故意 fail fast**，不要为了让环境起来而放宽。
- 演示环境仍用 fixture 集成、不采集真实指纹；短信模式可显式配置为真实阿里云短信，不能据此把算法、机器人或报告数据说成正式供应商接入。
- 生产机上的运营试用实例仍必须叫 **demo / 合成数据**，不能因为机器叫生产机就把 `APP_ENV` 改成 production。当前短信是真实发送，算法和机器人接入仍未完成；交付记录见 `deploy/PRODUCTION_TRIAL_20260928_V0313.md`。
- 当前生产机无浏览器 HTTP Basic 门禁，运营登录使用图形验证码。历史教训：若未来重加 Basic，不能覆盖所有 `/api/`；家长端登录后的 `Authorization: Bearer` 会被 Basic 拦成 401。改动门禁后必须用真实浏览器完成“家长登录→读取儿童档案→退出”，单看登录接口 200 会漏掉此缺陷。
- Docker 构建上下文的 `.dockerignore` 必须排除 `backend/.env*` 等本地密钥文件；即使 Git 忽略了文件，`docker build` 仍可能把工作区文件送入构建上下文。发布包只收 Git 跟踪文件并检查 `.env`/`.pem`/`.key`，生产机密钥单独以 0600 文件交付。构建前后均不得打印密钥。
- 门禁哈希文件应给实际 Nginx worker 用户读权限；生产机 worker 是 `nginx`，不是 Ubuntu 常见的 `www-data`。权限错误会导致授权请求 500，可从 Nginx error log 定位。
