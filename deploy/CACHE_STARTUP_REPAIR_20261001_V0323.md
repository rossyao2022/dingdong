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

本地验收时尚未发布；下方已上线段记录后续实际发布与原受影响用户核销。此前业务指南v0.3.22仍可用于相同功能，无需为纯缓存修复重写账号密码。

既有尾项仍保留：供应商真实自动推送、真实短信/实体NFC换家长彩排，以及正式设备/账号协议。此次缓存恢复不证明这些已完成。


## 已上线及原用户核销（2026-10-01）

1. 发布分支codex/release-v0.3.23与CA main原子快进至d8527dd，不强推；包真实源码d8527dd1c94b5f1cb3a8b4015ae8bc6bbaf320a3，4473626字节，SHA256 9d662f24770bc758f6e599ffd3ba73ef36291ed0549cc228de4ca39214eb57b1。434运行文件逐字节核对，bootstrap确实入包；私密env/PDF/证据均排除。[包证据](evidence/v0.3.23/release-package.json)。
2. [部署日志](evidence/v0.3.23/production-deploy.log)：先备份/opt/dingdong/backups/pre-v0.3.23-20261001.dump并核验pg_restore清单，188219字节、0600，SHA256 a71300b335278fa58cc422257d92e56210c474412fcfdba9e55fb0c2dd337b6f。备份和前状态仅存服务器。离线构建与Django检查通过，无新迁移；只更新四应用，原PostgreSQL/Redis容器和卷继续运行，既有env仅作为Compose参数沿用，未读/打印内容。
3. [历史核对](evidence/v0.3.23/production-readiness.json)基于实际部署前备份：原账号映射/摘要/状态、CA报告/测评和题库活动保留，未再导入发布、自动解绑或发短信，原aliyun_verify与Prototype配置有效。[六服务与Worker](evidence/v0.3.23/production-health.log)正常、实际pong，migrate --check通过。供应商只读insights四weekly仍可读取8维/7点；推送事件/投影仍0。
4. [独立公网验收](../.trellis/tasks/09-30-prototype-content-integration/research/cache-upgrade-independent-check-v0323.md)：实际版本0.3.23，29个JS/CSS字节与本地一致并返回no-store，实际29请求图统一v=0.3.23，27份素材真实解码。六宽度无溢出/验证码重叠，七旧入口及运营匿名技术权限正常。pageerror/非预期console/失败请求/失败静态均0，8次匿名refresh401作为正常拒绝单列；不发短信、不登录生产账号、不写业务数据。
5. 原受影响Chrome标签页进行了普通reload，成功恢复已登录的天赋探索首页和原选岛记录，main aria-busy=false；没有新增模块export错误。历史两条报错仍留控制台，不伪称历史日志为空。[原用户恢复证据](evidence/v0.3.23/affected-browser-after.json)只含布尔，未存家庭称呼/手机号或答卷。这个原页面检查有读取已登录数据，区别于上一条匿名公网验收，没有发送验证码或提交家庭改动。

此次修复已上线，原用户场景已实际恢复。此前v0.3.22操作手册业务流程/批准凭据仍适用。生产家长入口https://1.15.23.152/dingdong/；运营入口https://1.15.23.152/ops/。父任务继续保留供应商自动实发和真机彩排尾项，不把缓存故障核销当作所有正式生产协议完成。

回退：保留v0.3.22镜像/目录；不逆迁移、不整库恢复覆盖新数据。优先修正新版前端；若紧急回退Web，必须保留版本化URL及启动失败兜底，不能重新暴露原混用缓存错误。后端报告与演示绑定映射不回退到v0.3.20。
