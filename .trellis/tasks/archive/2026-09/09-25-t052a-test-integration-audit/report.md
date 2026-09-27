# T-052A 测试与 DingDong 联调核查

## 本轮运行事实（2026-09-27）

- 后端全量 `python -m pytest -q --cov=dingdong_ca --cov-report=term-missing`：**362 passed / 0 failed**，总覆盖率 **90%**（4456 statements、437 missed）；测试经 SSH 转发访问 `tigery` 上的开发 PostgreSQL，耗时约 24 分 45 秒。
- 前端 `npm run check` 和 `npm run test:unit`：语法检查通过，**67/67** 单测通过。
- 部署配置测试：**9/9** 通过；Ruff、Django system check、迁移检查通过。
- 最终版展示接口专项 `test_ca_display.py`：**56 passed / 0 failed**（包含扁平 Prototype 人设中 `character_name` → 展示名、`"72.00"` → 整数 72 与原嵌套结构）。
- 覆盖率不是“单测完美”：`cleanup_auth` 命令 0%，`ca_display` 模块 70%，运营管理动作 69%；本轮没有把覆盖率数字当作供应商真链路的证明。
- 初次浏览器全量与后端全量并行，期间编辑后端代码触发本地 runserver 重载，浏览器代理一度 503；已中止该轮，不能把它计作最终产品回归。后续单独重跑发现：共享开发库短信限流为同 IP 每小时 50 次；原有 Celery 进程虽存在却对健康探测无回应，Redis 队列积压。回归通过本机另一网卡地址隔离短信计数、启动独立命名 worker 并清空队列后，异步失败项复测均绿。

## 我方已确认并修复

- Prototype `GET /ca/persona/current` 返回顶层人设/绑定字段；原 `_persona_out` 只读 `persona`/`binding` 嵌套，造成“上游有数据、家长端人设为空”。现兼容扁平与嵌套两形状，缺失的绑定状态/学习风格保持空值，不编造数据。
- 历史实测曾见数字字符串 `"72.00"`。匹配度现在在展示边界把整数值字符串转为 0–100 整数，非法值留空；正式分数类型仍待供应商确认。
- 浏览器回归中的 T-030 是一次性批次清理验收，默认不再运行；题库版本断言按对应标题选卡；P-16 按“对话框跨过轮询间隔仍在，关闭后恢复读取”验收。三个文件的定向回归已通过：5 passed、3 skipped，P-16 补充断言单项通过。

## 联调完成度与待办

- T-050/T-051 已验证我方登录、建档、授权、固定 Prototype 账号绑定，以及 webhook 接收端验签/幂等/时间窗和公网冒烟。**这不等于真实供应商推送闭环已通过。**
- 截至 2026-09-25 的供应商实测：`growth/profile` 15d/30d 和 `persona/health` 为 40401；`reassessment/current` 为 `data:null`；`persona/current` 有扁平数据；`prototype/insights` 有全量聚合数据。正式四子接口能否提供与展示契约，待对方确认。
- Prototype 中固定 `ca_dingdong` 对任意 NFC token 绑定成功，我方 ULID 账号被拒却报 `NFC token not found`；正式 NFC 与账号 ID 规则待确认。
- 我方 webhook secret 已在测试部署侧配置，但尚未交付给对方；对方 `CA_PUSH_URL` 也未指向我方。真实 milestone 推送未到达。
- 测评切换实际走 Prototype 专用 `/app/companion/prototype/assessment`；`POST /ca/profile` 在 Prototype 模式返回固定 mock profile 错误。`configure` 实测 `zh-CN/normal/warm` 可用，但正式枚举表仍待对方提供。
- 测试环境 `CA_DISPLAY_DATA_SOURCE` 保持 `synthetic_fixture`，不能把页面显示出的合成数据说成已接真源。

## 最终回归

- 前端真实 Chrome 的 64 项按文件段与失败项复测完成覆盖：**61 passed、3 skipped**。三项跳过均为需显式 `T030_PHASE` 的历史一次性批次处置，不属于本轮常规回归。因共享库短信 IP 限流，未将 64 项伪称为“单次全绿”；原始整轮在 38 passed / 3 failed / 1 interrupted / 22 未执行处中止，随后完成剩余 22 项与全部失败项复测。
- 运营题库复制用例曾在旧编辑页就满足通用 URL 正则，自己的 `page.goto` 与延时跳转互相取消，报 `ERR_ABORTED`；现先断言 URL 确实变成新草稿，再跳转列表，定向复测通过。
- 测试环境部署 v0.3.9 后，`api` 健康、`web/worker/beat` 正常；公网版本 `0.3.9`、runtime demo、运营登录页 200、六张图片 200 image/webp；Chrome 公网页面桌面/390px 无横向溢出，详见 `deploy/TEST_RELEASE_20260927_V039.md`。
