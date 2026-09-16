# DingDong 家长端 · M4

沿用参考仓库 `d754a5bf9ea8e71ca64a850d2e26aa321fe8ab38` 的兴趣岛、伙伴插画和视觉布局，业务逻辑重新接到 CA 后端。参考仓库未修改。使用原生 JavaScript 模块，无前端框架或业务 API mock。

## 本地启动

先按 `../backend/README.md` 启动 PostgreSQL、Redis、Django（8017）、Celery Worker 和 Beat，并执行 base/mock 初始化。然后在本目录执行：

```sh
npm ci
npm run dev
```

打开 http://127.0.0.1:4173 。使用未注册的测试手机号，点击获取验证码，输入字符串 `00000`。系统自动建立家长账户，再填写儿童称呼。可选性别、出生日期，没有年级。

前端服务只监听本机，静态文件采用允许清单，`/api/v1/` 流式转发到本机 8017；multipart 不落盘。当前配置仅供本地合成数据验证，不能用于公开部署。

## 验证报告和机器人关联

新儿童没有默认算法/机器人结果。创建后，从请求响应或浏览器 sessionStorage 的 `ca.navigation.child` 取得儿童 UUID，执行：

```sh
uv run --no-sync --directory ../backend python manage.py inject_fixture --child-id CHILD_UUID --scenario assessment_success
```

到“测评与报告”同意用途、按本次题库实际题量填写日常情境测试题，再提交五张确定性合成样例。真实指纹采集未开放。报告由实际 Worker 生成，失败/处理中/结果未知分别展示。

机器人链路另用新测试儿童：

```sh
uv run --no-sync --directory ../backend python manage.py inject_fixture --child-id CHILD_UUID --scenario sync_success
```

“账户与关联”使用凭据 `TEST-PROOF-CHILD_UUID`，同意同步用途并核验；CA 主动同步、生成阶段画像和报告。默认观察窗口是合成输入的 2026-09-01 至 2026-09-08（UTC），页面按设备时区展示。重复注入会重置该儿童测试输入，请使用隔离的测试儿童。

## 已接入页面

- 兴趣岛进入后端已发布活动；今日陪伴可筛选、开始、保存步骤、继续、完成或跳过。
- 成长旅程显示真实活动记录和统计；儿童切换分别读取各自档案。
- 测评固定服务端题库版本，答案逐题保存，刷新和再次登录可恢复会话；初始/阶段报告读取服务端版本。
- 账户页编辑儿童资料、管理用途授权和本地机器人关联、提交帮助/修正/删除事项。
- 删除由后台技术人员执行；即使最后一个儿童被删除，家长账户页仍可查看去除儿童标识的回执。
- 伙伴引导方式和朗读仅影响网页，未接入机器人配置功能。

JWT access 只在内存，refresh 为 HttpOnly Cookie。sessionStorage 仅保存家长/儿童 UUID 导航提示，不保存手机号、儿童姓名、答案、报告、图片或令牌。退出清理页面状态并通知同源其他标签页。

## 测试

```sh
npm run check
npm test
```

浏览器测试需要本机 Google Chrome、已启动的后端/Worker/Beat。测试创建独立合成账户和儿童，通过初始化命令注入供应商输入，不拦截或伪造 API 响应；会保留合成测试记录。删除用例创建临时技术人员，真实登录后台处理，最后清理该工作人员。

结果与截图位于 `docs/`。后端完整回归、权限、并发和故障场景仍在 `../backend/tests/`。未接入真实短信、DingDong 字段协议和专业算法；本轮完成的是数据库合成输入下的业务闭环。


## M5 更新

“测评与报告”提供独立探索体验、测评流程测试与运营新发布题库入口。原参考四题已在后台维护，体验只展示本次选择，不生成天赋或能力结论。已发布版本固定，旧答卷不随新发布题干变化。可多选/选填、返回修改、从服务器恢复和读取冲突后的最新记录；已完成体验可从历史入口查看。

手机账户页可进入伙伴引导与家长支持。后台实际编辑/发布/复制、家长端新旧版本隔离及桌面/移动验收见 `tests/questionnaire-admin.spec.js`、`tests/flows.spec.js` 与 `../backend/docs/M5_RESULT.md`。运行 `npm test` 使用真实 Chrome 和当前数据库，临时内容工作人员会停用，测试题库发布后在验收结束停用，不删除旧答卷。


## M6 运营后台与共享测试工具

家长端本身在 M6 未改动，认证与权限逻辑保持原样。M6 新增的是运营后台（`/ops/`，独立 Django 应用，模板与静态资源都在后端，不在本目录），以及本目录下的浏览器验收用例 `tests/ops-console.spec.js`（8 项真实 Chrome 场景）。

三个 spec 共用 `tests/support.js`，其中 `uvBin()` 解析 `~/.local/bin/uv` 等绝对路径——Playwright 子进程的 PATH 不含 `~/.local/bin`，直接写 `uv` 会 `spawnSync uv ENOENT`。

```sh
npx playwright test tests/flows.spec.js tests/questionnaire-admin.spec.js tests/ops-console.spec.js --reporter=list
```

若 `frontend/test-results` 里堆了大量失败截图，Playwright 清理该目录可能被本地批量删除保护拦下，用 `--output=/tmp/dingdong-pw-out` 指定输出目录即可绕开。

M6 浏览器验收共 17 项通过（家长端 8 + 后台题库 1 + 运营后台 8）。运营后台用例覆盖登录失败与退出、家庭查询与儿童详情、题库草稿到发布、活动维护、报告查看与生成异常重试、服务事项处理、越权拦截、窄屏可用性，并收集 `pageerror`：任何脚本异常都会让用例失败，而不是变成模糊超时。结果见 `../backend/docs/M6_OPS_RESULT.md` 与 `../backend/docs/evidence-ops/`。

## M7 家长端档案冲突恢复（v0.3.5）

家长在「账户与关联」编辑儿童档案时，如果这份档案在你打开编辑之后被其他页面（运营后台、技术后台或另一个标签页）改过，服务端会拒绝这次保存，**不会覆盖对方的内容**。v0.3.4 及以前，家长端一被拒绝就重新读取最新档案并重建整个表单，家长刚填写的称呼、性别、生日会被服务端值直接替换——数据没被覆盖，但这次填写被静默丢弃。

v0.3.5 起，被拒绝时**不重建表单**：

- 家长填写的称呼、性别、出生日期原样留在输入框里；
- 提示区出现「资料已被更新，本次修改没有保存」，用家长能理解的语言说明，不出现 409 / 修订号 / 数据库这类词；
- 提供三条路径：
  - **查看最新资料** —— 并排显示"我的填写（还没保存）"与"最新资料"，只读，不动输入框；
  - **载入最新资料** —— 二次确认（说明"无法找回"）后才用服务端内容替换输入框，并在最新修订上继续编辑；
  - **用我的修改保存** —— 先看最新资料，再确认；提交基准是家长看到的那一版，所以这期间若又有人改过会**再次**被拒绝，输入继续保留，提示更新为"资料又被更新了一次"。
- 读取最新资料失败、连接中断或登录失效时只给提示，不清空输入、也不显示保存成功；
- 冲突还没处理完就点"关闭"，会先问一句"你还有没有保存的修改"，避免新增丢失路径。

公网真实浏览器验收用例在 `deployment-tests/parent-conflict-recovery.spec.js`（5 项：字段保留与服务端未被覆盖 / 查看与取消不丢输入 + 明确确认才替换 + 在最新修订上保存成功 / 恢复期间再次冲突 / 读取失败不清空 / 窄屏同一流程）。凭据走环境变量，不写入仓库：

```sh
DD_OPS_ADMIN_USER=... DD_OPS_ADMIN_PW=... \
  PUBLIC_HTTP_URL=http://110.42.225.196/dingdong/ \
  npx playwright test --config=playwright.public.config.js \
  parent-conflict-recovery.spec.js ops-p1-acceptance.spec.js
```

`deployment-tests/helpers.js` 是这两份 spec 共用的辅助函数（登录、家庭检索、家长建档、编辑档案对话框等）。交付与验收记录见 `../deploy/PARENT_CONFLICT_RECOVERY_20260914.md`。

## CA 对接 C1：机器人账户（`ca_account_id`）与 NFC 承接（2026-09-16）

对接文档 V1.0 表 0 要求 CA 侧提供稳定 `ca_account_id`。本目录实现的是**家长侧承接与展示**，号码本身的生成规则见 `../设计/CA对接_C1_ca_account_id设计_20260916.md`。

- **承接入口**：机器人上的 NFC 标签把凭据写进 URL（`?nfc_token=…` 或 `#settings?nfc_token=…` 两种写法都认）。页面读到后**立即用 `history.replaceState` 把凭据从地址栏摘掉**，只留在内存里——否则它会跟着浏览历史、截图和转发出去的链接一起走。家长未登录时先登录，页面渲染完自动弹绑定框，不必自己找入口。
- **绑定要选孩子**：一台机器人只服务一个孩子，所以对话框里必须选服务对象。同一台机器人再次绑定**复用原来的号**，不换号。
- **两个状态维度分开显示**：`使用中 / 已归档` 说的是我方还用不用；`待接通 / 已绑定` 说的是对方有没有确认接通。新号建出来就是「待接通」（对方端点还没开通），**不是出错**，界面不会为了让页面好看提前显示「已绑定」。
- **换机是显式两步**：确认弹窗讲清代价（换号后对方侧成长周期与阶段对比不会延续到新号），确认后先归档旧号、再为新机器人发新号。归档的旧号在「机器人账户」里只读可查，**永不重用**；换机前生成的报告按孩子保存，仍在「测评与报告」里。
- **模块与白名单**：读/摘 URL 参数、状态词、换机信号判定都在 `ca-link.js`（纯函数，可单测，不碰 DOM）。**新增顶层文件必须同步 `server.cjs` 的静态允许清单**，否则本地预览 404。

测试：

```sh
node --test unit/*.test.js                                   # ca-link 纯函数 13 项
npx playwright test tests/ca-account.spec.js --reporter=list  # 真实 Chrome 4 项
```

浏览器用例覆盖：凭据不在地址栏留下且 hash 路由还在 / 新号如实「待接通」且接口不回凭据原文 / 同机复用同号 / 换机两步 + 旧号归档可查 / **390px 下 29 位定长号码不撑破页面**。

用例里的机器人凭据**每次运行都随机生成**：后端对「活跃账户的机器人凭据」是**全局**唯一约束，写死固定串会让第二轮跑的时候撞上第一轮留下的活跃号而全红——那是设计使然，不是缺陷。

验收截图（真实 Chrome，隔离库）：`docs/ca-account-settings-desktop.png`（账户与关联 · 机器人账户）、`docs/ca-account-settings-mobile.png`（390px）、`docs/ca-account-replace-dialog.png`（换机确认）、`docs/ops/ca-account-list.png` 与 `docs/ops/ca-account-note.png`（运营后台只读页）。

想在不碰共享演示库的情况下跑这组用例，见技能 `dingdong-local-browser-acceptance`（自建临时库 → 常驻起 8017/4173 → 跑用例 → 丢库）。
