# v0.3.22 闭环独立检查

2026-09-30，trellis-check。按当前父任务 PRD/design/implement、前端状态/界面/验收规范、外部集成规范检查。本组不跑数据库pytest、不提交、不进行远端操作；真实HTTP/Chrome与数据库回归由页面/后端组独立提供。

## 检查结论

未发现本组范围内尚未处理的发布阻塞。检查发现旧 `Dockerfile.web.from-v0319` 漏掉新增 `dingdong-report.js`，已补COPY，并扩展部署资源回归。v0.3.22推荐 `from-v0320` 原本已齐全；旧构建入口同步后也不会漏 `app.js` 的新import。

### 报告数据与网页

- `dingdong-report.js` 仅呈现已返回数据，没有API、storage或预测算法；0有效，非法类型/负数/非finite/越界维度为null，缺日/缺维度断线，不补0、不连过缺点。起点使用assessment.baseline_scores，目前使用growth.current.dimensions，180日只能使用day=180源点。
- 模块白名单不保留NFC、JWT、手机号或未知字段。伙伴名/动态文字转义，错误态使用固定家长文案；`sync_source`、Webhook、fixture、DTO、源事件和内部ID不进报告正文。
- 频率按钮3/7/14/21选中取真实回包weekly_turns；app修改state只作为请求参数，不能直接产生曲线或假选中成功。四频率严格后端回包验证对应请求，失败局部错误/已验证同频率推送回读。
- app报告位于“测评与报告”，只在当前child有active演示号时请求；回包前后都有viewEpoch与child检查。绑定待接通和授权缺失独立显示，不因报告错误拖垮CA问卷页。
- 报告data没有跨页面常驻缓存；forget、建档、换child均复位频率。退出清hints并渲染登录；解绑后重新读取accounts，旧演示号归档，报告入口不再出现；授权撤回后刷新转为授权提示，不继续展示原曲线。实际DOM清空/越权由浏览器及后端真实回归确认，不能仅靠静态审查宣称真机已通过。
- ca-link已按is_prototype_demo兼容首号ca_dingdong；占用409提示原家长先解绑，没有无效刷新建议；一般revision冲突保留“读取最新”。绑定凭据读后从query/hash摘除，仅在当前操作内存保留，账户展示HMAC指纹而非明文。

### CA演示报告回退

- base.py显式 `CA_DEMO_REPORTS_ENABLED` 默认False，不能因部署在生产机就默认启用。
- `demo_initial_input` 同时要求APP_ENV=demo、flag、database_fixture；问卷必须具体id、原initial-assessment、purpose=assessment、synthetic、published/retired，返回仅缺失专业分的演示输入。
- adapter先读取已有故障及initial_result；已有输入原样严格校验，不因不合法而换回退；已有timeout/failure继续报错，Worker报告故障仍执行。仅完全无输入时调用回退；没有写TestFixture或直接插成品报告。
- 回退值是专业测评暂无数据/null，不产生能力分；真实答案和Worker报告链路仍保留，正式算法闸门不变。

### HTTP回调及发布资源

- port80模板仅 `location = /api/dingdong/prototype/events`，没有新增家长API/ops宽泛HTTP入口；保留原HTTPS和其他路由。代理Host/实际scheme/来源IP与既有路径保持一致，不改认证密钥。
- 独立access log只记录时间/方法/uri/状态/上游状态/耗时；不记录query、body、Authorization、签名或手机号。日志格式必须在http{}加载，模板注释及测试已有该约束；本地模板不等于远端已经安装或收到投递。
- server白名单、index CSS、Storybook CSS、main及两离线web COPY覆盖全部app ES imports和新报告CSS；.dockerignore允许运行JS/CSS/七HTML，排除backend/.env*及开发测试依赖。公开文件权限仍0755/0644。
- release打包只读已提交runtime路径并检查分支/工作区，evidence与docs不进入包；其路径下当前Git追踪文件没有私有env/key（.env.example例外）。初次过宽 `*.env` 元数据检查误把不打包的 `.trellis/loop/models.env` 当候选，未读取该文件内容；重新按实际runtime打包范围检查通过。

## 本组实际验证

| 验证 | 结果 | 证据 |
| --- | --- | --- |
| 前端最终syntax | 通过 | deploy/evidence/v0.3.22/frontend-check-final.log |
| 全前端纯unit | 101/101 | deploy/evidence/v0.3.22/frontend-unit-final.log |
| 最终Storybook构建 | 通过；只有既有包体积提示 | deploy/evidence/v0.3.22/storybook-build-final.log |
| 三项纯部署模块 | 6/6，无DB | deploy/evidence/v0.3.22/closed-loop-deploy-static.log |
| runtime imports/CSS/私有文件路径 | 通过 | deploy/evidence/v0.3.22/runtime-resources-check.log |
| demo_report/adapter/base Python编译 | 通过，无settings启动/DB | 本轮python3 -m py_compile |
| 本组修改diff-check | 通过 | 本轮git diff --check |

最终发布仍需其他组的数据库与真实Chrome验收、版本包/手册更新和本次远端门禁。真实供应商milestone与原手机/NFC彩排没有被上述检查替代。

## 320px标题回看补修

页面组真实截图发现报告标题最后“告”字单独换行。仅在组件h1内将“陪伴成长报告”包成不拆行的词组span，按英文/中文词组间空格自然换行；字体、390布局和其它页面不动。h1保留全文aria-label，访问名称不因视觉换行变化。再跑前端101/101 unit、完整syntax、修改diff-check均通过，final日志已更新；页面组负责刷新320/390截图核对无溢出。不重复Storybook构建（呈现标记/CSS变化，无组件数据逻辑变化）。
