# T-042 报告：第四轮产品巡检（家长端 + 运营端）

## goal

以家长第一视角（`http://127.0.0.1:4173/`，任意手机号 + 验证码 `00000`）与运营视角（`http://127.0.0.1:8017/ops/`，`admin` / `dingdong-admin`）把产品再完整走一遍，重点复核 T-041 修复处（复测承接全流程、`switch_recommended` 结果卡两分支——上轮被 P-16 挡住）、`tests/flows.spec.js` 在短信频控窗口过后补跑补证据，找出**新的**真实卡点，产出 `.trellis/tasks/T-042/backlog.md` 并申请 review。

## 实际做了什么

只产出文档，**未改任何产品代码**。交付物：

- `.trellis/tasks/T-042/backlog.md`：家长端 2 条新条目（P-18、P-19）、运营端 3 条新条目（O-12、O-13、O-14）、稳定性 1 条（S-07）+ 一条 T-040 遗留 `console 401` 的定位、复核通过记录。
- 走查脚本与原始记录（均在 `.trellis/tasks/T-042/`）：`walk-parent.mjs` / `walk-parent.json` / `walk-parent.log`（复测真/假双分支 + 页面留档）、`walk-parent-pages.mjs` / `walk-parent-pages.json` / `.log`（各页正文留档 + 失败请求定位）、`walk-ops.mjs` / `walk-ops.json` / `.log`（运营端 12 一级页 + 9 详情页 + 8 张表逐行）、`probe-archive.mjs` / `probe-archive.json` / `.log`（归档换机探针）、`flows-run.log` / `flows-single-rerun.log`（`tests/flows.spec.js` 两次逐字输出）。
- `shots/` 71 张截图（含 390×844 与归档前后对比）。

## 验证命令与真实输出

### 复测全流程（acceptance 的额外项）

```
node .trellis/tasks/T-042/walk-parent.mjs
```
逐字输出（`walk-parent.log` / `walk-parent.json`）：

```
STEP switch: 建议出现 {"text":"最近一段时间互动偏少，要不要重新测一次？ | 建议时间 2026/09/30 17:00 · 这次建议的原因：近期互动偏少 | 重新测评 | 先不测"}
STEP switch: 「重新测评」回写 {"status":200,"request":{"request_id":"250927dd-de25-4ed5-bd60-5bbbab81ed27","accepted":true}}
STEP switch: 对话框跨过轮询 {"before":0,"after":1,"dialogOpen":true}
STEP switch: 回写完成 {"assessmentId":"4f9c1fba-aab2-4fe8-965f-8303b46f10dd"}
STEP switch: 结果卡 {"cardText":"这次复测的结果已经回写。 | 新角色推荐 | 新角色 Socrates · 匹配度 86 / 100 | 当前角色匹配度 | 69 / 100 | 匹配度变化 | 17 | 换人设需要你确认，我们不会自动更换；确认入口尚未开放，现在只展示建议。 | 建议时间 2026/09/30 17:00 · 这次建议的原因：近期互动偏少","expectSwitch":true,"overflow":0}
STEP keep: 「重新测评」回写 {"status":200,"request":{"request_id":"4730921a-357e-4a6e-ac0f-227c68d09ba5","accepted":true}}
STEP keep: 对话框跨过轮询 {"before":0,"after":0,"dialogOpen":true}
STEP keep: 回写完成 {"assessmentId":"d80da1d3-56a0-4c77-b832-6c86db09d5a7"}
STEP keep: 结果卡 {"cardText":"这次复测的结果已经回写。 | 保留当前角色 | 当前角色匹配度 | 73 / 100 | 新角色与当前角色的匹配度差别不大，继续用现在的陪学伙伴。 | 建议时间 2026/09/22 01:00 · 这次建议的原因：近期互动偏少","expectSwitch":false,"overflow":0}
STEP page home {"overflow":0}
STEP page explore {"overflow":0}
STEP page journey {"overflow":0}
STEP page reports {"overflow":0}
STEP page companion {"overflow":0}
STEP page settings {"overflow":0}
STEP page services {"overflow":0}
ERRORS ["console: Failed to load resource: the server responded with a status of 401 (Unauthorized)","console: Failed to load resource: the server responded with a status of 401 (Unauthorized)"]
```

真分支结果卡有「新角色 Socrates · 匹配度 86 / 100」；假分支结果卡**没有**新角色名，只有「保留当前角色 / 当前角色匹配度 73 / 100」。走完全程后人设卡仍是原角色（真分支 Mia、假分支 Newton，见 `walk-parent-pages.json` 的 `persona` 与 `shots/switch-06-result-card-desktop.png`），无自动切换。假分支那次 `growth-overview` 请求数 `0 → 0`（观察已同步、轮询没在跑），所以「跨过轮询」这条只由真分支的 `0 → 1` 证；两分支都另有「点后 4 秒 `#dialog.open === true`」的硬断言。

### `tests/flows.spec.js`

```
cd frontend && npx playwright test tests/flows.spec.js --reporter=list
  1 failed / 7 passed (2.8m)
  失败：tests/flows.spec.js:151:1 › 用途授权、22题、合成输入、真实初始报告
        Error: expect(locator).toBeVisible() failed
        Locator: getByRole('button', { name: '查看初始报告', exact: true })
        Error: element(s) not found

cd frontend && npx playwright test tests/flows.spec.js --grep "用途授权、22题" --reporter=list
  1 failed (1.0m)   ← 同一断言、同一行，可复现，非偶发
```

**归因（不是短信频控）**：库里 1 小时窗口内 `SmsChallenge` 共 **27** 条，未触 IP 上限 50。失败会话 `ee0a1775-bb24-4f19-9860-07fa67ae3e31` 的时间线是算法处理尝试 `created 23:12:05 / started 23:12:13 / succeeded 23:12:14`、`ProfileSnapshot 23:12:06`、报告 job `created 23:12:06 / succeeded 23:12:14`、报告 `created 23:12:14`——而样本提交在其前约 50 秒。本地 Celery 是 `--pool=solo` 单线程，同一时刻 beat 的 `dispatch_pending` / `recover_assessments` 与成批 `sync` 任务在排队（`walk-ops.json` 的 jobs 表同一时刻大量「排队中 0 / 5」），报告就绪被挤出用例的 20 秒窗口。已按 acceptance 如实记录（S-07）。

### 运营端

```
node .trellis/tasks/T-042/walk-ops.mjs
  12 个一级页全部 status 200；9 个详情页全部 200
  ROWS services   → "未填写 +8613809963371"（同号只出现一次）
  ROWS ca-accounts→ "未上报 凭据前 8 位 50dc9a0a"
  ROWS activities → "创意想象 · 平静如水"
  ROWS families   → "未填写 | +8613808528387"
  ERROR: ERRORS []
```

### 归档换机探针

```
node .trellis/tasks/T-042/probe-archive.mjs
STEP 归档请求 {"status":200,"url":"http://127.0.0.1:4173/api/v1/ca-accounts/ca_01M2RTXHQCSC38904G0SYMQTPJ/retire","body":{}}
STEP 归档后 #settings → "换机探针儿童 还没有机器人账户号。…绑定机器人" + "机器人数据关联 已核验 · 同步已启用 / 最近成功同步：尚无记录"
STEP 归档后 #reports  → 陪学伙伴 / 互动健康度 / 成长周期报告三处"还没有绑定机器人"，同页"成长观察"仍是"正在等待首次同步 / 暂无可展示的指标"
```

### 文档门禁

```
python3 scripts/audit_documents.py
{"markdown_files": 80, "local_links_checked": 514, "archived_files_checked": 85, "operations": 61, "schemas": 83, "errors": []}
```

## 取证命令（库内事实，逐条可复跑）

```
cd backend && uv run --no-sync python manage.py shell -c "
from dingdong_ca.core.models import DataRequest
row = DataRequest.objects.get(id='d01f56e3-12c5-4ef7-a678-58d27ec1480d')
qs = DataRequest.objects.filter(child=row.child).order_by('-created_at')
print('siblings for same child:', qs.count())
for r in qs: print('  ', r.id, r.kind, r.status, r.created_at, 'is_current=', r.id==row.id)
"
→ siblings for same child: 1
→   d01f56e3-12c5-4ef7-a678-58d27ec1480d support open 2026-09-17 11:24:19.764037+00:00 is_current= True

cd backend && uv run --no-sync python manage.py shell -c "
from dingdong_ca.core.assessment_models import BackgroundJob
from django.db.models import Count
print('failed by kind:', list(BackgroundJob.objects.filter(status='failed').values('kind').annotate(n=Count('id'))))
print('report failed:', BackgroundJob.objects.filter(kind='report', status='failed').count())
print('all failed:', BackgroundJob.objects.filter(status='failed').count())
"
→ failed by kind: [{'kind': 'sync', 'n': 4}]
→ report failed: 0
→ all failed: 4

cd backend && uv run --no-sync python manage.py shell -c "
from dingdong_ca.core.assessment_models import AssessmentSession, AlgorithmAttempt, ProfileSnapshot, ReportVersion, BackgroundJob
s = AssessmentSession.objects.get(id='ee0a1775-bb24-4f19-9860-07fa67ae3e31')
att = AlgorithmAttempt.objects.filter(session=s).order_by('-attempt_no').first()
print('att', att.created_at, att.updated_at)
prof = ProfileSnapshot.objects.filter(algorithm_attempt__session=s).first()
rep = ReportVersion.objects.filter(profile=prof).first()
job = BackgroundJob.objects.filter(profile=prof).first()
print('prof', prof.created_at, 'rep', rep.created_at, 'job', job.created_at, job.finished_at)
"
→ att 2026-09-17 23:12:05.572660+00:00 2026-09-17 23:12:06.271144+00:00
→ prof 2026-09-17 23:12:06.308081+00:00 rep 2026-09-17 23:12:14.379914+00:00 job 2026-09-17 23:12:06.403781+00:00 2026-09-17 23:12:14.141500+00:00
```

读码定位（只读，未改）：

- P-18：`frontend/app.js:507`（人设卡 `p.note` 里的「（中文对照由我方按取值直译，对方 code 表确认后核对；悬停可看原始取值）」）。
- P-19：`backend/dingdong_ca/core/services/ca_account.py:190` 的 `retire_account()` 只改账户状态、不动 `ExternalAssociation`。
- O-12：`backend/dingdong_ca/ops/services.py:307`（`counters["failed_jobs"]` 不分 kind）+ `ops/templates/ops/dashboard.html:27`（标签写死「报告生成异常」）+ `:137`（区块同样不分 kind）；同文件 `:310` 的 `failed_report_jobs` 未被这个卡片使用。
- O-13：`backend/dingdong_ca/ops/views.py:623`（`child_requests=DataRequest.objects.filter(child=row.child)`，未排除 `row`）。
- O-14：`backend/dingdong_ca/ops/services.py:322`（`order_by("created_at")[:5]`）+ `ops/templates/ops/dashboard.html:105`（区块说明未写条数上限）。

## 未验证项

1. 真源模式（`CA_DISPLAY_DATA_SOURCE=dingdong` 且已配置）与生产未测，与历轮一致；本轮未重跑源开关未配置分支（T-040 已覆盖）。
2. `frontend/deployment-tests/parent-conflict-recovery.spec.js`：指向公网入口、需管理员凭据、会在生产库建账号，属权限边界外的远端写操作，未跑。
3. `tests/flows.spec.js` 的完整回归仍未跑绿——S-07 已把根因定位到本地单线程 worker 排队（非产品缺陷、非频控），本轮未改用例、未重启 worker（重启会顺带执行队列里的历史任务，不属本任务范围）。
4. 复测「结果卡刷新后」的表现未重复取证（T-035 已记「GET 事件字段不含名字与分数，刷新后只剩中性说明」）。

## 偏离与理由

1. **多跑了一次 `flows.spec.js` 单用例**：acceptance 只说「本地跑通或如实记录频控仍不足」。首次全量跑 1 失败后，为把「频控」与「真实环境原因」分开，单独复跑了失败用例并读库取证，结论是单线程 worker 排队而非频控——这一步是必要的，否则会沿 T-041 的「频控」结论误判。
2. **额外做了「归档旧号」探针**（不在 acceptance 明列范围）：T-039 的「换机后旧号人设只读展示」被 orchestrator 裁定为不做，但家长实际会点「归档这个号」，这条路径没人走过。探针跑出一个真实的状态不一致（P-19）。范围上仍属「走查现有功能找卡点」，未改代码。
3. **首轮脚本两处自身缺陷，已修正后重跑，未计入产品问题**：①第二个儿童的 `login()` 没先退出，浏览器上下文仍登录着，登录页不出现手机号输入框（`locator.fill: Timeout 30000ms`）——已加 `logout()`；②页面留档首次只等了 1200ms，拍到的是「正在连接成长空间…」首帧——已改成等 `#main` 正文长度 > 120 再取，第一版数据已由 `walk-parent-pages.json` 覆盖。归档探针第一版点错按钮（点到「暂不归档」），`status: null`，修正为 `确认归档这个号` 后重跑得 `status: 200`。
4. **未把「家长端 401」写成缺陷**：定位到 `POST /api/v1/auth/refresh` 后，读码确认 401 由未登录启动探测产生且被 `catch` 接住（`frontend/app.js:1991`），按「如实记录、不拔高」写在「已定位」一节而非缺陷条目。

## 收口

- 本任务 `gate: review`，`queue.md` 的 `status` 已改 `gated`，`gates.md` 申请段已追加 `REQUEST T-042 review ...`。
- 未 push（review 类任务按 T-024/T-040 先例逐条申请，等 orchestrator 复看后再决定导入哪些条目）。
