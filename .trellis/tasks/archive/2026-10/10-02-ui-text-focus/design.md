# 设计

差距在呈现层：功能已存在，但重复铺垫、空状态次序和默认展开细节稀释主动作。复用原生details/summary、既有动作和路由。必需告知靠近对应图表/上传/授权/确认，不藏在详情。仅移动UI和精简文案，不更改计分、答题/活动状态或权限。

边界：app.js/ui-components.js/index.html/dingdong-report.js/experience-flow.js及client.css负责公共外壳与日常页面；playworld/island/talent/career/fingerprint模块负责探索；ops/templates与ops.css负责运营。不同实现者拥有互斥文件，主协调者合并样式及测试适配。完整覆盖清单记录到research/coverage.md。

详情折叠保持全部原内容和链接可查；不让任何动作因折叠/改名失效。动态文案仍esc。全文DINGDONG入口保持用户已确认标签。旧HTML入口检查保留跳转。报告刷新/切儿童竞态等业务代码保持。

回滚为本地git提交反向恢复，无迁移/env变动；正式发布缓存版本及部署是后续单独门禁，本轮不部署。
