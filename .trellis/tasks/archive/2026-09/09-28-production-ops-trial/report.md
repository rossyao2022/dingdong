# 执行结果（2026-09-28）

## 结论

已在用户确认的 `1.15.23.152` 上部署 v0.3.10 独立运营试用实例，公网 HTTPS 入口可用。交付范围仍是 demo 模式、固定验证码和合成数据，不声称真实供应商生产接入完成。

## 实施

- 审核原机 Nginx、现有站点、证书、内存、端口；安装 Docker / Compose，不停止原服务。
- 从 tigery 测试机导入同一镜像，上传并校验发布包；以新 Compose 项目、独立数据卷和主机侧独立密钥启动。
- 创建独立后台测试账号与 HTTP 访问门禁；新增生产机 IP HTTPS 路由，保持其他业务域名和 IP 根路径不变。
- 保存数据库初始化备份；运营手册、路由模板、部署/回滚记录入库，不写密码。

## 真实验收

- Compose `up --wait` 成功；API、PostgreSQL、Redis healthy，Web、Worker、Beat 正常；迁移至 `core.0012`。
- 公网版本 `0.3.10`、runtime `demo` / `fixed_code` / `database_fixture`；无门禁页面和 auth 接口 401，无 JWT 儿童接口 401。
- Chrome 运营后台：登录、五个主要页面、退出通过；家长端：固定码登录、合成建档、退出通过，均无页面 JS 错误。
- 原 `www.happykua.com` 200，Nginx 与原有关键服务 active；可用内存约 2.4 GiB。
- 文档审计与 Git diff 检查见最终命令输出；本轮未重复已在 v0.3.10 测试发布时完成的单元测试。

## 发现与修复

1. 生产 Nginx worker 是 `nginx` 用户，初设门禁文件组 `www-data` 导致授权请求 500；改为 `root:nginx` 0640 后恢复。
2. 外层 HTTP Basic 若覆盖全部 `/api/`，会与家长端 `Authorization: Bearer` 冲突，登录后儿童接口 401。改为只保护页面和 `/api/v1/auth/`；其他接口由 Django JWT/会话鉴权。真实浏览器重新跑通完整家长路径。

## 留存边界

- 真实短信、正式机器人接口和双方 webhook 配置仍未闭环。运营只试用合成资料。
- IP 证书当前有效期至 2026-10-04，自动续期 timer active；需继续监控续期结果。
