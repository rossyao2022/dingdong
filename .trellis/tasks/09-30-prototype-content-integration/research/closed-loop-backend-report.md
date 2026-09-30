# v0.3.22 后端闭环交付

日期：2026-09-30。用户已批准按排查方案实施。本轮没有远端写入、供应商绑定/聊天、短信或读取部署秘密文件。

## 账号交接

- CaAccount增加prototype_demo，迁移0016把既有ca_dingdong标为演示源；最多一条active demo的数据库条件唯一约束，同时保留现有active儿童与NFC唯一约束。
- A解绑归档原行及旧关联，不移动原child/family、不删除或复用原号；B同原标签创建新ULID行并标记is_prototype_demo。原固定源只在source_account_id适配层映射，所有绑定和展示出站按该helper取数。
- A不能查看或解绑B账户；旧request_id重放返回CA_ACCOUNT_RETIRED，不再调用bind。迟到bind响应只更新仍active的行，不能恢复已归档关联。
- 未显式开启Prototype时不将固定mock源送入正式调用路径。普通账号发号与归档流程保持，永久账号引用的儿童删除保护继续有效。

## 报告与推送

- GET原children/{id}/prototype-demo接受weekly_turns=3/7/14/21、默认7。兼容8个原字段，新增assessment.baseline_scores，growth.current/curve/weekly_turns，顶层weekly_turns/updated_at/sync_source。
- 数据形状来自本轮只读源证据vendor-insights-readonly.json。8维为linguistic/logical/musical/spatial/bodily/intrapersonal/interpersonal/naturalistic；每维有限0–100。当前growth含engagement_index/growth_stage/stage_progress/dimensions；7曲线点day依次0/7/15/30/60/90/180，各点含companion_value/engagement_index/growth_stage/dimensions。陪伴值允许大于100，不混入维度分数。
- 只接受固定ca_dingdong、prototype_mock、mock起点与simulation成长来源；拒绝缺维度、NaN/Inf/布尔数值、非法周频、曲线乱序或不合法更新时间。保留既有match_score十进制字符串的数值兼容。
- 新PrototypeReportSnapshot继承不可变结果：固定源、周频、源时间、取得方式、安全DTO与内容hash；推送关联唯一事件，拉取同内容去重。不写正式ProfileSnapshot/ReportVersion，不生成供应商未给的曲线。
- webhook保留原body验签、时间窗与幂等，增加received/processed/ignored/invalid和错误码。完整有效milestone形成快照，interval必须整数3，completed_turns为正3倍数且等于effective_turns。未知或不合法事件保留接收证据但不形成快照；验签失败不落库。Unicode/过长timestamp为结构化400。
- GET先真实pull；更晚push按源更新时间优先，乱序不能回退。失联只回读匹配周频的已验证push，不把7次周频代替14次。授权、家庭、active/bound门禁在请求前及网络返回后检查。
- 技术/管理员只读页面/ops/dingdong-push/展示收到与处理状态、各周频最新安全快照；不给原body/密钥/签名。dingdong_ca.push日志只状态、错误码与事件hash。

## 测试事实

- closed-loop-backend-red.log、closed-loop-projection-red.log保留先RED证据。
- 新closed-loop19项，包括两家庭交接、并发单一赢家、退休重放、迟到bind、关开关隔离、完整真实HTTP报告、签名事件投影、重复/乱序、失联同周频fallback、非法来源/维度/NaN/曲线、不可变和撤回授权、Unicodetimestamp与技术角色页；增加相同源时间戳时新pull人设优先及巨整数结构化拒绝。
- closed-loop-backend-green.log：新旧绑定/Prototype/push定向72 passed（含3项验证码回归），2.84秒。
- closed-loop-backend-full.log：完整447 passed，16.06秒；1个既有TestFixture模型收集warning。
- 初轮全量只有root新增测试setup未准备所引用兴趣题库，修正为已有exploration非原测评库仍保持拒绝断言。失败原日志保留closed-loop-backend-full-initial-failure.log，不计入绿色证据。
- 随机验证码哈希偶然包含2345子串曾触发既有断言误报；改为仅检查挑战结构及未直接保存明文，不改验证码业务。原失败保留closed-loop-backend-captcha-failure.log。同时间戳和巨整数均有独立RED证据。
- closed-loop-backend-checks.log：ruff、162文件格式检查、Django check、makemigrations --check和git diff --check全部通过；OpenAPI仍65个实际路由操作，新增DTO字段及查询参数已同步。

根代理实现并验证独立CA演示报告fallback与开关：完整suite包含其7项；浏览器、Worker及零出站隔离签名POST验收由集成代理另记。本报告不声称真实供应商主动投递已成功，也不声称已部署。

## 发布前后边界

迁移仅加字段、约束、快照表与既有固定行标记，不改CA外键、不覆盖旧历史。回滚不能用旧版本整库覆盖后续用户记录。生产callback反向代理与真实供应商投递需根代理按本轮远端放行实施和验收。
