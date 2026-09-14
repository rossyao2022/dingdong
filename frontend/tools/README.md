# 前端自检工具

开发期工具。它们随仓库与发布包归档（和 `frontend/tests/` 一样，`deploy/package.py` 按 `git ls-files`
打包），但**不会进镜像**：`.dockerignore` 只放行 `frontend/index.html`、`frontend/*.js`、`frontend/*.css`
与 `frontend/assets/`，所以这些脚本不会出现在容器里，也不参与运行。

脚本需要后端已在 `127.0.0.1:8017` 跑起来。先启动后端（另开一个终端）：

```sh
cd backend && env -u PYTHONPATH .venv/bin/python manage.py runserver 127.0.0.1:8017 --noreload
```

## `ops-page-audit.mjs` — 运营后台逐页体检

真实 Chrome 打开 `/ops/` 下全部 25 个页面，逐页记录标题、卡片/表格数量、**裸控件数量**
（没有 `form-control` 等组件库类的 input/select/textarea）、横向溢出，并整页截图 + 收集
页面错误与控制台错误，最后写 `report.json`。

```sh
cd frontend
OPS_USER=<运营账号> OPS_PASS=<密码> node tools/ops-page-audit.mjs /tmp/dd-audit
```

**判读**：`裸控件` 应为 0；`FAIL` 与非 `404` 的错误都要处理；`25-unknown-route` 期望就是 404（标 `ok*`）。

## `ops-quick-shots.mjs` — 快速截图

只截图，适合改一处看一眼。全站体检用上面那个。

```sh
cd frontend
OPS_USER=<运营账号> OPS_PASS=<密码> node tools/ops-quick-shots.mjs /tmp/dd-shots
```

## 与其他测试的关系

| 工具 | 作用 | 是否需要断言 |
| --- | --- | --- |
| `tools/ops-page-audit.mjs` | 全站渲染体检 + 截图 | 看输出判读 |
| `tools/ops-quick-shots.mjs` | 定点截图 | 人工看 |
| `tests/ops-console.spec.js` | 本地行为回归（8 项，写操作） | 有断言，CI 用 |
| `tests/ops-screenshots.spec.js` | 走查截图，产物 `frontend/docs/ops/` | 无断言 |
| `deployment-tests/*.spec.js` | **公网真实入口**验收（见 `deployment-tests/README`） | 有断言 |

凭据只走环境变量，**不要写进仓库或落到日志里**。
