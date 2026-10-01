# Remote Desktop Commander 安全与工具契约独立检查

日期：2026-10-01。范围：任务 PRD/design/implement、下载的官方 npm 0.2.52 发布文件、已保存的官方 SETUP/SECURITY。此检查没有 SSH 写入、安装、读取配对凭据或生产密钥。实际部署证据待第二次检查。

## 结论

所提非 root Docker 隔离方式符合官方 SECURITY 的建议；目录白名单和命令黑名单只能作误操作提醒，不能当安全边界。容器只能读写专用工作区、保存自身授权状态、读取脱敏的主机进程摘要，不能直接管理宿主机生产服务。用户交付说明必须写清此范围，不能把容器终端称为 root 主机终端。

没有发现必须停止当前隔离部署的设计问题。下面四项需要实现和验收落实，未完成不能声称全部通过。

## 必须落实

1. **禁用两层遥测。** 官方 `dist/utils/capture.js` 支持 `DESKTOP_COMMANDER_DISABLE_TELEMETRY=1`；默认配置 `telemetryEnabled:true`。`desktop-commander-integration.js` 给子进程使用 MCP SDK `getDefaultEnvironment()` 加 `config.env`，不能假设父进程自定义环境变量会全部传递。因此同时写 `telemetryEnabled:false`，检查运行中的 child 配置/安全环境；不要开 `--debug`。不输出工具参数或授权日志中的敏感挑战到版本库。
2. **凭据边界准确说明。** `device.json` 官方原子写入为 0600；state 主机目录应 0700。终端与设备代理同 UID 时，授权工具用户原则上可以访问自己的 state，`allowedDirectories` 不能阻止 shell。不能声称 state 对已授权远程工具用户不可读。生产密钥、数据库、Docker socket、宿主机 `/proc` 不挂载是实质隔离。任何负向测试都只检查是否存在/是否拒绝，不读凭据内容。
3. **依赖准备不能只看 npm 安装退出码。** `--ignore-scripts` 避免官方包 postinstall 安装跟踪，也会跳过依赖二进制准备：特别是 `@vscode/ripgrep`。需保证可信 `rg` 在镜像内可用；验收 `list_tools` 和真实搜索。`sharp`/PDF 浏览器依赖涉及本任务外功能，若未装 Chromium，应明确 PDF 生成不是此次验收范围，不能宣称整个工具集合全部可用。固定 package-lock 并检查 `npm ci --ignore-scripts`，不用 `@latest` 开机更新。
4. **本地和远程验收分开。** stdio 客户端成功不证明设备配对或 ChatGPT OAuth 已完成。只有设备 ready、重启后恢复同一授权设备、ChatGPT 对官方端点完成 OAuth 后实际调用，才能标记远程端到端通过。缺人工授权时记录安装/本地验证完成、远程授权待完成。

## 工具精确契约（官方 dist/tools/schemas.js）

- `write_file`: `{path:'/workspace/rdc-test.txt', content:'alpha\\n', mode:'rewrite'}`。
- `read_file`: `{path:'/workspace/rdc-test.txt', offset:0, length:20}`；本地文件默认 `isUrl:false`。
- `edit_block`: `{file_path:'/workspace/rdc-test.txt', old_string:'alpha', new_string:'beta', expected_replacements:1}`。参数不是 `path`。
- `start_process`: `{command:'id; pwd; python3 --version; ps -o pid,comm', timeout_ms:10000}`。`timeout_ms` 是必填。
- `read_process_output`: `{pid:<returned pid>, timeout_ms:1000}`，仅运行未结束时读新输出。
- `list_processes`: `{}`，Linux 官方实现为 `ps aux`，返回容器 PID 命名空间内进程（含命令参数），不是宿主机全量进程。
- 主机进程信息另通过 `read_file('/host-status/processes.txt')` 或约定摘要路径读取，只应有 PID/user/comm，不含 args、环境或配对链接。

每个 `callTool` 必须断言 `isError !== true` 并验证具体合成内容，不能只凭传输成功。

## 运行实证复核清单

- 镜像 ID/Node SHA256/npm integrity、版本、锁文件固定；复用原 Python 镜像的确切 ID 和实际 Node/Python/rg 版本。
- `docker inspect` 精简输出：UID 10001、ReadonlyRootfs true、cap-drop ALL、no-new-privileges、Memory/NanoCpus/PidsLimit；没有 host network/PID/privileged/devices/socket/ports。
- 只挂载 workspace/state/脱敏 summary，summary 只读；安装目录 root 所有、workspace/state 独立 UID；普通工作区不覆盖业务目录。
- 容器不能访问生产 `/opt/dingdong`、宿主机 root SSH/密钥、Docker socket；不能写只读 summary/rootfs；无 sudo/root 提权。
- systemd 单独 service + timer enabled；restart/stop 行为不影响生产应用；Docker start 附着返回状态正确。
- 新端口没有发布，不修改防火墙/SSH；生产容器的状态/镜像/启动时间和前基线一致。
- 授权挑战和登录地址仅供用户临时完成配对；日志/证据不保存凭据；授权完成前不声称已连接 ChatGPT。

## 初版安装文件复核

已读 `deploy/remote-desktop-commander/` 下 Dockerfile/config/systemd/摘要脚本。配置已经持久 `telemetryEnabled:false`；摘要脚本仅读取 `/proc/<pid>/status`，没有 cmdline/environ；摘要服务是 UID 10001，使用 systemd filesystem/capability 限制，合理。

Dockerfile 改为复用 `dingdong-backend:0.3.26` 后，需要核实 inherited HEALTHCHECK/ENV 和 `/app`：不能沿用探测旧 API 端口的 healthcheck；静态环境不能带生产密钥；新镜像内若保留业务源码，隔离 shell 仍能读取它，不能描述成只有 `/workspace` 内容可读。优先复用同机已存在官方 Python 基础镜像 ID（如存在），否则在新镜像层移除不需要的业务源码，不涉及删除宿主机业务文件。普通 bridge 网络会保留出站连接能力，不能声称 network=none；只承诺无 host 网络与入站端口发布。

## 安装脚本更新复核

已复核随后提交的 Dockerfile/install.sh/check-installation.py/verify-tools.mjs/boundary-test.py。新镜像层删除 `/app`、`HEALTHCHECK NONE`，运行系统服务改 `Restart=on-failure`，解决上次具体发现。`npm ci --ignore-scripts` 使用锁文件；APT 使用官方 HTTPS 和签名仓库安装 procps/ripgrep/chromium；systemd 承接独立容器。stdio 验证覆盖真实文件创建读取替换、非 root 终端、容器进程、只读宿主进程摘要、真实搜索、目录白名单与实际容器边界、关闭遥测，明确标记不是 ChatGPT remote E2E。

当前未发现必须阻止此安装设计的具体缺陷。建议补强验证脚本显式断言 container Running=true，以及核对 bind mount source 精确为三个约定目录（不仅检查目标集合）；配对完成后只用 stat 核对 device.json 0600，不读其内容。缺实际执行证据时，此文只通过安装设计/脚本审查，不通过安装完成或远程连通验收。

临时 SSH reverse CONNECT 仅用于受控官方 apt HTTPS 下载：root 通知其监听 loopback、目的 allowlist deb.debian.org:443，且仅 build 阶段 host network。最终须检查隧道/代理已停止、远端监听已消失；运行容器仍 bridge、无端口发布。此审查没有把上述临时措施当作永久生产连接配置。

## 官方依据

- [远程设备 SETUP](https://github.com/desktop-commander/remote-desktop-commander/blob/main/docs/SETUP.md)
- [Desktop Commander SECURITY](https://github.com/wonderwhy-er/DesktopCommanderMCP/blob/main/SECURITY.md)
- 官方 npm 0.2.52 文件：`dist/tools/schemas.js`、`dist/tools/process.js`、`dist/remote-device/device.js`、`dist/remote-device/desktop-commander-integration.js`、`dist/utils/capture.js`、`dist/config-manager.js`、`dist/npm-scripts/verify-ripgrep.js`。
