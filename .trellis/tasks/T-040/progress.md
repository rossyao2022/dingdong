# T-040 progress

## 阶段：Plan（已完成）

- 任务：第三轮产品巡检，只产出 `.trellis/tasks/T-040/backlog.md`，不改代码，`gate: review`。
- 已读：`AGENTS.md` 顶部约束、`.trellis/workflow.md`、`.trellis/loop/queue.md`、`.trellis/loop/gates.md`、T-024 backlog（格式参考）。
- 决定段核对：无待执行 `APPROVE`，第 1 节跳过。取任务：首个 `todo` = T-040，已改 `doing`。
- 环境：前端 4173、后端 8017（`manage.py runserver`，`config.settings.local`）、PostgreSQL 127.0.0.1:55439 均在跑。

## 阶段：Implement（已完成）

- 新增走查脚本（`.trellis/tasks/T-040/`）：`walk-parent.mjs`（家长端甲）、`walk-parent-b.mjs`（第二家庭，被短信频控中断）、`walk-parent-c.mjs`（单次登录做完：核验两条路径 + 6 场景 + 6 页面 + 390×844 + 第二儿童同 `event_id` 回写）、`walk-parent-d.mjs`（同步完成态 + 复测全路径）、`walk-parent-dingdong.mjs`（源开关）、`walk-ops.mjs` / `walk-ops2.mjs`（运营端）、`diag-reassessment-start.mjs`（P-16 定点复现）。
- 未改任何产品代码；临时前端副本 `frontend/server-t040.cjs` 跑完已删。

## 阶段：Verify（已完成）

- 家长端：T-037 端到端复核（甲 200 / 丙二 200，同一 `reassess_mock_001`）；T-038 探针（`hasThisSuggestionReason:true`、`countOldReasonLabel:1`、`hasChineseLearningStyle:true`、`countUnitCount:0`、`hasSourceNote:true`、`hasIsoLikeTime:false`、`rawCodes:[]`×6 场景）；T-039 八维中文名 8/8；P-13 单位「次」（`合成观察次数 3 次`）；T-035「先不测」分支；390×844 三页无横向溢出。
- P-16 三次独立复现：`<dialog>.open` 采样 `[603,false][701,true]…[2302,true][2401,false]`，`opened 17` / `closedAfterOpen true`；三个请求 200 但 `#dialog` `display:none`。
- 运营端：11 个真实页 + 7 详情页 `errors: []`；O-06/O-07 复核通过；新发现 O-08（提交家长/绑定家长列手机号重复）、O-09（家庭详情 `（owner）`）、O-10（活动列表英文 code）、O-11（「指纹」口径）。
- 源开关：`dingdong` 未配置支（8018/4174）三面「机器人数据服务尚未接通」、无伪造数值，成长观察照常；实例与临时文件已清理，4173/8017 未动。
- `python3 scripts/audit_documents.py` → `{"markdown_files": 80, "local_links_checked": 511, "archived_files_checked": 85, "operations": 61, "schemas": 83, "errors": []}`。

## 阶段：Finish（已完成）

- 产出 `.trellis/tasks/T-040/backlog.md`、`report.md`、本文件。
- 已执行：`gates.md` 追加 `REQUEST T-040 review 2026-09-18T05:30Z` → `queue.md` 的 T-040 `status` 改 `gated`（附执行结果全文）→ `experiment-log.md` 追加一行（工具调用 156 / 轮次 133、门禁 0 次、卡点 3 个、右侧介入 0）→ 重写 `status.md`（保留末尾 `## 驱动告警` 一节）→ `git commit` 首行 `[T-040]`，提交 `8a918e6`。
- **未 push**（本任务 `gate: review`，等 orchestrator 复看）。
- 收尾核对：`git status --short` 干净；`git show --stat HEAD` 除 `.trellis/` 外无文件（未改任何产品代码）。

## 改动文件列表

- `.trellis/loop/queue.md`（T-040 `todo` → `doing` → `gated`）
- `.trellis/tasks/T-040/`（backlog.md、report.md、progress.md、7 个走查/诊断脚本与同名 JSON/JSONL、shots/）
- `.trellis/loop/gates.md`（追加 REQUEST T-040 review）
- `.trellis/workspace/yihu/experiment-log.md`、`.trellis/loop/status.md`（收尾记录）
