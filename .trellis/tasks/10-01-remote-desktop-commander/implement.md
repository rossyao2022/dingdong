# 实施与验收

1. 官方文档/发布校验与环境盘点（完成）。
2. 创建专用安装目录、镜像、workspace/state，保留原业务基线。
3. 最小权限容器、进程只读摘要timer、systemd管理和开机启动。
4. 经原版stdio MCP SDK调用真实read_file/write_file/edit_block/start_process/list_processes，负向检查业务目录/权限/挂载/端口；输出只留合成文件或脱敏摘要。
5. 启动remote设备代理，用户在官方页面确认配对。确认Device ready及重启复用配对；ChatGPT授权连接后执行远程同样工具，不能把本地测试算远程E2E。
6. 独立review部署/验证证据，文档/项目记忆/journal收尾。任务在外部授权未完时不归档为完成。

文档：https://github.com/desktop-commander/remote-desktop-commander/blob/main/docs/SETUP.md；安全：https://github.com/wonderwhy-er/DesktopCommanderMCP/blob/main/SECURITY.md；CLI/help和已核验npm0.2.52源码。无迁移/业务源码/生产发布版本变化。
