# T-011 报告：P-08 最后一题按钮文案改成「保存并完成」

## goal

答题最后一题按钮由「保存并继续」改成「保存并完成」，与进入提交确认页的实际动作一致。

## 实际做了什么

1. `frontend/app.js`：`sessionView()` 里末题按钮文案 `"保存并继续"` → `"保存并完成"`（该表达式为 `state.question === s.questions.length - 1 ? … : "保存并下一题"`，全仓仅此一处代码决定该文案；运营端 Django 模板无同款按钮）。
2. 新增真实 Chrome 用例 `frontend/tests/quiz-last-button.spec.js`（1 条）：登录 → 建档 → 「测评与报告」→「开始探索体验」→ 逐题断言，第 1–3 题按钮为「保存并下一题」且不存在「保存并完成」，第 4/4 题为「保存并完成」且不存在「保存并下一题」，点击后落在「准备好留下这次选择了吗？」提交确认页（`完成探索体验` 按钮可见）。
3. 同步既有用例里被这次文案改动影响的期望（不更新会直接挂）：
   - `frontend/tests/flows.spec.js:104`（22 题测评末题）、`:325`（4 题探索末题）：`"保存并继续"` → `"保存并完成"`。
   - `frontend/tests/questionnaire-admin.spec.js:116`（1 题问卷的末题，也走同一表达式）：同上。

## 验证命令与真实输出

- TDD 红（改前）：`cd frontend && npx playwright test tests/quiz-last-button.spec.js --reporter=list` →
  `1 failed`，`Error: expect(locator).toBeVisible() failed / Locator: getByRole('button', { name: '保存并完成', exact: true }) / Error: element(s) not found`，行 `tests/quiz-last-button.spec.js:61:32`，`1 failed`（耗时 18.1s）。
- TDD 绿（改后）：同命令 → `1 passed (15.0s)`。
- 加全页证据截图后重跑两次：`1 passed (14.1s)`、`1 passed (14.9s)`。
- `cd frontend && npm run check` → exit 0。
- `cd frontend && npm run test:unit` → `tests 16 / pass 16 / fail 0`，`duration_ms 71.932041`。
- `python3 scripts/audit_documents.py` → `{"markdown_files": 80, "local_links_checked": 497, "archived_files_checked": 85, "operations": 55, "schemas": 65, "errors": []}`。
- 全仓残留检查：`grep -rn "保存并继续" frontend/ backend/` → 仅剩 `frontend/tests/quiz-last-button.spec.js:9` 的注释（描述改前状态）与 `backend/.venv/.../django/contrib/admin/locale/zh_Hans/...po`（Django 自带「保存并继续编辑」，与本改动无关）。
- 限流余量（只读）：`SmsChallenge` 近 1 小时 `client_ip=127.0.0.1` 计数 —— 开工 44，本轮 4 次登录后 48（上限 50）。

## 证据截图（`.trellis/tasks/T-011/shots/`）

- `t011-last-question-desktop.png`（1280×720 全页）：第 4 / 4 题、进度条满格、按钮为「保存并完成」。
- `t011-last-question-mobile.png`（390×844 全页）：同屏可见「第 4 / 4 题 · 尚有 1 题未完成」与「保存并完成」。
- `t011-after-last-question-desktop.png`：点末题按钮后落在「准备好留下这次选择了吗？」+「完成探索体验」，即文案所称的"完成"。

## 未验证项

- `frontend/tests/flows.spec.js` 与 `frontend/tests/questionnaire-admin.spec.js` 的期望改动**未复跑**：前者本地 3 项因 `server.cjs` 与 `inject_fixture` 连的不是同一个库而失败（T-003 backlog S-05，另有专门任务 T-018），后者要建 staff 用户且消耗登录限流。两处改动是同一表达式驱动的机械改名，本轮以新用例覆盖同一行为，未采信历史绿灯。
- 22 题测评末题（`flows.spec.js:104`）的界面未单独截图，理由同上。

## 偏离与理由

- 无功能偏离。相比 acceptance 多改了 `questionnaire-admin.spec.js:116` 一处期望：不改它，该用例会因本次文案改动而挂，属必要同步。
- 本轮在本地库产生 1 名家长账号与 1 份探索体验答卷（儿童「末题文案测试小芽」，题库 `readable-v2`），供清理参考。
