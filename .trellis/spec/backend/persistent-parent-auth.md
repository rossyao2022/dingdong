# 家长持久登录契约

## 1. Scope / Trigger
2026-10-02用户要求家长同一浏览器跨次打开保留登录，不再首次登录固定7天截止。运营session独立，不随本次改变。

## 2. Signatures
LoginGrant.expires_at允许NULL：NULL表示没有授权固定截止，非NULL用于兼容旧授权。POST /auth/login、/auth/refresh JSON只返回access_token/token_type/expires_in（登录另有user），refresh只在HttpOnly cookie中。短access为600秒；refresh JWT/cookie每次成功签发400天（Max-Age=34560000）。

## 3. Contracts
新登录建NULL授权；刷新先校验JWT/current_refresh_jti/旧截止/撤销/账号有效性，再把有效旧授权转NULL并原子轮换jti。不能用迁移批量恢复历史授权。access每次请求仍查询授权和用户状态；logout撤销本设备授权，别的设备不受影响。Secure按既有环境配置，SameSite=Lax、Path=/api/v1/auth/、CSRF不变；无R2/CDN/env变更。
前端页面启动自动refresh→me→儿童；同源Web Locks串行refresh/login/logout的cookie读写，页内singleflight/epoch继续防迟到；旧身份取消用status=0/code=AUTH_STATE_CHANGED，页面忽略它，不能用401触发forget清掉新登录；不在storage保存token。Web Locks不支持时模块内promise队列仅有页内保护，不能称全浏览器支持多页串行。

## 4. Validation & Error Matrix
| 场景 | 预期 |
| --- | --- |
| 新登录超过7天仍有效 | 授权NULL；持久refresh可恢复，签发短access |
| 旧有效7天授权刷新 | 改NULL，不新增家庭/授权 |
| 旧截止已过期/撤销/账号停用 | 401，不复活、不重签 |
| 老refresh重放 | 401，轮换后的凭据仍有效 |
| 主动退出 | 当前授权撤销、cookie删除，旧access和refresh失效 |
| 网络/5xx暂时失败 | 不删除服务器持久cookie，可重试 |
| 旧身份请求迟到 | AUTH_STATE_CHANGED取消，不跨身份重发，不触发新身份forget |
| 清理授权 | NULL且未撤销的持久授权保留 |

## 5. Good / Base / Bad Cases
Good：只在成功验证/刷新后升级已有有效授权，用户再次打开自动恢复。Base：浏览器删除cookie、隐身或完全不用超过凭据留存期需重新登录。Bad：给localStorage放access当长期身份；永久JWT跳过撤销校验；把所有旧授权改NULL导致过期复活。

## 6. Tests Required
认证测试断言NULL授权、400天cookie属性/refresh期限、600秒access、旧有效升级、过期与撤销拒绝、旧jti拒绝、logout立即撤销、其他设备保留及cleanup不删持久授权。前端单测断言同源锁共享/串行、退出与刷新/清认证epoch边界、失败重试；模拟fetch只用于认证机制单测，不声称真实浏览器或生产验收。

## 7. Wrong vs Correct
Wrong：只把7天改成30天，仍保留首次登录固定截止。Correct：服务端授权无固定截止，浏览器凭据滚动续期，短access和撤销校验保持。
回滚旧代码前须先停止新四应用排除创建/刷新授权竞态，再将NULL截止改为未来有效截止，或采用前向修复；不能直接运行不认识NULL的旧认证代码，不能不填值反迁NOT NULL。
