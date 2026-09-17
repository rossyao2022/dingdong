# T-008 进度

## 阶段
- Plan：完成
- Implement：完成
- Verify：完成
- Finish：进行中

## 核对式续跑（fallback，2026-09-17）
- 前任声明与磁盘不符：无。runs.log 里 `2026-09-17T08:26:06Z ROUND T-008 RATE_LIMITED 20s 8348ef8 deepseek-v4-1-flash-260910 rc=1` 是 PRIMARY 启动即被限流，未留下 progress.md / 改动文件；本轮为 FALLBACK 重跑，从头做。

## Plan
- goal 拆两件事：①绑定对话框补操作指引「用手机碰一下机器人上的标签，凭据会自动带回到这个页面」；②手填时给格式/长度提示，且空凭据点「确认绑定」时错误落到 `.form-error`（可见、非空、对话框不关），不再只靠浏览器原生气泡。
- 验收映射：操作指引 → 弹窗正文含「碰一下机器人上的标签」；格式/长度提示 → 弹窗含「2048」；空凭据 → `#dialog .form-error` 可见且非空、对话框标题仍为「绑定机器人」；截图 → `.trellis/tasks/T-008/shots/`。
- 实现落点：`frontend/app.js` 的 `bindRobotDialog()`（表单加 `novalidate`、正文与 `.note` 文案、`onsubmit` 空凭据守卫）；测试 `frontend/tests/ca-account.spec.js` 新增 1 条真实 Chrome 用例。

## 改动文件
- frontend/app.js
- frontend/tests/ca-account.spec.js

## 跑过的命令与结果
- TDD 红（实现前）：`cd frontend && npx playwright test tests/ca-account.spec.js -g "手填绑定" --reporter=list` → 1 failed；失败在 `expect(dialog).toContainText("碰一下机器人上的标签")`，实收文本仍是旧文案「机器人上的标签会带着凭据打开这个页面」。
- `cd frontend && npx playwright test tests/ca-account.spec.js -g "手填绑定" --reporter=list` → `1 passed (4.7s)`（实现后首绿）。
- 修正截图路径到仓库根后复跑：`1 passed (4.9s)`，截图落 `.trellis/tasks/T-008/shots/empty-credential.png`（197,704 字节）。
- `cd frontend && npx playwright test tests/ca-account.spec.js --reporter=list` → `8 passed (51.4s)`（全量回归一次全绿，逐条 6.1s/6.9s/10.0s/6.7s/4.7s/4.4s/5.4s/6.5s）。
- `cd frontend && npm run check` → exit 0。
- `cd frontend && npm run test:unit` → `tests 16 / pass 16 / fail 0 / duration_ms 73.248209`。
- `python3 scripts/audit_documents.py` → `{"markdown_files": 80, "local_links_checked": 497, "archived_files_checked": 85, "operations": 55, "schemas": 65, "errors": []}`。

## 下一步
- 提交（code + 任务目录）→ 按第一批规则直推 → 收口记录（queue/gates/status/experiment-log）→ 再推。
