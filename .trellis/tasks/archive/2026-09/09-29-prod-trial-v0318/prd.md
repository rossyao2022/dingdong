# v0.3.18 生产机试用实例发布

## Goal

备份数据库，部署已推送的 v0.3.18 至生产机独立试用实例，并完成公网验收及发布记录

## Requirements

- 将已推送的 v0.3.18 发布到 `1.15.23.152` 的独立 `dingdong-prod-trial` 试用实例。
- 发布前备份数据库；保留既有短信、推送、Prototype 配置及 PostgreSQL/Redis 数据。
- 验证公网家长入口、版本、运行模式和未登录移动端布局。
- 记录可核查的发布结果、验收边界和回退方法。

## Acceptance Criteria

- [x] 发布包完整性经本地与服务器 SHA-256 比对。
- [x] 数据库备份成功，v0.3.18 镜像检查和 Compose 配置检查通过。
- [x] 六容器运行正常，公网版本为 0.3.18，短信和数据源模式保持原设置。
- [x] 公网未登录移动端浏览器验收通过，未因发布主动发送短信。
- [x] 发布报告与项目记忆更新，代码提交并推送。

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
