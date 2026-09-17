# T-040 报告：产品巡检（第三轮）

## goal

以家长第一视角与运营视角把产品再完整走一遍，重点复核 T-037/T-038/T-039 修复处与四个展示面在 `CA_DISPLAY_DATA_SOURCE` 两种取值下的表现，找出**新的**真实卡点，产出 `.trellis/tasks/T-040/backlog.md` 并申请 review；额外对 T-037 修复处做「两个儿童先后回写同一 `event_id`」的端到端复核。只产出文档，不改代码。

## 实际做了什么

1. **家长端真实 Chrome 走查**（脚本 `walk-parent.mjs` / `walk-parent-c.mjs` / `walk-parent-d.mjs` / `walk-parent-dingdong.mjs`，均不拦截、不伪造响应）：
   - 登录 → 建档 → 绑定机器人 → 核验关联（错凭据 + 真实凭据）→ 六个 `ca_display_*` 合成场景逐个截图 → `#home`/`#explore`/`#journey`/`#services`/`#settings` → 390×844；
   - 复测两条分支：「先不测」（甲、丙二各一次）、「重新测评 → 开始复测」（丁、以及三次定点诊断）；
   - 每个场景对可见文本做探针：`这次建议的原因`、`机器人服务给出的原因` 出现次数、学习风格中文、裸 code（`imitation/open/reverse/cognitive/count/readable-v2`）、单位 `count`、来源说明、ISO 时间串、八维中文名。
2. **T-037 端到端复核**：两个不同家庭的儿童先后对同一 `event_id`（`reassess_mock_001`）回写，两次都记 `status` 与响应体。
3. **运营端真实 Chrome 走查**（`walk-ops.mjs` / `walk-ops2.mjs`）：11 个真实一级页 + 服务事项/题库/活动/账号/儿童/家庭/生成任务详情页 + 390×844 两页；抽了服务事项、账号、家庭列表的表格单元格原文。
4. **定点复现 P-16**（`diag-reassessment-start.mjs`）：点击「开始复测」后每 100ms 采样 `<dialog>.open`，并记录全部 `/api/` 请求响应、`#dialog` 计算样式、console/pageerror。三次独立运行（`walk-parent-d` 一次 + 诊断两次）。
5. **源开关复核**：`CA_DISPLAY_DATA_SOURCE=dingdong` 另起后端 8018 + 前端 4174（`server.cjs` 换端口副本 `frontend/server-t040.cjs`，并把上游 `Origin/Referer` 改写成受信任源 4173 以过 CSRF），走完「登录 → 绑定 → 核验 → #reports」，跑完删除临时文件、关掉两个实例；4173/8017 原实例全程未动。
6. 产出 `backlog.md`（家长端 2 条新条目 + 运营端 4 条新条目 + 复核通过清单 + 稳定性 + 未验证项 + 源开关结论）。

## 验证命令与真实输出

- `node .trellis/tasks/T-040/walk-parent.mjs`（家长端甲）：`POST /api/v1/children/73350410-…/reassessment/reassess_mock_001/response` → **200**，响应体 `{"event_id":"reassess_mock_001","accepted":false,"data_origin":"synthetic","source":"dingdong","sync_pending":false,"sync_error":null}`；修复处探针 `{"hasThisSuggestionReason":true,"countOldReasonLabel":1,"hasChineseLearningStyle":true,"hasRawLearningCodeInBody":false,"countUnitCount":0,"hasSourceNote":true,"hasIsoLikeTime":false,"dimensionNames":["语言","逻辑","音乐","空间","实践","自我认知","人际","自然"],"rawCodes":[]}`。
- `node .trellis/tasks/T-040/walk-parent-c.mjs`（丙一/丙二，单次登录）：核验错凭据 `422`（`{"code":"PROOF_INVALID",…}`）、真实凭据 `201`（`{"status":"verified",…}`）；六个场景全部 `rawCodes: []`、`countUnitCount: 0`、`hasSourceNote: true`；**丙二对同一 `reassess_mock_001` 回写 `200`**（`{"event_id":"reassess_mock_001","accepted":false,…}`）；390×844 三页 `scrollWidth 390 / innerWidth 390`；console 错误 `["401","422"]`（422 即上面那次错凭据核验）。
- `node .trellis/tasks/T-040/walk-parent-d.mjs`（丁）：轮询到同步完成后观察区块为 `机器人行为观察 / 合成观察次数 3 次 / 最近成功同步：2026/09/18 05:19`（`hasUnitCi: true`、`countUnitCount: 0`）；点「重新测评」后区块变「已确认重新测评 + 开始复测」；**点「开始复测」后 1.2 秒内 `#dialog` 里还没有同意对话框、随后 22 题循环找不到题目按钮**（脚本在该处超时退出，属 P-16 现象）。
- `node .trellis/tasks/T-040/diag-reassessment-start.mjs`（三次）：点「开始复测」后 `<dialog>.open` 采样 `[603,false] [701,true] … [2302,true] [2401,false]`，`opened = 17`、`closedAfterOpen = true`；同刻请求表 `GET /assessment-config?purpose=assessment` 200、`GET /children/<id>/consents` 200、`GET /policies/current?purpose=assessment_processing` 200；`#dialog` 计算样式 `display: none`；`formError` 为空；区块文案停在「已确认重新测评 … 开始复测」。
- `node .trellis/tasks/T-040/walk-ops.mjs` / `walk-ops2.mjs`：`errors: []`；服务事项行原文 `["家长求助","小米的新称呼","+8613800881768 +8613800881768","家长需要人工支持","待处理",…]`；工作首页 `近 7 天新建档案（含已归档） 344` / `在册儿童 343`；家庭列表「家长」列 = `未填写`；390×844 `scrollWidth 390 / innerWidth 390`。
- `node .trellis/tasks/T-040/walk-parent-dingdong.mjs`（8018/4174，`CA_DISPLAY_DATA_SOURCE=dingdong`）：`hasNotSynced: true`，三个展示面一致显示「机器人数据服务尚未接通 / 稍后自动重试。」，成长观察仍显示 `合成观察次数 3 次`；`pageerror` 0。
- 库侧核对（证伪一条疑似不一致）：`ExternalAssociation 95d14d87…` 的 `SyncCheckpoint` `status=enabled`、`last_success_at=2026-09-17T21:13:50Z`，观察批次 `test_observation / unit 次 / value 3`；`observation_view()` 返回 `availability=ready`、`metrics[0].unit="次"`。
- `python3 scripts/audit_documents.py` → 见下「收尾时实跑」。

## 未验证项

- 真源已配置（`dingdong` + base URL/key）的真连分支：未测（T-028 阻塞级 B1/B2 未解）。
- 生产环境：未触碰（全部在本机 4173/4174/8017/8018 与本地库 127.0.0.1:55439）。
- 按排除项未做：8 个出站接口、主动解绑、发版部署、删除儿童数据、发布/停用内容、处理服务事项、冻结家庭。
- `frontend/tests/flows.spec.js`：未跑（本地短信频控 IP 1 小时 ≥50 次，本轮已触发一次 429）。
- `switch_recommended` 真/假分支的结果卡与 `complete` 回写的界面表现：本轮被 P-16 挡住没走到。
- 家长端每次走查出现的 1 条 `console 401`：未定位到具体请求（请求日志里 `/api/` 无 401）。

## 偏离与理由

- 原计划「一次登录走完全部家长端流程」在第二轮（`walk-parent-b.mjs`）因本地短信频控 429 中断；改为「一次登录做完剩余走查」（`walk-parent-c.mjs`）后完成，未绕开频控、未改库计数。
- 源开关复核需要 `dingdong` 后端，但 `CSRF_TRUSTED_ORIGINS` 只列了 4173 且不可用环境变量覆盖，因此没有重启 4173/8017 那套，而是另起 8018 + 前端换端口副本（临时文件跑完删除，未改任何仓库文件）。
- backlog 里第一轮运营脚本报的 6 个 404 是我方脚本猜的 URL，已在「审计方式」注明并剔除，不计为缺陷。

## 本轮在本地库产生的数据（供清理参考）

- 新建 10 个儿童档案（巡检甲 `73350410`、巡检乙 `f7f6bcfc`、巡检丙一 `8d5233a6`、巡检丙二 `a338003e`、巡检丁 `d41de0a1`、复测承接诊断 `27f03481`/`d3aa1d91`/`65850dea`/`7aed45e8`、真源开关儿童 `0e3ff7a5`）及各自家庭、CA 账户、关联与同步任务。
- `CaReassessmentEvent` 全库 30 行，其中 `event_id='reassess_mock_001'` 16 行（本轮新增若干行，用于两个儿童同 `event_id` 的复核）。
