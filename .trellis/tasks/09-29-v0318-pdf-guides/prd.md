# v0.3.18 家长与运营图文操作指南

## Goal

核对现有两份 PDF 的截图与凭据，基于线上 v0.3.18 更新家长和运营图文指南并验证

## Requirements

- 核验现有家长和运营 PDF 是否含实际页面截图，指出版本和登录信息的差距。
- 交付适用于当前 v0.3.18 试用实例的两份中文图文 PDF，覆盖明天前后端演示的主要操作。
- 运营版写入已核实可用的试用账号和密码；家长版写明可用的演示手机号及真实短信登录方式，不编造固定密码。
- 使用当前界面的截图，区分公网登录页与隔离演示数据；不把合成数据称为 DingDong 正式互通。
- 含凭据的成品仅放本机忽略目录，不提交 Git。

## Acceptance Criteria

- [ ] 两份 PDF 均有逐步操作和页面截图，入口、版本、按钮名称与 v0.3.18 一致。
- [ ] 运营账号密码经线上登录验证；家长端不出现已经失效的固定验证码。
- [ ] PDF 文本与图片数量、页数、版面逐页检查，敏感内容未进入 Git。
- [ ] 项目记忆和交付报告记录版本、位置、证据与未验收边界。

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
