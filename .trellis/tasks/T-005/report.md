# T-005 报告（O-01 修掉 CA 账户页跨行模板注释被当正文渲染）

## goal
修掉运营后台「CA 账户」页把跨行 `{# … #}` 注释渲染成页面正文的真缺陷（`backend/dingdong_ca/ops/templates/ops/ca_accounts.html` 第 10–11 行），改成 `{% comment %}` 或压成单行。

## 实际做了什么
1. `backend/dingdong_ca/ops/templates/ops/ca_accounts.html`：把跨行 `{# 注意：Tabler 的 .alert 是 flex 容器… #}` 改成 `{% comment %}…{% endcomment %}`（保留原文与缩进，只换标签形式）。
2. `backend/tests/test_ops_ca_accounts.py` 新增两条用例：
   - `test_page_does_not_render_template_comment_as_text`：渲染 `/ops/ca-accounts/`，断言正文不含 `{#`、不含注释原文；
   - `test_ops_templates_have_no_multiline_django_comment`：扫描 `backend/dingdong_ca/ops/templates/**/*.html`，断言不存在跨行 `{# … #}`（Django 的 `tag_re` 不带 `re.DOTALL`，跨行注释不生效）。
3. 门禁执行（本轮第 1 节）：按 `gates.md` 决定段 `APPROVE T-003 review` 把 backlog 条目导入 `queue.md` 为 T-005…T-021（第一批 13 / 第二批 3 / 第三批 1），O-05 与 G-03 未导入；T-003 `status` 改 `done`；`gates.md` 补 EXECUTED 行。

## 验证命令与真实输出（数字照抄）
- 修复前（TDD 红）`cd backend && uv run pytest tests/test_ops_ca_accounts.py -q`：
  - `2 failed, 5 passed in 27.37s`
  - `FAILED tests/test_ops_ca_accounts.py::test_ops_templates_have_no_multiline_django_comment - AssertionError: assert ['ops/ca_accounts.html:10'] == []`
  - `E assert '{#' not in '<!doctype h...>\n</html>\n'`，泄漏原文 `{# 注意：Tabler 的 .alert 是 flex 容器，散落的文本节点会各占一列。`
- 修复后 `cd backend && uv run pytest tests/test_ops_ca_accounts.py -q`：`7 passed in 28.84s`
- 相关集合 `cd backend && uv run pytest tests/test_ops_console.py tests/test_ops_ca_accounts.py -q`：`43 passed in 148.68s (0:02:28)`
- `python3 scripts/audit_documents.py`：`{"markdown_files": 80, "local_links_checked": 497, "archived_files_checked": 85, "operations": 55, "schemas": 65, "errors": []}`
- 真实 Chrome（kimi-webbridge session `dingdong-T-005`，扩展接管真实浏览器，非无头）打开 `http://127.0.0.1:8017/ops/ca-accounts/`（`admin`）：
  - `{"url":"http://127.0.0.1:8017/ops/ca-accounts/","title":"CA 账户 · 叮咚","hasComment":false,"hasCommentText":false}`，正文从「只读页 · 账户号一经生成不修改、不重用」开始，原缺陷文本已消失；
  - 截图：`.trellis/tasks/T-005/shots/ops-ca-accounts-after.jpeg`（490716 bytes）。
- 同基模板页面回归抽查（页内 `fetch`）：`/ops/ 200 leak=false | /ops/families/ 200 leak=false | /ops/audit/ 200 leak=false | /ops/accounts/ 200 leak=false`，家庭详情 `family=200`、儿童详情 `child=200 childTitle=儿童详情 · 叮咚 childLeak=false`。

## 未验证项
- 未跑 backend 全量测试套件（266 项）；本轮只跑 `test_ops_console.py` + `test_ops_ca_accounts.py` 与改动直接相关的集合。
- 未跑 frontend 检查（本轮无前端改动）。
- 未验证其它仓库（非 ops 模板）里是否存在跨行 `{# … #}`；新用例的扫描范围限定 `backend/dingdong_ca/ops/templates/`。

## 偏离与理由
- 无功能偏离。模板注释形式选 `{% comment %}`（而非压成单行）以保留原有两行排版与缩进。
- 新增的扫描用例范围只覆盖 ops 模板：backlog O-01 的现状扫描结论是「全仓仅此一处」，把范围收在 ops 模板内可避免牵连无关目录。
