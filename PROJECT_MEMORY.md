# 叮咚项目记忆与会话交接

最后更新：2026-09-30，Asia/Shanghai。适用于本目录中的后续会话。本文记录已核对事实，不代替代码和最新用户指令。

## 当前结论与最近工作

**最新：v0.3.21 审计遗漏已在本地修复并回归（2026-09-30，尚未推送/部署）。** 用户批准按建议修复，补原四题伙伴直达/服务端分布/同版本重做、四种儿童级网页偏好与真实话术/朗读、历史活动方式冻结、当前儿童真实JSON导出、活动上一步、旅程筛选分页、原家长三问/CA链接和七旧HTML映射。运营说明默认库复制与整库预览规则；关联CA资料删除500修为明确409保护拒绝，申请和资料不变，**并未实现此类资料彻底去标识删除**。新增迁移0015/OpenAPI65操作，后端421、前端94、部署12项通过，真实本地Chrome16个业务用例及1个覆盖7旧链接的用例通过，含旧22题独立Worker报告、NFC刷新与短信冷却；Storybook/格式/迁移检查通过。四组数据/27素材仍与3b8723e一致。两份私密PDF补新增操作图，明确待发布及旧图来源，批准的运营凭据只留本机忽略产物。生产仍v0.3.20，本次远端推送/main合并/备份迁移部署需另行放行；原手机/NFC/相机彩排、正式供应商支持和关联资料彻底去标识规则保留尾项。父任务继续in_progress，历史审计不覆盖。详见[修复与发布准备](deploy/PROTOTYPE_REPAIR_20260930_V0321.md)。

**最新：v0.3.20 最终匹配审计发现仍有遗漏（2026-09-30，仅审计，未修复/部署）。** 原型上游仍3b8723e；四组核心数据结构和27份原型素材完全一致，生产六容器/Worker、迁移0014、两题库十活动及52项公网资源复核正常。本轮后端408、前端87项通过，新增4项过期/授权边界；另用真实隔离接口复现已有机器人号的儿童执行资料删除报500（即使unbound，事务回滚）。核心模块通过不能代表全站所有操作匹配：原四情境伙伴入口/结果动作、原四种网页引导及随方式变化的话术、JSON导出、活动上一步、旅程筛选、家长三问支持及旧HTML地址映射仍缺；运营独立新题库入口和整库预览说明也待补。删除不得直接cascade或删永久保留的CA号，需明确处理规则。父任务继续in_progress，前面“完整整合”段落为当时核心模块验收快照，不能据此否认本轮遗漏；原手机/NFC/相机彩排和正式供应商边界仍待完成。详见[最终匹配复核](deploy/FINAL_PROTOTYPE_MATCH_AUDIT_20260930.md)。

**最新：v0.3.20 已推送、合入CA main并部署生产机试用实例（2026-09-30）。** 用户明确“上线啊”放行后，两分支原子快进至b08dc43，生产先备份并核验，再离线构建、迁移0014并显式发布两份题库和十活动，仅更新四应用。六容器正常、Worker pong；52项公网资源200且字节与本地一致，真实Chrome六档登录布局和运营登录页正常，未额外发送短信或登录生产账号。原固定号active/unbound、标签匹配、短信aliyun_verify及原联调配置保留，未改密钥或R2/CDN。两份生产机试用版PDF26/15页已同步上线状态并替换当前公网登录图，运营凭据仍只留私密产物。现场原手机/原NFC重绑、授权、报告/聊天回读和相机实拍仍需CA业务同事彩排，正式多游客与真实推送边界未改变；父任务保留现场验收尾项。详见[本版生产发布验收](deploy/PRODUCTION_TRIAL_20260930_V0320.md)。以下未推送/部署为此前快照。

**最新：v0.3.20 原型完整整合已在本地实现并验收（2026-09-30，未推送/部署）。** 用户已批准实施；锁定参考 main 3b8723e，补齐四入口、六岛/九题与职业项目、24题八维、四类指纹指南和21张素材，答案与结果接真实儿童级API，两类题库与十活动显式导入，运营可预览/版本发布和查答卷。保留CA登录、短信冷却、NFC与22题Worker报告；指纹只当页临时预览。后端404项、前端87项、部署10项、39个不同浏览器用例通过，Storybook构建及静态36项验证通过。两份私密待发布PDF补新增截图和沿用运营凭据；凭据不入Git。发布分支codex/release-v0.3.20，功能提交17fb016、包已准备，三个本地交付子任务已归档、父任务继续in_progress；origin/main本轮无新增待合并提交。生产机上次核验仍为v0.3.19；新版本推送/主干整合、备份迁移/内容发布部署需本次NEED-GATE，业务口径确认与原手机/标签真机彩排尚待做。详见[实现及发布准备](deploy/PROTOTYPE_INTEGRATION_20260930_V0320.md)。以下仅规划的段落是实施前历史快照。

**最新：原型完整整合已形成计划（2026-09-30，仅规划，未改功能或部署）。** 用户指出指纹、首页岛屿与参考站差距，核对 GitHub 和公网后确认：原型 main 为 3b8723e，关键模块与参考站仅换行不同；CA 线上 v0.3.19 与本地一致。9 月 27 日 c531e87 已取得该原型，却只吸收六张素材，仍用旧四岛；指纹模块从未进入 CA 前端历史，六岛九题/职业项目、24 题八维、四类指纹指南也未迁入。用户批准建立任务但明确仅制定计划；[整合计划](需求/原型完整整合计划_20260930.md)已完成，任务 `.trellis/tasks/09-30-prototype-content-integration` 保持 planning。方案以 CA 本地功能优先，适配原型内容到儿童级真实 API/后台，并新增逐项完整性验收；现有登录、NFC、报告、真实短信与联调不被覆盖。功能实施、发布及真机彩排均未因此完成。

**最新：v0.3.19 已部署生产机试用实例（2026-09-30）。** 用户放行后先备份并核验试用库，离线更新 API/Worker/Beat/Web，PostgreSQL/Redis 未重建。首次公网截图发现解压目录权限引起图片 404，已修复 Web 静态权限并重建；17 项素材全部 200 且与本地一致，六容器、Worker ping、公网版本及九档未登录布局正常。现仍为 demo / aliyun_verify / database_fixture，现有密钥、推送与 Prototype 配置沿用，没有额外发送短信或改 R2/CDN。原固定演示儿童已补 1 条合成报告输入，预检、幂等和适配器校验通过；账号仍 active/unbound，未替家长授权或生成报告。两份 v0.3.19 PDF 同步上线状态并保留账号凭据于本机私密产物。**真机短信、原 NFC 重绑和现场完整彩排仍待工作人员完成**；正式账号、正式子接口与真实推送不能称已闭环。详见[本版部署验收](deploy/PRODUCTION_TRIAL_20260930_V0319.md)。以下“未部署”均为此前阶段快照。

**最新：v0.3.19 已推送并完整合入 CA 默认主干 main（2026-09-30），未部署。** 用户明确选择 `ivesyi/dingdong-ca` 建立 main 并设为默认主干。main 从原默认 `codex/release-v0.3.6` 建立，再快进合并全部本地 v0.3.19 功能、测试证据与本地优先规则；没有冲突、强推或功能损失。发布分支 `codex/release-v0.3.19` 与 main 同步，原历史 release 分支保留；原视觉仓库未改。生产机仍为 v0.3.18，本次未部署、未发短信、未准备线上儿童报告输入。后续 CA 同步与整合默认使用 origin/main。详见 [推送与主干整合](deploy/GIT_PUBLICATION_20260930_V0319.md)。

**会展稳定性修复 v0.3.19 本地验收快照（2026-09-30，推送状态以上条为准，尚未部署）。** 已保护固定号、补绑定重试与未接通数据门禁、NFC 刷新后重碰提示、发码冷却倒计时；专用报告准备命令默认预检，显式写入仅限原固定号儿童的合成输入。隔离 demo 库真实 Chrome 390px 完成待接通→重试→真实 DingDong bind→授权→聚合回读/刷新；22 题实际作答提交，独立 Celery Worker 生成报告。短信仅本地固定码，未发生产短信，未操作线上原儿童或现场实体标签。后端 389 项、前端 68 项、相关浏览器 23 项通过。两份新版 PDF 补会展主链路截图和人工选方向说明，运营凭据只放本机忽略产物。**线上仍为 v0.3.18，原儿童报告输入尚未准备；新版部署、备份及补输入需单独放行，真机短信/NFC 彩排仍待做。** 详见 [修复与发布准备](deploy/EXHIBITION_HARDENING_20260930_V0319.md)。

**最新：10.4 参展代码审核（2026-09-30，仅审核，未修复）。** 后端 381 项、前端 67 项与语法检查通过；本地登录/移动布局/文案专项 13 项完成记录为 passed，另有两条 NFC 刷新对照与两项隔离问题复现。关键源码与线上 v0.3.18 摘要一致，六容器正常，生产机可读对方聚合。发现：固定号停用后同儿童同标签重绑 409；失败 bind 不随刷新重试，但授权后仍可读取聚合；登录前刷新会丢 NFC 参数；发码按钮未展示冷却。线上原演示儿童没有报告或 `initial_result` 测试输入，只读适配器检查实际得到 `FIXTURE_NOT_FOUND`，若现场需生成报告必须先准备匹配题库的合成输入并走真实业务流程。家长指南“底部我的 DingDong”入口错误，真实 Prototype 卡片位于账户与关联；尚需补主链路截图、统一人工选方向/人设的讲解、完成真机彩排。未改线上账号、未发送短信。三方清单与证据见 [参展审核](deploy/EXHIBITION_READINESS_REVIEW_20260930.md)。

**最新：固定 Prototype 演示号已准备现场重绑（2026-09-30）。** 经用户明确放行，先备份 `1.15.23.152` 的 `dingdong-prod-trial` 数据库并核验备份，再对原演示手机号、原儿童、原 NFC 标签对应的 `ca_dingdong` 做一次受限恢复；数据库现为 `active/unbound`（“使用中、待接通”），归档时间清空，审计已记录，授权仍未建立。六容器、公网入口、运行时与 v0.3.18 均复核正常。此为同儿童会展演示例外，不改变正式版换机发新号、旧号不复用的规则。现场工作人员仍需真实短信登录、碰原实体标签、选择原儿童并确认绑定、同意机器人数据用途、回读成长数据；**这些真机步骤尚未验收，不能声称已完成 E2E。** 两份本机 PDF 更新至 2026-09-30，运营 CA 账户截图反映“使用中、待接通”。详见 [恢复记录](deploy/PROTOTYPE_DEMO_REBIND_READY_20260930.md)。

**v0.3.18 家长与运营图文 PDF（初版 2026-09-29，状态更新 2026-09-30）。** 旧 v0.3.13 两份 PDF 各有 8 张截图，但已与线上版本不符；旧 v0.3.7 Markdown 的固定短信码和地址也已过期。新两份 PDF 各 9 页、9 张图，存于 Git 忽略的 `output/pdf/`，运营版内含已在公网真实 Chrome 验证的试用账号密码，家长版给出演示手机号并明确使用动态短信验证码、没有静态密码。运营截图来自当前公网，家长登录页来自公网、登录后截图来自 v0.3.18 隔离 E2E 合成数据。9 月 29 日核验时固定号仍为“已归档”；9 月 30 日已按上条记录恢复。详见[指南核验](deploy/GUIDES_V0318_20260929.md)。

**最新：家长端全页面布局修复 v0.3.18 已部署生产机试用实例（2026-09-29）。** 发布前备份数据库；发布包本地与服务器摘要一致，离线镜像、Django 与 Compose 检查通过。`dingdong-prod-trial` 六容器运行，API/PostgreSQL/Redis 健康；公网版本 0.3.18，`sms_mode=aliyun_verify`、`data_source=database_fixture`，家长入口 200，运营入口跳转登录页后 200。公网 Chrome 的九档未登录验证码布局测试通过。**本次未发送短信，未登录生产家长账号，登录后页面与 NFC 实物未做公网验收**；会展演示与 DingDong 正式生产对接边界不变。详见 [v0.3.18 发布验收](deploy/PRODUCTION_TRIAL_20260929_V0318.md)。

**发布前快照：家长端全页面布局巡检与修复 v0.3.18 已完成本地验收（2026-09-29）。** 使用隔离后端真实 Chrome 巡检 7 个顶层页面 × 7 档宽度（320/390/430/761/768/1024/1280），另查登录 9 档、首次建档和无儿童账户 7 档、活动详情/测评首题 4 档、合成视觉样例报告详情 6 档及关键弹窗；49 组控件碰撞扫描没有重叠，全部顶层页面无横向溢出、坏图或脚本错误。发现并修复：切页保留旧滚动位置、重复点当前导航无法回页首、帮助入口第三按钮单独换行、320px 今日陪伴标题被插画挤窄。相关浏览器回归 26 项、最终新增巡检 7 项、前端单测 67 项、Storybook 构建、部署测试 10 项、后端检查和文档审计通过。运营后台仅查未登录页四档宽度。旧 4173 Web 进程缺 `ui-components.js`，另起当前 Web 接 8017 时发码因请求校验失败而无法登录，因此旧环境全流程测试不计通过；报告详情采用合成视觉样例，未重复真实报告生成链路。**当前生产机试用实例仍为 v0.3.17，本轮只提交和推送 v0.3.18 源码，没有部署或发送短信。** 详见 [巡检报告](deploy/PARENT_PAGE_LAYOUT_AUDIT_20260929.md)。

**最新：家长登录验证码布局修复 v0.3.17 已部署生产机试用实例（2026-09-29）。** 用户截图指出验证码输入框、发码按钮和登录按钮错位；当前公网相同错位未能在常见宽度复现，但浏览器回归实测 761px 验证码输入框仅约 100px。已将登录表单对齐改为容器控制，在 761–1100px 单列显示，消除依赖通用边距互相抵消的布局；真实 Chrome 320–1280px 共九档布局断言通过。本地相关浏览器 6 项、前端单测 67、部署测试 10、后端系统检查、锁文件和文档审计通过。试用实例六容器健康，公网版本 0.3.17、九档登录布局断言通过；仍是 `aliyun_verify` 与 demo/fixture 数据，本轮未发送短信或登录生产家长账号。详情见 [v0.3.17 部署验收](deploy/PRODUCTION_TRIAL_20260929_V0317.md)。

**最新：家长端移动布局与 Storybook v0.3.16 已部署生产机试用实例（2026-09-29）。** 报告页相邻面板、空态有统一间距，320px 登录验证码与发码/登录按钮、成长观察日期表单改成单列；窄屏导航不折行，未登录空导航隐藏。生产页面与 Storybook 共用原生 `frontend/ui-components.js` 和三份 CSS，没有引入运行时框架。隔离本地真实 Chrome 先测到旧版 320px 按钮间距 0，再跑 320/390/430 的七个主要页面与关键弹窗、768/1280 抽查：相关浏览器 7 项通过；前端单测 67、部署测试 10、Storybook 构建、锁文件与文档审计通过。生产机六容器已切到 0.3.16，公网 320/390 登录页 HTTP 200、无脚本错误/横向溢出，NFC 带参入口仍可达并移除 token。真实短信仍为 `aliyun_verify`；**本轮没有新发短信，也没有登录生产家长账号，手机实物及登录后页面仍待用户亲测**。记录见 [v0.3.16 部署验收](deploy/PRODUCTION_TRIAL_20260929_V0316.md)。

**最新：10.4 固定账号 NFC 会展演示 v0.3.15 已部署生产机试用实例（2026-09-29）。** `1.15.23.152` 的 `dingdong-prod-trial` 已切到 v0.3.15，六容器健康，短信仍为 `aliyun_verify`，家长其他展示源仍是合成 fixture。随机测试 token 仅在受限 env 中，只有这个 token 会在 demo 模式下绑定对方 Prototype 的 `ca_dingdong`；普通 token 仍发我方 ULID。本地真实 Chrome 已从带参 URL 走通登录、建档、绑定、授权、对方选人设与聊天、CA 回读陪伴值 9→10；后端全量 381 项、前端 67 项通过。公网 Chrome 验证带参 URL 返回 200 并摘除 token，生产后端真实读到对方聚合，生产库固定账号数量为 0。**生产手机收码和首次绑定、NFC 实物碰触待用户真机验收**；对方真实 milestone 推送与正式账户接入仍未完成。详情见 [v0.3.15 部署记录](deploy/PRODUCTION_TRIAL_20260929_V0315.md)。

**最新：生产机 Prototype 推送回调已准备好（2026-09-29）。** 已在 `1.15.23.152` 的独立试用实例配置专用签名密钥，仅重建 API 容器。公网签名合成事件首次 201、重复投递 200，验收事件已清理；六个容器健康，版本仍 v0.3.14，短信仍 `aliyun_verify`、展示源仍 `synthetic_fixture`。密钥只在本机 Git 忽略的 0600 overlay 与生产机受限 overlay，未写入记忆或版本库。**DingDong 尚未配置目标并实发真实 milestone**，因此不能称推送联调完成。对方 Prototype 当前 HTTP 能跑业务，本轮不把 HTTPS 切换列为其前置阻塞；正式跨公网传正式 Key 前须按对方文档切换。记录见 Trellis 任务 `09-29-prod-push-callback` 的回调验收报告。

**最新：生产机直连 DingDong Prototype 联调（2026-09-29）。** 在 `1.15.23.152` 正在运行的 v0.3.14 API 镜像内，用一次性进程注入测试 Key，真实出站访问对方 Prototype，并用事务回滚的固定 mock 账户走我方 `ca_display` 真源路径。固定 `ca_dingdong` 的画像、人设、insights、会话/配置/聊天可用，3 次聊天让有效互动 6→9；我方新 ULID 的 bind/launch 均被 `40401` 拒绝，正式画像 POST 为 `50001`，成长 15d/30d 与健康度均 `40401`，复测 `data:null`。我方复测空态目前 `event=null` 但 availability=`ready`，需修。生产 webhook 未配置推送密钥，第 9 次互动后事件表仍为 0。**因此没有把家长服务全局切真源**：生产实例仍是 demo/合成展示，DingDong 持久配置仍空，v0.3.14 六容器健康；没有额外发短信。详见[生产机联调报告](.trellis/tasks/archive/2026-09/09-29-prod-prototype-integration/report.md)。

**最新：短信频控提示修复 v0.3.14 已部署生产机试用实例（2026-09-29）。** 用户报告退出后再次获取验证码显示“服务不可用”，生产日志查到两次阿里云 `biz.FREQUENCY`。旧代码未识别该码，登录消费后的挑战也未计入本地 60 秒重发间隔。`codex/release-v0.3.14` 已推送，代码提交 `d9219ea`：供应商频控映射 HTTP 429 和“短信发送太频繁，请稍后再试”，已消费挑战仍计入重发间隔，其他服务故障保持 503。关键用例先红后绿，短信与登录定向 26 项、前端 67 项通过；Django、Ruff、锁文件、迁移检查通过。发布包 SHA-256 `0b8376ca423f926bb1e997e5e8b292822ee74ee676604c8f8b85a46caf1618fd`。部署前备份、包摘要和新镜像检查均通过；公网版本 `0.3.14`，六个容器健康，`sms_mode=aliyun_verify`，家长和运营入口 200。**本次没有额外发送短信，线上 HTTP 429 与收码登录没有在此次发布中触发实测。** 详情见[频控修复记录](.trellis/tasks/archive/2026-09/09-29-sms-frequency-fix/research/20260929-production-frequency.md)与[v0.3.14 部署记录](deploy/PRODUCTION_TRIAL_20260929_V0314.md)。

**最新：阿里云真实短信已部署到生产机试用实例 v0.3.13（2026-09-28）。** 用户放行推送并部署到 `1.15.23.152` 的 `dingdong-prod-trial`；公网 `/api/v1/runtime` 返回 `sms_mode=aliyun_verify`，版本 `0.3.13`，API/Web/Worker/Beat/PostgreSQL/Redis 健康，家长与运营入口 200，技术管理页 404。家长登录仍是演示数据环境，但验证码改由阿里云号码认证短信认证发送；运营后台仍是账号密码加图形验证码。迁移 `core.0013` 完成，备份和 v0.3.12 镜像保留。此前本地向授权测试号实发两次（首次过期后经用户批准补发），第二次实收验证码登录 HTTP 200、重放 HTTP 422；套餐余量从 1000 降至 998。**本次生产部署未额外发送短信，生产机公网收码登录尚未实测**。最初 AccessKey 曾出现在聊天中，用户明确要求不轮换，现沿用该密钥。后端既有全量 373 项、最后修改后定向 23 项和前端 67 项通过；版本后重复全量因远程数据库慢而主动停止，不计通过。两份 v0.3.13 PDF 指南已生成，本机运营版含账号密码并以 0600 保存。详情见 [v0.3.13 部署记录](deploy/PRODUCTION_TRIAL_20260928_V0313.md) 和 [短信任务记录](.trellis/tasks/archive/2026-09/09-28-aliyun-sms-auth/research/20260928-console-and-tests.md)。

**最新：生产机运营登录改用图形验证码 / v0.3.12（2026-09-28）。** 用户要求去掉浏览器 HTTP 访问弹窗；`1.15.23.152` 已升级为 v0.3.12，公网 `/ops/` 与 `/dingdong/` 无外层门禁。运营登录页需四位图形验证码，服务端签名并校验两分钟有效期，提交即消费，Redis 原子标记阻止并发重放；密码失败 10 次/15 分钟按用户名限制，两个 Gunicorn worker 共享 Redis。技术管理页 `/admin/` 与 `/dingdong/admin/` 公网 404。部署前数据库和 Nginx 均已备份；API、Web、Worker、Beat、PostgreSQL、Redis 健康。公网真实 Chrome 通过后台验证码登录→工作首页→退出，以及 390px 家长固定码登录→合成建档→退出，无页面脚本错误；原站点 `www.happykua.com` 本机 Host 路由 200。新版运营手册只需交付一组后台账号。v0.3.11 上线后发现空密码提交可清除登录失败计数，当日以 v0.3.12 修复；新增回归测试通过，生产容器文件摘要与修复源码一致。后端全量 365 项通过（热修前启动），最终版运营登录与后台定向 52 项、前端 67 项、部署配置 10 项通过，文档审计 0 错误。**仍是生产机器上的 demo/合成数据试用实例，非真实短信或供应商生产接入；家长固定码 `00000` 随移除外层门禁变为公网可达，只能用于合成数据试用。** 运维、回滚与验收见 [v0.3.12 部署记录](deploy/PRODUCTION_TRIAL_20260928_V0312.md)，可转发手册见 [运营试用手册](dist/guides/生产机运营试用操作手册.md)。

**此前：晴幂生产机首次部署 v0.3.10（2026-09-28）。** 用户确认目标机 `1.15.23.152` 并要求运行一版。该机原无 Docker，已安装 Docker 29.1.3 / Compose 2.40.3；用已在 tigery 验收的 v0.3.10 镜像和同 SHA 发布包部署独立 Compose 项目 `dingdong-prod-trial`，独立数据库、Redis、密钥和测试账号。公网入口 `https://1.15.23.152/dingdong/`（家长）与 `https://1.15.23.152/ops/`（运营）当时使用现有可信 IP 证书和单独 HTTP 访问门禁；后台账号凭据与门禁密码不入库，交付时单独给用户。`/dingdong/version.txt` 当时为 0.3.10，`runtime`=`demo`/固定码/数据库 fixture，API、Web、Worker、Beat、PostgreSQL、Redis 正常。真实 Chrome 走通运营登录→五个主要页面→退出，以及家长固定码登录→合成建档→退出；页面无 JS 错误，原有 `www.happykua.com` 仍 200，可用内存约 2.4 GiB。初始备份在生产机 `/opt/dingdong/backups/baseline-v0.3.10-20260928.dump`。历史部署坑：外层 HTTP Basic 不能覆盖携带 Bearer 的全部 `/api/` 请求；v0.3.10 只保护页面和 `/api/v1/auth/`，其他接口由 Django JWT/会话校验，未授权登录接口与儿童接口均 401。**此实例是在生产机器上的运营试用环境，仍是 demo 模式与合成数据，绝非真实短信/机器人/供应商生产接入。** 初版运维记录见 [v0.3.10 部署记录](deploy/PRODUCTION_TRIAL_20260928_V0310.md)。

**最新发布：家长端退出入口与文案清理 / v0.3.10 测试环境（2026-09-27）。** `codex/release-v0.3.10` 的应用提交 `4ee8f6e` 已加页头“退出登录”（建档页、已有档案与 390px 手机视口均可用），删除题库发布、数据来源对照、同步时间戳、报告模板版本等家长不需理解的说明；内部设备编号只在主动展开后可见。测评提交阶段明确使用演示图片，不需上传孩子照片。前端语法检查、67 单测、部署配置 9 项和 `uv lock --check` 通过；真实 Chrome 本地新增退出/文案 2 项、受影响旧流程 23 项（初跑 19 过，4 项修正旧断言后定向复测全过）、成长周期桌面/390px 1 项、演示报告流程 2 项、账户与机器人标签专项 9 项通过。发布包 `dist/dingdong-v0.3.10.tar.gz` 的 SHA-256 为 `8d4331a6bf2029cb67b3d3a57ef6d96b81b5ca184eca965b72511823129e1c7a`；测试机升级前备份已完成，`dingdong-demo` API、Web、Worker、Beat、PostgreSQL 和 Redis 健康。公网版本返回 `0.3.10`、运营登录页 200、六张 WebP 均 200；真实 Chrome 从公网验证登录、建档前退出、390px 退出、建档后报告文案和无页面 JS 错误。记录见 [v0.3.10 测试部署](deploy/TEST_RELEASE_20260927_V0310.md) 与 [.trellis 任务报告](.trellis/tasks/archive/2026-09/09-27-parent-logout-copy/report.md)。测试环境仍为数据库合成 fixture，正式 DingDong 四子接口与真实推送未闭环。

**上一轮：T-052 / v0.3.9 测试部署（2026-09-27）。** 用户确认“前端设定调整”指页面配色与图片布局，并授权完成合并、测试、测试环境部署。代码提交 `c531e87`：从 `upstream/main@3b8723e` 择取紫色 DingDong 机器人两图和四张 V5 岛图，适配现有四岛页面；修复我方 `ca_display._persona_out` 对 Prototype 扁平人设响应的读取，`character_name` 映射展示名，历史字符串分数 `"72.00"` 规范为整数 72。后端全量 362 passed / 90% 覆盖率（最终补丁的展示专项又 56 passed），前端 67 单测、部署 9 测试通过；真实 Chrome 的 64 项经分段与失败项复测，61 passed / 3 项历史一次性批次按配置跳过。测试基建发现本地共享库短信每 IP 每小时 50 次限流和旧 Celery 进程失联；改用本地另一本机来源地址完成回归、启用健康的回归 worker，异步失败项均复测通过。`dingdong-demo` 已升级到 v0.3.9，公网版本、runtime、运营登录页、六张 WebP 与 Chrome 桌面/390px 页面均验收；部署记录见 [v0.3.9 测试发布](deploy/TEST_RELEASE_20260927_V039.md)。测试环境 `CA_DISPLAY_DATA_SOURCE=synthetic_fixture`，**不能称四展示面真源或 milestone 真实推送已闭环**。正式 NFC/账号校验、四子接口、推送双方配置、枚举与分数类型仍待对方确认。

**生产环境服务器（2026-09-24 用户提供并核实）：`1.15.23.152`（晴幂，腾讯云）。** 用途：**当前项目的生产环境**。访问：`ssh -i ~/.ssh/id_ed25519 root@1.15.23.152`（root 密钥登录已验证可用）。密钥事实：本机 `~/.ssh/id_ed25519` 与 air 机是**同一把**（指纹一致 `SHA256:/ZheIK6q0D5k4p5zlns0P5oNwYmPk0x8W35B8XC7uJA deadykual@gmail.com`），无需搬运；公钥由 air 侧 2026-09-24 会话经 `ubuntu` 用户 sudo 追加进 root 的 `authorized_keys`（root 原本未开放该密钥）。机器形态：VM-0-4-ubuntu，Ubuntu 24.04.4，3.6G 内存（可用约 2.7G）/ 59G 盘（已用 15G）。**同机已跑晴幂其他生产业务**（Lifebook .NET API、HappyKua 系列、Kuakua AI、life-puzzle、starfire、xinling-ai-v2 等 systemd 服务，`/root/project`、`/root/docker-compose.yml`），部署叮咚时注意共存、端口冲突与内存余量；nginx 有备份包（2026-06-14 改动痕迹）。

**最近一轮工作：DingDong Prototype webhook 接收端 + v0.3.8 公网部署（任务 T-051，2026-09-23，用户驱动）。** 状态：**已实现、全量测试绿、已发版 v0.3.8、已部署公网并验收**。①**webhook 接收端**：`POST http://110.42.225.196/api/dingdong/prototype/events`（对方文档 §7–§11 四要件）：HMAC-SHA256 验签（`HMAC_SHA256(CA_PUSH_SECRET, X-Dingdong-Timestamp + "." + 原始 body)`，常数时间比对、原始字节不重序列化）、`X-Dingdong-Event-ID` 幂等（重复回 200 duplicate:true 止住对方 outbox 补偿、不落第二条，savepoint 隔离唯一键冲突）、timestamp 时间窗（默认 2h）、未约定 secret 时如实 403 不伪造通过；`DingDongPushEvent` 模型 + 迁移 `0012` + 9 用例。②**测试基建**：「未配置默认语义 + 禁止真实出站」autouse 提到 `tests/conftest.py` 全局（`.env` 真实联调值此前泄漏导致 `test_ca_display.py` 等 41 用例红灯）；修 T-047 遗留断言（`test_questionnaires.py` 改 `"不评定天赋或能力" in q.description`）。③**v0.3.8 发版部署**（用户放行 push+部署）：compose env 白名单补 `DINGDONG_*` 透传（留空=未接通语义；`CA_DISPLAY_DATA_SOURCE` 一并透传，10.4 切真源只改 tigery `.env`）；tigery `dingdong-demo` 原地升级（init 自动跑迁移 0011+0012，容器全 healthy）；**上海入口 nginx 实测坑**：webhook 路由不带 `/api/v1/` 前缀，`deploy/relay/nginx-location.conf` 漏配 `/api/dingdong/` 会落到静态站（POST 405），已补 location 并与仓库同步一致。**公网验收**：`/dingdong/version.txt`=0.3.8、`/ops/login/` 200、无头 400 PUSH_HEADERS_MISSING、坏签名 403、真签名经公网 201 落库（`ca_dingdong`）+ 重发幂等 200，冒烟行已清。**验证**：后端全量 `pytest` 361 passed 0 failed；`ruff check` 干净；deploy 配置测试 9 passed。**联调状态**：对方已开 `PROTOTYPE_MODE=true`（固定账号 `ca_dingdong`，共用关联账号已自动创建）；我方 `DINGDONG_PUSH_SECRET` 已生成配置在 tigery `deploy/.env`（不入 git），**待用户经微信把 webhook URL + secret 交对方**（对方需配同 secret + `CA_PUSH_URL`）；仍待对方：测试 NFC token、分数字符串口径、42901 限流。细节见 [.trellis/loop/queue.md](.trellis/loop/queue.md) T-051 条目。

**最近一轮工作：运营端两条小项 + 一条用例口径收口（任务 T-048，2026-09-22，本地循环自驱）。** 状态：**已实现、已用真实 Chrome 验收，已 push codex/release-v0.3.7，未部署公网、未发版**。三条：①**O-15**：`ops/labels.py` 的 `CHECKPOINT_STATUS` 补 `"blocked": "已停用"`（T-044 的 `end_association()` 把 `SyncCheckpoint.status` 置 `blocked` 但词表没这项，儿童详情「同步」列兜底成「未知（blocked）」）；现在归档/解除关联后该列显示「已停用」，「恢复同步」按钮对 blocked 的显示保留（本就是要恢复入口）。②**O-16**：`QUESTIONNAIRE_PURPOSE["assessment"]` 由「测评流程（测试）」改「初始测评」，`assessment_models.py` 的 choice「正式测评流程（测试）」改「正式测评流程」、默认 title「日常情境问卷（测试）」去「（测试）」；`makemigrations` 生成迁移 `0011`（两个 `AlterField`，只改 choices 文案与默认 title，不动行数据）；核对本地库 `QuestionnaireVersion.purpose` 存值——2 行全是英文 code（`assessment`/`exploration`），无需清理。③**S-07**：`flows.spec.js:184` 的 `toBeVisible({ timeout: 20000 })` 放宽到 `120000` + 口径注释（外层 10 分钟、实测就绪 75s+、队列积压时 20s 复现 T-042 红灯），纯用例防御不改产品代码。**验证**：新增 2 条后端用例（blocked 渲染 + purpose/choice 词表）`2 passed`；`test_ops_console.py` `49 passed`；后端全量 `1 failed, 346 passed`（唯一失败是 T-047 遗留：`test_reference_exploration_is_seeded_and_meaningful` 断言 `"非正式" in description`，seed 描述已由 T-047 改掉但断言没改，与本轮无关，建议另立小任务）；`ruff check` / `ruff format --check --target-version py313 .`（134 files）/ `makemigrations --check --dry-run` 干净；前端 `npm run check` exit 0、`test:unit` `67 pass / 0 fail`；S-07 报告用例真实 Chrome `1 passed (24.7s)`；运营端走查 9 项全 PASS（O-16 列表/详情「初始测评」无「（测试）」、O-15 儿童详情「已停用」整页无「未知（」），截图 3 张在 [.trellis/tasks/T-048/shots/](.trellis/tasks/T-048/shots/)。运营端走查沿用临时 staff 账号做法（`t048walk`，走查后 `is_active=False`）。细节见 [.trellis/tasks/T-048/report.md](.trellis/tasks/T-048/report.md)。

**上一轮：公网部署 v0.3.7 + 前后端保姆级测试指南 + 字幕遮罩全流程 GUI 重测（分支 codex/release-v0.3.7，2026-09-22）。** 状态：**已部署公网、已交付指南、未在本地循环走 trellis 收尾**。①**字幕遮罩 GUI 测试**（用户指定用例层监控工件）：`/tmp/dd-full-gui-captioned.mjs`，遮罩挂 body 直下不进 `#main`、`pointer-events:none`、S7-d 扫描前隐藏——Jev 采样口径与纯产品内容可比（S0-cap 自检过）；结果 30/31，唯一失败 `S7-jev-copy` 经消融实验+逐块归因+对照重跑定位为**判定指令口径漂移**（旧开放式指令对纯静态产品文案块也判 0.52-0.58；改为「指出具体违禁字样才给高概率」后同文本 3/3 noul=0.04），非产品缺陷非测试泄露，指令已重写并注释归档。②**公网部署 v0.3.7**（公网 `http://110.42.225.196/dingdong/` 家长端、`/ops/` 运营后台）：版本 bump 五处统一（VERSION/pyproject/uv.lock/package.json/lock，提交 ad3508f）；发布包 `dist/dingdong-v0.3.7.tar.gz`（RELEASE.json 记录 8ee9fe0，标签 v0.3.7）；tigery 部署沿 dingdong-demo compose 项目原地升级，迁移 0008-0010 已应用（init 服务自动跑），容器全 healthy。**部署层真缺陷（已修）**：`Dockerfile.web` COPY 清单漏了 4 个前端新模块（companion/reassessment/growth-cycle/ca-link.js），公网冒烟发现 404 家长端停「正在连接」，已显式列举修复（提交 8ee9fe0）并重打包重部署，真实 Chrome 公网冒烟 4/4 过（登录→建档→ops 登录页→无 JS 错误）。③**运营测试账号** `tester`（account_admin 组）已建于公网库，密码不入 git——指南入库版已脱敏，本体只在本机 `/tmp/dd-tester-cred.txt`，遗失可在后台重置。④**两份保姆级指南**：`dist/guides/家长端操作指南.md` 与 `dist/guides/运营后台操作指南.md`（13 张自动化测试截图，顶部放网址+账号；`.gitignore` 对 `dist/guides/` 开了例外，指南已随 09-22 提交入库，运营端密码脱敏）。⑤环境实录：本机 mihomo TUN（utun1024）劫持局域网 22 端口导致 ssh tigery 假死，**走 Tailscale 别名 `dell`（100.115.66.119）绕过**；公网 curl 验证 API 需带 Origin+CSRF token 两步（浏览器不受影响）。**原始仓库同步**：用户指定原始 repo 为 `rossyao2022/dingdong`（public），`feat/ca-full-stack-v0.3.6` 已重写为两提交干净历史（无 deploy、无过程资产、无暴露性 commit message；本地 remote `upstream` 已配置）；本地 origin `ivesyi/dingdong-ca` 的 `codex/release-v0.3.7` 分支与标签 `v0.3.7` 已于 09-22 经用户放行推送。

**最近一轮工作：家长端清理合成/测试类文案与冗长免责 + 完整 GUI 重测（任务 09-20-parent-copy-cleanup / 提交 2520abf，2026-09-20 晚）。** 状态：**已实现、已用真实 Chrome + Jev 复验（30/30），未部署、未发版**。用户拍板「全部删除」而非「收敛到页脚」：家长端所有路由不再出现「合成」「本地测试」「测试环境」字样。清理范围：前端 `app.js` 11 处 + `growth-cycle.js` 1 处（testTag 徽标改空实现、测评面板大段说明、按钮「提交合成样例」、核验凭据两处、窗口表单提示、陪伴页声明、页脚）；后端 `seed_mock.py`（活动「[合成测试]」前缀×8）、`uploads.py:78` 家长可见 422 文案、`smoke_http.py` 建档名、`robot.py`/`tasks.py`/`seed.py` 政策正文与报告模板；本地 DB 已发布 `ActivityContentVersion`×8 / `ReportTemplateVersion`×2 / `QuestionnaireVersion`×1 残留 queryset update。冗长免责精简到一句以内（匹配度、数据来源、代理量）。**纪律新口径**：`frontend/README.md` 三处「合成数据必须标」改为「家长端不显示合成标注（testTag 空实现），底线约束移到测试脚本断言（S7-d 七路由扫描）与运营侧」。受影响 9 个 spec 断言同步修改。**验证**：`npm run check` / `test:unit` 67 项 / `ruff check`+format / `audit_documents.py` 全绿；受影响 spec 复核 17/17；完整 GUI 测试 run3 **30/30（21 门禁 + 9 Jev，0 SKIP）**——S7-d 七路由 0 命中、Jev S7-jev-copy noul=0.06（无测试字样泄露）、S5-jev-jargon noul=0.05（P-20 保持）、S7 简洁度 1.54 偏「简洁清晰」档；S5 严格口径 noul=0.89 如实记录（纯日期行也 0.89，门禁只取产品验收口径）。细节见 [.trellis/tasks/archive/2026-09/09-20-parent-copy-cleanup/report.md](.trellis/tasks/archive/2026-09/09-20-parent-copy-cleanup/report.md)。

**上一轮：Jev GUI 功能测试 + P-20 人设卡权重版本收进悬停（任务 09-20-jev-gui-report-fix-fulltest / 提交 9399689，2026-09-20 下午）。** 状态：**已实现、已用真实 Chrome + Jev 验收 28/28，未部署、未发版**。完整前后端图形化交互测试（家长端 S1–S7 全流程 + 运营后台 S8）28 项全过，Jev（jev-1.13.0，key 走环境变量）对页面真实文本判定。发现并修复：①**P-20** 人设卡正文「绑定于 … · 权重版本 v1」把内部代号 `pw_v1` 弱映射后直出——正文只留「绑定于 <日期>」，完整版本值进 `title` 悬停（与学习风格 tag 同一收纳），复验 noul 0.89→0.07；②测试脚本缺陷 S8-c 把手机号里的 "404" 误判页面 404，改用 HTTP 状态码判定。过程性环境处置（不入缺陷）：Redis 队列积压 35 万+消息（Beat 每 10s 重派发 97 个陈旧 pending 同步任务）——`kill -STOP` Beat + 清空 `dingdong-ca` 队列排干。细节见 [.trellis/tasks/archive/2026-09/09-20-jev-gui-report-fix-fulltest/report.md](.trellis/tasks/archive/2026-09/09-20-jev-gui-report-fix-fulltest/report.md)。

**最近一轮工作：归档旧号后的状态口径统一 + 运营端三小项（任务 T-044，2026-09-18 上午，本地循环自驱）。** 状态：**已实现、已用真实 Chrome 验收，未部署、未发版**。四条改动：①**P-19（真缺陷）**：`retire_account()` 以前只把账户 `status` 改成 `retired`、不动本地关联，于是同一页出现「还没有机器人账户号」与「已核验 · 同步已启用」并存。现在归档在**同一个事务**里一并结束该儿童已核验的 `ExternalAssociation`（`revoked` + `ended_at` + 同步检查点 `blocked` + `association.revoke` 审计），动作抽成新模块 `core/services/associations.py` 的 `end_association()`，家长点「解除本地关联」的 `POST /associations/{id}/revoke` 改调同一个函数，两条路径不再各写一份。判据：`ExternalAssociation` 只有 `child` 外键，且 `ca_account_one_active_child`（条件唯一）保证「先归档旧号才能发新号」、`child_one_association` 保证同一儿童同时最多一条 `verified` ⇒ 归档那一刻那条 `verified` 关联就是这台旧机器人的，一对一成立；`status`/`ended_at` 字段本就有，**不加迁移、不动对外契约**。②**O-12**：工作首页卡片与待办清单区块的「报告生成异常」改「生成任务异常」（两处装的是**全部**失败生成任务，实测 `kind=sync` 的失败也被算进去；卡片口径那句本就写「生成任务」）。③**O-13**：服务事项详情 `child_requests` 加 `.exclude(pk=row.pk)`，该儿童仅此一条时整块不显示。④**O-14**：待办清单·服务事项改 `order_by("-created_at")[:5]`（原来取**最旧** 5 条，最新两条永远看不到），区块写明「最多显示 5 条（按提交时间从新到旧）」。文档同步：`backend/docs/OPS_MANUAL.md`（标签与截断说明）、`frontend/README.md`（归档口径一句）、`设计/CA对接_C1_ca_account_id设计_20260916.md` §5② 缓解措施第 4 条。**本轮验证：先红后绿**——4 项新用例在改代码前全红（`test_retiring_account_ends_verified_association` → `assert [('verified','enabled')] == [('revoked','blocked')]`；`test_dashboard_failed_job_card_label_matches_all_kinds` → `assert '生成任务异常' in body`；`test_dashboard_todo_lists_newest_five_service_requests` → `NameError`（用例自身漏 import，已补）；`test_service_detail_other_requests_exclude_current_row` → 集合多出当前事项 pk），修复后 `4 passed in 48.43s`；后端回归 `pytest tests/test_ca_accounts.py tests/test_m3.py tests/test_ops_console.py tests/test_ops_services.py tests/test_ops_ca_accounts.py tests/test_ops_audit_scope.py` → **133 passed in 891.34s**；前端 `npm run check` exit 0、`npm run test:unit` **67 pass / 0 fail**；真实 Chrome 新增 `tests/t044-archive-consistency.spec.js`（登录 → 建档 → 绑定 → 同意并核验 → 归档 → 账户页与 `#reports` 双页断言 + 390×844）**1 passed (26.5s)**、新增 `tests/t044-ops-labels.spec.js`（运营端 O-12/O-13/O-14）**1 passed (13.6s)**；回归 `tests/ca-account.spec.js` 8 项全过、`tests/ops-console.spec.js` **15 passed / 1 failed**——唯一失败是「题库：可视化新建草稿→校验→发布→复制新版本」在 `page.goto /ops/questionnaires/` 处 `net::ERR_ABORTED`，**与本轮改动无关**：同样的失败逐字记录在改动前的基线日志 [.trellis/.runtime/baseline-frontend.log](.trellis/.runtime/baseline-frontend.log)（2026-09-17 11:20，同一文件同一行）；`ruff check` / `ruff format --check --target-version py313 .`（133 files）/ `manage.py check` / `makemigrations --check --dry-run` 干净；`audit_documents.py` errors `[]`（80 markdown / 518 local links / 61 operations / 83 schemas；markdown 计数含未纳入版本控制的每日记忆文件，故逐轮有浮动）。截图 6 张在 [.trellis/tasks/T-044/shots/](.trellis/tasks/T-044/shots/)。**一处如实记录的范围差**：acceptance 里的「历史初始报告仍可见」只在数据层验证（`test_m3.py` 断言归档后观察记录与已生成报告仍在、`GET .../reports` 仍列得到），浏览器走查那次儿童本身没有初始报告（本地生成初始报告要走 22 题 + 合成样例，正是 S-07 记的排队不稳路径）；本次改动不删任何数据，报告可见性不受影响。细节见 [.trellis/tasks/T-044/report.md](.trellis/tasks/T-044/report.md)。

**上一轮：人设卡学习风格说明去内部话术（任务 T-043，2026-09-18 上午，本地循环自驱）。** 状态：**已实现、已用真实 Chrome 验收，未部署、未发版**。改动一条：T-042 巡检的 **P-18**——`frontend/app.js` 人设卡的学习风格说明（T-038 的 P-12 引入）原文是「（中文对照由我方按取值直译，对方 code 表确认后核对；悬停可看原始取值）。」，把「我方 / 对方 code 表还没对过」这种对接状态写给了家长；现在改成「（来自机器人服务，中文名仅供参考；悬停可看原始取值）。」。原始 code 仍只进 `title`（悬停可看取值这条不变），后端 `learning_style_labels` 与「前端不维护映射表」的规矩都没动，运营端与对接文档不新增落点。同页之外还有一处同类话术未动：`#settings` 机器人账户说明里的「号由我方生成，对方只做不透明保存。」（T-042 未报，本轮不在范围内，留待巡检判断）。**本轮验证（先失败后修）**：新增真实 Chrome 用例 `frontend/tests/t043-persona-copy.spec.js`（登录 → 建档 → 绑定机器人 → 核验关联 → `inject_fixture --scenario ca_display_reassess` → `#reports` 人设卡，不拦截任何响应），修复前在 `expect(persona).toContainText("仅供参考")` 处失败并把原句逐字打印（日志 [.trellis/tasks/T-043/p18-before-fix.log](.trellis/tasks/T-043/p18-before-fix.log)、失败截图 [.trellis/tasks/T-043/shots/p18-before-fix.png](.trellis/tasks/T-043/shots/p18-before-fix.png)），修复后 `1 passed (28.9s)`（断言整页无「我方」「对方 code 表」「确认后核对」「直译」、`span[title="cognitive"]` 仍为「认知」、390×844 不横向溢出、`pageerror` 为空）；`npm run check` exit 0、`npm run test:unit` `67 pass / 0 fail`；`audit_documents.py` errors `[]`。截图 4 张 + 先失败 1 张在 [.trellis/tasks/T-043/shots/](.trellis/tasks/T-043/shots/)。**回归与如实记录**：`companion-panel.spec.js` + `t038-copy-and-format.spec.js` 混跑三轮都没跑绿（`2 passed / 3 failed`、`1 passed / 4 failed`、`2 passed / 3 failed`），失败点全是用例自己的 5 秒默认等待（登录后的「建立儿童档案」标题、重载后的 `#window-form`），没有一条落在内容断言上；**归因实验**：把 `frontend/app.js` 暂存回改动前版本（`git stash push -- frontend/app.js`）后同一命令同样 3 项失败、同一批等待点，恢复后 `diff` 校验无误 ⇒ 属本机当前偏慢（实测 `GET /api/v1/policies/current` 连续两次 `0.97s` / `4.54s`，load average 3.96），与本轮改动无关。**未验证**：真源模式与生产、`frontend/deployment-tests/*`（权限边界外）。细节见 [.trellis/tasks/T-043/report.md](.trellis/tasks/T-043/report.md)。

**上一轮：复测承接对话框被轮询关掉 + 五条文案小项（任务 T-041，2026-09-18 清晨，本地循环自驱）。** 状态：**已实现、已用真实 Chrome 验收，未部署、未发版**。六条改动：①**P-16（真缺陷）**：`render()` 以前一进来就调 `stopWork()`，而 `stopWork()` 会 `$("#dialog").close()`；`#reports` 在观察未就绪时每 3 秒重渲染一次，于是复测「开始复测」打开的同意对话框只开约 1.7 秒就被关掉，家长走不下去。现在把「离开上下文」与「重渲染」拆开：新增 `leaveContext()`（关对话框 + 清 `childEdit`）只由 `to()` 与 `hashchange` 入口在 `render()` 之前调用，`render()` 自身只 `clearTimeout(pollTimer)`、清 `pollPending` 与 `speechSynthesis.cancel()`（朗读那一条是原有行为，回退时会盖住新一题的内容，故保留）；对话框打开期间轮询由新函数 `schedulePoll()` 挂起并置 `pollPending`，`<dialog>` 的 `close` 事件里再补一次渲染；「提交成功后重渲染」的五个对话框流程（核验关联 / 编辑儿童档案 / 归档账户号 / 提交申请事项 / `case "close"`）改为自己显式调新的 `closeDialog()` 收尾。②**P-17**：核验凭据输错不再给家长看内部码 `PROOF_INVALID`——改由后端 `robots.py` 的 `PROOF_INVALID_MESSAGE` 给中文（「凭据无法核验，请核对机器人标签上的凭据，或重新绑定机器人。」），前端照旧渲染 `message`（选后端是因为运营端与其它客户端读同一个 `message`）。③**O-08**：服务事项列表/详情、CA 账户列表、儿童详情四处「家长」列改用 T-038 的 `account_name`（空姓名「未填写」），不再回落手机号导致同一号码渲染两遍。④**O-09**：家庭详情「家长」行的内部英文角色 `owner` 改中文「主要家长」（新词表 `FAMILY_ROLE`）。⑤**O-10**：活动列表与详情预览的岛屿/情绪加后端中文词表（`ACTIVITY_ISLAND` / `ACTIVITY_MOOD`，取值与家长端 `app.js` 的 `islands` / `moods` 对齐），原始值进 `title` 供排查；这两个字段是运营自由填写的 `CharField`（无 choices），所以新增过滤器 `known_label`——命中给中文、未命中原样显示，不能直接用 `label`（会把运营写的「观察岛」说成「未知（观察岛）」）。⑥**O-11**：CA 账户列表「摘要指纹」/「指纹 <hash8>」改「凭据前 8 位」口径，与家长端「机器人标识（前 8 位）」一致。**本轮验证：先红后绿**——回退 `app.js` 的 P-16 改动后真实 Chrome 该用例在 `expect(document.querySelector("#dialog").open).toBe(true)` 处失败（`Expected: true / Received: false`，逐字输出见 [.trellis/tasks/T-041/shots/p16-before-fix-dialog-closed.log](.trellis/tasks/T-041/shots/p16-before-fix-dialog-closed.log)），修复版 `tests/t041-dialog-and-labels.spec.js` **3 passed (49.3s)**（P-16 跨过轮询周期对话框仍开 + 进入 22 题测评、P-17 中文且整页无 `PROOF_INVALID`、运营端四条含 390×844）；后端 `pytest tests/test_ops_services.py tests/test_ops_ca_accounts.py tests/test_ops_console.py tests/test_ops_content.py` **86 passed in 359.42s**、`tests/test_m3.py` **29 passed in 389.32s**（含 P-17 的 422 message 断言）；前端 `npm run check` exit 0、`npm run test:unit` **67 pass / 0 fail**；`ruff check` / `ruff format --check --target-version py313 .`（132 files）/ `manage.py check` 干净；`audit_documents.py` errors `[]`（61 operations / 83 schemas）。截图 10 张在 [.trellis/tasks/T-041/shots/](.trellis/tasks/T-041/shots/)。**未验证项两条**：①`frontend/deployment-tests/parent-conflict-recovery.spec.js`（acceptance 点名的 childEdit 冲突回归）**本轮没跑**——它按 `playwright.public.config.js` 指向公网入口、要管理员凭据、且会在生产库建家长账号，属权限边界外；本地回归改跑 `tests/flows.spec.js` 等四个文件（16 passed / 2 failed，两个失败在 pre-fix 版 `app.js` 上逐字复现，与本轮改动无关）。②`flows.spec.js` 那两个失败的原因已定位为本地环境：Celery worker 进程存活但不再消费（队列 `dingdong-ca` 积压 25 条，含 `run_report_job`）导致报告一直停在「正在生成」，加上同一 IP 一小时 ≥50 次短信验证码触发 429；**本轮未重启 worker（非本任务范围）**，留作下一次巡检的固定复核项。细节见 [.trellis/tasks/T-041/report.md](.trellis/tasks/T-041/report.md)。

**上一轮：T-033/T-034 三条范围判定落定 + 过期截图刷新（任务 T-039，2026-09-18 凌晨，本地循环自驱）。** 状态：**已实现、已用真实 Chrome 验收，未部署、未发版**。三条：①**换机后旧号（`retired`）的人设只读展示**——orchestrator 裁定本批不做（四个展示面接口只解析 `active` 号，没有数据通路），本轮只把这个问题以一行补充写进 [.trellis/tasks/T-028/dingdong-clarifications.md](.trellis/tasks/T-028/dingdong-clarifications.md) 的确认级 C6（问对方：旧号历史数据是否仍按旧 `ca_account_id` 可查），**未改代码**；②**`watch` 态不显 `health_score`**——维持 design §1.3 原判，`companion.js` 的 `HEALTH_STATES.watch.score` 本就是 `false`，单测「面三：watch 只出轻提示，不显 health_score 数值」与真实 Chrome 断言一致（本轮只复跑取证，未改实现）；③**八维中文名改由后端下发**——`ca_display.py` 新增 `GROWTH_DIMENSION_LABELS`（语言 / 逻辑 / 音乐 / 空间 / 实践 / 自我认知 / 人际 / 自然成长代理），`growth-cycle` 响应新增 `growth_dimension_labels`（键与 `growth_dimensions` 同序同集，做法同 `type_label` / `stage_label` / `learning_style_labels`）；前端 `growth-cycle.js` 原 `DIMENSIONS`（key + 中文名）改为只有键顺序的 `DIMENSION_KEYS`，中文名一律取 payload、取不到兜底「未识别维度」，前端不再维护第二套映射（`grep` 检索确认 `frontend/*.js` 里已无八维中文名，只剩通用标注与标题里的「成长代理」字样）。**本轮验证：先红后绿**——新用例在字段未落地时 `1 failed … KeyError: 'growth_dimension_labels'`（`55 deselected in 19.69s`），加字段并同步 `设计/API/openapi.json`（`GrowthCycleView` 加字段与 required + 新 schema `GrowthDimensionLabels`）后 `tests/test_ca_display.py -k dimension` `2 passed`、**全量 `55 passed, 1 warning in 247.02s`**（原 54 + 新增 1）；前端 `npm run check` exit 0、`npm run test:unit` **`tests 67 / pass 67 / fail 0`**（原 65 + 新增 2）；**真实 Chrome** `tests/growth-cycle-panel.spec.js` **`1 passed (45.5s)`**（八维中文名改由接口下发后逐个仍渲染正确）、`tests/companion-panel.spec.js` **`2 passed (51.0s)`** 同时刷新了 T-033 的 8 张截图（`reassess-*` / `switch-*` 现在含复测区块），副本 4 张入库 [.trellis/tasks/T-039/shots/](.trellis/tasks/T-039/shots/)；`ruff check` / `ruff format --check --target-version py313 .` / `manage.py check` / `makemigrations --check --dry-run` 干净；`audit_documents.py` errors `[]`（61 operations / 83 schemas，`设计/API/请求响应与字段字典_V0.1.md` 已重新生成）。细节见 [.trellis/tasks/T-039/report.md](.trellis/tasks/T-039/report.md)。

**上一轮：T-024 巡检七条文案与展示小项打包（任务 T-038，2026-09-18 凌晨，本地循环自驱）。** 状态：**已实现、已用真实 Chrome 验收，未部署、未发版**。七条改动：①**P-11** 复测区块的原因句由「机器人服务给出的原因」改成「**这次建议的原因**」——它与健康度那句本就取自不同字段（事件 `trigger_type` vs 健康度 `trigger_reason`），同一个标签两个值让人以为自相矛盾，现在同一页「机器人服务给出的原因」只出现一次；②**P-12** 学习风格取值不再把内部英文 code 当正文：后端 `ca_display.py` 新增 `LEARNING_STYLE_LABELS`（imitation→模仿 / open→开放 / reverse→逆向 / cognitive→认知），人设响应新增与 `learning_style_tags` 同序的 `learning_style_labels`（未知取值 `null`，与 `type_label` 同做法），前端正文只给中文对照、原始 code 只进 `title`；**对方 code 表尚未确认**（澄清清单确认级 C6），文案里写明「中文对照由我方按取值直译，对方 code 表确认后核对」；③**P-13** 合成 fixture 的观察指标单位 `count` → `次`（`testsupport/robot.py` 的样例与同文件校验器同步）；④**P-14** 时间展示统一走一个格式化函数：`date()` 改成零填充到分钟（`2026/09/01 08:00`，不再有 `2026/9/1 00:00:00`），新增 `dateOnly()` 给周期起止这类纯日期（`2026/09/01`，纯日期字符串直接改写、不经 UTC 解析，避免跨时区差一天），与「成长观察」窗口输入框的口径一致；⑤**P-15** 「成长观察」区块加一行来源说明（「这里是本机同步到的机器人行为观察；上面的『陪学伙伴』与『成长周期报告』来自机器人服务。两份来源不同，不能直接混成一个分数。」）；⑥**O-06** 运营端家庭列表「家长」列改用新过滤器 `account_name`（只认姓名，空姓名给「未填写」），不再回落成手机号与相邻「手机号」列重复；⑦**O-07** 工作首页指标标签改「**近 7 天新建档案（含已归档）**」并把口径写成「与『在册儿童』不同口径，所以可能更大」，`OPS_MANUAL.md` 同步。**本轮验证（先失败后修）：`tests/test_ca_display.py -k persona` 回退源码后 `2 failed … KeyError: 'learning_style_labels'` → 修复后 `2 passed`；`tests/test_ops_console.py`+`tests/test_m3.py` 定向 6 项回退后 `3 failed, 3 passed`（`assert 2 == 1` 手机号出现两次 / `'近 7 天新增儿童'` 旧标签 / `'count' != '次'`）→ 修复后 `6 passed`；真实 Chrome 新增 `tests/t038-copy-and-format.spec.js` 3 项全过（家长端五条 + 空态来源说明 + 运营端两条，含 390×844 不横向溢出）；回归 `companion-panel`/`growth-cycle-panel`/`growth-window`/`reassessment-cta`/`reassessment-write-failure`/`sync-failure-visibility`/`robot-account-row` 12 项 + `ca-account`/`parent-name-fallback` 全过；前端 `npm run check` 通过、`npm run test:unit` 65 项全过；`ruff check`/`ruff format --check` 干净；`audit_documents.py` errors `[]`（61 operations / 82 schemas）。** 截图 10 张在 [.trellis/tasks/T-038/shots/](.trellis/tasks/T-038/shots/)。**环境动作**：本地开发 Celery Worker 是 09-17 09:46 启动的旧进程，仍加载改动前的 `robot.py`（校验 `unit == "count"`），与新 fixture 的 `次` 冲突，首轮真实 Chrome 验收里同步报 `UPSTREAM_SCHEMA_INVALID`、阶段报告不出现；已按 `backend/README.md` 的记录命令重启本地 Worker（Beat 未重启），重启后通过——**跑本地浏览器验收前要确认 Worker 加载的是当前代码**。细节见 [.trellis/tasks/T-038/report.md](.trellis/tasks/T-038/report.md)。

**上一轮：修掉复测回写 500 的数据模型根因 + 前端失败落点与 5xx 文案（任务 T-037，2026-09-18 凌晨，本地循环自驱）。** 状态：**已实现、已用真实 Chrome 验收，未部署、未发版**。三处改动：①`CaReassessmentEvent.event_id` 的唯一性从**全局**收窄为 `(ca_account, event_id)`（迁移 `0010`，只放宽不去重：旧约束更严，既有数据不可能有「同账户同事件」重复行）；②复测「重新测评 / 先不测」回写失败时，提示落在**复测区块自己这一块**（「这次没写成功，请重试。」+「重试」按钮，重试按同一个答案、同一个 `request_id` 重放），不再借道 `showError()` 写进页面上第一个 `#main .form-error`——`#reports` 里那是「成长观察」的窗口表单，家长会在那儿看到一句跟自己操作无关的报错；③`api.js` 新增 `errorBody()`，5xx 一律给「服务暂时不可用，请稍后再试。」，不再把解析 HTML 调试页失败的「服务返回了无法识别的响应。」当用户文案（S-06）。**本轮验证：新增先失败用例 `test_same_event_id_is_answerable_by_two_accounts`（回退模型与迁移后复跑：`FAILED … IntegrityError: duplicate key value violates unique constraint "ca_reassessment_event_event_id_key"`，修复后通过）；`backend/tests/test_ca_display.py` 全量 **53 passed in 237.82s**（原 52 + 新增 1，既有 14 处 `reassess_mock_002` 断言不受影响）；前端 `npm run check` 通过、`npm run test:unit` **65 项全过**（原 60 + `errorBody` 4 项 + 复测错误落点 1 项）；真实 Chrome 新增 `tests/reassessment-write-failure.spec.js` 2 项通过**——①5xx 时整页只有复测区块内那一条错误提示、窗口表单错误位为空、`#toast` 不接管、重试后真实 POST 200 回到「已选择暂不重新测评」（含 390×844 不横向溢出）；②**两个不同家庭的儿童先后回写同一个 `reassess_mock_001` 都拿 200**（修复前第二个必 500），不拦截任何响应；**回归** T-035 的 `tests/reassessment-cta.spec.js` 3 项全过（合计 `5 passed (3.7m)`）；`ruff check` / `ruff format --check --target-version py313` 干净、`manage.py check` 0 issue、`makemigrations --check --dry-run` 无待生成迁移；`audit_documents.py` errors `[]`（`设计/数据库实际字段_M5.md` 已按新约束重新生成）。本地开发库已应用迁移 `0010`（**生产库仍未迁移**）；浏览器用例在本地库留下了 3 行 `reassess_mock_001`（不同账户，各自儿童档案为「复测失败儿童」「回写甲」「回写乙」）。截图 4 张在 [.trellis/tasks/T-037/shots/](.trellis/tasks/T-037/shots/)。细节见 [.trellis/tasks/T-037/report.md](.trellis/tasks/T-037/report.md)。

**上一轮：家长端复测 CTA 与回写闭环——面四（任务 T-035，2026-09-18 凌晨，本地循环自驱）。** 状态：**已实现、已用真实 Chrome 验收，未部署、未发版**。落点：「测评与报告」的**陪学伙伴面板 → 互动健康度**这一段内新增复测区块（设计 §1.4 规定的位置，全产品唯一入口）——四步状态机：`accepted` 为 `null` 时给建议文案 + 建议时间 + 原因 + 「重新测评 / 先不测」；回写 `false` 后只剩一行「已选择暂不重新测评」+「查看当时的建议」（**不再给第二个「重新测评」按钮**：同一事件换个答案会被后端按 422 拒绝）；回写 `true` 后出「开始复测」，点它走的是既有 `beginAssessment()`（用途授权 → 22 题 → 合成样例），跑完由新函数 `writeBackReassessment()` 用这次测评的 id 回写 `complete`（`request_id` = `reassessment-complete:<event_id>`，重放安全，且**只认本次承接的那次测评**，刷新后认不出就不回写，宁可不回写也不写错 id）；结果卡 `switch_recommended=true` 展示新角色名 + 匹配度 + 当前角色匹配度 + 匹配度变化，`false` 只说「保留当前角色」且**不展示新角色名**。新增纯函数模块 `frontend/reassessment.js`（`reassessmentSection()` / `completionCard()`，不产生 HTML），配 `frontend/unit/reassessment.test.js` 9 项。**本轮验证：`npm run check` 通过、`npm run test:unit` 60 项全过（含新增 9 项）；真实 Chrome `tests/reassessment-cta.spec.js` 3 项全过（2.7m）**——真/假两个 `switch_recommended` 分支各走一遍完整四步（含真实 22 题测评与两条真实 POST 的入参、响应断言）、`accepted=false` 后只剩一行且可展开、无建议时整块不出现、390×844 不横向溢出、结果卡上没有切换按钮、人设卡仍是原角色（没有自动切换），`pageerror` 为空；**回归** `tests/companion-panel.spec.js`（2）、`tests/growth-cycle-panel.spec.js`（1）、`tests/growth-window.spec.js`（2）、`tests/robot-account-row.spec.js`（1）6 项全过；后端 `tests/test_ca_display.py` 复跑 **52 passed in 207.49s**（幂等与半截态用例在内）；`python3 scripts/audit_documents.py` errors 为空。截图 7 张在 [.trellis/tasks/T-035/shots/](.trellis/tasks/T-035/shots/)。三处如实记录：①设计第 4 步「由家长确认后才切换」在已冻结的三条接口里**没有落点**（澄清清单 D9 待对方答复），所以结果卡只呈现建议、不做假按钮，文案写明「确认入口尚未开放」；②`GET` 事件字段里没有名字与分数，**刷新后只剩中性说明**「这次复测的结果已经回写」，完整结果只在本轮会话的 `complete` 响应里；③**发现后端一处数据模型问题（未修，超出本任务范围）**：`ca_reassessment_event.event_id` 是**全局**唯一，而两个复测 mock 账号共用一份 fixture，所以同一个合成场景在全库只能被一个儿童回写一次——第二个儿童回写时撞唯一约束拿 500 IntegrityError（真实浏览器首轮就是这么挂的）。用例按「不写死测试数据」纪律给每次注入换独有 `event_id` 绕开它，任何库上都能重复跑；修不修（改成按账户唯一，或让 fixture 生成按儿童唯一的 id）请编排侧定。**T-037 已按「改模型约束」修掉**（`(ca_account, event_id)` 唯一 + 迁移 `0010`），见上一段。细节见 [.trellis/tasks/T-035/report.md](.trellis/tasks/T-035/report.md)。

**上一轮：家长端「成长周期报告」面板——对方的 15 / 30 天周期成长报告（任务 T-034，2026-09-18 凌晨，本地循环自驱）。** 状态：**已实现、已用真实 Chrome 验收，未部署、未发版**。落点：`#reports` 在「已生成报告」之后、「成长观察」之上新增一个面板——「15 天 / 30 天」两个固定 Tab（**不提供任意区间**，任意区间仍归「成长观察」，两份数据、两个来源不合并）、周期起止、当前陪学伙伴、`companion.delta` 写「陪伴值增长」（并给周期初→周期末）、后端映射的阶段中文名 + `stage_progress`、八维固定顺序条形、固定标注「成长代理（对方算法产出，不是 CA 原始天赋分）。」、算法版本与生成时间；`data_origin=synthetic` 时面板级挂「合成测试数据」徽标。新增纯函数模块 `frontend/growth-cycle.js`（空态/错误态文案、哪些数值能显示、八维顺序与缺失维度的判定，不产生 HTML），配 `frontend/unit/growth-cycle.test.js` 17 项；可用性文案与陈旧提示直接复用 `companion.js` 的 `AVAILABILITY_TEXT` / `STALE_NOTICE`。**本轮验证：`npm run check` 通过（`check` 顺带补上了 `ca-link.js` / `companion.js` / `growth-cycle.js` 三个模块的语法检查）、`npm run test:unit` 51 项全过（含新增 17 项）；真实 Chrome `tests/growth-cycle-panel.spec.js` 1 项 11 步走查通过**（未绑定与未授权两种空态、新用户空态、15 天与 30 天各自的正常态、Tab 切换后的两种空态、缺失维度、陈旧态、390×844 不横向溢出、断言「成长周期报告」在「成长观察」之上），**回归** `tests/growth-window.spec.js`（2）、`tests/companion-panel.spec.js`（2）、`tests/robot-account-row.spec.js`（1）5 项全过；截图 9 张在 [.trellis/tasks/T-034/shots/](.trellis/tasks/T-034/shots/)。三处如实记录的范围判定：①八维中文名不在对方契约里（`GrowthDimensions` 只有英文键、没有 label 字段），所以这张映射表放在前端 `growth-cycle.js` 并注明来源，没有改 T-032 已冻结的响应形状；②`engagement.index`（互动参与指数）不展示，设计 §1.2 的展示规则只要求 `companion.delta`、`engagement.stage` + `stage_progress` 与八维；③真源模式下 404 只带回业务码 `40401`，区分不出「绑定不满 15 天」与「对方没有这个周期」，会落到「这个周期还没有报告。」这句（只有合成模式会给 `period_incomplete`）。细节见 [.trellis/tasks/T-034/report.md](.trellis/tasks/T-034/report.md)。

**上一轮：家长端「陪学伙伴」面板——人设 + 互动健康度四态（任务 T-033，2026-09-18 凌晨，本地循环自驱）。** 状态：**已实现、已用真实 Chrome 验收，未部署、未发版**。落点：`#reports` 在「初始测评」卡之后、「已生成报告」之前新增一个面板——人设卡（人设名 / 后端下发的中文类型 / 公开描述 / 匹配度 `n / 100` / 学习风格 code 原样展示 / 权重版本）+ 下方「互动健康度」区块；四态分支为 `insufficient_data` 只说「还在收集互动数据，暂时不做判断。」、`normal` 显健康度分数与观察天数、`watch` 只出轻提示且不出复测 CTA、`reassess` 只出「建议重新测评」文案；`data_origin=synthetic` 时面板级挂「合成测试数据」徽标；面板底部固定「这是互动情况的提示，不是对孩子的评价。」；`#settings` 的机器人账户面板补一行只读的当前人设名。新增纯函数模块 `frontend/companion.js`（四态分支、是否显分、空态/错误态文案的判定，不产生 HTML），配 `frontend/unit/companion.test.js` 18 项。**该轮验证：`npm run check` 通过、`npm run test:unit` 34 项全过（含新增 18 项）；真实 Chrome `tests/companion-panel.spec.js` 2 项通过**（6 个 `ca_display_*` 场景逐个走查 + 未绑定态 + 390×844 不横向溢出 + 账户页只读人设行），**回归** `tests/growth-window.spec.js`（2）、`tests/ca-account.spec.js`（8）、`tests/robot-account-row.spec.js`（1）全过，合计 13 项通过；截图 8 张在 [.trellis/tasks/T-033/shots/](.trellis/tasks/T-033/shots/)。**环境事实：本地开发库此前没跑过 T-032 的迁移，该轮补跑 `manage.py migrate` 应用 `0009_careassessmentevent`（本地库 127.0.0.1:55439；生产库仍未迁移）。** 两处如实记录的范围判定：`reassess` 的「重新测评 / 先不测」按钮与回写属 T-035（设计 §5 把 CTA 与回写整块划给 D）；「换机后旧号人设只读展示」没有数据通路（四个展示面接口只解析 `active` 号），未实现。细节见 [.trellis/tasks/T-033/report.md](.trellis/tasks/T-033/report.md)。

**上一轮：CA 对接四个展示面的数据层与家长端接口（任务 T-032，2026-09-18 凌晨）。** 状态：**已实现、已测试，未部署、未发版**——线上仍是 v0.3.6，生产库没有 `0008`–`0010` 迁移（`0010` 见 T-037 一段）。已落地：新开关 `CA_DISPLAY_DATA_SOURCE`（默认 `synthetic_fixture`，与 `INTEGRATION_DATA_SOURCE` 分开、不共用值域）、`core/services/ca_display.py` 唯一数据出口（合成侧读 `test_fixture` 表且零出站；真源侧调 `dingdong_client`，未配置时返回 `not_synced` + `upstream_not_configured`，不伪造成功也不显示 0 分）、`core/api/ca_display.py` 的 4 读 2 写（人设 / 15–30 天周期成长报告 / 互动健康度四态 / 复测建议与回写），一律以 `child_id` 为键 + `owned_child()` 家庭隔离，响应里不出现 `ca_account_id`；新模型 `CaReassessmentEvent` + 迁移 `0009` 存复测回写的本地状态与出站同步标记；`inject_fixture` 新增 6 个 `ca_display_*` 场景（对应对方 xlsx 表 6 的 6 个 mock 账号）。**该轮验证：新增 `backend/tests/test_ca_display.py` 51 项全通过；受影响的既有用例 `tests/test_m3.py`（openapi 操作数 55→61）与 `tests/test_ops_console.py`（两个新审计动作的中文词条）一并复跑通过；`ruff check` / `ruff format --check --target-version py313` 干净；`makemigrations --check --dry-run` 无待生成迁移；openapi 61 operations / 82 schemas；`python3 scripts/audit_documents.py` errors 为空。未跑全量后端套件。** 仍未做：**前端展示面任务 T-033 / T-034 / T-035 都已完成**（人设 + 健康度四态、15–30 天周期报告、复测 CTA 与回写闭环）、**八个出站接口**（缺 D10 base URL / D12 key）、**换机的「主动解绑」分支**（缺 D20）。设计见 [.trellis/tasks/T-021/design.md](.trellis/tasks/T-021/design.md)。**注意：合成数据跑通不等于 §7 判定标准完成，不得写成「已接通 DingDong」。**

**更早一轮：CA 对接 C1「`ca_account_id`」从设计落地为可运行系统（2026-09-16 晚，用户「你能不能直接干完」）。** 已落地的部分：`CaAccount` 模型 + 迁移 `0008`（两个状态维度 `status`/`bind_state`，6 条约束）、发号器与生命周期服务（ULID / HMAC 摘要 / 幂等建号 / 同机复用同号 / 异机 409 换机信号 / 归档）、家长端 4 个接口、出站 DingDong 客户端骨架（未配置时显式报"未配置"，不伪造成功）、家长端 NFC 承接与换机界面（凭据读完即从地址栏摘掉，只留内存）、运营后台只读页「CA 账户」。**该轮本地回归：后端 266 项、前端单测 16 项、家长端真实 Chrome 4 项全绿；openapi 当时 55 operations / 65 schemas。** 设计与判定标准见 [设计/CA对接_C1_ca_account_id设计_20260916.md](设计/CA对接_C1_ca_account_id设计_20260916.md) §7；实现细节与五个环境坑见本文末尾「C1 `ca_account_id` 落地实现」。

项目已完成 M1–M5 自有业务实现、M6 运营后台（`dingdong_ca.ops`），并已把运营后台部署到 tigery、通过上海公网入口完成真实浏览器验收。**当前线上版本 0.3.6**：家长端 http://110.42.225.196/dingdong/ ，运营后台 **http://110.42.225.196/ops/** ，Django 后台 /admin/ 。v0.3.6 是**运营后台界面改版**（本地化 Tabler 组件体系 + 25 个页面统一外壳 + 静态资源 `?v=` 缓存击穿 + 明文入口 COOP 静音），见本文末尾「运营后台 v0.3.6：界面改版（2026-09-14）」；交付说明 [deploy/OPS_CONSOLE_UI_20260914_V036.md](deploy/OPS_CONSOLE_UI_20260914_V036.md)。上一轮 v0.3.5 的交付见「运营后台 v0.3.5：家长端档案冲突保留输入并提供可恢复路径（2026-09-14）」。

最新验收记录（v0.3.6 发布轮）：后端237项通过、部署配置9项通过、ruff通过、前端check与单测3项通过、本地浏览器8项通过；**公网真实Chrome**：冲突恢复5通过/5跳过、P1专项6通过/6跳过、运营后台回归15通过/7跳过，合计26通过/18跳过/0失败；公网逐页体检25个页面全部通过、「裸控件」由改版前67个降为0。桌面及390×844移动视口已测，不能称为真实手机硬件验收。此前 v0.3.5 记录：后端237项、部署8项；公网冲突恢复+P1专项11通过、运营后台回归15通过。**2026-09-16 的 CA 轮不减这些记录：它只改本地代码与文档，线上未动。**

- [M5实现与外部边界](backend/docs/M5_RESULT.md)
- [最近启动复验](frontend/docs/UI_FUNCTIONAL_20260912.md)、[原始Chrome日志](frontend/docs/ui-functional-20260912.txt)
- [后端测试日志](backend/docs/tdd-green-m5.txt)、[标题转义补充复验](frontend/docs/tdd-green-m5-title.txt)
- [当前文档索引](文档/文档索引.md)、[机器文档校验](文档/文档校验结果.json)

## 用户明确的约束

- **2026-09-30 用户决定：我方是 CA 侧第一技术负责方，本地已完成的功能完整性具有最高优先级。** 所有远程提交、线上版本与外部参考内容均让渡于本地基线。远端改动先审核差异；冲突保留本地功能，有用新增由我方适配并验证后吸收，再从本地发布。不得因远端更新更晚或已上线就覆盖本地成果。后续同步、合并、冲突处理与发布始终沿用这一模式。详见 [已确认约束](需求/后台设计已确认约束.md) 与 [整合规则](.trellis/spec/guides/ca-local-authority.md)。

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

当前OpenAPI：53条路径、61个操作、82个Schema。v0.3.4给 `/children/{child_id}` 补了 GET（家长端冲突恢复要读最新档案与修订号）；2026-09-18 的 T-032 补了四个展示面的 4 读 2 写（`companion-persona` / `growth-cycle` / `companion-health` / `reassessment` 与其两条回写），它们复用成长观察那套 7 值 `availability` 词表，请求与响应都以 `child_id` 为键。[交互规范](设计/API/前后端交互规范_V0.1.md)、[OpenAPI](设计/API/openapi.json)、[实际数据库字段](设计/数据库实际字段_M5.md)。题库目录通过GET assessment-config返回；支持purpose和questionnaire_version_id。探索完成用POST assessments/{id}/complete-exploration，测评测试仍用multipart submit。不要把内部契约当作DingDong已确认协议。

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

`材料/` 是**对方提供的第三方文档与网页归档**（约 45MB），`参考代码/dingdong/` 是外部参考仓库快照（HEAD `d754a5bf9ea8e71ca64a850d2e26aa321fe8ab38`）——两者都不进库。

**远端（2026-09-17 起）**：`origin` = **私有仓库 `ivesyi/dingdong-ca`**（`git@github.com:ivesyi/dingdong-ca.git`），已推送**完整前后端**共 38 个提交 + 13 个标签（`v0.2.0`–`v0.3.6`）+ 2 个分支（默认分支 `codex/release-v0.3.6`；另一条 `feat/parent-app-backend-integration` 是上游 PR 那个提交的保全）。**必须走 SSH**：HTTPS 经本机代理会 `502 CONNECT tunnel failed`（`~/.ssh/config` 里 github.com → ssh.github.com:443）。注意**被 `.gitignore` 排除的东西不在远端**——`材料/`、`参考代码/dingdong/`、`frontend/docs/`、`dist/`、`deploy/.env`（含真密钥）、`.workbuddy/`（项目记忆）换机要单独带。

**参考仓库 `rossyao2022/dingdong`（公开的原型演示仓库，我们只有 `pull` 权限）**：与本仓库**代码上有血缘**——`frontend/` 里有 8 个文件与它逐字节相同（`styles.css`、`playful.css`、6 个 SVG），其余是衍生；**但 git 历史无共同祖先**（本仓库根提交 `2a01b74`，它整个仓库只有一个提交 `d754a5bf`，两个 sha 互不在对方对象库里），所以**直接提 PR 会被 GitHub 拒成 "There isn't anything to compare"**。要提 PR 必须**自己造出共同祖先**：fork 出 `ivesyi/dingdong`，用临时 worktree 以 `d754a5bf` 为第一个父提交放上要提的文件。已按此开了 **PR #1**（https://github.com/rossyao2022/dingdong/pull/1 ，11 文件 +3008/−237），但**内容刻意收窄为纯前端应用文件**——那个 PR 的 diff 是**公开**的，而本仓库含合作方材料文件名/哈希、内部预算与人天估算、待发澄清清单，以及本文档里的公网 IP、SSH 别名与内网地址，**这些一律不能进任何公开仓库**。要让对方看到完整前后端，应邀请对方作为协作者访问私有仓库，而不是往公开仓库塞。

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

- 模型与迁移：`backend/dingdong_ca/core/ca_models.py`（含 `CaReassessmentEvent`，唯一性 `(ca_account, event_id)`）、`core/migrations/0008_caaccount.py`、`0009_careassessmentevent.py`、`0010_alter_careassessmentevent_event_id_and_more.py`。两个状态维度刻意分开——`status`(active/retired，我方用不用) 与 `bind_state`(unbound/bound，对方接通没接通)，**不许合并成一句"已绑定"**。四条约束：`ca_account_create_unique`(bound_by+request_key 幂等)、`ca_account_one_active_robot`(nfc_token_hash 条件唯一)、`ca_account_one_active_child`(child 条件唯一)、以及 3 个 check 约束。`nfc_token_hash` **不做无条件唯一**，唯一性挂在 `status='active'` 上。
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
6. **8017 的 runserver 可能被 autoreload 弄卡死**（2026-09-17 T-006 实测）：改 `core/api/common.py` 后 curl 从 200 变成 exit 7，`lsof` 里 8017 已无 LISTEN，但 reloader 与子进程仍在（子进程无网络 fd），全程不报错。**改完后端源码后、验证前先 curl 一次确认 8017 真的在监听**，卡死就 kill 掉旧进程组重启；本地日志可落 `.trellis/.runtime/runserver-*.log`。
