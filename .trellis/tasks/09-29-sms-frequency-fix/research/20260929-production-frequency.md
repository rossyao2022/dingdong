# 生产机发码过频排查（2026-09-29）

- 用户反馈：退出后重新登录，点击获取验证码显示服务不可用。未在排查过程中主动发送短信。
- 生产机 API 健康，运行 v0.3.13 的 `aliyun_verify` 模式。脱敏日志中连续两次出现 `aliyun_verify_rejected provider_code=biz.FREQUENCY`，没有在此记录保存手机号、验证码或密钥。
- 阿里云[号码认证返回码说明](https://help.aliyun.com/zh/pnvs/developer-reference/api-return-code)将 `biz.FREQUENCY` 解释为验证码发送频率校验失败，并提示检查同手机号发送间隔；[发送接口说明](https://help.aliyun.com/zh/pnvs/developer-reference/api-dypnsapi-2017-05-25-dir-sms-authentication-service/)也列出频控错误。
- 我方旧适配器没有识别 `biz.FREQUENCY`，于是按一般供应商拒绝返回 503；API 对已有的 `rate_limited` 原因同样一律返回 503。旧本地冷却查询只看 `sending`/`sent`，登录后的 `consumed` 不再被计算，退出后立即重发就可能直达阿里云。
- 新增三项回归先全部失败；修复后定向 26 项短信/登录测试通过。Ruff、迁移检查、Django system check、前端 67 项单测和文档审计均通过。生产机仍是 v0.3.13，修复尚未部署。
