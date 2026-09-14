# v0.3.6 验收证据（本地部分）

本目录是 v0.3.6「运营后台界面改版」的**本地**证据。公网验收证据（`public-browser-*.txt`）
在部署并跑完公网 Chrome 验收后补入同一目录。

## 1. 逐页渲染体检：改版前 vs 改版后

| 文件 | 内容 |
| --- | --- |
| `page-audit-before.txt` | 改版前（**v0.3.5 旧界面**）25 个页面的渲染结果 |
| `page-audit-after.txt` | 改版后（**v0.3.6 新界面**）同一批 25 个页面的渲染结果 |

两次运行用的是**同一套本地演示数据**：都指向本地 compose 站的同一个 Postgres，
只是分别用 `git worktree` 取出的 v0.3.5 源码（端口 8018）与工作区源码（端口 8017）去渲染。
所以两次之间的差异只可能来自界面代码本身，不来自数据。

工具是 `frontend/tools/ops-page-audit.mjs`（真实 Chrome，不拦截接口）。其中
**「裸控件」= 页面上没有 `form-control` / `form-select` / `form-check-input` 类的
`input` / `select` / `textarea` 数量**，也就是"没套上组件库样式、按浏览器默认外观渲染"的控件。

### 结果

| 指标 | 改版前 | 改版后 |
| --- | --- | --- |
| 体检页面数 | 25 | 25 |
| **裸控件合计** | **67** | **0** |
| 含裸控件的页面数 | 18 / 25 | **0 / 25** |
| 页面级 JS 错误 | 0 | 0 |
| 控制台错误 | 2（均为 25-unknown-route 自身的 404） | 2（同上，为预期） |
| 窄屏横向溢出 | 0px | 0px |
| 页面标题钩子 `h1.ops-page-title` | 全部缺失（25 个页面标题都取不到） | 25 个页面全部有标题 |

改版前裸控件最多的页面（改版后均归零）：

| 页面 | 改版前裸控件 |
| --- | --- |
| `11-activity-edit` 活动编辑 | 13 |
| `22-account-new` 新建后台账号 | 8 |
| `07-questionnaire-edit` 题库编辑 | 7 |
| `10-activity-new` 新建活动草稿 | 4 |
| `19-audit` 操作审计 | 4 |
| `21-account-detail` 账号详情 | 4 |

`25-unknown-route` 在两次运行里都标记为 `ok*`：它期望就是 404，控制台那两条
"Failed to load resource ... 404" 是这条不存在路径本身产生的，不是缺陷。

## 2. 改版前后整页截图

截图不进本目录（本仓库历史上不把 PNG 提交进 git）。存放位置：

| 状态 | 目录 | 张数 |
| --- | --- | --- |
| 改版前（v0.3.5 旧界面） | `frontend/docs/ops-before-v0.3.6/` | 22 |
| 改版后（v0.3.6 新界面） | `frontend/docs/ops/` | 22 |

两套都由 `frontend/tests/ops-screenshots.spec.js` 生成，页面清单一致（22 项，含 2 张窄屏），
文件名一一对应，可直接左右对比。`frontend/docs/**` 不进发布包。

## 3. 本地功能回归

| 套件 | 结果 |
| --- | --- |
| 后端 pytest | 237 通过 |
| 部署层 pytest（`deploy/tests`） | 8 通过 |
| 前端语法检查（`npm run check`） | 通过 |
| 前端单元测试（`npm run test:unit`） | 3 通过 |
| 本地浏览器回归（`frontend/tests/ops-console.spec.js`） | 8 通过 |
| `ruff check` / `ruff format --check --target-version py313` | 通过 / 118 文件已格式化 |

本地浏览器用例里"题库：可视化新建草稿→校验→发布→复制新版本"与"活动：维护材料、目标、风格与步骤后发布"
两例曾因引用了 v0.3.3/v0.3.4 就已删除的 `#new-code` / `#new-version` 字段而失败。
该失效属历史遗留（spec 最后修改于 v0.3.0），本轮一并修正：**只改步骤，业务断言全部保留**
（仍断言"标识与版本由服务端派生、连续新建互不干扰、复制才构成同一内容的新版本"）。
