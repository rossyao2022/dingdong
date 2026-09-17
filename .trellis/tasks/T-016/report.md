# T-016 报告：测评授权同意框补齐四要素

## goal

测评授权同意框补齐四要素（处理目的 / 数据范围 / 数据去向含 DingDong 侧 / 保留与撤回后果），保留「[合成测试]」标注，并点明已有「撤回授权」入口。

## 实际做了什么

只改一处：`frontend/app.js` 的 `beginAssessment()` 里 `showDialog("本次测评用途", …)` 的正文。在原有 `policy-body`（服务端 `/policies/current?purpose=assessment_processing` 的 `body`，本地为 `[合成测试]仅用于功能验证；不采集或保存真实指纹。`）之后插入一个 `.notice` 块，沿用同仓「活动准备材料」块的 `<b>标题</b><p>正文</p>` 写法，四要素文案：

- **处理目的**：生成这次测评的观察记录与报告，供你在「测评与报告」查看，并作为后续复测的对照。
- **数据范围**：孩子的问卷选择、答题时间与所用题库版本；不采集真实指纹，不采集年级。
- **数据去向**：处理在本项目服务端完成，结果保存在你的账户里；不会把孩子的测评结果或画像下发给 DingDong 侧。机器人行为观察是另一路，由本项目按你单独同意的「机器人数据同步」从 DingDong 侧获取，与测评结果分开展示、不合并成一个分数。
- **保留与撤回**：记录保留在你的账户中。可在「账户与关联 → 用途授权」点「撤回授权」停止后续处理；撤回不会自动删除已经生成的报告，需要清除已有数据请提交删除事项。

事实依据（都不是新承诺，是已有确认约束的转述）：`PROJECT_MEMORY.md`「只有 `bind` 与复测回写两个契约内写操作，不下发画像、配置或任务」「不采集、推算或保存年级」「不采集、不留存真实指纹」；`设计/数据库表结构_V0.1.md:129`「授权撤回不自动等于删除历史报告；停止后续处理、是否仍可展示既有结果、删除请求分别处理」；`设计/一期功能_API与业务闭环_V0.1.md`「DingDong 自身成长值与 CA 对儿童的画像维度分别展示；没有明确映射规则不能混为同一个分数」。撤回入口写的是导航实名（`nav` 里 `settings` = 「账户与关联」，该页有「用途授权」面板与「撤回授权」按钮）。

新增 `frontend/tests/consent-copy.spec.js`：真实 Chrome 走登录 → 建档案 → 「测评与报告」→「开始探索体验」→ 断言弹窗出现四要素标签、含 `DingDong 侧`、含 `合成测试`、含 `撤回授权` 与 `账户与关联`，桌面与 390×844 各留一张截图；窄屏额外断言把同意框滚进视口后「同意并开始」在视口内，随后真实勾选并点进第 1/4 题。

未改授权契约字段，未动 `consent` 请求体、未动政策数据、未改同步用途弹窗（不在本任务范围）。未新增 CSS（复用既有 `.notice` / `.policy-body` / `.checkline`），未引新依赖。

## 验证命令与真实输出

| 命令 | 输出（原样） |
| --- | --- |
| 实现前 `npx playwright test tests/consent-copy.spec.js --reporter=list` | `1 failed`；`Error: expect(locator).toBeVisible() failed` / `Locator: locator('#dialog').getByText('处理目的', { exact: true })` / `Error: element(s) not found`（`tests/consent-copy.spec.js:48`） |
| 实现后同命令 | `1 passed (8.7s)` |
| 补窄屏断言后 `npx playwright test tests/consent-copy.spec.js tests/quiz-last-button.spec.js --reporter=list` | `2 passed (20.3s)`（`consent-copy` `1 passed (6.5s)`、回归 `quiz-last-button` `1 passed (13.1s)`） |
| `npm run check` | exit 0（`node --check app.js && node --check api.js && node --check playworld.js && node --check server.cjs`） |
| `npm run test:unit` | `tests 16` / `pass 16` / `fail 0` / `duration_ms 71.056667` |
| `python3 scripts/audit_documents.py` | `{"markdown_files": 80, "local_links_checked": 497, "archived_files_checked": 85, "operations": 55, "schemas": 65, "errors": []}` |

截图：`.trellis/tasks/T-016/shots/t016-consent-desktop.png`（1280×720）、`t016-consent-mobile.png`（390×844，弹窗顶部）、`t016-consent-mobile-bottom.png`（390×844，弹窗内滚动到底部，同意框与「同意并开始」可见）。窄屏下弹窗正文超过一屏，靠 `client.css` 里 `dialog { max-height: 90dvh; overflow: auto }` 内部滚动，用例实测可滚到并点中。

## 未验证项

- 未复跑 `frontend/tests/flows.spec.js`：该 spec 本地有 3 项已知数据漂移失败（backlog S-05，T-018 未做），跑它无法区分产品问题与环境漂移；本任务只改弹窗文案，回归用同一条弹窗路径的 `quiz-last-button.spec.js` 覆盖。
- 未在真实手机硬件上验收（与仓库既有口径一致：桌面与 390×844 视口已测）。
- 「机器人数据同步」用途弹窗（`linkRobot()`）未改，未验证其信息量——不在本任务 goal 内。
- 未验证运营后台是否也有同款同意文案（运营端不面向家长，本任务只改家长端）。

## 偏离与理由

无偏离。acceptance 要求「真实 Chrome 打开测评同意框截图」→ 截图 3 张；未额外扩大范围（没顺手改同步用途弹窗，也没把四要素做成后端政策正文——本地库已有 `test-v1` 政策行，改种子正文不会回填已有行，且政策正文属服务端内容，改它会牵动版本/摘要语义，超出「文案 + 模板」档位）。
