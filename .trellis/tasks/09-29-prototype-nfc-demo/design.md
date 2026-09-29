# 设计

## 边界

- NFC 标签是写入 NDEF URI 的入口，浏览器测试用完全相同的 URL。随机测试 token 仅在生产试用实例的受限 env 和交付给用户的演示 URL 中；后端只保存 HMAC 摘要。
- 仅 `APP_ENV=demo` 且 `DINGDONG_PROTOTYPE_DEMO_ENABLED=true`、token 精确匹配时，`issue_account` 选择 `ca_dingdong`。固定号最多被一个儿童档案占用；已被其他档案占用时返回可理解的 409，不转成 500 或假成功。其余账户沿用 ULID。
- 新增鉴权的 Prototype 展示接口，后端调用 `/api/v1/ca/prototype/insights` 并白名单输出当前人设、陪伴值和有效互动数。接口校验儿童归属、固定账户、有效 `dingdong_sync` 授权；不把 API Key 发给浏览器。
- 家长端已有 URL 提取/清理和登录后绑定弹窗复用。Prototype 专属卡只在固定账号下展示，并提供对方手机页链接、授权、刷新。人工选演示测评方向按对方文档 §4 允许的会展临时流程说明，不声称自动传递 CA 测评结果。

## 发布与回退

- 独立版本发布到 `dingdong-prod-trial`；在受限 env 叠加 Prototype base URL、测试 Key、HTTP 豁免、测试 token 和启用开关。原短信及推送 overlay 继续叠加。
- 发布前备份数据库，验证 Compose config 与镜像。回退到 v0.3.14 镜像和原 env 组合即可停用固定账号路径，保留已有数据与其他服务。
