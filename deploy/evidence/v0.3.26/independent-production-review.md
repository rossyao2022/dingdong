# v0.3.26 生产独立复核

日期：2026-10-01。已获用户本次部署放行；复核者仅检查现有证据、读取公网版本及远端 Git heads，没有远端写入、推送、发短信或供应商写入。

**结论：生产发布复核通过，未发现发布阻塞缺陷。**

- 包源码 `e82401e`，464 个提交文件一致；本地实际包 SHA256 为 `da9ad82cc976696613e2a049d29a96af1a8edb31b6823c5efbcdd1c14cc2b3a0`，与包证据及生产校验一致，包无私密手册/凭据。当前后续提交没有修改运行代码。
- 先备份再更新：198212 字节、0600、pg_restore 清单校验通过；备份仅留服务器。部署脚本禁止覆盖已有备份/版本目录，离线镜像构建，无迁移待执行，仅重建四应用，现有 PostgreSQL/Redis 持续运行。
- 六服务正常，API healthy、Worker pong。公网独立 curl 实际版本为 0.3.26。
- 原 1 条报告、21 条测评的原 ID 及所有 COPY 字段逐行一致；原账号家庭/儿童归属、凭据摘要、status/bind_state 及发布内容保留，未重新导入或发布内容。
- 当前固定原账号是 **retired 历史行，bind_state 历史值为 bound**，与部署前基线一致。不能把该历史 bound 值说成当前活跃绑定，也不能将其归档误归因为本次部署；界面按当前儿童 active/bound 判断。
- 3/7/14/21 四份缓存报告各有 8 维、7 点，cached 首读未调用供应商。只读原始表单 JSON/CSV/中文生成正常，无业务或审计写入；本次不声称重新真实拉取供应商数据。
- 公网真实 Chrome：30 个脚本/样式字节与当前验证源码逐个 SHA256 一致，200/no-store、模块图 0.3.26；27 图片加载解码；六宽度登录页无溢出/验证码控件重叠；七旧入口和运营验证码、匿名访问保护正确，脚本/异常资源错误为 0。
- 生产实际新组件 390px 烟测默认取消焦点、Esc 返回 false、原生 dialog 事件 0；该烟测未登录，不提交探索、不创建或变更账号。已登录绑定矩阵和实际探索保存由本轮本地真实 API/Chrome 10 项证据保障。
- 读取 Git heads 时 origin main/release26 和 upstream ca-main 均为 `86cd501`；upstream main 仍为 `3b8723e`，未强推或覆盖原历史。后续发布记录提交可继续按已批准同步流程推进。

## 验收边界

本次公网 authenticated login=0、SMS 请求=0、business_write_requests=[]；未做生产登录后的探索/NFC或真实手机彩排。生产 Webhook events=0，不能声称对方真实自动推送已到达。IP 测试入口浏览器沿用 ignoreHTTPSErrors，证书有效性不在此验收断言内。以上限制不改变本轮绑定展示和组件确认的本地验证结论。

依据：`package-verification.json`、`production-deploy.log`、`production-backup-baseline.log`、`production-readiness-combined.log`、`production-health.log`、`public-browser/public-browser.json`；本地独立复核见父任务 `research/binding-visibility-independent-review.md`。未下载或记录家庭内容、密码、令牌、NFC原文或私钥。
