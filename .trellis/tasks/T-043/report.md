# T-043 报告：人设卡学习风格说明去内部话术（P-18）

## goal

修 T-042 巡检坐实的 P-18：`frontend/app.js` 人设卡学习风格说明行「中文对照由我方按取值直译，对方 code 表确认后核对；悬停可看原始取值」写的是我方与 DingDong 之间的对接状态，家长读不懂且暴露「中文名还没跟对方对过」。改成家长能读懂的说法；「我方直译 / 对方 code 表核对」这类对接状态移出家长端（运营端与对接文档无现成落点就不新增，report 记一句话）；`title` 保留原始取值。

## 实际做了什么

- `frontend/app.js:507`（`personaBlock()` 的返回值）：说明行由
  「学习风格：认知（中文对照由我方按取值直译，对方 code 表确认后核对；悬停可看原始取值）。」
  改为
  「学习风格：认知（来自机器人服务，中文名仅供参考；悬停可看原始取值）。」
  唯一改动就是这一句的括号内文案，1 行 1 处（`git diff --stat frontend/app.js` → `1 file changed, 1 insertion(+), 1 deletion(-)`）。
- 保留不动：每个标签的 `<span title="cognitive">认知</span>`（原始取值仍在 `title`，悬停可看 code 这条不变）；后端 `learning_style_labels` 下发中文、前端不维护映射表的规矩；`:499` 的代码注释（它写的是内部事实，家长看不到）。
- 「我方直译 / 对方 code 表核对」这类对接状态**没有新增落点**：运营端（`backend/dingdong_ca/ops/`）没有人设卡，对接文档也没有对应章节，按 goal 不新增；事实留在本报告与 `.trellis/tasks/T-028/dingdong-clarifications.md` 确认级 C6（对方 code 表尚未确认）。
- 新增真实 Chrome 用例 `frontend/tests/t043-persona-copy.spec.js`（先写用例、先失败、再改代码）。
- 收口文档：`frontend/README.md` 的 C2「文案纪律」一行补上「家长端只说『来自机器人服务，中文名仅供参考』」；`PROJECT_MEMORY.md` 更新最近一轮（T-041 段落降为「上一轮」）。
- 未动契约（`openapi.json`）、未动数据模型、未加迁移、未动后端代码。

## 验证命令与真实输出

先失败（改代码之前，`npx playwright test tests/t043-persona-copy.spec.js --reporter=list`）：

```
    Error: expect(locator).toContainText(expected) failed

    Locator: locator('.companion-persona')
    Expected substring: "仅供参考"
    Received string:    "Newton科学科学探索陪学伙伴匹配度73 / 100匹配度是机器人服务按孩子的互动给出的（0–100），不是天赋分或能力分。学习风格：认知（中文对照由我方按取值直译，对方 code 表确认后核对；悬停可看原始取值）。绑定于 2026/09/01 02:05 · 权重版本 v1"
  1 failed
```

逐字日志：`.trellis/tasks/T-043/p18-before-fix.log`；失败当帧截图：`.trellis/tasks/T-043/shots/p18-before-fix.png`。

修复后（同命令）：

```
  ✓  1 tests/t043-persona-copy.spec.js:113:1 › 人设卡学习风格说明是家长话术（P-18） (28.2s)

  1 passed (28.9s)
```

该用例断言：人设卡含「学习风格：认知」与「仅供参考」；`span[title="cognitive"]` 的文本为「认知」；人设卡文本与整页 `document.body.innerText` 都不含「我方」「对方 code 表」「确认后核对」「直译」；390×844 下文案仍在且 `scrollWidth - innerWidth ≤ 1`；`pageerror` 为空。截图 4 张：`shots/p18-persona-copy-desktop.png`、`shots/p18-reports-desktop.png`、`shots/p18-persona-copy-mobile.png`、`shots/p18-reports-mobile.png`（逐张看过）。

前端检查：

```
> dingdong-parent@0.3.6 check
> node --check app.js && node --check api.js && node --check ca-link.js && node --check companion.js && node --check growth-cycle.js && node --check reassessment.js && node --check playworld.js && node --check server.cjs

CHECK_EXIT=0
```

ℹ tests 67
ℹ pass 67
ℹ fail 0
```

（`npm run check` exit 0；`npm run test:unit` `67 pass / 0 fail`，与改动前同一批用例，本任务未新增单测——改动是一句渲染文案，判定逻辑没有分支。）

文档审计：

```
{"markdown_files": 83, "local_links_checked": 518, "archived_files_checked": 85, "operations": 61, "schemas": 83, "errors": []}
```

## 回归（三轮都没跑绿，已归因，非本轮改动引起）

`cd frontend && npx playwright test tests/companion-panel.spec.js tests/t038-copy-and-format.spec.js --reporter=list`

| 轮次 | 结果 | 失败点 |
| --- | --- | --- |
| 第 1 轮（修复后） | `2 passed / 3 failed (3.7m)` | `companion-panel` 登录后等「建立儿童档案」5s 超时；`t038` 重载后等 `#window-form` 5s 超时；`t038` 空态用例登录后等标题 5s 超时 |
| 第 2 轮（修复后复跑） | `1 passed / 4 failed (2.2m)` | 同上（多一项 `companion-panel` 的 390×844 用例，同样停在登录标题） |
| 第 3 轮（**归因实验**：`git stash push -- frontend/app.js` 回到改动前版本） | `2 passed / 3 failed (1.8m)` | 同一批等待点（登录标题 ×2、`#window-form`） |

日志：`.trellis/tasks/T-043/regression.log`、`regression-rerun.log`、`regression-prefix-app.log`。

结论依据：①三条失败全部落在用例自己的 5 秒默认等待上（页面就绪），没有一条落在内容断言；②把 `app.js` 换回改动前版本后失败点与数量一致，恢复后 `grep` 校验「来自机器人服务，中文名仅供参考」仍在、`git diff --stat frontend/app.js` 仍是 1 行改动；③同期实测本机后端延迟波动大：`GET /api/v1/policies/current` 连续两次 `0.97s` / `4.54s`，`load average 3.96`（Playwright 与本地 worker/beat 同时在跑）。⇒ 失败属本机当前偏慢、既有用例等待窗口不够，与本轮一句文案改动无关。

**未跑绿的既有用例我没有改它们的超时**（不属本任务范围，改了会掩盖环境问题）；`companion-panel.spec.js` 与 `t038-copy-and-format.spec.js` 里对本轮改动点的断言（「学习风格：认知」前缀、正文无裸 `imitation/open/reverse/cognitive`）与新用例断言同一件事，新用例本轮真跑过并通过。

回归跑脏了别人任务目录下的截图（`.trellis/tasks/T-033/shots/reassess-mobile.png`、`.trellis/tasks/T-038/shots/o06-families.png`、`o07-dashboard.png`），已按 `.trellis/spec/frontend/testing-and-acceptance.md` 的约定 `git checkout --` 复原，未混进本轮提交。

## 未验证项

- 真源模式（`CA_DISPLAY_DATA_SOURCE=dingdong`）与生产：本任务只改一句前端文案，两条路径渲染同一段 HTML，未实跑。
- `frontend/deployment-tests/*`：按 `playwright.public.config.js` 打公网入口、需管理员凭据、会在生产库写数据，属权限边界外。
- `companion-panel.spec.js` / `t038-copy-and-format.spec.js` 本轮未跑绿（原因见上）。
- 运营端与对接文档没有新增落点这件事，只按仓库现状核对（`grep` 人设卡相关文案只命中 `frontend/`），未逐一通读全部运营模板。

## 偏离与理由

1. **新用例的等待窗口比同类 spec 宽**：`login()`、`bindRobot()`、`grantSync()`、`openReports()` 里的就绪等待用 20s（既有 spec 用 5s 默认值）。理由是本机当前后端首次请求实测 3–5s（同上），5s 窗口会随机失败；这些等待是前置条件而非被测行为，放宽不削弱断言。
2. **`grantSync()` 的完成判据改成「核验请求成功 + 重载后关联区块以『已核验 · 』开头」**：原写法等 `已核验 · 同步已启用` 字样，而核验成功后页面先给「归属核验成功，正在等待同步结果。」这类过渡说法，同步状态由后台推进，等待字样会随机超时（本任务第二轮实测撞到）。改成等真实 POST 返回 `ok` 再重载，断言关联已建立（`已核验 · ` 前缀与同步到哪一步无关）。
3. **同页之外的一处同类话术未动**：`frontend/app.js:979`（`#settings` 机器人账户说明）有「号由我方生成，对方只做不透明保存。」。T-042 巡检没有报它，T-043 的 goal 与 acceptance 都只指人设卡（`#reports`），本轮不动；已在 `PROJECT_MEMORY.md` 与报告里写明，交后续巡检判断。
4. **没有把「我方直译 / 对方 code 表」写进运营端或对接文档**：goal 允许「无现成落点就不新增」，实际核对后确实没有落点（对接文档 T-028 清单的 C6 已覆盖 code 表未确认这件事），故只在本报告记录。
