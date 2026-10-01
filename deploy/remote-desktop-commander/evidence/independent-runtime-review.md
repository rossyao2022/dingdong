# Remote Desktop Commander 生产安装独立验收

日期：2026-10-01。检查角色：Trellis check。范围：本次隔离安装与生产机本地 stdio 工具验证；**不包含未授权的 ChatGPT 完整远程端到端链路**。

## 结论

**安装、限制权限、启动/开机配置和服务器本地真实工具验收通过。没有发现阻断此已安装隔离服务的具体缺陷。** 设备配对和 ChatGPT 应用 OAuth 尚未完成，因此不把任务整体标记为远程连接完成；配对完成后的设备重启复用和 ChatGPT 发起的文件/终端/进程验证仍需执行。

## 已检查证据

- `tool-verification.json`：官方工具注册 26 个；真实 stdio 调用的 10 个检查全部通过：创建、读取、修改合成测试文件，非 root 终端，容器进程列表，宿主机只读摘要，真实 rg 搜索，目录白名单拒绝系统路径，宿主机/只读根边界，关闭遥测。验证程序逐次断言 `isError !== true` 并检查具体内容，不只检查 JSON-RPC 通道。
- `installation-check.json`：service active/enabled、容器 Running=true、UID 10001、根只读、无 privileged、cap-drop ALL、no-new-privileges；bridge 网络、无 host PID 和发布端口；512 MiB/0.5 CPU/128 PID 上限；三个 bind 精确限定为专用 workspace/state/只读 host-status。state 0700，配对凭据尚未生成。
- 原 6 个业务容器 ID/镜像/启动时间不变，仍运行；Nginx、SSH active；生产版本仍 0.3.26。此核验没有读取业务数据库、凭据或修改业务服务。
- 最新 Dockerfile 显式清除新镜像内 `/app` 和 inherited healthcheck，修复 npm/npx 链接；固定 Node/npm 来源与锁依赖，安装禁用生命周期脚本。依赖来自官方签名 Debian HTTPS 源。上述清理仅发生在新镜像层，不是删除宿主机生产应用目录。
- 进程摘要服务使用专用不可登录 `rdc-status` 账号，只写专用摘要目录；脚本读取 `/proc/<pid>/status` 中 PID/父 PID/UID/名称/状态，不读取命令参数或环境。代理只读该目录，无宿主机进程控制权限。
- README 清楚区分容器终端和宿主机管理员终端、说明同 UID 授权工具用户可访问代理自身 state、bridge 出站能力、配对/OAuth 待本人完成，未夸大目录白名单的安全边界。

## 独立生产只读复核

reviewer 自行经 SSH 执行只读状态查询，未读取 device.json 内容或授权日志：

```json
{
  "service_active": "active",
  "service_enabled": "enabled",
  "summary_timer_active": "active",
  "container_running": true,
  "image": "sha256:5c16939139516f92ae3483894faf5d6db6b29c9fb43a0ea93904cd015cda8d77",
  "temporary_tunnel_18876_absent": true,
  "credentials_present": false
}
```

临时远端下载通道监听已消失。父 agent 报告本地临时代理也已停止；reviewer 未独立读取本机全部监听来验证这一点。

## 剩余授权与准确限制

1. 用户登录官方页面，核对即时配对码并确认设备；不把挑战或凭据写入仓库。
2. 用户给 ChatGPT 的官方 Remote Desktop Commander 应用完成 OAuth，使用与设备配对相同账户。
3. 实测 ChatGPT 选择此设备并完成文件读写修改、终端、容器进程和宿主机摘要；然后只重启独立代理服务，确认同一设备恢复授权、device.json 0600（只 stat 不读内容）。

没有重启生产主机以证明完整系统重启；开机启动依据 systemd enabled 配置。没有验证全部 26 个工具功能（例如所有文档转换）；没有实施出站网络白名单。官方工具需要信任所授权的账户与客户端，本次隔离限制了宿主机可访问范围，但不等于完整漏洞审计或对恶意客户端的绝对安全保证。
