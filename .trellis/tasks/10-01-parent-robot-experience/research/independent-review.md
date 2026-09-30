# 家长机器人体验独立审查

日期：2026-10-01。本地版本0.3.24；生产发布不在本次审查操作范围。按本任务PRD/design/implement、前后端spec及本地优先规则审查当前完整diff。审查agent未改业务源码、未运行并行DB pytest、未提交/推送/部署/发送短信。

## 结论

已发现的四个源码问题均由实现者修正，当前未见阻止本地交付的源码缺陷。新报告/展会与原CA流程的隔离、真实时间轴及运营权限边界符合批准设计。真实供应商、实体NFC、生产部署和运营真机彩排未由本报告证明；私密手册最终更新由根agent负责。

## 审查发现与关闭证据

| 发现 | 实际影响 | 当前修复与证据 |
| --- | --- | --- |
| CA结果等待supplier完成才整页显示 | 供应商慢时个人结果一起卡住 | reports先显示CA和机器人局部loading，独立Promise仅更新当前tick/child的机器人slot；真实5秒本地supplier测试CA112ms可见，保留已展开问卷，见slow-supplier-browser.json |
| 初次恢复登录仍await慢report导致appReady延迟 | 超过20秒看门可能覆盖已可用CA页 | render首次page后及时return，后台带票据补读；真实25秒源/20秒启动期限后CA和聊天仍可用，超时错误只在机器人区域 |
| 当前儿童换机复用上一儿童hints.accounts | 可能归档错误儿童的机器人 | 切儿童/新建档清robot context；replacement始终读目标child真实API、验exploration上下文、过滤child_id；submit再次验目标child，真实HTTP换机验A仍active/B旧号retired |
| 个人报告prototype_url回原配置URL | runtime虽已拦，个人回包仍可能带userinfo/query/fragment | 个人和展会统一安全URL helper；nullable OpenAPI；非法URL测试不返回原值，来源白名单无凭据 |

测试输入也做了实质纠正：推送envelope的24轮必须匹配data.effective_turns=24及三轮倍数；旧22/24输入被后台正确标INVALID_MILESTONE。更新后的测试查询真实处理状态，不以201受理冒充可读投影，也未放宽业务验证。

## 完整范围核对

- **个人数据边界**：个人prototype report保留owned_child/family/active、bound、dingdong_sync授权检查，网络读后再次核对绑定及授权。前端切儿童/退出票据失效、撤权后重新读403，不保留陈旧报告；归档不删除/移用CA历史。
- **展会独立**：GET exhibition/report只读固定共享mock，复用严格有限数/八维/频率及同频率有效push回退，不建CaAccount、个人ReportVersion或访问计数；成功进入和成功显示分别显式POST。UI登录、儿童建档guard保留，不能通过展会URL绕过；展会API本身按设计只需已认证家长，不读取某儿童私有数据。
- **原CA完整性**：默认explore、桌面7项/移动4项导航、原岛屿/指纹/八维/职业内容、问卷历史/活动/导出及四题引导保持。个人CA报告、问卷配置、历史分块处理错误，机器人失败不遮住CA；移除旧成长观察/重复关联入口为已批准的产品调整，不删除底层历史/API。
- **机器人操作**：companion有绑定/聊天/报告/管理；settings突出我的DingDong及绑定完成动作；聊天来自安全account chat_url，不依赖报告insights成功。旧verified ExternalAssociation只保留管理，不用新伪关联代替绑定。
- **报告界面**：已绑报告完整展开，CA随后且页内跳转；未绑有独立展会入口。曲线x=58+day/180*546，非等间隔假轴；合法零值保留、缺值保持空白，180日为模拟参考。频率仅GET模拟，不写机器人configure。所有数据插值经esc，不展示DTO/webhook/secret等技术字段。
- **运营与访客**：手机号只引用现有parent，不接受客户端指定手机；visitor按user唯一，request_id按visitor唯一并锁现有user，重复返回原回执，不改时间；entered/report_viewed限定枚举。ops仅operations/technical/account_admin，content拒绝；HTML CSRF、revision冲突、状态/2000字备注校验及Audit完整，模板转义。无购买意向字段或自动营销动作。
- **开关与发布图**：仅demo+prototype flag启用；runtime、accounts和报告URL均不传凭据/搜索/fragment。新增迁移只加表。运行资源已有白名单/Docker打包，全HTML/JS/CSS/模块依赖v=0.3.24统一，既有入口故障/NFC/缓存恢复未破坏；外部R2/CDN及HTTP webhook路由未改。

## 本轮证据（不是历史数量）

- 审查agent独立执行：`independent-syntax.log`语法通过，`independent-unit.log`111/111单测通过；`git diff --check`无错误。
- 实现者本轮后端139项：`backend-green.txt`，覆盖真实PostgreSQL家庭/绑定/授权/并发幂等/URL/ops角色/CSRF/revision/audit，与其他agent不并行运行DB测试。
- `browser-new.log`：4项真实HTTP Chrome，新登录建档/默认导航、展会完整报告与访问记录、已绑授权/聊天/切儿童/解绑、两儿童换机。
- `deploy/evidence/v0.3.24/slow-supplier-browser.json`：真实本地synthetic supplier HTTP，不拦CA业务API；5秒延迟先见CA，25秒延迟跨启动期限仍可用，0 pageerror。
- `browser-ops.log`与`deploy/evidence/v0.3.24/exhibition-ops-browser.json`：4检查/8布局/0 pageerror，现有手机号、角色、CSRF保存/审计、409旧revision及无意向认定。仅绿色脱敏证据收录，不保留早期locator含CSRF值的错误段。
- `cache-browser.log`5/5及本版cache-upgrade JSON：真实旧模块缓存/普通reload、入口和依赖失败、NFC保留及手动恢复。
- Storybook `frontend-storybook.log`成功；`browser-ca-regression.log`原CA核心9/9通过（四偏好/活动/导出/四情境、六岛/八维/历史/指纹与多宽布局）；本轮部署配置13项由根agent确认。

## 截图与交付边界

390已绑报告完整展开、个人区分层和320展会无横溢出已目视。早期320截图残留登录toast/skip-link，已反馈实现者改为真实稳定页面后截取；根agent另生成deploy/evidence/v0.3.24/shots/稳定手册图。本报告不把截图数量当作功能通过数。两份私密PDF内凭据由根agent核对，不把密码/挑战写入本报告。
