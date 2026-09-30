# 技术设计

## 接口约定（前后端共同采用）
- runtime增加exhibition_enabled:boolean与exhibition_chat_url:string|null。启用沿用prototype_demo_enabled环境约束，聊天URL来自服务端现有配置。
- GET /api/v1/exhibition/report?weekly_turns=7：仅家长认证、feature enabled；与个人授权report接口分离，仅白名单共享mock。复用供应商读取、严格校验和同频率push回退。禁止建立账号/改变绑定/写个人ReportVersion。
- POST /api/v1/exhibition/visits：event为entered或report_viewed，request_id UUID；按登录用户聚合，幂等，server时间；由前端成功进入或成功渲染后记录，不在GET自动算看过。
- ca_accounts序列化增加chat_url:string|null：有效已绑定演示账号从服务端配置给值，其他情况null；不依赖insights读取成功、不泄露凭据。
- ops展会列表/详情沿用权限、表单CSRF、revision和Audit；operations/technical/account_admin允许，content无权。跟进状态pending/contacted/closed，备注最多2000字，记录变更不发送信息。

## 前端
保留app.js路由与儿童guard，新exhibition路由在guard之后。runtime flags控制入口；全展开共用dingdong-report渲染。reports先加载accounts/reports/sessions/catalog，机器人report独立失败处理；删除旧growth-overview/companion-health/growth-cycle/reassessment展示和轮询，不删除服务API/历史。快速导航绑定报告和CA结果各自锚点。settings去重旧association区域但保留合法已有关系管理能力（已有verified记录可放管理明细，不创建伪关系）。companion显示机器人区加现有网页引导。
图表横轴按day/180，频率完整展开，说明演示趋势不修改设置。个人mock完整报告和展会页简短演示标识，不分类机器人。状态和所有插值转义。

## 发布边界
仅本地commit，push/部署必须另行授权；版本图保持统一并验证缓存。不读deploy/.env/private key，不改R2/CDN，不覆盖原有脏文档校验结果JSON。原生产v0.3.23仍运行，本地完成不写上线。
