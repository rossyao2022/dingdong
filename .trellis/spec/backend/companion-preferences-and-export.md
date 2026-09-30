# 网页引导偏好与儿童记录导出（v0.3.21）

## 1 范围与触发

原型四种网页引导接入真实儿童，不修改既有活动style或DingDong.learning_style。模型迁移0015增加ChildCompanionPreference、ActivityRecord.guide_mode；旧行guide_mode为空白，不从旧style猜测新模式。

## 2 接口与模型

- `GET/PATCH /api/v1/children/{child_id}/companion-preference`。
- `GET /api/v1/children/{child_id}/export`。
- `ActivityCreate.guide_mode` 可选，允许空白/cognitive/imitative/reverse/open；ActivityRecord响应返回guide_mode，进度PATCH不可改它。
- `ChildCompanionPreference.child`一对一PROTECT；guide_mode四枚举，revision正整数。无偏好行的GET返回默认cognitive/revision0，不创建记录；首次PATCH以revision0创建。

## 3 契约

PATCH偏好携 `{guide_mode,revision}`，锁儿童后锁偏好并比较revision；成功加一，审计仅记模式/修订，不记姓名或答案。返回 `{child_id,guide_mode,revision}`。

导出返回 `{schema_version:'ca-child-export-v1',exported_at,child,companion_preference,explorations,activities}`。child白名单id/name/gender/birth_date；explorations仅exploration/interest/talent的固定题目、答案、版本及结果；activities为实际记录。排除电话、登录/刷新凭据、NFC摘要/明文、指纹及算法图片输入。严格按owned_child范围，不从浏览器state上传或拼假结果。

默认四情境完成结果 `guidance_summary`：只作用于code=exploration、四题Q01–Q04且每题单选四选项A–D。A/B/C/D固定对应四方式，不按选项显示顺序；counts合计4，带固定版本。其他问卷或未完成返回null，不生成正式能力评分。

## 4 验证与错误矩阵

| 条件 | 结果 |
| --- | --- |
| 未登录 | 401 |
| 跨家庭/无此活跃儿童 | 404 |
| 未保存偏好的GET | cognitive/revision0；数据库无写入 |
| 模式非法/缺revision | 422 VALIDATION_ERROR |
| 偏好旧revision | 409 REVISION_CONFLICT；原值不变 |
| 同activity request_id换guide_mode | 409 IDEMPOTENCY_CONFLICT |
| 已有CaAccount或受保护CaReassessmentEvent的删除 | 409 CA_ACCOUNT_CONFLICT；任何删除写操作之前拒绝，事项和所有资料不变 |

旧CA号永久保留，不能以删除偏好功能为由cascade儿童或回收号码。关联儿童彻底去标识仍须明确处理规则，本版只安全拒绝直接删除，不误报完成。

## 5 好/基本/坏场景

好：家长为儿童A选模仿，刷新恢复；儿童B保持自己的偏好，A已开始的活动保持原guide_mode。基本：旧客户端不提供guide_mode仍可创建活动并返回空白。坏：拿机器人learning_style充当网页偏好、用当前偏好改写历史活动、导出其他儿童或上传指纹。

## 6 必需测试

`backend/tests/test_prototype_repair.py`：首次GET不写、四枚举、旧revision、并发初始化、越权、独立style与幂等、四题稳定计数/其他题库null、真实导出排除与跨家庭、无CA删除清理偏好/审计、有CA及历史事件删除全事务不变。

前端真实Chrome必须验证切换方式的可见话术、刷新/切儿童、朗读相同文本、默认引导和自主替代方案、进度回退、下载内容来自真实接口并释放Blob。

## 7 错误与正确

错误：select值保存了就宣布引导效果完成，或拦截API造导出。正确：活动创建保存独立guide_mode，实际页面/朗读使用同一guideText；下载当前儿童真实API白名单并检查上下文后触发，保留后台保护关系。
