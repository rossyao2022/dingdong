# 生产机 Remote Desktop Commander

2026-10-01。服务器 1.15.23.152。**安装、隔离配置及服务器本地真实工具验证已完成；设备配对、ChatGPT应用授权和完整远程端到端仍等待用户。** 不把stdio验收称为ChatGPT远程验收。

## 环境与来源

主机Ubuntu24.04.4 LTS / x86_64，Node20.20.2、npm10.8.2、Python3.12.3、Docker29.1.3。主机原工具不升级。代理使用官方Node22.23.3发布包和官方npm `@wonderwhy-er/desktop-commander` 0.2.52（检查当时latest），已核对发布包校验值；npm依赖锁定，安装脚本禁用。procps/ripgrep/Chromium来自官方签名Debian HTTPS源。没有运行第三方安装脚本。

- [官方远程设置](https://github.com/desktop-commander/remote-desktop-commander/blob/main/docs/SETUP.md)
- [官方安全说明](https://github.com/wonderwhy-er/DesktopCommanderMCP/blob/main/SECURITY.md)
- [Node来源及SHA256](node-verification.json)、[npm来源及SHA512](npm-verification.json)、[固定依赖](package-lock.json)。

Docker Hub出口超时，因此复用已存在的Debian/Python基础镜像，并仅在新镜像层移除应用副本、取消继承健康检查。Debian下载慢时使用仅回环地址、仅允许官方Debian HTTPS的临时通道；TLS与仓库签名继续校验，完成后本机及服务器临时端口均已关闭。npm入口链接复制问题、systemd数字用户不存在问题及空旧工作目录的边界断言都已定位修正，不改变生产应用。

## 位置与权限

| 服务器目录 | 用途 | 代理能做什么 |
| --- | --- | --- |
| `/opt/remote-desktop-commander/workspace` | 专用工作区，容器内 `/workspace` | 读取、创建、修改，运行用户命令 |
| `/opt/remote-desktop-commander/host-status` | 每分钟刷新进程名称/PID/状态，容器内 `/host-status` | 只读摘要；无命令参数/环境，不杀主机进程 |
| `/opt/remote-desktop-commander/state` | 代理自身配对凭据、配置、私密工具日志 | 独立持久状态，不入Git，不对外分发 |
| `/opt/remote-desktop-commander/install` | 安装材料与服务器核对记录 | root管理，不挂给代理 |

镜像`dingdong-rdc:0.2.52`；容器`remote-desktop-commander`；设备名`dingdong-prod-restricted`。运行身份10001:10001，根文件系统只读、cap-drop ALL、no-new-privileges、512MiB/0.5CPU/128PID限制；无Docker socket、host PID、host网络或生产目录/数据库/密钥挂载。bridge网络用于出站连接，无公网端口发布；不是出站网络白名单。容器内操作系统文件仍可读，终端是隔离容器终端，不是生产root终端。

进程摘要使用独立`rdc-status`不可登录账号，无sudo/Docker组权限，仅专用摘要目录可写，systemd文件系统保护和资源限制启用。设备state目录0700；授权完成后官方device.json应0600。已授权终端与代理同身份，能够访问该代理自己的状态；不把目录白名单或自身凭据目录当作对授权工具用户的安全隔离。宿主机生产密钥未开放。

## 启动、停止及开机运行

在服务器管理员终端执行：

```sh
systemctl start remote-desktop-commander.service
systemctl stop remote-desktop-commander.service
systemctl status remote-desktop-commander.service
systemctl restart remote-desktop-commander.service
systemctl disable --now remote-desktop-commander.service
```

代理service和进程摘要timer均已enabled，当前代理active。故障退出自动重试；主动停止不会自行复活。没有为测试重启生产机。摘要timer独立管理：`systemctl stop rdc-host-status.timer`。官方仪表盘可以撤销设备，撤销后恢复访问仍需本人重新授权。

若仅重启Docker而非整机，检查代理service是否已恢复；当前systemd依赖Docker，必要时管理员重新start。不要用关闭浏览器作为断开设备的方法；服务持续后台运行。

## ChatGPT连接及人工授权

1. 安装并授权ChatGPT中的Remote Desktop Commander应用（已确认可用，但本次核对尚未安装/连接）。
2. 在官方设备验证页面登录本人账户，核对当前终端输出的配对码，再点击Verify Device。配对链接/挑战会过期，只临时发给用户，不保存在本仓库。
3. ChatGPT应用授权和设备配对使用同一账户。连接端点为 `https://mcp.desktopcommander.app/mcp`，不是生产IP的开放端口。
4. 选设备`dingdong-prod-restricted`。读取 `/workspace/rdc-install-test.txt`、新建并修改另一个测试文件、运行`id`/`python3 --version`、查看容器进程及 `/host-status/processes.json`，完成从ChatGPT发起的端到端核验。
5. 授权后需验证设备在线及service重启复用同一授权，不再配对、不读取或打印凭据内容。

本人账户登录、设备配对确认和ChatGPT应用OAuth授权必须由用户完成。本次没有代替用户批准配对、没有创建或读取账户密码。

## 已完成的真实验证

[工具验收](evidence/tool-verification.json)：通过真实MCP stdio客户端调用服务器容器中的原版工具，26工具注册；10项检查通过，包括测试文件创建/读取/修改、非root终端、容器进程、主机只读摘要、真实搜索、系统路径拒绝、宿主机/根文件系统边界、关闭遥测。合成测试文件保留，未写业务数据。

[安装核对](evidence/installation-check.json)：active/enabled、精确挂载源、权限、资源上限、无发布端口、原6个业务容器ID/镜像/启动时间不变；Nginx/SSH active，防火墙规则未改，公网仍0.3.26。设备凭据尚未建立，远程链路待本人授权。本轮没有宣称全部工具功能或完整安全审计已通过，npm官包的已有依赖弃用警告未用不兼容强制升级掩盖。

[独立复核](evidence/independent-runtime-review.md)：再次只读检查生产服务、隔离配置和临时通道关闭状态；安装部分通过，完整远程验收仍待本人授权。
