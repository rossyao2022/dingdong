# CA测评表单与22题回答回看实施证据

2026-10-01，本地实施；未推送、未部署、未发短信、未调用真实供应商。

## 行为与边界

- 家庭与儿童→儿童详情→“测评表单”，复用后台会话及child.view/report.view；operations、technical、account_admin可用，content和家长不可用。
- 默认每个用途interest/talent/exploration/assessment取最近一次completed且completed_at非空记录；包含22题问卷。选择session_id只取当前儿童的那一份已完成历史记录，未完成/其他儿童404，无效编号422。
- JSON格式ca-assessment-form-v1。题干、选项、回答、原始结果、计分及来源版本、完成时间均来自实际保存记录；兴趣范围0–4、八维范围3–15、四情境保持回答计数，不推导专业分或叮咚角色。
- 专业结果仅从该测评的ProfileSnapshot选择经过验证的指标字段，没有结果保持null，演示专业指标仍为null；不带算法原始输入或图片。
- 当前网页陪伴方式有保存行才输出；默认界面偏好不伪装为家长已选择。无保存行null/not_selected。
- 资料不包含姓名、手机号、生日、NFC或密钥；包含当前儿童内部编号与测评编号用于记录关联。
- 预览、复制、JSON、CSV共用纯聚合服务；服务无外部依赖和发送功能。历史问卷使用创建时固定版本，不读取后来发布的题库。

## 路由与快照

全部仅GET，入口位于/ops/，无需改家长JWT/API/OpenAPI路由。

| 路由 | 参数与结果 |
| --- | --- |
| /ops/children/{child_id}/assessment-form/ | 可选session_id，渲染中文表单及下载链接 |
| /ops/children/{child_id}/assessment-form/json/ | 必需snapshot，application/json附件 |
| /ops/children/{child_id}/assessment-form/csv/ | 必需snapshot，UTF-8 BOM CSV附件 |
| /ops/children/{child_id}/assessment-form/copy/ | 必需snapshot，text/plain，与预览中文文本一致 |

- 表单按稳定JSON计算SHA256，document.snapshot_digest标识内容。
- snapshot签名URL仅包含儿童ID、固定测评ID列表及digest，不包含回答；8小时有效。
- 新完成记录出现后，旧链接仍回读原测评，不静默换成新记录。原测评或当前偏好变化造成digest变化时409，要求重开。篡改/过期/缺参数/错儿童422。权限每次重新校验。
- 每个预览和成功复制/下载都留下中文审计，detail只存digest、记录数，不存回答。
- 成功及校验错误响应private,no-store，下载nosniff；CSV保护公式开头文本。
- 复制先请求并验证同一快照，再使用Clipboard API，HTTP环境退回浏览器复制命令或手工选中文字，不假报复制成功。

## 22题前端缺口修复

真实Chrome集成发现：新版测评回看使用choice_summary，旧序列化只给exploration输出摘要，assessment虽然有回答但摘要为空。

先新增真实22题提交后摘要非空断言，复现1失败；随后将completed且purpose为assessment的原始题目与选择同样放入choice_summary。不改评分、Worker或既有报告生命周期。

## TDD与验证

- 专题新测试初始9失败（路由不存在），实现后9通过；扩展至18项覆盖实际计分、22题、权限、历史选择、digest、过期、非GET、CSV安全和缺值。
- 隔离PostgreSQL test_dingdong_forms_v25，进程级DATABASE_URL覆盖，未改变配置或开发数据库。
- 表单、运营页面/报告/审计/管理员、原兴趣八维、演示22题回归110通过；22题摘要修复后表单/修复/HTTP/演示回归40通过。
- 最终合并回归命令：pytest tests/test_ops_assessment_forms.py tests/test_ops_console.py tests/test_ops_reports.py tests/test_ops_audit_scope.py tests/test_ops_admin_role.py tests/test_prototype_exploration.py tests/test_demo_reports.py tests/test_prototype_repair.py tests/test_http_contract.py -q --reuse-db。
- 最终合并回归125通过，5.65秒（18项新增表单测试）。
- Ruff检查及py313格式检查干净，node --check新复制脚本通过，manage.py check无问题。
- 原文档校验JSON未修改；无迁移。

真实Chrome复制/下载和移动排版由根集成阶段验收，不能以HTTP测试代替。
