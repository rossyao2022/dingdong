# 叮咚项目记忆与会话交接

最后更新：2026-09-12 14:23，Asia/Shanghai。适用于本目录中的后续会话。本文记录已核对事实，不代替代码和最新用户指令。

## 当前结论与最近工作

项目已完成 M1–M5 自有业务实现，以及启动后的界面功能复验、文档整理。最近用户要求将关键信息写入项目记忆，以便新会话接续。当前已按新用户指令完成v0.2.0的Docker演示部署，最终入口及验收见本文末尾；不扩展为真实业务生产或供应商接入。

最新验证记录：后端98项通过、覆盖率92%；真实Google Chrome共9个场景通过，最新启动复验约1.4分钟。桌面及390×844移动视口已测，不能称为真实手机硬件验收。这些是已有测试记录，本次记忆更新没有重新跑整套业务测试。

- [M5实现与外部边界](backend/docs/M5_RESULT.md)
- [最近启动复验](frontend/docs/UI_FUNCTIONAL_20260912.md)、[原始Chrome日志](frontend/docs/ui-functional-20260912.txt)
- [后端测试日志](backend/docs/tdd-green-m5.txt)、[标题转义补充复验](frontend/docs/tdd-green-m5-title.txt)
- [当前文档索引](文档/文档索引.md)、[机器文档校验](文档/文档校验结果.json)

## 用户明确的约束

- Python、Django/DRF、PostgreSQL，沿用现有脚手架。家长手机号登录，儿童为家庭下的档案，无独立儿童登录。普通资料不加不必要的加密，不采集、推算或保存年级。
- 短信验证码固定为字符串 `00000`，保留真实挑战、限频、消费、JWT与权限流程。它是非生产测试模式，不接真实短信。
- 其他API不得mock。base/mock初始化输入，外部缺失依赖使用数据库fixture，通过真实API/Worker生成业务结果；不直接插入成品报告、完成记录来冒充闭环。
- 不采集、不留存真实指纹。当前测评测试只接受五张确定性合成PNG，经有界内存处理；不得把图片、可重建特征或相关凭据写入数据库、缓存、日志或队列。
- CA主动获取DingDong数据。没有DingDong调用CA的入口，不下发画像、配置或任务；旧材料中的双向方案已撤销。
- 题库由运营逐题维护，不要求JSON或数据库操作。已发布/停用版本内容不可原地修改；旧答卷固定创建时版本。
- 探索体验与正式测评流程测试分开。探索只记录本次选择，不编造天赋、能力分数或专业结论。所有体验/测试内容须明确标注。
- 保留参考项目视觉风格。关键测试先行，功能实现后做必要回归和真实浏览器检查；桌面和移动视口均关注。常规实现自行决定，实质阻塞才询问。

权威约束来源：[已确认约束](需求/后台设计已确认约束.md)。新用户明确指令优先；历史分析中的建议不是用户批准的新范围。

## 已实现及关键代码位置

| 范围 | 状态与主要位置 |
| --- | --- |
| 登录/家庭/档案/活动 | JWT、刷新退出、跨家庭权限、档案增改、活动步骤与完成记录；backend/dingdong_ca/core/api |
| 后台题库 | 单选/多选、题干、选项、必填、最大选择数、增删排序、空草稿、预览、保存、发布、复制；core/questionnaire_admin.py、static/core/question_editor.js、core/api/staff.py |
| 题库版本 | core/assessment_models.py；迁移0004/0005增加用途/标题/说明、草稿支持；发布只停用同code的旧版本 |
| 体验与测评 | core/api/assessments.py、core/services/assessments.py；用途目录、版本固定、答案修订、恢复、幂等完成/提交 |
| 初始/阶段报告 | 真实Celery任务；新初始报告显示真实答卷选择和题库来源，专业结果明确未提供；历史报告不追溯改写 |
| 关联/同步/服务 | 测试凭据核验、CA主动同步、修订/去重、授权撤回、服务事项及实际删除后的去标识回执 |
| 家长端 | frontend/app.js、api.js、client.css；独立题库入口、返回修改/恢复/冲突提示、已完成体验、移动端伙伴引导/支持入口 |
| 测试 | backend/tests/test_questionnaires.py及原回归；frontend/tests/flows.spec.js、questionnaire-admin.spec.js；不得添加API拦截假响应 |

探索体验题量1–10（种子为参考代码原4题）；正式测评流程测试暂用20–30（种子22道日常情境题）。20–30只是本地产品约束，正式量表题量待甲方确认，不能重新写死所有问卷22题。

可读种子：backend/dingdong_ca/testsupport/question_content.py、activity_content.py。四题原文迁自参考仓库，22题涵盖日常探索、表达、观察、合作，八个活动有材料和可执行步骤。seed_mock对已知占位种子创建readable-v2，保留历史版本，不覆盖运营自行发布内容。warm仅是输入初始化兼容别名，不创建成品结果。没有reset_mock或dataset_run平台。

当前OpenAPI：44条路径、50个操作、62个Schema。[交互规范](设计/API/前后端交互规范_V0.1.md)、[OpenAPI](设计/API/openapi.json)、[实际数据库字段](设计/数据库实际字段_M5.md)。题库目录通过GET assessment-config返回；支持purpose和questionnaire_version_id。探索完成用POST assessments/{id}/complete-exploration，测评测试仍用multipart submit。不要把内部契约当作DingDong已确认协议。

## 运行与续接

工作区：`/Users/yihu/Documents/ChatGPT/叮咚`。原生JS前端，Django/DRF后端，PostgreSQL、Redis、Celery Worker/Beat。依赖以backend/uv.lock和frontend/package-lock.json为准。

- 家长端：`http://127.0.0.1:4173/`，`npm --prefix frontend run dev`。
- 后台：`http://127.0.0.1:8017/admin/`，题库在 `/admin/core/questionnaireversion/`。无默认工作人员密码，不能使用测试结束已停用的临时账号。
- PostgreSQL：127.0.0.1:55439；Redis：127.0.0.1:56379；Compose项目名dingdong-ca，配置backend/compose.yml。不要误操作其他项目数据库。
- 本次13:34复核：前端与runtime正常响应，PostgreSQL/Redis健康，Django、Worker、Beat进程在运行。仅为快照；新会话先检查，不重复启动端口占用服务或多个Beat。
- Codex的打开预览请求曾返回queued；用户后来已打开4173页面。不要把旧queued记录当成当前故障；需要操作页面时重新读取界面状态。

项目根目录的常用命令（各常驻进程分别启动，避免重复）：

```sh
docker-compose -f backend/compose.yml up -d --wait
uv run --directory backend python manage.py migrate
uv run --directory backend python manage.py seed_base
uv run --directory backend python manage.py seed_mock --dataset phase1-v1 --mode cold
uv run --directory backend python manage.py collectstatic --noinput
uv run --directory backend python manage.py runserver 127.0.0.1:8017
uv run --directory backend celery -A config worker --pool=solo --loglevel=WARNING --queues=dingdong-ca
uv run --directory backend celery -A config beat --loglevel=WARNING --schedule=/tmp/dingdong-ca-celerybeat-m5
npm --prefix frontend run dev
```

现存开发库已有真实测试流程留下的测试家庭、答卷、报告与活动。cold不清空记录；纯冷测试使用pytest独立测试库或新建隔离库。浏览器测试的临时内容人员和发布题库结束后停用，旧答卷仍保留。不要为了“初始化”删除已有数据。

新儿童做报告测试需要先用inject_fixture按返回的child_id注入assessment_success；旧答卷可指定`--questionnaire-version-id`。机器人流程注入sync_success，测试凭据形式为`TEST-PROOF-CHILD_UUID`；先授权再核验。参考窗口为2026-09-01至2026-09-08 UTC。这些不是供应商账号或真实设备凭据。完整命令及故障场景见[后端说明](backend/README.md)与[家长端说明](frontend/README.md)。

验证命令：`uv run --directory backend pytest -q`、`npm --prefix frontend test`（真实Chrome及全部服务需就绪）；Django check/makemigrations --check --dry-run、Ruff和前端check按改动范围执行。修改Worker代码后重启Worker；后台静态编辑器变更后collectstatic。不要因已有旧绿灯日志就声称新修改通过。

## 文档、原材料与Git状态

文档已分成当前指引与历史设计。原始附件和提取材料不改写；5个附件大小/哈希/ZIP匹配、85个归档文件哈希匹配、3份Word的1515个正文文字片段均有提取覆盖、11个工作表CSV行列一致。缺少原材料引用的3份文件；11项网页图片/字体资源历史下载失败，见[材料清单](材料清单.md)。不宣称网页完全离线或远端链接已验证。

`python3 scripts/audit_documents.py`检查本地文档、归档和契约；`uv run --directory backend python ../scripts/audit_documents.py --generate`从OpenAPI/模型重新生成字段文档并校验。计数以最新[校验JSON](文档/文档校验结果.json)为准，新记忆文件会增加文档数量。原始归档校验manifest不覆盖。

参考仓库：参考代码/dingdong，已核对HEAD为d754a5bf9ea8e71ca64a850d2e26aa321fe8ab38，未在本轮fetch远端。2026-09-09项目分析针对更旧的TalentRadar网页，不能把其随机评分问题套用到当前实现。

根目录Git工作区目前大量文件/目录为untracked，尚未建立本轮实现的可依赖提交基线。不要把untracked当作可以清理的垃圾；先核对状态，不能git clean、reset或覆盖现有实现。参考仓库是独立仓库。用户未要求提交或推送，本轮没有创建提交。

## 仍需外部确认与下一次开始方式

待确认：正式量表/适龄/题量/评分解释；甲方算法输入输出、超时幂等及一次性处理不留存约定；DingDong儿童/设备映射、权属核验、窗口游标修订、指标单位、同步频率及阶段规则；真实短信和生产部署条件。目前不开放真实指纹，不部署真实业务生产，不冒充供应商已接通。用户已授权以 Docker 部署到 tigery 并外网透传，范围为演示环境。

新会话先读本文件及文档索引，再根据用户新目标核对相关代码、测试和运行状态，继续工作即可。无需重新从历史PRD推导已经确认的边界。完成实质更新时同步本文件及相应文档，把“已验证事实”“暂定约束”“待外部确认”分开记录。

## 2026-09-12 Docker 发布 v0.2.0

用户授权建立发布分支和 Docker 包，并通过 Tailscale 100.115.66.119 部署 tigery。分支 codex/release-v0.2.0，VERSION、前后端版本与镜像标签统一为0.2.0。部署入口见 [部署说明](deploy/README.md)。独立 Compose 项目 dingdong-demo；本地验证端口18473，远端预定18080。生产禁用保留，新增demo测试数据模式。密钥在主机生成，不入Git或部署包。

新增部署配置测试3项通过，后端98项回归通过。镜像已构建，独立Docker数据库初始化成功，API健康，浏览器容器登录成功。完整Chrome回归8项通过、1项开发服务短暂断连，单项复验结果见 deploy/evidence/browser-retry.txt。构建和启动证据在 deploy/evidence。远端SSH已成功连接tigery-server（x86_64），Funnel配置被权限拒绝，需要管理员设置operator；远端部署与外网验收仍在进行，不能声称上线成功。

### 最终部署状态（14:23）

已部署至tigery-server，用户明确保留上海中继并接受Tailscale IP+端口访问。最终地址 http://100.115.66.119:18080/，后台 /admin/；访问设备需连接用户的Tailscale网络。临时官方香港中继偏好已清除，日志确认恢复上海derp-900；本任务的Funnel443/8443均已关闭。源代码发布提交2a01b74ba9b357559ef615018cc229246b73a157，标签v0.2.0，分支codex/release-v0.2.0；没有Git remote，没有推送。

部署包dist/dingdong-v0.2.0.tar.gz附SHA256并已远端校验。远端目录/home/tigery/services/dingdong/releases/dingdong-v0.2.0。远端密钥只在.env中，未进入版本库和发布包。真实IP入口的挑战/登录/刷新/退出、Cookie配置、后台登录页均通过；Django check无问题、Celery pong、服务运行正常。完整浏览器回归首次8过1断连，单项复验通过；远端浏览器工具超时，远端UI不声称已验收。[最终部署报告](deploy/DEPLOYMENT_20260912.md)、[远端IP验收](deploy/evidence/remote-ip.txt)。公网Funnel曾握手超时，按用户最终选择不再使用。

旧文中“Git尚无提交”“不部署”的状态属于更早快照，以上发布事实优先。原始材料和独立参考仓库仍在本地未跟踪，未删除或打入发布包。
