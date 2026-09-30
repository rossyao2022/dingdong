# 原型遗漏修复：真实浏览器验证

2026-09-30，本地 v0.3.21。实施由用户“按照建议进行修复”授权；本报告不代表生产发布。

## 本次交付

`frontend/app.js` 使用独立 `guide-preference.js`，网页原四类引导与 CA 既有活动 style 分开：

- 当前儿童偏好通过真实 GET/PATCH 保存，带 revision；刷新读取，换儿童、新增儿童、退出清理，异步响应检查身份/儿童/路由上下文。
- 从伙伴选择偏好到默认新活动直接采用“跟着引导”；新记录保存 `guide_mode`，旧 `style` 继续合法枚举。活动保存后改变偏好不会改写该活动。
- 可见引导与朗读调用同一个纯函数；自主探索显示活动替代方案；上一步使用现有带 revision 的 PATCH，刷新后保留。
- 伙伴页直达原四情境，恢复未完成答卷或回看已完成结果；服务端返回四类选择次数，重做建立同题库的新答卷，历史保留。
- 测评与报告、活动旅程、账户与探索结果可导出当前儿童的真实 JSON。固定日期文件名、不带儿童姓名；下载后和离开页面时释放 Blob URL。
- 旅程按全部/已完成/已跳过过滤，分页保持过滤范围，空状态对应当前筛选；换儿童、新建儿童重置筛选和游标。
- 家长支持补原文三问、报告入口与 CA 外链，外链有 `noopener noreferrer`；删去伙伴/活动页实现细节噪音。

## 先红后绿

新增 `frontend/tests/prototype-audit-fixes.spec.js`，最初在原版本真实 Chrome + 真实本地 API 下 **3 failed**：原四类偏好控件、活动 guide_mode 选择与伙伴四情境入口缺失。证据：`deploy/evidence/v0.3.21/browser-red.log`。

修复过程中真实测试另发现：导出触发的下载链接被已有 busy 导航拦截；新建儿童后旅程过滤没有复位。已分别修为仅放行本次受跟踪的 Blob 下载链接、建档时清理儿童上下文。过程中测试自身的同意弹窗等待和关闭按钮唯一定位也已修正，保留首次日志，不把脚本超时当成产品故障。

## 真实通过的不同用例：16 项

| 用例组 | 数量 | 证据 |
| --- | --- | --- |
| 新增偏好、活动引导/回退/过滤/导出、四情境/家长支持 | 3 | `deploy/evidence/v0.3.21/browser-final.log` |
| 六岛/九题、八维上下界/并列、过期、指纹临时预览、移动布局 | 6 | 同上 |
| 兴趣和八维历史结果重做、重新授权、刷新后新旧答卷分离 | 2 | 同上 |
| 固定码冷却；旧真实登录活动完成；22题授权/合成输入/独立 Worker 生成真实初始报告；首页所有菜单 | 4 | `deploy/evidence/v0.3.21/legacy-regression.log` |
| NFC URL 承接刷新、不存凭据、重新碰标签继续（浏览器模拟 URL） | 1 | `deploy/evidence/v0.3.21/nfc-regression.log` |

前三组 11 项 **11 passed (1.8m)**，旧链路 4 项 **4 passed (37.7s)**，NFC 1 项 **1 passed (3.2s)**。22题输入用合法 `inject_fixture` 和合成样本，最终由运行中的独立 Worker 生成报告，未直接创建成品 `ReportVersion`。Worker 当前 `pong`，证据 `isolated-worker.log`。

网页原四种话术实际不同；偏好默认带到新活动、旧活动冻结；上一步回退并刷新；过滤 21 条真实活动记录后分页完整；换到无活动儿童无旧记录；实际下载 JSON 解析为 `ca-child-export-v1`，所属儿童/记录/guide_mode 对应且不含 NFC、认证令牌、密码、采集图片/Blob，下载 URL 实际释放。

另由素材模块 agent 完成 **1 项**七旧链接真实 Chrome 路由兼容验证（7 URL），证据 `deploy/evidence/v0.3.21/legacy-browser.log`，不混入上述 16 项的数量。

## 截图与补充实际检查

`deploy/evidence/v0.3.21/shots/`：

- `repair-companion-390.png`：滚到真实四类偏好和四情境入口，保留 20px 间距，截图已目视。
- `repair-guidance-result-390.png`：真实四题完成后的服务端次数。
- `repair-guide-imitative-390.png`、`repair-activity-previous-390.png`：实际模仿话术和第二步回退按钮。
- `repair-journey-filter-390.png`：真实筛选结果。
- `repair-export-settings-390.png`：明确等待账户页导出面板出现，再滚到实际导出范围与按钮。
- `repair-parent-reflection-390.png`：原三问，未替换文案。
- `repair-ops-preview.png`、`repair-ops-preview-390.png`：运营整库 18 题、选岛实际 9 题说明和题目正文。初次运行的旧 `--noreload` 进程与新模板字段不同，重启后重新拍摄，当前图正文完整。
- `repair-ops-deletion.png`：独立合成 bound 儿童的实际删除请求返回 **409 CA_ACCOUNT_CONFLICT**，事项仍 open、儿童仍 active、bound 账号仍存在。真实本地运营权限会话，无生产凭据。

上述截图为真实浏览器视口图，非拼装画面；已目视主要家长操作和运营截图。附加检查在 320/390/768/1280 确认伙伴卡片至少 44px 触控区域、入口不贴卡、家长复盘对话框无横向溢出，见 `readable-repair-layouts.json`。运营 390 预览无横向溢出，见 `ops-repair-browser.json`。

## 运行及边界

本地前端 4175、后端 8020、schema `prototype_integration_final_20260930`，显式迁移 0015；短信配置是 `fixed_code`。前端代理 source 使用实际本机地址 `192.168.116.69`，没有改系统网络配置或禁用限流。

家长与运营截图全部来自隔离合成测试记录。复用既有有效本地 LoginGrant/运营测试会话拍图，没有为截图发新短信。**没有真实供应商短信、生产 API 业务写入、生产登录绕过、验证码破解或真实指纹上传**。NFC 用浏览器打开带参地址验证；真实手机、标签和 DingDong 设备/推送依然需要现场彩排，不能由这些截图替代。

本 agent 未提交/推送/部署，未读取生产密码或密钥，既有用户修改 `文档/文档校验结果.json` 未碰。任务最终提交、文档更新与 Trellis 收尾由主 agent 统一处理。
