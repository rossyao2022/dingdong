# T-017 报告：产品内加一行授权血缘来源声明（G-02）

## goal
家长端产品内（页脚或「家长支持」）加一行来源与使用声明：沿用参考项目 `d754a5bf9ea8e71ca64a850d2e26aa321fe8ab38` 的视觉与插画及许可范围，措辞与 `frontend/README.md` 一致。

## 实际做了什么
1. 先写失败用例 `frontend/tests/source-credit.spec.js`：登录建档案 → 进「家长支持」页 → 断言 `[data-source-credit]` 可见、含 README 里那个参考提交 sha（sha 从 `frontend/README.md` 现读，不写死）、含「视觉布局 / 插画 / 业务逻辑 / 未修改」；桌面与 390×844 截图到 `.trellis/tasks/T-017/shots/`；移动端滚到底再断言声明不被 fixed 底部导航压住。
2. 改 `frontend/app.js`：新增 `SOURCE_CREDIT` 常量，内容为「界面沿用参考项目 d754a5bf9ea8e71ca64a850d2e26aa321fe8ab38 的兴趣岛、伙伴插画与视觉布局；业务逻辑为本项目实现，参考项目未修改。」，在 `route === "services"` 分支的两张卡片之后渲染为 `<p class="note" data-source-credit>`。

## 验证命令与真实输出
- 改前 `npx playwright test tests/source-credit.spec.js --reporter=list`：`1 failed`，`Error: expect(locator).toBeVisible() failed / Locator: locator('[data-source-credit]') / Error: element(s) not found`
- 改后同命令：`1 passed (8.2s)`
- 回归巡检（临时用例 `tests/tmp-route-smoke.spec.js`，跑完已删除）：`1 passed (6.7s)`——7 个路由（explore/home/journey/reports/companion/settings/services）都渲染出各自标题、`#main` 无「暂时无法读取这一页」与「没有找到这个页面」，`[data-source-credit]` 只在 services 页出现（其余 6 页 `toHaveCount(0)`）
- `npx playwright test tests/ca-account.spec.js tests/robot-label.spec.js --reporter=list`：`9 passed (1.1m)`
- `cd frontend && npm run check`：通过（`node --check app.js && api.js && playworld.js && server.cjs`，无报错）
- `cd frontend && npm run test:unit`：`tests 16 / pass 16 / fail 0 / duration_ms 75.833209`
- `python3 scripts/audit_documents.py`：`{"markdown_files": 80, "local_links_checked": 497, "archived_files_checked": 85, "operations": 55, "schemas": 65, "errors": []}`

## 截图（真实 Chrome，本机 4173 + 8017 本地合成库）
- `.trellis/tasks/T-017/shots/services-desktop.png`：桌面「家长支持」页，声明在两张卡片下方，页脚原有「记录保存于账户 · 测评与机器人数据为合成样例」不变
- `.trellis/tasks/T-017/shots/services-mobile-390x844.png`：390×844 全页
- `.trellis/tasks/T-017/shots/services-mobile-390x844-bottom.png`：滚到底，声明完整可见、未被底部导航遮挡（用例内已用 boundingBox 断言 `box.y + box.height <= nav.y`）

## 未验证项
- 未在页脚另加一行（goal 允许「页脚或家长支持」二选一，本轮选了「家长支持」页）。
- 参考仓库无 LICENSE 文件（`参考代码/dingdong/` 下无 licen*/copying/notice），因此声明不写具体许可条款，只写沿用范围与「参考项目未修改」，与 `frontend/README.md` 第 3 行一致；未做任何法律判断。
- 未跑 `tests/flows.spec.js`（该文件本地有已知数据漂移失败，属 T-018 范围）。

## 回归检查时的一个附带发现（不在本任务范围，未改动）
跑 `tests/ca-account.spec.js` 会重写 `.trellis/tasks/T-012/shots/` 下 3 张截图，且与已入库版本不一致（`account-row-desktop.png` 144227→141875 字节等）。核对过不是本轮改动造成的：把 `frontend/app.js` 暂存回 HEAD 版再渲染，三张图的 md5 与改动后完全一致（`86c0bf6b…` / `313b08f2…` / `8f63c2ee…`，两次连续渲染也一致）。即 T-012 入库的截图相对当前代码已经过期，成因在 T-012 之后的提交里。本轮已 `git checkout -- .trellis/tasks/T-012/shots/` 还原，未把这批无关二进制改动带进 T-017 提交。

## 偏离与理由
- 无偏离。未动素材、许可文件与 `frontend/README.md`；未引入新依赖。

## 本轮新建的合成数据
- 用例每次运行会新建 1 个测试家长账户 + 1 个儿童（姓名「来源声明合成儿童」），走本地合成库 `config.settings.local`，供清理参考。
