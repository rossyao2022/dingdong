# T-029 报告：刷新 T-008 漂移截图（证据保鲜）

## goal
重跑 `frontend/tests/ca-account.spec.js` 刷新 `.trellis/tasks/T-008/shots/empty-credential.png`，核对截图仍满足 T-008 验收（空凭据提交时 `.form-error` 可见且非空、对话框不关）。

## 实际做了什么
1. 先按简报第 1 节执行了决定段里新追加的门禁动作（详见文末「门禁动作」）。
2. 改动前全量跑一次 `tests/ca-account.spec.js`：`8 passed (54.2s)`；截图被重写，但字节与 HEAD 版完全一致（197704 字节，`3e4d692a…`）。
3. 为判断「漂移」是否稳定复现，把该条用例（`-g "手填绑定"`）连跑两次：第一次仍 197704 字节 / `3e4d692a…`，第二次变成 188099 字节 / `2c1d7c64…` —— 与 T-026 记录的那版一致。**同一份代码、连续两次运行，产物不同。**
4. 像素比对 HEAD 版与 188099 版：可见差异 `rows=403 px=51299`，**全部落在弹窗背后的页面上**；弹窗正文区（x300-990, y90-630）差异 `0` px。看图确认：弹窗文案、按钮、提示一字不差，只有背景页面的滚动位置差了约 26px（页首那一行导航被多切掉一些）。成因是进「账户与关联」会滚动到该面板，落点取决于滚动动画的时序，截图有时抢在动画中间。
5. 因此在截图前加一行固定滚动位置（只动用例，不动产品）：`await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));`，并把理由写成两行注释。
6. 改后复验：单条连跑三次，三次哈希完全相同（`46197db6…`，189622 字节）；再跑一次全量 `8 passed (54.3s)`，跑完哈希仍是 `46197db6…` —— 连续 4 次同字节，确定化成立。
7. 刷新后的截图入库（197704 → 189622 字节）。

## 简报前提的核对（一处与任务描述不符）
简报写「T-026 轮核实为真漂移：197704→188099 字节……成因是弹窗背后页面滚动位置变化」。

- 「成因是滚动位置变化」**成立**（像素比对证实，弹窗正文区 0 差异）。
- 「真漂移」这个定性**不成立**：该差异在同一份代码的连续两次运行里就出现（第 3 步），两次运行之间无任何代码变化。所以这不是「入库截图相对当前代码已过期」，而是**产物本身在运行间不确定**——每次跑这个文件都会有一次机会把工作区弄脏，是机制问题，不是一次性漂移。T-026 当时把它记成「真漂移」并 `git checkout --` 还原，方向对（不该混进别的任务），但定性需要更正。
- 更正后 T-029 的处理方式也随之改变：单纯「重跑一遍刷新」没有意义（下次跑又变），所以本轮把根因固定掉。

## T-008 验收项在刷新后截图上的核对
- `.form-error` 可见且非空且含「请先填写机器人凭据」：用例内三条断言（`toBeVisible` / `not.toBeEmpty` / `toContainText`）全绿；新图里该提示条可见，文字为「请先填写机器人凭据，或让手机碰一下机器人上的标签自动带进来。」（粉底提示条在「确认绑定」按钮下方）。
- 对话框不关：用例断言弹窗标题「绑定机器人」仍可见，全绿；新图弹窗仍开着。
- 附带项（T-008 同一改动引入的文案）在新图里也在：「碰一下机器人上的标签」指引句、黄色说明块里的「最长 2048 个字符」。
- 证据图：`.trellis/tasks/T-029/empty-credential-final.png`（新图副本）、`empty-credential-head.png`（HEAD 版副本）、`empty-credential-run2-188099.png`（T-026 记录的那版副本）。

## 验证命令与真实输出（原样照抄）
1. 改动前全量：`cd frontend && npx playwright test tests/ca-account.spec.js --reporter=list`
   ```
     ✓  1 tests/ca-account.spec.js:55:1 › NFC 承接：凭据不在地址栏留下，新号如实显示待接通 (5.9s)
     ✓  2 tests/ca-account.spec.js:91:1 › 同一台机器人再次绑定复用同一个号，不换号 (6.9s)
     ✓  3 tests/ca-account.spec.js:103:1 › 换机：确认弹窗讲清代价，旧号归档可查，新号重新开始 (9.7s)
     ✓  4 tests/ca-account.spec.js:145:1 › 绑定成功后停在账户页并高亮新号，标签不带路由也不跳回探索页 (7.8s)
     ✓  5 tests/ca-account.spec.js:189:1 › 新会话从标签进来：登录建档后绑定，同样落在账户页 (4.8s)
     ✓  6 tests/ca-account.spec.js:211:1 › 手填绑定：空凭据就地提示，对话框不关 (5.1s)
     ✓  7 tests/ca-account.spec.js:248:1 › 绑定落点截图：桌面与 390×844 (6.4s)
     ✓  8 tests/ca-account.spec.js:280:1 › 窄屏下账户号不撑破页面 (6.6s)

   8 passed (54.2s)
   ```
2. 改动前单条连跑两次（`-g "手填绑定"`），每次跑完取截图哈希与字节数：
   ```
     1 passed (5.1s)
   3e4d692a60917c6ff1d2a4d67d761559f8519b465fd2401fa84b399b41b0f393  ../.trellis/tasks/T-008/shots/empty-credential.png
   197704

     1 passed (5.7s)
   2c1d7c6436d7a844ca87f15422d26238a218cf231ae6c21e9008d2080bbb010a  ../.trellis/tasks/T-008/shots/empty-credential.png
   188099
   ```
3. 像素比对 HEAD 版 vs 188099 版（阈值 12）：`visible-diff rows=403 px=51299`；差异带 17 段，最大两段 `rows (674, 719) cols 300-922 px 7849`、`rows (647, 670) cols 303-988 px 3339`（背景页首区）；弹窗正文区（x300-990, y90-630）`px = 0`。全文见 `diff-analysis.txt`。
4. 改动后单条连跑三次：
   ```
     1 passed (5.1s)
   46197db652aaef0275ada44ceefc5c76032eec6ea54565ce3d6fb8e976c7f6db  ../.trellis/tasks/T-008/shots/empty-credential.png
   bytes 189622
     1 passed (5.8s)
   46197db652aaef0275ada44ceefc5c76032eec6ea54565ce3d6fb8e976c7f6db  ../.trellis/tasks/T-008/shots/empty-credential.png
   bytes 189622
     1 passed (4.8s)
   46197db652aaef0275ada44ceefc5c76032eec6ea54565ce3d6fb8e976c7f6db  ../.trellis/tasks/T-008/shots/empty-credential.png
   bytes 189622
   ```
5. 改动后全量：`cd frontend && npx playwright test tests/ca-account.spec.js --reporter=list`
   ```
     ✓  1 tests/ca-account.spec.js:55:1 › NFC 承接：凭据不在地址栏留下，新号如实显示待接通 (6.0s)
     ✓  2 tests/ca-account.spec.js:91:1 › 同一台机器人再次绑定复用同一个号，不换号 (7.1s)
     ✓  3 tests/ca-account.spec.js:103:1 › 换机：确认弹窗讲清代价，旧号归档可查，新号重新开始 (10.3s)
     ✓  4 tests/ca-account.spec.js:145:1 › 绑定成功后停在账户页并高亮新号，标签不带路由也不跳回探索页 (6.7s)
     ✓  5 tests/ca-account.spec.js:189:1 › 新会话从标签进来：登录建档后绑定，同样落在账户页 (5.8s)
     ✓  6 tests/ca-account.spec.js:211:1 › 手填绑定：空凭据就地提示，对话框不关 (5.5s)
     ✓  7 tests/ca-account.spec.js:251:1 › 绑定落点截图：桌面与 390×844 (6.0s)
     ✓  8 tests/ca-account.spec.js:283:1 › 窄屏下账户号不撑破页面 (6.3s)

   8 passed (54.3s)
   ```
   跑完截图哈希仍为 `46197db652aaef0275ada44ceefc5c76032eec6ea54565ce3d6fb8e976c7f6db`、189622 字节。
6. 像素比对 HEAD 版 vs 新图（阈值 12）：弹窗正文区 `px = 0`；整体 `visible-diff rows=357 px=56007`，全部落在背景。全文见 `diff-head-vs-final.txt`。
7. `cd frontend && npm run check` → exit 0。
8. `cd frontend && npm run test:unit` → `ℹ tests 16` / `ℹ pass 16` / `ℹ fail 0` / `ℹ duration_ms 79.101458`。
9. `python3 scripts/audit_documents.py` → `{"markdown_files": 80, "local_links_checked": 497, "archived_files_checked": 85, "operations": 55, "schemas": 65, "errors": []}`。
10. 限流消耗：本轮共 21 次登录各发 1 条 `/auth/sms`（改动前全量 8 + 改动前单条 2 + 改动后单条 3 + 改动后全量 8）；开工时 `SmsChallenge` 近 1 小时 `client_ip=127.0.0.1` 计数 19，上限 50，未撞限流。

## 未验证项
- 只对本条用例的截图做了确定化；同文件另外两张图（`frontend/docs/t007-bind-landed-*.png`）与 `robot-label.spec.js` 的 T-012 三张图仍会随运行变化，且 `frontend/docs/` 不受版本管理（`.gitignore:21` 忽略），不影响工作区；T-012 三张的随机值来源是用例里的随机手机号/凭据，属设计如此，未处理。
- 公网入口未跑（external，不在本轮范围）。
- 未验证「固定滚动位置」在移动端视口下的表现：本用例只跑桌面 1280×720。

## 偏离与理由
- **改了一条用例代码**（简报只禁止改产品代码，未禁止改用例代码）。理由是任务前提「真漂移」经复跑证伪：真因是运行间滚动时序不确定，不固定的话每跑一次就可能脏一次工作区、并让下一轮 worker 再开一个同类任务。改法沿用同文件既有做法（`绑定落点截图` 用例第 268 行就用 `scrollIntoViewIfNeeded` + `scrollBy` 控制滚动后再截图），只加 1 行 `scrollTo` + 2 行注释，不影响任何断言。
- 未采用「重跑一次把图刷新入库、什么都不改」的做法：那样本轮结论只是碰运气的结果（同一命令下一次可能又变回 197704 字节），且下次运行仍会脏工作区。

## 门禁动作（简报第 1 节，先于本任务执行）
决定段新增 `APPROVE T-021 review ...（含授权 T-021 收尾轮直推）`，queue 里 T-021 仍为 `gated`，遂执行：

- `git push origin codex/release-v0.3.6` → `1bf231c..d2b44c7`，远端 sha `d2b44c74d665539c123833d166355148a8affe11`（含 `e1e582e` 设计提交、`d2b44c7` 收尾记录提交，以及此前未推送的 `b533410` R0i 记账提交）。
- T-021 `status` 改 `done` 并在 notes 记执行结果；`gates.md` 决定段追加 `EXECUTED T-021 push …` 行。

## 本任务 push
本任务 notes 授权「机制维护类：commit 后可直接 push 并补 EXECUTED 行」，已按此执行（sha 见 `gates.md` 对应 EXECUTED 行）。
