# T-021 报告：四个展示面的设计文档

## Goal

只写 `.trellis/tasks/T-021/design.md`：人设 / 15–30 天成长报告 / 健康度四态 / 复测 CTA 四个展示面的数据形状、合成数据源放哪一层、空态与错误态、与 `设计/CA对接_C1_ca_account_id设计_20260916.md` §7 判定标准的逐条对照、拆成几个实现任务；不写代码。

## 实际做了什么

新增 `.trellis/tasks/T-021/design.md`，六节：

1. **§0 现状核查** —— 表格列出本轮开工前实际跑过的命令与结果（四个概念在 `backend/dingdong_ca` 与 `frontend/*.js|html` 零命中；家长端 10 条 hash 路由；既有「成长观察」是任意窗口、与契约固定 `period=15d|30d` 不同源；fixture 注入走 `inject_fixture` + `test_fixture` 表；集成开关 `INTEGRATION_DATA_SOURCE`；出站客户端未配置时抛 `DingDongNotConfigured`）。
2. **§1 四个展示面的数据形状** —— 先定四条共同约定（家长端一律以 `child_id` 为键、可用性词表复用 `growth.py` 既有取值、每面带来源三元组、对方字段只做展示映射），再逐面给出：契约来源、落点（`#reports` / `#settings` 的具体位置）、我方接口 JSON 形状、展示规则。
3. **§2 合成数据源分层** —— 结论放后端服务层：`api/ca_display.py` → `services/ca_display.py` → 按新开关 `CA_DISPLAY_DATA_SOURCE` 分派到 `test_fixture` 表或 `dingdong_client`；扩 `inject_fixture` 新增 6 个场景，一一对应 xlsx 表 6 的 6 个 mock 账号；给出「为什么不放前端 mock」的四条理由。
4. **§3 空态与错误态** —— 7 个 `availability` 取值 × 触发条件 × 家长端文案 × 是否显示数值；四个面各自的空态；5 类业务码处置；四条不许出现的行为。
5. **§4 §7 逐条对照** —— 11 条（10 已勾 + 1 未勾）逐条给出「本设计的关系」与结论，并如实记下两点不一致（四个展示面不在 §7 清单内、属 C5/C6 提前设计；§7 第 11 条仍只能由 D10/D12 解开，合成数据源跑通不算完成）。
6. **§5 实现任务拆分 + §6 未决待澄清** —— 建议拆 4 个任务（A 数据层与接口 / B 人设+健康度 / C 成长报告 / D 复测 CTA），附依赖理由；5 条新待澄清项，明确本轮不改澄清清单文件。

## 验证命令与真实输出

```
$ python3 scripts/audit_documents.py
{"markdown_files": 80, "local_links_checked": 497, "archived_files_checked": 85, "operations": 55, "schemas": 65, "errors": []}

$ git status --short
 M .trellis/loop/queue.md
 M .trellis/loop/runs.log
?? .trellis/tasks/T-021/

$ git diff --stat
 .trellis/loop/queue.md | 2 +-
 .trellis/loop/runs.log | 4 ++++
 2 files changed, 5 insertions(+), 1 deletion(-)
```

- `audit_documents.py` 的 `errors` 为 `[]`（acceptance 要求）✓
- 本轮无代码改动：`frontend/`、`backend/`、`设计/API/openapi.json` 均未出现在 `git status`（acceptance 要求）✓
- `.trellis/loop/runs.log` 的 4 行是驱动进程追加的历史轮次记录，非本轮编辑。

## 未验证项

- **设计文档里的事实断言只做了只读核对，没有跑任何接口**。四个面的接口形状、`availability` 取值、错误码处置都是设计提案，尚无实现，因此无法端到端验证。这符合任务范围（只写设计）。
- **§4 的 §7 对照只对 §7 文本本身**，没有回看 §7 引用的 C1 §3 草案是否与实现一致（该对照已在 C1 §7 实施后补充段里做过，本轮不重复）。
- **没有核实 `persona_health.status` 是否真的会出现 `insufficient_data`**——这需要真实对方数据，属 §6 待澄清项 ②。
- 设计里引用的 6 个 mock 账号期望界面（表 6 `expected_CA_UI` 列）是照抄 xlsx，未做二次解读。

## 偏离与理由

1. **建议的接口路径与契约路径不同名**。契约是 `GET /api/v1/ca/persona/current` 等 8 条 `/api/v1/ca/*`（那是**我们对对方**的出站路径）；设计里给家长端的 6 条接口是**我方入站**路径（`/api/v1/children/<child_id>/...`），与既有 44 条家长端接口同形。设计里已写明这层区分，不是笔误。
2. **新增开关 `CA_DISPLAY_DATA_SOURCE`，没有复用 `INTEGRATION_DATA_SOURCE`**。两者语义不同（前者管展示数据来源，后者管测评/观察的 fixture 闸门），复用会让「本地 fixture」与「真源」的切换互相牵连。理由已写进 design.md §2.1。
3. **§6 列了 5 条新待澄清项，但没有写进 `需求/CA-DingDong_对接澄清清单_V1.0_20260916.md`**。该清单的起草与发送是 `T-028` 的范围（`gate: external`），本任务 goal 只到 design.md，故只登记在设计中并注明「不改清单文件」。
4. **运营后台不扩大范围**。§4 第 10 条明确：四个面是家长端展示面，运营侧只要求出站失败告警可见，是否给运营页加人设/健康度只读列不在本设计内。
