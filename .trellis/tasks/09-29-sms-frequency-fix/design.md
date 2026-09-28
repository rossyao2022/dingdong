# 设计

## 发现

生产 API 日志两次记录 `aliyun_verify_rejected provider_code=biz.FREQUENCY`。阿里云号码认证返回码说明把它列为同手机号验证码发送频率校验失败。当前适配器只识别 `FREQUENCY_FAIL` 等代码，因而回成 `SMS_UNAVAILABLE` 503。另一本地重发限频仅查 `sending`/`sent`；登录把挑战置为 `consumed` 后，立刻退出重试会绕过本地 60 秒间隔。

## 修复边界

- 在适配器把 `biz.FREQUENCY` 纳入已知限频代码，仍只记录安全的供应商错误码。
- API 将已知 `rate_limited` 失败转成 `RATE_LIMITED` 429 和家长可理解的文案；其他发送失败保留 `SMS_UNAVAILABLE` 503，且挑战仍置 `failed` 并清除摘要。
- 本地最近挑战查询纳入 `consumed`，使成功登录不会重置发码冷却。继续使用现有创建时间和 60 秒间隔，不改数据库结构；供应商更严格的频控由 429 兜底。
- 前端已显示后端 4xx 业务文案，不需要新增页面交互。版本作为 v0.3.14 修复版，生产机原镜像与备份保留以便回退。
