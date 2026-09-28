# Journal - yihu (Part 1)

> AI development session journal
> Started: 2026-09-17

---



## Session 1: Trellis 接线与提交门禁落地（R0）
<!-- trellis-session: v=2 fp=70d5fc0bac7d33c8 -->

**Date**: 2026-09-17
**Task**: Trellis 接线与提交门禁落地（R0）
**Branch**: `codex/release-v0.3.6`

### Summary

装 Trellis 0.6.17 并手工接线：AGENTS.md 四阶段约束段与 TRELLIS-OK 哨兵、.githooks 三项提交门禁、实验记录，基线三段复跑全绿（后端 266 / 前端单测 16 / 审计 errors 空）。

### Main Changes

- AGENTS.md 顶部插入 TRELLIS 约束段（含权限边界），原有内容未动
- 新增 .githooks/commit-msg（任务 id）与 .githooks/pre-commit（凭据文件 + 文档审计），core.hooksPath 指向 .githooks
- 去掉 .claude/settings.json 的 hooks 段；.trellis/config.yaml 设 session_auto_commit: false
- 记录 R0 简报、报告与实验数据到 .trellis/tasks/R0/ 与 .trellis/workspace/yihu/

### Git Commits

| Hash | Message |
|------|---------|
| `06abb2c` | [R0] chore(trellis): 落地 Trellis 约束机制、提交门禁与 grok 手动接线 |
| `0748d95` | [R0] chore: 门禁自测——合规提交 |

### Testing

- [OK] 门禁自测：无任务 id 被拒、合规提交通过、暂存 .pem 被拒、暂存 .md 时审计有 error 被拒，均符合预期
- [OK] 后端 uv run pytest -q：266 passed（19 分 27 秒）
- [OK] 前端 npm run check 通过；npm run test:unit 16 passed / 0 failed
- [OK] python3 scripts/audit_documents.py：errors []（markdown 200 / 链接 520）

### Status

[OK] **Completed**

### Next Steps

- 等 orchestrator 放行后再 push；本地提交停在 06abb2c
- 待拍板：门禁①是否豁免 merge commit、npm test（Playwright e2e）4 项失败是否单开一轮、审计是否 SKIP 掉 .trellis/.claude/.cursor


## Session 2: T-047 家长端文案清理收尾 + T-046/T-047 归档
<!-- trellis-session: v=2 fp=297434598ffba6c1 -->

**Date**: 2026-09-20
**Task**: T-047 家长端文案清理收尾 + T-046/T-047 归档
**Branch**: `codex/release-v0.3.6`

### Summary

T-047 收尾：README 合成标注纪律改新口径（testTag 空实现，家长端不显示合成标注）；TYPESAFE_API_KEY 补设后重跑完整 GUI 测试 run3，30/30（21 门禁 + 9 Jev，0 SKIP）；PROJECT_MEMORY.md 同步两轮记录；T-046/T-047 task.json 置 completed 后双双归档至 .trellis/tasks/archive/2026-09/。

### Git Commits

| Hash | Message |
|------|---------|
| `2520abf` | [T-047] fix(parent+core): 家长端清理合成/测试类文案与冗长免责 + 完整 GUI 重测 |
| `3834372` | [T-047] chore(docs): 收尾——README 合成标注纪律改新口径 + Jev 复验补跑 9/9 + 记忆与证据同步 |
| `0accbd8` | [T-047] chore(task): 任务状态置 completed |
| `18d2a2a` | [T-046] chore(task): 任务状态置 completed |

### Status

[OK] **Completed**


## Session 3: v0.3.7 公网部署 + 前后端保姆级指南 + 字幕遮罩 GUI 重测
<!-- trellis-session: v=2 fp=16ede361ffe46df9 -->

**Date**: 2026-09-22
**Task**: v0.3.7 公网部署 + 前后端保姆级指南 + 字幕遮罩 GUI 重测
**Branch**: `codex/release-v0.3.7`

### Summary

版本 bump 五处统一并打 tag v0.3.7，发布包 dist/dingdong-v0.3.7.tar.gz 部署至 tigery（dingdong-demo compose 原地升级，迁移 0008-0010 自动应用，容器全 healthy）；公网冒烟发现 Dockerfile.web COPY 清单漏 4 个前端新模块致 404，显式列举修复后重打包重部署，真实 Chrome 公网冒烟 4/4。产出 dist/guides/ 家长端与运营后台保姆级指南（含 13 张自动化截图），公网库建 tester 运营测试账号（凭据不入 git）。字幕遮罩全流程 GUI 重测 30/31，唯一失败 S7-jev-copy 经消融定位为判定指令口径漂移并重写指令（非产品缺陷）。环境实录：mihomo TUN 劫持 22 端口改走 Tailscale 别名 dell；原始 repo rossyao2022/dingdong 已同步两提交干净历史，本地 origin 未推。收尾：PROJECT_MEMORY 同步、loop 账本补记、T-045 复位 todo。

### Git Commits

| Hash | Message |
|------|---------|
| `f225061` | [T-047] chore: ignore 本机 AI 工具自动配置产物 |
| `ad3508f` | [T-047] chore(release): bump 版本 0.3.7 |
| `8ee9fe0` | [T-047] fix(deploy): Dockerfile.web 补齐前端新增 JS 模块 |
| `bdeed76` | [T-047] chore(docs): v0.3.7 部署会话记忆同步 + loop 账本补记 |

### Status

[OK] **Completed**


## Session 4: DingDong Prototype 微信草稿事实核验
<!-- trellis-session: v=2 fp=e6d3460ae639f1c3 -->

**Date**: 2026-09-24
**Task**: DingDong Prototype 微信草稿事实核验
**Branch**: `codex/release-v0.3.8`

### Summary

核对 9 月 22 日 API Guide、Prototype Demo、代码与 T-050/T-051 记录；识别草稿八项中的合同误读与联调边界，给出修改指示；未改业务代码或联系对方。

### Git Commits

(No commits - planning session)

### Testing

- [OK] 只读核对文档与代码；git 工作区此前干净

### Status

[OK] **Completed**

### Next Steps

- worker 修改草稿并经既定渠道交付 webhook URL 与共享密钥；真实推送到达后再称闭环完成。


## Session 5: T-052 紫色素材合并、全量核查与 v0.3.9 测试部署
<!-- trellis-session: v=2 fp=be3afe8139c62f95 -->

**Date**: 2026-09-27
**Task**: T-052 紫色素材合并、全量核查与 v0.3.9 测试部署
**Branch**: `codex/release-v0.3.9`

### Summary

择取 upstream 紫色素材并适配四岛页面；修复 Prototype 扁平人设读取；完成分段浏览器回归与测试环境 v0.3.9 部署。

### Main Changes

- 四岛和机器人 WebP、页面配色与布局已进入发布包，CA API 结构保持。
- 扁平 persona/current 的 character_name 和字符串匹配度在展示边界规范处理。

### Git Commits

| Hash | Message |
|------|---------|
| `c531e87` | [T-052] feat: 合入紫色 DingDong 素材并适配 Prototype 人设 |
| `708e6de` | [T-052] docs: 记录 v0.3.9 测试部署与联调边界 |

### Testing

- [OK] 后端全量 362 通过、90% 覆盖率；最终展示专项 56 通过；前端单测 67、部署测试 9 通过。
- [OK] Chrome 64 项分段覆盖：61 通过、3 项历史批次跳过；公网版本、六图与桌面/手机布局验收。

### Status

[OK] **Completed**

### Next Steps

- 等待 DingDong 确认正式四子接口、NFC/账号规则与推送配置；真实 milestone 到达后再做端到端闭环验收。


## Session 6: 家长端退出与文案清理
<!-- trellis-session: v=2 fp=d7b682a911456a33 -->

**Date**: 2026-09-27
**Task**: 家长端退出与文案清理
**Branch**: `codex/release-v0.3.10`

### Summary

完成家长端常驻退出入口、删除内部文案、明确演示报告；本地浏览器与单测验证通过，准备 v0.3.10 包，远端尚未部署。

### Git Commits

| Hash | Message |
|------|---------|
| `4ee8f6e` | [T-parent-logout-copy] feat: 清理家长端内部文案并提供常驻退出入口 |
| `293988a` | [T-parent-logout-copy] docs: 记录 v0.3.10 本地发布包与验证 |

### Status

[OK] **Completed**


## Session 7: v0.3.10 生产机运营试用部署
<!-- trellis-session: v=2 fp=a2d0241f4e98feee -->

**Date**: 2026-09-28
**Task**: v0.3.10 生产机运营试用部署
**Branch**: `codex/release-v0.3.10`

### Summary

在 1.15.23.152 隔离部署 v0.3.10 demo 运营试用实例，完成 HTTPS 门禁、真实 Chrome 验收、备份、回滚记录和运营手册；修复 Basic Auth 与 Bearer 冲突。

### Git Commits

| Hash | Message |
|------|---------|
| `0b9497e` | [T-production-ops-trial] docs: 部署生产机运营试用实例并交付手册 |

### Status

[OK] **Completed**
