# T-009 progress

## 阶段

- Plan：完成
- Implement：完成（FALLBACK 接手后重做，见下「核对式续跑」）
- Verify：完成（必需项全绿；全量回归受限流未全绿，见 report 未验证项）
- Finish：完成

## 改动文件

- `frontend/app.js`：`windowForm()` 表单内加 `<div class="form-error" role="alert"></div>`；`bindForms()` 中 `#window-form` 改块级绑定，新增 `windowRangeError(show)`，`from`/`to` 输入框 `oninput` 清错，`onsubmit` 非法时就地提示「结束时间要晚于开始时间」+ 两个输入框 `aria-invalid="true"` + `.is-invalid`（原 toast 分支移除）。
- `frontend/client.css`：新增 `.window-form .form-error { flex-basis: 100%; margin: 0 }`、`.window-form input.is-invalid { border-color: #cf6a56; background: #fff6f3 }`。
- `frontend/tests/growth-window.spec.js`：2 条真实 Chrome 用例（前任已建，保留）。
- `.trellis/loop/queue.md`：T-009 `status` 由 `doing` 改 `done`。

## 命令与结果

- `cd frontend && npm run check` → exit 0。
- `cd frontend && npm run test:unit` → `tests 16 / pass 16 / fail 0`，`duration_ms 70.432667`。
- `python3 scripts/audit_documents.py` → `errors []`（`markdown_files 80 / local_links_checked 497 / archived_files_checked 85 / operations 55 / schemas 65`）。
- `cd frontend && npx playwright test tests/growth-window.spec.js --reporter=list` → 首跑 `2 failed`（登录步 `.form-error`「验证码请求过多」，SMS 同 IP 限流 50/小时，计数=50）；DB 只读计数滑落 47 后重跑 → `2 passed (12.0s)`。
- 回归 `npx playwright test tests/ca-account.spec.js tests/flows.spec.js` → 受限流影响未全绿，跑约 13 分钟后终止，数字未采信。
- 截图：`frontend/docs/` 两图拷入 `.trellis/tasks/T-009/shots/`（desktop 109797 字节 / mobile 70584 字节）。

## 核对式续跑（FALLBACK 接手，2026-09-17T09:1xZ）

前任声明与磁盘不符：progress.md 声称 `frontend/app.js`（windowRangeError、就地提示、is-invalid）与 `frontend/client.css`（`.window-form .form-error`、`.window-form input.is-invalid`）已改，但磁盘上两文件均无对应改动（`git status --short` 无这两项、`git diff` 为空、grep 无 `windowRangeError`/`结束时间要晚于开始时间`/`is-invalid`）。磁盘实际存在：`frontend/tests/growth-window.spec.js`（未跟踪）、`.trellis/tasks/T-009/`（progress.md + 2 张 shots）、`.trellis/loop/queue.md`（T-009 已 doing）。以磁盘为准，Implement 重做，测试文件与截图目录保留。

## 下一步

- 无（任务已完成，commit + 按第一批直推规则 push 见 gates.md EXECUTED 行）。
