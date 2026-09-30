# v0.3.23 页面启动与缓存升级修复

日期：2026-10-01。沿用用户已放行的完整上线任务，处理生产v0.3.22实际用户Chrome持续“正在连接成长空间”。本地CA功能完整性优先，不变更绑定归属、短信密钥、报告业务、供应商或R2/CDN。

## 实际原因

直接读取用户原标签页，控制台报：requested module ./ca-link.js does not provide an export named conflictNeedsRefresh。生产当前ca-link文件实际有该export；同一时刻HTML/app/ca-link/CSS无Cache-Control、入口和整个import图没有版本号。旧缓存和新app混用，ESM链接在boot执行前失败，所以boot内部API错误catch不能接管，页面一直留在初始loading。[原页面证据](evidence/v0.3.23/affected-browser-before.json)、[生产原响应头](evidence/v0.3.23/production-before-cache-headers.json)。

此前v0.3.22全新Chrome验收成功，但缺少已有缓存升级场景；不能把新上下文成功当作老用户升级成功。生产六服务仍正常，本次故障定位于页面启动。

## 修复内容

- 全部HTML脚本/样式、七旧HTML入口、bootstrap/app及嵌套模块图统一?v=0.3.23，避免同一URL指向不同发布代码。
- 生产Web返回no-store, max-age=0，保留现有安全头和Django代理；三种Web Dockerfile、server白名单、check同步新bootstrap。
- 独立bootstrap捕获模块错误并等待appReady；20秒有限兜底，失败只显示白话和手动重新加载，隐藏连接中。
- HTML自身守卫覆盖bootstrap404或请求一直无响应，不依赖失败的入口脚本来展示错误。app接管后清计时器，不自动刷新或发业务写入。
- 失败不抢先丢NFC参数，手动重试成功后仍由原app boot摘参数；不存凭据、不自动重绑。

可执行约定：[发布缓存与启动契约](../.trellis/spec/frontend/release-cache-and-startup.md)。

## 本地验收

- 独立check：syntax、前端107unit、部署13项通过；后端代码/迁移未改，此轮没有重跑或冒用历史447项作为本轮结果。
- 实际HTTP与Chrome缓存回归5项通过：[日志](evidence/v0.3.23/cache-upgrade-browser.log)。仅旧静态资源和失败资源采用明确测试fixture；业务API真实转发本机后端，不拦截伪响应，不发短信/绑定/报告写入。
- 旧unversioned模块在完整RED过程中只请求1次，证明来自已有缓存；复现同样export错误后新版完整app登录页成功，普通reload仍成功，当前带版本模块实际请求2次。[已缓存升级证据](evidence/v0.3.23/cache-upgrade-populated.json)。
- 覆盖鲜缓存、依赖缺export、bootstrap404及真实入口停滞20秒；都有清晰手动恢复，失败前NFC保留，成功后真实boot清理，未自动重试。[入口错误](evidence/v0.3.23/broken-entry.json)、[依赖错误](evidence/v0.3.23/broken-dependency.json)、[实际超时](evidence/v0.3.23/stalled-entry.json)。

## 发布状态

本段将以实际发布及原受影响浏览器验收追加核销；本地通过不等于已上线。此前业务指南v0.3.22仍可用于相同功能，无需为纯缓存修复重写账号密码。

既有尾项仍保留：供应商真实自动推送、真实短信/实体NFC换家长彩排，以及正式设备/账号协议。此次缓存恢复不证明这些已完成。
