# 探索数据契约与验证（2026-09-30）

## 交付

- 复用QuestionnaireVersion/AssessmentSession，新增reference内容来源、固定scoring与exploration_result。
- interest原型18题，按有序三岛选9题，数字字符串选项0–4，三题均值0–4；talent24题，选项1–5，八方向各3题累计3–15。
- selected_islands固定于创建，纳入幂等重放比对；家庭隔离、修订号、过期、授权撤回和已完成不可修改继续有效。
- 问题代码和方向映射固定；按canonical顺序返回，避免JSONB字典顺序或运营拖动顺序破坏续答位置。已发布/停用题库及计分不可变，完成结果不可重算覆盖。
- 新用途独立于专业算法闸门；原assessment专业fixture约束和合成图上传保持。
- 原有不筛选/assessment/exploration列表保留旧到新顺序；筛选interest/talent新到旧，游标绑定用途和顺序。
- 新增expires_at/completed_at；草稿过期由前端创建新答卷，历史结果保留。
- import_prototype_content默认dry-run；--apply草稿；--publish需配合--apply。两份题库、六岛和四指南共10个真实活动，不覆盖旧CA内容。
- 原型源固定3b8723e，本地JSON完整保留RIASEC、TalentData和FingerprintGuide。喜欢程度选项标签及四指南活动标题、材料和步骤与原型一致。
- 运营新增用途、复制/编辑/预览/发布、规则说明与儿童答卷/固定分数查看。结构固定，文本可编辑，权限和冲突防护保留。

## 本轮验证

- 关键用例先记录red-tests.log：scoring字段尚未迁移，测试失败；随后补实现。
- 新增15项真实PostgreSQL测试通过：green-tests.log。
- 后端全量404项通过，1条已存在TestFixture类收集警告，12.74秒：full-backend-tests.log。
- 最终新功能与运营相关回归79项通过，3.68秒：final-ops-tests.log。
- ruff、Django check、makemigrations --check --dry-run、format --check --target-version py313均通过，各独立log。
- 运营question_editor.js通过node --check。
- 未执行push、部署、远端写入或真实短信；未读取部署env或输出凭据。

## 续接

父任务负责跨模块浏览器E2E、生成字段/契约文档、手册与发布审查。本子任务代码待父任务最终整合审查，不独立提交或归档。
