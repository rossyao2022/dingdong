# 独立全范围检查（2026-10-02）

角色：trellis-check。已按check.jsonl读取后端/前端规范，再读取PRD、design、implement；`get_context.py --mode packages`确认本仓库为backend/frontend两层，已加载两层index的Quality Check及涉及的质量、缓存发布规范。

## 范围与结论

- 后端：复核全部LoginGrant消费者，新授权NULL、有效旧授权验证后转NULL、失效旧授权不恢复，签发的短access/400天refresh与持久cookie期限一致。鉴权、清理、JTI重放拒绝及设备撤销语义适配NULL；0018仅AlterField，不批量改变历史数据。无新接口/业务数据/存储路径改变。
- 前端：复核refresh/login/logout共享锁、无Web Locks的页内队列、singleflight、epoch及迟到401拒绝重试。Cookie/CSRF在锁内实际发请求时读取；明确退出等待已发刷新结束后撤销当前cookie；网络/5xx不主动删除持久cookie。既有启动恢复/成功退出广播保持。
- 契约与发布：OpenAPI/当前确认约束/字段字典一致，400天max-age=34560000秒；前端VERSION、入口、嵌套import及package版本为0.3.29。两份原脏审计JSON未被本check修改。release脚本仅使用Docker消费既有配置文件，不读取/输出凭据；备份与旧镜像保留、离线构建、仅0018迁移、四应用替换，DB/Redis/Commander不重建。

## 找到并直接修复的问题

原回滚脚本在v0.3.29仍运行时先填NULL截止，再切旧应用；这段间隙中新登录/刷新仍可产生NULL，旧鉴权代码随后不能比较NULL。

修复：回滚先停止web/api/worker/beat并等待容器退出，再将NULL截止填为未来400天，最后启动v0.3.28。不修改revoked_at/revoke_reason，不反迁schema、不删授权、不恢复DB。正常升级只放宽nullable，无须提前停旧应用。已通知root同步该顺序至设计和发布说明。

二次审查发现：requireEpoch原本用synthetic401取消旧身份请求，act→showError缺viewEpoch保护，可能把刚登录的新身份forget。修复为独立status=0/code=AUTH_STATE_CHANGED；showError、登录catch、render及boot忽略取消，sectionFailure传播取消。真实服务器401仍保留清登录行为。强化原13项里的7个取消断言，先6绿7红，修复后13绿；新增实际showError函数边界2项，验证取消不访问当前DOM/清身份与真实撤销仍清身份。

## 本check验证及已有本轮证据

- `git diff --check`：通过。
- `sh -n deploy/release-v0329.sh`：通过。
- 对实际内嵌rollback脚本检查顺序：stop四应用→UPDATE NULL→启动旧应用；检查不写撤销列、无迁移/DROP：通过。
- repo搜索LoginGrant使用位置及执行资源旧0.3.28引用：nullable消费者均覆盖；frontend执行资源未残留旧版本。
- 新增build-release.py已复核：仅从git archive HEAD打包运行目录，校验提交VERSION，排除文档/发布证据/Commander与凭据类文件，包标记绑定提交；Python AST语法通过，未运行打包或外部操作。
- 已审阅本轮backend-verification.md/frontend-verification.md及新增用例：后端认证/边界/审计40通过、前端147通过（新增13认证协调），ruff、相关格式、Django check/迁移漂移及语法检查通过；这些是本次check修复前的implement阶段记录，后端未再改未重复该套件。
- 新取消错误修复后`node --test frontend/unit/auth-session.test.js`15通过；`npm --prefix frontend run check`语法通过。为确认新错误语义与已有前端用例兼容，最终一次`npm --prefix frontend run test:unit`149通过、0失败/跳过（431.6ms），替代修复前147的最终数量。前端无独立lint/typecheck，不能把语法检查称为lint/typecheck。

## 验收边界

未进行浏览器关闭重开、真实多标签页、公网登录/短信或供应商功能测试；按用户安排由本人手测。本地APIClient与Node机制单测不等于浏览器/生产验收。Web Locks不支持或仍打开旧前端的标签页不能保证跨页互斥；严格JTI轮换后若响应完全丢失，旧cookie可能需重新登录。清cookie、换浏览器、隐身及超过400天完全未续期仍需登录。这些边界有明确记录，不宣称永不失效。

结论：已修复回滚并发写入及旧取消错误清除新身份风险；当前改动符合已确认验收范围，可由root完成文档状态更新、提交及已授权发布。发布健康/版本/迁移证据须以实际部署后结果补记。
