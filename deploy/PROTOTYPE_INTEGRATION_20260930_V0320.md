# v0.3.20 原型完整整合与发布准备

日期：2026-09-30。用户已批准实施。本轮交付本地功能、测试、图文手册及发布包；未推送、合入远程 main 或部署。生产机试用实例上次已核验版本为 v0.3.19，不能将本报告的本地结果说成公网验收。

## 基线与实际交付

CA 本地功能优先，不以原视觉仓库覆盖身份或业务代码。原型内容锁定 `rossyao2022/dingdong` 的 `3b8723e0089b411c19c41e13e4361cb90e6b7c71`，此前规划已与参考站对照。实现分支 `codex/release-v0.3.20`。本轮 fetch 后 origin/main 没有新增待合并提交；原始视觉仓库只读。

| 原型内容 | v0.3.20 实际实现 |
| --- | --- |
| 首页与素材 | 四个探索入口、六座 RIASEC 岛、21 张源图，紫色视觉沿用完整原型 |
| 六岛兴趣 | 依志愿顺序选三岛，18 题库按所选方向取 9 题，0-4 五档；0 是有效回答 |
| 组合与职业项目 | 20 组三岛组合、120 种有序选择，保留职业介绍和一周项目；不称专业能力诊断 |
| 八维观察 | 24 题、每维三题、1-5 回答、每维 3-15 原始分，雷达与八张建议卡；同分完整展示 |
| 指纹小宇宙 | 四类纹路示例与完整观察/学习/沟通/亲子活动指南，手工选择；照片仅当页临时预览，不上传、不保存 |
| 内容到真实活动 | 六岛与四指南共 10 个活动，经现有活动开始/步骤/完成/成长旅程链路 |
| 儿童级保存 | 新用途 interest/talent、真实 API 存稿/恢复/完成/结果；授权、修订、过期、儿童隔离继续生效 |
| 版本与后台 | 两类独立题库，固定评分结构，草稿编辑/复制/预览/发布；结果保留原内容版本，运营可查答案与分数 |
| 原 CA 链路 | 登录/退出/冷却、儿童、22 题测评和 Worker 报告、NFC 与固定号恢复、账户/授权/伙伴功能保留 |
| 共用组件 | Storybook 使用实际新模块和样式，未另写一套演示组件 |

完整内容映射及源码证据见[模块矩阵](../.trellis/tasks/09-30-prototype-modules/research/content-matrix.md)、[后端契约](../.trellis/tasks/09-30-prototype-exploration-data/research/api-contract.md)、[浏览器验收](../.trellis/tasks/09-30-prototype-content-integration/research/browser-acceptance.md)。

## 数据及生命周期

新增迁移 0014 为兼容性字段/约束扩展：题库 scoring、答卷 exploration_result、新内容来源 reference。已发布/停用版本及完成结果不可覆盖。原专业测评仍使用原 fixture 接口，未把新探索分数冒充专业分数或发给 DingDong。

题库和活动不在迁移或 seed 中自动发布。`import_prototype_content` 默认只预览；`--apply` 产生草稿；`--apply --publish` 才发布锁定的两份题库与十项活动。同 code/version 内容冲突会拒绝且事务回滚，重复运行幂等，不覆盖旧 CA 内容。

兴趣/八维答案只存服务端，模块不把答案塞进浏览器存储；草稿过期时另建记录、保留旧答案。指纹离开页面、换儿童、退出、pagehide、错误或相机取消时清理 Blob/媒体流；普通活动弹窗关闭不会误卸载当前指纹页面。从历史结果重新探索后同步新记录地址，刷新能继续新答卷；重新授权不丢失新建意图。

## 本地验证与证据

实际使用 Chrome、HTTP API 和本机 PostgreSQL 独立 schema；本地短信固定码，不向真实手机号发送短信，DingDong 出站配置为空。没有用业务响应拦截伪造完成结果。

| 验证 | 结果与证据 |
| --- | --- |
| 后端全量 | 404 passed，[日志](evidence/v0.3.20/backend-tests.txt)；既有 TestFixture 收集警告未新增失败 |
| 新探索及运营回归 | 79 passed，[日志](evidence/v0.3.20/backend-ops-regression.txt)，与全量重叠，不累加 |
| 前端单元与语法 | 87 passed，[单测](evidence/v0.3.20/frontend-unit.txt)、[语法](evidence/v0.3.20/frontend-check.txt) |
| 新浏览器与旧移动布局 | 6 新用例 + 7 旧用例，同批 13 passed，[最终日志](evidence/v0.3.20/browser-final.txt) |
| 其余旧关键回归 | 登录/文案/退出/NFC/会展恢复 16 个不同用例通过，[首批日志](evidence/v0.3.20/browser-legacy-first.txt)；其中早期移动失败由上述最终 7 项替代 |
| 原 22 题全流程 | 8 个不同用例分批通过，包括真实提交、独立 Celery Worker 报告、跨标签退出、后台服务事项；[首轮](evidence/v0.3.20/legacy-flows-first.txt)、[复核](evidence/v0.3.20/legacy-flows-recheck.txt)、[最终后台项](evidence/v0.3.20/legacy-admin-final.txt) |
| 历史重启补测 | 2 passed，兴趣与八维历史新探索保存后刷新继续新答卷，续授权保留新建意图、旧结果仍可回看；[日志](evidence/v0.3.20/history-restart-browser.log) |
| 运营截图 | 7 页真实权限会话、无页面脚本错误，[记录](evidence/v0.3.20/ops-page-capture.json)；本轮没有重新验证运营验证码登录 |
| 静态素材 | 36 项实际服务器 200 且字节一致，[静态检查](evidence/v0.3.20/static-assets.json)；21 张参考图与源提交一致，[源图检查](evidence/v0.3.20/reference-assets.json) |
| Storybook | 构建通过，[日志](evidence/v0.3.20/storybook-build.txt)，仅包体积提示 |
| 部署回归 | 10 passed，[日志](evidence/v0.3.20/deployment-tests.txt) |
| 文档审计 | errors=[]，[记录](evidence/v0.3.20/document-audit.txt)；没有纳入用户先前未提交的文档校验 JSON |

39 个不同浏览器用例属于本地验收；重复复跑不累加。早期日志保留失败及修复过程：移动介绍重叠、弹窗关闭卸载指纹处理器、旧标题断言、测试 lazy 图片等待、隔离后台地址和真实发码 IP 限流。没有关限流或改系统网卡。最终通过记录优先，但不把旧混合日志改成全绿。

## 两份图文手册

本机忽略目录 `output/pdf/` 存放 v0.3.20 待发布家长与运营 PDF，分别 26 页、15 页。增加四入口、选岛九题、组合、八维、四类指南、运营题库及结果截图；旧短信/NFC/报告/DingDong 流程仍注明原截图来源。运营凭据沿用用户批准的试用账号密码，仅在私密 PDF/构建输入，不入 Git 或项目记忆；[页数、凭据与目视核验](evidence/v0.3.20/pdf-check.json)通过。家长登录使用一次性短信，没有静态密码。

截图区分 v0.3.19 公网、旧隔离联调与新本地真实 API；手册标为待发布，不提前称已上线。实体手机相机及 NFC、生产短信登录仍需现场彩排。

## 待放行的发布操作

1. 推送本版发布分支，完整合入 CA origin/main；不改原型仓库，不丢本地功能。
2. 目标 `1.15.23.152` / `dingdong-prod-trial`，先备份并用 pg_restore 清单核验；备份仅留服务器。
3. 上传并核对已提交源码发布包的 SHA-256，保留 v0.3.19 镜像与目录。使用 `Dockerfile.backend.from-v0319`、`Dockerfile.web.from-v0319` 离线构建，无新运行依赖。
4. 沿用原 env，仅作为 Compose 参数，不读取或打印；运行迁移 0014、Django check，先执行 import 默认预览并对照锁定清单。
5. 经发布放行及业务内容确认后，明确执行 `python manage.py import_prototype_content --apply --publish`；不得以初始化脚本替代。
6. 仅更新 API/Worker/Beat/Web；数据库和 Redis 不重建。核验 Worker、版本、两类题库/活动、公开素材字节、家长与运营登录页布局。无额外短信，不改现有密钥或 R2/CDN。
7. 完成后另记录生产证据和手册上线状态。真实演示手机号/原标签彩排由 CA 运营负责；DingDong 侧确认共用账号、选角色与聊天稳定。

以上远端写入尚未执行，依据 AGENTS.md 必须取得本次 NEED-GATE 放行。

## 回退与剩余条件

0014 保留新答案及字段，不反向删除字段或恢复整个旧库覆盖新业务。回退到 v0.3.19 前，通过审计内容操作停用本版新增两题库与十活动，避免旧页面列出无法理解的新用途；保留历史记录，然后仅回退四应用镜像。新数据处理需先核对，不自动删行。

会展展示仍需 CA 业务同事确认题目、指南、活动及讲解口径，携原手机/原 NFC 标签/原儿童完成短信、绑定、授权、报告、选伙伴和聊天彩排。DingDong 正式账号、多游客共享设备策略、正式成长/健康子接口与真实 milestone 推送仍是此前三方待办，不因页面原型整合而变为已完成。
