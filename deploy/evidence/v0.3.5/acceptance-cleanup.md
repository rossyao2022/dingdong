# v0.3.5 验收后临时数据清理记录

日期：2026-09-14。范围：公网演示环境（tigery / `dingdong-demo`）。清理本轮 v0.3.5 公网浏览器验收与本轮准备脚本产生的临时账号与合成测试内容。

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

清理补写审计，复用既有动作码（不引入未翻译的新动作），`actor` 为空即显示为"系统"，`detail.reason` 写明是验收后清理：

- `questionnaire.retire` / `activity.retire`：`target_kind` 为 `questionnaire_version` / `activity_content_version`，`detail` 含 `before` / `after` / `reason`
- `child.profile_update`：`target_kind` 为 `child`，`detail` 含 `before` / `after=archived` / `reason`
- `staff.status`：`target_kind` 为 `app_user`
- 家庭关闭复用最接近的既有动作 `family.freeze`，`detail.reason` 明确说明是验收清理（语义等同"关闭家庭"，本版没有独立的 `family.close` 动作码）

脚本：`cleanup-acceptance-data.py`。它按**显式名单**定位对象——儿童按本轮称呼前缀（`冲突保留*` / `P1跨入口*` / `P2验收隔离儿童*` / `独立复验*`），题库与活动按本轮逐条列出的 `code + version`，工作人员按 `acpt035_` 前缀——**不使用全表删除或宽泛通配**。运行前先统计 `before`，运行后统计 `after`，全过程打印。

## 2. 本轮清理对象

本轮公网验收共创建：

- 儿童 9 个：`冲突保留*` 5（家长端冲突恢复专项）、`P1跨入口家长/运营*` 2（P1 跨入口专项，桌面）、`P2验收隔离儿童092957`（准备脚本首次试跑失败留下的孤儿，无失败任务）、`P2验收隔离儿童093012`（准备脚本正式建立的隔离家庭）。
- 题库版本 11 个、活动版本 4 个：P1 消歧/同名/版本替代与 `ops-public` 题库/活动用例的产物（本轮 stamp 前缀 `mu0k`）。
- 临时工作人员 3 个：`acpt035_admin` / `acpt035_operator` / `acpt035_content`。
- 测试家长账号 9 个（本轮浏览器用例用随机手机号建立）。

另外，匹配前缀时同时收进了上一轮（第三轮独立验收）遗留的 2 个 `独立复验*` 儿童（儿童本身已归档，本轮补做其家庭关闭与家长停用）。

## 3. 公网环境（tigery）清理前后

| 指标 | 清理前 | 清理后 |
| --- | ---: | ---: |
| 正常家庭 | 19 | 10 |
| 在册儿童 | 12 | 3 |
| 已发布题库 | 9 | 2 |
| 已发布活动 | 12 | 8 |
| 启用工作人员 | 4 | 1 |
| 审计记录 | 583 | 619 |

- 关闭测试家庭 **9** 个；归档儿童 **9** 个。
- 停用题库版本 **11** 个、活动版本 **4** 个。
- 停用账号 **12** 个：工作人员 `acpt035_*` 3 个 + 测试家长 9 个。
- 新增审计 **36** 条。
- 儿童表中另有 4 个匹配前缀的儿童在清理前已是 `archived`（第三轮遗留），本轮不重复写审计。

清理后仍在服务的基线内容（合成演示数据，未动）：

- 题库：`exploration/vreadable-v2`、`initial-assessment/vreadable-v2`
- 活动：`test-activity-0` … `test-activity-7`（`vreadable-v2`）
- 在册儿童：`合成儿童1`、`合成儿童2`、`小易`；正常家庭 10 个（含 7 个无在册儿童的历史家长家庭）
- 启用工作人员：仅 `dingdong_admin`

## 4. 未清理的残留（明确保留）

以下历史测试家庭来自更早的验收轮次（`HTTP兼容验收`、`侧栏验收`、`验收儿童*`、`验收隔离报告`、`P1验收隔离儿童192347` 等），**本轮未清理**——本轮要求"只定向清理本轮验收建立的临时数据，不动其他对象"。它们保持原状，可在后续轮次按同一脚本模式补清（其前缀已记录在 v0.3.4 的清理记录里）。公网仍可用运营端"家庭查询"检索到这些历史家庭，儿童显示为"已归档"，这与 v0.3.4 的取舍一致：保留可追溯性优先于清理彻底性。

## 5. 清理后复验

清理后两个入口复验仍全部通过：

- 公网 `http://110.42.225.196`：`/dingdong/`、`/ops/login/`、`/admin/login/`、`/api/v1/runtime` 均 200
- Tailscale `100.115.66.119:18080`：`/`、`/ops/login/`、`/api/v1/runtime` 均 200
- 6 个 `dingdong-demo-*` 容器全部在运行

原始输出：`cleanup-run.txt`。
