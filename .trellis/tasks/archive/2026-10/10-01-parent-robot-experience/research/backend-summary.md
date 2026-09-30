# 后端交付证据

2026-10-01，本地PostgreSQL隔离测试。新接口TDD red 7 failed（路由不存在），随后完整范围 green 139 passed / 4.83s；未调用真实供应商/短信。

## 行为
- `GET /api/v1/exhibition/report` 需要家长JWT和demo开关，仅固定共享mock；复用白名单验证、同频率已验push回退，GET不记录看过、不建CA号/个人ReportVersion。
- `POST /api/v1/exhibition/visits` 明确 entered / report_viewed + request_id UUID；按现有登录用户聚合、响应无手机号、请求不可自行指定手机号；同请求重放原始回执200，新事件201，跨用户request_id独立，改event冲突409。
- `runtime` 新增 exhibition_enabled/exhibition_chat_url，`CaAccount` 新增有效bound demo chat_url；报告读取失败不会关闭聊天。配置URL含userinfo/query/fragment/非法scheme时不返回，个人report同样使用安全URL。
- 现有个人report保持请求前/出站后active child + current bound account + consent检查，不因展会预览放宽。
- ops `/ops/exhibition/` 列表与 `/ops/exhibition/{uuid}/` 跟进详情，既有phone只读引用，server form CSRF + role + revision + audit，内容运营拒绝；待联系/已联系/已结束及2000字备注，不创建购买意向/自动消息。
- 数据迁移0017只加表，parent前端保留建档guard。

## 测试
`.venv/bin/python -m pytest tests/test_exhibition.py tests/test_prototype_closed_loop.py tests/test_prototype_demo.py tests/test_ca_accounts.py tests/test_ops_console.py tests/test_ops_audit_scope.py tests/test_http_contract.py -q` 从backend运行。

覆盖匿名拒绝/关闭开关/非法源/同频率push fallback、无个人建号、严格入参、幂等、跨家长及真实数据库线程并发重放、聊天独立供应商失败/解绑清空、unsafe URL、ops全部角色/CSRF/修订冲突/审计/非法筛选/XSS。

`manage.py check`、`makemigrations --check --dry-run`、`ruff check .`、`ruff format --check --target-version py313 .`全通过。操作手册、真实浏览器和全项目整合由父任务继续验收；未推送/部署。
