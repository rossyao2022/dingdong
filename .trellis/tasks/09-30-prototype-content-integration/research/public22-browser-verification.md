# v0.3.22 发布后公网只读浏览器验收

日期：2026-09-30。主 agent 发出“生产22 ready”后执行，真实 Chrome、新匿名上下文、无请求mock。

## 实际通过范围

- `https://1.15.23.152/dingdong/version.txt` 返回 **0.3.22**；公网 app.js SHA256以及静态白名单中的28个JS/CSS逐一与本地已验证内容一致。
- 上游参考 assets 树全部27文件（21webp、6SVG）在Chrome实际加载并decode成功，宽高有效，无静态404。
- 家长登录320/390/430/768/1024/1280宽度全部横向溢出0，验证码输入与发码按钮无重叠。390家长与运营登录截图已目视清晰，无组件挤压。
- 七个旧入口daily/test/result/thumb/island/blindbox/report.html全部跳到对应CA固定路由；查询参数已清除，匿名页面展示家长登录，没有自动绑定或保存业务对象。
- 运营390登录账号/密码/图形验证码可见，没有填写或提交。匿名访问`/ops/dingdong-push/`跳至`/ops/login/`，未暴露技术快照数据。
- pageerror、unexpected_console_errors、failed_requests、failed_static均0。匿名boot的8条refresh401资源console信息是预期的未登录拒绝，单独保留在JSON，不把所有console信息伪称为0。
- 短信请求0、生产账号登录0、业务写请求0；只允许应用匿名refresh自然请求，未点击发码、绑定、登录、提交按钮或调用供应商。

## 证据与限制

- `deploy/evidence/v0.3.22/public-browser/public-browser.json`：实际版本、28个模块哈希、27素材解码、六宽度几何、七入口与匿名技术页、异常及预期401明细。
- 同目录`public-browser.log`及`shots/public-parent-login-390.png`、`shots/public-ops-login-390.png`。
- 执行脚本：`.trellis/.runtime/prototype-public-20260930/public22.mjs`，复用原公网验收脚本扩充，仅本地生成证据。

本验收证明已发布静态版本与匿名入口可用。登录后的生产业务数据操作、真实供应商自动推送、实体NFC和手机号短信并未在本次执行；对应闭环此前为明确标注的隔离合成输入验证。IP HTTPS入口启用ignoreHTTPSErrors，证书有效性不属于此结论。
