# v0.2.3 HTTP档案提交修复 · 2026-09-12 15:05

已部署 http://110.42.225.196/dingdong/ ，版本0.2.3，分支codex/release-v0.2.3，标签v0.2.3指向发布提交b3fda83。Docker包dist/dingdong-v0.2.3.tar.gz附SHA256，远端已校验。部署目录/home/tigery/services/dingdong/releases/dingdong-v0.2.3，沿用原数据库和密钥。

## 原因与修复

app.js的requestKey无条件调用crypto.randomUUID；在公网HTTP页面该API不可用，导致childForm绑定提交事件前抛错。以前localhost属于安全上下文，不能覆盖这类公网兼容问题。参见[MDN randomUUID](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID)。

新增API.createRequestId：支持原生randomUUID时沿用，否则通过getRandomValues生成标准UUID v4，仍用密码学随机源。getRandomValues可在非安全上下文使用，参见[MDN getRandomValues](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues)。所有requestKey使用该入口，原有Map缓存和请求去重语义不变，没有改后端业务逻辑。

## 已完成验证

- 先用真实Chrome在旧公网版本复现档案提交失败，见[evidence/v0.2.3/browser-red.txt](evidence/v0.2.3/browser-red.txt)。
- 新单元测试3项通过：无randomUUID时合法且互异的v4编号、原生路径、缺失随机源拒绝弱回退；见[evidence/v0.2.3/unit-green.txt](evidence/v0.2.3/unit-green.txt)。前端语法检查通过。
- 新部署的公网HTTP入口，用真实Chrome桌面及390×844移动视口各完成：登录→保存儿童档案→首页→刷新恢复→打开并开始活动。2项通过，9.7秒。测试明确断言isSecureContext=false且crypto.randomUUID不存在，不拦截API响应。见[evidence/v0.2.3/browser-green.txt](evidence/v0.2.3/browser-green.txt)。移动视口不是手机硬件验收。
- 公网version.txt返回0.2.3，容器启动完成。未重复跑无关的整套后端业务测试。

新增复验命令：npm --prefix frontend run test:unit、npm --prefix frontend run test:public。public命令默认访问真实演示站并生成合成验收档案，不适用于真实业务生产库。
