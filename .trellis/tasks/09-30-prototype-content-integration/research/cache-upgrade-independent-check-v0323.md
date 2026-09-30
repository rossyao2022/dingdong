# v0.3.23 独立检查与公网匿名验收

日期：2026-10-01。任务：09-30-prototype-content-integration。

## 结论

本次缓存修复、本地门禁与发布后公网匿名验收通过。此前 v0.3.22 的干净浏览器验收未覆盖旧缓存升级，不能用它说明常用浏览器升级无问题。本轮补充了同一真实 Chrome 缓存上下文的旧文件污染→真实模块缺导出→带版本完整应用启动→普通刷新的回归。根 agent 另负责原受影响用户标签页的升级验证。

## 独立源码检查

- HTML、静态经典脚本、完整 ESM 依赖、CSS 与七个旧入口统一使用 v0.3.23 标签。
- Node 白名单及三个 web Docker 文件包含 bootstrap.js。
- nginx HTML/静态响应保留原安全头，同时返回 no-store, max-age=0。
- 入口 HTTP 404 和入口迟迟未响应由 HTML 独立提示处理；已执行入口的依赖链接错误由 bootstrap 处理。有限 20 秒等待后可手动重试，无自动刷新循环。
- 失败提示隐藏“连接中”状态；原应用 boot 仍负责 NFC 参数读取与清除。失败之前参数保持，成功重试后原 boot 清理。
- 无业务接口、权限、供应商配置、迁移、数据模型改变。

## 本地门禁与真实 HTTP 浏览器回归

- npm run check：通过，checker-syntax.log。
- 前端单元测试：107 项通过，checker-unit.log。
- 部署测试：13 项通过，checker-deploy.log。执行时明确设置仓库 backend 的 PYTHONPATH。
- 实 HTTP Chrome 缓存/失败恢复：5 项通过，cache-upgrade-browser.log。独立核对 JSON 证据和 390px 截图。
- 旧 ca-link.js 使用真实 immutable 缓存，只向 HTTP 服务请求一次；旧消费者真实触发缺 conflictNeedsRefresh 导出；当前带版本 ca-link.js 经首启与普通刷新请求两次且启动正常。
- 坏依赖、入口 404、实际 20 秒入口无响应均使用真实 HTTP 故障。健康恢复请求走真实本地 frontend/backend，未使用 route.fulfill 伪造业务成功。
- git diff --check：通过。

本检查 agent 修改仅为 deploy/tests/test_legacy_compat.py：按 VERSION 验证带版本旧入口，并在三镜像资源合同中要求 bootstrap.js。其余修复由实现 agent 完成。

## 发布后公网 Chrome

入口：https://1.15.23.152/dingdong/。

根 agent 明确生产就绪后执行 public23.mjs。实际 version.txt 为 0.3.23，app.js 及 29 个 JS/CSS 字节逐一匹配本地发布源码，首轮检查匹配。

- HTML 与 29 个 JS/CSS 响应 Cache-Control 为 no-store, max-age=0。
- 实浏览器请求图的 29 个 JS/CSS 均带 v=0.3.23，包含 bootstrap 与 ca-link。
- 27 个参考素材在 Chrome 实际 decode 成功。
- 320/390/430/768/1024/1280 六个登录宽度无横向溢出，验证码输入和按钮无相交。
- 七个旧入口进入各自固定路由并清除输入查询参数，匿名状态显示家长登录。
- 运营 390px 登录页面账号、密码、图形验证码显示正常；技术推送接收页面匿名访问跳至运营登录。
- pageerror、非预期 console error、请求失败和静态失败均为 0。
- 8 次匿名 auth/refresh 的 HTTP 401 属于首次启动与七次旧入口启动的预期鉴权响应，单独记录，未声称所有控制台信息均为 0。
- 短信请求 0，业务写请求 0，生产账号登录 0。未提交验证码、绑定设备、填写业务对象或调用供应商。

证据：deploy/evidence/v0.3.23/public-browser/public-browser.json、public-browser.log 和 shots/public-parent-login-390.png、shots/public-ops-login-390.png。两张截图已目视，可读且无控件错位。

## 范围

本轮只验证缓存与启动修复，不重复宣称登录后生产业务、实际短信、实际 NFC 硬件及供应商主动推送全部通过。公网 Chrome 为全新匿名上下文；旧缓存升级由上述同上下文实 HTTP 测试证明，原用户标签页复查由根 agent 独立记录。IP 入口使用 ignoreHTTPSErrors；证书有效性不是本验收结论。
