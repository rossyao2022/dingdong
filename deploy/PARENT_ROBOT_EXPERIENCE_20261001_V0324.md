# v0.3.24 家长机器人与展会体验本地交付

后续状态：用户放行后已上线，见[生产发布验收](PRODUCTION_TRIAL_20261001_V0324.md)。以下为发布前本地快照，保留原始事实。

日期：2026-10-01。状态：**本地实施和验收完成，未推送、未合入远端、未部署**。生产上次已确认版本仍为 v0.3.23；本轮没有重新核验或改动生产。

## 已实施的用户流程

- 保留登录 → 儿童建档 → CA 探索主线、桌面和手机导航、岛屿/八维/指纹/职业项目、四题引导、活动、历史、导出及旧链接。展会入口也必须先完成登录建档。
- 我的 DingDong 提供机器人报告、对话及绑定管理；账户页突出入口。对话不依赖报告成功读取。
- 当前儿童已绑定且授权时，完整机器人报告在上方展开，自己的 CA 测评在下方，提供页内跳转。未绑定时自己的测评照常使用，展会体验另有入口。
- 去掉报告页旧成长观察组件及重复关联入口。报告读取慢或失败只影响机器人区域，不遮住 CA 内容；切儿童、解绑和撤权不保留旧儿童报告。
- 展会页无需绑定即可查看共享演示报告和打开聊天，不写入个人测评历史。标明演示内容；曲线按实际天数比例绘制，频率只是模拟查看，不修改机器人配置。
- 后台“展会体验用户”复用已有家长手机号，展示进入和成功查看报告时间、人工跟进状态及备注；无重复手机号登记、购买意向认定或自动联系。

## 接口及数据边界

新增 `GET /api/v1/exhibition/report` 和 `POST /api/v1/exhibition/visits`；runtime 增加展会开关与安全聊天地址，账户增加聊天地址。OpenAPI 当前 67 操作、97 schemas。迁移 `0017_exhibition_visits` 仅增加访问/跟进结构，不移动家庭数据或自动解绑。

个人机器人报告保留儿童所有权、有效绑定及授权检查；供应商响应后再次核对。共享预览只在 demo + Prototype 开关下启用。访问事件使用 UUID 幂等键；后台保留角色、CSRF、修订冲突与审计。完整约定见[跨层规范](../.trellis/spec/frontend/parent-robot-and-exhibition.md)。

独立审查发现并修复：CA 等待供应商整页显示、首次恢复登录等待报告而触发启动超时、换儿童复用旧账号缓存、个人报告链接未统一安全校验。见[独立审查](evidence/v0.3.24/independent-review.md)。

## 本轮验证

| 验证范围 | 实际结果与证据 |
| --- | --- |
| 后端全量 | [463 passed](evidence/v0.3.24/backend-all.log)，1 条既有测试模型收集 warning；Django/migration drift/ruff 检查通过 |
| 前端单测、语法、组件预览 | [111 passed](evidence/v0.3.24/frontend-root-unit.log)、[语法检查](evidence/v0.3.24/frontend-root-syntax.log)、[Storybook 构建](evidence/v0.3.24/storybook-final.log)通过 |
| 新家长/机器人真实 HTTP Chrome | [4 个用例](evidence/v0.3.24/browser-new.log)；第 4 项另以同一文档保留缓存的方式[再次通过](evidence/v0.3.24/browser-replacement-final.log)，不是额外新用例 |
| 原 CA 业务回归 | [9 个用例](evidence/v0.3.24/browser-ca-regression.log)，保留原探索、历史、偏好、活动及导出 |
| 未绑定 CA 报告 | [1 个用例](evidence/v0.3.24/browser-ca-worker.log)，真实 22 题提交及独立 Worker 生成报告，没有预置完成报告 |
| 旧缓存和启动恢复 | [5 个真实 Chrome 场景](evidence/v0.3.24/cache-browser.log) |
| 运营和窄屏 | [4 组检查、8 个布局检查、0 pageerror](evidence/v0.3.24/exhibition-ops-browser.json)，包括角色、保存、审计及旧 revision 409 |
| 慢供应商 | [2 个检查、0 pageerror](evidence/v0.3.24/slow-supplier-browser.json)：5 秒延迟时 CA 约 112ms 可见；25 秒延迟跨启动期限后 CA 和聊天仍可用，局部错误不覆盖页面 |
| 部署配置 | [13 passed](evidence/v0.3.24/deployment-tests.log)，未执行远端部署 |
| 文档及契约审计 | [errors 为空](evidence/v0.3.24/document-audit-summary.json) |

Chrome 流程使用隔离 PostgreSQL schema、独立队列、合成家庭/手机号及本地固定验证码，没有真实短信。运营页面使用合成认证会话，不等于生产密码登录验收。绑定及推送测试使用显式本地测试输入与签名，不代表 DingDong 自动实发推送或真实设备绑定。慢供应商是本地 HTTP 输入，不拦截 CA 业务 API。

## 截图手册

两份私密 PDF 已更新至待发布版：家长 38 页、运营 21 页，均包含页面截图；新增界面使用本轮隔离 Chrome 图，沿用页面标注历史截图来源。已批准的运营账号密码与演示手机号保留，仅在本机忽略产物中，不进入 Git。技术人员调整共享测评方向的步骤移至运营手册。

私密产物位于 `output/pdf/`，文件名为 `叮咚家长操作指南_v0.3.24_待发布.pdf`、`叮咚运营操作指南_v0.3.24_待发布.pdf`。所有页面重新渲染和目视检查，批准凭据只做布尔核验，不输出具体值。见[PDF 核验](evidence/v0.3.24/pdf-verification.json)及[生成记录](evidence/v0.3.24/pdf-build.log)。

## 发布与仍待现场确认

本地版本、HTML/JS/CSS 及模块 URL 均为 0.3.24；历史 v0.3.21 截图被回归工具写入后已恢复，原文档校验结果脏文件保持本轮开始前的字节内容。没有修改生产密钥、短信、R2/CDN 或 HTTP webhook 路由。

生产发布需另行放行后先备份，再迁移 0017、更新应用和做公网旧缓存/实际账号验收。仍需 DingDong 提供真实自动 webhook 投递证据和正式账号/设备规则；CA 业务同事完成真实手机短信、实体 NFC、换手机号及多人共享演示的现场彩排。共享 Mock 展会体验可本地演示，不能称正式真实设备全链路已经完美。
