# v0.3.27 CA陪伴空间入口发布验证

2026-10-01，原Mac完整环境。本轮用户授权整合、提交、双仓同步、生产备份部署、上线验收及必要回滚。

## 整合范围

本地2209bd4的Commander两提交保留，非快进合并origin目标bb360a0a38c6a295ce1f46018cf745f0127e86bd；唯一PROJECT_MEMORY冲突保留双方有效记录。四入口统一“进入 DINGDONG 天赋陪伴空间”，默认https://www.dingdongrobo.top/dingdong/companion/main。DINGDONG拥有共享ca_dingdong网页会话，CA不携带用户或鉴权参数。保留登录、绑定矩阵、四周期、首读缓存及手动刷新，整张前端版本图升级0.3.27。Commander目录排除应用发布包，不执行其安装或配置脚本。

## 本轮验证

- [后端完整499项](evidence/v0.3.27/backend-tests.txt)，供应商契约测试仅替换出站transport，不能称真实供应商验收。
- [前端124项](evidence/v0.3.27/frontend-unit.txt)及[语法](evidence/v0.3.27/frontend-syntax.txt)。
- [部署17项](evidence/v0.3.27/deploy-tests.txt)，[lint](evidence/v0.3.27/backend-lint.txt)、[格式](evidence/v0.3.27/backend-format.txt)、[系统/无新迁移](evidence/v0.3.27/backend-check.txt)。
- [正常文档审计](evidence/v0.3.27/document-audit.txt)，errors=[]，原未提交JSON从逐字节副本还原保留，未用dot一次性豁免。
- [真实Chrome9项](evidence/v0.3.27/browser-tests.txt)：隔离本地schema真实HTTP/API、合成账号和绑定输入，四处实际popup精确新URL/无参数/opener为空；绑定状态矩阵、切儿童、授权、解绑、报告与CA主线。320/390/768/1280报告无水平溢出，390px截图人工检查。
- [缓存补验1项](evidence/v0.3.27/browser-cache-tests.txt)：首读cached=1、3/7/14/21及显式刷新。

初期浏览器测试脚本route写错、被中断的固定合成账户占用、隔离schema尚缺授权说明和原型内容，均修正隔离测试前置后复验；无运行功能缺陷或业务响应拦截。截图路径支持E2E_SHOTS_DIR，历史证据原样保留。

## 发布状态

本文件提交时尚未部署，生产仍0.3.26。已核实显式旧URL，备份和回滚图片存在。部署与公网结果随后按实查补记；本地合成闭环不是生产登录、实体NFC或供应商握手。


## 生产部署及公网实查（已完成）

发布源码完整SHA `880cd46833dc3242578c1e288930415014afdb40`。先origin发布分支、快进origin/main，再upstream/ca-main，同一SHA；禁止强推，upstream/main保持不动。后续仅证据/记忆/归档journal提交沿同一顺序同步，运行源码保持此发布提交。

[发布包](evidence/v0.3.27/package.json)SHA256 `f5766da28d406abe4ea9f803d48818a17d07fc6f0256353117f5bf52256cd922`，469个已提交文件逐字节一致，Commander目录排除。生产RELEASE.json记录同一源码SHA。[实际API镜像181个运行源码文件](evidence/v0.3.27/source-check.json)与该提交一致；构建按既有Docker忽略规则不复制测试/.env样例。

生产 `1.15.23.152` / `dingdong-prod-trial` 已更新为0.3.27，只更新api/worker/beat/web，无新增迁移或播种。[部署](evidence/v0.3.27/production-deploy.txt)、[健康及其他业务HTTP200](evidence/v0.3.27/production-health.txt)、[数据库Redis和Commander容器ID/启动时间不变](evidence/v0.3.27/unchanged-services.json)。仅将现有服务器overlay的DINGDONG_PROTOTYPE_WEB_URL改为新地址，其他配置逐行保持，不输出密钥、不动SSH/防火墙/DB权限或R2/CDN。

[备份](evidence/v0.3.27/production-backup.txt)：服务器私密 `/opt/dingdong/backups/pre-v0.3.27-20261001.dump`，200307B/0600，SHA256 `63c075aaf7b8cacba5f8afeead7ecf9e2604da3447a1f4236aa820dda6e0dbff`，pg_restore清单通过；原入口overlay、compose和RELEASE备份于 `/opt/dingdong/backups/pre-v0.3.27-config-20261001/`。业务行未下载。

[上线后只读比对](evidence/v0.3.27/production-readiness.txt)：13家庭、13成员、11儿童、14用户、2CA账户、1报告、22测评、7活动、7授权、8报告快照等原ID及所有字段保留。固定演示号仍retired、历史bound保持，未恢复绑定。题库/活动原发布状态保持，无重导入。四周期已有缓存各8维7点、零供应商调用；真实原始表单JSON/CSV/中文只读生成正常，Worker pong。

[公网Chrome结果](evidence/v0.3.27/public-browser/public-browser.json)：实际0.3.27，30模块/样式字节和no-store，27图片正常，320/390/430/768/1024/1280布局与七旧入口、运营验证码、匿名API/后台权限通过。无异常页面错误，无短信或家庭业务写入。用实际部署模块、明确合成bound组件验证390px新文案与链接，实际popup新URL、opener为空、无参数，并真实打开供应商网页HTTP200（[页面截图](evidence/v0.3.27/public-browser/shots/supplier-companion-390.png)）。该组件检查是匿名生产页面中的组件输入，不能称生产账户绑定或生产登录后E2E；登录后绑定矩阵/报告已由本轮本地真实API/Chrome覆盖。IP入口沿用ignoreHTTPSErrors，未把它称证书有效性验收。

## 回滚与剩余事项

[回滚验证](evidence/v0.3.27/rollback-verification.txt)：旧0.3.26两镜像存在，旧compose结合原备份配置检查通过，脚本语法通过。必要时生产执行 `sh /opt/dingdong/releases/rollback.sh`，恢复仅入口overlay并切回旧四应用；不回退数据库、不删卷。当前全部验收通过，未执行回滚。

本轮请求的接收、验证、提交、双仓同步、备份部署与上线验收已完成。未新增生产短信登录/家庭写入或实体NFC验收；供应商共享网页可达不代表专属会话隔离、正式用户鉴权或真实自动推送通过。实体NFC/真手机和CA画像上行/供应商实发仍为既有父任务尾项，非本次入口改动的完成结论。
