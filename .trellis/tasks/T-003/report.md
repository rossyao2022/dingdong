# T-003 报告：产品体验与稳定性审计

## goal

以家长用户第一视角走一遍家长端（`http://127.0.0.1:4173/`，任意手机号 + 验证码 `00000`）与运营后台（`http://127.0.0.1:8017/ops/`，`admin` / `dingdong-admin`），结合 `PROJECT_MEMORY.md`、`需求/`、`设计/`，产出 `.trellis/tasks/T-003/backlog.md`。

## 实际做了什么

- **走查（真实 Chrome，浏览器扩展接管，非无头）**：家长端七视图（天赋探索/今日陪伴/成长旅程/测评与报告/我的 DingDong/家长支持/账户与关联）+ 探索体验 4 题全流程（含用途同意框、逐题保存、提交确认、完成摘要）+ NFC 承接与绑定 + 退出登录 + `00000` 登录（含错误验证码、空手机号、限频）+ 成长观察窗口（合法与非法区间）+ 断网 + 4s 慢网 + 390×844 移动视口；运营后台十页 + 家庭详情 + 儿童详情 + 非法日期筛选 + 空结果筛选 + 390×844 移动视口。
- **产出**：`backlog.md`（9 条家长端 + 5 条运营端 + 3 条缺口 + 5 条稳定性，每条含五要素）、4 张截图证据（`shots/`）。
- **未改任何代码**，未部署、未触碰生产。

## 验证命令与真实输出

```
$ lsof -nP -iTCP:4173 -sTCP:LISTEN   → node 61672 ... TCP 127.0.0.1:4173 (LISTEN)
$ lsof -nP -iTCP:8017 -sTCP:LISTEN   → Python 61675 ... TCP 127.0.0.1:8017 (LISTEN)
$ curl -o /dev/null -w '%{http_code}' http://127.0.0.1:4173/        → 200
$ curl -o /dev/null -w '%{http_code}' http://127.0.0.1:8017/ops/    → 302

$ (家长端绑定) POST /api/v1/children/3ee48e40-3165-4ed8-a8e2-5fbc523c3892/ca-accounts → 201
  → 新号 ca_01M2PZQM5RNBPNVQXJ5CXEWDMN；运营端 /ops/ca-accounts/ 共 11 行，含该号（服务儿童 呱呱 / 待接通 / 使用中 / 指纹 6948909c）

$ (家长端脚本错误监听，六视图遍历后) errs: []
$ (断网 Network.emulateNetworkConditions offline:true，点获取验证码)
  → 可见文案「连接中断，操作结果可能尚未返回。请查询最新状态或重试。」
$ (4s 慢网，点登录) 80ms 与 1580ms 两次采样均 { busy:"false", btnText:"登录", btnDisabled:true, spinner:false }
$ (空手机号) POST /api/v1/auth/sms → 422，界面文案 请求字段不合法 [ErrorDetail(string='该字段不能为空。', code='blank')]
$ (填手机号连点两次获取验证码) POST /api/v1/auth/sms → 429 / 429，界面文案「请稍后再次获取验证码」（可见）
$ (成长观察：起>止 点「查看这个窗口」) 零请求、零提示；合法区间 → GET /api/v1/children/<id>/growth-overview?from=2026-09-01T00:00:00.000Z&to=2026-09-08T00:00:00.000Z → 200
$ (运营端) /ops/audit/?start=2026-13-45&end=abc → 「开始日期"2026-13-45"不是有效日期（应为 2026-09-12 这样的真实日期），本次未按日期筛选。」
$ (运营端) /ops/jobs/?only_problem=1 → 「共 0 条，每页 20 条。」「没有符合条件的任务」「没有匹配的生成任务。」；select[name=only_problem].value == "1"
$ (运营端 CA 账户页现场读取) main.innerText 首行 = "{# 注意：Tabler 的 .alert 是 flex 容器，散落的文本节点会各占一列。 内容必须包在一个块级容器里，与其他页面保持一致。 #}"

$ cd backend && .venv/bin/python -c "import re, django.template.base as b; print(bool(b.tag_re.flags & re.DOTALL))"
  → False        # 跨行 {# #} 不被当注释，这就是上面那行注释被渲染出来的根因
$ (ops 模板树扫描跨行 {# #}) → total multiline {# #} blocks: 1
  → ('backend/dingdong_ca/ops/templates/ops/ca_accounts.html', 10, ...)

$ python3 scripts/audit_documents.py
{"markdown_files": 80, "local_links_checked": 497, "archived_files_checked": 85, "operations": 55, "schemas": 65, "errors": []}
```

## acceptance 逐条核对

- backlog.md 每项含五要素 → 是（9 + 5 + 3 + 5 条，每条都有「卡在哪 / 现状 / 建议改法 / 完善还是扩散 / 工作量档位」）。
- 「完善/扩散」判据写成"不新增对对方接口的依赖、不改契约边界、不改数据模型语义" → 是（文首判据段，每条按此判定；G-03 明确标为"既非完善也非扩散"的治理动作）。
- 稳定性单列一节，含错误态、空数据态、网络慢/断、celery 失败可见性、e2e 本地数据漂移 4 项 → 是（S-01…S-05）。
- 只产出文档、不改任何代码 → 是（`git show --stat` 只有 `.trellis/**` 下的文档与截图）。
- `status: gated` + `gates.md` 有 `REQUEST T-003 review` → 见收尾提交。

## 未验证项

- 8 个 `/api/v1/ca/*` 出站接口与换机"主动解绑"分支（代码内本就未实现，缺 D10/D12/D20）。
- 生产环境与部署（本轮只在本地 4173/8017 审计；C1 的 `0008` 迁移仍未上生产）。
- 真实手机硬件与真实短信（移动端只到 390×844 视口；验证码仍是 `00000`）。
- 阶段画像/数据同步失败在家长端的可见性（本地失败任务 0 条，验证需 `inject_fixture` 注入，本轮未注入）。
- `backlog.md` S-05 列的 4 项 e2e 本地数据漂移失败：**本轮未复跑**，按仓库纪律标注为文档记录而非现状。
- 运营后台写操作（发布/重试/冻结/删除）本轮一律未执行——只读审计。

## 偏离与理由

- 无范围偏离。补充说明两点执行选择：
  1. 运营后台十页的正文是用**同一浏览器会话内的 `fetch` + 解析**先扫一遍定位问题，再对可疑页（CA 账户、家庭与儿童、家庭详情、儿童详情、操作审计、生成任务）做**真实导航渲染 + 现场读取**复核；O-01 就是这么从"疑似"坐实成"可见缺陷"的。
  2. 本轮在本地库留下了 1 条 `CaAccount`（`ca_01M2PZQM5RNBPNVQXJ5CXEWDMN`，合成凭据）与 1 份探索体验答卷 + 1 条授权记录，均为走通家长端流程所必需；明细与清理建议写在 `backlog.md` 第六节。未修改任何既有业务数据。
