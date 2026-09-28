# 生产机运营试用部署设计

## 入口与隔离

在晴幂生产机安装 Docker Engine 和 Compose（当前未安装），以独立 Compose 项目 `dingdong-prod-trial` 运行既有 v0.3.10 发布包。沿用 `deploy/compose.yml` 的 demo 模式，但项目名、数据卷及 `.env` 全新生成。Web 仅绑定 `127.0.0.1:18080`。在生产机现有 IP HTTPS 虚拟主机下新增叮咚路由，保留其他域名与既有 IP 默认行为；所有叮咚路由用独立 Basic Auth 限制访问。

## 数据与安全

数据库仅含 `seed_mock` 合成数据。`PUBLIC_ORIGIN=https://1.15.23.152`，Secure Cookie 打开。登录测试账号独立创建，密码和 HTTP 门禁密码均不进 Git/手册。运营测试只用合成手机号和儿童资料。DingDong 真源开关留空，机器人观察采用合成 fixture；对方真实 webhook 不指向此环境。

## 发布与回滚

部署前记录服务、端口、nginx 状态和发布包校验值。发布时先安装容器运行时、导入已测试的镜像、创建独立配置、启动服务，再在 `nginx -t` 通过后启用路由。若健康检查失败，撤销新增 Nginx 路由并停止独立 Compose 项目；不碰现有业务。发布后记录运行版本、容器健康、浏览器验收和回滚命令。
