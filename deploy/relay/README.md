# 上海公网入口

访问目标：`http://110.42.225.196/dingdong/`（家长端），运营后台 `http://110.42.225.196/ops/`，Django 后台 `/admin/`。访问者无需Tailscale。上海云服务器独立nginx入口 → localhost:18473 SSH反向隧道 → tigery的100.115.66.119:18080 Docker入口。现有DERP443和其他网站端口保留。该入口与版本无关，升级版本时不需要改这里的配置。

运营后台必须是根路径 `/ops/`，不能只靠 `/dingdong/ops/`：Django 生成根绝对地址，带前缀剥离的入口撑不住页面内的跳转。原因与占用前的核对见 [部署说明](../README.md)。

服务器：上海中继110.42.225.196（本机SSH别名mmcloud），tigery100.115.66.119（别名dell）。云实例ins-lxkar1vt；公网使用已开放TCP80，无需新增安全组规则。主机nginx监听和反向隧道成功不代表云安全组已放行，必须从外网验收。

## 配置

- 将nginx-location.conf放到上海服务器/etc/nginx/dingdong-location.conf，在已有game-lobby.conf的公网IP HTTP server块中include此文件（仅一次），nginx -t后reload。现有首页保留；/dingdong/、/ops/、/api/v1/、/admin/、/static/由叮咚使用，已确认这些路径没有原站业务处理器或目录（`/www/wwwroot/game` 无 `ops` 目录，其 index.html 与 JS 资源也无 `/ops` 引用）。旧nginx.conf是18080方案，已停用，不要同时部署。
- 将dingdong-relay.service放到tigery的~/.config/systemd/user/，执行systemctl --user daemon-reload和systemctl --user enable --now dingdong-relay。tigery已启用Linger，用户未登录时服务也运行。
- tigery的~/.ssh/dingdong-relay为独立隧道私钥；known-hosts使用已验证的上海服务器主机公钥。二者不进入发布包。
- 上海服务器authorized_keys仅追加独立隧道公钥，限制为：restrict,port-forwarding,permitlisten="127.0.0.1:18473",permitopen="127.0.0.1:1",command="/bin/false"。只允许指定反向端口，不提供命令或终端会话。
- Docker配置PUBLIC_ORIGIN=http://110.42.225.196、PUBLIC_SCHEME=http、BIND_ADDRESS=100.115.66.119、HTTP_PORT=18080；沿用已有数据库和密钥，升级时只改 `deploy/.env` 里的 `APP_VERSION`（当前 0.3.2）。

## 验收

```sh
curl --noproxy '*' http://110.42.225.196/dingdong/version.txt
curl --noproxy '*' http://110.42.225.196/api/v1/runtime
```

版本应与当前 `VERSION` 一致、runtime为demo。需验证真实验证码挑战、登录、刷新、退出和后台入口；运营后台 `http://110.42.225.196/ops/login/` 应返回 200，`/ops/` 应 302 跳登录页而不是 404。Cookie按HTTP入口配置。当前固定验证码和fixture集成仍是演示模式。

## 故障与回退

- 中继本地curl http://127.0.0.1:18473/version.txt成功而外网连接超时：检查云安全组及外部防火墙。
- 隧道状态：tigery上systemctl --user status dingdong-relay；日志journalctl --user -u dingdong-relay。
- 停用入口：上海服务器删除game-lobby.conf中本项目include行并nginx -t/reload；tigery上systemctl --user disable --now dingdong-relay。按公钥注释dingdong-relay-v0.2.1定位并移除对应授权，勿改其他授权或DERP配置。
- 保留v0.2.0发布目录和镜像。数据库无新增迁移，回退版本需要同时还原PUBLIC_ORIGIN与入口配置，不能只替换标签。
