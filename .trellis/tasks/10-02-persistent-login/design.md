# 设计

## 后端
LoginGrant.expires_at允许NULL，NULL代表没有固定服务端截止；旧非空值仍按原期限验证。新登录创建NULL；成功刷新有效旧授权后转NULL。新增0018仅放宽NULL，不批量激活历史行。access保持10分钟；refresh JWT和HttpOnly/Secure/SameSite=Lax cookie每次成功签发400天有效期，持续使用滚动续期。有限JWT/cookie与无固定授权截止有不同语义；长期完全不使用超过浏览器留存/凭据期限仍需重新登录。
所有expired比较处理NULL；cleanup_auth保留未撤销NULL授权。注销、停用、家庭权限与当前jti验证保持。登录响应expires_in仍为access有效秒数。

## 前端
保留启动自动恢复和单页面singleflight。使用同源Web Locks把refresh/login/logout的cookie读写串行化，清认证epoch防止迟到结果覆盖退出/身份变化。身份变化使用status=0/code=AUTH_STATE_CHANGED取消，页面各catch忽略或向上层传播，不能用synthetic401让forget清掉新身份。缺Web Locks保持原单页面保护，不引入存储中的凭据或自制弱锁。网络/5xx失败不清cookie。单测覆盖锁与错误边界；不用假业务响应宣称浏览器/生产验收。

## 发布与回滚
本地版本0.3.29完整版本图更新，避免旧模块缓存；源码先完整审查。外部推送/部署遵守AGENTS授权边界。数据库迁移0018兼容现有数据，仅允许NULL；旧版代码不支持NULL授权，回滚需先停掉新四应用，待请求全部结束，再把NULL截止填为未来400天（保留撤销状态），或发布兼容旧界面的前向修复，不能直接迁回NOT NULL而丢授权。部署不改env/R2/CDN，不读取凭据。
