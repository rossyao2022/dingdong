# 叮咚项目记忆与会话交接

最后更新：2026-09-16 23:55，Asia/Shanghai。适用于本目录中的后续会话。本文记录已核对事实，不代替代码和最新用户指令。

## 当前结论与最近工作

**最近一轮工作：CA 对接 C1「`ca_account_id`」从设计落地为可运行系统（2026-09-16 晚，用户「你能不能直接干完」）。** 状态：**已实现、已测试，未部署、未发版**——线上仍是 v0.3.6，生产库没有 `0008` 迁移。已落地的部分：`CaAccount` 模型 + 迁移 `0008`（两个状态维度 `status`/`bind_state`，6 条约束）、发号器与生命周期服务（ULID / HMAC 摘要 / 幂等建号 / 同机复用同号 / 异机 409 换机信号 / 归档）、家长端 4 个接口、出站 DingDong 客户端骨架（未配置时显式报"未配置"，不伪造成功）、家长端 NFC 承接与换机界面（凭据读完即从地址栏摘掉，只留内存）、运营后台只读页「CA 账户」。**当前本地回归：后端 266 项、前端单测 16 项、家长端真实 Chrome 4 项全绿；openapi 55 operations / 65 schemas，`scripts/audit_documents.py` errors 为空。** 仍未做的三件：**8 个出站接口**（缺 D10 base URL / D12 key）、**换机的"主动解绑"分支**（缺 D20）、**人设 / 成长报告 / 健康度四态 / 复测 CTA 四个展示面**。设计与判定标准见 [设计/CA对接_C1_ca_account_id设计_20260916.md](设计/CA对接_C1_ca_account_id设计_20260916.md) §7；实现细节与五个环境坑见本文末尾「C1 `ca_account_id` 落地实现」。

项目已完成 M1–M5 自有业务实现、M6 运营后台（`dingdong_ca.ops`），并已把运营后台部署到 tigery、通过上海公网入口完成真实浏览器验收。**当前线上版本 0.3.6**：家长端 http://110.42.225.196/dingdong/ ，运营后台 **http://110.42.225.196/ops/** ，Django 后台 /admin/ 。v0.3.6 是**运营后台界面改版**（本地化 Tabler 组件体系 + 25 个页面统一外壳 + 静态资源 `?v=` 缓存击穿 + 明文入口 COOP 静音），见本文末尾「运营后台 v0.3.6：界面改版（2026-09-14）」；交付说明 [deploy/OPS_CONSOLE_UI_20260914_V036.md](deploy/OPS_CONSOLE_UI_20260914_V036.md)。上一轮 v0.3.5 的交付见「运营后台 v0.3.5：家长端档案冲突保留输入并提供可恢复路径（2026-09-14）」。

最新验收记录（v0.3.6 发布轮）：后端237项通过、部署配置9项通过、ruff通过、前端check与单测3项通过、本地浏览器8项通过；**公网真实Chrome**：冲突恢复5通过/5跳过、P1专项6通过/6跳过、运营后台回归15通过/7跳过，合计26通过/18跳过/0失败；公网逐页体检25个页面全部通过、「裸控件」由改版前67个降为0。桌面及390×844移动视口已测，不能称为真实手机硬件验收。此前 v0.3.5 记录：后端237项、部署8项；公网冲突恢复+P1专项11通过、运营后台回归15通过。**2026-09-16 的 CA 轮不减这些记录：它只改本地代码与文档，线上未动。**

- [M5实现与外部边界](backend/docs/M5_RESULT.md)
- [最近启动复验](frontend/docs/UI_FUNCTIONAL_20260912.md)、[原始Chrome日志](frontend/docs/ui-functional-20260912.txt)
- [后端测试日志](backend/docs/tdd-green-m5.txt)、[标题转义补充复验](frontend/docs/tdd-green-m5-title.txt)
- [当前文档索引](文档/文档索引.md)、[机器文档校验](文档/文档校验结果.json)

## 用户明确的约束

- Python、Django/DRF、PostgreSQL，沿用现有脚手架。家长手机号登录，儿童为家庭下的档案，无独立儿童登录。普通资料不加不必要的加密，不采集、推算或保存年级。
- 短信验证码固定为字符串 `00000`，保留真实挑战、限频、消费、JWT与权限流程。它是非生产测试模式，不接真实短信。
- 其他API不得mock。base/mock初始化输入，外部缺失依赖使用数据库fixture，通过真实API/Worker生成业务结果；不直接插入成品报告、完成记录来冒充闭环。
- 不采集、不留存真实指纹。当前测评测试只接受五张确定性合成PNG，经有界内存处理；不得把图片、可重建特征或相关凭据写入数据库、缓存、日志或队列。
- **我们是 CA 侧**（2026-09-16 用户更正：「我们是CA侧」）。DingDong 是提供 Data Service 的对接方。CA 主动获取 DingDong 数据——新对接文档把它落成 8 个 `/api/v1/ca/*` **出站调用**（请求头带 `X-API-Key`、全部走 HTTPS）；没有 DingDong 调用 CA 的入口，也不接收推送。我们只有 `bind` 与复测回写两个契约内写操作，**不下发画像、配置或任务**，该边界不变。详见[已确认约束](需求/后台设计已确认约束.md)首节。
- 题库由运营逐题维护，不要求JSON或数据库操作。已发布/停用版本内容不可原地修改；旧答卷固定创建时版本。
- 探索体验与正式测评流程测试分开。探索只记录本次选择，不编造天赋分、能力分或专业结论。**（2026-09-16 复核，此前一度记反）**：CA 对接文档里的**八维成长代理**（`*_growth`，0–100）、`match_score`、`health_score` **全部由 DingDong 侧产出**，我们只读取并展示，**不由我们产出**——因此旧 demo 边界「不产出天赋或能力分数」**无需松动**。所有体验/测试内容须明确标注。
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

当前OpenAPI：44条路径、51个操作、62个Schema。v0.3.4给 `/children/{child_id}` 补了 GET（家长端冲突恢复要读最新档案与修订号）。[交互规范](设计/API/前后端交互规范_V0.1.md)、[OpenAPI](设计/API/openapi.json)、[实际数据库字段](设计/数据库实际字段_M5.md)。题库目录通过GET assessment-config返回；支持purpose和questionnaire_version_id。探索完成用POST assessments/{id}/complete-exploration，测评测试仍用multipart submit。不要把内部契约当作DingDong已确认协议。

## 运行与续接

工作区：本仓库根目录。原生JS前端，Django/DRF后端，PostgreSQL、Redis、Celery Worker/Beat。依赖以backend/uv.lock和frontend/package-lock.json为准。

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

验证命令：`uv run --directory backend pytest -q`、`npm --prefix frontend test`（真实Chrome及全部服务需就绪）；Django check/makemigrations --check --dry-run、Ruff和前端check按改动范围执行。部署配置测试**必须从 backend 目录运行**（`test_settings.py` 的子进程要能 import `config`）：`cd backend && .venv/bin/python -m pytest ../deploy/tests -q`；本地 pytest 若遇沙箱 tmpdir 报错，加 `--basetemp=/tmp/dd-pytest/bt`。修改Worker代码后重启Worker；后台静态编辑器变更后collectstatic。不要因已有旧绿灯日志就声称新修改通过。

## 文档、原材料与Git状态

文档已分成当前指引与历史设计。原始附件和提取材料不改写；5个附件大小/哈希/ZIP匹配、85个归档文件哈希匹配、3份Word的1515个正文文字片段均有提取覆盖、11个工作表CSV行列一致。缺少原材料引用的3份文件；11项网页图片/字体资源历史下载失败，见[材料清单](材料清单.md)。不宣称网页完全离线或远端链接已验证。

`python3 scripts/audit_documents.py`检查本地文档、归档和契约；`uv run --directory backend python ../scripts/audit_documents.py --generate`从OpenAPI/模型重新生成字段文档并校验。计数以最新[校验JSON](文档/文档校验结果.json)为准，新记忆文件会增加文档数量。原始归档校验manifest不覆盖。

参考仓库：参考代码/dingdong，已核对HEAD为d754a5bf9ea8e71ca64a850d2e26aa321fe8ab38，未在本轮fetch远端。2026-09-09项目分析针对更旧的TalentRadar网页，不能把其随机评分问题套用到当前实现。

根目录Git工作区已建立发布分支基线：v0.2.0 至 v0.3.6 各有 `v<版本>` 标签（全部保留）。**2026-09-17 清理**：12 个已合并的 `codex/release-v0.2.0`…`v0.3.5` 分支已删除（都 `--merged` 进 HEAD，标签不动），**当前只剩工作分支 `codex/release-v0.3.6`**——`deploy/package.py` 会**校验当前分支名必须等于 `codex/release-v<VERSION>`**，改名会挡住打包，所以这个分支名不能动。原始材料（`材料/`、`参考代码/dingdong/`）是本地输入、**不进库**，2026-09-16 起已由根 `.gitignore` 显式排除；`frontend/docs/`（前端验收截图与本机记录约 15MB）**2026-09-17 起也移出版本库、只在本机留存**，正式证据仍以 `deploy/evidence/**` 为准。`项目分析.md`、`材料清单.md`、`参考代码/来源说明.md` 是我们自己的文档，随本轮一并入库。**不要把 untracked 当作可以清理的垃圾**，也不能 `git clean`、`reset` 或覆盖现有实现。

**路径写法（2026-09-17 统一）**：文档与证据里**不再写 `/Users/<本机账号>/...` 绝对路径**；Markdown 链接写成相对文档所在目录的形式（`../设计/x.md`），日志/堆栈写成从仓库根起的路径（`backend/tests/x.py:6`）。本次一次改写了 26 个文件（约 108 处，含 `%E5%8F%AE%E5%92%9C` 这种 URL 编码形式）；改写后 `scripts/audit_documents.py` 仍是 78 篇 / 495 链接 / `errors: []`。后续照这个写法维护。

**凭据边界（2026-09-16 起写进 `.gitignore`）**：`.env` / `.env.*`（`.env.example` 例外）、`*.pem` / `*.key` / `*.p12`、`**/*creds*.env`、`**/credentials*.json`、`**/dd-ops-*.env`、`**/*-creds.sh`、SSH 私钥一律不进库；验收凭据只经环境变量传递（`frontend/deployment-tests/`）。已复核：跟踪文件里**没有**明文口令或密钥（`deploy/evidence/acceptance-round-20260915/prepare-accounts.py` 从 `os.environ["DD_PW"]` 取值），`deploy/.env`（360B/600）始终被忽略。

`材料/` 是**对方提供的第三方文档与网页归档**（约 45MB），`参考代码/dingdong/` 是外部参考仓库快照（HEAD `d754a5bf9ea8e71ca64a850d2e26aa321fe8ab38`）——两者都不进库。**根仓库此前没有 Git remote、从未推送**；参考仓库 `rossyao2022/dingdong` 是**公开的原型演示仓库**（我们对其只有 `pull` 权限），与本仓库历史无关——两边没有共同祖先（本仓库根提交 `2a01b74`，对方最新 `d754a5bf` 在本仓库里不存在），所以**不存在能算得出 diff 的 PR 路径**，不能向它提 PR。详见本文末尾「推送记录」。

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

## 最新有效状态：上海公网80端口（2026-09-12 14:54）

用户明确要求**没有Tailscale的访问者也能使用**；此前“接受Tailscale IP访问”的理解有误，不应作为约束继续沿用。已改为 http://110.42.225.196/dingdong/ ，后台 http://110.42.225.196/admin/ ，通过上海服务器已有公网80端口转发至tigery，无需用户开新端口。原网站首页和上海DERP443保留。

版本/镜像0.2.2，分支codex/release-v0.2.2，标签v0.2.2，发布提交4c5d0d3；发布包dist/dingdong-v0.2.2.tar.gz及SHA256，远端已校验。部署目录/home/tigery/services/dingdong/releases/dingdong-v0.2.2，沿用数据库和密钥。上海nginx配置/etc/nginx/dingdong-location.conf，通过既有game-lobby.conf的IP HTTP server include；占用/dingdong/、/api/v1/、/admin/、/static/路径。

上海服务器本机SSH别名mmcloud，IP110.42.225.196。tigery的user systemd服务dingdong-relay维护受限SSH反向隧道到上海localhost:18473，enabled/active，Linger已开启。已验证隧道重启后公网恢复。旧公网18080监听已停用；临时探测监听已退出；Funnel保持关闭，上海中继偏好保留。

真实公网IP80入口已通过版本、runtime、验证码挑战、登录、刷新、退出、后台登录页验收，API/数据库健康。公网浏览器控制工具仍超时，不声称完整远端UI验收通过。本轮部署设置3项测试通过，业务代码未变；历史98项后端和Chrome回归见之前记录。详情与证据：[公网部署验收](deploy/PUBLIC_DEPLOYMENT_20260912.md)、[公网认证结果](deploy/evidence/public-v0.2.2.txt)、[配置说明](deploy/relay/README.md)。

## 最新修复：v0.2.3 HTTP请求编号（2026-09-12 15:05）

用户反馈登录填写档案后crypto.randomUUID is not a function。根因是公网HTTP缺少该API，childForm在绑定提交事件前异常；localhost安全上下文测试漏掉此问题。已在api.js提供createRequestId：原生randomUUID优先，HTTP回退getRandomValues生成v4 UUID；app.js所有requestKey改用此入口，原请求去重机制不变。

已部署0.2.3，分支codex/release-v0.2.3，标签v0.2.3，发布提交b3fda83。包dist/dingdong-v0.2.3.tar.gz附SHA256，tigery目录/home/tigery/services/dingdong/releases/dingdong-v0.2.3。公网地址仍为http://110.42.225.196/dingdong/。

本轮真实Chrome公网复现红灯后，新版桌面和390×844移动视口的登录→保存档案→刷新恢复→开始活动共2项通过（9.7秒），明确处于非安全HTTP上下文且没有randomUUID。单元测试3项和语法检查通过；未重复后端整套回归。本轮使用项目Playwright/Chrome测试命令完成真实浏览器验收，早先CUA工具超时不再代表缺少本次浏览器验证。详见[修复报告](deploy/HTTP_UUID_FIX_20260912.md)。新增npm --prefix frontend run test:unit和test:public；public访问演示站并生成合成测试档案。


## 最新修复：v0.2.4 双入口登录（2026-09-12）

用户截图确认Tailscale地址登录报“服务返回了无法识别的响应”。实际复核runtime返回400，后端日志为DisallowedHost：公网切换后ALLOWED_HOSTS仅有上海IP，遗漏原TailscaleIP。部署设置新增ADDITIONAL_ORIGINS，配置精确Host和CSRF Origin；保持与PUBLIC_ORIGIN同协议。

已部署v0.2.4，分支codex/release-v0.2.4，标签v0.2.4，源码提交e653ef2。Docker包dist/dingdong-v0.2.4.tar.gz附SHA256，远端校验成功，目录/home/tigery/services/dingdong/releases/dingdong-v0.2.4。主机设置ADDITIONAL_ORIGINS=http://100.115.66.119:18080，PUBLIC_ORIGIN保持http://110.42.225.196。原数据卷和密钥沿用。

内网http://100.115.66.119:18080/与公网http://110.42.225.196/dingdong/均通过真实Chrome桌面与移动视口登录→保存合成档案→刷新恢复→开始活动，共4项通过。公网访问者仍无需Tailscale。部署设置测试先3失败后6通过，远端Django check无问题、API/数据库健康；本轮未重复全部后端业务测试。证据：[配置测试](deploy/evidence/v0.2.4/settings-green.txt)、[内网浏览器](deploy/evidence/v0.2.4/tailscale-browser.txt)、[公网浏览器](deploy/evidence/v0.2.4/public-browser.txt)。


## 后台管理员开通（2026-09-12）

用户授权后，已在tigery当前部署数据库创建专用后台超级管理员；此前核查无staff账号。通过Django认证及后台首页HTTP 200验证。凭据仅在当前会话交付，未写入仓库或部署包。后台入口http://110.42.225.196/admin/。此操作仅新增管理员，不修改镜像或版本。


## 最新修复：v0.2.5 后台CSRF（2026-09-12）

后台HTTP登录403的原因是nginx追加no-referrer策略，浏览器表单Origin变为null。已改为same-origin，保留CSRF验证。发布分支codex/release-v0.2.5、标签v0.2.5、源码提交b92282d，部署包及SHA256已远端校验，目录/home/tigery/services/dingdong/releases/dingdong-v0.2.5。

真实Chrome先复现桌面/移动两项403红灯；部署后公网后台CSRF表单测试与家长登录档案活动回归共4项通过。另用实际管理员通过公网及Tailscale两个入口完整浏览器登录，均到达/admin/并出现退出表单。凭据不入测试代码和证据文件。此前Django Client.login不覆盖浏览器CSRF流程，不能再作为完整登录验收。详见[后台修复](deploy/ADMIN_CSRF_FIX_20260912.md)及[浏览器日志](deploy/evidence/v0.2.5/public-green.txt)。


## 运营后台交付与公网验收 v0.3.0 → v0.3.2（2026-09-12 19:00）

**最新有效状态**：运营后台已上线并完成公网真实浏览器验收。家长端 http://110.42.225.196/dingdong/ ，**运营后台 http://110.42.225.196/ops/** ，Django后台 /admin/ 。版本/镜像/分支/标签/发布包统一 0.3.2，发布提交`0419bf4`，分支codex/release-v0.3.2，标签v0.3.2，包`dist/dingdong-v0.3.2.tar.gz`附SHA256并已远端校验，远端目录`/home/tigery/services/dingdong/releases/dingdong-v0.3.2`。

**运营后台必须在根路径**：Django生成根绝对地址，带前缀剥离的`/dingdong/`入口撑不住页面内跳转（第一次请求可以，之后链接和重定向都跳回根）。这与既有`/admin/`、`/static/`、`/api/v1/`是同一模式。上海nginx的`/etc/nginx/dingdong-location.conf`新增`location ^~ /ops/`，绕过隧道。占用前已核对原站`/www/wwwroot/game`没有`ops`目录、index.html与JS资源也无`/ops`引用；`/`、`/buddy/`、`/dinoworld/`仍返回原内容。

**三个只有真正跑起来才暴露的缺陷**（v0.3.0代码和文档完整，但用不了）：
- v0.3.1：`deploy/nginx.conf.template`白名单漏`ops/`，容器nginx把`/ops/`当静态文件返回404，运营后台在Docker下完全打不开。本地跑源码runserver绕过了这层。修复并新增`deploy/tests/test_nginx_routes.py`（从urls.py解析顶层前缀逐条断言）。此前的本地Docker演示环境也没有针对`/ops/`的断言。
- v0.3.2：管理员按钮点了没用。`ops/permissions.py`把`account_admin`定义为全部权限，页面显示"发布""重试该任务"，但复用的`/api/v1/staff/*`按具体角色放行（发布要content、重试要technical），管理员点下去403"角色不允许此操作"。修复：复用接口把`account_admin`视为满足任一角色。新增`backend/tests/test_ops_admin_role.py`三项回归，含"无匹配角色仍被拒"防扩大。v0.3.0浏览器用例用content/technical专用账号，正好绕开这条路径。
- v0.3.2：`≤560px`时`.ops-crumb`被`display:none`，手机上从儿童详情、报告详情退不回去。改为换行展示。

**验收证据**：后端173项通过；公网真实Chrome 16项通过（桌面10+窄屏6，4项写操作按设计跳过）；部署配置与nginx路由测试8项；ruff通过。用例`frontend/deployment-tests/ops-public.spec.js`指向公网入口，不拦截接口响应，凭据全部来自环境变量。详见[公网交付与验收](deploy/OPS_CONSOLE_DEPLOYMENT_20260912.md)、[M6验收记录](backend/docs/M6_OPS_RESULT.md)、证据目录`deploy/evidence/v0.3.2/`。

**报告数据是真实链路产出的**，未直接插入成品报告：通过公网家长端API完成短信登录→建档→授权→关联核验，再用`inject_fixture`注入非生产测试输入，由Beat/Worker真实跑出同步、阶段画像与报告任务。结果2份真实ReportVersion、1个report任务成功、1个处理中；失败任务由真实注入的上游渲染故障打挂，重试后Worker重新渲染成功。

**演示边界未变**：固定验证码`00000`、fixture集成、不接真实供应商、不采集真实指纹。后台账号密码与密钥不进仓库、测试证据与项目记忆。验收用的临时账号（opsverify_admin / opsverify_operator）已在验收后停用。

**回滚**：见[回滚说明](deploy/ROLLBACK.md)。**不要把回滚目标设成v0.3.0或v0.3.1**——前者Docker下`/ops/`打不开，后者管理员按钮403。


## v0.3.2 独立复验：正式运营交付暂不通过（2026-09-12）

用户要求验收现有改动，本轮未修功能或改部署。线上0.3.2、源码HEAD eefea90。后端173项和部署配置8项重新通过，但独立公网真实Chrome实验复现：同一题库两个旧编辑页面后保存者静默覆盖先保存者标题；content角色在审计页403但首页可看到全站最近审计的合成儿童标记；非法审计日期返回500。新建内容仍强制手填内部标识/版本号，需改善。

只读公网回归首次7通过1失败（Ops脚本即时断言），重试受登录/连接/SSH异常影响，不能称为全绿。随后公网登录页200、SSH恢复，确认本轮临时验收账号活动数量0，首次隔离草稿已停用且从未发布。服务处理/报告重试/内容发布未在公网重复操作，不能把历史验收当作本轮证据。完整问题、源码位置、复现步骤和边界见[独立验收报告](deploy/OPS_INDEPENDENT_REVIEW_20260912.md)，日志位于deploy/evidence/review-v0.3.2/。修复上述阻塞前不应标记正式运营交付通过。


## 运营后台 v0.3.3：修复独立验收问题并重新交付（2026-09-13 14:45）

**最新有效状态**：针对[独立验收报告](deploy/OPS_INDEPENDENT_REVIEW_20260912.md)的问题全部修复并重新交付。版本/镜像/分支/标签/发布包统一 **0.3.3**，分支`codex/release-v0.3.3`，标签`v0.3.3`（指向 `ee82706`，与发布包 `RELEASE.json` 一致），远端目录`/home/tigery/services/dingdong/releases/dingdong-v0.3.3`，`.env`密钥与数据卷沿用（已校验一致），`APP_VERSION=0.3.3`。公网地址不变：家长端 http://110.42.225.196/dingdong/ ，运营后台 http://110.42.225.196/ops/ 。部署前已备份数据库 `dingdong-pre-v0.3.3-20260913-062741.sql.gz`。

**发布包**：`dist/dingdong-v0.3.3.tar.gz`，sha256 `4f0aa2d87d4ddcce3240f4eff39bbb0c78f424c2f8dc75ef009f7c7c88694df8`，`RELEASE.json` 记录提交 `ee82706`；103 个 `.py`、0 语法错误、无 `.env`/evidence/backend docs 泄漏。**注意**：首个修复提交 `204740d` 的包内 `ops-public.spec.js` 是验收前的旧版（缺 `SERVICE_QUERY` 与三项新用例），因此已在提交文档后从 `ee82706` 重新打包并把标签前移到 `ee82706`；两次提交间**可部署代码零差异**（仅文档+验收脚本+证据），镜像字节一致，远端只做了覆盖解包、未重建镜像、未重启容器。运营后台容器仍为 `dingdong-backend:0.3.3` / `dingdong-web:0.3.3`，内网入口绑定 `100.115.66.119:18080`（不是 `127.0.0.1`）。

**五项修复**：

- **P1 静默覆盖 → 修订号乐观并发**。题库/活动/儿童档案写入引入 `revision`：服务端在事务内 `select_for_update` 后比较客户端携带的修订号，不一致返回 `409 EDIT_CONFLICT` 并附服务端当前内容、**不落库**；缺失或非法修订号返回 `422`。前端保留运营输入，提供"查看差异 / 加载最新版本 / 用我的内容覆盖"三路径，不自动重试、不丢输入。新增迁移 `core.0007`：为 `QuestionnaireVersion`、`ActivityContentVersion`、`Child` 增加 `revision` 与 `create_request_key`（可空），**只加不删**。
- **P1 首页审计越权 → 服务端裁剪**。`ops/services.py` 的 `dashboard_data(user)` 按 `has_permission(user, "audit.view")` 裁剪 metrics/counters/recent_audit，无权限角色首页不渲染"最近操作"区块，审计页仍 403。
- **P2 非法日期 500 → 参数校验**。新增 `parse_date_filter`（严格 `YYYY-MM-DD`，`DATE_PATTERN`）/`parse_date_range`/`parse_keyword`/`parse_int`；非法值返回中文提示并在页面保留原输入。
- **P2 免技术标识 → 服务端生成**。`generated_code`（`slugify`+sha1 截断）、`next_version`（锁内递增）、`lock_code`（`pg_advisory_xact_lock`）、`request_key`（幂等键）。同一标题归为同一内容的新版本并给出提示；`code`/`version` 仅作为脚本可选参数保留，页面不提供输入。
- **验收脚本稳定化**。`ops-public.spec.js` 改用 `data-ops-ready` 就绪信号替代脆弱的 `window.Ops` 即时断言；新增冲突/越权/非法日期三项用例；服务事项用例只处理 `DD_OPS_SERVICE_QUERY` 指定的隔离合成事项，避免触碰既有运营数据。

**关键坑（新会话仍需警惕）**：仓库曾有 15 处/11 文件写成 Python 2 风格的 `except A, B:`，使模块无法导入，却被 mtime/size 恰好一致的陈旧 `.pyc` 掩盖。遇到莫名的模块导入失败，先做全仓库 AST 语法校验再怀疑别的。

**验收证据**（目录 `deploy/evidence/v0.3.3/`）：后端 [201 项](deploy/evidence/v0.3.3/backend-green.txt)、[部署配置 8 项](deploy/evidence/v0.3.3/deploy-config.txt)、[ruff](deploy/evidence/v0.3.3/ruff.txt)、[公网浏览器 19 通过/0 失败](deploy/evidence/v0.3.3/public-browser.txt)、[公网入口与版本](deploy/evidence/v0.3.3/public-entry.txt)、[发布包完整性](deploy/evidence/v0.3.3/package-integrity.txt)。真实链路：报告任务 `63070570-3d2f-40d6-9d4f-fd7a79166608` 前 5 次 `RENDER_FAILED` 进入失败态，运营经公网手动重试第 6 次 succeeded 并产出真实 `ReportVersion`；隔离服务事项 `fb8373aa-...` 标记 completed 并留审计；隔离儿童 `380eaad6-...` 状态 active。详见[公网交付与验收 v0.3.3](deploy/OPS_CONSOLE_DEPLOYMENT_20260913.md)。

**验收后清理**：本轮公网验收创建的内容经真实 `/ops/api/.../retire` 接口停用（题库发布版 `67a5bef4`、复制草稿 `16b78506`、冲突草稿 `d119037a`、活动发布版 `c0bd3ab5`），留审计；3 个临时账号 `acpt0333_admin/operator/content` 已停用并验证无法登录；凭据只存在于临时文件，未入仓库、证据或本记忆。业务数据量未变（qn=9/act=12/child=22/audit=185）。

**剩余限制**：演示供应商边界未变（固定验证码 `00000`、fixture 集成、不接真实供应商、不采集真实指纹）；专业量表题量与评分解释仍待甲方确认；未做真实手机硬件验收；运营账号不做数据分片；未验证的外部条件与 v0.3.2 相同。

**回滚**：见[回滚说明](deploy/ROLLBACK.md)。常规回滚目标是 **v0.3.2**（v0.3.3 之前的可用发布）；**不要回滚到 v0.3.0 或 v0.3.1**（前者 Docker 下 `/ops/` 打不开，后者管理员按钮 403）。`0006`/`0007` 迁移可安全保留，无需反向迁移。


## v0.3.3 第二轮独立验收（2026-09-13）：暂不通过正式交付

本轮源码HEAD 3aaeeb7、线上镜像0.3.3。已实测上轮题库双页面冲突、首页审计权限、日期错误提示和移除技术输入修复有效；公网只读真实Chrome8项通过，无重试，原有后端201项和部署8项重新通过。

补查两项P1仍存在：家长PATCH儿童资料不递增revision，运营旧页面仍以旧revision保存成功覆盖家长修改；有英文前缀的不同中文标题生成相同code，误作同内容不同版本，隔离测试确认发布第二份使第一份retired。两项新增预期断言均失败，有原始复现脚本和日志。

正式交付结论以本次[第二轮独立验收报告](deploy/OPS_INDEPENDENT_REVIEW_20260913.md)为准，不能继续引用上一节“全部修复”作为最新结论。本轮未改功能或部署；公网临时账号及隔离题库草稿已停用，草稿未发布，未修改既有家庭与服务数据。证据deploy/evidence/review-v0.3.3/。


## 运营后台 v0.3.4：修复第二轮验收的两个 P1 并重新交付（2026-09-13 19:20）

**最新有效状态**：v0.3.3 第二轮独立验收的两个 P1 已修复并重新交付。版本/镜像/分支/标签/发布包统一 **0.3.4**，分支`codex/release-v0.3.4`，远端目录`/home/tigery/services/dingdong/releases/dingdong-v0.3.4`，`.env`密钥与数据卷沿用（仅改 `APP_VERSION=0.3.4`，已逐项核对），镜像`dingdong-backend:0.3.4`/`dingdong-web:0.3.4`，容器`RestartCount=0`。公网地址不变：家长端 http://110.42.225.196/dingdong/ ，运营后台 http://110.42.225.196/ops/ 。部署前已备份数据库 `dingdong-pre-v0.3.4-20260913-112015.sql.gz`，sha256 `f6b23b15259705d14a422d24d06815f9892ca0d349f3a8c24908039aead08194`。

**发布包**：`dist/dingdong-v0.3.4.tar.gz`，sha256 `95f59ba9a738060ab3702cfc22367a99036338888444a91bd0c5f31d81fb8907`，`RELEASE.json` 记录提交 `ee7a453`（标签 `v0.3.4` 同指该提交）；107 个 `.py`、0 语法错误、无 `.env`/evidence/backend docs 泄漏。**注意（打包顺序坑）**：`deploy/` 下的交付文档属于打包范围，**打包之后再改它就等于包内容 ≠ 提交内容**。本版因此打了三次包（`aee4066` → 交付文档 → `9717702` → 再补文档 → `ee7a453`），最终把文档定稿提交、标签移到该提交、再从该提交打包；此后只改包外文件（`deploy/evidence/**`、`PROJECT_MEMORY.md`、文档索引）。`aee4066` 与 `ee7a453` 之间**可部署代码零差异**，镜像字节一致，远端只做覆盖解包、未重建镜像、未重启容器。详见`deploy/evidence/v0.3.4/package-integrity.txt`。远端 compose 工作目录是 `/home/tigery/services/dingdong/releases/dingdong-v0.3.4/deploy`（不是 `/home/tigery/services/dingdong/deploy`），`deploy/.env` 就在该目录下、权限 600、不在包内。**本版无数据库迁移变更**（复用 `0007`）。

**三项修复**：

- **P1-A 儿童档案修订号只在运营端前进**。此前家长 `PATCH /api/v1/children/<id>` 不递增 `revision`，家长改档后运营手里那份旧页面仍能保存成功并静默覆盖。现在家长端 `PATCH`（`core/api/children.py`）与 Django 技术后台 `DraftContentAdmin.save_model`（`core/admin.py`）都推进修订号；家长端请求体的 `revision` 为可选字段，带了且不一致返回 `409 EDIT_CONFLICT` 且**不落库**。`inputs.py` 拆出 `ChildBaseInput`，`ChildCreate` 不受影响。前端 `app.js` 编辑档案带 `revision`，409 后读回最新档案并明确告知本次未保存。
- **P1-B 不同标题退化成同一内部标识**。`generated_code` 用 `slugify` 派生后按长度截断，**摘要被截掉**，"ABC 观察"/"ABC 绘画"得到同一个 `code`，被当成同一内容的不同版本，发布一份会停用另一份。现在 `_fit_code` **始终保留标题 sha1 摘要**（`_title_digest` 前 12 位，`CODE_LIMIT=48`），并新增 `unique_code` 在 `pg_advisory_xact_lock` 内取唯一标识、撞号加 `-2/-3` 后缀。**每次新建都是独立内容**；只有版本页"复制为新版本"才构成同一内容的版本序列。历史脏数据只读审计确认仅 `qn-abc-mtzoqmm9`（v1/v2 均 retired、从未发布、无引用），不做批量重算。
- **修复中发现的独立缺陷（真实浏览器暴露）**：家长端 409 恢复路径要读 `GET /api/v1/children/<id>`，而该端点**只注册了 `PATCH`**，必然 405，冲突提示成了死路。`child_detail` 已改为 `@endpoint(["GET","PATCH"])` 并实现 `GET`（按家庭隔离、需登录、返回含 `revision` 的序列化儿童）。**操作数 50 → 51**，同步 `设计/API/openapi.json` 与契约断言。

**关键坑（新会话仍需警惕）**：`ruff format --target-version py314`（0.16.7，当前最新）会把合法的 `except (A, B):` 改写成 Python 2 语法的 `except A, B:`，**改完文件无法导入**。复核格式必须显式加 `--target-version py313`；py314 下有 9 个文件属该误报，不要动。

**验收证据**（目录 `deploy/evidence/v0.3.4/`）：后端 [237 项](deploy/evidence/v0.3.4/backend-green.txt)、[部署配置 8 项](deploy/evidence/v0.3.4/deploy-config.txt)、[ruff](deploy/evidence/v0.3.4/ruff.txt)、[前端 check](deploy/evidence/v0.3.4/frontend-check.txt)、[前端单测 3 项](deploy/evidence/v0.3.4/frontend-unit.txt)、[公网浏览器 23 通过/13 跳过/0 失败](deploy/evidence/v0.3.4/public-browser.txt)、[隔离验收数据](deploy/evidence/v0.3.4/isolated-data.json)、[本地部署前浏览器验收](deploy/evidence/review-v0.3.4/)。真实链路：失败报告任务 `9557b88a-7736-4aec-8988-4d05ca05e481` 前 5 次 `RENDER_FAILED`，公网手动重试第 6 次 succeeded，`ReportVersion` 3→4；隔离伙伴关联 `a92d58b7-089f-49ea-8df5-8801a4567ec5` 为 verified；隔离服务事项 `81d8ac36-6b5e-4adc-9378-241203c26f7d` 闭环。新增 P1 专项用例 `frontend/deployment-tests/ops-p1-acceptance.spec.js`（6 项）。详见[公网交付与验收 v0.3.4](deploy/OPS_CONSOLE_DEPLOYMENT_20260913_V034.md)。

**本地与公网的差异（不要误判为缺陷）**：`ops-public.spec.js` 本地 20 通过/1 失败/1 跳过——失败项是"报告"用例，原因是本地 `compose up` 会重新 seed，`ReportVersion` 与 `BackgroundJob` 均为 0，报告列表无行可看，属环境数据为空；同在公网通过。`http-profile.spec.js` 本地跑不了：它断言 `window.isSecureContext === false`，而 Chromium 把 `127.0.0.1` 视为安全上下文，只有真实 HTTP 公网入口成立。

**验收后清理**：公网与本地均按"只做状态变更、不物理删除、补写审计"执行，脚本与前后数字见[清理记录](deploy/evidence/v0.3.4/acceptance-cleanup.md)。公网：正常家庭 38→10、在册儿童 31→3、已发布题库 10→2、已发布活动 13→8、启用工作人员 4→1、审计 339→419；关闭 28 个测试家庭（含历史 `HTTP兼容验收`×20）、归档 28 个儿童、停用 21 个题库/活动版本、停用 31 个账号（`acpt034_*` + 28 个测试家长）。本地：正常家庭 15→2、在册儿童 14→2、停用 46 个版本、停用 16 个账号（`local-accept-*` + 13 个测试家长）。清理复用既有审计动作码（`questionnaire.retire`/`activity.retire`/`child.profile_update`/`staff.status`/`family.freeze`）并写明 `reason`，**未引入未翻译的新动作码**。清理后两组入口复验仍全部 200。**测试家庭仍可在运营端"家庭查询"里检索到（儿童显示"已归档"）**，这是保留可追溯性的刻意取舍。

**剩余限制**：演示供应商边界未变（固定验证码 `00000`、fixture 集成、不接真实供应商、不采集真实指纹）；专业量表题量与评分解释仍待甲方确认；未做真实手机硬件验收；运营账号不做数据分片。本地/公网的运营后台验收账号已全部停用，重跑需先重建。

**回滚**：见[回滚说明](deploy/ROLLBACK.md)。常规回滚目标是 **v0.3.4**（v0.3.5 之前的可用发布）；**不要回滚到 v0.3.0 或 v0.3.1**（前者 Docker 下 `/ops/` 打不开，后者管理员按钮 403），也**不要回滚到 v0.3.2 及更早**（会同时丢掉并发保护与内容标识修复）。`0006`/`0007` 迁移可安全保留，无需反向迁移；v0.3.5 无新迁移。


## v0.3.4 第三轮独立验收（2026-09-14）

前两轮P1已通过独立复验：原有后端237项、上轮独立复现2项、部署8项通过；公网只读Chrome8项及家长/运营跨入口2项通过。本轮首次并行pytest争用测试库出现建库错误，串行重测通过，保留原日志。

尚有P2：家长409后app.js调用editChild(latest)自动换掉表单，丢弃未保存输入；测试名“保留输入”实际断言被替换为服务器值。可进入受控运营试用，但完整交付仍需补齐此恢复交互及正确断言。见[第三轮独立验收](deploy/OPS_INDEPENDENT_REVIEW_20260914.md)。本轮未修改功能与线上版本，临时账号、隔离草稿与新建测试家庭儿童已完成定向停用/归档，未修改其他业务数据。


## v0.3.5：家长端档案冲突保留输入并提供可恢复路径（2026-09-14）

**修复的 P2**：家长编辑儿童档案被 `409 EDIT_CONFLICT` 挡下后，`frontend/app.js` 的 `editChild` 立即 `GET` 最新档案并 `editChild(latest)` **重建整个表单**，家长刚填写的称呼/性别/生日被服务端值替换。服务端保护有效（数据没被覆盖），但这次填写被静默丢弃，家长没有选择机会。

**修复**（`frontend/app.js`，无后端改动、无迁移）：
- 命中 `409` **不重建表单**：三个可编辑字段原样留在输入框，只渲染独立的冲突提示区 `#child-conflict`（`renderChildConflict` 只改面板、绝不碰输入框）。
- 提示用家长语言（"资料已被更新，本次修改没有保存……"），**不出现 409 / revision / 修订号 / 数据库**。
- **三条显式路径**：查看最新资料（`childConflictView`，只读并排 `table.conflict-diff` 对比）、载入最新资料（`childConflictLoadLatest`，二次确认"无法找回"后才 `childEditFill` 替换并推进基准修订号）、用我的修改保存（`childConflictAskApply` 先展示、`childConflictApplyMine` 以**家长看到的那一版** `childEdit.latest.revision` 为基准提交，期间再被改过会**再次冲突**，不静默覆盖）。
- 读取失败/断网/登录失效（`0/401/403/404`）：`conflictReadMessage` 给中文提示，**不清空输入、不显示保存成功**；冲突未处理点"关闭"先确认（`prompt="close"`）；保存成功或关闭时清空 `childEdit` 会话，避免过期修订号复用。
- 编辑会话状态挂在模块级 `childEdit` 对象上；`stopWork()` 关闭对话框时一并重置。

**测试修正（TDD）**：先写失败用例，在 v0.3.4 旧代码上确有多项失败（日志 `deploy/evidence/v0.3.5/pre-fix-local-browser-failures.txt`）。新增 `frontend/deployment-tests/parent-conflict-recovery.spec.js`（5 项，真实入口不拦 API）：字段保留且服务端未被覆盖 / 查看与取消不丢输入 + 明确确认才替换 + 在最新修订上保存成功 / 恢复期间再次冲突 / 读取失败不清空（唯一人为模拟是 `page.route` 让单个 GET 返回 503）/ 窄屏同一流程。原 `ops-p1-acceptance.spec.js` 中名实不符的"保留输入"用例改为只断言**服务端保留运营的值**；两份 spec 共用辅助抽到 `deployment-tests/helpers.js`。

**部署**：tigery `/home/tigery/services/dingdong/releases/dingdong-v0.3.5`，镜像 `dingdong-backend:0.3.5` / `dingdong-web:0.3.5`，compose 项目名仍为 `dingdong-demo`（数据卷沿用），`.env` 仅改 `APP_VERSION=0.3.5`。部署前备份 `dingdong-pre-v0.3.5-20260914-092110.sql.gz`（sha256 `d912b5ff…`）。镜像摘要：backend `00d747a0edbc…`、web `d01b4f95f37e…`。公网 `/dingdong/ /ops/login/ /admin/login/ /api/v1/runtime` 与 Tailscale `100.115.66.119:18080` 的 `/ /ops/login/ /api/v1/runtime` 全部 200，`version.txt`=`0.3.5`，公网 `app.js` 含新冲突代码（`child-conflict` 15 处）。

**验收证据**（`deploy/evidence/v0.3.5/`）：[后端 237](deploy/evidence/v0.3.5/backend.txt)、[部署配置 8](deploy/evidence/v0.3.5/deploy-config.txt)、[ruff](deploy/evidence/v0.3.5/ruff.txt)、[文档校验 0 错误](deploy/evidence/v0.3.5/doc-audit.json)、[前端 check](deploy/evidence/v0.3.5/frontend-check.txt)、[前端单测 3](deploy/evidence/v0.3.5/frontend-unit.txt)、[公网冲突恢复+P1 11 通过/11 跳过/0 失败](deploy/evidence/v0.3.5/public-browser-conflict-recovery.txt)、[公网运营后台 15 通过/7 跳过/0 失败](deploy/evidence/v0.3.5/public-browser-ops-public.txt)、[隔离验收数据](deploy/evidence/v0.3.5/isolated-data.json)、[验收后清理](deploy/evidence/v0.3.5/acceptance-cleanup.md)。真实链路：隔离家庭 `P2验收隔离儿童093012`（`ab2ceea1…`）经真实家长 API 建立，注入 fixture 后 Worker 真的跑出失败任务 `273a7d16-d8d9-4ac8-a7e9-f72ceb9bf583`（report/RENDER_FAILED）并被公网重试；隔离服务事项 `0a63c972…` 闭环。详见[交付与验收 v0.3.5](deploy/PARENT_CONFLICT_RECOVERY_20260914.md)。

**本地与公网的差异（不要误判为缺陷）**：`ops-public.spec.js` 本地 13 通过/1 失败/8 跳过——失败是"报告"用例，本地库没有失败任务，公网注入真实失败任务后通过。`tests/flows.spec.js` 本地 5 通过/3 失败，属**本地测试环境问题**：该 spec 用 `npm run dev`（`server.cjs` 代理到 `127.0.0.1:8017`）访问后端，而用例内部的 `inject_fixture` 走 `uv run manage.py`，两者连的是**不同的本地数据库**，因此注入报 "Child does not exist"；不在本轮回归基线内，不计为 v0.3.5 通过。

**验收后清理**：只做状态变更、不物理删除、补写审计，脚本 `deploy/evidence/v0.3.5/cleanup-acceptance-data.py`（显式名单：儿童按 `冲突保留*/P1跨入口*/P2验收隔离儿童*/独立复验*` 前缀、内容按逐条 `code+version`、工作人员按 `acpt035_` 前缀）。公网：正常家庭 19→10、在册儿童 12→3、已发布题库 9→2、已发布活动 12→8、启用工作人员 4→1、审计 583→619；关闭 9 个测试家庭、归档 9 个儿童、停用 11 个题库版本 + 4 个活动版本 + 12 个账号（`acpt035_*` + 9 个测试家长），新增审计 36 条。**更早轮次的历史测试家庭（`HTTP兼容验收` 等）本轮未动**。清理后两组入口复验仍全部 200。


## v0.3.5 第四轮独立验收：遗留P2通过（2026-09-14）

本轮源码HEAD b322b2d，线上镜像0.3.5，服务健康。真实公网Chrome冲突恢复5项通过、5项视口分工跳过、0失败，无重试；确实验证输入保留、取消、明确加载、再次冲突与恢复保存、窄屏。读取失败一项为GET注入503的可控测试，不代表公网故障。后端237项、部署8项、前端单测3项及语法检查通过。

第三轮P2闭环，本次修复范围未发现新阻塞，可以进入运营演示试用；不等于真实供应商生产接入或本轮重跑所有历史流程。详见[第四轮独立验收](deploy/OPS_INDEPENDENT_REVIEW_20260914_V035.md)。本轮未改功能或部署，临时测试账号及本轮唯一前缀的家庭儿童已定向停用/归档，不改历史业务对象。


## 内置浏览器演示待续（2026-09-14）

用户要求部署后用browser use控制内置浏览器逐项测试并展示记录。已在tigery重新执行现有0.3.5 Compose部署收敛命令并核验运行正常；无代码改动。内置浏览器创建tab和getState各超时30秒，open_in_codex返回queued，尚未开始交互演示。不能把上一轮外部Chrome测试算作此次内置浏览器验收。记录与待执行清单见[内置浏览器演示记录](deploy/INNER_BROWSER_DEMO_20260914.md)。恢复控制连接后从登录开始逐项执行，截图仅用隔离合成数据。


## v0.3.6：运营后台界面改版（2026-09-14）

本轮把运营后台从"29 个模板各写各的样式、原生控件与手写卡片混用"统一到一套组件体系，并修掉"改完看不见效果"的真实原因。**不改后端业务逻辑、家长端交互与数据库结构（迁移仍停在 `0007`）**。交付说明 [deploy/OPS_CONSOLE_UI_20260914_V036.md](deploy/OPS_CONSOLE_UI_20260914_V036.md)。

**界面层**：固定版本取回 `@tabler/core` 1.5.1 与 `@tabler/icons-webfont` 3.46.0 落到 `backend/dingdong_ca/ops/static/ops/vendor/`，随镜像交付、不引用公网 CDN（Tabler 产物已内含它依赖的 Bootstrap 5.3 全部组件样式与 JS）。三层职责与维护约定见 [ops/README.md](backend/dingdong_ca/ops/README.md)：`vendor/` 不改、`ops.css` 改令牌与外壳、通用组件外观只改 `--tblr-*` 变量；**不要再引入 Bootstrap 官方 CSS/JS**。`base.html` 重建为「侧栏 + 吸顶顶栏 + 面包屑 + 页脚」外壳，25 个页面（含 403/404）统一继承；新增 `ops/context.py`、`ops/_empty.html`；导航补图标（`NAVIGATION` 四元组 → 五元组）。类名约定：无前缀 = Tabler/Bootstrap，`ops-` = 叮咚自定义；`.question-card` / `.step-card` / `.option-row` / `.kv` / `.timeline` 被验收脚本按名字引用，改名要同步改测试。

**缓存击穿（部署配置变更）**：`collectstatic` 用 Django 默认存储，静态 URL 不带内容哈希，`/static/ops/ops.css` 改版前后同址，浏览器会继续用旧文件。现所有静态资源拼 `?v={{ ops_asset_version }}`。`deploy/compose.yml` 新增**必填** `APP_VERSION: ${APP_VERSION:?set APP_VERSION}`（缺了直接启动失败，不是静默降级），页脚也显示它——**现场判断浏览器加载的是不是新界面就看页脚版本号**。`ASSET_VERSION` 在模块导入时求值，改 `APP_VERSION` 必须重建容器。本地 `deploy/.env` 也要有 `APP_VERSION`，否则本地 compose 起不来。

**明文入口 COOP 静音（部署配置变更，本轮新发现）**：Django 的 `SecurityMiddleware` 默认发 `Cross-Origin-Opener-Policy: same-origin` 且不看协议，而 Chrome 只在可信源（https / localhost）认可它——公网明文入口因此**每个页面控制台都有一条错误**。本地用 `127.0.0.1` 调试看不到，所以一直没被发现。现 `deployment.py` 按 scheme 决定：纯 HTTP 设为 `None`，切 https 自动恢复。先写测试再改实现（部署层 8 → 9 项）。

**新增工具** `frontend/tools/`：`ops-page-audit.mjs` 逐页体检（25 个页面 + 窄屏，输出结构与错误计数、`report.json`）、`ops-quick-shots.mjs` 快速截图、`README.md`（与其它测试的分工）。`.dockerignore` 不放行该目录，不会进镜像。**判读要点：`裸控件`（没有 `form-control`/`form-select`/`form-check-input` 类的 input/select/textarea）应为 0。**

**验证**：后端 237、部署层 9、前端 check 与单测 3、本地浏览器 8 项通过；**公网真实 Chrome 26 通过 / 18 跳过 / 0 失败**（冲突恢复 5+5、P1 专项 6+6、运营后台回归 15+7，跳过均为桌面/窄屏视口分工）。**逐页体检 25 个页面全部通过，"裸控件"由改版前 67 个（18/25 个页面）降为 0**；对照方式是同一套演示数据分别由 v0.3.5 源码（`git worktree`，端口 8018）与工作区源码（端口 8017）渲染，差异只可能来自界面代码。改版前后各 22 张整页截图留档在 `frontend/docs/ops-before-v0.3.6/` 与 `frontend/docs/ops/`（文件名一一对应；`docs/` 不进包，也按本仓库惯例不进 git）。

**测试修正**：`frontend/tests/ops-console.spec.js` 的题库与活动两例引用了 v0.3.3/v0.3.4 就已删除的 `#new-code` / `#new-version`（该 spec 最后修改于 v0.3.0），一直失败。本轮只改步骤、业务断言全部保留。

**部署**：tigery `/home/tigery/services/dingdong/releases/dingdong-v0.3.6`，镜像 `dingdong-backend:0.3.6` / `dingdong-web:0.3.6`，compose 项目名仍为 `dingdong-demo`（数据卷沿用），`.env` 仅改 `APP_VERSION=0.3.6`。部署前备份 `dingdong-pre-v0.3.6-20260914-055438.sql.gz`（sha256 `11d25d793cad…`，`gzip -t` 通过）。公网 `/dingdong/ /dingdong/version.txt /ops/login/ /admin/login/ /api/v1/runtime` 与内网 `/ /ops/login/ /api/v1/runtime` 全部 200，`RestartCount=0`；公网 `/ops/login/` 的静态资源为 `?v=0.3.6`，vendor 四个资源（tabler.min.css 693779B、tabler-icons.min.css 211022B、tabler-icons.woff2 462200B、ops.js 19971B）均 200。

**验收数据与清理**（`deploy/evidence/v0.3.6/`）：[逐页体检改版前](deploy/evidence/v0.3.6/page-audit-before.txt) / [改版后](deploy/evidence/v0.3.6/page-audit-after.txt) / [公网](deploy/evidence/v0.3.6/page-audit-public.txt)、[公网冲突恢复](deploy/evidence/v0.3.6/public-browser-parent-conflict-recovery.txt)、[P1 专项](deploy/evidence/v0.3.6/public-browser-ops-p1-acceptance.txt)、[运营后台回归](deploy/evidence/v0.3.6/public-browser-ops-public.txt)、[清理运行结果](deploy/evidence/v0.3.6/cleanup-run.txt)、[发布标识与版本一致性](deploy/evidence/v0.3.6/deploy-config.txt)。真实链路：隔离家庭 `界面验收隔离儿童135848`（`c1448b6f…`）经真实家长 API 建立，注入 fixture 后 Worker 真的跑出失败任务 `31656a19-0130-44c6-bd42-1b2e4899a36b`（report/RENDER_FAILED）并被公网重试；隔离服务事项 `13d7c1e5…` 闭环。临时运营账号 `acpt036_{admin,operator,content}`。

清理沿用"只做状态变更、不物理删除、补写审计"：**在册家庭 25→10、在册儿童 18→3、已发布题库 8→2、已发布活动 11→8、启用工作人员 4→1、启用家长 25→10、审计 765→809**；归档 15 个儿童、关闭 15 个家庭、退役 8 个题库版本 + 3 个活动版本、停用 18 个账号。清理后两个入口复验仍全部 200。**更早轮次的历史测试数据本轮未动。** 清理脚本不再硬编码儿童 UUID，按称呼前缀 + "仍未归档"判定，内容按逐条 `code+version`。

**本轮新踩的两个坑（下一轮直接照做）**：
- 凭据文件用 `source /tmp/dd-ops-creds.env` 读进来只是 **shell 变量**，Playwright 的 worker 子进程看不到，于是所有用例在 `fill` 处报 `value: expected string, got undefined`（表现为 25 项全失败，极易误判成界面坏了）。必须 `set -a; source 文件; set +a`，或把 `export` 写进文件。
- 在容器里**按路径执行**脚本（`python /tmp/x.py`）时 `sys.path[0]` 是脚本所在目录，而容器里 `config` 包只在 `/app`，会报 `ModuleNotFoundError: No module named 'config'`。加 `-w /app -e PYTHONPATH=/app`。脚本若自己要 import Django 模型，需自带 `django.setup()` 引导（`cleanup-acceptance-data.py` 已加）。

**未做/受限**：本轮**尚无独立第三方审计**（v0.3.3/v0.3.4/v0.3.5 各有独立验收报告）；公网仍是**明文 HTTP**（HTTPS 未启用，`*_COOKIE_SECURE` 为 False；切 https 需重新验收）；移动端只验到 390×844；"裸控件 = 0"是结构指标，不等于逐像素审美验收。


## v0.3.6 界面独立抽验（2026-09-14）

本轮HEAD 40382c9，线上0.3.6健康。确认实际本地化Tabler组件接入；真实Chrome登录/表单页面桌面及390px窄屏截图人工检查，层级及控件统一、无整页溢出、无脚本错误。公网基础只读交互回归8项通过（56.9秒），部署配置9项通过。未重跑所有25页面与全部业务写操作，不把历史交付数字算作本轮。

本轮界面抽查及基础功能通过；内置浏览器创建tab仍超时，用户要求的内置浏览器逐项演示尚未完成。报告及截图：[界面独立验收](deploy/OPS_UI_INDEPENDENT_REVIEW_20260914.md)。本轮无代码和部署改动，临时工作人员已停用，无家庭业务资料修改。


## v0.3.6 全量功能验收（2026-09-15，逐项演示）

按运营实际工作流把后台每个功能真的走一遍（13 项：登录/退出、首页导航、家庭与儿童、跨入口冲突恢复、题库全流程、活动全流程、内容独立性、报告与失败任务重试、服务事项、账号权限、审计、通用交互与视觉、家长端回归）。**线上仍是 0.3.6，本轮没有发现产品缺陷，因此未改运行代码、未发新版、未改迁移（仍 0007）。**

**结论与证据**：[逐项演示记录](deploy/OPS_FULL_ACCEPTANCE_20260915.md)；真实 Chrome（Playwright `channel: chrome`）打公网入口，`14 passed / 12 skipped / 0 failed`（跳过全是桌面/窄屏视口分工）；逐项 `操作—预期—实际` 在 [tour-log.jsonl](deploy/evidence/acceptance-round-20260915/tour-log.jsonl)（31 行全 ok），关键截图 44 张在 `deploy/evidence/acceptance-round-20260915/shots/`；脚本 `frontend/deployment-tests/ops-demo-tour.spec.js`（新增，未跟踪）。既有公网回归同时复跑：`parent-conflict-recovery + ops-p1-acceptance` = **11 passed / 11 skipped / 0 failed**（[public-browser-regression.txt](deploy/evidence/acceptance-round-20260915/public-browser-regression.txt)）。

**内置浏览器逐项演示 = 未完成（工具阻塞，必须如实保留）**：本会话 `cua.createBrowserTab` / `cua.getState` / `open_in_codex` 均为 **"is not available in the current environment"（工具未注册）**，与前几轮的"调用超时/返回 queued"不同。已按用户要求只做有限次尝试、未反复重试；原始记录 [inner-browser-probe.txt](deploy/evidence/acceptance-round-20260915/inner-browser-probe.txt)。**所有截图来自真实 Chrome，明确标注为外部 Chrome，没有冒充内置浏览器演示；该交付项不以外部 Chrome 或历史结果替代后宣布完成。**

**本轮测试修正（都是新写脚本自身的问题，非产品缺陷，全部处理并复验）**：报告页按钮是"查询"不是"筛选"；新建账号后落在**详情页**而非列表且列表分页（改用 `?q=` 搜索定位）；审计非法日期断言拿到 403 是因为脚本当时还是 `content` 会话（该角色无 `audit.view`）——**这个 403 恰好证明权限拦截在服务端生效**；404 断言用正文精确文案"没有找到这条记录"（面包屑另有措辞）；家长端窄屏侧栏隐藏，改为等 `#main[aria-busy!=true]`；确认弹窗截图要选**他人**账号行（自己那行没有"停用自己"按钮）。**失败任务只能重试一次、服务事项只能处理一次是一次性状态变更**，整轮重跑必须重新准备隔离对象（本轮共备 3 份）。

**测试数据与清理**：隔离对象用真实家长 API 建（前缀 `演示验收儿童*`）+ 容器内 `inject_fixture --scenario report_retry` 注入失败任务 + 真实 API 提交 support 服务事项；临时账号 `acptdemo_admin/operator/content` 与演示中新建的 `acptdemo_tmp*`。清单与脚本在 `deploy/evidence/acceptance-round-20260915/`（`prepare-accounts.py` / `prepare-data.py` / `probe-acceptance-data.py` / `cleanup-acceptance-data.py`）。清理沿用"只做状态变更、不物理删除、补写审计"（[cleanup-run.txt](deploy/evidence/acceptance-round-20260915/cleanup-run.txt)）：**在册家庭 21→10、在册儿童 14→3、已发布题库 19→2、已发布活动 11→8、启用工作人员 8→1、启用家长 21→10**，精确回到稳态基线（家庭 10 / 儿童 `合成儿童1`·`合成儿童2`·`小易` / 题库 `exploration`·`initial-assessment` / 活动 `test-activity-0..7` / 工作人员 `dingdong_admin` / 家长 10）。状态变更明细：儿童归档 11、家庭关闭 11、题库退役 17、活动退役 3、账号停用 18、补写审计 49（1117→1166，未删记录）。清理前计数减本轮新增量逐项等于基线 → **本轮新增对象已全部识别、无漏项**；清理后公网 `/ops/` 302、`/dingdong/` 200、`/admin/` 302，服务正常。真实家庭与更早轮次历史数据未动。

**未做/受限**：内置浏览器逐项演示（见上）；本轮不重跑后端 237 项与部署层 9 项（无运行代码改动，不记作本轮新通过）；公网仍明文 HTTP；移动端只验到 390×844。


## CA 对接文档 V1.0 到货（2026-09-16，仅分析未动代码）

**用户决定一：全部约束遵循新的对接文档**（2026-09-16）。
**用户决定二：我们是 CA 侧**（2026-09-16 用户更正「我们是CA侧」）。→ DingDong 是提供 Data Service 的对接方；文档里的 8 个 `/api/v1/ca/*` 是**我们要发起的调用**，7 个实体是**对方的数据模型**，`growth_v1`/`pw_v1` **由对方定义、我们只消费**。判定依据：文档表 12「**CA Backend** 请求头携带 `X-API-Key`」、表 13「**CA** 建议处理」、表 14「**CA 开发验收清单**」、第 11 章「**CA 侧**最小实现范围」；仓库侧 `ExternalAssociation.provider="dingdong"`、一期 P0-04「把画像发送给 DingDong」、前端是 CA 的 TalentRadar/CareerAcademy 血统。本文档首节原按 DingDong 立场写的部分已更正。

已记入[已确认约束](需求/后台设计已确认约束.md)首节。**更正后不需要推翻任何既有约束**：「CA 主动获取 DingDong 数据」正是这 8 个接口的落地；「不下发画像/策略/任务」与「不接收推送」仍成立（我们只有 `bind` 与复测回写两个契约内写操作）；demo 边界「探索体验不产出天赋或能力分数」**无需松动**（八维成长代理、`match_score`、`health_score` 全部由对方产出，我们只展示）。指纹不留存、不采年级、`00000` mock 等继续有效。这是**约束层**决定，不等于已定排期或已通过验收。

DingDong 交付的两份对接材料放在 `材料/文档/`（**不在 2026-09-09 那 5 个原始附件内**，到货即只读权限）：

- `DingDong_CA_系统开发文档.docx`（221752B，sha256 `3a717c375245…`）——《DingDong × CA 系统开发接口文档》V1.0（CA 开发对接版），11 章 15 表：系统边界、架构、NFC 绑定、6 实体、字段、REST 清单、时序、复测机制、鉴权与错误码、**CA 开发验收清单**。
- `DingDong_CA_数据库字段与接口.xlsx`（20841B，sha256 `e759a91b91e2…`）——7 表：开发说明、数据库表单、**80 字段定义**、CA查询接口、3 段 JSON 示例、**6 个 mock 账号**、**H01–H07 复测规则 + 5 个可配置参数**。

已归档可检索文本 `材料/可检索文本/DingDong_CA_{系统开发文档,数据库字段与接口}.md`；`材料清单.md` 新增「2026-09-16 新增材料」一节（未改写 09-09 的缺失记录）。完整影响分析见 [`需求/CA对接文档V1.0_影响分析_20260916.md`](需求/CA对接文档V1.0_影响分析_20260916.md)。

**核心结论（只读比对，未改运行代码/未改库/未部署）**：

- **8 个接口全部是我们要发起的出站调用，目前一个都没实现**：`dingdong_ca` 里**没有任何出站 HTTP 客户端**（无 `requests`/`httpx`/`urlopen`），没有 `X-API-Key`，没有 `/api/v1/ca/*` 调用，没有 `{code,message,request_id}` 解析。我们现有的 44 条路径全是**我们自己服务端的** API（以 `child_id` 为键、面向家长端与运营后台）。
- **7 个实体是对方的**：`ca_user_profile` 我们各持一份（字段要按对方口径对齐），`persona_public_view`/`user_persona_binding`/`growth_period`/`persona_health`/`reassessment_event`/`companion_snapshot` **我们只读，不建表、不实现引擎**。全仓检索 `learning_style`/`interest_primary`/persona/growth_period 等**全部无命中**。
- **四个真实缺口（都在我们这一侧）**：① 没有 `ca_account_id`（我们只有 `child_id` 与家长账号）；② **`nfc_token` 全仓零命中**，NFC 入口承接完全缺失；③ 没有 DingDong 客户端；④ 人设 / 15-30 天成长报告 / 健康度四态 / 复测 CTA 与回写四个展示面全无。另有既有 `ExternalAssociation`(`provider="dingdong"`) + `SyncCheckpoint(cursor)` + `ObservationBatch` 这套按一期 P0-04/P0-05 双向设计的老集成层，与新契约（人设/成长/健康度/复测四类聚合结果）的取舍需定。
- **`ca_user_profile` 字段口径不符**：对方要 `learning_style`、`interest_primary/secondary`、8 个 `*_score`、`assessment_time`、`assessment_id`、`profile_version`、`is_current`；我们的 `ProfileSnapshot(child, kind, result JSONB, schema_version, produced_at)` 分数埋在 JSON 里，无 `is_current`、无兴趣/学习风格字段。
- **链路硬要求**：调用对方必须 **HTTPS + `X-API-Key`**，并按文档表 13 处理 7 个业务码（`42901` 延时重试、`40101` 停调告警、`40401` 当"暂无数据"）；绑定与复测回写要带 `request_id` 做幂等。**第一版说"公网明文 HTTP 与 HTTPS 要求硬冲突"是误判**——该条约束的是我们要调用的对方端点，不是我方入口。
- **版本与算法归属（2026-09-16 用户明确「`growth_v1` / `pw_v1` 都由 DingDong 侧定义」）**：`growth_v1`（`growth_period.algorithm_version`）与 `pw_v1`（`persona_public_view.talent_weight_version`）**由对方定义**，我们只消费、存储、展示，**不定义、不实现、不得改名**。人设清单与八维成长代理同样归对方。第一版把它反记成"由我们定义实现"，已更正。
- **两份文档自身有 4 处不一致**：接口 8(docx) vs 7(xlsx，无 account/bind)；实体 6(docx) vs 7(xlsx，多 `companion_snapshot`)；错误码只在 docx；`message` 在 xlsx 示例②③ 缺失。另 xlsx 有 8 处内部问题（7 个 datetime 示例存成 Excel 日期序列号、空值三种写法混用、`interest_*` code 表未定义、表 11 出现 `switch_candidate`/`keep_current` 但表 8 的 `status` 枚举里没有）。**最大缺口：`ca_user_profile` 标着"CA 写入"、表 0 说"DingDong 读取画像进行人设匹配"，但 8 个接口里没有提交画像的接口**，首次测评画像走什么通道没有定义。
- **建议顺序（CA 侧）**：**C0 向 DingDong 提 20 个澄清问题——已完成，清单见 [`需求/CA-DingDong_对接澄清清单_V1.0_20260916.md`](需求/CA-DingDong_对接澄清清单_V1.0_20260916.md)（P0 七项已标优先级、带回复模板与可复制邮件正文，待发出）** → **C1 定 `ca_account_id` 形态——已定案（2026-09-16 用户：「账户级就可以了　一台机器人一个号」），设计见 [`设计/CA对接_C1_ca_account_id设计_20260916.md`](设计/CA对接_C1_ca_account_id设计_20260916.md)：账户级、机器人:号=1:1、`ca_`+26 位 ULID、生成后永不变不回收、跨设备稳定、对外不透明；载体是新表 `CaAccount`（`ca_account_id` / `nfc_token_hash`(不落明文) / `family` / `child` / `status`），因为现有 44 条 API 以 `child_id` 为键而 8 条对外调用以 `ca_account_id` 为键，两键域只能靠这张表建立唯一映射。其中 3 项决定已全部定案（另 2 项同日追加：「**一台机器人服务一个孩子**」→ `child` 必填 FK、账户:孩子=1:1；「**换机发新号**」→ 号码跟机器走不跟孩子走，旧号置 `retired` 归档永不重用，**已知代价是换机后对方侧 `growth_period`/复测事件无法延续、成长报告重新开始**，缓解为换机确认弹窗 + 我方保留旧号只读历史入口 + 旧号永久保留）** → C2 DingDong 客户端（HTTPS + `X-API-Key` + 业务码 + 幂等）→ C3 画像字段对齐与通道 → C4 NFC 承接 → C5 四个展示面 → C6 复测回写闭环 → C7 用 6 个 mock 账号逐条对表 14 的 10 项验收清单。

## C1 `ca_account_id` 落地实现（2026-09-16，用户「你能不能直接干完」）

**已实现的运行代码**（C1 从设计变成可运行系统；`deploy/` 与线上版本**未动**，未部署未发版）：

- 模型与迁移：`backend/dingdong_ca/core/ca_models.py`、`core/migrations/0008_caaccount.py`。两个状态维度刻意分开——`status`(active/retired，我方用不用) 与 `bind_state`(unbound/bound，对方接通没接通)，**不许合并成一句"已绑定"**。四条约束：`ca_account_create_unique`(bound_by+request_key 幂等)、`ca_account_one_active_robot`(nfc_token_hash 条件唯一)、`ca_account_one_active_child`(child 条件唯一)、以及 3 个 check 约束。`nfc_token_hash` **不做无条件唯一**，唯一性挂在 `status='active'` 上。
- 服务层：`core/services/ca_account.py` —— `new_ulid()`（48 位毫秒 + 80 位随机，Crockford Base32，无 I/L/O/U）、`nfc_token_digest()`（HMAC-SHA256，**明文不落库不进日志**）、`token_fingerprint()`（前 8 位给运营比对）、`issue_account()`（锁孩子串行化、按 `(bound_by, request_id)` 幂等、同机复用同号、异机返回 409 `ACCOUNT_REPLACEMENT_REQUIRED`、撞号重试 5 次）、`resolve_account()`（8 个对外调用共用的唯一解析入口）、`retire_account()`、`attempt_bind()`。**网络调用放在事务外**，绑定失败不回滚建号。
- 出站客户端骨架：`core/services/dingdong_client.py` —— 强制 HTTPS、带 `X-API-Key` 与 `request_id`、7 个业务码映射、`is_configured()` 为假时**显式报"未配置"而不是伪造成功**。**8 个出站接口本身仍未实现**（等 D10 base URL / D12 key）。
- 家长端 API：`core/api/ca_accounts.py` + `config/urls.py` 三条路由（`/children/{id}/ca-accounts`、`/ca-accounts/{号}`、`/ca-accounts/{号}/retire`）；只回短指纹，不回摘要原文。
- 家长端界面：`frontend/ca-link.js`（纯函数：读/摘 `?nfc_token=`、状态词、换机信号判定）+ `frontend/app.js`（`?nfc_token=` 承接、绑定对话框选孩子、已绑/已归档列表、换机两步、归档）。**凭据读到就从地址栏 `replaceState` 摘掉**（否则会进浏览历史、截图与转发链接），且只留在内存，不进 localStorage/sessionStorage。
- 运营后台只读页：`ops/templates/ops/ca_accounts.html` + `ops/views.py:ca_accounts` + `permissions.py`(`ca_account.view` → operations/technical/account_admin) + `labels.py` 中文动作码。

**验证**：后端全量 **266 passed**（含新增 `tests/test_ca_accounts.py`、`tests/test_ops_ca_accounts.py`）；前端单测 13 条（`frontend/unit/ca-link.test.js`）；**真实 Chrome 闭环 4 条**（`frontend/tests/ca-account.spec.js`：凭据不在地址栏留下、新号如实显示"待接通"、同机复用同号、换机两步+旧号归档+390px 不溢出）；`设计/API/openapi.json` 55 operations / 65 schemas，`scripts/audit_documents.py` → `errors: []`。

**五个踩过的坑（下次直接照做）**：

1. **运营后台模板在本机 runserver 里是"进程级缓存"的**：实测 `DEBUG=True` 仍然用 `django.template.loaders.cached.Loader`。改 `ops/templates/**.html` 后，跑在 8017 的旧进程**继续吐旧 HTML**，表现为"改了没生效"、截图与源码对不上。**改模板后必须重启本地 runserver**（pytest 每次新进程，不受影响）。
2. **Tabler 的 `.alert` 是 `display:flex`**：裸文本 + `<b>` + `<br>` 会被拆成一列一列的碎片（真实浏览器截图里才发现，pytest 断言字符串全绿也照样漏）。提示条内容必须包在一个块级 `<div>` 里，用 `alert-heading` + `<p>`。
3. **前端新增顶层模块必须同步 `frontend/server.cjs` 的静态白名单**，否则本地预览直接 404。
4. **临时隔离库手法**：postgres 角色 `dingdong` 有 CREATEDB，可 `CREATE DATABASE dd_wb_ui_check` → `migrate` → `seed_base` → 用完 `DROP DATABASE`，**不需要碰共享库里的演示数据**。注意本机无 docker、无 5432，`127.0.0.1:55439` 是既有实例；`sqlite` 不可行（代码用 `pg_advisory_xact_lock` + `hashtextextended`）。
5. **家长端浏览器用例的机器人凭据必须每次随机**：`nfc_token_hash` 的"活跃唯一"约束是**全局**的，写死 `e2e-token-0001` 这类固定串，第二轮就会撞上第一轮留下的活跃号并全红（这是设计使然，不是缺陷）。
