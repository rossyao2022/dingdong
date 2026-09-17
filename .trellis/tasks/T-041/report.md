# T-041 报告：P-16 复测对话框被轮询关掉 + P-17/O-08/O-09/O-10/O-11 文案小项打包

## goal

修 T-040 巡检坐实的真缺陷与五条小项（goal 原文见 `.trellis/loop/queue.md` 的 T-041 段）：

1. **P-16（真缺陷）**：`render()` 一进来就调 `stopWork()`，而 `stopWork()` 会 `$("#dialog").close()`；`#reports` 在观察未就绪时每 3 秒重渲染一次，于是复测「开始复测」打开的同意对话框只开约 1.7 秒就被关掉，家长无从继续。修法由 orchestrator 裁定（`gates.md` 的 `APPROVE T-040`）：把「离开上下文」与「重渲染」拆开，对话框打开期间挂起轮询。
2. **P-17**：核验凭据输错时对话框显示内部码 `PROOF_INVALID`。
3. **O-08**：服务事项列表/详情、CA 账户列表、儿童详情四处「家长」列空姓名回落手机号，同一号码渲染两遍。
4. **O-09**：家庭详情「家长」行显示内部英文角色 `owner`。
5. **O-10**：活动列表显示内部英文 code `imagination · calm`。
6. **O-11**：CA 账户列表仍用「指纹」指代凭据摘要，与家长端口径不一致。

## 本轮怎么接上的

上一轮 worker 在 Verify 阶段被驱动收掉（`runs.log`：`2026-09-17T22:25:51Z ROUND T-041 FAIL 2406s … rc=143,dirty-worktree` + `RESET T-041 doing→todo`）。本轮按核对式续跑：逐条对照 `progress.md` 声明的改动与磁盘现状（全部对上），重跑前任记录的最后一个验证命令（真实 Chrome 3 项，通过），已完成阶段不重做，从 Verify 的收尾接着做。前任声明里唯一没做的是 `PROJECT_MEMORY.md` 同步，本轮补上。

## 实际做了什么

### P-16：把「离开上下文」与「重渲染」拆开（`frontend/app.js`）

- 新增 `leaveContext()`：关对话框 + 清 `childEdit`（原来这两件事在 `stopWork()` 里）。
- 新增 `closeDialog()`：`leaveContext()` + 取消朗读；`stopWork()` 变成 `clearTimeout(pollTimer)` + `closeDialog()`。
- **换路由**才调 `leaveContext()`：`to()` 与 `hashchange` 入口在 `render()` 之前调。
- `render()` 自身只做三件事：`clearTimeout(pollTimer)`、清 `pollPending`、`speechSynthesis.cancel()`；不再关对话框、不再动 `childEdit`。
- 新增 `schedulePoll(tick, delay)` 取代两处裸 `setTimeout(render, …)`：对话框打开时不排定时器、只置 `pollPending = true`；`<dialog>` 的 `close` 事件里再补一次 `render()`（推迟一个任务，让「换路由引起的关闭」被紧接着的那次渲染自然吸收，`pollPending` 已清则跳过）。
- 五处「提交成功后重渲染」的对话框流程（核验关联、编辑儿童档案、归档账户号、提交申请事项、`case "close"`）改为自己显式调 `closeDialog()`，不再指望 `render()` 顺手关掉。
- **本轮追加的一处**：`render()` 里补回 `window.speechSynthesis?.cancel()`。前任把 `render()` 开头的 `stopWork()` 整体换掉时，连带去掉了原有的朗读取消——答题/活动步骤重渲染时上一题的朗读不会停，会盖住新一题的内容。朗读与对话框无关，属被牵连的既有行为，补回；`grep` 确认没有测试断言朗读行为，改动安全。

### P-17：核验失败给中文（后端给，前端照旧渲染 `message`）

`backend/dingdong_ca/core/api/robots.py` 新增 `PROOF_INVALID_MESSAGE = "凭据无法核验，请核对机器人标签上的凭据，或重新绑定机器人。"`，两处 `raise ApiError("PROOF_INVALID", 422)` 都带上它。

选后端而不是前端按 code 映射：运营端与其它客户端读的是同一个 `message`，只有家长端改会让同一份错误在两个界面说两样话。

### O-08 / O-09 / O-10 / O-11（运营端模板与词表）

- `ops/labels.py` 新增 `ACTIVITY_ISLAND`（science 科学发现 / story 故事表达 / nature 自然观察 / imagination 创意想象）、`ACTIVITY_MOOD`（energy 能量满满 / focus 正在专注 / inspire 需要启发 / calm 平静如水）、`FAMILY_ROLE`（owner 主要家长）。岛屿与情绪取值与家长端 `frontend/app.js` 的 `islands` / `moods` 逐条对齐。
- `ops/templatetags/ops_labels.py` 新增过滤器 `known_label`：词表命中给中文，未命中原样返回，空值给 `—`。**不能直接用 `label`**——`Activity.island` / `mood` 是运营自由填写的 `CharField`（无 choices），`label` 会把运营写的「观察岛」渲染成「未知（观察岛）」，比显示原文更糟。
- 模板：`services.html` / `service_detail.html` / `ca_accounts.html` / `child_detail.html` 四处姓名列 `display_name` → `account_name`（空姓名「未填写」）；`family_detail.html` 的 `{{ member.role }}` → `|label:"FAMILY_ROLE"`；`activities.html` / `activity_preview.html` 的岛屿与情绪 → `|known_label` 且原始值进 `title`；`ca_accounts.html` 的「摘要指纹」→「摘要」、「指纹 <hash8>」→「凭据前 8 位 <hash8>」。

## 验证命令与真实输出

### 先失败证据（P-16 的判定确实能证伪修复）

临时把 `render()` 开头三行换回 `stopWork()`（其余不动），跑完立刻从备份还原并用 `diff` 校验一致（`RESTORED-IDENTICAL`）：

```
cd frontend && npx playwright test tests/t041-dialog-and-labels.spec.js --reporter=list -g 'P-16'

  Error: expect(received).toBe(expected) // Object.is equality
  Expected: true
  Received: false
    177 |   expect(
    178 |     await page.evaluate(() => document.querySelector("#dialog").open),
  > 179 |   ).toBe(true);
        at frontend/tests/t041-dialog-and-labels.spec.js:179:5
  1 failed
```

逐字全文存 `.trellis/tasks/T-041/shots/p16-before-fix-dialog-closed.log`。

### 修复后

```
npx playwright test tests/t041-dialog-and-labels.spec.js --reporter=list
  ✓ P-16：观察未就绪的轮询重渲染不再关掉复测承接对话框 (27.1s)
  ✓ P-17：核验凭据输错时对话框给中文，不显示内部码 PROOF_INVALID (11.8s)
  ✓ 运营端 O-08/O-09/O-10/O-11：姓名列不重复号码、角色与标签给中文、去掉「指纹」 (9.3s)
  3 passed (49.3s)

cd backend && uv run --no-sync pytest tests/test_ops_services.py tests/test_ops_ca_accounts.py tests/test_ops_console.py tests/test_ops_content.py -q
  86 passed in 359.42s (0:05:59)

cd backend && uv run --no-sync pytest tests/test_m3.py -q
  29 passed in 389.32s (0:06:29)

cd frontend && npm run check          # exit 0
cd frontend && npm run test:unit      # tests 67 / pass 67 / fail 0 / duration_ms 112.383333

cd backend && uv run --no-sync ruff check .                              # All checks passed!
cd backend && uv run --no-sync ruff format --check --target-version py313 .  # 132 files already formatted
cd backend && uv run --no-sync python manage.py check                    # System check identified no issues (0 silenced).

python3 scripts/audit_documents.py
  {"markdown_files": 80, "local_links_checked": 511, "archived_files_checked": 85, "operations": 61, "schemas": 83, "errors": []}
```

截图 10 张（P-16 桌面/移动、进入测评、P-17、运营端五张含 390×844）由本轮这次运行重新生成，时间戳 2026-09-18 06:39–06:40，在 `.trellis/tasks/T-041/shots/`。

### 回归

```
cd frontend && npx playwright test tests/flows.spec.js tests/robot-label.spec.js tests/parent-name-fallback.spec.js tests/ca-account.spec.js --reporter=list
  2 failed
    tests/flows.spec.js:151:1 › 用途授权、22题、合成输入、真实初始报告
    tests/flows.spec.js:188:1 › 机器人关联、阶段报告、撤回同步授权
  16 passed (4.5m)
```

**这两个失败与本轮改动无关，已做归因实验**：把 `frontend/app.js` 换成 pre-fix 版（`git show HEAD:frontend/app.js > frontend/app.js`，即 T-040 状态）后，同样两个用例、同样两处失败逐字复现（第二个甚至在登录步骤就因 429 失败）。随后已还原并 `diff` 校验一致。

根因（本地环境，非产品缺陷）：

- Celery worker 进程存活但**不再消费**：`redis-cli -p 56379 llen dingdong-ca` = **25**，队列里含多条 `dingdong_ca.core.tasks.run_report_job`，报告一直停在「报告正在生成，页面会自动更新。」，`查看初始报告` / `查看阶段报告` 永远不出现。
- 同一 IP 一小时 ≥50 次短信验证码触发 429（`backend/dingdong_ca/core/api/accounts.py:117-121`），登录按钮变 disabled。

**本轮没有重启 worker**（不属本任务范围，且会顺带执行队列里 25 条历史任务），诊断证据留在这里供下一次巡检使用。

## 未验证项

1. `frontend/deployment-tests/parent-conflict-recovery.spec.js`（acceptance 点名的 childEdit 冲突恢复回归）**本轮没跑**。原因：它按 `playwright.public.config.js` 默认指向公网入口 `http://110.42.225.196/dingdong/`，需要 `DD_OPS_ADMIN_USER` / `DD_OPS_ADMIN_PW`，且流程会在生产库真实建家长账号、改儿童档案——属 `AGENTS.md` 权限边界外的远端写操作；本地也跑不了（该 spec 的 `/ops/login/` 与家长端必须同源，本地家长端在 4173、运营端在 8017，不是一个源）。本地替代覆盖：`tests/flows.spec.js`（含「编辑档案 → 保存修改」与「核验对话框 → 关闭对话框」两条正路径）、`tests/t041-dialog-and-labels.spec.js`。
2. `tests/flows.spec.js` 的完整回归未跑绿（见上，环境原因）。
3. 真源模式（`CA_DISPLAY_DATA_SOURCE=dingdong` 且已配置）与生产未测，与历轮一致。

## 偏离与理由

1. **`render()` 补回 `speechSynthesis.cancel()`**（偏离裁定的字面表述）。裁定写的是「`render()` 自身不再无条件 `stopWork()`（`clearTimeout(pollTimer)` 保留在 render 开头）」。前任按字面换掉了整段，于是连朗读取消也一并没了——这不是裁定要动的东西（朗读既不属于「离开上下文」也不属于「重渲染」），却会造成「上一题朗读不停、盖住新一题」的回归。补回后 P-16 语义不受影响（对话框仍不被关闭），已在 `.trellis/spec/frontend/state-and-rendering.md` 与 `frontend/README.md` 写明。
2. **O-08 的手机号位置**：acceptance 括注写「手机号只在独立列/行出现」。本轮沿用各页既有版式——`ca_accounts` / `services` 的手机号仍是姓名格里的次要小字（改前就在那儿，改前的问题是同一格又回落一遍手机号），`service_detail` / `child_detail` 是「家长 未填写（手机号）」一行。四处断言的是「同一手机号在该页只出现一次」，已由后端用例与真实 Chrome 双侧核验通过。把手机号拆成独立列/行会改变四张表与两条详情页的版式，超出「不再渲染两遍」这个缺陷本身，故未做。
3. **P-16 用例的时序脆弱点（如实记录，未改）**：它靠「观察还没同步 / 阶段画像还没出」这段时间里真实存在的轮询，断言分两段——先要求轮询确实又走了一轮（`overviewCalls` 变大），再要求对话框还开着。若点「开始复测」之前轮询已经停了（阶段报告已生成），会卡在前一段，报 `Expected: > 3 / Received: 3` 这类与对话框无关的失败（本轮重拍先失败截图时就撞上过一次）。这类失败只会假红、不会假绿（对话框没打开或已被关掉时后一段必然失败）。要彻底去掉时序依赖需让「观察未就绪」在断言窗口内可控（例如改用 `not_synced` 场景），本轮未改，已写进 `frontend/README.md` 留给下一次巡检评估。
4. **先失败截图未入库**：收尾时想重拍一张 pre-fix 截图，第一次撞短信频控（拍到的只是登录页，已删），第二次落在「轮询已停」的前置断言而非目标行（也未入库）。因此 `shots/` 里放的是逐字失败日志 `p16-before-fix-dialog-closed.log`，`frontend/README.md` 的引用已同步改到这个文件。本轮 10 张 PNG 全部由本轮通过运行重新生成。

## 收口

- `frontend/README.md`、`PROJECT_MEMORY.md`、`.trellis/spec/frontend/state-and-rendering.md` 已同步。
- 未接通的仍是未接通：本任务不涉及 DingDong 侧接口，没有把任何合成数据说成真实接入。
