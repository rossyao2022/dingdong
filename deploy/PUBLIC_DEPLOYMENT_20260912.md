# 上海公网部署验收 · 2026-09-12 14:54

最终入口：**http://110.42.225.196/dingdong/**；后台：http://110.42.225.196/admin/。公网TCP80，访问设备无需Tailscale。

用户始终要求所有人可访问；此前将“上海中继IP+端口”理解成Tailscale内网IP属于误解，现已纠正。18080公网入站不可达，最终使用已有80端口，无需用户新增云安全组规则。

发布版本0.2.2；分支codex/release-v0.2.2；标签v0.2.2；发布提交4c5d0d3。Docker部署包dist/dingdong-v0.2.2.tar.gz及SHA256已生成，远端校验通过；内含RELEASE.json记录精确提交。报告追加提交不改变发布包或标签。

## 实际部署

上海服务器110.42.225.196（mmcloud）已有HTTP server仅增加本项目include `/etc/nginx/dingdong-location.conf`，原配置备份 `/etc/nginx/conf.d/game-lobby.conf.before-dingdong-20260912`。保留原网站首页和DERP443服务。本项目占用/dingdong/、/api/v1/、/admin/、/static/路径；已确认原站无对应业务目录及处理器。

nginx → localhost:18473 → tigery主动建立的受限SSH反向隧道 → 100.115.66.119:18080 Docker入口。独立密钥仅在tigery，服务dingdong-relay为user systemd，enabled/active，Linger=yes，断线自动重连。已重启隧道并从公网验证恢复，不声称做过整机重启。

远端发布目录：/home/tigery/services/dingdong/releases/dingdong-v0.2.2。Compose项目dingdong-demo；API/Worker/Beat/Web镜像均0.2.2；数据库和Redis沿用原持久卷。APP_VERSION=0.2.2，PUBLIC_ORIGIN=http://110.42.225.196，PUBLIC_SCHEME=http，BIND_ADDRESS=100.115.66.119，HTTP_PORT=18080。无新增数据库迁移，无导入本地家庭数据。密钥、口令不进报告、Git或部署包。

旧18080公网nginx配置已改为dingdong.conf.disabled；临时端口探测监听已退出。Funnel关闭，上海DERP设置保留，不再使用香港临时偏好。

## 本轮验证

- [公网真实接口验收](evidence/public-v0.2.2.txt)：直连110.42.225.196的80端口，关闭环境代理，无Tailscale IP解析替换。版本0.2.2、demo runtime、真实验证码挑战、登录、HttpOnly Cookie、刷新、退出、后台登录页均通过。
- 公网页面、相对JS/CSS路径入口可访问；原网站首页仍返回200且保持原页面。
- 新部署配置3项测试通过；前次98项业务回归和浏览器记录见历史报告。本轮没有改业务逻辑，不把历史98项写成本轮重跑。
- API/Postgres/Redis健康；Web/Worker/Beat运行；反向隧道enabled/active。
- 浏览器控制工具创建公网标签仍超时；本轮不声称完整远端浏览器UI验收完成，已用真实公网HTTP请求验证入口及认证流程。

配置和维护入口：[上海公网配置](relay/README.md)。仍为固定验证码00000和fixture数据的演示版本。
