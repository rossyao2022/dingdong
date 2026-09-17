# T-027 存量测试文件过 ruff format（T-014 遗留）

## goal

`backend/tests/test_ops_audit_scope.py` 通过 `ruff format --check --target-version py313`（T-014 轮新代码已格式化、存量文件未过），只做格式化，不改断言语义。

## 实际做了什么

只改一个文件、只改一个字节级差异：文件末尾缺行尾换行。

- 改前：`ruff format --check --target-version py313 tests/test_ops_audit_scope.py` 报
  `unformatted: File would be reformatted --> tests/test_ops_audit_scope.py:275:36`（`wc -l` = 274，末行 `return reverse("ops:dashboard")` 无结尾换行）。
- 执行 `uv run ruff format --target-version py313 tests/test_ops_audit_scope.py` → `1 file reformatted`。
- `git diff` 全文：

```
diff --git a/backend/tests/test_ops_audit_scope.py b/backend/tests/test_ops_audit_scope.py
index 518062a..41d354d 100644
--- a/backend/tests/test_ops_audit_scope.py
+++ b/backend/tests/test_ops_audit_scope.py
@@ -272,4 +272,4 @@ def test_audit_object_label_translates_model_names():
 def reverse_url():
     from django.urls import reverse
 
-    return reverse("ops:dashboard")
\ No newline at end of file
+    return reverse("ops:dashboard")
```

无其它改动，断言语义未动（diff 里无任何断言行）。

## 验证命令与真实输出

| 命令 | 结果 |
| --- | --- |
| `uv run ruff format --check --target-version py313 tests/test_ops_audit_scope.py`（改前） | `1 file would be reformatted`，rc=1 |
| `uv run pytest tests/test_ops_audit_scope.py`（改前基线） | `12 passed in 49.07s`（原文 `pytest-before.txt`） |
| `uv run ruff format --target-version py313 tests/test_ops_audit_scope.py` | `1 file reformatted`，rc=0 |
| `uv run ruff format --check --target-version py313 tests/test_ops_audit_scope.py`（改后） | `1 file already formatted`，rc=0 |
| `uv run ruff check tests/test_ops_audit_scope.py` | `All checks passed!`，rc=0 |
| `uv run pytest tests/test_ops_audit_scope.py`（改后） | `12 passed in 46.87s`（原文 `pytest-after.txt`） |
| `python3 scripts/audit_documents.py` | `{"markdown_files": 80, "local_links_checked": 497, "archived_files_checked": 85, "operations": 55, "schemas": 65, "errors": []}` |
| `uv run ruff format --check --target-version py313 .`（全后端，仅取证） | `1 file would be reformatted, 125 files already formatted` |

用例数与结果在格式化前后一致（12 passed → 12 passed，耗时 49.07s → 46.87s 属正常波动）。基线数字与 T-014 轮记录的 `11 passed` 不同，是因为 T-019 轮又往该文件加过用例；本任务只与「格式化前基线」比对，未沿用历史数字。

## 未验证项

- 未跑后端全量测试：本改动是纯格式（仅行尾换行），与本任务 acceptance 无对应关系，全量约 17 分钟，不重复跑。
- 未在浏览器验证：本任务不涉及界面。

## 偏离与理由

- 无偏离。范围内只改 `backend/tests/test_ops_audit_scope.py` 一个文件。
- **连带发现（未在本轮处理）**：全后端 `ruff format --check --target-version py313 .` 仍报 1 个未格式化文件 `backend/dingdong_ca/core/api/common.py:189`（`name = getattr(...) or ...` 的换行风格），该文件在 HEAD 上即如此、工作区干净、与本次改动无关，最后一次改动它的是 T-019 提交 `2c00ac1`。T-027 的 acceptance 只覆盖 `tests/test_ops_audit_scope.py`，按「只做一个任务、范围贴住 goal」未顺手改；建议 orchestrator 另开一个存量格式化任务。
