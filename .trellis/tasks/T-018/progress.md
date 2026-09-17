# T-018 进度（只记可核对事实）

## 已完成阶段

- Plan：完成（上一轮）。
- Implement：完成（上一轮）。改动 4 个文件（见下）。
- Verify：完成（本轮）。
- Finish：进行中（本轮）。

## 核对式续跑（2026-09-17T12:29Z 起）

- `git status --short`：` M .trellis/loop/runs.log`、` M .trellis/spec/frontend/testing-and-acceptance.md`、` M frontend/deployment-tests/ops-public.spec.js`、` M frontend/tests/flows.spec.js`、` M frontend/tests/support.js`、`?? .trellis/tasks/T-018/`。与 progress.md 声明的改动文件逐条一致。
- `git diff --stat`：5 个文件，`150 insertions(+), 22 deletions(-)`。
- 重跑上一轮记录的最后一个验证命令（当时未留存输出）：见下方「本轮跑过的命令」第 1 条，`8 passed (2.4m)`，输出原文已落 `.trellis/tasks/T-018/flows-green-rerun.txt`。
- 前任声明与磁盘不符（已由本轮重跑补齐）：上一轮 report.md 写「改后（绿）`8 passed (2.4m)`（原文存 `flows-green.txt`）」，但 `flows-green.txt` 实际是限流那一次的 `2 failed / 6 passed (3.9m)`；「8 passed」当时无留存输出。本轮重跑得到 `8 passed (2.4m)`，原文存 `flows-green-rerun.txt`。
- 前任声明与磁盘相符项：`frontend/tests/support.js`、`frontend/tests/flows.spec.js`、`frontend/deployment-tests/ops-public.spec.js`、`.trellis/spec/frontend/testing-and-acceptance.md` 的磁盘内容与 report.md 描述一致；上一轮探针 1/4/5 的失败输出文件（`ops-public-local-report-red.txt` 等）在盘。

## 改动文件

1. `frontend/tests/support.js` —— 新增 `cliDatabaseIdentity()`、`cliPolicyVersionId()` 与内部 `lastLine()`。
2. `frontend/tests/flows.spec.js` —— 新增 `test.beforeAll` 前置一致性检查（浏览器侧经 `server.cjs` 代理读 `/api/v1/policies/current?purpose=assessment_processing` 的 id，与 CLI 侧 `manage.py` 读同一记录的 id 比对）；`inject()` 捕获 `Child does not exist` 后改抛明确诊断；「移动端各页面…」用例的档案断言改为限定在「儿童档案」面板内。
3. `frontend/deployment-tests/ops-public.spec.js` —— 新增 `LOCAL_ENTRY` 常量与 `skipLocalDataGap()`；「报告」用例的两处本地数据前置改为显式 `test.skip(条件, 原因)` 并打印原因。
4. `.trellis/spec/frontend/testing-and-acceptance.md` —— 上一轮补的「这条现在不再靠人分辨」说明。

## 本轮跑过的命令与结果（原样抄）

本轮（2026-09-17T12:29Z–12:40Z）：

- `cd frontend && npx playwright test tests/flows.spec.js --reporter=list` → `8 passed (2.4m)`，8 条逐条 ✓（`9.9s` / `53.0s` / `20.1s` / `9.0s` / `11.8s` / `6.9s` / `19.3s` / `13.6s`），退出码 0；输出原文 `.trellis/tasks/T-018/flows-green-rerun.txt`，全篇 `grep -n 'Child does not exist'` 无命中（exit 1）。
- `cd frontend && DD_OPS_ADMIN_USER=… DD_OPS_ADMIN_PW=… PUBLIC_HTTP_URL=http://127.0.0.1:8017/ npx playwright test --config=playwright.public.config.js ops-public.spec.js -g "报告：查看已生成内容" --project=desktop --reporter=list` → `[ops-public] 跳过：本地入口没有处于失败态的报告任务（冷启动种子不生成后台任务），本用例需要真实失败任务`、`1 skipped`、退出码 0；原文 `.trellis/tasks/T-018/ops-public-local-report-after-fix-rerun.txt`。
- `cd frontend && npm run check` → 4 个文件 `node --check` 通过，退出码 0。
- `cd frontend && npm run test:unit` → `tests 16`、`pass 16`、`fail 0`、`cancelled 0`、`skipped 0`、`duration_ms 84.85`。
- `python3 scripts/audit_documents.py` → `{"markdown_files": 80, "local_links_checked": 497, "archived_files_checked": 85, "operations": 55, "schemas": 65, "errors": []}`。
- 限流前置核对（只读查询）：`SmsChallenge` 近 1 小时计数 `0`（上限 50），最近一条 `created_at` = `2026-09-17 11:29:00.414431+00:00`；CLI 侧库 `127.0.0.1 55439 dingdong`。
- 服务探活：`127.0.0.1:4173`（node）与 `127.0.0.1:8017`（python）均在 LISTEN。

上一轮（原样保留）：

- `npx playwright test tests/flows.spec.js --reporter=list`（改前）→ `1 failed`，`7 passed (2.4m)`；失败项 `tests/flows.spec.js:359:1`，`strict mode violation: locator('#main').getByText('小米的新称呼', { exact: true }) resolved to 3 elements`（原文存 `flows-red-before-fix.txt`）。
- `ops-public.spec.js` 本地全量（改前）→ `6 failed`、`9 skipped`、`7 passed (1.1m)`（原文存 `ops-public-local-before-fix.txt`）。

## 下一步

Finish：更新 report.md 的改后证据 → queue.md 改 `done` → 追加 experiment-log → 重写 status.md → commit（`[T-018]` 首行）→ 按第二批直推规则 push 并补 gates.md EXECUTED 行。
