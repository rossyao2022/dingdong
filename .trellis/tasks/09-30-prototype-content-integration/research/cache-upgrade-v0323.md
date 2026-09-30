# v0.3.23 浏览器缓存升级修复与本地验收

日期：2026-10-01。只修改本地代码，不发送短信、不绑定/选人设/聊天，不访问供应商写接口。

## 事实与修复

- 生产故障由根 agent 记录于 `deploy/evidence/v0.3.23/affected-browser-before.json`：当前 ca-link 源码存在导出，但浏览器取到旧模块，app 静态链接失败，入口无限停在连接文案。生产可变资源原无 Cache-Control。
- `frontend/index.html` 与七旧 HTML 桥接中的 JS/CSS、`app.js` 与全部嵌套 ES imports 使用同一 `?v=0.3.23`；资源图单测从 VERSION 遍历校验，不允许只升级入口遗漏深层依赖。
- 独立 `bootstrap.js` 无静态依赖，catch 动态 import/首次 boot 失败；20 秒看门，`appReady` 接管后取消；仅提供用户点击重试。HTML 另有独立入口404/不返回的兜底，不依赖 bootstrap 先执行。失败隐藏头部连接状态、停止 aria-busy，文案不显示异常/技术细节。
- bootstrap 与 HTML 不读写 NFC 凭据。加载失败保留原 URL；正常 app 的原 boot 接管后才摘参数，原会话内存承接及重新碰标签提示保持。
- 本地 server 静态白名单、语法清单、三份支持的 web Docker COPY 增加 bootstrap。生产 nginx 在原安全头的同一 server 范围增加 `Cache-Control: no-store, max-age=0`，不替换外部 CDN/R2，不动 HTTP webhook 路由。
- VERSION/package/package-lock 均0.3.23。历史操作指南业务流程无变化。

## 验收证据

1. RED：`deploy/evidence/v0.3.23/asset-version-red.log`，修复前全图版本/打包不满足。
2. GREEN：`asset-bootstrap-green.log`，8项版本图、启动失败/限时/接管、纯白话手动重试、旧入口保留边界和真实本地静态服务验证。
3. 真实 HTTP + Chrome：`cache-upgrade-browser.log`，5项通过。测试代理从真实 server.cjs 读取完整当前生产文件，并将匿名 API 请求流式送往真实本机CA后端。没有 Playwright API route mock。仅旧静态模块/加载失败资源为明确缓存回归 fixture。
   - 种入旧 immutable ca-link，仅HTTP请求一次；旧消费者真实报 missing conflictNeedsRefresh，main仍连接；打开完整新版 app 后登录就绪，普通 reload 再成功，版本化 ca-link各重新获取一次。详见 `cache-upgrade-populated.json`。
   - 新空缓存正常完整启动：`cache-upgrade-fresh.json`。
   - 缺导出的依赖 / bootstrap404：分别 `broken-dependency.json` / `broken-entry.json`；失败无自动重试，NFC/robot_ref不丢，点击后真实app启动并摘参数。
   - bootstrap请求实际无响应20秒：`stalled-entry.json`；HTML看门显示手动恢复，重试后正常app接管清除HTML计时器。
4. 390px稳定截图：`cache-upgrade-populated.png`（等待真实有限入场动画结束）、`broken-dependency.png`、`broken-entry.png`。失败按钮紫色、标题/说明完整、头部无连接噪音。

## 边界

本报告只证明本地实际HTTP/Chrome与源码/打包回归。生产升级后，仍由根 agent核对已受影响旧标签普通刷新、公网模块版本图和 Cache-Control，不能以新匿名窗口替代旧缓存用户验收。旧浏览器已缓存的整个旧 HTML 不会因新文件自行更新；需要普通刷新获取新版入口，随后新版本依赖绕过旧缓存。
