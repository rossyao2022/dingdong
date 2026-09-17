# T-024 报告（产品巡检，第二轮）

## goal

以家长第一视角（`http://127.0.0.1:4173/`）与运营视角（`http://127.0.0.1:8017/ops/`）把产品完整走一遍，结合 T-005…T-021 已合入的修复，找出**新的**真实卡点、困惑或不信任点，产出 `backlog.md` 并申请 review。只产出文档，不改代码。

## 实际做了什么

1. 环境核对并拉起前端：后端 8017 已在监听（`manage.py runserver`，PID 61723），PostgreSQL 55439 接受连接，Redis 56379 `PONG`，前端 4173 原本没起，本轮用 `npm --prefix frontend run dev` 拉起（日志 `.trellis/.runtime/t024-frontend.log`）。
2. 家长端走查两轮（第一轮采样间隔 1s 太短，拍到的是启动占位，第二轮改成等渲染完成）：
   - 登录页（空手机号 / 非法手机号 / 错误验证码 / 正确登录）、建档、未绑定空态（`#home` `#reports` `#settings` `#journey` `#services`，桌面 + 390×844）、绑定机器人（先错凭据后对凭据）、核验并关联、完整 22 题测评（同意 → 逐题 → 提交合成样例 → 完成页）、有结果后的报告页与首页、成长观察默认窗口与非法区间、6 个 `ca_display_*` 展示面场景、复测建议块与「先不测」回写、设置页与环境页收尾。
3. 运营端走查：未登录访问、错误口令、正确登录，14 个一级页 + 从列表页点进 12 个详情页，桌面 + 390×844。
4. 定点复现与证伪：
   - `diag-loading.mjs`：4 轮重载 `#home`，确认「正在连接成长空间…」不是卡死（2s 内渲染完）。
   - `diag-growth.mjs`：逐个注入展示面场景，确认「成长观察」默认是正常空态。
   - `diag-reassess2.mjs` / `diag-reassess-window.mjs`：复现复测回写 500 与错误提示落点。
   - `narrow-check.mjs`：390×844 下 5 个页面的横向溢出检查。
5. 产出 `backlog.md`：家长端 6 条（P-10…P-15）、运营端 2 条（O-06 / O-07）、T-003 已知未修复查 1 条（O-05）、稳定性 1 条（S-06）。

## 验证命令与真实输出（原样照抄）

```
$ lsof -nP -iTCP -sTCP:LISTEN | grep -E '4173|8017'
Python    61723 yihu    4u  IPv4 ...  TCP 127.0.0.1:8017 (LISTEN)
$ curl -s -o /dev/null -w "frontend %{http_code}\n" http://127.0.0.1:4173/
frontend 200
$ curl -s -o /dev/null -w "ops %{http_code} %{redirect_url}\n" http://127.0.0.1:8017/ops/
ops 302 http://127.0.0.1:8017/ops/login/?next=/ops/
$ pg_isready -h 127.0.0.1 -p 55439
127.0.0.1:55439 - 接受连接
$ redis-cli -p 56379 ping
PONG
```

定点复现（`diag-reassess2.mjs`，`diag-reassess.json`）：

```
verifyStatus = 201
postEvent    = 500
postBody     = "<!DOCTYPE html> … <title>IntegrityError
                at /api/v1/children/36ac77d5-3e87-42b3-89c5-2b6af2c2fbe8/reassessment/reassess_mock_001/response</title> …"
toast        = ""
ctaBefore    = "最近一段时间互动偏少，要不要重新测一次？\n\n建议时间 2026/9/22 01:00:00 · 机器人服务给出的原因：近期互动偏少\n\n重新测评\n先不测"
ctaAfter     = 与 ctaBefore 逐字相同
```

复现脚本 `diag-reassess-window.mjs`（`diag-reassess-window.json`）：

```
verifyStatus 422   postStatus 500
点击前「成长观察」区块：… 尚未关联机器人数据 / 暂无可展示的指标。 / 最近成功同步：尚无记录 …
点击后「成长观察」区块：… 服务返回了无法识别的响应。 / 查看这个窗口 …（其余逐字不变）
点击后唯一一条非 2xx 请求：500 /api/v1/children/214e1c85-…/reassessment/reassess_mock_001/response（HTML）
```

数据库事实（`manage.py shell`）：

```
fields: ['id', 'created_at', 'updated_at', 'event_id', 'ca_account', 'child', 'trigger_type', …]
count: 6
reassess_mock_001 95a869d5-c213-4794-81b7-57e9566ea9fe True 2026-09-17 18:31:40.533363+00:00
```

窄屏检查（`narrow-check.json`，390×844）：

```
ca_display_normal_art #home      scrollWidth 390  innerWidth 390
ca_display_normal_art #reports   scrollWidth 390  innerWidth 390
ca_display_normal_art #settings  scrollWidth 390  innerWidth 390
ca_display_normal_art #journey   scrollWidth 390  innerWidth 390
ca_display_normal_art #services  scrollWidth 390  innerWidth 390
ca_display_reassess   #reports   scrollWidth 390  innerWidth 390
```

加载态证伪（`diag-loading.json`，4 轮 `#home` 重载）：

```
round 1: settled at 2070ms -> 诊断儿童 · 成长空间 …
round 2: settled at 1015ms -> 诊断儿童 · 成长空间 …
round 3: settled at 2040ms -> 诊断儿童 · 成长空间 …
round 4: settled at 2039ms -> 诊断儿童 · 成长空间 …
BAD [ { "status": 401, "url": "http://127.0.0.1:4173/api/v1/auth/refresh" } ]   # 未登录时的首次刷新，属预期
```

运营端（`walk-ops.json`）：`ERRORS []`（14 个一级页 + 12 个详情页，`pageerror` 与 console error 均为 0）。

文档审计：

```
$ python3 scripts/audit_documents.py
{"markdown_files": 80, "local_links_checked": 504, "archived_files_checked": 85, "operations": 61, "schemas": 82, "errors": []}
```

## 未验证项

- 真源（`CA_DISPLAY_DATA_SOURCE=dingdong`）路径未走；本地为 `synthetic_fixture`，P-11 / P-13 / P-15 在真源下是否出现未验证。
- 生产环境未触碰；全部证据来自本机 4173 / 8017 与本地库 127.0.0.1:55439。
- 未做写操作：主动解绑、删除儿童数据、发布/停用内容版本（T-024 明确排除项）。
- 复测「重新测评」承接 22 题与 `switch_recommended` 真分支结果卡未在本轮重走（T-035 已用真实 Chrome 覆盖）。
- 生产 `DEBUG` 是否为 `False`、API 是否可能返回调试页，未验证。

## 偏离与理由

- **第一轮走查的等待时间设成 1s**，而应用启动约 2s，导致 8 张空态截图拍到的是「正在连接成长空间…」。发现后用 `diag-loading.mjs` 先证伪「卡死」假设，再重跑第二轮（`walk-parent2.mjs`，等渲染完成）——第一轮的加载态截图已从 `shots/` 删除，不作为证据。
- **原计划的 `#assessment` 路由直开不成立**：该路由需要 `#assessment/<id>`，直开落到「没有找到这个页面」。第二轮改走页面上的「开始测评」按钮，才是家长真实路径。
- **`#environment` 不是路由**（是 `index.html` 里的元素 id），直开自然 404，未计入缺陷。
- **一处自我纠正**：第二轮曾出现 `POST .../associations/verify` 422 `PROOF_INVALID`，一度当作缺陷候选；核对后确认是本轮脚本没先注入 `sync_success`（核验凭据由数据提供方登记），改用正确前置后 `verifyStatus = 201`，因此**不作为缺陷上报**。
- 任务只产出文档，未改任何产品代码。
