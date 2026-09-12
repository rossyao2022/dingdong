# v0.2.0 发布与部署记录

- 发布源码提交：`2a01b74ba9b357559ef615018cc229246b73a157`
- 分支：`codex/release-v0.2.0`；发布标签：`v0.2.0`
- 前后端、VERSION、镜像标签：`0.2.0`
- 源码 Docker 包：`dist/dingdong-v0.2.0.tar.gz`，附 SHA256；内部 RELEASE.json 记录上述版本和提交。
- 目标：Tailscale `100.115.66.119`，SSH 本机别名 `dell`，用户 tigery，主机 tigery-server / x86_64。
- 远端目录：`/home/tigery/services/dingdong/releases/dingdong-v0.2.0`
- 最终入口：`http://100.115.66.119:18080/`；按用户最新指令使用上海中继和 Tailscale IP+端口。访问设备需要加入该 Tailscale 网络，不是匿名公网入口。
- 后台入口：`http://100.115.66.119:18080/admin/`。服务仅绑定 Tailscale IP，不绑定所有主机网卡。

本次完成首次源码提交；原始材料与独立参考仓库仍保留本地未跟踪状态，没有删除或混入运行部署包。仓库没有 Git remote，发布提交和标签保留本地，部署通过校验过的压缩包传输。

## 验证证据

- 新部署配置测试：3项通过，见 evidence/settings.txt。
- 后端业务回归：98项通过，见 evidence/backend.txt。
- 前端语法和部署设置 Ruff 检查通过。
- Chrome整套回归：8项通过，探索场景遇到开发服务短暂断连；该场景单独复验通过。见 evidence/browser.txt、evidence/browser-retry.txt。不将首次失败日志改成全绿。
- 本地独立Docker栈：初始化、API健康、Worker/Beat运行成功；真实浏览器登录及刷新恢复成功，版本接口为0.2.0，runtime为demo。
- 部署包124项内容核对通过，排除.env、虚拟环境、node_modules和缓存目录；远端SHA256校验通过。

## 网络与构建处理

首次BuildKit访问ghcr.io的令牌端点超时；使用普通Docker镜像拉取和classic builder，经服务器现有本地代理构建成功。构建命令如下（仅为tigery该主机网络配置，不将代理写入镜像运行环境）：

```sh
DOCKER_BUILDKIT=0 docker build --network host \
  --build-arg HTTPS_PROXY=http://127.0.0.1:7890 \
  --build-arg HTTP_PROXY=http://127.0.0.1:7890 \
  -f deploy/Dockerfile.backend -t dingdong-backend:0.2.0 .
DOCKER_BUILDKIT=0 docker build -f deploy/Dockerfile.web -t dingdong-web:0.2.0 .
docker compose --env-file deploy/.env -f deploy/compose.yml up -d --no-build --wait
```

初次Funnel配置因operator权限被拒；经用户授权已设置tigery为Tailscale operator，随后Funnel配置成功。认证凭据没有进入文件、镜像或发布包。

## 边界

本次为公开演示部署，固定验证码00000和数据库fixture集成不变。不接收真实指纹，不代表真实短信、算法或DingDong供应商接入。管理员没有预置密码；创建长期管理员账号按部署说明交互执行。

## 最终验收与实际配置（2026-09-12 14:23）

用户明确要求保留上海中继，接受IP+端口访问。已清除临时香港中继偏好，日志确认home恢复derp-900 (sh)；本任务配置的443和8443 Funnel均已关闭。远端.env最终为PUBLIC_ORIGIN=http://100.115.66.119:18080、PUBLIC_SCHEME=http、BIND_ADDRESS=100.115.66.119、HTTP_PORT=18080。不记录任何密钥。

真实IP入口验收通过：首页/版本0.2.0、demo runtime、验证码挑战、登录、HttpOnly刷新Cookie、适配HTTP的Cookie属性、刷新、退出、后台登录页。证据见[evidence/remote-ip.txt](evidence/remote-ip.txt)。Django check无问题，Celery inspect ping返回pong，数据库和API健康，Worker/Beat/前端运行。

公网Funnel两处公共IP均曾TLS握手超时；上海及官方香港中继均试过，未宣称公网验收通过。Tailscale内网HTTPS路径曾验证成功，但该入口已按最新用户选择关闭。浏览器控制工具在访问远端时连续超时，因此远端浏览器UI验收未完成；本地Docker浏览器登录/刷新与前述Chrome业务回归作为已完成证据，远端额外做了真实API验收。

首次BuildKit失败后classic构建成功；基础镜像拉取完成后原始BuildKit流程也完成，最终运行的仍是相同发布源码和0.2.0镜像标签。原始发布包和v0.2.0标签保持指向2a01b74，本报告及后续文档提交不改发布源码。
