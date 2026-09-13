# 叮咚项目记忆与会话交接

最后更新：2026-09-13 18:44，Asia/Shanghai。适用于本目录中的后续会话。本文记录已核对事实，不代替代码和最新用户指令。

## 当前结论与最近工作

项目已完成 M1–M5 自有业务实现、M6 运营后台（`dingdong_ca.ops`），并已把运营后台部署到 tigery、通过上海公网入口完成真实浏览器验收。**当前线上版本 0.3.3**：家长端 http://110.42.225.196/dingdong/ ，运营后台 **http://110.42.225.196/ops/** ，Django 后台 /admin/ 。v0.3.3 修复了独立验收发现的问题，见本文末尾「运营后台 v0.3.3：修复独立验收问题并重新交付（2026-09-13）」；上一轮 v0.3.2 的交付记录见「运营后台交付与公网验收 v0.3.0 → v0.3.2」。

最新验证记录（v0.3.3）：后端201项通过；公网真实Chrome 19项通过（桌面12+窄屏2+通用5，7项写操作按设计跳过）、0失败；部署配置8项通过；ruff通过。此前 v0.3.2 记录：后端173项、公网16项、本地源码浏览器18项、部署配置8项。桌面及390×844移动视口已测，不能称为真实手机硬件验收。

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

当前OpenAPI：44条路径、51个操作、62个Schema。v0.3.4给 `/children/{child_id}` 补了 GET（家长端冲突恢复要读最新档案与修订号）。[交互规范](设计/API/前后端交互规范_V0.1.md)、[OpenAPI](设计/API/openapi.json)、[实际数据库字段](设计/数据库实际字段_M5.md)。题库目录通过GET assessment-config返回；支持purpose和questionnaire_version_id。探索完成用POST assessments/{id}/complete-exploration，测评测试仍用multipart submit。不要把内部契约当作DingDong已确认协议。

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

验证命令：`uv run --directory backend pytest -q`、`npm --prefix frontend test`（真实Chrome及全部服务需就绪）；Django check/makemigrations --check --dry-run、Ruff和前端check按改动范围执行。部署配置测试**必须从 backend 目录运行**（`test_settings.py` 的子进程要能 import `config`）：`cd backend && .venv/bin/python -m pytest ../deploy/tests -q`；本地 pytest 若遇沙箱 tmpdir 报错，加 `--basetemp=/tmp/dd-pytest/bt`。修改Worker代码后重启Worker；后台静态编辑器变更后collectstatic。不要因已有旧绿灯日志就声称新修改通过。

## 文档、原材料与Git状态

文档已分成当前指引与历史设计。原始附件和提取材料不改写；5个附件大小/哈希/ZIP匹配、85个归档文件哈希匹配、3份Word的1515个正文文字片段均有提取覆盖、11个工作表CSV行列一致。缺少原材料引用的3份文件；11项网页图片/字体资源历史下载失败，见[材料清单](材料清单.md)。不宣称网页完全离线或远端链接已验证。

`python3 scripts/audit_documents.py`检查本地文档、归档和契约；`uv run --directory backend python ../scripts/audit_documents.py --generate`从OpenAPI/模型重新生成字段文档并校验。计数以最新[校验JSON](文档/文档校验结果.json)为准，新记忆文件会增加文档数量。原始归档校验manifest不覆盖。

参考仓库：参考代码/dingdong，已核对HEAD为d754a5bf9ea8e71ca64a850d2e26aa321fe8ab38，未在本轮fetch远端。2026-09-09项目分析针对更旧的TalentRadar网页，不能把其随机评分问题套用到当前实现。

根目录Git工作区已建立发布分支基线：v0.2.0 至 v0.3.3 各有 `codex/release-v<版本>` 分支与 `v<版本>` 标签，最新为 `codex/release-v0.3.3`。原始材料（`材料/`、`参考代码/`、`项目分析.md`、`材料清单.md` 等）仍是 untracked，不要把 untracked 当作可以清理的垃圾；先核对状态，不能 git clean、reset 或覆盖现有实现。参考仓库是独立仓库。**没有 Git remote，未推送。**

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
