# 家长端退出入口与内部文案清理

## Goal

让已登录家长随时找到退出入口，清理家长页面中的内部实现说明，并验证桌面与手机交互

## Requirements

- 已登录家长在任意页面（包括尚未建立儿童档案时）都能一眼找到退出登录；退出后回到登录页，登录页不显示退出按钮。
- 逐屏删掉不影响家长操作或判断的内部说明，包括题库发布流程、数据来源对照、算法版本、同步时间戳和内部账号规则；不把这些噪音换一种白话继续展示。
- 保留会影响家长选择的简短说明：测评非正式性质、授权后果、换机影响、连接状态。
- 测评使用演示图片的步骤要明确告诉家长，这是演示资料，无需上传孩子照片。
- 只改家长端界面，不改接口、授权或数据处理逻辑。

## Acceptance Criteria

- [x] 全新账号登录后停留在建档页，可以从页头退出并返回登录页；建档后所有路由仍可退出。
- [x] 指出的两处原文不再出现在家长页面，空数据不显示“最近成功同步：尚无记录”。
- [x] 家长日常页面不出现“后台发布”“数据来源不同”“回写”“CA 本地”等实现口径；内部编号只在主动展开设备信息后显示。
- [x] 桌面与 390px 真实浏览器验收，前端语法与单测通过。
- [x] 演示报告提交说明与按钮准确，完整报告及复测流程重新跑通。

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
