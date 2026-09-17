# T-026 报告：刷新 T-012 过期截图（证据保鲜）

## goal
重跑生成 `.trellis/tasks/T-012/shots/` 三张入库截图的用例，刷新它们；核对刷新后的截图仍满足 T-012 验收（账户页不含「指纹」字样、显示同一摘要前 8 位）。

## 实际做了什么
- 只重跑用例，未改产品代码、未改用例代码（三张图由 `frontend/tests/robot-label.spec.js` 第 68/75/96 行写出，文件本身一字未改）。
- 刷新结果：三张图确实全部变化（字节数 144227→142118、88340→88248、182021→181841），已入库。
- 顺手核对了一件影响结论的事实，见下节「对 brief 前提的核对」。

## 对 brief 前提的核对（两处与任务描述不符）
1. **写这三张图的用例不是 `ca-account.spec.js`，是 `robot-label.spec.js`。** 全仓检索截图路径（`grep -rn "shots" frontend/tests/*.js`）显示 `.trellis/tasks/T-012/shots/` 的唯一写入者是 `robot-label.spec.js`；`ca-account.spec.js` 只写 `.trellis/tasks/T-008/shots/empty-credential.png`（第 244 行）。T-017 报告里「跑 `tests/ca-account.spec.js` 会重写 `.trellis/tasks/T-012/shots/` 下 3 张截图」这句归因有误——当时那一轮是 `ca-account.spec.js` + `robot-label.spec.js` 一起跑的回归。本任务按 acceptance 要求的两条命令都跑了（`ca-account.spec.js` 全绿 + `robot-label.spec.js` 刷新）。
2. **「相对当前代码已过期」这个前提不成立。** 三张图的字节差异全部来自用例每次运行都换随机值，不是代码或文案漂移：
   - 用例源码里手机号与凭据都是随机的（`robot-label.spec.js:11-15` 的 `Math.random()`）。
   - 无代码改动的连续两次运行，三张图 md5 两两不同（`shots-run1.sha256` vs `shots-after.sha256`），字节数 144489→142118。
   - 像素级比对（阈值 12，HEAD 版 vs 本轮刷新版）可见差异只落在随机值文本带上，文案与版式一字未动：

     | 图 | 可见差异像素 | 差异带（行 / 列） | 对应内容 |
     | --- | --- | --- | --- |
     | account-row-desktop.png | 3399 | 155-168 / 569-578 / 647-660 / 672-683 | 家长手机号 / 账户号 / 摘要+日期 / 时间 |
     | account-row-mobile.png | 3167 | 373-382 / 446-459 / 470-483 | 账户号 / 摘要+日期 / 时间 |
     | replace-dialog-desktop.png | 6851 | 210-227 / 455-468 / 502-556 | 账户号+摘要 / 摘要 / 凭据输入框随机串 |

   - 人工看图对照：`card-old.png` / `card-new.png`、`dlg-old.png` / `dlg-new.png`（HEAD 版与新版的同区域裁切），除账户号、摘要、时间外完全一致。
   - 结论：刷新本身仍是需要的（证据要与当前代码同一次运行对齐），但「T-012 入库截图相对当前代码已过期」是误判，成因是随机值而非漂移。T-017 报告里「两次连续渲染 md5 一致」的观察，与本轮实测不符。

## T-012 验收项在刷新后截图上的核对
- 账户页「机器人账户」面板不含「指纹」字样：新版 desktop 截图面板内为「机器人标识（前 8 位） a8f3eaa7 · 建立于 2026/9/17 20:53:49」，无「指纹」；用例内另有 `expect(panel).not.toContainText("指纹")` 断言。
- 显示同一摘要前 8 位：账户行摘要 `a8f3eaa7` 与换机弹窗正文「机器人标识前 8 位 a8f3eaa7，账户号 ca_01M2QPWBZDKP15K24JNJZ8ZNNH」一致，账户号也与账户行 `ca_01M2QPWBZDKP15K24JNJZ8ZNNH` 一致；390×844 窄屏截图同样是 `a8f3eaa7`。
- 截图内可见的账户行底部黄色小卡与侧栏底部 `.sidebar-bottom`（`frontend/index.html:34-39`）在 HEAD 版里同样存在，非本轮引入。

## 验证命令与真实输出（原样照抄）
1. 刷新：`cd frontend && npx playwright test tests/robot-label.spec.js --reporter=list`
   ```
     ✓  1 tests/robot-label.spec.js:34:1 › 账户页把机器人摘要叫「机器人标识（前 8 位）」，不说「指纹」 (12.2s)
   1 passed (12.9s)
   ```
2. 无代码改动再跑一次（验证随机性，非漂移）：同命令
   ```
     ✓  1 tests/robot-label.spec.js:34:1 › 账户页把机器人摘要叫「机器人标识（前 8 位）」，不说「指纹」 (12.7s)
   1 passed (13.4s)
   ```
   两次 md5：desktop `58885c00e7d65512f2b207c71bb0a2e8` → `1cb6952a73bc68d5ad06e1efd02cc5c7`；mobile `283c63e5ce815f86579863fac091f3d1` → `90371292d528022a4856c6236691d57a`；dialog `6d00d310c9ef64edf54dabdc6c64ca2f` → `429f70df0249c25fff25e979d1a4d7d8`。
3. acceptance 命令：`cd frontend && npx playwright test tests/ca-account.spec.js --reporter=list`
   ```
     ✓  1 tests/ca-account.spec.js:55:1 › NFC 承接：凭据不在地址栏留下，新号如实显示待接通 (5.4s)
     ✓  2 tests/ca-account.spec.js:91:1 › 同一台机器人再次绑定复用同一个号，不换号 (7.0s)
     ✓  3 tests/ca-account.spec.js:103:1 › 换机：确认弹窗讲清代价，旧号归档可查，新号重新开始 (9.4s)
     ✓  4 tests/ca-account.spec.js:145:1 › 绑定成功后停在账户页并高亮新号，标签不带路由也不跳回探索页 (7.2s)
     ✓  5 tests/ca-account.spec.js:189:1 › 新会话从标签进来：登录建档后绑定，同样落在账户页 (4.2s)
     ✓  6 tests/ca-account.spec.js:211:1 › 手填绑定：空凭据就地提示，对话框不关 (4.8s)
     ✓  7 tests/ca-account.spec.js:248:1 › 绑定落点截图：桌面与 390×844 (6.0s)
     ✓  8 tests/ca-account.spec.js:280:1 › 窄屏下账户号不撑破页面 (6.3s)
   8 passed (51.1s)
   ```
4. `cd frontend && npm run check` → exit 0。
5. `cd frontend && npm run test:unit` → `ℹ tests 16` / `ℹ pass 16` / `ℹ fail 0` / `ℹ duration_ms 82.047834`。
6. `python3 scripts/audit_documents.py` → `{"markdown_files": 80, "local_links_checked": 497, "archived_files_checked": 85, "operations": 55, "schemas": 65, "errors": []}`。
7. 刷新前后 sha256 见 `shots-before.sha256` / `shots-after.sha256`；像素差异明细见 `diff-analysis.txt`。

## 未验证项
- 未在真实设备（手机/平板）上看过截图；窄屏只用 Chrome 390×844 视口。
- 未跑 `flows.spec.js` 等其它用例回归：本轮只改三张二进制截图，不改任何代码，回归无对应面；且每条用例消耗 1 次 `/auth/sms`，本机 IP 近 1 小时余量已用掉 10 次（9 → 19，上限 50）。

## 偏离与理由
- **`ca-account.spec.js` 连带重写了 `.trellis/tasks/T-008/shots/empty-credential.png`（197704 → 188099 字节），已 `git checkout --` 还原，未混入本轮提交。** 该图不在 T-026 goal 范围内（T-026 只针对 T-012 的三张），按「本轮只做一个任务」处理。但这个连带重写与 T-012 的情况不同：它是**真漂移**，不是随机值——可见差异 199203 像素、遍布整页（差异带 rows 0-181 / 198-249 / 282-347 / 404-719），成因是弹窗背后页面的滚动位置变了（弹窗本身文案完全一致）。建议 orchestrator 另开一个同类的证据保鲜任务刷新它。本轮没有留下刷新后的副本（已还原），该任务重跑 `ca-account.spec.js` 即可复现。
- 证据目录只保留小体积对照物：run1 的三张整图已删（412KB 冗余），保留其 sha256 文本（`shots-run1.sha256`）与两张局部裁切对照（`card-old/new.png`、`dlg-old/new.png`）；HEAD 版整图随时可用 `git show HEAD:.trellis/tasks/T-012/shots/<file>` 取回复核。
