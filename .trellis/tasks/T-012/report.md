# T-012 报告：P-09 「机器人指纹」文案去掉「指纹」二字

## goal
账户页把「机器人指纹 6948909c」改成不含「指纹」的说法（如「机器人标识（前 8 位）」），避免撞上「不采集真实指纹」的承诺。

## 实际做了什么
- `frontend/app.js:700` `accountRow()` 账户行 note：`机器人指纹 ${...}` → `机器人标识（前 8 位）${...}`。
- `frontend/app.js:782` `replaceRobotDialog()` 换机弹窗正文：`（指纹 ${...}，账户号 ...）` → `（机器人标识前 8 位 ${...}，账户号 ...）`。该弹窗是账户页上的换机流程，与账户行同一处措辞，一并改掉。
- 摘要值来源未动：`backend/dingdong_ca/core/services/ca_account.py:72 token_fingerprint()` 仍是 `digest[:8]`，界面显示的还是服务端回的那 8 位，只是标签换了说法。
- 新增 `frontend/tests/robot-label.spec.js`（真实 Chrome，1 条用例）：绑定一台机器人后断言账户行含「机器人标识（前 8 位）」且含服务端返回的同一摘要、机器人账户面板不含「指纹」；再触发换机弹窗，断言弹窗仍含同一摘要且不含「指纹」；桌面 + 390×844 截图，并断言窄屏无横向溢出。

## 验证命令与真实输出（原样照抄）
1. TDD 红：`cd frontend && npx playwright test tests/robot-label.spec.js --reporter=list`
   ```
     ✘  1 tests/robot-label.spec.js:34:1 › 账户页把机器人摘要叫「机器人标识（前 8 位）」，不说「指纹」 (9.6s)
    Error: expect(locator).toContainText(expected) failed
    Locator: locator('.account-row').first()
    Expected substring: "机器人标识（前 8 位）"
    Received string:    "当前机器人ca_01M2QCWZH102GEWPSC2YVHSTKS刚生成使用中待接通机器人指纹 d542007b · 建立于 2026/9/17 17:59:23"
    > 55 |   await expect(row).toContainText("机器人标识（前 8 位）");
  1 failed
   ```
2. 改后绿：同命令
   ```
     ✓  1 tests/robot-label.spec.js:34:1 › 账户页把机器人摘要叫「机器人标识（前 8 位）」，不说「指纹」 (8.5s)
   1 passed (9.0s)
   ```
3. 截图补拍（等底部 toast 自行收起后再截，避免压住这一行文字）：同命令
   ```
     ✓  1 tests/robot-label.spec.js:34:1 › 账户页把机器人摘要叫「机器人标识（前 8 位）」，不说「指纹」 (12.2s)
   1 passed (12.9s)
   ```
4. `cd frontend && npm run check` → exit 0（`node --check app.js && api.js && playworld.js && server.cjs`）。
5. `cd frontend && npm run test:unit` → `ℹ tests 16` / `ℹ pass 16` / `ℹ fail 0` / `duration_ms 77.74225`。
6. `python3 scripts/audit_documents.py` → `{"markdown_files": 80, "local_links_checked": 497, "archived_files_checked": 85, "operations": 55, "schemas": 65, "errors": []}`。
7. 全仓检索旧措辞：`grep -rn '机器人指纹\|（指纹' frontend/ backend/ --include='*.js' --include='*.py' --include='*.html' --include='*.css' --include='*.json'`（排除 node_modules）→ 0 命中。
8. 人工看图核对：`.trellis/tasks/T-012/shots/account-row-desktop.png`（「机器人标识（前 8 位） 31e6f210 · 建立于 2026/9/17 18:00:21」）、`account-row-mobile.png`（390×844 同上，无横向滚动）、`replace-dialog-desktop.png`（「现在这台机器人（机器人标识前 8 位 f529b833，账户号 ca_01M2QCXHK7GZ313QCX2GSNV3CP）会先归档……」）。

## 未验证项
- 未跑 `frontend/tests/ca-account.spec.js` 全量（8 条）与 `flows.spec.js` 回归：每条用例要发 1 次 `/auth/sms`，本机 IP 近 1 小时计数开工时 48/50（`SmsChallenge` 只读计数），全量必撞 429。已改用检索替代：全仓已无「机器人指纹」「（指纹」命中，`ca-account.spec.js` 与 `flows.spec.js` 也没有断言这两处措辞（`flows.spec.js:110/:114` 断的是测评页「真实指纹采集尚未开放」，未改）。
- 未在真实设备（手机/平板）上看过；窄屏只用 Chrome 390×844 视口验证。

## 偏离与理由
- 任务 goal 只点了账户行的「机器人指纹 6948909c」，我连带改了同一账户页上的换机弹窗 `（指纹 …）`：两处是同一个词、同一页、同一次换机流程，只改一处会留下同一页两种说法。范围未超出「家长端账户页文案」。
- 运营端仍有「指纹」字样，按 notes 只记录不改：`backend/dingdong_ca/ops/templates/ops/ca_accounts.html:99`（「不展示 NFC token 原文，只有前 8 位摘要指纹」）、`:129`（`指纹 {{ row.nfc_token_hash|slice:":8" }}`）。若要一并改，建议另开运营端文案任务。
- `frontend/app.js:380` 测评页「真实指纹采集尚未开放」保留：那是「不采集真实指纹」承诺的原文，与本任务要消除的歧义正好相反。
- `frontend/tests/ca-account.spec.js:78` 注释「接口只回短指纹，不回 token 原文」未改：属代码注释，不在界面文案范围。
