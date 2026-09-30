# DingDong CA 后端：M1 + M2 + M3

已完成第一批 TDD 开发：短信固定 `00000`、JWT/刷新/退出、家庭与儿童档案、发布活动读取、步骤与完成记录、分页和成长足迹统计。M2 已补齐用途授权、可版本化的日常情境测试题、五槽合成输入、初始画像与异步报告。M3 已完成机器人核验、同步修订、阶段画像/报告、成长总览、后台动作与儿童数据删除。真实 PostgreSQL，不使用 API mock。

## 启动

在本目录执行：

```sh
uv sync --locked
# 当前机器用独立 docker-compose；若安装了插件也可用 docker compose。
docker-compose up -d --wait
uv run python manage.py migrate
uv run python manage.py seed_base
uv run python manage.py seed_mock --dataset phase1-v1 --mode cold
uv run python manage.py collectstatic --noinput
uv run python manage.py runserver 127.0.0.1:8017
```

Python 3.14；依赖精确版本见 uv.lock（当前 Django 6.0.8、DRF 3.17.2、Simple JWT 5.5.1）。使用清华 PyPI 镜像解决本机官方包下载超时，锁文件保留包摘要。数据库独立使用 127.0.0.1:55439，容器与数据卷属于 dingdong-ca 项目，不访问其他项目数据库。

当前本地默认配置与 `.env.example` 一致；可复制为 `.env` 覆盖。里面的密码/签名密钥仅供本地合成测试，禁止公网部署。此批次 production 配置直接拒绝启动，避免误用固定验证码或未完成的供应商能力。

短信仍须先 GET `/api/v1/auth/csrf`，带 X-CSRFToken 创建短信挑战。默认 `SMS_MODE=fixed_code` 时只用于合成数据演示，输入 `00000` 登录；`SMS_MODE=aliyun_verify` 时向中国大陆手机号发送随机 5 位验证码，本地挑战表只存 HMAC 摘要，绝不回退固定码。登录会轮换 CSRF Cookie，后续浏览器请求使用最新 csrftoken。access 仅浏览器内存，refresh 在 HttpOnly Cookie；无默认工作人员密码，可按需用 Django createsuperuser 创建本地管理员。

真实短信需要单独的叮咚 RAM AccessKey，设置 `ALIYUN_VERIFY_ACCESS_KEY_ID`、`ALIYUN_VERIFY_ACCESS_KEY_SECRET`、`ALIYUN_VERIFY_SIGN_NAME`、`ALIYUN_VERIFY_TEMPLATE_CODE`，可选 `ALIYUN_VERIFY_REGION`（默认 `cn-shanghai`）与 `ALIYUN_VERIFY_ENDPOINT`（默认 `dypnsapi.aliyuncs.com`）。签名和验证码模板来自**号码认证服务 → 短信认证**的系统赠送资源，不能与短信服务的签名/模板混用。密钥只放受保护的运行环境配置，不进仓库、日志或浏览器。部署配置缺任一项时拒绝启动真实模式。发送请求经阿里云 `Dypnsapi/SendSmsVerifyCode`；本项目发送自生成验证码，因此登录验证仍由本地的限频、5 分钟有效期、最多 5 次错误和一次性消费流程完成，不调用阿里云 Check 接口。此产品的计费与短信服务免费试用包分开。真实短信功能不改变测评和机器人仍为演示/联调数据的边界。

同号码的 60 秒发码冷却在验证码已被登录消费后仍有效。已知阿里云发送频控（含 `biz.FREQUENCY`）返回 `RATE_LIMITED` 429 和“短信发送太频繁，请稍后再试”；其他发送失败仍不可用，挑战不能登录。

## 测试

```sh
uv run pytest -q --cov=dingdong_ca --cov-report=term-missing
uv run ruff check .
uv run ruff format --check .
uv run python manage.py check
uv run python manage.py makemigrations --check --dry-run
# 需要已经运行本地服务；会新增合成账号/儿童/活动记录。
uv run python scripts/smoke_http.py
```

pytest 使用 PostgreSQL 的 test_dingdong 数据库，测试结束清理测试库，不重置开发库。并发用例用独立线程/数据库连接验证锁和唯一约束。测试读取上级工作区设计/API/openapi.json 做响应契约校验，单独复制 backend 时也要携带契约文件或调整测试路径。

## 当前接口（65 个操作，全部 OpenAPI 路由已实现）

- GET runtime、GET auth/csrf；POST auth/sms、auth/login、auth/refresh、auth/logout；GET me。
- GET/POST children；PATCH children/{child_id}。
- GET activities；GET/POST children/{child_id}/activity-records。
- GET/PATCH activity-records/{record_id}；POST activity-records/{record_id}/finish。

- GET policies/current；GET/POST children/{child_id}/consents；POST consents/{consent_id}/revoke。
- GET assessment-config；GET/POST children/{child_id}/assessments；GET assessments/{session_id}。
- PATCH assessments/{session_id}/answers；POST assessments/{session_id}/submit、cancel。
- GET children/{child_id}/profiles、reports；GET reports/{report_id}。

- POST children/{child_id}/associations/verify；GET children/{child_id}/associations；POST associations/{association_id}/revoke。
- GET children/{child_id}/observations、growth-overview。
- GET/POST children/{child_id}/data-requests；GET data-requests。
- 后台 11 个操作：内容/规则发布、任务详情/重试、同步暂停/恢复、事项处理、工作人员角色/状态。

前缀均 `/api/v1`，字段以工作区 OpenAPI 为准。仅 submit 接受 multipart；其余 JSON 写接口拒绝 multipart。当前 submit 仅接受 `testsupport.synthetic.synthetic_png(1..5)` 生成的五张确定性图片，拒绝真实指纹。单图 1 MiB、总文件 5 MiB；自定义上传处理器只用内存，没有临时文件回退，完成或异常均关闭缓冲区。

另开两个终端启动报告与恢复任务（Redis 使用本项目 127.0.0.1:56379）：

```sh
uv run celery -A config worker --pool=solo --loglevel=WARNING --queues=dingdong-ca
uv run celery -A config beat --loglevel=WARNING --schedule=/tmp/dingdong-ca-celerybeat
```

报告队列只传 job_id；数据库保留 pending 状态，Beat 每 10 秒补投、恢复过期租约，每 30 秒检查算法超时。报告写入前再次检查授权和执行令牌，失败最多 5 次；模板缺失时等待发布。成功报告不原地覆盖。

```sh
# 新建测试儿童后，显式为其注入算法输入；不是注入 API 响应或成品报告。
uv run python manage.py inject_fixture --child-id CHILD_UUID --scenario assessment_success
# 其他故障：assessment_timeout、assessment_failure、report_failure（首次渲染失败）
uv run python scripts/smoke_m2_http.py
```

Admin 使用四个固定角色，业务按钮复用 staff API（Django Session + CSRF）：

| 角色 | 菜单与操作 |
|---|---|
| operations | 儿童、活动记录、关联、报告、服务事项；人工处理 support/correction、取消事项 |
| content | 活动、题库、报告模板、规则；编辑草稿、发布新版本 |
| technical | 任务、尝试、同步进度、关联、观察、审计、事项；重试、暂停/恢复、实际删除 |
| account_admin | 工作人员列表；启停、分配前三种业务角色 |

无菜单配置器、角色编辑平台、接口权限树。发布后不能直接编辑；账号管理员不能通过业务入口修改自己、超级管理员或其他账号管理员。首次本地超级管理员由 createsuperuser 建立，没有预设密码。

后台入口 `http://127.0.0.1:8017/admin/`。更新后重新执行 seed_base 和 collectstatic；应用列表按角色显示。家长前端已接入，见 M5 验收记录。

## 初始化数据

seed_base 创建固定角色，不创建默认管理员。seed_mock 注入两组测试家庭、儿童、8个可执行活动、4道探索体验题、22道日常情境测试题及报告模板/规则。已知旧占位种子停用并发布 readable-v2；已有答卷和报告不改写，运营自行发布内容不覆盖。cold 不清理用户记录；warm 仅保留为输入初始化兼容别名，不再直接创建完成/跳过记录。需要纯冷启动时使用独立测试数据库。

短信限频本批次使用 PostgreSQL 短期 SmsChallenge 记录和事务 advisory lock，同时限制手机号与来源IP；无 Redis/邮件服务启动依赖。client_ip 仅用于短期限频，`cleanup_auth` 清理24小时前挑战（包括IP），同时清理过期后保留一天的登录授权；部署时须定期运行。验证码只存校验摘要，消费后清除，不打印验证码/令牌。

儿童创建保存一份仅包含name/gender/birth_date的原始创建参数，用于在后续编辑后仍正确识别同 request_id 重试；不涉及加密，不引入通用幂等平台。后续数据删除必须同时清除此附属字段。

## 已验证与未实现

- TDD 记录：docs/tdd-red-m1.txt（24 failed），docs/tdd-red-content-type.txt（上传格式契约红灯），docs/tdd-green-m1.txt（最终通过）。
- HTTP 实测：docs/http-smoke-result.json；合成种子ID见 docs/seed-manifest.local.json。
- 全部测试计划：docs/TDD_CASES.md。没有把 M2/M3 写成 skip 再计入通过数。
- M3 已验证范围见 docs/M3_RESULT.md；19 场景注入与动作见 docs/M3_SCENARIOS.md。
- 尚未完成：真实算法/DingDong 正式版适配、阿里云真实短信模式的公网收码登录验收。本地真实短信已向授权测试号完成实发、登录及验证码重复使用拒绝验证；生产机试用实例已切为真实短信模式，公网配置、页面与服务健康通过，部署时没有再次实发短信。没有实现通用 reset 命令；使用隔离测试数据库获得干净状态。
- M2：53 项测试通过，覆盖率 92%；见 docs/M2_RESULT.md、docs/tdd-green-m2.txt。真实 HTTP → PostgreSQL → Redis → Celery → 报告验证见 docs/http-smoke-m2-result.json。内存上传验证限当前 Django/WSGI 开发路径，不代表已验证生产代理、ASGI 或操作系统层的留存行为。

来源和裁剪说明：docs/SCAFFOLD.md。未修改参考前端代码；本批次是可运行后端与测试，不等于前端已完成接入。


## M3 同步与阶段规则

先同意 dingdong_sync 用途，再注入 sync_success 并调用 associations/verify。Worker 从数据库测试数据源读取，Beat 每分钟扫描到期关联（成功后 5 分钟到期）；没有新增 DingDong 调用 CA 的入口，也不向 DingDong 推送画像/配置。

fixture 只支持完整固定窗口的 test_observation/count，规则 test-count-v1 仅做合成倍数计算。唯一关联、一次性票据、修订冲突、失败不推进游标、撤回/暂停检查以及 Worker 执行令牌共同保证结果的一致性。真实主体标识、窗口/游标、维度与评分语义仍待 DingDong 确认。

M4 已加入独立家长端，见 [前端说明](../frontend/README.md) 和 [M4 验收记录](docs/M4_RESULT.md)。M4 时为 83 项测试通过；M5 为 98 项通过，覆盖率 92%。


## M5 后台题库与新接口

最新证据见 [M5 验收记录](docs/M5_RESULT.md)。后台“题库管理”支持逐题表单、草稿、预览、发布和复制。新迁移 0004/0005 后重新 collectstatic；已运行的 Worker 需重启以使用可读报告模板逻辑。

GET assessment-config 支持 purpose=exploration|assessment 和可选 questionnaire_version_id，同时返回全部发布题库的目录。答卷包含用途、题库名称/说明/版本与完成后的选择摘要。POST assessments/{id}/complete-exploration 接收 revision，幂等完成探索，不创建画像或报告。正式测评流程仍用 multipart submit。

探索题量 1–10、测评流程测试题量 20–30；这是本地暂定范围，专业规范待甲方确认。新初始报告从真实答卷生成选择摘要，专业结果暂无数据；不按测试答案编造能力分数。


## M6 运营后台

运营人员日常使用的后台管理系统，入口 `/ops/`（本地 `http://127.0.0.1:8017/ops/`）。它是独立应用 `dingdong_ca.ops`，不是 Django Admin 换皮：自有导航、自有模板（29 个）、自有视觉，列表与审计显示业务名称而不是 UUID，题库与活动是可视化编辑器，不需要运营写 JSON 或连数据库。

```sh
uv run --directory backend python manage.py migrate            # 需要 0006
uv run --directory backend python manage.py collectstatic --noinput
uv run --directory backend python manage.py runserver 127.0.0.1:8017
```

覆盖范围：工作首页真实待办与标注口径的统计、家庭与儿童聚合详情、题库与活动的草稿/预览/发布/复制/停用、报告与生成异常处理（业务语言失败原因 + 幂等重试）、服务事项处理闭环、账号角色与操作审计。

角色分为 `operations`（运营）、`content`（内容运营）、`technical`（技术运维）、`account_admin`（管理员），18 个权限点，服务端在每个页面与每个动作上重新判定。家长账号 `account_kind=parent` 无法进入后台。

后台的错误页通过 `config/urls.py` 中按 `/ops/` 前缀分流的 `handler403` / `handler404` 提供，非 `/ops/` 路径仍走 Django 默认行为，家长端 API 的错误契约未变。

- 使用说明：[运营手册](docs/OPS_MANUAL.md)
- 权限矩阵与排障：[权限说明](docs/OPS_PERMISSIONS.md)
- 验收结果与发现缺陷：[M6 验收记录](docs/M6_OPS_RESULT.md)

测试：`backend/tests/test_ops_{console,content,reports,services}.py` 共 62 项；真实 Chrome 场景见 `frontend/tests/ops-console.spec.js`。M6 后为 160 项后端测试通过、覆盖率 90%。


## 会展原儿童的报告输入准备

在已开启固定号的 demo/database_fixture 环境执行：

```bash
uv run python manage.py prepare_prototype_demo_report
uv run python manage.py prepare_prototype_demo_report --apply
```

第一条仅预检，第二条仅给 `ca_dingdong` 当前原儿童补合成输入，并记录审计。原标签不匹配、账号或儿童失效、缺少发布内容、已有不同输入时拒绝写入，不覆盖或发布题库。准备完成后仍须通过家长端同意用途、完成问卷、提交，让 Worker 生成报告。生产机执行前遵守远端写入放行门禁。


## 六岛兴趣与八维日常观察（v0.3.20）

这两项是由家长本次作答得到的日常探索记录，独立于专业算法和DingDong画像。原型内容固定来自 `upstream/main@3b8723e`，内容来源标记为 `reference`，不冒充供应商测评。

- `GET /api/v1/assessment-config?purpose=interest|talent` 获取已发布题库。
- 继续使用原有儿童答卷创建、答案保存、查询与 `complete-exploration` 接口。
- 兴趣创建需 `selected_islands` 按先后顺序提供三个不同的 `R/I/A/S/E/C`；会话固定所选9题，选项代码为字符串 `0`–`4`。每岛3题取平均0–4，未选岛不生成分数。
- 八维固定24题，选项代码字符串 `1`–`5`，每方向3题相加3–15。并列结果保留全部方向，不生成职业概率或能力标签。
- 缺题、无效选项、过期或修订号冲突不完成。完成时保存固定 `exploration_result`；已完成记录、题库版本和计分规则不可原地改动。重新选择或再次探索创建新答卷。
- 原有 `assessment` 的合成图片、数据库fixture和专业算法未接入闸门保持有效。新用途不接受提交图片。
- 列表可按用途筛选；`interest/talent` 筛选结果按新到旧，其余原有调用保留旧到新顺序，分页游标绑定用途与顺序。

本地导入只新增两份题库与十个对应活动（六岛、四个指纹指南活动），保留既有活动分类和版本：

```sh
.venv/bin/python manage.py import_prototype_content                  # 仅预览，无写入
.venv/bin/python manage.py import_prototype_content --apply          # 创建草稿
.venv/bin/python manage.py import_prototype_content --apply --publish # 明确发布新增版本
```

同版本内容完全一致时可重复执行；已有版本不一致或其他同标识版本时拒绝覆盖。运营通过复制新版本、编辑题干及选项文案、预览和发布维护内容；后台儿童详情可查看该次真实答案与固定分数。远端执行导入及发布属于部署写入，必须按仓库门禁先获放行。

## 网页陪伴与记录导出（v0.3.21）

- `GET/PATCH /api/v1/children/{child_id}/companion-preference` 保存当前儿童的网页陪伴方式：`cognitive/imitative/reverse/open`。未设置时GET只返回默认`cognitive`、`revision:0`，不创建记录；PATCH必须带当前修订号，冲突返回409。该偏好独立于机器人配置与活动既有`style`。
- 活动创建可附加`guide_mode`；历史记录默认空值，不改变旧`style/mode`。同一`request_id`换陪伴方式会返回幂等冲突。
- 默认四题探索完成后返回`guidance_summary`，按固定Q01–Q04的A/B/C/D选项代码统计四种陪伴选择；未完成或自建题库不生成该摘要，不作为能力评分。
- `GET /api/v1/children/{child_id}/export` 返回`schema_version:ca-child-export-v1`，只导出当前儿童基本信息、真实探索答卷（版本、题目、答案、结果）、活动与网页偏好。无手机号、登录凭据、机器人账户/NFC、指纹图片、其他儿童数据，也不包含专业合成测评。
- 儿童关联任何机器人账户或受保护历史事件时，实际删除返回409 `CA_ACCOUNT_CONFLICT`，在任何写入前停止；儿童资料、活动、偏好、审计与删除申请均不改变。保留账户ID和历史关联，不能把这种拒绝显示成删除成功。
- 运营维护当前会展题库应从默认题库复制新版本；新建独立题库不会自动替换首页入口。后台预览完整18题兴趣库，但家长选择3岛后只答9题；八维24题每方向3题累计3–15分。
