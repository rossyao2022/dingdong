# v0.3.22 本地闭环浏览器验证

日期：2026-09-30。范围为已批准任务的本地实现与验收；本报告不表示已发布或真实供应商主动投递通过。

## 环境与边界

- Chrome / Playwright 使用实际页面、CA HTTP API、PostgreSQL 与独立 Celery Worker。前端4175、后端8020；供应商 URL/API key 为空，固定码登录先检查 runtime。未发送真实短信，未操作生产、远端或供应商写接口。
- 原 `prototype_integration_final_20260930` 隔离 schema 的旧 `ca_dingdong` 证据仍活跃。0016 标识迁移后正确阻止另一用户抢占。为保留旧证据，新建专属 `closed_loop_20260930`，执行0016及基础/模拟/原型内容初始化，没有归档旧证据、删除共享数据。
- 仅 runtime 的 `prototype_settings.py` 启用 demo 报告、合成 NFC 与本地签名密钥。后端和独立 Worker已重启；仅原专属隔离 beat停止，避免旧 schema 的定时任务进入新库。新22题报告使用 Worker真实任务生成，不插入成品 ReportVersion、不预置 initial_result。
- 设备绑定接口真实生成「待接通」账户；仅通过受限本地 CLI 把本测试新建合成设备行准备为 bound。这是明确的测试输入，不表示 DingDong 确认绑定。后续截图数据经真实 HMAC HTTP POST接收、处理、投影与授权 GET取得；未使用 route.fulfill 或浏览器造成功响应。
- 推送输入使用 `backend/tests/fixtures/prototype-insights.json` 的独立副本，修改时间、频率与合成里程碑（24有效轮次），未覆盖来源文件。四频率分别提供合法完整投影；前端不计算增长分数。

## 结果

**12个不同的真实 Chrome 用例全部通过**：新闭环4项、既有回归8项。补充1次定向 demo 复测验证最后的面板隐藏与图表结构，不重复计入用例总数。

| 范围 | 实际验证 |
| --- | --- |
| 普通机器人占用 | 同token第二儿童真实409；白话要求原家长先解绑；没有无效「读取最新」按钮；原家长解除后第二儿童新ULID且如实pending |
| 资料冲突 | 另一真实PATCH推进revision；旧页面收到EDIT_CONFLICT，能载入最新、重新修改和保存。纯函数亦保证REVISION_CONFLICT仍可刷新 |
| 普通新用户CA报告 | 无设备、无预置算法输入，22题真实保存、提交、Worker生成可读CA报告，专业结果暂无数据且不伪造能力分数 |
| 会展两家庭交接 | A有真实四题答案和Worker生成CA报告；B不同手机登录先409；A确认解绑后原行归档，原CA报告/答案可读；B同标签获新ULID/demo标识，pending，同标签重试复用 |
| 报告权限与同源显示 | pending提示连接，未授权只显示局部同意入口；新库尚无投影时局部读取失败，CA测评可用；合成bound+签名push后真实GET→8维SVG/8行数据；3/7/14/21按钮以真实响应选中，56个源数据点 |
| 刷新和撤回 | 新签名HTTP推送将陪伴值6更新为33，页面刷新读到33；A归档后GET404且图消失，B撤授权后同意提示且图消失；demo不显示旧正式伙伴/成长周期面板 |
| 旧核心回归 | NFC地址去凭据/刷新重碰；发码冷却；六岛选三顺序/九题保存/儿童隔离；24题min/max/ties和历史；过期草稿；四类指纹指南、临时预览不上传与清理 |
| 布局 | 模块320/390/768/1280无横向溢出、遮挡/坏图；新增报告四宽度无横溢出，390图表/解绑文字可读 |
| 运营只读页 | 合法本地技术角色session访问真实接收/快照页200，匿名302，内容角色403；处理结果为已形成快照；不显示签名/秘密/token；桌面与390无页面错误 |

定向单测20项通过（ca-link15、报告组件5），app及测试语法与diff空白检查通过。全后端/全前端数量由主 agent 的独立日志报告，未在此重复执行或累加。

## 证据

- 新闭环：`deploy/evidence/v0.3.22/browser-fresh.log`（4 passed，1.3m）。
- 最终面板/图表复测：`deploy/evidence/v0.3.22/browser-demo-final.log`（1 passed，47.0s）。
- 既有回归：`deploy/evidence/v0.3.22/legacy-browser.log`（8 passed，37.9s）。
- 运营：`ops-browser.json` / `ops-browser.log`，同v22证据目录。
- 单测：`frontend-targeted.log`；纯契约先红后绿：`ca-link-red.log` / `ca-link-green.log`。
- 最终标题布局：`report-title-layout.json/log`（320/390短语宽度均在内容区内）；
- 语法：`frontend-syntax.log`；本地迁移/导入：`local-new-migrate.log` / `local-new-import.log`。
- 新测试源码：`frontend/tests/prototype-closed-loop.spec.js`。

截图目录 `deploy/evidence/v0.3.22/shots/`。已目视CA报告390、伙伴报告390/320、曲线390、解绑390、运营1280：没有组件重叠，按钮及正文可读。仅`dingdong-report-full-390.png`是全页证据，其余为viewport截图，适合手册排版。

手册映射：

- `closed-ca-report-unbound-390.png`：新家长未绑定设备，真实22题Worker报告。
- `closed-dingdong-report-390.png`：真实验签投影GET的伙伴报告。
- `closed-unbind-390.png`：确认解绑及CA历史保留说明。
- `closed-ops-push.png`：真实本地技术接收列表和四频率快照。
- `dingdong-curve-390.png` / `dingdong-report-320.png` / `dingdong-report-full-390.png`：补充曲线/窄屏/全页审查。

## 尚未证明的事项

真实供应商绑定/自动milestone投递、真实手机碰实体NFC、v0.3.22公网部署验收均不属于本次合成隔离通过结论。发布与对方联调需主 agent依已有授权范围继续推进。320报告标题末字换行已由组件负责人修正为中文短语整体换行，并通过真实授权GET的320/390截图复核（`report-title-layout.json/log`），无溢出；没有重跑已通过的业务闭环。
