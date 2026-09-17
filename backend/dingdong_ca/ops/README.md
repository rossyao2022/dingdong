# 运营后台（`dingdong_ca.ops`）

本应用是叮咚的运营后台，挂在**根路径 `/ops/`**（不是 `/dingdong/ops/`，原因见 `deploy/README.md`）。
面向前台家长端的代码在 `frontend/`，不在本应用内。

## 界面层怎么搭的

页面只有三层，改样式时**按职责改对应的一层**，不要越层重写。

| 顺序 | 文件 | 管什么 | 什么时候改 |
| --- | --- | --- | --- |
| 1 | `static/ops/vendor/tabler/tabler.min.css` | Tabler 1.5.1 编译产物，内含 Bootstrap 5.3 全部通用组件（`.btn` `.card` `.table` `.form-control` `.modal` `.offcanvas` `.pagination` `.empty` …） | **不要改**。升级只换整个文件，并更新 `vendor/THIRD_PARTY_NOTICES.md` 与版本号 |
| 2 | `static/ops/vendor/tabler-icons/tabler-icons.min.css` | 图标字体。用法 `<i class="ti ti-<name>"></i>` | 同上 |
| 3 | `static/ops/ops.css` | 叮咚的令牌层（`--dd-*` 与到 `--tblr-*` 的映射）、应用外壳（`ops-` 前缀）、叮咚专有组件 | 改外观改这里 |

### 三条硬约定

1. **不要再引入 Bootstrap 官方 CSS/JS。** Tabler 产物里已经打包了 Bootstrap 5.3 的 CSS 与 JS
   （JS 已内含 `@popperjs/core`）。再引一份会让同一批类名重复定义、事件重复绑定。
2. **要改 `.btn` / `.card` 这类通用组件的外观，改 `ops.css` 顶部的 `--tblr-*` 变量，不要重写选择器。**
   重写选择器会在升级 Tabler 时静默失效，而且要先跟它比权重。
3. **类名约定**：无前缀 = Tabler/Bootstrap（直接用）；`ops-` 前缀 = 叮咚自定义外壳与工具类；
   少数无前缀类名（`.timeline` `.question-card` `.step-card` `.option-row` `.kv` …）是叮咚专有组件，
   且**被验收脚本按名字引用**，改名要同步改 `frontend/tests/` 与 `frontend/deployment-tests/`。

## 静态资源版本号（改完看不见效果先查这里）

`collectstatic` 用 Django 默认存储，静态 URL 不带内容哈希——`/static/ops/ops.css` 在改版前后完全一样，
浏览器会继续用缓存里的旧文件。所以 `base.html` 里所有静态资源都拼了 `?v={{ ops_asset_version }}`。

- 版本号来源：`dingdong_ca/ops/context.py`。优先读环境变量 `APP_VERSION`（compose 注入），
  本地 `runserver` 没有该变量时回退读仓库根目录的 `VERSION`。
- 页脚显示的也是这个值（`界面版本 {{ ops_app_version }}`），**用它现场判断浏览器加载的是不是新界面**。
- compose 里 `APP_VERSION: ${APP_VERSION:?set APP_VERSION}` 是**必填**的，缺了会直接启动失败而不是静默降级。
- `ASSET_VERSION` 在模块导入时求值一次，改 `APP_VERSION` 必须重启进程才生效（Docker 里就是重建容器）。

## 权限与导航

- 权限点与角色映射在 `permissions.py` 的 `PERMISSIONS`，导航表是 `NAVIGATION`。
- 导航条目是 `(标题, 权限点, 视图名, 分组, 图标)` 五元组。**图标只做辅助识别，不替代文字标签**，
  新增条目时随便挑一个 `ti-*` 类名即可，取不到会退化成 `ti-point`。
- 新增一个页面 = 在 `urls.py` 注册 + 在 `NAVIGATION` 加一行（要出现在侧栏时）+ 模板继承 `ops/base.html`。
- 无权限访问 `/ops/` 页面渲染 `forbidden.html`（403），不存在的路径渲染 `not_found.html`（404），
  **两个页面都套 `base.html`**，所以侧栏和页脚在错误页也在。这两条由 `backend/tests/test_ops_*.py` 守住。

## 模板片段

| 片段 | 用途 |
| --- | --- |
| `_empty.html` | 统一空状态。`{% include "ops/_empty.html" with title="还没有报告" note=empty_hint %}` |
| `_pagination.html` | 列表分页 |
| `_filter_problems.html` | 筛选参数错误的提示区 |

**不要每个页面自己拼一套空状态。** 之前的版本一个页面一种写法，改版时漏改就会露出旧样式。

## 开发与自检

```sh
cd backend && env -u PYTHONPATH .venv/bin/python manage.py runserver 127.0.0.1:8017 --noreload
# 打开 http://127.0.0.1:8017/ops/login/
```

- 本地 `DEBUG=True` 时 404 走 Django 调试页而不是 `not_found.html`；要在本地看真实错误页，
  用 `override_settings(DEBUG=False, ALLOWED_HOSTS=['*'])` 包一层 `Client()` 请求，别直接开浏览器下结论。
- 浏览器回归：`cd frontend && npx playwright test tests/ops-console.spec.js`（8 项，覆盖登录、家庭/儿童、
  题库发布、活动维护、报告与任务、服务事项、越权拦截、窄屏）。
- 截图走查：`frontend/tests/ops-screenshots.spec.js`，产物落在 `frontend/docs/ops/`（该目录不进发布包）。
- 改动上游组件后跑 `python -m ruff check .` 与 `ruff format --check --target-version py313 .`
  （**必须显式 `py313`**，见 `deploy/README.md` 的工具链注意）。
