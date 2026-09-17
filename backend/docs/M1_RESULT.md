# M1 TDD 开发记录

> 历史阶段验收记录：保留当时测试数量和结果，不代表当前总量。最新见 [M5验收](M5_RESULT.md) 与 [启动后界面测试](../../frontend/docs/UI_FUNCTIONAL_20260912.md)。

先写24项测试，在空业务路由上得到24 failed；随后实现短信/JWT、家庭儿童、网页活动及seed命令。首轮23 passed、1 failed，原因是测试在登录CSRF轮换后未更新token；修正测试客户端后通过。

补充真实PostgreSQL并发验证码消费和活动创建、JWT到期、分页和上海时区统计，共30 passed。再补JSON接口拒绝文件上传测试，观察到默认DRF 415错误结构不符合契约；统一异常格式后32 passed。

测试覆盖率93%（dingdong_ca包，包含模型和迁移），不是全项目48接口完成率。真实HTTP进程已完成一个合成账号的登录、儿童创建、活动完成、足迹查询和退出，结果存http-smoke-result.json。

Django check通过，makemigrations --check --dry-run无模型迁移差异。最终代码静态检查与格式检查见终端验证。数据库为独立Docker PostgreSQL17，未用SQLite或API mock。

当前实现16/48个API操作；M2/M3待开发。后续以TDD_CASES.md继续，不把规划项当已实现。
