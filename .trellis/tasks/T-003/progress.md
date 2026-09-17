# T-003 进度

- 阶段：Plan 完成 / Implement 完成 / Verify 完成 / Finish 完成
- Plan：acceptance = backlog.md 每项含「用户在哪一步卡/困惑/不信任 / 现状 / 建议改法 / 完善还是扩散 / 工作量档位」五要素；「完善/扩散」判据写成"不新增对对方接口的依赖、不改契约边界、不改数据模型语义"；稳定性单列一节（错误态、空数据态、网络慢/断、celery 失败可见性、e2e 本地数据漂移 4 项）；只产出文档；`status: gated` + `gates.md` 有 `REQUEST T-003 review`。验证方式 = 真实浏览器走查（家长端 4173 + 运营后台 8017）+ `python3 scripts/audit_documents.py`（errors 为空）+ `git log` 首行。
- Implement 走查范围：家长端首页/今日陪伴/成长旅程/测评与报告/我的 DingDong/家长支持/账户与关联七视图、探索体验 4 题全流程、NFC 承接与绑定、退出登录 + `00000` 登录、错误验证码、空手机号、非法时间窗口、断网、4s 慢网、390×844 移动视口；运营后台工作首页/家庭与儿童/服务事项/报告管理/题库管理/活动管理/生成任务/CA 账户/账号与权限/操作审计十页 + 家庭详情 + 儿童详情 + 非法日期筛选 + 空结果筛选 + 390×844 移动视口。
- 改动文件：`.trellis/tasks/T-003/backlog.md`（新建）、`.trellis/tasks/T-003/shots/`（4 张 jpeg 证据）、`.trellis/tasks/T-003/progress.md`、`.trellis/tasks/T-003/report.md`、`.trellis/loop/queue.md`（T-003 status: todo → doing → gated）、`.trellis/loop/gates.md`（申请段追加 1 行）、`.trellis/loop/status.md`、`.trellis/workspace/yihu/experiment-log.md`
- 命令与结果：
  - `lsof -nP -iTCP:4173 -sTCP:LISTEN` → `node 61672 ... TCP 127.0.0.1:4173 (LISTEN)`；`lsof -nP -iTCP:8017` → `Python 61675 ... TCP 127.0.0.1:8017 (LISTEN)`；`curl` → `4173=200`、`8017ops=302`
  - 家长端绑定：`POST /api/v1/children/3ee48e40-3165-4ed8-a8e2-5fbc523c3892/ca-accounts` → 201，新号 `ca_01M2PZQM5RNBPNVQXJ5CXEWDMN`；运营端 `/ops/ca-accounts/` 列表 11 行含该号（服务儿童 呱呱 / 待接通 / 使用中）
  - 家长端脚本错误监听：六视图 `errs: []`
  - 断网（`Network.emulateNetworkConditions offline:true`）→ 可见文案「连接中断，操作结果可能尚未返回。请查询最新状态或重试。」
  - 慢网（latency 4000ms）→ 80ms/1580ms 采样均 `disabled=true`、文案「登录」、`main[aria-busy]="false"`
  - 空手机号 `POST /api/v1/auth/sms` → 422，界面文案 `请求字段不合法 [ErrorDetail(string='该字段不能为空。', code='blank')]`
  - 非法时间窗口 → 零请求、零提示；合法窗口 → `GET .../growth-overview?from=2026-09-01T00:00:00.000Z&to=2026-09-08T00:00:00.000Z` → 200
  - 运营端 `/ops/audit/?start=2026-13-45&end=abc` → 中文提示「开始日期"2026-13-45"不是有效日期（应为 2026-09-12 这样的真实日期），本次未按日期筛选。」（v0.3.3 修复仍有效）
  - `cd backend && .venv/bin/python -c "import re, django.template.base as b; print(bool(b.tag_re.flags & re.DOTALL))"` → `False`（跨行 `{# #}` 不生效的根因）
  - 模板扫描：ops 模板树内跨行 `{# #}` 共 **1** 处（`ops/ca_accounts.html:10-11`）
  - `python3 scripts/audit_documents.py` → `{"markdown_files": 80, "local_links_checked": 497, "archived_files_checked": 85, "operations": 55, "schemas": 65, "errors": []}`（计数与上轮相同：该脚本按设计排除 `.trellis`，见 `scripts/audit_documents.py:29`，故本轮新增的 task 文档不进它的统计）
- 下一步：无，任务 `gated`（等 orchestrator 批 `REQUEST T-003 review`）。
