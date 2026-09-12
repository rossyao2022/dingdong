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
