# 组件确认弹窗实施与实测

日期：2026-10-01。任务：已批准原型整合父任务的用户追加弹窗纠正。本地 v0.3.26，未推送、未部署、未发送真实短信。

## 实施范围

- `frontend/ui-components.js` 新增共享 `confirmDialogMarkup`、异步 `confirmDialog` 和生命周期取消函数 `cancelConfirmDialogs`；使用现有 `<dialog>` 及紫色按钮主题，不增加依赖。
- 动态标题、说明、按钮全部转义，提供 alertdialog、标题/说明关联，默认焦点放在保留原组合。关闭、取消、Esc、外部 close 与 pagehide 均返回 false；同一时间只有一个确认，事件与节点收尾清理。
- 确认按钮走组件独立局部事件，不使用全局 data-action，避免调用方 act 忙碌期间无法接受/取消。原探索弹窗已打开时可叠加组件，关闭恢复焦点。
- `app.js` 仅相关 import、leaveContext 生命周期和探索 selection 块：await 前捕获儿童/身份/hash/探索票据和原会话，确认后再次核对才清理当前探索引用。切儿童、离页、退出立即取消。
- `island-explorer.js` 组合调整先生成候选组合，等待组件决定；取消前后原地图和回答保持，确认后才更新内存，开始探索才通过真实 API 创建独立会话；历史已完成会话不改。
- 新增 Storybook 确认内容/可操作故事；手机与桌面截图来自本轮真实 Chrome，不复用旧版本图片。

## TDD 与结果

1. `node --test frontend/unit/component-confirm.test.js` RED：实现前因缺少 confirmDialogMarkup export 失败；实现后 2 passed，验证外部文案转义、关联、默认安全焦点及无全局 data-action。
2. `npm --prefix frontend run check` GREEN，全部现有脚本语法检查通过。
3. 从 frontend 工作目录执行：

```sh
NPM_CONFIG_CACHE="$PWD/../.trellis/.runtime/npm-cache" python3 ../.trellis/.runtime/exhibition-ca/run.py npx playwright test tests/component-confirm.spec.js --reporter=list
```

最终 3 passed，16.5 秒；原始 stdout/stderr 保存在 `deploy/evidence/v0.3.26/component-confirm-browser.txt`。连接已启动的本地 4177/8025、真实 API 与隔离 PostgreSQL，不拦截业务响应。每次发码前确认 runtime.sms_mode 为 fixed_code。姓名和电话号码为合成测试资料，不记录其具体内容。

覆盖：390/1280px 取消、Esc、关闭；9 个真实保存答案与已完成会话保留；确认不会直接创建答卷，开始后产生新组合独立会话，原结果不改；默认取消焦点及退回对应岛按钮；离页清理；第二儿童真实 UI 建档、切回原儿童、确认期间派发既有 change handler，取消且第二儿童没有答卷；嵌套现有探索弹窗；重复打开单实例；跨标签页退出消息触发 forget/boot 后确认清理。全用例原生 dialog 事件为 0，pageerror 为 0。

正常忙碌期间儿童选择器禁用，第二儿童并发场景通过程序派发其既有真实 change handler 额外覆盖防迟到保护，不声称是普通用户可手动点击的路径。跨标签页消息测试未撤销后端 cookie，会话可由 boot 恢复，仅断言确认被关闭；中间曾误断言必定显示登录，失败后修正为实际验收边界，最后三项全部重新通过。

截图：`deploy/evidence/v0.3.26/shots/component-confirm-390.png`、`component-confirm-1280.png` 已目视，标题/说明/按钮间距正常，无横向溢出、原生弹框或按钮重叠。

## 原生弹窗审计

用 rg 扫描 frontend 和 backend/dingdong_ca/ops 的应用 JS/HTML，排除 node_modules、vendor、unit、tests、deployment-tests。家长端唯一原生 window.confirm 为兴趣组合，现在已移除；没有原生 alert/prompt。运营命中的 14 条均为 window.Ops.confirm/alert：`ops/static/ops/ops.js` 中本地 HTML dialog 组件，包含 promptDialog，保留既有实现，不错误替换为第二套运营系统。

未改手机号登录、NFC、供应商、授权、数据归属、生产 env 或存储/CDN。

## 独立复核后的证据纠正

第一次研究记录把第二儿童场景写为已完成，但实际代码替换因单/双引号差异未命中；独立复核发现后已补真实场景，不以先前计划或口头描述作证据。新场景真实 UI 建第二儿童、等待创建 POST 和页面完成、确认期间派发既有切儿童 handler、确认关闭、第二儿童零答卷、原儿童 9 个回答仍完整，再切回恢复原组合。补测初次因测试读选择器早于创建完成失败，改为等待真实 API 响应和页面就绪后，三项全部重新运行并保存最终 16.5 秒日志。未放宽数据断言或修改业务响应。

原先 RED 单测输出只保存在工具会话，没有原始落盘日志；本记录如实注明 RED 原因，不生成冒充历史 raw 的文件。最终单测另存 `deploy/evidence/v0.3.26/component-confirm-unit.txt`。
