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
