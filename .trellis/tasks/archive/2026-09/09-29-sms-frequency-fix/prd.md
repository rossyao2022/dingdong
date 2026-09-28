# 修复阿里云短信频控提示与退出后重发

## Goal

让家长退出后短时间内重新获取验证码时看到准确的限频提示，并避免无谓调用阿里云。保留真实短信的一次性挑战、限频和失败关闭行为。

## Requirements

- 阿里云在生产日志中两次返回 `biz.FREQUENCY`。该错误必须作为发码过频处理，向家长提示“短信发送太频繁，请稍后再试”，不能显示“服务不可用”。
- 已发出的验证码即使用于登录并被消费，仍要计入同号码短时间重发间隔；在本地限频期内不再请求阿里云。
- 阿里云其他真实服务故障继续保持不可用提示，不把所有失败误判为限频；失败挑战不可用于登录，验证码与密钥不进入日志。
- 本地完成关键测试、文档和可回滚发布准备。生产机写入与推送依仓库权限边界单独放行，未经授权不额外发测试短信。

## Acceptance Criteria

- [x] `biz.FREQUENCY` 被识别为限频，家长收到清楚的中文提示和 HTTP 429；其他故障仍按对应错误处理。
- [x] 登录并退出后，立即再次获取同一手机号验证码在本地被限频，阿里云 SDK 不被调用。
- [x] 既有短信发送、登录、失败关闭测试通过；运行中的生产 v0.3.13 在新版本放行前不受影响。
- [x] 准确记录本地验证、发布状态及线上验收范围；不把未发生的短信发送写成成功。

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
