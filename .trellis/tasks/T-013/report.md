# T-013 报告：不再把内部 code `readable-v2` 给家长和运营看（P-04）

## goal

家长端答题页与运营端儿童详情不再直接显示内部 code `readable-v2`，改显示中文名 + 版本号（如「四个小情境：探索偏好体验（v2）」），原始 code 收进悬停提示。

## 实际做了什么

- `frontend/app.js` 新增纯函数 `versionLabel(v)`：从版本代码里取版本号（`readable-v2` → `v2`，`draft-v7` → `v7`），取不到就原样返回。放在 `esc` 旁边，不新开顶层模块（避免 `server.cjs` 白名单 / `index.html` / `package.json check` 三处同步，改动面更小）。
- 家长端两个渲染点改用「题库中文名 + 版本号」，原始 code 进 `title` 属性：
  - 答题页 note：`必填 · 单选 · 题库版本 readable-v2` → `必填 · 单选 · 题库「四个小情境：探索偏好体验」（v2）`。
  - 题库卡片 note：`4 题 · readable-v2` → `4 题 · 版本 v2`（卡片标题已是中文名，这里只留版本号）。
- 运营端新增 `version_label` 过滤器（`ops/templatetags/ops_labels.py`），`child_detail.html` 版本行改为 `· 版本 <span title="readable-v2">v2</span>`（中文标题本来就在同一行上方）。
- 中文名的来源是服务端已下发的 `questionnaire_version.title`，前端与运营端都没有新增 code→中文名 映射表。

## 验证命令与真实输出（数字照抄）

| 命令 | 输出 |
| --- | --- |
| `cd frontend && npx playwright test tests/questionnaire-version.spec.js --reporter=list`（改代码前） | `2 failed`；家长端 `Received string: "必填 · 单选 · 题库版本 readable-v2"`；运营端 summary 实际值含 `· 版本 readable-v2` |
| 同上（改代码后） | `2 passed (14.3s)`：`✓ 家长端答题页… (8.4s)`、`✓ 运营端儿童详情的答卷区… (5.2s)` |
| `cd frontend && npm run check` | exit 0 |
| `cd frontend && npm run test:unit` | `tests 16 / pass 16 / fail 0 / duration_ms 74.0375` |
| `cd backend && uv run --no-sync pytest tests/test_ops_console.py -q` | `37 passed in 139.10s (0:02:19)` |
| `python3 scripts/audit_documents.py` | `errors: []` |
| `npx playwright test tests/quiz-last-button.spec.js --reporter=list`（回归，同一答题页） | `1 passed (13.8s)` |

真实 Chrome 证据（`.trellis/tasks/T-013/shots/`）：

- `parent-quiz-desktop.png` / `parent-quiz-mobile.png`：答题页显示「题库「四个小情境：探索偏好体验」（v2）」；390×844 下 `scrollWidth - innerWidth ≤ 1`，文案变长没撑出横向滚动条。
- `parent-bank-card-desktop.png`：题库卡片显示「1 题 · 版本 v7」。
- `ops-child-detail-desktop.png` / `ops-child-detail-answers.png`：运营端儿童详情答卷区显示「日常探索问卷（流程测试） 已就绪 · 测评流程（测试） · 版本 v2」。

用例断言方式（对应 acceptance 的「仅允许出现在 `title` 属性」）：页面 `body.textContent()`（不含属性）里断言不含内部 code，同时断言存在 `[title="<原始 code>"]` 元素。

## 未验证项

- 运营端其余页面（`dashboard.html` 题库列表、`questionnaire_edit.html`、`activities.html`、`activity_preview.html`）仍显示版本 code，本轮按 goal 未改；这些是内容管理面，code 是识别符。若 orchestrator 认为也要收，另开任务。
- 题库卡片这一处需要一份「非 exploration / 非 initial-assessment」的已发布题库才会渲染，本地合成库只有两份（都不走该分支）。验收时由 spec 临时建一份（`code=e2e-version-label`、`version=draft-v7`）跑断言，`finally` 里删除；收尾核对删除后计数为 0。
- 未跑全量 e2e（`flows.spec.js` 有 3 项已知环境漂移失败见 S-05；`ca-account.spec.js` / `ops-console.spec.js` 全量耗时且会消耗 `/auth/sms` 同 IP 额度）。开工时该额度计数 24/50。

## 偏离与理由

- 范围比 goal 字面多一处：家长端题库卡片 note（`frontend/app.js` 测评与报告页的第三份题库卡片）也渲染了同一份版本 code，属同一缺陷的同一渲染点，改法一致、一行改动，留着会让「不再把内部 code 给家长看」半途而废。已为该处补上真实 Chrome 断言（见上）。
- 未把 `versionLabel` 单开成 `ca-link.js` 那样的顶层模块：spec 的判据是「纯函数且规则重要」，这里是一次展示格式化，且规则已由真实 Chrome 用例钉住；开模块要同步 `server.cjs` 白名单、`index.html`、`package.json check` 三处，改动面更大。
- 新增测试数据（本地合成库，供清理参考）：1 名家长账号与儿童「版本文案合成儿童」+ 1 份探索体验会话；1 名运营验收账号 `ops-version-*`（已置 `is_active=False`）；临时题库 `e2e-version-label`（已删）。

## 门禁

`gate: none`，属第一批：按 gates.md 决定段「第一批与第二批每完成一个任务 commit 后可直接 push origin/codex/release-v0.3.6，不必逐条申请，但每次 push 在本文件补 EXECUTED 行」执行 push。
