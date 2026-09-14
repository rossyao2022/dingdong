# v0.3.6 验收证据

本目录是 v0.3.6「运营后台界面改版」的原始验收输出。交付说明见
[运营后台界面改版交付与验收 v0.3.6](../../OPS_CONSOLE_UI_20260914_V036.md)。
本目录**不进发布包**（`deploy/package.py` 排除 `deploy/evidence/**`），但随仓库保留以便复核。

## 文件清单

| 文件 | 内容 |
| --- | --- |
| `page-audit-before.txt` | 逐页体检 · 改版前（v0.3.5 旧界面）25 个页面 |
| `page-audit-after.txt` | 逐页体检 · 改版后（v0.3.6）同一批 25 个页面 |
| `page-audit-public.txt` | 逐页体检 · **公网入口** 25 个页面 |
| `public-browser-parent-conflict-recovery.txt` | 公网真实 Chrome：家长端冲突恢复 |
| `public-browser-ops-p1-acceptance.txt` | 公网真实 Chrome：P1 跨入口与内容身份 |
| `public-browser-ops-public.txt` | 公网真实 Chrome：运营后台回归 |
| `backend.txt` / `deployment.txt` / `ruff.txt` | 后端 237 / 部署层 9 / 静态检查 |
| `frontend-check.txt` / `frontend-unit.txt` | 前端语法检查 / 单元测试 3 项 |
| `local-browser-ops-console.txt` | 本地浏览器回归 8 项 |
| `deploy-config.txt` | 分支/提交、五处版本号、远端部署事实、迁移状态 |
| `prepare-acceptance-data.py` | 准备隔离验收数据（真实家长 API + 容器内注入失败任务） |
| `prepare-acceptance-accounts.py` | 创建本轮临时运营账号 `acpt036_*` |
| `probe-acceptance-data.py` / `probe-acceptance-data.txt` | 只读探针：圈出本轮新建的对象 |
| `cleanup-acceptance-data.py` / `cleanup-run.txt` | 验收后定向清理（只做状态变更） |

## 1. 逐页渲染体检：改版前 vs 改版后

两次运行用**同一套本地演示数据**（同一个 Postgres），只是分别由 `git worktree` 取出的
v0.3.5 源码（端口 8018）与工作区源码（端口 8017）去渲染。所以两次之间的差异只可能来自
界面代码本身，不来自数据。

工具是 `frontend/tools/ops-page-audit.mjs`（真实 Chrome，不拦截接口）。其中
**「裸控件」= 页面上没有 `form-control` / `form-select` / `form-check-input` 类的
`input` / `select` / `textarea` 数量**，也就是"没套上组件库样式、按浏览器默认外观渲染"的控件。

| 指标 | 改版前 | 改版后 |
| --- | --- | --- |
| 体检页面数 | 25 | 25 |
| **裸控件合计** | **67** | **0** |
| 含裸控件的页面数 | 18 / 25 | **0 / 25** |
| 页面标题钩子 `h1.ops-page-title` | 25 个页面全部取不到 | 25 个页面全部有 |
| 页面级 JS 错误 | 0 | 0 |
| 窄屏横向溢出 | 0px | 0px |

改版前裸控件最多的页面（改版后均归零）：

| 页面 | 改版前裸控件 |
| --- | --- |
| `11-activity-edit` 活动编辑 | 13 |
| `22-account-new` 新建后台账号 | 8 |
| `07-questionnaire-edit` 题库编辑 | 7 |
| `10-activity-new` 新建活动草稿 | 4 |
| `19-audit` 操作审计 | 4 |
| `21-account-detail` 账号详情 | 4 |

## 2. 公网逐页体检

25 个页面全部通过（23 个 200 + 重置密码页 200 + 未知路径按预期 404），裸控件 0。
控制台**只剩未知路径自身的 1 条 404 提示**。

第一次在公网跑时每个页面都有一条
`Cross-Origin-Opener-Policy header ... origin was untrustworthy` 错误，
这是本轮顺带修掉的真实缺陷（明文 HTTP 下 Django 默认发的 COOP 头无法生效），
详见交付说明第 2.4 节。本地用 `127.0.0.1` 调试看不到这条——localhost 是可信源。

## 3. 公网真实 Chrome 验收

26 项通过、18 项按视口分工跳过、**0 失败**。跳过项全部是 `desktopOnly` / `mobileOnly` 的分工
（写操作只在桌面验收，窄屏另有专项），不是被忽略的失败。

## 4. 改版前后整页截图

截图不进本目录（本仓库历史上不把 PNG 提交进 git）。存放位置：

| 状态 | 目录 | 张数 |
| --- | --- | --- |
| 改版前（v0.3.5 旧界面） | `frontend/docs/ops-before-v0.3.6/` | 22 |
| 改版后（v0.3.6 新界面） | `frontend/docs/ops/` | 22 |

两套都由 `frontend/tests/ops-screenshots.spec.js` 生成，页面清单一致（22 项，含 2 张窄屏），
文件名一一对应，可直接左右对比。`frontend/docs/**` 同样不进发布包。

## 5. 关于本轮修正的两处测试

`frontend/tests/ops-console.spec.js` 的题库与活动两例曾因引用 v0.3.3/v0.3.4 就已删除的
`#new-code` / `#new-version` 字段而失败。该失效属历史遗留（spec 最后修改于 v0.3.0），
本轮一并修正：**只改步骤，业务断言全部保留**（仍断言"标识与版本由服务端派生、
连续新建互不干扰、复制才构成同一内容的新版本"）。

## 6. 关于体检工具自身的一处修正

体检工具原先打开"重置密码"页时取账号列表第一行，而列表第一行往往是管理员；
运营后台按设计不允许重置管理员密码，于是该页返回 403 并被报成失败。
已改为按角色徽章跳过管理员与当前账号，取启用中的普通账号。
**这是工具修正，不是权限放开**——`views._modifiable` 的规则没有改动。

## 7. 运行这些脚本时的两个坑

- 凭据文件（如 `/tmp/dd-ops-creds-*.env`）用 `source` 读进来只是**shell 变量**，
  子进程（Playwright 的 worker）看不到，会导致 `fill: value: expected string, got undefined`。
  正确做法是 `set -a; source 文件; set +a`，或写成 `export`。
- 在容器里**按路径执行**脚本时（`python /tmp/x.py`），`sys.path[0]` 是脚本所在目录，
  容器里 `config` 包只在 `/app`，会报 `ModuleNotFoundError: No module named 'config'`。
  加 `-w /app -e PYTHONPATH=/app` 即可。
