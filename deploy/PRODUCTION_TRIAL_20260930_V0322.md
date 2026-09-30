# v0.3.22 会展完整版本生产发布验收

日期：2026-09-30。用户明确“你上线上线完整版本，我再测一下看看”放行本版推送、CA main合并、生产备份/迁移与部署。目标为1.15.23.152的独立dingdong-prod-trial实例，更新前v0.3.20。包含此前未上线的v0.3.21和v0.3.22全部修复；这是会展Prototype版本，不能称正式真实设备生产接入已完成。

## 本次已上线

- 新手机号未绑定机器人，也能完成CA测评、真实提交和Worker生成演示报告；报告保留实际22题回答，未接入的专业分数不补假值。
- 绑定并授权的儿童，在“测评与报告”查看DingDong陪伴成长报告：伙伴、陪伴值、8个方面、7个趋势点和每周3/7/14/21次选择；模拟趋势有明确标注。
- 签名推送校验、幂等、不可变报告投影和技术“推送接收”页面；HTTP/HTTPS精确回调与脱敏日志均已部署。
- 当前绑定家长可主动解绑；另一个手机号可碰同一演示NFC，创建自己的本地账号映射共享Mock数据。原家长CA答卷/报告和旧账号关联保留，不能抢占其他人的活跃绑定。提示改为请原家长先解绑。
- 包含v0.3.21伙伴四题/网页引导偏好、活动上一步、旅程筛选、儿童导出、家长支持及七个旧入口修复；此前完整六岛、八维、指纹指南和27份参考素材仍在。

功能和本地回归见[本地实施快照](PROTOTYPE_CLOSED_LOOP_20260930_V0322.md)与[v0.3.21修复](PROTOTYPE_REPAIR_20260930_V0321.md)：后端447、前端101、部署13、12个不同真实Chrome用例通过，独立Worker、Storybook、迁移/OpenAPI与文档检查通过。绑定供应商输入与签名推送本地测试明确为隔离合成场景，不冒称供应商实发或实体标签验收。

## Git和发布包

fetch确认origin/main没有新增冲突提交，原main为2e4567bf35e46446b4b7b162bfe0bdce6467c854。CA main与codex/release-v0.3.22原子快进推送至5b89d0b，不强推、不改原视觉仓库；CA本地功能优先规则保持。后续验收文档和journal提交不改变已部署运行代码。

包实际源码dbe5165c0fe65c6048b62ad1dd36acf59f136a08，4461823字节；SHA256为8f27e994320767296644a980a23c7af1e8ad8497743cde25b66496f1ba743b38，427个已提交运行文件逐字节核对。[发布包证据](evidence/v0.3.22/release-package.json)。真实env、私密PDF和凭据不入包，只保留env示例。

## 备份、部署与历史保留

- [部署日志](evidence/v0.3.22/production-deploy.log)：服务器备份/opt/dingdong/backups/pre-v0.3.22-20260930.dump，180218字节、0600，pg_restore清单验证通过；SHA256为82585b4e394884777d7d0011648a6944742744682cf09a22bdf2b1e7a8f94116。备份和业务基线仅存服务器，未下载家庭数据。
- 从既有v0.3.20镜像离线构建，无新运行依赖；Compose/Django检查通过，迁移0015+0016成功。只更新API/Worker/Beat/Web；PostgreSQL与Redis原容器/卷继续运行。没有init/seed/题库再导入发布，没有自动解绑或改家庭归属。
- [真实部署前备份基线](evidence/v0.3.22/production-backup-baseline.log)与[部署后核对](evidence/v0.3.22/production-readiness.json)：原1个账号、1份CA报告、19次测评及原题库/活动保留，账号家庭/儿童/NFC摘要、状态均未改变；两份题库与十项活动和源内容一致，导入/发布审计数未增加。原ca_dingdong仍active/bound，不代替家长解绑。
- 沿用原四组env文件作为Compose参数，没有读取/打印内容、轮换短信密钥、额外发短信或改存储/R2/CDN。
- [nginx结果](evidence/v0.3.22/production-nginx.log)：先备份到/opt/dingdong/backups/nginx-pre-v0322，加载脱敏日志格式及两类精确回调，nginx -t通过后reload。保留其他HTTP路径404及同机其他站点配置。

额外比较脚本首次在未挂载的容器目录写基线失败，错误留在production-baseline.log；第二次pg_restore输出SQL缺--file参数，已修正为从实际部署前备份解析、基线仅留宿主机。首次Worker健康探针误写-A config.celery，日志如实保留；改用部署配置的-A config后实际pong。上述均为补充验收脚本问题，部署和备份自身已成功，不把失败探针计为通过。

## 公网与真实供应商只读验收

- [服务状态](evidence/v0.3.22/production-health.log)：六容器运行，API/PostgreSQL/Redis健康，migrate --check通过；[正确Worker探针与回调日志](evidence/v0.3.22/production-worker-and-push-log.log)实际pong。
- [独立公网Chrome](../.trellis/tasks/09-30-prototype-content-integration/research/public22-browser-verification.md)：version.txt实际0.3.22，28个JS/CSS与本地SHA一致，27份素材真实解码；320/390/430/768/1024/1280无溢出和验证码按钮重叠，七个旧入口桥接/清参数正确，运营验证码可见且匿名技术页要求登录。页面异常/异常console/失败请求/失败静态均0；8条正常匿名refresh401单独记录。
- 生产使用原联调配置真实GET对方insights，weekly=3/7/14/21都能读取Nova、陪伴值22、8维/7趋势点。[只读结果](evidence/v0.3.22/production-readiness.json)。未写供应商bind/chat/profile，也未写CA报告快照；值是核验时快照，不承诺后续固定。
- [回调探针](evidence/v0.3.22/production-callback.json)：HTTP与HTTPS无签名POST都400 PUSH_HEADERS_MISSING，HTTP HEAD405，其他HTTP API/ops仍404。脱敏access日志确实收到三条测试请求，只含时间/方法/路径/状态/耗时，无正文、查询串或签名。
- 本次没有发送短信、登录生产家庭或运营账户、生成生产CA报告、解绑重绑或触发供应商里程碑；这些实际交互由用户现场测试。本地相关真实HTTP/Worker闭环已通过，不能把匿名公网检查称生产登录后全流程通过。

## 地址与操作手册

家长：[生产家长端](https://1.15.23.152/dingdong/)。运营：[生产运营后台](https://1.15.23.152/ops/)。DingDong回调：http://1.15.23.152/api/dingdong/prototype/events；HTTPS同路径也可达，按用户会展要求只开放此HTTP回调。

两份私密PDF已同步v0.3.22已上线状态：家长37页、运营18页，登录图替换本次真实公网截图，其他图保留明确实际来源。55页渲染/目视、页脚几何和批准的运营凭据逐值核验通过。[PDF验收](evidence/v0.3.22/production-pdf-check.json)。密码和PDF仅在用户批准的本机忽略产物，不进Git或发布包；上线前PDF另留档。

## 仍需三方完成

| 角色 | 明确剩余事项 |
| --- | --- |
| 我方CA开发 | 已部署和完成公开/只读验收。配合用户登录后报告、解绑换号彩排；对照真实推送接收/处理/页面证据。有关联账号的资料删除已由500改为明确人工409保护，彻底去标识策略仍须另定。 |
| DingDong开发 | 将CA_PUSH_URL设为上述回调并核对共享密钥，给一次真实milestone事件ID、投递时间与HTTP结果/outbox错误；真实推送和生产处理投影要对应。正式账号、真实设备解绑/多人规则及正式子接口仍需另提供。 |
| CA业务运营/用户 | 真短信登录、不绑定生成CA报告；原绑定家长主动解绑，另一手机号碰同一实体NFC、选档案、绑定授权并查看DingDong报告；确认原家长CA答卷/报告保留和报告讲解口径，真机相机/朗读彩排。 |

核验时生产推送事件0、投影快照0。现在已建立准确回调和脱敏日志，但尚无供应商真实自动投递证据；不能写“所有联调已完美”。父任务保留现场/供应商验收尾项。

## 回退

保留旧发布目录/镜像、数据库与nginx备份。不得逆迁移删除历史或用整库备份覆盖上线后的家庭记录。若新家长已接手，不能直接回退旧API：旧版不认识新演示ULID生命周期。优先修正新版；必要时先关闭演示入口保留CA静态功能，再制定确认过的恢复方案。[原回退边界](PROTOTYPE_CLOSED_LOOP_20260930_V0322.md#回退)。
