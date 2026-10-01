# v0.3.24 独立发布检查

日期：2026-10-01。角色：trellis-check；仅本地包检查与获得生产就绪信号后的匿名公网只读 Chrome 验收。

## 发布包

- `dist/dingdong-v0.3.24.tar.gz` 的 RELEASE.json 指向 `6459ac0e5ded46d421d730b9c2a8c57e662c4988`。
- 444 个打包运行文件与该 Git 提交逐字节一致；不只比较当前目录或版本号。
- SHA256 `74401b9a610130435456afef25d4bdc3a3bc8b44390b4a66c7f7e0c024e446bf` 与 `.sha256` 一致。
- 无实际 `.env`、私钥/证书、node_modules、私密 PDF、验收 evidence；只保留 `backend/.env.example` 的本地示例，阿里云密钥字段为空。
- 0017 只有新建 ExhibitionVisitor/ExhibitionVisit 两表及四约束；无已有字段删除、更改和数据迁移。现有 CA 家庭/账号/历史和供应商配置不因迁移被改写。
- 详细机器证据：`v0324-package-review.json`。

## 匿名验收脚本

准备于忽略路径 `.trellis/.runtime/production-v0324/public24.mjs`，语法检查通过。包含本版所有 JS/CSS 字节和 no-store、27 素材 decode、六宽度登录、七旧入口、运营验证码和匿名门禁；新增 runtime exhibition_enabled / 安全 chat URL 与展会 API、后台门禁。

匿名展会 GET 正式代码和规范返回 401 AUTH_REQUIRED；按真实契约断言，不能误写为 403。没有 production 登录、短信发码、访客事件 POST 或供应商访问。

## 公网验收结果

主 agent 确认生产部署就绪后，实际匿名 Chrome 通过，退出码 0：

- 公网 version.txt 为 0.3.24，app.js 与本地发布源 SHA256 一致，29 份 JS/CSS 均逐字节匹配并 no-store，实际浏览器请求依赖图统一 v=0.3.24。
- 27 份原型素材均实际 decode，320/390/430/768/1024/1280 六宽度登录布局无横溢和验证码/按钮重叠。
- 家长和运营 390px 截图已目视：文本与输入/按钮清晰，间距无挤贴、错位；运营图形验证码存在但未提交。
- 七旧入口正确桥接，并清除旧伪评分、儿童和 NFC query 参数。
- runtime 为 aliyun_verify，exhibition_enabled=true；聊天 URL 为安全 http(s)、无凭据/query/fragment 的既定 DingDong 主机。
- 匿名 exhibition/report 为 401 AUTH_REQUIRED；后台 exhibition 和 dingdong-push 均要求登录。
- 零短信请求、零业务写入、零生产已认证登录；pageerror、意外 console error、静态失败和 failed request 均为空。
- 机器证据：`deploy/evidence/v0.3.24/public-browser/public-browser.json`；截图在同目录 `shots/`。

结论：包和匿名公网验收无阻断项。只验证匿名页面、资产、公开 runtime 与权限，不替代家长生产登录、真实供应商自动投递、实体 NFC 或现场家庭彩排。
