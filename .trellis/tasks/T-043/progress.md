# T-043 progress

## 取任务
- 第 1 节门禁：`gates.md` 决定段最后一条 `APPROVE T-042 review`（2026-09-18T01:19Z）对应 `queue.md` 里 T-042 `status: gated` → 执行该受门禁动作：T-042 `status` 改 `done` 并推 `origin/codex/release-v0.3.6`，远端 sha `dcc692f54118fef672a5ec1920fdaa2c10d73dde`（`9954d2e..dcc692f`，含 T-042 backlog 提交 `09bc2ca`、orchestrator 批复提交 `5da4d2c`、本轮收尾提交 `dcc692f`）。
- 本轮取 `queue.md` 第一个 `status: todo` = T-043（P-18 人设卡学习风格说明去内部话术），已改 `doing`。

## Plan（已完成）
- 改动点：`frontend/app.js:507` 人设卡学习风格说明行（原文「中文对照由我方按取值直译，对方 code 表确认后核对；悬停可看原始取值」）；`:499` 行注释保持不动（内部事实，家长看不到）。
- 客观验证：①真实 Chrome 复现原路径（登录 → 建档 → 绑定机器人 → 核验关联 → `inject_fixture --scenario ca_display_reassess` → `#reports` 人设卡），断言人设卡与整页正文不含「我方」「对方 code 表」「确认后核对」「直译」；②`span[title="cognitive"]` 仍为「认知」（原始取值仍在 `title`）；③`npm run check` + `npm run test:unit`；④`audit_documents.py` errors 为空。
- 既有断言核对：`frontend/tests/companion-panel.spec.js:174` 与 `frontend/tests/t038-copy-and-format.spec.js:154/214` 只断言「学习风格：」/「学习风格：认知」前缀，不引用原句，无需同步更新。
- 环境：后端 8017（Python pid 59194）、前端 4173（node pid 97212）、PostgreSQL 55439、Redis 6379 均在跑。

## Implement（已完成）
- `frontend/app.js:507` 文案改为「学习风格：认知（来自机器人服务，中文名仅供参考；悬停可看原始取值）。」；`git diff --stat frontend/app.js` = `1 file changed, 1 insertion(+), 1 deletion(-)`。
- 新增 `frontend/tests/t043-persona-copy.spec.js`（真实 Chrome，先写、先失败）。
- `frontend/README.md` C2 文案纪律补一句；`PROJECT_MEMORY.md` 更新最近一轮（T-041 段降为「上一轮」）。

## Verify（已完成）
- 先失败（改代码前同命令）：`expect(locator).toContainText("仅供参考") failed`，`Received string: "Newton…学习风格：认知（中文对照由我方按取值直译，对方 code 表确认后核对；悬停可看原始取值）。…"`，`1 failed`；逐字日志 `.trellis/tasks/T-043/p18-before-fix.log`、失败帧截图 `shots/p18-before-fix.png`。
- 修复后：`npx playwright test tests/t043-persona-copy.spec.js --reporter=list` → `1 passed (28.9s)`；截图 4 张（桌面/390×844 各 2 张，逐张看过）。
- `cd frontend && npm run check` → exit 0；`npm run test:unit` → `tests 67 / pass 67 / fail 0`。
- 回归（三轮都没跑绿，已归因）：`companion-panel.spec.js` + `t038-copy-and-format.spec.js` → 第 1 轮 `2 passed / 3 failed (3.7m)`、第 2 轮 `1 passed / 4 failed (2.2m)`、第 3 轮（`git stash push -- frontend/app.js` 回到改动前版本）`2 passed / 3 failed (1.8m)`；失败点全是用例自身 5 秒默认等待（登录后标题、`#window-form`），无一条落在内容断言。同期实测后端 `GET /api/v1/policies/current` 两次 `0.97s` / `4.54s`、`load average 3.96`。日志 `regression.log` / `regression-rerun.log` / `regression-prefix-app.log`。
- 回归跑脏的他人截图（`T-033/shots/reassess-mobile.png`、`T-038/shots/o06-families.png`、`o07-dashboard.png`）已 `git checkout --` 复原。
- `python3 scripts/audit_documents.py` → `{"markdown_files": 83, "local_links_checked": 518, "archived_files_checked": 85, "operations": 61, "schemas": 83, "errors": []}`。

## Finish（进行中）
- `queue.md` T-043 `status` 改 `done`（本任务 `gate: none`，按 notes 直推）；`gates.md` 决定段补 `EXECUTED T-042 push` 与 `EXECUTED T-043 push`；`experiment-log.md` 追加一行；`status.md` 整文件重写（保留末尾 `## 驱动告警` 原样）。
- 下一步：提交（首行 `[T-043]`）并 push `origin/codex/release-v0.3.6`。
