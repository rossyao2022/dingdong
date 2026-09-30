# 修复设计

固定号保护位于 ca_account 服务，不仅隐藏按钮：demo 开关启用时固定号拒绝 retire 和不同 token 换机，返回 409 PROTOTYPE_ACCOUNT_PROTECTED。现有建号 POST 用于幂等重试 bind，前端失败时保留本次内存凭据，重载后提示碰标签。Prototype insights 未 bound 返回 409 DINGDONG_BIND_PENDING，不查询对方聚合。

浏览器 sessionStorage 只新增非敏感 pending 标记和发码冷却截止时间，不存电话、token、验证码。发码按钮由截止时间驱动，429 读取 Retry-After，缺失则冷却 60 秒。定时器只随登录页存在，不引入全页轮询。

报告准备使用 testsupport 管理命令，限制 demo+固定号+原有效儿童，绑定当前已发布合成题库，只创建初始结果测试输入，不造报告、不修改题库、不自动同步画像。命令默认预检，显式 --apply 才写输入并审计。真实提交生成报告由既有服务与 Worker 执行。

两份 PDF 使用当前界面截图，新增完整会展操作附录。CA 与 DingDong 方向匹配仍由工作人员人工操作，正式账号、游客多账号、专业算法和真实成长图不在修复范围。源码发 v0.3.19，远端写入等待用户最终放行。
