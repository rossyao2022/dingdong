# T-052A 技术设计

- 基线检查：后端 `pytest --cov` 与部署测试；前端 `npm run check`、Node 单测、Playwright 全量；Django system/migration check、Ruff、文档审计。测试生成的历史截图需恢复，不覆盖证据。
- 真源适配边界在 `backend/dingdong_ca/core/services/ca_display.py::_persona_out`。嵌套对象沿用原行为；顶层有 `persona_id` 时，身份字段作 persona，`bind_time`/`match_score` 作 binding；缺少字段留空，不编造状态/学习风格。
- 新回归测试使用 Prototype 实测字段形状，断言家长端数据和不泄露账户 ID；对历史实测的数字字符串 `"72.00"` 做有界数值兼容，非法分数留空；原夹具测试继续通过。
- 浏览器脚本仅修改 `questionnaire-version.spec.js`、`t030-batch-disposal.spec.js`、`t041-dialog-and-labels.spec.js`。T-030 明确阶段才执行；P-16 按实际“对话框打开时延后轮询，关闭后恢复”行为验收。
- 本地真源读取只作契约核查，不修改部署环境变量、不保存敏感响应。
