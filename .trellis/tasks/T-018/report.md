# T-018 报告：本地 e2e 4 项数据漂移失败变成可判定

## goal

`frontend/tests/flows.spec.js`（backlog 记为 3 项）与 `frontend/deployment-tests/ops-public.spec.js`（backlog 记为 1 项）在本地要么通过、要么显式 skip 并打印原因，不再靠人分辨「产品坏了还是环境漂移」。

## 实际做了什么

### 1. `frontend/tests/support.js`（新增共用工具，未改既有 `shell()`）

- `lastLine(output)`（内部）：取 `manage.py shell` stdout 末行（首行是 `N objects imported automatically`）。
- `cliDatabaseIdentity()`：CLI 侧 Django 实际连的库标识 `host port name`。
- `cliPolicyVersionId()`：CLI 侧读到的已发布「测评数据处理」用途说明主键。

### 2. `frontend/tests/flows.spec.js`

- 新增 `test.beforeAll` 前置一致性检查：经 `server.cjs` 代理（4173 → 127.0.0.1:8017）匿名读 `/api/v1/policies/current?purpose=assessment_processing`，与 CLI 侧 `manage.py` 读同一条记录的主键比对。该主键由各自 seed 生成、逐库不同，一致即同一个库。三种失败各有独立文案：浏览器侧后端非 2xx、CLI 侧读不到该记录、两侧 id 不一致（后两者都带上 CLI 侧库标识）。
- `inject()`：捕获 `Child does not exist` 后改抛明确诊断（含 CLI 侧库标识与原始输出），其余错误原样抛出。
- 「移动端各页面、无效关联提示、资料编辑与帮助回执」用例：档案改名断言原先用 `#main` 全局 `getByText`，在严格模式下命中 3 个元素；改为限定在含「儿童档案」标题的面板内断言。

### 3. `frontend/deployment-tests/ops-public.spec.js`

- 新增 `LOCAL_ENTRY`：入口是 `127.0.0.1` / `localhost` 时为真。
- 新增 `skipLocalDataGap(condition, reason)`：命中时 `console.log` 打印原因再 `test.skip(true, reason)`。
- 「报告：查看已生成内容，失败任务用业务语言说明并可重试」用例的两处本地数据前置改为 `skipLocalDataGap`：报告列表为空、失败任务列表为空。两处都只在 `LOCAL_ENTRY` 下允许跳过，公网入口缺数据仍按失败处理。

未改产品代码、未改后端接口、未新增依赖、未动 CI。

## 验证命令与真实输出

### 改前（红）

```
cd frontend && npx playwright test tests/flows.spec.js --reporter=list
→   ✘  8 tests/flows.spec.js:359:1 › 移动端各页面、无效关联提示、资料编辑与帮助回执 (11.5s)
   Error: expect(locator).toBeVisible() failed
   Locator: locator('#main').getByText('小米的新称呼', { exact: true })
   Error: strict mode violation: … resolved to 3 elements
   1 failed
   7 passed (2.4m)
```

（原文存 `flows-red-before-fix.txt`）

```
cd frontend && DD_OPS_ADMIN_USER=… DD_OPS_ADMIN_PW=… PUBLIC_HTTP_URL=http://127.0.0.1:8017/ \
  npx playwright test --config=playwright.public.config.js ops-public.spec.js
→   6 failed / 9 skipped / 7 passed (1.1m)
```

（原文存 `ops-public-local-before-fix.txt`；该次失败含「报告」用例与三项与本任务无关的缺凭据/缺数据失败，见「未验证项」）

### 改后（绿）

```
cd frontend && npx playwright test tests/flows.spec.js --reporter=list
→   ✓  1 tests/flows.spec.js:119:1 › 真实登录、活动完成、刷新恢复、退出清理 (9.9s)
   ✓  2 tests/flows.spec.js:151:1 › 用途授权、22题、合成输入、真实初始报告 (53.0s)
   ✓  3 tests/flows.spec.js:188:1 › 机器人关联、阶段报告、撤回同步授权 (20.1s)
   ✓  4 tests/flows.spec.js:219:1 › 移动端布局、儿童切换与跨页退出 (9.0s)
   ✓  5 tests/flows.spec.js:259:1 › 家长提交删除、后台实际处理、无儿童时查看回执 (11.8s)
   ✓  6 tests/flows.spec.js:337:1 › 登录后首页小岛出发与全部菜单可点击 (6.9s)
   ✓  7 tests/flows.spec.js:364:1 › 探索四题、刷新恢复、返回修改、完成仅展示选择 (19.3s)
   ✓  8 tests/flows.spec.js:421:1 › 移动端各页面、无效关联提示、资料编辑与帮助回执 (13.6s)
   8 passed (2.4m)
```

（原文存 `flows-green-rerun.txt`，2026-09-17T12:31Z 本轮重跑，退出码 0；全篇 `grep -n 'Child does not exist'` 无命中。上一轮的 `flows-green.txt` 记的是限流那一次的 `2 failed / 6 passed (3.9m)`，文件名与内容不符，故本轮重跑重取。）

```
cd frontend && DD_OPS_ADMIN_USER=… DD_OPS_ADMIN_PW=… PUBLIC_HTTP_URL=http://127.0.0.1:8017/ \
  npx playwright test --config=playwright.public.config.js ops-public.spec.js \
  -g "报告：查看已生成内容" --project=desktop --reporter=list
→   [ops-public] 跳过：本地入口没有处于失败态的报告任务（冷启动种子不生成后台任务），本用例需要真实失败任务
   -  1 [desktop] › deployment-tests/ops-public.spec.js:379:3 › 运营后台（公网） › 报告：查看已生成内容，失败任务用业务语言说明并可重试
   1 skipped
```

（原文存 `ops-public-local-report-after-fix.txt`；本轮 2026-09-17T12:37Z 复跑同一条命令得同样结果，原文存 `ops-public-local-report-after-fix-rerun.txt`）

### 分支与常量探针（证明改动能证伪，验完已还原）

1. 「报告」用例还原原断言后重跑（当前本地库有报告行、无失败任务）：
   `1 failed`，`at ops-public.spec.js:393` → `expect(getByText('报告内容生成失败').first()).toBeVisible()` `element(s) not found`（原文存 `ops-public-local-report-red.txt`）。原代码把 `test.skip(!FAILED_JOB, …)` 放在该断言之后，本地必然先红。
2. 临时把「报告列表为空」条件强制为真 → `1 skipped`，打印
   `[ops-public] 跳过：本地入口没有已生成的报告记录（冷启动种子不生成报告），本用例需要真实报告数据`。
3. 用文件里 `LOCAL_ENTRY` 的真实表达式逐项求值：
   `undefined => false`、`http://127.0.0.1:8017/ => true`、`http://127.0.0.1:18473/ => true`、`http://localhost:8017/ => true`、`http://110.42.225.196/dingdong/ => false`、`https://ops.example.com/ => false`。
4. 临时探针调 `inject("<不存在的 uuid>", "assessment_success")`：
   `1 failed`，`Error: inject_fixture 在 CLI 侧看不到浏览器刚建的儿童 00000000-0000-4000-8000-000000000000（CLI 侧库：127.0.0.1 55439 dingdong），而浏览器那侧走 server.cjs 代理到 127.0.0.1:8017。两边不是同一个库，属本地环境漂移，不是产品缺陷。原始输出：CommandError: Child does not exist`
5. 把 CLI 侧 `DATABASE_URL` 指到同实例的 `postgres` 库（未 seed）：
   `1 failed`，`Error: 本地 e2e 前置不满足：CLI 侧 manage.py 读不到已发布用途说明（CLI 侧库：127.0.0.1 55439 postgres）。原始错误：Command failed: …`

### 其它

```
cd frontend && npm run check              → exit 0
cd frontend && npm run test:unit          → tests 16 / pass 16 / fail 0 / duration_ms 80.982666
node --check tests/flows.spec.js tests/support.js deployment-tests/ops-public.spec.js → 三个文件 exit 0
cd frontend && npx playwright test tests/audit-object-labels.spec.js --reporter=list
                                          → 1 passed (8.4s)   （support.js 使用方回归）
```

`/auth/sms` 同 IP 近 1 小时计数实测：`ip_count_1h 50`（上限 50）。改后第二次全量跑 flows 出 `2 failed / 6 passed (3.9m)`，两条都停在 `login()` 点「登录」时按钮 `disabled` 超时，属验证码限流，非本次改动。

## 未验证项

- `beforeAll` 的「两侧 id 不一致」分支未端到端跑到：需要第二个已 seed 的库，而建库要写仓库外的开发数据库服务器（`127.0.0.1:55439` 是 SSH 隧道），超权限边界，未做。
- 本地 `ops-public.spec.js` 全量跑仍有与本任务无关的失败：缺 `DD_OPS_OPERATOR_*` / `DD_OPS_CONTENT_*` 凭据（该 spec 设计上凭据走环境变量）、本地库无「验收儿童」数据。未处理，不在本任务 goal 内。
- 公网入口（`http://110.42.225.196/dingdong/`）本轮未跑：需远端凭据与域名，属 external 动作。
- 未用真实浏览器手工复核 `LOCAL_ENTRY=false` 时公网路径仍严格失败；只做了表达式求值（见探针 3）。

## 偏离与理由

1. **改前实测与 backlog S-05 的描述不一致，以磁盘为准。** backlog 记 `flows.spec.js` 本地 3 项失败、报「Child does not exist」；本轮改前实测是 `1 failed / 7 passed`，且失败原因是 strict mode violation，不是「Child does not exist」——当前两侧连的是同一个库（用途说明主键两侧一致：`c27a757c-9d20-48ff-b446-1d8400790b52`），漂移未复现。那 1 项失败是产品新增「机器人账户」区块后旧断言不再唯一（该区块由 `03f3d38` 引入，早于本批修复），产品本身正确：档案、机器人账户、绑定说明三处都显示新称呼，故只修断言、未改产品。
2. **`ops-public.spec.js` 的「报告」用例按 acceptance 的「显式 skip + 打印原因」路径处理**，未尝试让本地库产生真实报告与失败任务：本地入口的公网用例无法用 `inject_fixture` 准备远端数据，且 acceptance 明确允许 skip 分支。
3. **前置一致性用既有匿名接口，未新增接口。** `/api/v1/policies/current?purpose=assessment_processing` 是 `consents.policy`（`@endpoint(["GET"], anonymous=True)`），读一条已发布记录的主键，不改任何数据。
4. **未按 notes 的「优先做同一库」直接改 `server.cjs` 端口或 DB 配置**：实测两侧本来就是同一个库，把 `server.cjs` 改成读 env 属于没有失败场景支撑的改动，故只加了前置一致性与失败诊断。
