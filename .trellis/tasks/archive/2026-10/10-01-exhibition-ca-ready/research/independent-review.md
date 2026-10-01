# 后端表单、报告缓存及发布资源复核（2026-10-01）

## 审核范围与身份

本 agent 是家长端实施者，因此这里**不把本人前端改动称为独立审核**。根 agent 指定另一个缓存 agent 独立复核家长端；根 agent 负责真实 Chrome E2E。

本轮只读审核他人实施的后端表单、缓存、预热命令、权限、发布资源清单及其测试。使用独立测试库复核，不修改后端工作文件、不向真实供应商发请求、不访问生产或打印家庭资料。

## 结论

后端与表单未发现阻塞展会本地交付的实现问题。现有流程不等待新的叮咚接口，不新增自动外发；未绑定家庭仍使用现有独立 CA API，机器人报表仍受当前归属、绑定和授权保护。

- 表单来自真实已完成会话与对应发布题库，含选项、答案、时间、版本、原始结果与已有专业指标缺值；未把3–15转换为0–100，也未生成角色结论。
- 最新每用途选择与历史指定选择一致；下载使用签名的会话ID集合及摘要，不因新会话完成静默改变已预览材料。偏好或原记录改变时409，需重新预览。
- ops preview/copy/json/csv全部要求child.view和report.view；content/家长拒绝，历史会话按当前儿童筛选。结果no-store；审计只摘要与数量，不含答卷；CSV逐单元格防公式。
- 缓存重新验证既有projection形状及来源、同weekly、时间；pull和push均可回退。source time优先，source相等时按pull开始观察时间区分晚响应，网络失败局部stale。家庭与账号在供应商返回后再次核验。
- cached=1无供应商请求；预热默认dry-run，apply只GET四个频次，失败不把旧快照称刷新成功，不读家庭或修改供应商。
- 新运行module已进入static白名单、三份web Dockerfile与部署资源测试；0.3.25版本图完整性由全量unit验证。

## 本轮独立验证

```sh
DATABASE_URL=postgres://dingdong:local-dingdong-only@127.0.0.1:55439/dingdong_review_v25 .venv/bin/python -m pytest tests/test_ops_assessment_forms.py tests/test_prototype_report_cache.py -q --reuse-db
```

工作目录backend；测试29项通过（2.83秒）。实际创建/复用test_dingdong_review_v25，隔离其他agent测试库和开发库。测试全局禁真实网络，合成供应商输入明确为单测证据。

## 审核期间反馈与本人的前端修复

发现活动完成→旅程无下一步、兴趣完成后主任务未刷新、恢复探索只到地图；经根agent明确指示，本人补旅程nextExperience、局部主任务更新、journey-resume真实会话校验后直接恢复当前题。关键resume单测先红后绿。

独立缓存agent反馈报告只读操作沿用全局busy阻断CA及409保留旧报告；经根agent明确指示，本人改局部按钮busy与409清空。这些是**实施修复记录，不是自证独立审核**。

修复后check及119条全量unit通过。最终浏览器闭环、慢报告导航、解绑竞态、复制/下载、手机布局及独立前端复核仍以根agent和独立审核agent的新证据为准。

## 收尾建议

- OpenAPI prototype-demo描述曾保留旧“优先真实GET、失联仅推送”同时附加新cached合同，根agent需删除旧矛盾表述；规范同样需要同步pull回退和cache-first。
- 确保生产预热、备份、真正发布版本、运营手册截图及实体手机/NFC彩排分别留证；代码与单测绿不能代替已部署/已彩排。
