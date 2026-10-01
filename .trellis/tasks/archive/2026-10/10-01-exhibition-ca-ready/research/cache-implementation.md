# 展会报告缓存实现与验证

日期：2026-10-01。仅本地实现/隔离测试，未部署、未调用真实供应商。

## 实现

- 现有两个 GET（儿童 prototype-demo / exhibition report）增加 `cached=1`：数据库只读，同周期有效共享报告，不调用供应商；无记录返回 NOT_FOUND 404。
- 默认 GET 保持实际刷新；配置缺失、网络失败、响应非法时回退同周频次已验证 push 或 pull，`availability=stale`。无可用快照保留结构化错误。
- cache-only 最近24小时观察返回 ready，历史观察返回 stale；客户端必须显式刷新才能确认当前供应商状态。
- 缓存严格验证 source/weekly/八维/曲线/时间，不混周期，不补缺值。儿童归属、授权、当前绑定与 demo 开关在请求前后复核；公开展会仅共享来源，不能读取私有家庭快照。
- `warm_prototype_reports` 默认 dry-run，仅检查共享缓存、不调用网络、不写表；`--apply` 实际 GET 四个周期(3/7/14/21)，逐项校验并保存，部分失败退出错误，旧缓存不能冒充预热成功。命令不读家庭、不绑定、不修改供应商。

## 同时间与并发

供应商 companion 更新时间可能不随人设/测评改变，旧 pull 内容去重会把 A→B→A 的最后一次观察误认为旧 A。本实现保持不可变快照与已有数据库约束，无迁移：每次 pull 在存储投影中附加内部 `_pull_started_at`，参与摘要，使每次有效拉取都是单独观察。公开投影重新校验、重建，仅输出既有报告字段，绝不输出内部 metadata。

选择规则：先 source_updated_at，再 pull 开始时间 / push 入库观察时间，最后 created_at；较晚完成的旧请求不能覆盖较新请求或期间收到的同时间 push。较早 source 更新时间不因较晚到达而取得优先权。既有无 metadata 快照使用 created_at。

## 验证

TDD red：新8项中7失败1通过；失败覆盖 cached 入参缺失、没有 pull 故障回退、观察排序及缺少预热命令。

Green：新增11项 + 旧3个专题共58项通过，1.87s。精确命令（只指向专用隔离测试库）：

```sh
cd backend
DATABASE_URL=postgres://dingdong:local-dingdong-only@127.0.0.1:55439/dingdong_cache_v25 .venv/bin/python -m pytest tests/test_prototype_report_cache.py tests/test_prototype_closed_loop.py tests/test_exhibition.py tests/test_prototype_demo.py -q --reuse-db
```

pytest 创建/复用 `test_dingdong_cache_v25`，未操作开发库或其他 agent 库。测试全局阻断真实网络，数据为明确合成样例。旧 closed_loop 周频次14故障断言从502更新为200/pull/stale，符合新增回退要求。

新增边界：空缓存/严格输入/频次隔离、旧pull故障回退、24小时陈旧、撤权/解绑/跨家庭/禁用、A→B→A、旧请求延迟返回、同时间 push/pull 双方向、存储非法shape、请求中撤权/禁用、默认预热无副作用、apply真实GET4次与失败不能报ready。

全部改动文件 Ruff 检查和 py313格式检查通过，git diff --check通过。

## 根集成待办

- OpenAPI 给两个报告 GET增加可选 cached boolean；PrototypeDemoView availability 扩展 ready/stale（ExhibitionReport继承）。
- 新 command 纳入发布包资源，生产 --apply 属远端写操作，按放行执行。
- 真实供应商预热、手机/NFC、线上发布仍待根agent单独验收；上述58项不能声称这些外部动作已完成。
