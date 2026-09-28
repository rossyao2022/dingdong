# 生产机直连 DingDong Prototype 联调（2026-09-29）

## 方法与范围

- 在 `1.15.23.152` 正在运行的 `dingdong-prod-trial-api-1`（v0.3.14）中启动一次性 Python 进程，从标准输入临时注入已交付的 Prototype 测试地址和 `X-API-Key`。由**生产机实际出站网络和生产镜像内的 `dingdong_client`**调用对方，没有使用本地 mock 传输层。
- 用数据库事务临时创建 `ca_dingdong` 账户及 `dingdong_sync` 授权，调用生产镜像内的 `ca_display` 真源展示服务，随后回滚；复查固定账号未留在我方生产试用库。没有打印或持久化密钥、测试 NFC token、会话码及聊天回复。
- 对方当前地址仅 HTTP；`DINGDONG_ALLOW_HTTP=true` 只设在一次性进程中。正在服务的容器和持久配置未改变。此处的“生产机联调”不等于对方正式生产环境或家长页面已切真源。

## 生产机实测结果

| 路径或环节 | 实际结果 |
| --- | --- |
| `/health` | 生产机出站 HTTP 200，返回状态字段 |
| `profile/current`，固定 `ca_dingdong` | 成功，返回画像字段；这是 Prototype 固定 mock 画像 |
| `persona/current`，固定号 | 成功，返回扁平人设字段 |
| `growth/profile?period=15d` / `30d` | 均 HTTP 404、业务码 `40401` |
| `persona/health` | HTTP 404、业务码 `40401` |
| `reassessment/current` | HTTP 200，`data:null` |
| `prototype/insights` | 成功，有 assessment/persona/companion/growth 聚合块 |
| `account/bind` | 固定号 + 随机测试 token 成功；我方真实发号器生成的 `ca_` ULID `ca_01M3ME22M3JDW3BY2SDBMMESRN` 被 HTTP 404 / `40401` 拒绝 |
| `session/launch` | 固定号成功，ULID HTTP 404 / `40401` |
| `POST /ca/profile` | 按 OpenAPI 必填字段提交测试画像，HTTP 403 / `50001`；Prototype 不允许覆盖固定 mock 画像 |
| Prototype 会话 | 固定号 launch/exchange、`prototype/assessment`、`configure(zh-CN/normal/warm)` 均 HTTP 200；3 次合成文本聊天 HTTP 200，有效互动数从 6 增至 9 |
| 真实推送 | 第 9 次有效互动后生产试用库的 `DingDongPushEvent` 数量仍为 0；生产 webhook 对无配置请求返回 `PUSH_NOT_CONFIGURED`，双方尚无推送密钥与目标配置 |

在事务内调用我方真源展示服务：`persona` 为 `ready` 且有人设；15d/30d `growth` 与 `health` 均为 `no_data/40401`；`reassessment` 因对方 `data:null` 返回 `event=null`，但我方 `availability=ready`，这是我方需修的空态语义。事务回滚后 `ca_dingdong` 未留在我方库。

## 切换决定

**没有把现有家长服务的展示源全局切到 DingDong。** 当前生产试用库没有活跃 CA 账户、没有 `dingdong_sync` 授权；正常 UI 发出的 ULID 账号被对方拒绝。切换后全部家庭不会获得真源数据，成长与健康接口也持续空态，且 Prototype URL 仍为明文 HTTP。全局切换会损坏已可用的演示页面，不能作为正式接通交付。

复核后公网版本仍为 `0.3.14`、`APP_ENV=demo`、`SMS_MODE=aliyun_verify`、展示源 `synthetic_fixture`；生产服务的 DingDong 地址、Key、推送密钥仍为空；六个容器正常，API 健康。此次没有额外发送短信，也没有修改其他生产业务。

## 剩余条件与责任

| 责任方 | 必须补齐 |
| --- | --- |
| DingDong 开发 | HTTPS 测试/生产地址与相应 Key；接受我方新生成的 ULID 账号或给正式开户协议；真实 NFC token 及校验/换绑规则；正式画像提交；人设/15d/30d/健康度/复测的版本化响应和有数据样本；正式枚举与分数类型；配置 `CA_PUSH_URL` 和双方约定的密钥，实发一条签名 milestone |
| CA 业务 | 正式首发范围、测评题库/评分/适龄/画像映射与报告文案，授权与数据共享规则；真实设备及测试家庭和三方验收负责人 |
| 我方开发 | 实现正式测评与画像出站，修 `data:null` 复测空态；在对方契约稳定后接真实数据、推送消费与失败重试；建立不注入合成数据的正式配置与三方 E2E 验收。正式生产开关当前仍故意禁止启用 |

只有对方接受动态 CA 账号、HTTPS 链路、正式子接口和推送，且 CA 业务交付正式测评规则后，才具备在公众页面切真源的条件。下一轮应以一个双方共同确认的真实设备和测试家庭走 NFC→授权→测评→画像→人设→聊天→成长/健康→复测/推送。
