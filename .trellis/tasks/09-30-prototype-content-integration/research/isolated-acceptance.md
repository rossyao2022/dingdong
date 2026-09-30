# 隔离浏览器验收环境（2026-09-30）

只在本机 PostgreSQL `127.0.0.1:55439/dingdong` 的独立 schema `prototype_integration_final_20260930`（初轮 `prototype_integration_20260930` 保留） 运行，不使用公共表、不修改生产。不删除历史验收对象。

```sh
PYTHONPATH="$PWD/.trellis/.runtime/prototype-integration:$PWD/backend" \
DJANGO_SETTINGS_MODULE=prototype_settings \
backend/.venv/bin/python backend/manage.py migrate --noinput
```

同样环境变量执行 `seed_base`、`seed_mock` 及本次原型题库导入命令。隔离 settings 保存在 `.trellis/.runtime/prototype-integration/prototype_settings.py`，短信模式为 `fixed_code`（验证码 `00000`）、供应商地址和 Key 清空，队列与媒体目录独立。不得用于生产部署。

- 后端：`runserver 127.0.0.1:8020 --noreload`（代码更改后应重启）
- 前端：`PORT=4175 BACKEND_PORT=8020 node frontend/server.cjs`
- 验收：在 `frontend/` 下执行 `E2E_BASE_URL=http://127.0.0.1:4175 ./node_modules/.bin/playwright test tests/prototype-integration.spec.js`
- 截图和临时日志：`.trellis/.runtime/prototype-integration/`

本页仅说明运行方法，不代表验收已通过。结果由实际浏览器输出及后续检查报告记录。新增 spec 一律走真实 HTTP/数据库，不拦截 API 响应；图片测试使用生成的 1px PNG，不使用真人指纹。
