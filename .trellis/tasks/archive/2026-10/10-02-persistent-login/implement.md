# 执行计划

1. 后端implement agent：先增加失败认证测试，再修改模型/迁移/accounts/common及清理相关行为，跑auth相关测试、ruff、Djangocheck/迁移检查。
2. 前端implement agent：先增加会失败的并发认证单测，再改api.js共享锁/epoch，跑语法与单测。不改版本或文档。
3. 主agent同步OpenAPI、模型字段文档、当前约束、版本0.3.29、记忆；保留原两份脏审计JSON字节。
4. 独立check agent全范围审查与修复；必要认证回归完成，不做生产业务测试；记录事实和发布状态。
5. 本地提交（任务id），沿用用户既有直接上线授权，先origin分支/main再upstream ca-main；服务器备份、离线构建、0018迁移及仅更新四应用，发布健康/版本确认；完成任务归档和journal。

## 验证
后端 tests/test_auth.py及直接受影响清理/权限测试；ruff check及py313format；manage.py check和makemigrations --check --dry-run。前端npm run check/test:unit。文档audit errors为空，完整版本图一致。
