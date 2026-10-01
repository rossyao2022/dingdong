# v0.3.25 独立发布复核

日期：2026-10-01。角色：Trellis check；仅复核，不推送、不部署、不写生产业务数据。

## 结论

本次获放行的双仓同步、生产发布、报告预热及公网匿名验收具备一致证据。未发现阻止本次展会版本使用的发布缺陷。此结论不代表实体 NFC、生产登录后的完整操作或供应商真实自动推送已经验收。

## 独立核验

- 新鲜 `git ls-remote`：origin 的 main / codex/release-v0.3.25 与 upstream 的 ca-main 均为 ca0250ccafc62bb6f241c53279c3393ef73113c9；upstream main 保持 3b8723e0089b411c19c41e13e4361cb90e6b7c71。后续发布记录提交可能继续快进，上述为复核时快照。
- 独立解包验证 SHA256 为 29e91cff35df56905d8549b2a2b52e4535cd05a08eecb368e72e513dd14c3c23；RELEASE.json 源码为 b935c30505351ecf241f5cf7d4b3e121d91aa7f9。458 个包内源码文件与该提交、当前本地运行文件逐字节一致。
- 部署日志显示先生成 0600 数据库备份并验证 pg_restore 清单，再校验发布包、使用既有 v0.3.20 基础镜像离线构建，检查 Django、确认无新迁移，更新 api / worker / beat / web。PostgreSQL / Redis 没有重建；原生产 env、R2/CDN 没有替换。
- 六项服务运行，API / DB / Redis 健康，Worker ping 为 pong。独立公网 GET version.txt 返回 0.3.25。
- 初次就绪证据只按数量检查 CA 历史，审查后补上独立完整比较：生产备份中的 1 条报告和 21 条测评的原 ID 及全部 COPY 字段均未改变。账号家庭/儿童归属、NFC 摘要、状态和已发布内容均通过比较；无内容重新导入/发布。
- 四种周频次 3 / 7 / 14 / 21 均真实 GET 预热成功，缓存各含 8 维、7 个曲线点。缓存读取时把供应商调用设为抛错探针，四份均仍能读取，证明首读不需要供应商请求。
- 生产既有答卷只读生成 JSON / CSV / 中文复制表单成功，覆盖 4 种用途；证据仅含布尔与数量，没有记录真实回答，也没有导出审计或业务写入。
- 真实 Chrome 公网匿名验收：30 个 JS/CSS 与本地逐项 SHA 一致，全部 no-store 和版本参数正确；27 张参考图片可解码；6 个登录宽度无溢出/验证码按钮重叠；7 个旧页面入口正确转向；运营验证码、匿名接口和运营登录保护正常。页面错误/异常控制台/失败请求为空。截图人工复核未见登录布局错位。
- 浏览器记录短信发送 0、生产认证登录 0、业务写请求为空。发布和就绪脚本没有短信发送或供应商写入动作。已上线 PDF 校验记录为家长 25 页、运营 16 页，每页有图、0600 权限，获批准的运营账号密码保留在私密 PDF；凭据未进入发布包或复核文档。

## 仍需如实保留的边界

- 本次公网验收没有发送短信或操作生产账号；完整家长/运营业务流程依据本地真实 API / Chrome E2E，加上生产只读数据检查。现场手机登录、实体 NFC、解绑换手机号重绑仍须实际彩排。
- 生产接收事件数仍为 0；不能称 DingDong 已自动 Webhook 推送。当前报告由真实拉取和缓存提供。
- 运营表单可复制/导出，但没有自动发送给 DingDong；不依赖对方尚未完成的新接口。
- 公网浏览器为 IP 入口启用了 ignoreHTTPSErrors，未断言证书有效性；报告仍属于 Prototype Mock/模拟趋势，并非正式真实成长数据。

证据：package-verification.json、production-deploy.log、production-health.log、production-history-preservation.log、production-report-warm.log、production-readiness.json、public-browser/public-browser.json、pdf-published-verification.json。
