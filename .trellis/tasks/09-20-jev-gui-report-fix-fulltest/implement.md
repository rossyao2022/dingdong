# Implement：执行计划

## 前置事实（已核实）

- 修复点：`frontend/app.js:507` `personaBlock()` 绑定行，`p.talent_weight_version`（`pw_v1`）由合成 fixture `backend/dingdong_ca/testsupport/ca_display.py:43` 提供，真源模式下来自 DingDong API。
- 单测 `frontend/unit/companion.test.js` 只断言视图模型字段，不断言绑定行 HTML 文案——修复不破坏单测。
- 真实 Chrome spec `companion-panel.spec.js` / `t043-persona-copy.spec.js` 不断言「权重版本」字样——无断言冲突。
- `versionLabel()`（`app.js:36`）提取 `v1` 样式版本号，修复后绑定行不再需要它。
- 运营后台测试模式：`ops-console.spec.js` 先例——Django shell 建临时员工（`account_admin`），测完 `deactivate`。
- 本地环境：前端 4173 / 后端 8017 / PostgreSQL 55439 / Redis 56379 在跑（2026-09-20 实测）。
- Jev 调用契约：`POST https://api.typesafe.ai/v1/systemone`，`Authorization: Bearer $TYPESAFE_API_KEY`，key 只走环境变量。

## 步骤

### A. 修复（P-20）

1. `frontend/app.js:507`：
   - 改前：`<p class="note">绑定于 ${date(view.binding?.bind_time)} · 权重版本 <span title="${esc(p.talent_weight_version)}">${esc(versionLabel(p.talent_weight_version))}</span></p>`
   - 改后：`<p class="note" title="权重版本 ${esc(p.talent_weight_version)}">绑定于 ${date(view.binding?.bind_time)}</p>`
2. 验证方式：真实 Chrome 悬停 `title` 含 `pw_v1`；正文无「权重版本」。

### B. 测试报告

3. 写 `.trellis/tasks/09-20-jev-gui-report-fix-fulltest/report.md`：
   - 测试设计（Jev 嵌入 GUI 测试的方式：DOM 抓真实渲染文本 → systemone → 概率断言）
   - 17 项结果表 + Jev 原始答案 + token 用量
   - 两个 FAIL 逐句归因（权重版本 / 悬停句口径差异）与修复方案
   - 修复后复验数据（步骤 D 产出后补全）

### C. 完整前后端图形化交互测试（修复后执行，全部真实 Chrome 有头、零 mock 零拦截）

4. **家长端全流程**（扩展 `/tmp/jev_gui_test.mjs`）：
   - 登录 → 建档 → 探索四题（Jev 逐题安全判定）→ 活动闭环（Jev 适宜性判定）
   - → NFC 绑定 → 核验授权 → `inject_fixture ca_display_reassess` → 人设卡
   - → 22 题测评（真实 Celery 生成初始报告，走完保存并完成）→ 初始报告可见
   - → 人设卡 Jev 复验 S4 两项
5. **七路由走查**：今日陪伴/成长旅程/测评与报告/我的 DingDong/账户与关联/家长支持/天赋探索，每页标题可见；390×844 无横向溢出；全程 `pageerror` 为空。
6. **运营后台**：临时员工账号登录（127.0.0.1:8017/ops/）→ 工作首页 → 儿童与家庭/服务事项/CA 账户/题库核心列表页走查 → 登出 → `deactivate` 清理。
7. **后端健康**：`/api/v1/policies/current` 等 read-only 接口真实响应核对（后端本轮零改动，确认无回归即可）。

### D. 回归门禁

8. `cd frontend && npm run check`
9. `cd frontend && npm run test:unit`（含 companion 18 项）
10. `cd frontend && npx playwright test tests/t043-persona-copy.spec.js tests/companion-panel.spec.js`
11. `cd backend && uv run ruff check . && uv run ruff format --check --target-version py313 .`（后端未改，门禁确认）
12. `python3 scripts/audit_documents.py`（本轮会新增 report.md，需过文档审计）

### E. 收尾

13. 汇总测试结果，更新 `report.md` 复验数据。
14. Phase 3.3 spec update：判断是否有可沉淀知识（TypeSafe/Jev 测试模式若用户认可，可写入 spec；至少在报告记录）。
15. Phase 3.4 分批提交（commit message 首行带任务 id），等用户确认。

## 回滚点

- 修复仅 `frontend/app.js` 一行文案，`git checkout -- frontend/app.js` 即回滚。
- 临时员工账号测完即 `deactivate`，不留残留。
- Jev API key 不落盘；`/tmp/jev_gui_test.mjs` 不进 git。
