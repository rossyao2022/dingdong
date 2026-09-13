# v0.3.4 验收后临时数据清理记录

日期：2026-09-13。范围：公网演示环境（tigery / `dingdong-demo`）与本地 Docker 演示环境，清理本轮及此前几轮公网浏览器验收产生的临时账号与合成测试内容。

## 1. 清理原则

**只做状态变更，不物理删除。** 全库外键均为 `PROTECT`，硬删除会连带审计与业务记录；本轮要求"保留审计"，因此统一改用模型自带的终态字段：

| 对象 | 动作 | 目标状态 | 对家长端的影响 |
| --- | --- | --- | --- |
| 家庭 `Family` | 关闭 | `active` → `closed` | 无（家长端不读 `family.status`） |
| 儿童 `Child` | 归档 | `active` → `archived` | 从"在册儿童"计数与可选列表中移除 |
| 题库 `QuestionnaireVersion` | 停用 | `published`/`draft` → `retired` | 不再出现在家长端可选题库 |
| 活动 `ActivityContentVersion` | 停用 | `published`/`draft` → `retired` | 不再出现在家长端可选活动 |
| 工作人员账号 | 停用 | `is_active=True` → `False` | 无法再登录运营后台 |
| 家长账号 | 停用 | `is_active=True` → `False` | 该测试账号无法再登录 |

清理补写了审计记录，复用既有动作码（不引入未翻译的新动作），`actor` 为空即显示为"系统"，`detail.reason` 写明是验收后清理：

- `questionnaire.retire` / `activity.retire`：`target_kind` 为 `questionnaire_version` / `activity_content_version`，`detail` 含 `before` / `after` / `reason`
- `child.profile_update`：`target_kind` 为 `child`，`detail` 含 `before=active` / `after=archived` / `reason`
- `staff.status`：`target_kind` 为 `app_user`
- 家庭关闭复用最接近的既有动作 `family.freeze`，`detail.reason` 明确说明是验收清理（语义上等同"关闭家庭"，本版没有独立的 `family.close` 动作码）

脚本：`cleanup-acceptance-data.py`（公网）、`cleanup-acceptance-data-local.py`（本地）。两者都以显式家庭 ID 列表为输入，并在动手前断言数量，避免误伤。

## 2. 公网环境（tigery）

| 指标 | 清理前 | 清理后 |
| --- | ---: | ---: |
| 正常家庭 | 38 | 10 |
| 在册儿童 | 31 | 3 |
| 已发布题库 | 10 | 2 |
| 已发布活动 | 13 | 8 |
| 启用工作人员 | 4 | 1 |
| 审计记录 | 339 | 419 |

- 关闭测试家庭 **28** 个（含本轮 `P1验收隔离儿童`×2、`P1跨入口家长/运营`×2，以及历史 `HTTP兼容验收`×20、`侧栏验收`、`验收儿童e43e/85ce`、`验收隔离报告`）。
- 归档儿童 **28** 个；停用题库版本 **14** 个、活动版本 **7** 个（编号前缀 `qn-` / `pub-` / `act-` / `pub-act-`）。
- 停用账号 **31** 个：工作人员 `acpt034_admin` / `acpt034_operator` / `acpt034_content`，以及 28 个测试家长账号。
- 新增审计 **80** 条。

清理后仍在服务的基线内容（合成演示数据，未动）：

- 题库：`exploration/vreadable-v2`（四个小情境：探索偏好体验）、`initial-assessment/vreadable-v2`（日常探索问卷（流程测试））
- 活动：`test-activity-0` … `test-activity-7`（`vreadable-v2`，`[合成测试]` 系列）
- 家庭：`test-phase1-v1-1`（合成儿童1）、`test-phase1-v1-2`（合成儿童2）、`小易` 及 7 个无儿童的历史家长家庭

## 3. 本地 Docker 环境

| 指标 | 清理前 | 清理后 |
| --- | ---: | ---: |
| 正常家庭 | 15 | 2 |
| 在册儿童 | 14 | 2 |
| 已发布题库 | 27 | 2 |
| 已发布活动 | 21 | 8 |
| 启用工作人员 | 3 | 0 |
| 审计记录 | 274 | 345 |

- 关闭测试家庭 **13** 个（多为 `P1跨入口` 多轮重复运行残留），归档儿童 **12** 个。
- 停用题库版本 **33** 个、活动版本 **13** 个。
- 停用账号 **16** 个：工作人员 `local-accept-admin` / `local-accept-operator` / `local-accept-content`，以及 13 个测试家长账号。
- 新增审计 **71** 条。

> 本地环境的运营后台验收账号已全部停用。若需要重跑本地 `ops-public` 验收，需先重新创建/启用对应账号；公网验收账号同理。

## 4. 清理后复验

| 入口 | 结果 |
| --- | --- |
| `http://110.42.225.196/dingdong/` | 200 |
| `http://110.42.225.196/ops/login/` | 200 |
| `http://110.42.225.196/admin/login/` | 200 |
| `http://110.42.225.196/api/v1/runtime` | 200，`{"environment":"demo", ...}` |
| `http://100.115.66.119:18080/ops/login/` | 200 |
| `http://100.115.66.119:18080/api/v1/runtime` | 200 |
| `http://100.115.66.119:18080/` | 200 |

公网前后端容器 `RestartCount=0`，`StartedAt=2026-09-13T11:21Z`（部署时刻），清理未重启任何容器。

## 5. 未做与残留

- **未物理删除任何记录**。测试家庭仍在运营端"家庭查询"里可按关键词检索到（该页不做状态过滤），儿童详情会显示为"已归档"。这是刻意的取舍：保留可追溯性优先于清理彻底性。
- **历史测试家庭一并关闭**，因此"家庭总数"口径从 38 降到 10，与仪表盘上"含历史测试家庭"的说明不再冲突。
- 报告重试验收产生的一次真实 `ReportVersion`（任务 `9557b88a-...` 第 6 次尝试成功）保留，属有效业务产出。
- 隔离验收账号的授权、伙伴关联核验、服务事项记录保留，作为闭环证据。
