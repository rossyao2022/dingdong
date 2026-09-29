# 会展固定演示号恢复与核验

## Goal

按已放行的操作备份试用库并将原儿童的固定演示号恢复为使用中待接通，验证状态和公网健康

## Requirements

- 为次日会展现场的同一工作人员手机号、同一儿童和同一 NFC 标签恢复固定 Prototype 演示号。
- 备份试用数据库，先核对账号归属、标签摘要、儿童状态和冲突账户，再写入。
- 只将已归档账号恢复为使用中、待接通；实际 bind 留待工作人员碰标签触发。
- 验证数据库状态、公网入口、版本与六容器，记录边界和现场步骤。

## Acceptance Criteria

- [x] 恢复前数据库备份非空且有摘要。
- [x] 预检满足原手机号、原儿童、原标签和无活跃号冲突。
- [x] 演示号恢复为 active/unbound，归档时间清空，留审计记录，授权状态未被伪造。
- [x] 公网 v0.3.18 与六容器健康；未发送短信或替现场宣称实体 NFC 已通过。
- [x] 结果报告与项目记忆更新并本地提交。

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
