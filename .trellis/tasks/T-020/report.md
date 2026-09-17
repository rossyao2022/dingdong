# T-020 报告

## goal

用 `inject_fixture` 注入真实失败任务，验证阶段画像/数据同步失败在家长端是否可见；不可见则补可见性，可见则只记证据。

## 实际做了什么

**结论：数据同步失败在家长端已经可见，无需改产品代码；只补了一条可复跑的回归用例 + 证据。**

新增 `frontend/tests/sync-failure-visibility.spec.js`（1 条真实 Chrome 用例），流程：

1. 真实登录（随机手机号 + `00000`）→ 建档「同步失败验证儿童」。
2. `inject_fixture --child-id <id> --scenario sync_failure`（fixture 第 1 条为合法观察、第 2 条为 `UPSTREAM_TIMEOUT`）。
3. 核验并关联机器人 → 真实 Worker 跑第一轮同步成功，生成观察 + 阶段画像 + 阶段报告。
4. 用 `manage.py shell` 调 `schedule_sync(association.pk)` 立即触发第二轮同步 → 真实 Worker 把 `SyncCheckpoint.error_code` 写成 `UPSTREAM_TIMEOUT`。
5. 断言家长端「成长观察」面板标题变为「显示上次成功同步的观察」，并出现可见提示「同步未取得最新结果，已有数据不会当作最新数据展示。」；桌面与 390×844 窄屏各截图；收 `pageerror` 断言为空。

不拦截、不伪造任何 API 响应；失败状态由真实 Celery Worker 处理真实注入的 fixture 产出。

## 验证命令与真实输出

- `cd frontend && npx playwright test tests/sync-failure-visibility.spec.js --reporter=list --output=/tmp/dingdong-pw-out`
  → `1 passed (26.7s)`，单用例耗时 `25.9s`。
- `cd frontend && npm run check` → exit 0（无输出，语法检查通过）。
- `cd frontend && npm run test:unit` → `tests 16 / pass 16 / fail 0 / skipped 0 / duration_ms 74.844916`。
- `python3 scripts/audit_documents.py` → `{"markdown_files": 80, "local_links_checked": 497, "archived_files_checked": 85, "operations": 55, "schemas": 65, "errors": []}`。

证据：

- `.trellis/tasks/T-020/growth-overview-after-failure.json`：`robot_observation.availability = "stale"`、`robot_observation.reason = "UPSTREAM_TIMEOUT"`、`stage_status = "ready"`（第一轮成功的阶段画像仍保留）。
- `.trellis/tasks/T-020/shots/sync-failure-desktop.png`（1280×1796）、`.trellis/tasks/T-020/shots/sync-failure-mobile.png`（390×2712）。

## 未验证项

- **阶段画像 `failed` 状态的端到端可见性未验证**：家长端 `stage_status === "failed"` 会显示「处理暂未完成，请联系工作人员。」（`frontend/app.js` 测评与报告页），后端 `growth.py` 的 `stage` 计算也确有 `failed/cancelled` 分支。但现有 `inject_fixture` 的 19+4 个场景里，**没有任何一个能真实产生一条 `status="failed"` 的 `stage_profile` BackgroundJob**（`build_stage` 的非重试错误 `INPUT_INVALID`/`RULE_INVALID` 需要手工破坏数据才能触发，fixture 不覆盖）。因此该分支只在代码层面确认存在，未做到端到端注入验证。这是 fixture 场景的空白，不是产品缺陷。
- 第二轮同步任务在报告时仍处于 `pending`（`attempt_count < max_attempts=5`，会按有限重试走完再置 `failed`）；家长端可见性不依赖最终 failed，`checkpoint.error_code` 在首次失败时即写入、面板立即进入 `stale`，本次已实证。

## 偏离与理由

- 无产品代码改动（目标即「可见则只记证据」）。
- 只验证了数据同步失败这一条可真实注入的失败路径；阶段画像 `failed` 分支因 fixture 空白未端到端验证，已在「未验证项」如实标注，不硬凑。

## 本次注入的合成数据（供清理参考）

- 儿童：`同步失败验证儿童` `0a4055e4-ffc8-41f2-a8a1-dcc06c85deca`
- 家庭：`c3b331ee-9aa1-4065-963b-f1059a2b6711`
- 家长手机：`+8613748001381`
- 关联：`7652aa3f-b5a1-4a79-b17e-aef33d470df7`（verified），checkpoint `cursor=1 / error_code=UPSTREAM_TIMEOUT`
- 观察批次 1 条（revision 1）、阶段画像 `fc349ac1-e166-45a2-857e-ea8a3207bb7d`、阶段报告 `4c86a69c-5197-46c2-ac7b-ea372c9d0c5b`
- BackgroundJob：`sync/succeeded`、`stage_profile/succeeded`、`report/succeeded`、`sync/pending(UPSTREAM_TIMEOUT)` 各 1 条
