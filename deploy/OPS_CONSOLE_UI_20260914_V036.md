# 运营后台界面改版交付与验收 · v0.3.6

- 日期：2026-09-14（Asia/Shanghai）
- 分支 `codex/release-v0.3.6`，发布标识与提交见 [发布标识与版本一致性](evidence/v0.3.6/deploy-config.txt)
- 公网入口：家长端 `http://110.42.225.196/dingdong/`，运营后台 `http://110.42.225.196/ops/`，Django 后台 `http://110.42.225.196/admin/`
- 上一轮交付：[家长端档案冲突恢复交付 v0.3.5](PARENT_CONFLICT_RECOVERY_20260914.md)

## 1. 结论

运营后台从"29 个模板各写各的样式、原生控件与手写卡片混用"改为**统一的一套组件体系**，
并把"改完看不见效果"的真实原因（静态资源缓存）一并消除。

公网真实 Chrome 验收 **26 项通过、18 项按视口分工跳过、0 失败**；
逐页渲染体检 **25 个页面全部通过，"裸控件"由 67 个降为 0**，页面级脚本错误 0；
后端 237 项、部署层 9 项、前端单测 3 项、本地浏览器 8 项全部通过。

本轮**没有改后端业务逻辑、家长端交互与数据库结构**（迁移仍停在 `0007`）。
界面之外只改了部署配置两处，其中一处是本轮新增工具在公网首次跑出来的真实缺陷（见 2.4）。

## 2. 逐项做了什么

### 2.1 组件体系本地化，不依赖公网 CDN

**问题**：改版前后台没有组件库，`.btn`、`.card`、`.table` 全是各页面自己写的样式，
同一个后台里不同页面的按钮圆角、表头字号、表单控件高度都不一样；原生 `input` / `select`
直接按浏览器默认外观渲染。

**修复**：把 `@tabler/core` 1.5.1 与 `@tabler/icons-webfont` 3.46.0 固定版本取下来，
落到 `backend/dingdong_ca/ops/static/ops/vendor/`，随镜像静态资源交付，页面不引用任何公网 CDN。
Tabler 的编译产物里已内含它依赖的 Bootstrap 5.3 全部组件样式与 JS（JS bundle 已含 `@popperjs/core`）。

**维护约定**（写在 `backend/dingdong_ca/ops/README.md`，后续改动请遵守）：

| 层 | 文件 | 管什么 |
| --- | --- | --- |
| 1 | `vendor/tabler/tabler.min.css` | 上游产物，**不改**；升级只换文件并更新 `THIRD_PARTY_NOTICES.md` |
| 2 | `vendor/tabler-icons/*` | 图标字体，用法 `<i class="ti ti-<name>"></i>` |
| 3 | `ops.css` | 叮咚的令牌层（`--dd-*` 与到 `--tblr-*` 的映射）、应用外壳（`ops-` 前缀）、叮咚专有组件 |

**不要再引入 Bootstrap 官方 CSS/JS**：会与 Tabler 产物重复定义同一批类名、重复绑定事件。
**要改 `.btn` / `.card` 这类通用组件的外观，改 `--tblr-*` 变量，不要重写选择器**——重写会在升级 Tabler 时静默失效。

来源、固定版本与 MIT 许可全文见 `vendor/THIRD_PARTY_NOTICES.md`。

### 2.2 共享外壳与 25 个页面统一改造

`base.html` 重建为「侧栏 + 吸顶顶栏 + 面包屑 + 页脚」的应用外壳，25 个功能页统一继承，
包含 403 与 404 页（所以侧栏与页脚在错误页也在）。新增：

- `ops/context.py`：给所有模板提供静态资源版本号与应用版本号；
- `ops/_empty.html`：统一空状态。此前每个页面各拼一套"没有数据"，改版时漏改就会露出旧样式。

导航条目补了图标（`permissions.NAVIGATION` 由四元组扩为五元组）。
**图标只做辅助识别、不替代文字标签**，取不到时退化为 `ti-point`，不影响可访问性。

页脚显示界面版本号，便于现场判断浏览器加载的是不是新界面。

### 2.3 静态资源缓存击穿（"改完看不见效果"的真实原因）

**根因**：`collectstatic` 用 Django 默认存储，静态文件 URL **不带内容哈希**——
`/static/ops/ops.css` 这个地址在改版前后完全一样。浏览器按缓存策略继续用旧文件，
运营上线后看到的还是改版前的界面。

**修复**：所有静态资源拼上 `?v={{ ops_asset_version }}`，版本一变 URL 就变，缓存自然击穿
（查询串不影响 WhiteNoise 对文件的匹配）。版本号优先读环境变量 `APP_VERSION`，
本地 `runserver` 没有该变量时回退读仓库 `VERSION`。

`deploy/compose.yml` 里 `APP_VERSION` 设为**必填**：
`APP_VERSION: ${APP_VERSION:?set APP_VERSION}`——缺了直接启动失败，而不是静默降级成缓存不击穿。
`ASSET_VERSION` 在模块导入时求值一次，改 `APP_VERSION` 必须重启进程（Docker 里就是重建容器）。

### 2.4 明文 HTTP 入口不再发生效不了的 COOP 响应头（本轮新发现）

**怎么发现的**：本轮新增的逐页体检工具 `frontend/tools/ops-page-audit.mjs` 第一次在**公网入口**上跑，
每个页面的控制台都报一条错误：

```
The Cross-Origin-Opener-Policy header has been ignored, because the URL's origin was untrustworthy.
```

**根因**：Django 的 `SecurityMiddleware` 默认发 `Cross-Origin-Opener-Policy: same-origin`，
且不看请求协议；而 Chrome 只在"可信源"（https 或 localhost）上认可这个响应头。
公网演示入口是明文 HTTP，于是该头被忽略并**逐页打错误**。
本地用 `127.0.0.1` 调试时不会出现——localhost 本身就是可信源，所以这个问题只在公网可见，
这也是它一直没被发现的原因。

**修复**：和 `deployment.py` 里已有的 `COOKIE_SECURE` / `SESSION_COOKIE_SECURE` 一样按 scheme 决定，
纯 HTTP 入口设为 `None`（不发该头），将来切到 https 自动恢复。
纯 HTTP 下 COOP 本来就无法生效，去掉它不降低任何实际防护。

**先写测试再改实现**：`deploy/tests/test_settings.py` 新增
`test_plain_http_origin_omits_headers_only_honored_on_secure_origins`；
原 `test_https_origin` 一并断言 https 下仍为 `same-origin`，守住"不能顺手把这个头永久关掉"。

### 2.5 修正两处失效的本地测试步骤

`frontend/tests/ops-console.spec.js` 的"题库：可视化新建草稿→校验→发布→复制新版本"与
"活动：维护材料、目标、风格与步骤后发布"两例引用了 `#new-code` / `#new-version` 字段，
而这两个字段在 v0.3.3 / v0.3.4 就已从模板移除（该 spec 最后修改于 v0.3.0），
因此一直失败。本轮**只改步骤，业务断言全部保留**——仍断言"标识与版本由服务端派生、
连续新建互不干扰、复制才构成同一内容的新版本"。

### 2.6 新增可复用的自检工具

`frontend/tools/`：`ops-page-audit.mjs`（逐页体检，25 个页面 + 窄屏，收集结构计数与错误，输出 `report.json`）、
`ops-quick-shots.mjs`（快速截图）、`README.md`（与其它测试的分工、判读要点）。
`.dockerignore` 不放行该目录，因此不会进镜像。

## 3. 验收证据

### 3.1 逐页渲染体检：改版前 vs 改版后（同一套数据）

| 指标 | 改版前（v0.3.5 旧界面） | 改版后（v0.3.6） |
| --- | --- | --- |
| 体检页面数 | 25 | 25 |
| **裸控件合计** | **67**（18/25 个页面有） | **0** |
| 页面级 JS 错误 | 0 | 0 |
| 页面标题钩子 | 25 个页面全部缺失 | 25 个页面全部有 |
| 窄屏横向溢出 | 0px | 0px |

对照方式：**同一套本地演示数据**（同一个 Postgres），分别由 `git worktree` 取出的 v0.3.5 源码
（端口 8018）与工作区源码（端口 8017）渲染，所以差异只可能来自界面代码本身。
原始输出：[改版前](evidence/v0.3.6/page-audit-before.txt)、[改版后](evidence/v0.3.6/page-audit-after.txt)。

改版前裸控件最多的页面（改版后均归零）：活动编辑 13、新建后台账号 8、题库编辑 7、
新建活动草稿 4、操作审计 4、账号详情 4。

### 3.2 公网入口逐页体检

25 个页面全部通过（23 个 200 + 重置密码页 200 + 未知路径按预期 404），**裸控件 0**，
控制台只剩未知路径自身的 1 条 404 提示。原始输出：[公网逐页体检](evidence/v0.3.6/page-audit-public.txt)。

> 关于 403：运营后台按设计**不允许**重置自己、超级管理员与其他管理员的密码
> （`views._modifiable`，与 `/api/v1/staff/users` 的保护一致）。体检工具原先取列表第一行
> （往往正好是管理员）去打开重置页，会把"设计如此"报成失败；已改为按角色徽章跳过管理员，
> 取启用中的普通账号。这是工具修正，不是权限放开。

### 3.3 公网真实 Chrome 验收

| 套件 | 通过 | 跳过 | 失败 | 原始输出 |
| --- | --- | --- | --- | --- |
| `parent-conflict-recovery.spec.js` | 5 | 5 | 0 | [日志](evidence/v0.3.6/public-browser-parent-conflict-recovery.txt) |
| `ops-p1-acceptance.spec.js` | 6 | 6 | 0 | [日志](evidence/v0.3.6/public-browser-ops-p1-acceptance.txt) |
| `ops-public.spec.js` | 15 | 7 | 0 | [日志](evidence/v0.3.6/public-browser-ops-public.txt) |
| **合计** | **26** | **18** | **0** | |

- 入口是**公网真实地址**，桌面与 390×844 两个视口；`channel: chrome`，不拦截任何响应。
- 跳过项全部是 `desktopOnly` / `mobileOnly` 的视口分工（写操作只在桌面验收，窄屏另有专项）。
- 凭据只经环境变量注入，未写入仓库。运营账号为本轮新建的 `acpt036_*`，见 3.6。

### 3.4 本地与静态验证

| 项 | 结果 | 证据 |
| --- | --- | --- |
| 后端 pytest | 237 通过 | [backend.txt](evidence/v0.3.6/backend.txt) |
| 部署层 pytest | 9 通过（较上轮 +1） | [deployment.txt](evidence/v0.3.6/deployment.txt) |
| 前端语法检查 | 通过 | [frontend-check.txt](evidence/v0.3.6/frontend-check.txt) |
| 前端单元测试 | 3 通过 | [frontend-unit.txt](evidence/v0.3.6/frontend-unit.txt) |
| 本地浏览器回归 | 8 通过 | [local-browser-ops-console.txt](evidence/v0.3.6/local-browser-ops-console.txt) |
| `ruff check` / `format --check`（显式 `py313`） | 通过 / 119 文件已格式化 | [ruff.txt](evidence/v0.3.6/ruff.txt) |

### 3.5 界面视觉留档

改版前后各 22 张整页截图，页面清单与文件名一一对应，可直接左右对比：

- 改版前（v0.3.5 旧界面）：`frontend/docs/ops-before-v0.3.6/`
- 改版后（v0.3.6）：`frontend/docs/ops/`

截图不进发布包（`package.py` 排除 `**/docs/**`），也按本仓库惯例不提交进 git。

### 3.6 验收数据与清理

- 隔离对象：公网 API 真实链路建的家庭/儿童，容器内 `inject_fixture --scenario report_retry`
  注入的失败任务，以及一条 support 服务事项。脚本 [prepare-acceptance-data.py](evidence/v0.3.6/prepare-acceptance-data.py)，
  临时运营账号 [prepare-acceptance-accounts.py](evidence/v0.3.6/prepare-acceptance-accounts.py)。
- 清理**只做状态变更、不物理删除、补写审计**，[脚本](evidence/v0.3.6/cleanup-acceptance-data.py) /
  [运行结果](evidence/v0.3.6/cleanup-run.txt)：

| 项 | 清理前 | 清理后 |
| --- | --- | --- |
| 在册家庭 | 25 | **10** |
| 在册儿童 | 18 | **3** |
| 已发布题库 | 8 | **2** |
| 已发布活动 | 11 | **8** |
| 启用工作人员 | 4 | **1** |
| 启用家长账号 | 25 | **10** |
| 审计条数 | 765 | 809（本轮新写 44 条） |

归档 15 个儿童、关闭 15 个家庭、退役 8 个题库版本 + 3 个活动版本、停用 18 个账号
（`acpt036_*` 三个 + 15 个验收家长）。清理后两个入口复验仍全部 200。
**更早轮次的历史测试数据本轮未动。**

## 4. 受限与未做（请如实看待）

- **这是界面改版，不是功能新增。** 上表 26 项公网验收里，`parent-conflict-recovery` 与
  `ops-p1-acceptance` 两组验证的是 v0.3.5 / v0.3.4 已交付的冲突恢复与内容身份行为**未被本轮带坏**，
  不是本轮新做的功能。
- **后端 237 项是继承结果。** 本轮未改后端业务逻辑，测试与 v0.3.5 基线一致（237 项）；
  唯一的后端改动是 2.4 的部署设置，它新增 1 项测试（部署层 8 → 9）。
- **"裸控件 = 0" 是结构指标，不等于逐像素审美验收。** 它由真实 Chrome 的 `getComputedStyle`
  与 DOM 类名判定，能证明"所有控件都套上了组件库样式"，不能证明每张图的留白与对齐都合适；
  后者请对照 3.5 的截图。
- **未做独立第三方审计。** v0.3.3 / v0.3.4 / v0.3.5 各有独立验收报告，
  本轮**尚未**由独立于实现的一方复核。
- **HTTPS 未启用。** 公网仍是明文 HTTP，`COOKIE_SECURE` / `SESSION_COOKIE_SECURE` /
  `CSRF_COOKIE_SECURE` 因此为 `False`，本轮修掉的 COOP 也是这个前提下的产物。
  切到 HTTPS 时这几项会自动恢复为安全值，但**需要重新验收**。
- **移动端只验到 390×844。** 更窄或横屏未做专项。
- **演示环境限制不变**：短信验证码固定、测评数据来自测试输入、专业算法与实体机器人未接入。

## 5. 回滚

常规回滚目标是 **v0.3.5**（上一版，功能与数据不受本轮影响）。
本轮**无数据库迁移变更**（仍停在 `0007`），因此回滚只需换回镜像标签与 `APP_VERSION`，
不需要处理迁移残留。步骤与各层需同时还原的内容见 [回滚说明](ROLLBACK.md)。

回滚到 v0.3.5 会失去：统一组件体系、`?v=` 缓存击穿、明文入口的 COOP 静音，
以及页脚与错误页的新外壳——运营界面会立刻退回改版前的样子。

## 6. 发布标识

`VERSION`、`backend/pyproject.toml`、`backend/uv.lock`、`frontend/package.json`、
`frontend/package-lock.json`、镜像标签、Git 分支/标签、发布包统一为 **0.3.6**。
完整核对见 [发布标识与版本一致性](evidence/v0.3.6/deploy-config.txt)；
发布包自身的 sha256 写在 `deploy/evidence/v0.3.6/package-integrity.txt`（不在本文，避免自相矛盾）。
