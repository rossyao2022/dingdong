# v0.2.5 后台 HTTP 登录 CSRF 修复

用户在上海公网后台登录遇到403。远端日志明确为Origin checking failed：null。真实Chrome桌面和移动视口在正确提交CSRF隐藏字段的情况下均复现403，红灯日志见evidence/v0.2.5/admin-red.txt。

原nginx配置追加Referrer-Policy: no-referrer，使HTTP表单来源成为null。改用same-origin，保留同源来源，同时跨源不发送Referer。Django的CSRF中间件、token校验和精确可信Origin配置继续启用，没有信任null或关闭保护。

源码分支codex/release-v0.2.5，标签v0.2.5，提交b92282d；部署包dist/dingdong-v0.2.5.tar.gz及SHA256。沿用主机密钥和数据卷。

回归用不存在的账号提交真实登录表单，要求返回200和账号错误提示，确保已通过CSRF校验进入认证。有效管理员完整登录另作浏览器验收；密码不进入测试文件或日志。

部署后公网桌面/移动的后台表单与家长流程共4项通过（12.5秒），见evidence/v0.2.5/public-green.txt。实际管理员在公网和Tailscale入口均通过真实Chrome登录，抵达/admin/并存在退出表单。
