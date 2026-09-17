# T-016 progress

## 已完成阶段

- Plan：读 `.trellis/spec/frontend/index.md` / `ui-conventions.md` / `testing-and-acceptance.md`；定位测评同意框在 `frontend/app.js:beginAssessment()`（`showDialog("本次测评用途", …)`，正文取服务端 `/policies/current?purpose=assessment_processing` 的 `policy.body`，本地种子正文即 `[合成测试]仅用于功能验证；不采集或保存真实指纹。`）。四要素文案的事实依据：`PROJECT_MEMORY.md`（不下发画像、不采集指纹/年级）、`设计/数据库表结构_V0.1.md:129`（撤回≠删除历史报告）、`设计/一期功能_API与业务闭环_V0.1.md`（行为观察与测评分来源展示、不合并成一个分数）。
- Implement：`frontend/app.js` 测评同意框正文在 `policy.body` 之后新增 `.notice` 块（沿用「活动准备材料」的 `<b>标题</b><p>正文</p>` 既有写法），四要素为「处理目的 / 数据范围 / 数据去向 / 保留与撤回」；`policy.body` 原文与「合成测试」标注保留，撤回入口按导航实名写「账户与关联 → 用途授权」。
- Verify：见下。
- Finish：progress / report / 队列状态 / gates EXECUTED / experiment-log / status.md。

## 改动文件

- `frontend/app.js`（`beginAssessment()` 的 `showDialog` 正文，仅此一处）
- `frontend/tests/consent-copy.spec.js`（新增，1 条真实 Chrome 用例）
- `.trellis/tasks/T-016/shots/t016-consent-desktop.png`、`t016-consent-mobile.png`、`t016-consent-mobile-bottom.png`

## 跑过的命令与结果

- `npx playwright test tests/consent-copy.spec.js --reporter=list`（实现前）→ `1 failed`
  - `Error: expect(locator).toBeVisible() failed` / `Locator: locator('#dialog').getByText('处理目的', { exact: true })` / `Error: element(s) not found`（consent-copy.spec.js:48）
- `npx playwright test tests/consent-copy.spec.js --reporter=list`（实现后）→ `1 passed (8.7s)`
- `npx playwright test tests/consent-copy.spec.js tests/quiz-last-button.spec.js --reporter=list`（补窄屏断言后，含回归）→ `2 passed (20.3s)`（`consent-copy` `1 passed (6.5s)`、`quiz-last-button` `1 passed (13.1s)`）
- `npm run check` → exit 0（`node --check app.js && api.js && playworld.js && server.cjs`）
- `npm run test:unit` → `tests 16` / `pass 16` / `fail 0` / `duration_ms 71.056667`
- `python3 scripts/audit_documents.py` → `{"markdown_files": 80, "local_links_checked": 497, "archived_files_checked": 85, "operations": 55, "schemas": 65, "errors": []}`

## 下一步

提交（`[T-016]`）→ 按决定段第一批「可直推」规则 push 并回填 EXECUTED → 队列 `status` 改 `done`。
