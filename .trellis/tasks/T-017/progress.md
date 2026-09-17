# T-017 progress

## 阶段
- [x] Plan：读 queue.md T-017 goal/acceptance；定位 `frontend/app.js` services 路由与 `frontend/README.md` 来源措辞（第 3 行，参考提交 `d754a5bf9ea8e71ca64a850d2e26aa321fe8ab38`）
- [x] Implement：先写失败用例 `frontend/tests/source-credit.spec.js`（改前 `1 failed`：`locator('[data-source-credit]')` not found），再在 `frontend/app.js` 加 `SOURCE_CREDIT` 常量并在「家长支持」页渲染 `<p class="note" data-source-credit>`
- [x] Verify：见下
- [x] Finish：report.md + queue/gates/status/experiment-log 收尾

## 改动文件
- `frontend/app.js`（新增 `SOURCE_CREDIT` 常量；services 路由尾部加一行声明）
- `frontend/tests/source-credit.spec.js`（新增）
- `.trellis/tasks/T-017/shots/services-desktop.png`、`services-mobile-390x844.png`、`services-mobile-390x844-bottom.png`

## 命令与结果（原样抄）
- `npx playwright test tests/source-credit.spec.js --reporter=list`（改前）：`1 failed`，`Error: expect(locator).toBeVisible() failed / Locator: locator('[data-source-credit]') / Error: element(s) not found`
- `npx playwright test tests/source-credit.spec.js --reporter=list`（改后）：`1 passed (8.2s)`
- 临时回归巡检 `tests/tmp-route-smoke.spec.js`（跑完已删）：`1 passed (6.7s)`，7 个路由（explore/home/journey/reports/companion/settings/services）均渲染出对应标题、无错误页，`[data-source-credit]` 只在 services 页存在
- `npm run check`：通过（无输出报错）
- `npm run test:unit`：`tests 16 / pass 16 / fail 0`
- `npx playwright test tests/ca-account.spec.js tests/robot-label.spec.js --reporter=list`：见 report.md

## 下一步
- 提交（首行 `[T-017]`）→ 按第一批直推规则 push → 补 gates.md EXECUTED → 写 report → 收尾记录
