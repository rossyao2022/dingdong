# T-039 报告：T-033/T-034 三条范围判定落定 + 过期截图刷新

任务 id：T-039 · 分支 `codex/release-v0.3.6` · 执行日期 2026-09-18 凌晨（本地循环自驱）

## goal（原文）

落定 status.md 待拍板的三条：①「换机后旧号人设只读展示」缺数据通路——orchestrator 裁定：本批不做，记入 T-028 澄清清单确认级（旧号历史数据对方如何提供），本轮只在 report 记录该决定，不改代码；②`watch` 态不显示 `health_score`（维持 design §1.3 原判，以 T-033 已实现行为为准，若已实现为显示则改为不显示并补断言）；③八维中文名由后端下发（与 `stage_label` 同一做法，前端不硬编码第二套映射），改 `growth-cycle` 接口 payload 并同步前端渲染与单测。另：重跑 `frontend/tests/companion-panel.spec.js` 刷新 T-033 的 `reassess-*`/`switch-*` 截图（现缺复测区块）。

## 实际做了什么

### ① 换机后旧号人设只读展示：按裁定不做，只记决定

- **未改任何代码。**
- 在 `.trellis/tasks/T-028/dingdong-clarifications.md` 的确认级 C6 段末尾追加**一行**补充（不改条目结构、不改 33 条计数）：

  > 补充（T-039 裁定，2026-09-18）：换机后旧号（`retired`）的人设与历史报告，贵方是否仍按旧 `ca_account_id` 可查？——我方四个展示面接口只解析 `active` 号，家长端「旧号只读展示」暂无数据通路，本批不做；拿到答复后再定补读接口。

- 依据：四个展示面接口（`core/api/ca_display.py`）都经 `services/ca_display.py` 的 `_resolve(child)` 解析到当前 `active` 的 `CaAccount`，没有按 `retired` 号取数的读接口；补齐要新增后端读接口，超出本任务范围。

### ② `watch` 态不显 `health_score`：核对后与断言一致，未改实现

- `frontend/companion.js` 的 `HEALTH_STATES.watch` 本就是 `{ score: false }`，`healthSection()` 里 `showScore = score !== null`、`score` 只在 `state.score === true` 时才取 `health.health_score`——**已是不显分数的实现**，无需改动。
- 断言两处：`frontend/unit/companion.test.js`「面三：watch 只出轻提示，不显 health_score 数值」（给 `health_score: 55` 仍断言 `showScore false` / `score null`）；`frontend/tests/companion-panel.spec.js` 的 `ca_display_watch` 用例 `score: null` → 断言 `.companion-health .metric-list` 计数为 0、且不出复测 CTA。

### ③ 八维中文名由后端下发

后端 `backend/dingdong_ca/core/services/ca_display.py`：

- 新增 `GROWTH_DIMENSION_LABELS`（语言 / 逻辑 / 音乐 / 空间 / 实践 / 自我认知 / 人际 / 自然成长代理，取值取对方 `*_growth` 字段注释）。
- `_growth_out()` 与 `growth_view()` 的空态 payload 各加一个 `growth_dimension_labels`：`{key: GROWTH_DIMENSION_LABELS.get(key) for key in GROWTH_DIMENSIONS}`，键与 `growth_dimensions` **同序同集**，做法与 `type_label` / `stage_label` / `learning_style_labels` 一致。

契约 `设计/API/openapi.json`：

- `GrowthCycleView` 加 `growth_dimension_labels`（`anyOf` → 新 schema / null）并加入 `required`；新增 schema `GrowthDimensionLabels`（`additionalProperties: false`，8 个键，值 `["string","null"]`）。`GrowthCycleView` 是 `additionalProperties: false`，不同步 openapi 时契约用例必然失败。
- `设计/API/请求响应与字段字典_V0.1.md` 用 `audit_documents.py --generate` 重新生成。

前端 `frontend/growth-cycle.js`：

- 原 `DIMENSIONS`（8 个 `{key, label}`，中文名硬编码在前端）改为 `DIMENSION_KEYS`（只有 8 个键，保留固定顺序）。
- `dimensionRows(dimensions, labels)` 的中文名一律取 payload（`labels?.[key]`），新增兜底常量 `DIMENSION_UNKNOWN = "未识别维度"`；`growthCycleSection()` 传 `data.growth_dimension_labels`。
- `frontend/unit/growth-cycle.test.js`：`growthData()` 加 `growth_dimension_labels`，顺序断言改用 `DIMENSION_KEYS`，新增 2 项（单维中文名缺失给兜底、整块缺失不崩）。

文档：`frontend/README.md` 两处（八维中文名的来源改成「由后端 `growth_dimension_labels` 下发」；单测项数 17 → 19）；`PROJECT_MEMORY.md` 更新最近一轮。

### 截图刷新

重跑 `frontend/tests/companion-panel.spec.js`（该 spec 的输出目录就是 `.trellis/tasks/T-033/shots`），T-033 的 8 张截图全部刷新（`reassess-*` / `switch-*` 现在含复测区块）；把 4 张拷进 `.trellis/tasks/T-039/shots/`：`reassess-desktop.png`、`reassess-mobile.png`、`switch-desktop.png`、`watch-desktop.png`（第 4 张取 `watch`，作为 ② 的界面证据：只有「继续体验并观察」与「已观察 15 天。」，无分数、无复测 CTA）。两张已逐张目视核对内容。

## 验证命令与真实输出（数字照抄）

先失败（TDD 红）：

```
$ cd backend && uv run --no-sync pytest tests/test_ca_display.py -k "dimension_labels" -q
1 failed, 54 deselected, 1 warning in 19.69s
E       KeyError: 'growth_dimension_labels'
tests/test_ca_display.py:751: KeyError
```

修复后：

```
$ cd backend && uv run --no-sync pytest tests/test_ca_display.py -k "dimension" -q
2 passed, 53 deselected, 1 warning in 26.57s

$ cd backend && uv run --no-sync pytest tests/test_ca_display.py -q
55 passed, 1 warning in 247.02s (0:04:07)          # 原 54 项 + 新增 1 项

$ cd backend && uv run --no-sync ruff check .
All checks passed!
$ cd backend && uv run --no-sync ruff format --check --target-version py313 .
132 files already formatted
$ cd backend && uv run --no-sync python manage.py check
System check identified no issues (0 silenced).
$ cd backend && uv run --no-sync python manage.py makemigrations --check --dry-run
No changes detected
```

前端：

```
$ cd frontend && npm run check
（node --check 8 个文件全部通过，exit 0）
$ cd frontend && npm run test:unit
ℹ tests 67
ℹ pass 67
ℹ fail 0
$ cd frontend && node --test --test-name-pattern="watch" unit/companion.test.js
✔ 面三：watch 只出轻提示，不显 health_score 数值 (0.87525ms)
ℹ pass 1 / ℹ fail 0
```

检索验证（前端无第二套中文映射）：

```
$ cd frontend && grep -rn "语言成长代理\|逻辑成长代理\|音乐成长代理\|空间成长代理\|实践成长代理\|自我认知成长代理\|人际成长代理\|自然成长代理" *.js *.cjs
（无命中，exit 1）
$ cd frontend && grep -n "成长代理" growth-cycle.js app.js
growth-cycle.js:20: * 八维成长代理的固定顺序（键）…
growth-cycle.js:48:export const PROXY_NOTE = "成长代理（对方算法产出，不是 CA 原始天赋分）。";
app.js:606: …<h3>八维成长代理</h3>…
```

（剩下 3 处是通用标注、面板小标题与注释，不是维度名映射。）

文档审计：

```
$ cd backend && uv run --no-sync python ../scripts/audit_documents.py --generate
{"markdown_files": 80, "local_links_checked": 508, "archived_files_checked": 85, "operations": 61, "schemas": 83, "errors": []}
$ python3 scripts/audit_documents.py
{"markdown_files": 80, "local_links_checked": 508, "archived_files_checked": 85, "operations": 61, "schemas": 83, "errors": []}
```

真实 Chrome（本机 4173 家长端 + 8017 后端，不拦截任何响应）：

```
$ cd frontend && npx playwright test tests/growth-cycle-panel.spec.js --reporter=list
  ✓  1 tests/growth-cycle-panel.spec.js:169:1 › 成长周期报告：15/30 天 Tab、周期空态与八维条形（真实 Chrome） (40.6s)
  1 passed (45.5s)

$ cd frontend && npx playwright test tests/companion-panel.spec.js --reporter=list
  ✓  1 tests/companion-panel.spec.js:193:1 › 6 个合成场景逐个走查：人设卡与健康度四态（真实 Chrome） (34.1s)
  ✓  2 tests/companion-panel.spec.js:248:1 › 陪学伙伴面板：390×844 不横向溢出，账户页有只读人设行 (16.2s)
  2 passed (51.0s)

$ cd frontend && npx playwright test tests/growth-window.spec.js tests/reassessment-cta.spec.js --reporter=list
  ✓  1 tests/growth-window.spec.js:58:1 › 起 ≥ 止：就地提示 + 两个输入框标红，且不发请求 (5.2s)
  ✓  2 tests/growth-window.spec.js:102:1 › 合法区间照常查询（回归） (6.4s)
  ✓  3 tests/reassessment-cta.spec.js:187:1 › 复测四步闭环：建议 → 回写 → 承接测评 → 结果（switch_recommended 真分支） (1.2m)
  ✓  4 tests/reassessment-cta.spec.js:312:1 › 复测四步闭环：switch_recommended 假分支只保留当前角色 (1.2m)
  ✓  5 tests/reassessment-cta.spec.js:369:1 › 选择先不测后不再重复打扰，可展开看当时的建议；没有建议时不出现入口 (25.8s)
  5 passed (3.1m)
```

`growth-cycle-panel.spec.js` 的 11 步走查里逐个断言了 8 个中文维度名（`语言成长代理` … `自然成长代理`）与条形值，所以「中文名改由接口下发」在真实浏览器里是端到端验证过的，不是只看单测。

本地开发库无迁移改动（本任务不涉及模型）；本地服务均为已运行实例：后端 `manage.py runserver 127.0.0.1:8017`（autoreload 子进程 04:43:20 启动，晚于 `ca_display.py` 的 mtime 04:43:19，即已加载本轮代码）、家长端 `4173`、PostgreSQL `55439`、Redis `56379`。

## 未验证项

- **真源模式（`CA_DISPLAY_DATA_SOURCE=dingdong`）下的八维标签**：本任务只改响应组装，标签来自我方常量表，与数据源无关；但本轮没有配置 `DINGDONG_BASE_URL` / `DINGDONG_API_KEY`，没有走真源路径实测（八个出站接口仍未接通）。
- **生产**：未部署、未发版；线上仍是 v0.3.6，生产库不含 `0008`–`0010` 迁移。
- **`tests/flows.spec.js`**：本轮未跑（T-038 记录过本地短信频控按客户端 IP 1 小时 ≥50 次会被多轮验收用满）。本轮自己 3 次浏览器验收共 8 次登录，跑完时窗口内计数 44 → 49，未触发 429，但也没有余量再跑 flows。
- 换机后旧号的只读展示本身（①）未实现、也未验证——按裁定不在本轮范围。

## 偏离与理由

1. **`watch` 态未改代码**：任务 goal 的 ② 写「若已实现为显示则改为不显示并补断言」；核对后实现已是不显示、断言已存在，所以本轮只复跑取证（`pass 1 / fail 0`）并把它写进 report，没有为了「有改动」去改实现。
2. **T-039/shots 收了 4 张而不是严格 3 张 `reassess-*`/`switch-*`**：spec 实际产出里匹配 `reassess-*`/`switch-*` 的只有 3 张（`reassess-desktop`、`reassess-mobile`、`switch-desktop`），acceptance 写「四张」；第 4 张取 `watch-desktop.png`（`watch` 与 `reassess` 同属健康度四态、且是 ② 的界面证据），比凑一张重复图更有用。
3. **T-033 的 8 张截图全部入库**（不止 4 张）：spec 一次跑完会重写该目录全部 8 张，只挑 4 张提交会让目录内新旧混版。
4. **回归跑 `reassessment-cta` / `growth-window` 会把 T-034 / T-035 的 shots 重写脏**（前几轮记录过的同一个坑），已 `git checkout -- .trellis/tasks/T-034/shots .trellis/tasks/T-035/shots` 复原，未混进本轮提交。
5. **`.trellis/loop/runs.log` 的两行驱动记录**（T-037 / T-038 的 `ROUND … DONE`）此前未提交，随本轮收尾记录一并入库。
