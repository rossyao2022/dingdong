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


## Session 8: 生产运营登录验证码与门禁替换
<!-- trellis-session: v=2 fp=327d1f159311e022 -->

**Date**: 2026-09-28
**Task**: 生产运营登录验证码与门禁替换
**Branch**: `codex/release-v0.3.12`

### Summary

v0.3.12 已部署到 1.15.23.152，移除浏览器门禁、加入验证码和限流，完成生产 Chrome、365 后端、52 定向、67 前端与 10 部署测试。

### Git Commits

| Hash | Message |
|------|---------|
| `07174ea` | [T-ops-captcha-no-basic-gate] feat: 运营登录图形验证码并移除生产浏览器门禁 |
| `6d950c4` | [T-ops-captcha-no-basic-gate] fix: 防止空密码清除登录限流 |
| `736520b` | [T-ops-captcha-no-basic-gate] docs: 记录生产验证码部署与热修验收 |

### Status

[OK] **Completed**


## Session 9: 生产机试用家长与运营 PDF 指南
<!-- trellis-session: v=2 fp=3253afdc76cc7660 -->

**Date**: 2026-09-28
**Task**: 生产机试用家长与运营 PDF 指南
**Branch**: `codex/release-v0.3.12`

### Summary

制作并核验两份当前 v0.3.12 生产机试用操作指南；运营版含内部凭据，仅本机私密交付。

### Main Changes

- 基于当前浏览器界面制作家长与运营各 9 页 PDF

### Git Commits

| Hash | Message |
|------|---------|
| `5580364` | [T-production-pdf-guides] docs: 归档生产机试用 PDF 指南核验 |

### Testing

- [OK] Poppler 渲染 18 页逐页检查；pypdf 文本及凭据隔离校验通过
- [OK] 运营 PDF 权限 0600 且由本机 Git ignore 排除

### Status

[OK] **Completed**


## Session 10: 阿里云短信认证实测与 v0.3.13 上线
<!-- trellis-session: v=2 fp=aa3ef4a2af5ecf52 -->

**Date**: 2026-09-28
**Task**: 阿里云短信认证实测与 v0.3.13 上线
**Branch**: `codex/release-v0.3.13`

### Summary

本地两次短信实发及一次性登录验证；用户放行后部署生产机试用实例真实短信模式，完成备份、迁移、健康和页面验收，并更新双版 PDF 指南。

### Git Commits

| Hash | Message |
|------|---------|
| `413e015` | [T-aliyun-sms-auth] Add Alibaba PNVS SMS login mode |
| `6811c4f` | [T-aliyun-sms-auth] Record one accepted live SMS and expired login check |
| `1530fe5` | [T-aliyun-sms-auth] Record successful live SMS login |
| `bf7d6a7` | [T-aliyun-sms-auth] Prepare v0.3.13 SMS release |
| `11daa42` | [T-aliyun-sms-auth] Document v0.3.13 release evidence |
| `7e875f4` | [T-aliyun-sms-auth] Add safe offline release build |
| `910ef70` | [T-aliyun-sms-auth] Record v0.3.13 production trial rollout |

### Status

[OK] **Completed**


## Session 11: 短信频控热修并部署 v0.3.14
<!-- trellis-session: v=2 fp=15856c0a7eea3017 -->

**Date**: 2026-09-29
**Task**: 短信频控热修并部署 v0.3.14
**Branch**: `codex/release-v0.3.14`

### Summary

确认生产 biz.FREQUENCY 被误报 503，修复已消费验证码的本地限频和供应商 429 映射；26 项后端与 67 项前端测试通过，获放行后备份并部署生产试用实例，公网版本和容器健康通过，未额外发短信。

### Git Commits

| Hash | Message |
|------|---------|
| `d9219ea` | [T-sms-frequency-fix] Handle SMS frequency limits after logout |
| `95fed7d` | [T-sms-frequency-fix] Record pending SMS frequency release |
| `7c1eee2` | [T-sms-frequency-fix] Record production hotfix deployment |

### Status

[OK] **Completed**


## Session 12: 生产机直连叮咚 Prototype 联调
<!-- trellis-session: v=2 fp=6ce11c553a343d21 -->

**Date**: 2026-09-29
**Task**: 生产机直连叮咚 Prototype 联调
**Branch**: `codex/release-v0.3.14`

### Summary

在生产机运行中的 v0.3.14 API 容器内用一次性配置真实调用 DingDong Prototype；固定号画像、人设、会话、配置、聊天可用，ULID bind/launch 均 40401，画像 POST 50001，成长和健康 40401，复测空态与真实推送未闭环。临时 CA 账户事务回滚，公众服务未切真源，记录三方剩余事项。

### Git Commits

| Hash | Message |
|------|---------|
| `b0d6655` | [T-prod-prototype-integration] Record production-host DingDong canary |

### Status

[OK] **Completed**
