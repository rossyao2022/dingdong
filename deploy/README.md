# tigery Docker 演示部署 · v0.2.4

当前公网入口：**http://110.42.225.196/dingdong/**，使用上海服务器已开放80端口，访问者无需Tailscale。后台：http://110.42.225.196/admin/。

部署转发配置、启动与回退见 [上海公网入口](relay/README.md)。APP_VERSION=0.2.4，PUBLIC_ORIGIN=http://110.42.225.196。分支codex/release-v0.2.4和标签v0.2.4对应此发布。

发布包内的RELEASE.json记录精确Git提交；密钥和数据库不进包。tigery沿用已有.env密钥和数据卷，仅修改版本和公共Origin。首次部署可使用 `python3 deploy/configure.py http://110.42.225.196 --bind 100.115.66.119`。容器启动：`docker compose --env-file deploy/.env -f deploy/compose.yml up -d --build --wait`。

本版本仍是固定验证码00000、数据库fixture集成的演示版本，非真实供应商接入。历史v0.2.0部署与构建代理说明见 [原始部署记录](DEPLOYMENT_20260912.md)，其中内网URL/Funnel不是最终入口。

需要同时使用Tailscale入口时，在主机deploy/.env设置 `ADDITIONAL_ORIGINS=http://100.115.66.119:18080`。额外入口必须与PUBLIC_ORIGIN使用相同协议；允许的Host和CSRF Origin精确列举，不使用通配符。
