# 生产试用实例开放 DingDong 推送回调

## Goal

为生产机试用实例配置受限的 DingDong Prototype webhook 密钥，验证公网签名回调并给用户可直接提供给叮咚侧的参数。

## Requirements

- 为 `1.15.23.152` 上独立 `dingdong-prod-trial` 实例配置新的 Prototype 推送签名密钥；不改家长展示源、短信、现有业务数据或其他站点。
- 对公网 `POST /api/dingdong/prototype/events` 做签名、幂等验收，只用合成事件并清理验收数据。
- 向用户交付可给 DingDong 配置的 `CA_PUSH_URL` 与 `CA_PUSH_SECRET`；密钥不进入 Git、任务文档、日志或命令输出。
- 当前 Prototype 业务联调不以切换 DingDong HTTPS 为前置条件；正式环境传正式密钥前遵守对方文档的 HTTPS 要求。

## Acceptance Criteria

- [x] 生产试用实例 API 服务读取到非空推送密钥，六个容器健康，运行版本仍为 v0.3.14，短信模式和展示数据源不变。
- [x] 公网签名合成事件首次 201、重放 200，验收事件已删除。
- [x] 交付可直接复制的 WeChat 文案；明确真实里程碑推送还待 DingDong 配置并发出。

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
