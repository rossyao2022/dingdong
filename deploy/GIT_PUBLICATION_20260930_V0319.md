# v0.3.19 推送与 CA 主干整合

日期：2026-09-30。用户明确授权“提交 push 并合并主干”，并指定在 CA 仓库建立 main、设为默认主干。

## 实际结果

- 目标仓库：`ivesyi/dingdong-ca`（origin）。发布分支 `codex/release-v0.3.19` 已正常推送。
- 原默认分支为 `codex/release-v0.3.6`，此前没有 main。新 main 从该历史分支建立，再快进合并完整的 v0.3.19 本地分支；原 release 分支保持原提交，不重写历史。
- 首次发布分支与新 main 均为 `d7608a384c3247954caee49442d3a4a9d0874fac`；GitHub 默认分支已改为 main。后续本任务记录与 journal 会同步到两分支。
- 无合并冲突，未丢弃本地功能；旧主干是当前版本的祖先。原始视觉仓库 upstream 未改动。
- 已核验主干 VERSION 为 0.3.19；发布包源码 `45f4ea7` 与当前 VERSION/backend/frontend 无差异。沿用 [389 后端](evidence/v0.3.19/backend.txt)、[68 前端](evidence/v0.3.19/frontend-unit.txt)、[23 Chrome](evidence/v0.3.19/browser-regression.txt) 与 [10 部署配置](evidence/v0.3.19/deploy-tests.txt)验收。合并未引入功能变化，没有重复运行整套业务测试。
- 原工作区已有的 `文档/文档校验结果.json` 改动保留且未提交；私密 PDF 和运营密码仍在本机忽略目录。

## 后续统一入口

CA 主干使用 origin/main。新功能从该主干建立任务分支，依照本地优先规则整合并验证后同步；按版本准备的发布分支仍使用 `codex/release-v<版本>`。upstream 是原始视觉参考仓库，内容先审核适配后吸收。

**本任务仅推送和主干整合，没有部署、发送短信或写入生产业务库。** 生产机仍为 v0.3.18。新版上线、备份及原演示儿童报告输入准备，仍待此前独立部署放行。
