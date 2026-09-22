# T-045 第五轮产品巡检报告

- 分支：`codex/release-v0.3.7`
- 日期：2026-09-22
- gate：review（本任务 `status` 置 `gated`，gates.md 申请段有 `REQUEST T-045 review`）
- 结论：只产出文档，未改产品代码。产出 2 条运营端新条目（O-15/O-16）+ S-07 判断；T-043/T-044 修复处端到端复核通过；无新的家长端真缺陷。

## 实际做了什么

1. 家长端真实 Chrome 走查（1 次登录）：建档 → 绑机器人 → 核验关联 → `inject_fixture ca_display_reassess` → 人设卡复核（T-043）→ 七路由 + `#help` 留档与 390×844 溢出检查 → 归档探针（T-044）。
2. 运营端真实 Chrome 走查：12 个一级页 + 6 个详情页留档，复核 O-12/O-14，定位 O-15/O-16。
3. S-07：单独跑 `flows.spec.js --grep "用途授权、22题"` 取证当前行为。
4. 写 `backlog.md` 并申请 review。

## 验证命令与真实输出（数字照抄）

- 家长端走查 `node .trellis/tasks/T-045/walk-parent-v5.mjs`：exit 0；八路由 390×844 `overflow` 全 `0`；`pageerror` 空；`FAILED` 仅 2 条 `POST /api/v1/auth/refresh` 401（未登录启动探测，非缺陷）。
- 运营端走查 `node .trellis/tasks/T-045/walk-ops-v5.mjs`：exit 0；12 页 + 6 详情全 200；`FAILED []`、`ERRORS []`。
- S-07 用例 `cd frontend && npx playwright test tests/flows.spec.js --grep "用途授权、22题" --reporter=list`：**1 passed (25.7s)**（用例自身 24.6s），「查看初始报告」在 20 秒窗口内就绪。
- 归档探针：`POST /api/v1/ca-accounts/ca_01M33JJ42FKCPG9CSFX489C1JK/retire` 返回 **200**；归档后账户页/成长观察/三展示面口径一致（见 backlog 第三节）。
- `python3 scripts/audit_documents.py` errors 见收尾（预计 `[]`，运行结果补记于提交前）。

## 未验证项

- O-13 本轮库中无服务事项，未在真实 UI 复核「该儿童的其他事项」排除自身；代码已含 `.exclude(pk=row.pk)` 且有 T-044 回归用例覆盖。
- 真源模式（`CA_DISPLAY_DATA_SOURCE=dingdong`）与生产未验证。
- `deployment-tests/*`（公网入口 + 生产库写操作）未跑，属权限边界外。
- `flows.spec.js` 完整 8 项未重跑（只跑了 S-07 那一项，避免额外短信消耗）；其余 7 项不在 S-07 判断范围内。

## 偏离与理由

1. **运营端登录凭据与 queue.md 不符**：queue.md T-045 记 `admin` / `dingdong-admin`，实测本地库无 staff 账号（共 5 个账号全 `account_kind=parent`）。为完成运营端走查，在本地开发库临时建 `t045walk`（superuser + `account_kind=staff` + 姓名「巡检走查临时账号」），走查结束后已将其 `is_active` 置 `False` 停用（账号保留在库供核对，也可删除）。这是本地库写入，与 `inject_fixture` 同类，未触生产/远端/未读敏感文件。
2. **T-043 文案再次变化**：T-047（09-20 文案清理）把 T-043 的人设卡说明句从「来自机器人服务，中文名仅供参考；悬停可看原始取值」进一步精简为「由机器人服务提供」，仍满足 T-043 验收（无内部话术、`title` 保留原始取值 `cognitive`），backlog 第三节如实记录。
3. **未跑 22 题完整测评**：展示面数据用 `inject_fixture` 注入，22 题流程本身由 T-047 GUI 重测（S6 3/3）与本轮 S-07 用例覆盖，避免重复消耗短信与 worker 时间。
