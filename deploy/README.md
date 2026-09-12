# tigery Docker 演示部署 · v0.2.0

分支 `codex/release-v0.2.0`；前后端版本和镜像标签 `0.2.0`。部署包的 RELEASE.json 记录精确提交，旁附 SHA256。包含源码和锁文件，在 tigery 原生构建镜像（不假设 CPU 架构），不是离线镜像包。

当前仍是固定验证码 00000、数据库 fixture 集成的演示版本。不得导入真实家庭数据或真实指纹，不代表真实短信/供应商已接通。数据库使用独立的 dingdong-demo 卷，不复制本地业务数据。

## 首次启动

需要 Docker Engine、Compose v2、Python 3 和可访问镜像仓库/Python 依赖源的网络。在解压后的根目录执行（域名换成实际透传地址）：

```sh
python3 deploy/configure.py https://实际域名
docker compose --env-file deploy/.env -f deploy/compose.yml up -d --build --wait
curl -H 'Host: 实际域名' http://127.0.0.1:18080/api/v1/runtime
```

configure 创建权限 0600 的随机密钥配置，拒绝覆盖已有配置。不要提交/分享 .env。初始化容器先迁移，再创建测试输入；Worker/Beat 等 API 健康后启动。管理账号由管理员交互创建，无预置密码：

```sh
docker compose --env-file deploy/.env -f deploy/compose.yml exec api python manage.py createsuperuser
```

## 外网透传

默认只发布 `127.0.0.1:18080`。tigery 上现有隧道/反向代理将 HTTPS 域名转发到此地址，并保留原始 Host。前端、API、后台和静态资源共用该域名。PUBLIC_ORIGIN 必须与访问域名一致，PUBLIC_SCHEME 与其协议一致；生成器自动设置。HTTPS 由透传入口终止，应用 Cookie 自动启用 Secure。

如果透传服务在另一台机器或独立容器中，首次 configure 增加 `--bind tigery的局域网IP`，透传目标改用该地址的18080端口，并限制该端口只允许透传入口访问。数据库、Redis和应用8000端口没有主机映射。

上线验收必须从外网打开首页，核对 `/version.txt` 为0.2.0和 `/api/v1/runtime` 为demo，完成登录、刷新、退出、后台登录及一个报告任务。当前仅准备配置；实际域名和 SSH 可达性未确认时不得声称外网部署成功。

## 维护与回退

```sh
docker compose --env-file deploy/.env -f deploy/compose.yml ps
docker compose --env-file deploy/.env -f deploy/compose.yml logs --tail=100 api worker beat init
docker compose --env-file deploy/.env -f deploy/compose.yml exec -T postgres pg_dump -U dingdong dingdong > dingdong-backup.sql
```

升级前备份数据库并保留旧发布目录、镜像和 .env；备份可能含业务数据，需单独保管，不进入发布包。升级时复用 .env 的密钥和持久卷，只更新 APP_VERSION 与来源版本。固定 Compose 项目名保证复用卷；不要使用 down -v。迁移不保证向后兼容，回退需要旧镜像和对应的数据库备份，不能仅修改标签。

## 制作发布包

提交发布文件后在对应分支执行 `python3 deploy/package.py`。脚本拒绝版本/分支不一致及未提交的发布改动，仅打包 Git 跟踪文件，排除历史测试日志，不包含本地 .env、node_modules、虚拟环境或数据库。检查产物：`tar -tzf dist/dingdong-v0.2.0.tar.gz`。

## 本次 tigery 接入

2026-09-12 已通过 SSH 配置别名 `dell` 连至 Tailscale `100.115.66.119`，主机为 tigery-server / x86_64。计划透传域名 `https://tigery-server.tailb22271.ts.net`，目标 `127.0.0.1:18080`。首次执行 Funnel 返回 serve config denied；需主机管理员先执行 `sudo tailscale set --operator=tigery`，随后执行 `tailscale funnel --bg --https=443 18080`。域名只有在 Funnel 成功并验收后才是可用交付地址。
