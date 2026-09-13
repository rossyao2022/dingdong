# 运营后台公网交付与验收 · v0.3.3

日期：2026-09-13。范围：修复 [v0.3.2 独立验收](OPS_INDEPENDENT_REVIEW_20260912.md) 发现的全部问题，补齐遗漏，完成真实浏览器复验并部署到 tigery。

本文只记录**已核对的事实**，并把"已验证""受外部条件限制""未做"分开写。上一轮交付记录见 [公网交付与验收 v0.3.2](OPS_CONSOLE_DEPLOYMENT_20260912.md)。

---

## 1. 结论

独立验收的四类问题（两个 P1、两个 P2）已全部修复，并在公网真实 Chrome 上复验通过：

- 家长端：http://110.42.225.196/dingdong/
- 运营后台：**http://110.42.225.196/ops/**
- Django 后台：http://110.42.225.196/admin/

版本/镜像/分支/标签/发布包统一为 **0.3.3**。发布标识见文末第 6 节。

后端 **201 项通过**、部署配置 **8 项通过**、`ruff` 通过；公网真实 Chrome **19 项通过 / 7 项按设计跳过（桌面写操作）/ 0 失败**。

---

## 2. 逐项修复

### 2.1 P1 —— 旧页面保存不再静默覆盖（乐观并发控制）

**问题**（验收报告 P1）：保存虽然有数据库行锁，但没有检查客户端读取的版本。两人打开同一份题库，后保存者会静默覆盖先保存者的修改——日常多标签页操作就能触发。

**修复**：题库、活动、儿童档案三个可编辑对象都引入**修订号** `revision`。

| 情况 | 服务端行为 |
| --- | --- |
| 未携带修订号或格式非法 | `422 VALIDATION_ERROR`，提示刷新页面后重试 |
| 修订号与库中不一致 | `409 EDIT_CONFLICT`，带回服务端当前内容，**不写入** |
| 修订号一致 | 行内 `select_for_update` 加锁后写入，修订号 +1 |

- 代码：`ops/api.py` 的 `expected_revision` / `edit_conflict`，`questionnaire_save` / `activity_save` / `child_profile`。
- 前端：`question_editor.js` / `activity_editor.js` 读取 `data-revision`，冲突时展示 `#conflict` 区块，提供"查看差异 / 加载最新版本 / 用我的内容覆盖"三路径；**保留运营输入，不自动重试、不丢内容**。
- 迁移：`core.0007_activitycontentversion_create_request_key_and_more`，为 `QuestionnaireVersion`、`ActivityContentVersion`、`Child` 增加 `revision` 与 `create_request_key`（可空），**只加不删**。

### 2.2 P1 —— 首页不再泄露审计信息

**问题**（验收报告 P1）：内容运营打不开 `/ops/audit/`（403），但首页"最近操作"无条件查询全站最近 8 条审计，泄露儿童业务名称、操作人员等信息。

**修复**：`ops/services.py` 的 `dashboard_data(user)` 按 `has_permission(user, "audit.view")` 在**服务端**裁剪 metrics / counters / recent_audit；模板 `dashboard.html` 按 `can_view_audit` 决定是否渲染审计区块。无权限角色拿到的是空集，而不是"查出来再由前端隐藏"。

### 2.3 P2 —— 非法日期筛选不再 500

**问题**（验收报告 P2）：`/ops/audit/?start=2026-99-99` 直接返回 500，日期参数未做表单校验。

**修复**：`ops/services.py` 新增 `parse_date_filter`（严格 `YYYY-MM-DD`，`DATE_PATTERN`）/ `parse_date_range` / `parse_keyword` / `parse_int`；非法值返回中文提示并在页面保留原输入（模板 `_filter_problems.html`）。审计与列表页统一改用这些解析函数。

### 2.4 P2 —— 新建内容免填技术标识与版本号

**问题**（验收报告 P2）：新建题库/活动必须手工填写"标识"和"版本号"，标识还只能用英文数字短横线，没有默认值，缺失则无法创建。

**修复**：

- `generated_code(title, prefix)`：由业务名称派生稳定内部标识（`slugify` + sha1 截断）。同一标题必然得到同一标识，因此"重名"会落成同一内容的新版本并给出提示，而不是产生两个看起来一样的题库。
- `next_version(model, code)`：版本号 `v1/v2/...` 由系统递增；外层 `lock_code` 用 `pg_advisory_xact_lock` 按内容标识取事务级咨询锁，并发创建不会撞号。
- `request_key(data)` + `create_request_key`：新建请求带幂等键，重复提交不产生第二份内容。
- 页面 `questionnaire_new.html` / `activity_new.html` 去掉标识与版本号输入框；请求体里的 `code` / `version` 仅作为脚本可选参数保留。

### 2.5 验收脚本稳定化

验收报告指出上一轮只读回归首项失败源于"导航完成时 `window.Ops` 尚未定义"的即时断言，且后续重试受登录/连接/SSH 异常影响，不能称为全绿。本轮：

- `ops-public.spec.js` 增加 `waitOpsReady(page)`，以服务端渲染的 `data-ops-ready="1"` 作为真实就绪信号，替代脆弱的即时断言。
- 新增三个用例：双页面编辑冲突（2.1）、内容运营越权审计（2.2）、非法日期筛选（2.3）。
- 服务事项闭环用例改为只处理 `DD_OPS_SERVICE_QUERY` 指定的**隔离合成事项**，并通过"结果只剩一行"断言避免误取既有运营数据。

本轮公网验收**首次运行即 19 通过 / 0 失败**，无需重试。

### 2.6 修复过程中发现的独立问题：Python 2 语法被陈旧 `.pyc` 掩盖

修复过程中发现仓库存在 15 处、11 个文件写成 Python 2 风格的 `except A, B:`，使相关模块**无法导入**。之所以此前未被测试发现：这些源文件对应的 `.pyc` 的 mtime/size 恰好与源一致，Python 复用了旧字节码，把语法错误掩盖了。

已全部改为 `except (A, B):`，并对整个仓库做 AST 语法校验（发布包内 103 个 `.py` 文件 0 语法错误）。这既解释了部分历史"绿灯"的不可靠，也是本轮"模块能导入"这一前提的真实来源。

---

## 3. 验收证据

| 项目 | 结果 | 证据 |
| --- | --- | --- |
| 后端测试 | **201 项通过** | [backend-green.txt](evidence/v0.3.3/backend-green.txt) |
| 公网真实 Chrome 验收 | **19 通过 / 7 跳过 / 0 失败** | [public-browser.txt](evidence/v0.3.3/public-browser.txt) |
| 部署配置与 nginx 路由测试 | 8 项通过 | [deploy-config.txt](evidence/v0.3.3/deploy-config.txt) |
| `ruff check` | All checks passed | [ruff.txt](evidence/v0.3.3/ruff.txt) |
| 公网入口与版本 | 版本 `0.3.3`；`/ops/` 302 跳登录；`/ops/login/` 200；`ops.js` 含就绪标记 | [public-entry.txt](evidence/v0.3.3/public-entry.txt) |
| 发布包完整性 | SHA256 一致；103 个 `.py`；无 `.env`/evidence 泄漏；关键修复标记均在包内 | [package-integrity.txt](evidence/v0.3.3/package-integrity.txt) |

### 3.1 公网浏览器验收覆盖

用例在 `frontend/deployment-tests/ops-public.spec.js`，指向公网入口，**不拦截任何接口响应**，凭据全部来自环境变量：

1. 登录失败有提示 → 成功进入工作首页 → 退出后无法直接访问
2. 家庭按称呼查询 → 家庭详情 → 儿童详情，一页聚合真实业务数据
3. 题库：可视化新建草稿 → 校验 → 发布 → 复制新版本（**无需手填技术标识**）
4. **题库：同一草稿在两个页面编辑，旧页面保存必须报冲突且不覆盖**（2.1）
5. **内容运营进不了审计页，首页也不出现审计内容**（2.2）
6. **审计：非法日期不报 500，给出中文提示并保留输入**（2.3）
7. 活动：维护材料与步骤后发布
8. 报告：查看已生成内容，失败任务用业务语言说明并可重试
9. 服务事项：筛选 → 详情 → 处理 → 历史留痕完整闭环（隔离合成事项）
10. 越权拦截：普通运营看不到技术页，也不能执行技术动作
11. 窄屏下导航与列表基本可用
12. 通用用例：HTTP 登录/档案/活动在缺少 `crypto.randomUUID` 时仍可用；Django 后台 CSRF 表单登录

### 3.2 真实链路证据（不是假数据）

- **报告重试**：报告任务 `63070570-3d2f-40d6-9d4f-fd7a79166608` 前 5 次尝试均为 `RENDER_FAILED`（上游渲染故障导致预算耗尽进入失败态），运营在公网"生成任务"页手动重试，**第 6 次成功（succeeded）并产出真实 `ReportVersion`**（data_origin=synthetic，sections=1）。这条路径验证了"失败原因用业务语言说明 → 重试 → 真实产出"的闭环。
- **服务事项闭环**：本轮专门创建的隔离合成事项 `fb8373aa-...`，经公网筛选 → 详情 → 填写处理说明 → 确认已处理，状态变为 `completed` 并留下审计记录。
- **儿童档案**：隔离儿童 `380eaad6-...` 经公网建档并按预期变为 `active`。

### 3.3 部署与清理事实

- tigery 部署目录 `/home/tigery/services/dingdong/releases/dingdong-v0.3.3`；容器 `api/web/worker/beat` 均为 `0.3.3`；迁移 `core.0007` 已应用。
- 部署**前**已备份数据库：`dingdong-pre-v0.3.3-20260913-062741.sql.gz`（附 SHA256）。
- `.env` 沿用主机既有密钥（已逐项校验一致），数据库与数据卷沿用，**业务数据量未变**（题库 9 / 活动 12 / 儿童 22 / 审计 185）。
- 验收后清理：本轮创建的 4 条测试内容（题库发布版 `67a5bef4`、复制草稿 `16b78506`、冲突草稿 `d119037a`、活动发布版 `c0bd3ab5`）经真实 `/ops/api/.../retire` 接口停用并留审计；3 个临时账号（`acpt0333_admin/operator/content`）已停用，并验证停用后无法登录。凭据仅存在于临时文件，未写入仓库、测试证据或项目记忆。

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

**演示边界不变**：固定验证码、fixture 集成、不接真实供应商、不采集真实指纹。

---

## 5. 回滚

见 [回滚说明](ROLLBACK.md)。常规回滚目标是 **v0.3.2**（v0.3.3 之前的可用发布）。**不要把回滚目标设成 v0.3.0 或 v0.3.1**：前者在 Docker 下 `/ops/` 打不开，后者管理员按钮会 403。`0006` / `0007` 迁移可安全保留，无需反向迁移。

---

## 6. 发布标识

- 分支：`codex/release-v0.3.3`，标签：`v0.3.3`
- 发布包：`dist/dingdong-v0.3.3.tar.gz`（附 `.sha256`，远端已校验）
- 远端目录：`/home/tigery/services/dingdong/releases/dingdong-v0.3.3`
- 包内 `RELEASE.json` 记录构建用的精确 Git 提交；`code` / `version` 等发布标识以包内 `RELEASE.json` 与 `dist/dingdong-v0.3.3.tar.gz.sha256` 为准。

版本一致性：`VERSION`、`backend/pyproject.toml`、`backend/uv.lock`、`frontend/package.json`、`frontend/package-lock.json`、镜像标签、Git 分支/标签、发布包统一为 **0.3.3**。
