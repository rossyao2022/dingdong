# T-006 报告：P-05 空手机号获取验证码不再丢后端原始报错

## goal

手机号为空点「获取验证码」时给中文提示，不再把 `ErrorDetail(string='该字段不能为空。', code='blank')` 透传到界面：前端先做非空校验，后端 422 统一兜底成中文。

## 实际做了什么

### 根因（两处叠加）

1. **后端**：`backend/dingdong_ca/core/api/common.py` 的 `endpoint()` 在 `ValidationError` 分支里对每个字段做 `str(v)`。DRF 的 `detail` 是 `{"phone": [ErrorDetail(...)]}` 这种「字段 → 错误列表」结构，`str()` 一个 list 得到的是 list 的内部 repr，于是 `field_errors[0].message` 变成 `"[ErrorDetail(string='该字段不能为空。', code='blank')]"`。
2. **前端**：`frontend/app.js` 的 `#send-code` 处理器不做非空校验，空号也照发请求；`errorMessage()` 又会把 `message + field_errors[].message` 拼起来直接塞进 `.form-error`，内部 repr 就这样上了界面。

### 改动

| 文件 | 改动 |
| --- | --- |
| `backend/dingdong_ca/core/api/common.py` | 新增 `detail_text()`（递归取 `ErrorDetail` 的 message，`dict`/`list`/`tuple` 用 `；` 连接）与 `field_errors()`；`endpoint()` 的 `ValidationError` 分支改用它，删掉原来的 `str(v)` |
| `backend/tests/test_auth.py` | 新增 `test_blank_phone_error_is_chinese_without_internal_repr`（`phone` 参数化 `["", "   "]`）：断言 422 + `Error` 契约 + 全响应体不含 `ErrorDetail(` + 字段提示是中文且不以 `[` 开头 |
| `frontend/app.js` | `#send-code` 先 trim 再判空，空号时写 `.form-error`「请先填写手机号，再获取验证码。」、聚焦手机号输入框、**不发请求**；请求与请求后的「用户是否改了号」比较都改用 trim 后的值 |
| `frontend/tests/login-validation.spec.js` | 新增，4 条真实 Chrome 用例（见下） |
| `.trellis/spec/backend/error-handling.md` | 补 `field_errors[].message` 必须是可直接上界面的中文，说明 `detail_text()` 的由来与断言范例 |

## 验证命令与真实输出

### 复现（改前，live 8017）

```
$ curl -s -b dd.jar -H "Content-Type: application/json" -H "X-CSRFToken: $TOKEN" \
    -d '{"phone":""}' http://127.0.0.1:8017/api/v1/auth/sms
{"code":"VALIDATION_ERROR","message":"请求字段不合法","field_errors":[{"field":"phone","code":"invalid","message":"[ErrorDetail(string='该字段不能为空。', code='blank')]"}],"trace_id":"c430c76d-bf7e-4e55-9d20-e659847fba1a"}
HTTP:422
```

### 后端用例先红

```
$ cd backend && uv run pytest tests/test_auth.py -q -k blank_phone
2 failed, 12 deselected in 13.07s
E       assert 'ErrorDetail(' not in '{"code": "V...03e8498b5e"}'
E         'ErrorDetail(' is contained here:
E           ssage": "[ErrorDetail(string='该字段不能为空。', code='blank')]"}], "trace_id": ...
```

### 后端用例转绿

```
$ cd backend && uv run pytest tests/test_auth.py -q
14 passed in 22.26s
```

（`uv run ruff format --target-version py313 dingdong_ca/core/api/common.py` 之后复跑：`14 passed in 21.69s`）

### live 8017 改后（同一台 runserver，autoreload 生效）

```
$ ... -d '{"phone":""}'        → {"code":"VALIDATION_ERROR","message":"请求字段不合法","field_errors":[{"field":"phone","code":"invalid","message":"该字段不能为空。"}],...} HTTP:422
$ ... -d '{"phone":"abc"}'     → field_errors[0].message = "手机号格式不合法"   HTTP:422
$ ... -d '{"phone":"13800000001","extra":1}'
                               → field_errors[0].message = "未知字段"          HTTP:422
```

### 浏览器先红（临时用 `git show HEAD:frontend/app.js` 还原前端，后端保持已修）

```
$ cd frontend && npx playwright test tests/login-validation.spec.js --reporter=list -g "空手机号点"
1 failed
  - unexpected value "请求字段不合法 该字段不能为空。"
```

这条同时证明两件事：后端修复在浏览器里确实生效（文案里不再有 `ErrorDetail(`），且前端用例拦的正是「前端不发请求、给专门文案」这个行为。

### 浏览器转绿（还原修复后）

```
$ cd frontend && npx playwright test tests/login-validation.spec.js --reporter=list
  ✓  1 空手机号点「获取验证码」：中文提示，且不发请求 (971ms)
  ✓  2 空手机号在 390×844 窄屏同样给中文提示 (798ms)
  ✓  3 格式不合法的手机号：界面提示是中文，不含内部 repr (869ms)
  ✓  4 填了合法手机号仍能拿到验证码并登录（回归） (2.4s)
  4 passed (5.8s)
```

第 1 条用 `page.on("request")` 收集 `/api/v1/auth/sms` 请求并断言为空数组（证明前端真的没把请求打出去）；第 4 条走完整流程：填号 → 取码 → toast「验证码已准备好」→ 登录按钮可用 → 输 `00000` → 进入「建立儿童档案」。

截图（`frontend/docs/` 为 Playwright 输出目录，`.trellis/tasks/T-006/shots/` 是副本）：

| 文件 | 内容 |
| --- | --- |
| `shots/t006-blank-phone-desktop.png` | 空号点击后：红色提示「请先填写手机号，再获取验证码。」，手机号框聚焦 |
| `shots/t006-blank-phone-mobile.png` | 390×844 同一状态 |
| `shots/t006-bad-format-desktop.png` | 填 `abc` 后：红色提示「请求字段不合法 手机号格式不合法」（无 repr） |
| `shots/t006-login-ok-desktop.png` | 合法号登录成功，落在「建立儿童档案」 |

### 其余门禁

```
$ cd frontend && npm run check                 → 无输出（通过）
$ cd frontend && npm run test:unit             → tests 16 / pass 16 / fail 0
$ npx prettier --check tests/login-validation.spec.js app.js → All matched files use Prettier code style!
$ python3 scripts/audit_documents.py           → {"markdown_files": 80, "local_links_checked": 497, "archived_files_checked": 85, "operations": 55, "schemas": 65, "errors": []}
$ cd backend && uv run ruff check .            → All checks passed!
$ cd backend && uv run ruff format --check --target-version py313 . → 126 files already formatted
$ cd backend && uv run python manage.py check  → System check identified no issues (0 silenced).
$ cd backend && uv run python manage.py makemigrations --check --dry-run → No changes detected
```

全量后端回归（`common.py` 的改动影响所有走 `@endpoint` 的入参校验路径）：

```
$ cd backend && uv run pytest -q
270 passed in 1000.72s (0:16:40)
```

浏览器侧回归（`tests/ca-account.spec.js` 的 `login()` 辅助函数正是走「填号 → 点获取验证码 → 输码登录」这条被改的路径）：

```
$ cd frontend && npx playwright test tests/ca-account.spec.js --reporter=list --output=/tmp/t006-pw-out
  ✓  1 NFC 承接：凭据不在地址栏留下，新号如实显示待接通 (6.6s)
  ✓  2 同一台机器人再次绑定复用同一个号，不换号 (7.0s)
  ✓  3 换机：确认弹窗讲清代价，旧号归档可查，新号重新开始 (9.3s)
  ✓  4 窄屏下账户号不撑破页面 (7.0s)
  4 passed (30.4s)
```

## 未验证项

- **没有**在公网入口跑 `deployment-tests/`（本任务 `gate: none`，不涉及部署，也没有公网凭据）。
- `frontend/tests/flows.spec.js` 等依赖 `inject_fixture` 的本地 e2e 未跑：它们的本地数据漂移失败是 T-018（S-05）要解决的问题，与本任务无关；本轮改用新增的登录专项 spec + 全量后端套件做回归。
- 只验了家长端。运营后台（`dingdong_ca/ops/`）走的是另一套 `OpsError` + `json_error`，`field_errors` 由 `OpsError` 显式给中文，不存在同类 repr 泄漏；**未实测**，仅读代码判断。
- 后端字段错误的 `code` 仍是写死的 `"invalid"`（未改成 `ErrorDetail.code`）。这是既有行为，本任务 acceptance 未要求，没动。

## 偏离与理由

- **前端没有加单元测试，而是加了 Playwright spec。** 登录表单的校验逻辑写在 `app.js` 里（碰 DOM），`frontend/unit/` 只收不碰 DOM 的纯函数模块；为一个 4 行校验新建顶层模块要同步 `server.cjs` 白名单与 `index.html`（spec 里记录过「漏同步直接 404」的坑），对本缺陷修复属过度扩散。改用仓库既有的本地真实 Chrome 层覆盖，并用「还原 HEAD 版 app.js 先跑红」证明这条用例真能证伪。
- **改了 trim 语义。** 原来比较「请求发出后用户有没有改号」用的是原始 `input.value`；加了 trim 校验后若仍比原始值，用户输入带空格时会在成功后静默 `return`（挑战值已拿到但界面不更新）。所以请求体与事后比较统一用 trim 后的值，属于同一处改动的必要收口。
- **重启了本地 runserver。** 8017 上原有的 runserver（9:45AM 起，非本会话启动）在本次改动触发 autoreload 后卡死、不再监听端口（`lsof` 无监听、curl exit 7）。已 kill 61634/61639/11222 并在仓库内重启（pid 11975，日志 `.trellis/.runtime/runserver-t006.log`）。这是仓库目录内的本地开发进程操作，未触达仓库外。
- **多提交了别人留在工作区的内容**：`.trellis/loop/runs.log` 里 T-002/T-003 两轮的驱动记录行、以及 `.trellis/loop/queue.md` 里 orchestrator 新写的 T-022 任务定义，开工时就是未提交状态。它们和本轮 `queue.md` 的 `todo→doing` 改动在同一文件/同一工作区，按本轮收尾一并提交，未修改其内容。`.trellis/loop/ORCHESTRATOR.md`（untracked，orchestrator 新增）保持未提交，留给 orchestrator 自己处理。

## 本轮产生的本地数据

- 浏览器 spec 第 4 条与截图流程各登录了一次：`/auth/sms` 各写入 1 条 `SmsChallenge`；登录写入 1 个合成家长账号（`username` 形如 `parent-<uuid32>`，手机号 `139xxxxxxxx` 随机）+ 1 个 `Family` + 1 条 `Membership` + 1 条 `LoginGrant`。截图脚本两次运行 + spec 三次运行累计若干条，均为本地开发库的合成数据，可随本地库清理，未触及远端。

## 结论

acceptance 全部达成：空号提交界面出现中文提示且不含 `ErrorDetail(`（截图 + spec 断言 + 后端用例三方证据），`npm run check` / `npm run test:unit` / `pytest tests/test_auth.py` 通过，`audit_documents.py` errors 为空。未发现与本改动相关的回归（全量后端 270 项通过）。
