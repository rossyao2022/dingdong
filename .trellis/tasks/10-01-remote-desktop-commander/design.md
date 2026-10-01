# 设计

官方设备代理@wonderwhy-er/desktop-commander，2026-10-01 npm latest=0.2.52，已下载并验证registry SHA512，运行固定版本避免开机漂移。官方远程端点https://mcp.desktopcommander.app/mcp；设备首次OAuth配对必须用户登录确认。

主机Ubuntu24.04x86_64，Node20.20.2/Python3.12.3/Docker29.1.3。采用官方Node镜像构建专用容器（依赖精确锁定，禁用npm安装脚本；必要官方依赖处理经检查），非root uid10001、只读根、cap-drop ALL、no-new-privileges、内存/CPU/PID限制、无端口发布、无host网络/pid、无Docker socket。只挂载/opt/remote-desktop-commander/workspace可写和私密state目录；工具allowedDirectories只指定/workspace与/host-status，配置仅辅助，容器才是边界。

主机进程以受控只读摘要提供：专用systemd timer只生成PID/user/comm（无命令参数/环境/凭据），放入只读host-status挂载；不允许杀主机业务进程。终端是隔离环境，不能管理生产主机服务。主机授权范围拓展必须另外确认。

systemd独立service管理docker start -a，开机启动及故障重试；同机现有服务不重启。持久配对凭据存state不提交、不输出；人工配对链接/挑战只临时显示，不入仓库。停止service即终止代理；后台撤销设备可撤销授权。回退仅停止独立服务/容器，不删除数据、不改现有配置。

## 官方源网络故障处理

Docker Hub生产出口超时，不修改Docker全局镜像源或daemon；改用已存在的Python/Debian基础镜像，仅在新代理镜像移除/app副本、清继承healthcheck，复制已验证官方Node22.23.3二进制。Debian HTTP下载停滞，改同官方源HTTPS；服务器下载慢，采用临时仅127.0.0.1监听、仅允许deb.debian.org:443的CONNECT通道（TLS仍由APT验证，仓库签名仍验证），构建期使用host网络访问该回环通道，运行容器仍bridge无端口发布。结束关闭临时通道，不改SSH配置/核心防火墙。Chromium/rg/ps由官方签名APT源安装，避免引擎启动时自行下载浏览器。npm安装脚本禁用，依赖lock固定，遥测env及config均关闭。

Restart=on-failure：异常退出重试，主动停止不会自行复活；systemd enabled负责开机启动，不重启生产机实测。
