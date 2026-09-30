# 原型整合审核修复：后端交付记录

日期：2026-09-30。范围：用户批准的后端、运营后台与OpenAPI修复；无供应商请求、短信、远端写入或生产数据操作。

## 已实现

1. 实际删除先检查所有CA账户和受保护复测事件，再做任何写入。未绑定、已绑定、已归档以及固定演示号均返回409 `CA_ACCOUNT_CONFLICT`，资料、偏好、活动、审计和删除申请完全不改变。保留C1规定的永久账号ID和受保护儿童映射，不使用级联删除规避约束。无CA关联儿童仍能删除，新增偏好被清理，其审计对象ID去标识。
2. 网页陪伴偏好按儿童存储，`cognitive/imitative/reverse/open`四种方式。GET未设置时返回默认方式及revision0，不写数据库；PATCH使用儿童行锁和修订号。并发首次保存只有一个成功，另一个409，家庭与停用儿童隔离沿用现有owned_child。
3. 活动新增独立`guide_mode`，历史默认空值，原style/mode不变。活动创建幂等比较包含guide_mode；记录保存本次方式，后续偏好变化不会改历史。
4. 当前儿童导出固定schema `ca-child-export-v1`，包含儿童基本字段、网页偏好、真实探索会话及活动。探索会话保留原题库版本、题目、答案及服务端结果；不输出手机号、登录凭据、CA账户/NFC、指纹输入、其他儿童或专业合成测评。
5. 原四题探索摘要只对完成的默认`exploration`库且Q01–Q04/A–D结构完整的答卷生成，按选项代码统计四种偏好；重排选项不影响映射，自建库或未完成答卷返回null，不产生能力分数。
6. 运营新建、编辑、预览、发布提示明确复制默认题库维护会展入口；独立新题库不会自动替换首页。兴趣整库18题和实际选三岛9题、八维24题及每维3–15分说明准确，方向名称可见。Tabler alert说明文字包为单一块，避免flex将标题正文挤成两列。
7. OpenAPI增加偏好GET/PATCH、儿童导出GET，补充活动guide_mode、探索guidance_summary及删除拒绝说明；全部65个操作均有实际视图。

## 接口

- `GET/PATCH /api/v1/children/{child_id}/companion-preference`：响应`{child_id,guide_mode,revision}`；PATCH请求`{guide_mode,revision}`。
- `GET /api/v1/children/{child_id}/export`：响应`{schema_version,exported_at,child,companion_preference,explorations,activities}`。
- 活动创建及响应新增`guide_mode`；旧请求不传则空值。
- 完成四题答卷的`guidance_summary`为`{questionnaire_version_id,content_version,answered_count:4,counts:{cognitive,imitative,reverse,open}}`；其他答卷为null。

迁移0015只新增偏好表、活动字段和约束，不导入业务内容或修改CA外键。

## 证据

- `repair-backend-red.log`：修复前真实HTTP删除触发ProtectedError。
- `repair-backend-ops-red.log`：修复前运营页面未说明复制默认版本。
- `repair-backend-green.log`：新增13项真实PostgreSQL/HTTP用例全部通过，包括并发、幂等、家庭隔离、选项重排、实际活动/结果导出、四类CA保护和独立事件保护。
- `repair-backend-full.log`：完整后端421项通过，14.63秒；保留既有TestFixture模型的1个pytest收集warning。无测试mock成功供应商接入。
- 全量ruff与157文件格式检查通过；Django check无问题，makemigrations --check无变更，运营JS node --check通过。

浏览器验收由集成代理负责，截图及实际UI结果另存同任务研究目录和发布证据。该报告不把浏览器待验事项写成已通过，也不代表已部署生产。

## 使用边界

有关联机器人账户的儿童删除现在明确拒绝，未实现永久账号历史解绑/匿名化的新业务策略。网页陪伴方式不向DingDong写机器人配置；导出不包含专业合成报告。原专业算法接入闸门、供应商实测依赖及CA账号唯一性保持现有规则。
