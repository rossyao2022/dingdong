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
