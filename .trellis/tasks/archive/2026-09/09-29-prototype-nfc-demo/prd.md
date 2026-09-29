# 10.4固定账号NFC演示闭环

## Goal

按双方 Prototype 固定 `ca_dingdong` 账号打通带参 NFC 落地、家长登录与绑定、叮咚选人设及聚合数据回读，部署生产机试用实例供真机复测。

## Requirements

- 10.4 会展仅用对方 Prototype 固定账号 `ca_dingdong`，不能要求 Prototype 接受我方普通 ULID 账号；普通账号规则保持原样。
- 提供一条可写入 NFC 标签、也可直接在手机浏览器打开的 CA HTTPS URL，含随机测试 `nfc_token`。落地页沿用短信登录与儿童档案，绑定时仅此测试 token 才发固定演示账号，其他 token 仍发 ULID。
- 对方 Prototype 首页承担选测评方向、人设、配置与聊天；CA 页面提供明确的跳转和返回查看入口。CA 测评结果到 Prototype 的自动映射尚无业务规则，本轮按对方文档允许的人工选择演示，并清楚告知工作人员。
- 只向已登录、拥有该儿童档案且已授权 `dingdong_sync` 的家长返回固定账号的 Prototype 聚合结果。家长端显示角色和陪伴值变化，不把合成页面数据冒充对方结果。
- 生产试用实例保留真实短信、现有业务服务与 webhook；Prototype 测试 Key 只存受限 env，且 HTTP 豁免只用于对方的测试地址。测试记录与凭据不入 Git。
- 在本地隔离测试及真实浏览器验收后，部署到 `1.15.23.152` 的独立 `dingdong-prod-trial`，由我方先走一次，再给用户手机复测地址和步骤。

- [ ] 浏览器打开带参地址后，参数从地址栏摘除；登录和建档后可用该 token 绑定为 `ca_dingdong`，重放仍为同一账号；普通 token 不受影响。
- [ ] 未授权、跨家庭、未绑定和未配置时，Prototype 聚合数据不可见；授权后可从对方真实接口读到角色和陪伴值。
- [ ] 会展页能从 CA 跳到对方 Prototype 首页，用户选人设并聊天后返回 CA 可刷新看到变化；测试与展示明确是 Prototype 演示数据。
- [ ] 生产试用实例版本、短信与六容器健康可核对；NFC URL 在公网浏览器可达；交付手机测试步骤及尚需对方配合的真实推送事项。

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
