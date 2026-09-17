# T-006 进度

## 阶段
- Plan：完成
- Implement：完成
- Verify：完成
- Finish：进行中（写报告 + 提交）

## 改动文件
- `backend/dingdong_ca/core/api/common.py`（新增 `detail_text()` / `field_errors()`，`endpoint()` 的 ValidationError 分支改用它）
- `backend/tests/test_auth.py`（新增 `test_blank_phone_error_is_chinese_without_internal_repr`，2 个参数）
- `frontend/app.js`（`#send-code` 空号先拦、不发请求；请求与事后比较改用 trim 后的号）
- `frontend/tests/login-validation.spec.js`（新增，4 条真实 Chrome 用例）
- `.trellis/spec/backend/error-handling.md`（补 `field_errors[].message` 规则）
- `.trellis/tasks/T-006/shots/`（4 张 PNG，`frontend/docs/` 同名文件的副本）

## 跑过的命令与结果
- 复现（改前，live 8017）：`POST /api/v1/auth/sms {"phone":""}` → HTTP 422，`field_errors[0].message = "[ErrorDetail(string='该字段不能为空。', code='blank')]"`
- 新用例改前：`uv run pytest tests/test_auth.py -q -k blank_phone` → `2 failed, 12 deselected in 13.07s`
- 新用例改后：`uv run pytest tests/test_auth.py -q` → `14 passed in 22.26s`；ruff format 后复跑 → `14 passed in 21.69s`
- live 8017 改后：`{"phone":""}` → `该字段不能为空。`；`{"phone":"abc"}` → `手机号格式不合法`；`{"phone":"13800000001","extra":1}` → `未知字段`
- 浏览器改前（临时用 `git show HEAD:frontend/app.js` 还原）：`npx playwright test tests/login-validation.spec.js -g "空手机号点"` → `1 failed`，实际文案 `请求字段不合法 该字段不能为空。`
- 浏览器改后：`npx playwright test tests/login-validation.spec.js --reporter=list` → `4 passed (5.8s)`
- 浏览器回归：`npx playwright test tests/ca-account.spec.js --reporter=list --output=/tmp/t006-pw-out` → `4 passed (30.4s)`
- 后端全量回归：`uv run pytest -q` → `270 passed in 1000.72s (0:16:40)`
- `npm run check` → 通过（无输出）；`npm run test:unit` → `tests 16 / pass 16 / fail 0`
- `npx prettier --check tests/login-validation.spec.js app.js` → `All matched files use Prettier code style!`
- `uv run ruff check .` → `All checks passed!`；`ruff format --check --target-version py313 .` → `126 files already formatted`
- `uv run python manage.py check` → `System check identified no issues (0 silenced).`；`makemigrations --check --dry-run` → `No changes detected`
- `python3 scripts/audit_documents.py` → `{"markdown_files": 80, "local_links_checked": 497, "archived_files_checked": 85, "operations": 55, "schemas": 65, "errors": []}`

## 环境事实
- 8017 上原有的 runserver（9:45AM 起）在本次改动触发 autoreload 后卡死、不再监听端口；已 kill 61634/61639/11222 并在仓库内重启（日志 `.trellis/.runtime/runserver-t006.log`，当前 pid 11975）。

## 下一步
- commit（fix + 收尾记录）→ 按第一批直推规则 push → 回填 `gates.md` EXECUTED → 写 `status.md` / `experiment-log.md` → 结束进程。
