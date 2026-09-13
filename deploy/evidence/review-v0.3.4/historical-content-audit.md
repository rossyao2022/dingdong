# 历史内容标识兼容核查（只读）

时间：2026-09-13 18:55 Asia/Shanghai。对象：运行中的 `dingdong-demo-api-1` 容器所连的演示库。

目的：确认修复前线上是否已经存在「不同内容被误合并到同一内部标识」的数据，以及历史答卷、活动记录是否仍绑定在原版本上。

方法：在容器内 `manage.py shell` 只读查询，**未写入任何数据**；无迁移、无 code 重算。原始输出见同目录 `historical-content-audit.raw.txt`。

---

## 规模

| 项 | 数量 |
| --- | --- |
| questionnaire_version | 15 |
| activity_content_version | 13 |
| assessment_session | 0 |
| assessment_session 绑定了问卷版本 | 0 |
| activity_record | 18 |

## 发布互斥约束

| 检查 | 结果 |
| --- | --- |
| 同一 code 下有多个 published（题库） | 0 |
| 同一 code 下有多个 published（活动） | 0 |

## 同一 code 下出现多个不同标题（潜在误合并）

**题库**：1 个

| code | 版本 | 状态 | 标题 |
| --- | --- | --- | --- |
| `qn-abc-mtzoqmm9` | v1 | retired | ABC mtzoqmm9 观察 |
| `qn-abc-mtzoqmm9` | v2 | retired | ABC mtzoqmm9 绘画 |

来源与影响：这是第二轮独立验收在公网浏览器会话里用**旧** `generated_code` 创建的两份草稿（slug 都为 `abc`，被并入同一 code 的 v1/v2）。两份均为 `retired`、**从未发布**，也没有任何 `AssessmentSession` 或 `ReportVersion` 引用。对家长端与历史数据没有影响。

**活动**：0 个（线上活动没有多标题 code）。

## 真实业务与种子内容

- `exploration`、`initial-assessment`（`readable-v2`，published）：标题唯一、code 唯一，是家长端在用的种子题库。
- `test-activity-0` … `test-activity-7`（`readable-v2`，published）：标题唯一、code 唯一；其中 `test-activity-0/readable-v2` 被 **18 条 ActivityRecord** 引用。
- 其余 `pub-*`、`review-*`、`qn-*`、`act-*` 均为历史验收遗留（draft/retired）。

## 结论

1. 线上不存在「同一 code 有多个 published」的情况，发布互斥约束完好。
2. 唯一的多标题 code 是验收遗留、已 retired、无引用，不影响家长端与历史数据。
3. 历史答卷：线上 **0 条 AssessmentSession**，不存在问卷版本绑定被破坏的风险。
4. 活动记录：18 条仍绑定 `test-activity-0/readable-v2`，未被改动。
5. 因此**不做批量 code 重算，也不改动既有内容的归属**。新身份规则只作用于修复后新建的内容；旧 code 与其发布组保持不变，历史记录继续可读。

## 如需进一步清理（可选，本次未做）

`qn-abc-mtzoqmm9` 的两份均已 `retired`，清理收益为零；任何「改名/重新归属」都会改动既有记录，收益低于风险。如后续确实希望消除该痕迹，建议做法是保持只读、在验收报告中记录，而不是重算 code。
