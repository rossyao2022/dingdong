# 运营后台公网交付与验收 · v0.3.4

日期：2026-09-13。范围：修复 [v0.3.3 第二轮独立验收](OPS_INDEPENDENT_REVIEW_20260913.md) 遗留的两个 P1，排查同类缺陷，完成真实浏览器复验并部署到 tigery。

本文只记录**已核对的事实**，并把"已验证""受外部条件限制""未做"分开写。上一轮交付记录见 [公网交付与验收 v0.3.3](OPS_CONSOLE_DEPLOYMENT_20260913.md)。

---

## 1. 结论

第二轮独立验收给出的结论是"暂不通过"，两个 P1 都已在 v0.3.4 修复，并在公网真实 Chrome 上复验通过：

- 家长端：http://110.42.225.196/dingdong/
- 运营后台：**http://110.42.225.196/ops/**
- Django 后台：http://110.42.225.196/admin/

版本/镜像/分支/标签/发布包统一为 **0.3.4**。发布标识见文末第 6 节。

后端 **237 项通过**（v0.3.3 为 201）、部署配置 **8 项通过**、`ruff` 通过；公网真实 Chrome **23 项通过 / 13 项按设计跳过（移动端写操作）/ 0 失败**。

修复过程中还暴露并修掉了一个只有真实浏览器才会触发的缺陷（家长端冲突恢复路径打到一个不存在的 `GET`，必然 405），见 2.3。

---

## 2. 逐项修复

### 2.1 P1-A —— 儿童档案修订号只在运营端前进

**问题**（验收报告 P1-A）：v0.3.3 给儿童档案加了修订号，但**只有运营后台在推进它**。家长在自己页面改了孩子档案后，运营手里那份旧页面仍然能保存成功并静默覆盖家长的修改。同一份档案的三个入口里只有一个受保护。

**修复**：

- `core/api/children.py`：家长 `PATCH /api/v1/children/<id>` 现在也会递增 `revision`；请求体可带 `revision`，带了且与库中不一致则返回 `409 EDIT_CONFLICT` 并带回服务端当前档案，**不落库**。`revision` 是可选字段，因此已经打开的旧页面仍能保存，但保存后运营/技术后台手里的过期页面立刻失效。
- `core/api/inputs.py`：拆出 `ChildBaseInput`，`ChildInput` 在其上增加可选 `revision`，新建用的 `ChildCreate` 不受影响。
- `core/admin.py`：Django 技术后台的 `DraftContentAdmin.save_model` 在 `change` 时用 `select_for_update` 取最新行并推进修订号，堵住绕过入口；非草稿状态直接 `PermissionDenied`。
- `frontend/app.js`：编辑档案时带上页面读到的 `revision`；命中 `409` 后重新读取最新档案并明确告知"已载入最新档案；你刚才填写的内容没有保存"，**不静默重试、不丢输入**。
- `ops/api.py`：儿童档案的冲突提示补充"可能被家长或其他同事改过"。

### 2.2 P1-B —— 不同标题退化成同一内部标识

**问题**（验收报告 P1-B）：`generated_code` 用 `slugify` 派生标识并按长度截断，**摘要被截掉了**。"ABC 观察"和"ABC 绘画"因此得到同一个 `code`，被系统当成同一份内容的不同版本；发布其中一份会把另一份停用。

**修复**：

- `ops/api.py`：`generated_code` 经 `_fit_code` 组装，**始终保留标题的 sha1 摘要**（`_title_digest` = sha1 前 12 位，`CODE_LIMIT=48`）。截断时优先砍 slug 部分，摘要一定留下。
- 新增 `unique_code(model, kind, prefix, title)`：在 `pg_advisory_xact_lock` 内取一个未被占用的标识，撞号时追加 `-2` / `-3` 后缀，**不再并入已有内容的版本序列**。
- **每次新建都是独立内容**：同名两次创建是两份互相独立的内容；要让系统认定为"同一份内容的新版本"，唯一路径是版本页的"复制为新版本"（复制沿用源 `code`，`next_version` 递增版本号）。只有这种发布才会替代该内容的旧版本。
- 题库/活动的新建页与列表页说明改为"每次新建都是独立内容，改已有题库请用复制为新版本"，避免运营按旧说明操作。
- 历史数据只读审计：线上只有 `qn-abc-mtzoqmm9`（v1/v2，均 `retired`、从未发布、无任何引用）属于多标题同 `code`，无实际影响，**不做批量重算**。

### 2.3 修复过程中发现的独立缺陷 —— 家长端冲突恢复路径必然 405

给家长端加上 `409` 冲突后，前端会去重新读取最新档案再重填。真实浏览器一跑就发现：

> 家长端 409 恢复路径请求 `GET /api/v1/children/<id>`，但该路径**只注册了 `PATCH`**，返回 `405`，被前端归一化成"请求被拒绝，请检查方法、格式和权限"。冲突提示出来了，但"读取最新档案"这条路是死的。

这是 v0.3.3 的冲突提示在真实链路上的隐性缺陷——只有真的触发冲突才会暴露。

**修复**：`child_detail` 改为 `@endpoint(["GET", "PATCH"])` 并实现 `GET`（返回该家庭范围内的序列化儿童，含 `revision`，需登录且按家庭隔离）。同步更新 `设计/API/openapi.json`（**51 个操作**，v0.3.3 为 50）与契约操作数断言。新增回归 `test_parent_conflict_recovery_reads_latest_via_detail_get` 守住这条路径。

### 2.4 同类缺陷排查

按要求对"所有写入入口"做了穷举，确认修订号在三条路径上都前进：

| 对象 | 入口 | 是否推进修订号 |
| --- | --- | :---: |
| 儿童档案 | 家长端 `PATCH /api/v1/children/<id>` | ✅ v0.3.4 新增 |
| 儿童档案 | 运营后台 `child_profile` | ✅ v0.3.3 起 |
| 儿童档案 | Django 技术后台 `save_model` | ✅ v0.3.4 新增 |
| 题库 / 活动草稿 | 运营后台 `questionnaire_save` / `activity_save` | ✅ v0.3.3 起 |
| 题库 / 活动草稿 | Django 技术后台 `save_model` | ✅ v0.3.4 新增 |

内部任务（Celery）不写这三个对象，未纳入。

### 2.5 回归测试

新增 `test_ops_child_revision.py`（12 项）、`test_ops_content_identity.py`（17 项）、`test_ops_admin_entry_revision.py`（2 项）、`test_independent_recheck.py`（2 项，复刻验收报告里的原始复现步骤）；`test_children.py` 增加详情读取与家庭隔离断言；`test_m3.py` 断言操作数为 51。

前端新增 `frontend/deployment-tests/ops-p1-acceptance.spec.js`（6 项），覆盖：

1. P1-A：家长改档 → 运营旧页面保存必须报冲突 → 加载最新后可保存
2. P1-A：运营改档 → 家长旧页面保存必须报冲突并保留输入
3. P1-B：题库标题相近的两份内容各自独立，发布一份不停用另一份
4. P1-B：题库同名两次创建是两份独立内容
5. P1-B：复制为新版本并发布后，只替代同一题库的旧版本
6. P1-B：活动标题相近的两份内容各自独立

### 2.6 一个工具链坑：`ruff format` 在 `py314` 目标下的误报

`ruff format --target-version py314`（0.16.7，当前最新）会把合法的 `except (A, B):` 改写成 Python 2 语法的 `except A, B:`，**改完文件无法导入**。复核时显式指定 `--target-version py313` 后确认：9 个文件属于该误报（保持不动），8 个文件是上一轮我自己提交时留下的真实格式偏差，已按 `py313` 统一。这是一条要写进工作流备忘的坑，否则下一轮会有人"顺手格式化"把仓库改成不能导入的状态。

---

## 3. 验收证据

| 项目 | 结果 | 证据 |
| --- | --- | --- |
| 后端测试 | **237 项通过** | [backend-green.txt](evidence/v0.3.4/backend-green.txt) |
| 公网真实 Chrome 验收 | **23 通过 / 13 跳过 / 0 失败** | [public-browser.txt](evidence/v0.3.4/public-browser.txt) |
| 部署配置与 nginx 路由测试 | 8 项通过 | [deploy-config.txt](evidence/v0.3.4/deploy-config.txt) |
| 前端语法检查 | 4 个入口脚本通过 | [frontend-check.txt](evidence/v0.3.4/frontend-check.txt) |
| 前端单元测试 | 3 项通过 | [frontend-unit.txt](evidence/v0.3.4/frontend-unit.txt) |
| `ruff check` / `format` | All checks passed（116 文件已格式化） | [ruff.txt](evidence/v0.3.4/ruff.txt) |
| 隔离验收数据 | 账号/儿童/关联/服务事项/失败任务全部就绪 | [isolated-data.json](evidence/v0.3.4/isolated-data.json) |
| 本地部署前浏览器验收 | P1 专项 6/6；`ops-public` 20 通过 / 1 失败（环境无数据）/ 1 跳过 | [review-v0.3.4/](evidence/review-v0.3.4/) |
| 验收后清理 | 公网 28 家庭 / 28 儿童 / 21 版本 / 31 账号，本地 13 家庭 / 12 儿童 / 46 版本 / 16 账号 | [acceptance-cleanup.md](evidence/v0.3.4/acceptance-cleanup.md) |

### 3.1 公网浏览器验收覆盖

用例在 `frontend/deployment-tests/`，指向公网入口，**不拦截任何接口响应**，凭据全部来自环境变量：

1. 登录失败有提示 → 成功进入工作首页 → 退出后无法直接访问
2. 家庭按称呼查询 → 家庭详情 → 儿童详情，一页聚合真实业务数据
3. 题库：可视化新建草稿 → 校验 → 发布 → 复制新版本（**无需手填技术标识**）
4. 题库：同一草稿在两个页面编辑，旧页面保存必须报冲突且不覆盖
5. **P1-A 家长改档 → 运营旧页面保存报冲突 → 加载最新后可保存**
6. **P1-A 运营改档 → 家长旧页面保存报冲突并保留输入**
7. **P1-B 题库标题相近两份独立、发布一份不停用另一份**
8. **P1-B 题库同名两次创建是两份独立内容**
9. **P1-B 题库复制新版本并发布只替代同题库旧版本**
10. **P1-B 活动标题相近两份独立**
11. 内容运营进不了审计页，首页也不出现审计内容
12. 审计：非法日期不报 500，给出中文提示并保留输入
13. 活动：维护材料与步骤后发布
14. 报告：查看已生成内容，失败任务用业务语言说明并可重试
15. 服务事项：筛选 → 详情 → 处理 → 历史留痕完整闭环
16. 越权拦截：普通运营看不到技术页，也不能执行技术动作
17. 窄屏下导航与列表基本可用
18. 通用用例：HTTP 登录/档案/活动在缺少 `crypto.randomUUID` 时仍可用

移动端视口下 13 项写操作用例按设计跳过（`test.skip`），与 v0.3.3 相同口径。

### 3.2 真实链路证据（不是假数据）

- **报告重试**：`deploy/evidence/v0.3.4/prepare-acceptance-data.py` 通过**真实家长 API** 建隔离账号与儿童，再在容器内注入合成失败任务。任务 `9557b88a-7736-4aec-8988-4d05ca05e481` 前 5 次尝试均为 `RENDER_FAILED`，运营在公网"生成任务"页手动重试，**第 6 次成功（succeeded）并产出真实 `ReportVersion`**（`ReportVersion` 3 → 4）。`JobAttempt` 序列完整。
- **伙伴关联与服务事项**：隔离关联 `a92d58b7-089f-49ea-8df5-8801a4567ec5` 状态 `verified`；服务事项 `81d8ac36-6b5e-4adc-9378-241203c26f7d` 经公网筛选 → 详情 → 处理闭环。
- **儿童档案**：隔离儿童 `f2fea2b2-7a8c-4d64-ac20-3d9499e2c7f2`（`P1验收隔离儿童192347`）由真实家长 API 建档。
- **P1 专项的跨入口数据**由浏览器用例现场创建，不预置。

### 3.3 部署事实

- tigery 部署目录 `/home/tigery/services/dingdong/releases/dingdong-v0.3.4`；镜像 `dingdong-backend:0.3.4` / `dingdong-web:0.3.4`，`api/web/worker/beat` 全部 healthy。
- 部署**前**已备份数据库：`dingdong-pre-v0.3.4-20260913-112015.sql.gz`，SHA256 `f6b23b15259705d14a422d24d06815f9892ca0d349f3a8c24908039aead08194`。
- `.env` 沿用主机既有密钥与数据卷，仅把 `APP_VERSION` 改为 `0.3.4`（已逐项核对）。
- 数据保全：迁移只加不删；`docker compose up -d --build --wait` 后容器 `RestartCount=0`。
- 入口复验：公网 `/dingdong/ /ops/login/ /admin/login/ /api/v1/runtime` 全部 200；Tailscale 内网 `100.115.66.119:18080` 的 `/`、`/ops/login/`、`/api/v1/runtime` 全部 200。

### 3.4 验收后清理

临时账号与合成测试内容已按"只做状态变更、不物理删除"的方式清理，并补写审计。清理前后的完整数字、脚本与残留说明见 [acceptance-cleanup.md](evidence/v0.3.4/acceptance-cleanup.md)。

摘要（公网）：正常家庭 38 → 10、在册儿童 31 → 3、已发布题库 10 → 2、已发布活动 13 → 8、启用工作人员 4 → 1、审计 339 → 419。清理后两组入口复验仍全部 200。

**未物理删除任何记录**：测试家庭仍可在运营端"家庭查询"里按关键词检索到（儿童显示为"已归档"）。这是刻意取舍——保留可追溯性优先于清理彻底性。

---

## 4. 受外部条件限制 / 未做

| 能力 | 现状 | 限制 |
| --- | --- | --- |
| 短信验证码 | 保留真实挑战、限频、消费、JWT 与权限流程 | 验证码固定为 `00000`，未接真实短信通道 |
| 伙伴数据同步 | 凭据核验、CA 主动同步、修订去重、授权撤回完整实现 | 数据来源是数据库 fixture，不是真实供应商联调 |
| 指纹采集 | 五张确定性合成 PNG，有界内存处理 | 不采集、不留存真实指纹 |
| 报告专业结论 | 展示真实答卷选择与题库来源 | 专业量表与评分解释待甲方确认，页面明确标注"未提供" |
| 运营账号数据分片 | 未做 | 后台是全量内部工具，不做按运营分片 |
| 真实手机硬件验收 | 未做 | 只测了桌面与 390×844 视口，不能称为真机验收 |
| 移动端 App / 消息推送 | 未做 | 不在本次范围 |
| 历史同 `code` 内容重算 | 未做 | 只读审计确认唯一一条历史脏数据无引用、无发布，重算风险大于收益 |

**本地环境已验证但有差异**：`ops-public.spec.js` 本地跑出 20 通过 / 1 失败 / 1 跳过。失败项是"报告"用例——本地演示库在 `compose up` 时重新执行 seed，`ReportVersion` 与 `BackgroundJob` 均为 0，报告列表没有可查看的行，属环境数据为空而非产品缺陷；该项已在公网（有真实报告与真实失败任务）通过。`http-profile.spec.js` 本地无法运行：它断言 `window.isSecureContext === false`，而 Chromium 把 `127.0.0.1` 视为安全上下文，只有真实 HTTP 公网入口才成立。

**演示边界不变**：固定验证码、fixture 集成、不接真实供应商、不采集真实指纹。

---

## 5. 回滚

见 [回滚说明](ROLLBACK.md)。常规回滚目标是 **v0.3.3**（v0.3.4 之前的可用发布）。**不要把回滚目标设成 v0.3.0 或 v0.3.1**：前者在 Docker 下 `/ops/` 打不开，后者管理员按钮会 403；也**不要回滚到 v0.3.2 及更早**，那会同时丢掉并发保护与内容标识修复。`0006` / `0007` 迁移可安全保留，无需反向迁移。

---

## 6. 发布标识

- 分支：`codex/release-v0.3.4`，标签：`v0.3.4`（指向 `9717702`）
- 发布包：`dist/dingdong-v0.3.4.tar.gz`（附 `.sha256`，远端已 `sha256sum -c` 校验通过）。具体哈希值、泄漏检查与远端同步事实记录在 [package-integrity.txt](evidence/v0.3.4/package-integrity.txt) —— **不写进本文件**，避免"包内文档记录自身哈希"的自相矛盾。
- 远端目录：`/home/tigery/services/dingdong/releases/dingdong-v0.3.4`（compose 工作目录是其下的 `deploy/`）
- 包内 `RELEASE.json` 记录构建用的精确 Git 提交；`code` / `version` 等发布标识以包内 `RELEASE.json` 与 `dist/dingdong-v0.3.4.tar.gz.sha256` 为准。

版本一致性：`VERSION`、`backend/pyproject.toml`、`backend/uv.lock`、`frontend/package.json`、`frontend/package-lock.json`、镜像标签、Git 分支/标签、发布包统一为 **0.3.4**。

> 本次发布包只包含 `VERSION` / `.dockerignore` / `backend` / `frontend` / `deploy`（排除 `**/docs/**` 与 `deploy/evidence/**`）。v0.3.4 冻结后的改动全部落在文档与验收证据上，**运行代码与镜像未变**，因此没有重建镜像，远端只做了覆盖解包（`.env` 不在包内、未被覆盖）。包内 `.py` 由 103 增至 107，新增的 4 个都是 `backend/tests/` 下的回归用例。
