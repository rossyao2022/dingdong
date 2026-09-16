# 运营后台全量功能验收 · 逐项演示记录（v0.3.6 / 2026-09-15）

- 日期：2026-09-15（Asia/Shanghai）
- 线上版本：**0.3.6**（本轮**未改运行代码、未发新版**）
- 公网入口：运营后台 `http://110.42.225.196/ops/` ，家长端 `http://110.42.225.196/dingdong/` ，Django 后台 `http://110.42.225.196/admin/`
- 本轮证据目录：[evidence/acceptance-round-20260915/](evidence/acceptance-round-20260915/)
- 上一轮交付：[运营后台界面改版交付与验收 v0.3.6](OPS_CONSOLE_UI_20260914_V036.md)

---

## 0. 先看这一条：内置浏览器演示**未完成（工具阻塞）**

用户要求"优先用 browser use 控制内置浏览器逐项演示"。**本会话内置浏览器控制工具不可用**，
因此该交付项**明确保留未完成状态**：

| 尝试 | 调用 | 返回 |
| --- | --- | --- |
| 工具检索 | `tool_names=["cua.createBrowserTab","cua.getState","open_in_codex","browser_use"]` | 三者均 **Not found** |
| 直接调用 | `open_in_codex`（url=`/ops/login/`） | `Tool "open_in_codex" is not available in the current environment or configuration.` |
| 直接调用 | `cua.createBrowserTab`（type=iab, visible=true） | `Tool "cua.createBrowserTab" is not available in the current environment or configuration.` |
| 直接调用 | `cua.getState` | 同上（工具未注册） |

注意：本轮是**工具未注册**，不是前几轮的"调用超时 / 返回 queued"。按用户要求只做有限次恢复尝试，未反复重试。
原始记录：[inner-browser-probe.txt](evidence/acceptance-round-20260915/inner-browser-probe.txt)。

**因此：本文所有交互与截图都来自真实 Chrome（Playwright `channel: chrome`），属于用户定义的"外部 Chrome"一类，
没有冒充内置浏览器演示。** 本会话可用的浏览器自动化只有 `agent-browser` / `playwright-cli` 两个技能，
它们都会启动真实 Chromium，不是 WorkBuddy 内置浏览器面板。

---

## 1. 结论

- **13 项功能验收全部通过**：`14 passed / 12 skipped / 0 failed`（skipped 全是桌面/窄屏视口分工）。
- **本轮没有发现产品缺陷**，因此**没有发布新版本**（线上仍是 0.3.6）。
  上一轮界面改版已把界面统一到组件体系；本轮做的是"按运营实际工作流把每个功能真的走一遍"，
  不做重复的功能改动，也不把上一轮已通过的项重新描述成缺陷。
- 演示记录可查：逐项 `操作—预期—实际` 见 [tour-log.jsonl](evidence/acceptance-round-20260915/tour-log.jsonl)，
  原始运行输出见 [tour-run.txt](evidence/acceptance-round-20260915/tour-run.txt)，
  关键截图 44 张在 [shots/](evidence/acceptance-round-20260915/shots/)（本稿引用的 44 张与目录内容一一对应，目录内无未引用残留）。
- 本轮测试对象已定向清理（见第 6 节），未触碰真实家庭与历史测试数据。

---

## 2. 环境与版本核对（动手前先核对，避免为空验收发新版）

| 项 | 实测 |
| --- | --- |
| 本地分支 / HEAD | `codex/release-v0.3.6` / `40382c9` |
| 标签 | `v0.3.6` → `5d8d96e`（与 `VERSION=0.3.6` 一致） |
| 远端镜像 | `dingdong-backend:0.3.6`、`dingdong-web:0.3.6`，容器全部 Up/healthy |
| 远端 `RELEASE.json` | `version 0.3.6`，`commit c51c2e4…`（最后一次**运行代码**提交；其后只有文档提交） |
| 公网入口 | `/ops/login/` 200、`/ops/` 302→登录、`/dingdong/version.txt` = `0.3.6`、`/api/v1/runtime` = demo、`/admin/` 302 |
| 页脚与缓存击穿 | 登录后页脚显示 `界面版本 0.3.6`，静态资源 URL 带 `?v=` |

**结论：线上已经是正确版本且健康，无功能改动 → 本轮不发布新版本。**

---

## 3. 逐项演示

记录方式：每一项按运营真实操作顺序执行，逐步截图；`tour-log.jsonl` 中每行是
`{item, step, expected, actual, ok}`，`actual` 都是页面上真实观测到的文字/状态码，不是照抄预期。
运行脚本：[frontend/deployment-tests/ops-demo-tour.spec.js](../frontend/deployment-tests/ops-demo-tour.spec.js)；
复现方式见第 7 节。

| # | 功能 | 结果 | 关键截图 |
| --- | --- | --- | --- |
| 1 | 登录、错误提示、退出后访问拦截 | 通过 | [错误密码](evidence/acceptance-round-20260915/shots/01-login-wrong-password.png) · [登录成功](evidence/acceptance-round-20260915/shots/02-login-success-home.png) · [退出后被拦](evidence/acceptance-round-20260915/shots/03-after-logout-blocked.png) |
| 2 | 工作首页、角色对应导航与待办 | 通过 | [管理员首页](evidence/acceptance-round-20260915/shots/04-home-admin-nav.png) · [运营角色导航](evidence/acceptance-round-20260915/shots/05-home-operator-nav.png) |
| 3 | 家庭查询、家庭与儿童详情 | 通过 | [按称呼检索](evidence/acceptance-round-20260915/shots/06-families-search.png) · [家庭详情](evidence/acceptance-round-20260915/shots/07-family-detail.png) · [儿童详情](evidence/acceptance-round-20260915/shots/08-child-detail.png) |
| 4 | 儿童资料更正与跨入口冲突恢复 | 通过 | [运营旧页面被挡](evidence/acceptance-round-20260915/shots/09-conflict-ops-stale-save.png) · [加载最新档案](evidence/acceptance-round-20260915/shots/10-conflict-load-latest.png) · [恢复后保存成功](evidence/acceptance-round-20260915/shots/11-conflict-resolved.png) |
| 5 | 题库新建→校验→发布→复制→停用 | 通过 | [新建表单](evidence/acceptance-round-20260915/shots/12-questionnaire-new-form.png) · [编辑](evidence/acceptance-round-20260915/shots/13-questionnaire-edit.png) · [发布前校验](evidence/acceptance-round-20260915/shots/14-questionnaire-publish-blocked.png) · [发布后列表](evidence/acceptance-round-20260915/shots/15-questionnaire-published-list.png) · [复制草稿](evidence/acceptance-round-20260915/shots/16-questionnaire-copied-draft.png) |
| 6 | 活动新建→材料/步骤/风格→发布 | 通过 | [新建表单](evidence/acceptance-round-20260915/shots/17-activity-new-form.png) · [编辑](evidence/acceptance-round-20260915/shots/18-activity-edit.png) · [发布后列表](evidence/acceptance-round-20260915/shots/19-activity-published-list.png) |
| 7 | 不同内容独立、旧版本与编辑冲突保护 | 通过 | [两份内容各自在线](evidence/acceptance-round-20260915/shots/20-content-independence.png) |
| 8 | 报告查看与失败任务重试 | 通过 | [报告详情](evidence/acceptance-round-20260915/shots/21-report-detail.png) · [问题任务列表](evidence/acceptance-round-20260915/shots/22-jobs-problem-list.png) · [失败任务详情](evidence/acceptance-round-20260915/shots/23-job-failed-detail.png) · [重试成功](evidence/acceptance-round-20260915/shots/24-job-retried.png) |
| 9 | 服务事项筛选→详情→处理→留痕 | 通过 | [筛选](evidence/acceptance-round-20260915/shots/25-services-filtered.png) · [详情](evidence/acceptance-round-20260915/shots/26-service-detail.png) · [处理完成](evidence/acceptance-round-20260915/shots/27-service-handled.png) |
| 10 | 临时账号创建、角色权限、停用与登录拦截 | 通过 | [新建表单](evidence/acceptance-round-20260915/shots/28-account-new-form.png) · [已创建](evidence/acceptance-round-20260915/shots/29-account-created.png) · [新账号越权 403](evidence/acceptance-round-20260915/shots/30-account-role-403.png) · [账号详情](evidence/acceptance-round-20260915/shots/31-account-detail.png) · [已停用](evidence/acceptance-round-20260915/shots/32-account-disabled.png) · [停用后无法登录](evidence/acceptance-round-20260915/shots/33-account-disabled-login-blocked.png) |
| 11 | 操作审计权限、查询与非法筛选恢复 | 通过 | [内容运营 403](evidence/acceptance-round-20260915/shots/34-audit-content-403.png) · [非法日期提示](evidence/acceptance-round-20260915/shots/35-audit-invalid-date.png) · [审计列表](evidence/acceptance-round-20260915/shots/36-audit-list.png) |
| 12 | 通用交互与视觉：确认弹窗 / 403 / 404 / 窄屏 | 通过 | [确认弹窗](evidence/acceptance-round-20260915/shots/confirm-dialog.png) · [403](evidence/acceptance-round-20260915/shots/37-error-403.png) · [404](evidence/acceptance-round-20260915/shots/38-error-404.png) · [窄屏首页](evidence/acceptance-round-20260915/shots/39-narrow-home.png) · [窄屏列表](evidence/acceptance-round-20260915/shots/40-narrow-families.png) |
| 13 | 家长端必要回归：登录→档案→保存 | 通过 | [家长首页](evidence/acceptance-round-20260915/shots/04-parent-home.png) · [编辑档案](evidence/acceptance-round-20260915/shots/05-parent-edit-profile.png) · [保存后](evidence/acceptance-round-20260915/shots/06-parent-saved.png) |

### 逐项的实际观测（摘自 tour-log.jsonl）

| 项目 | 操作 | 预期 | 实际 |
| --- | --- | --- | --- |
| 1 | 故意输错密码登录 | 提示无法登录、不进入后台 | 页面显示"无法登录" |
| 1 | 正确密码登录 | 进入工作首页、页脚显示界面版本 | 工作首页可见；页脚 `… 界面版本 0.3.6` |
| 1 | 退出后直接访问 `/ops/families/` | 跳回登录页 | URL 变为 `/ops/login/?next=/ops/families/` |
| 2 | 管理员首页 | 统计/待办/快捷入口 + 9 个导航项全在 | 全部可见 |
| 2 | 运营角色看侧边导航 | 只出现有权限的项 | 题库/活动/生成任务/账号与权限**均不出现** |
| 3 | 按称呼检索→家庭→儿童详情 | 唯一命中、聚合区块、不出现 UUID | 唯一命中；含基本信息/答卷/报告与画像；正文无 UUID |
| 4 | 家长端（真实 API）改档 | 成功并推进修订号 | `PATCH /api/v1/children/<id>` → **200** |
| 4 | 运营旧页面保存 | 报冲突、保留输入、不覆盖 | 出现"保存冲突"，输入仍为"-运营改" |
| 4 | 加载最新档案后重新提交 | 冲突可恢复 | 显示"档案已更新" |
| 5 | 没加题目就发布 | 给出发布前校验 | "还不能发布，请先处理以下问题：" |
| 5 | 补一道题后发布 | 确认后发布成功 | "题库版本已发布"，列表显示已发布 |
| 5 | 已发布版本复制为新版本 | 生成新草稿、不可原地改 | "已创建草稿"，进入新草稿编辑页 |
| 6 | 维护材料/风格/步骤后发布 | 发布成功 | "活动版本已发布"，列表已发布 |
| 7 | 标题相近的两份题库各自发布 | 两份独立内容都在线 | 系统编号 `qn-…5161350b6ec1` ≠ `qn-…ffeb598d5b7d`，两份均"已发布" |
| 8 | 查看报告内容 | 展示正文与生成状态 | 详情页出现"报告：…"与"生成状态" |
| 8 | 重试本轮隔离失败任务 | 业务语言在前、可重排、不可重复重试 | "已重新排队"；刷新后重试按钮消失 |
| 9 | 筛选本轮隔离事项并处理 | 处理成功、留痕 | "事项已标记为完成"；刷新后说明与已完成状态仍在 |
| 10 | 新建仅运营角色的临时账号 | 创建成功 | 详情页提示"已创建账号 acptdemo_tmp…" |
| 10 | 新账号访问账号管理 | 服务端拒绝 | "权限不足"（403） |
| 10 | 停用该账号 | 状态变化 | 详情页按钮翻转为"启用账号" |
| 10 | 已停用账号尝试登录 | 拒绝登录 | "无法登录" |
| 11 | 内容运营访问审计 | 403，且首页无审计区块 | "权限不足"，首页无"最近操作" |
| 11 | `?start=2026-99-99` | 返回 200 并给中文提示 | 200，提示"不是有效日期"并回显原值 |
| 12 | 403 / 404 错误页 | 状态码与页面正确、不白屏 | 403=权限不足页，404="没有找到这条记录" |
| 12 | 危险操作确认弹窗 | 说明影响、要求确认、取消不执行 | 弹窗出现并给出影响说明，取消后关闭 |
| 12 | 390×844 窄屏 | 导航可展开、无横向溢出 | 横向溢出 **0px** |
| 13 | 家长登录→改档案→保存 | 保存成功、刷新可见 | "档案已更新"，刷新后新称呼可见 |

### 关于第 8 项"报告查看"的如实说明

本轮隔离对象是用 `inject_fixture --scenario report_retry` 注入的**失败**报告任务，
所以按该儿童筛选报告列表时通常还没有"已生成"的报告；脚本在这种情况下回退到列表首行做**只读**查看，
用来验证报告详情页本身可打开、正文与生成状态正常。**没有修改任何既有报告数据。**

---

## 4. 本轮发现的问题与处理（如实写：没有产品缺陷）

按用户要求"发现的阻塞缺陷要修复、部署并复验"，本轮实际处理的是**测试侧**的问题，
没有改动任何运行代码：

| # | 现象 | 根因 | 处理 |
| --- | --- | --- | --- |
| 1 | 报告页点"筛选"一直等待 | 报告页的按钮文案是"查询"，不是"筛选" | 改脚本用"查询"；已通过 |
| 2 | 新建账号后断言"列表可见"失败 | 创建成功后进入**账号详情页**，不在列表页；且列表会分页 | 先断言详情页提示，再用列表自带的 `?q=` 搜索定位 |
| 3 | 审计非法日期断言拿到 403 | 脚本当时还是**内容运营**会话，而 `content` 没有 `audit.view` | 先切回管理员再验；**这个 403 恰好证明权限拦截是真在服务端生效的** |
| 4 | 404 断言报 strict mode 冲突 | 页面同时有面包屑"没有找到对应的业务记录"与正文"没有找到这条记录" | 改用正文精确文案 |
| 5 | 家长端窄屏等待"账户与关联"超时 | 窄屏下侧栏是隐藏的，该文案不可见 | 改为等应用自己的无障碍就绪标记 `#main[aria-busy!=true]` |
| 6 | 确认弹窗没截到图 | 脚本取的是本轮账号列表第一行，正好是**当前登录的自己**，详情页不给"停用自己"的按钮 | 改用本轮另一个账号；并把这段从"条件执行"改为硬断言 |
| 7 | 第二次整轮重跑时第 8/9 项失败 | 失败任务只能重试一次、服务事项只能处理一次，**是一次性状态变更** | 为本轮重新准备一份隔离对象后整轮重跑；不是产品问题 |

> 说明：这些都不是"把已通过的项目说成缺陷"，而是本轮新写演示脚本自身的第一次失败，
> 按要求保留了首次失败与修正后的复验（见 `tour-run.txt` 与 `tour-log.jsonl` 的时间顺序）。

**结论：线上仍为 0.3.6，不发布新版本。**

---

## 5. 截图来源说明（必须看清）

| 项 | 说明 |
| --- | --- |
| 截图来源 | **真实 Chrome**（Playwright `channel: chrome`），访问**公网真实入口** `http://110.42.225.196` |
| 是否内置浏览器 | **不是**。本会话内置浏览器控制工具不可用，见第 0 节 |
| 是否拦截接口 | 不拦截。走真实登录表单、真实 CSRF、真实接口、真实数据库，不 mock 成功 |
| 数据 | 全部是本轮新建的**隔离合成对象**（称呼前缀 `演示验收儿童*`）与空表单；截图不含密码、令牌与真实家庭资料 |
| 敏感信息 | 登录密码只经环境变量注入，未写入仓库、证据或截图；会话凭据未落盘 |

---

## 6. 测试数据与清理

- 隔离对象（真实链路创建，见 [prepare-data.py](evidence/acceptance-round-20260915/prepare-data.py)）：
  本轮真实家长 API 建的隔离家庭与儿童（前缀 `演示验收儿童*`）、容器内 `inject_fixture --scenario report_retry`
  注入的失败任务、同一儿童通过真实家长 API 提交的 support 服务事项。
- 本轮临时运营账号：`acptdemo_admin` / `acptdemo_operator` / `acptdemo_content`，以及演示中新建的 `acptdemo_tmp*`。
- 清理仍用**只做状态变更、不物理删除、补写审计**：
  [cleanup-acceptance-data.py](evidence/acceptance-round-20260915/cleanup-acceptance-data.py)，
  运行结果 [cleanup-run.txt](evidence/acceptance-round-20260915/cleanup-run.txt)。
  儿童→已归档、家庭→已关闭、题库/活动版本→已退役、账号→已停用；审计复用既有动作码。
- 只读探针：[probe-acceptance-data.py](evidence/acceptance-round-20260915/probe-acceptance-data.py)（按创建时间圈定本轮对象）。
- **真实家庭与更早轮次的历史测试数据本轮未动。**

### 清理实测结果（`cleanup-run.txt`）

| 计数项 | 清理前 | 清理后 | 稳态基线 | 一致 |
| --- | --- | --- | --- | --- |
| 在册家庭 | 21 | **10** | 10 | ✅ |
| 在册儿童 | 14 | **3**（`合成儿童1`/`合成儿童2`/`小易`） | 3 | ✅ |
| 已发布题库版本 | 19 | **2** | 2 | ✅ |
| 已发布活动版本 | 11 | **8** | 8 | ✅ |
| 启用工作人员 | 8 | **1**（`dingdong_admin`） | 1 | ✅ |
| 启用家长 | 21 | **10** | 10 | ✅ |

本轮状态变更明细：儿童归档 **11**、家庭关闭 **11**、题库版本退役 **17**、活动版本退役 **3**、
账号停用 **18**（`acptdemo_*` 7 个 + 本轮家长 11 个）、补写审计 **49** 条（`audit` 1117 → 1166，未删任何记录）。
清理前 21/14/19/11/8/21 与本轮新增量（家庭 +11、儿童 +11、题库 +17、活动 +3、工作人员 +7、家长 +11）逐项相减
正好回到基线，说明**本轮新增对象已全部识别、无漏项**。清理后公网入口复验：`/ops/` 302、`/dingdong/` 200、`/admin/` 302，服务正常。

---

## 7. 复现方式

```sh
# 1) 本轮隔离账号（密码本地生成，写入 600 权限临时文件，不落仓库）
B64=$(base64 < deploy/evidence/acceptance-round-20260915/prepare-accounts.py | tr -d '\n')
ssh dell "echo '$B64' | base64 -d > /tmp/dd-acct-demo.py \
  && docker cp /tmp/dd-acct-demo.py dingdong-demo-api-1:/tmp/ \
  && docker exec -w /app -e PYTHONPATH=/app \
       -e DJANGO_SETTINGS_MODULE=config.settings.deployment -e DD_PW='<本地生成>' \
       dingdong-demo-api-1 python /tmp/dd-acct-demo.py"

# 2) 隔离数据（真实家长 API + 容器内 inject_fixture），输出 child_id / failed_job
python3 deploy/evidence/acceptance-round-20260915/prepare-data.py

# 3) 逐项演示（真实 Chrome，公网入口；凭据必须 export 给 worker 子进程）
cd frontend && set -a && source /tmp/dd-demo-creds.env && set +a \
  && DD_BASE=http://110.42.225.196 npx playwright test \
     --config=playwright.public.config.js deployment-tests/ops-demo-tour.spec.js --reporter=list
```

`set -a; source 文件; set +a` 不能省：只 `source` 只是 shell 变量，Playwright 的 worker 子进程看不到，
会表现为所有用例在 `fill` 处报 `value: expected string, got undefined`。

---

## 8. 未验证与受限

- **内置浏览器逐项演示未完成**（工具未注册，见第 0 节）。这是本轮唯一未交付的项，
  不用外部 Chrome 或历史结果替代后宣布全部完成。
- **本轮不重跑后端与部署测试**：没有改动运行代码，后端 237 项 / 部署层 9 项是上一轮的既有结果，
  不记作本轮新通过。
- **未做独立第三方审计**（本轮的"独立界面抽验"另有其报告）。
- 公网仍是**明文 HTTP**（HTTPS 未启用），`*_COOKIE_SECURE` 为 `False`；切 https 需重新验收。
- 移动端只验到 **390×844**，未做真机验收。
- 演示边界不变：固定验证码 `00000`、数据来自数据库 fixture/测试输入、**不接真实供应商**、
  不采集真实指纹、探索体验不产出天赋或能力分数。

## 9. 回滚

本轮**没有发布新版本、没有改数据库迁移**（仍停在 `0007`），线上就是已验收的 v0.3.6，
无需回滚操作。常规回滚目标与步骤见 [回滚说明](ROLLBACK.md)。
