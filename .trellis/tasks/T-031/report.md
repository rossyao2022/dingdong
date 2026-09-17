# T-031 报告：存量 `core/api/common.py` 过 ruff format

## goal

`backend/dingdong_ca/core/api/common.py:189` 通过 `ruff format`（HEAD 上即未格式化，最后一次改动是 T-019 提交 `2c00ac1`），只做格式化不改语义。

## 实际做了什么

- 只改 1 个文件：`backend/dingdong_ca/core/api/common.py`（+5 / −3 行）。
- 唯一 hunk `@@ -186,9 +186,11 @@`（`describe_target` 内「借关联对象名字」分支）：

```diff
-            name = getattr(related, "display_name", "") or getattr(
-                related, "name", ""
-            ) or getattr(related, "username", "")
+            name = (
+                getattr(related, "display_name", "")
+                or getattr(related, "name", "")
+                or getattr(related, "username", "")
+            )
```

- 无逻辑变化：运算符、取值顺序、默认值、短路语义逐字未动，仅按 ruff 的括号换行风格重排。
- 未改测试、未改其它文件；本轮开工时磁盘上除驱动写入的 `.trellis/loop/runs.log` 外无未提交改动（T-030 的未提交文件已不存在，无需回避）。

## 验证命令与真实输出

| 命令 | 输出（原样抄） |
| --- | --- |
| `cd backend && uv run ruff format --check --target-version py313 .`（改前基线） | `unformatted: File would be reformatted --> dingdong_ca/core/api/common.py:189:20` … `1 file would be reformatted, 125 files already formatted` |
| `cd backend && uv run ruff format --target-version py313 dingdong_ca/core/api/common.py` | `1 file reformatted` |
| `cd backend && uv run ruff format --check --target-version py313 .`（改后） | `126 files already formatted`（rc=0） |
| `cd backend && uv run ruff check .` | `All checks passed!` |
| `cd backend && uv run pytest tests/test_ops_audit_scope.py tests/test_auth.py -q` | `26 passed in 58.97s` |
| `python3 scripts/audit_documents.py` | `errors: []` / `warnings: 0` |

选 `tests/test_ops_audit_scope.py` 的理由：`describe_target` 的「英文模型名（关联对象名）」写法在该文件有直接断言（第 220、260 行，正是本次被重排的那段）；`tests/test_auth.py` 覆盖同文件里 `validate` / `field_errors` / `detail_text` 等被 API 层共用的助手。

## 未验证项

- 未跑后端全量测试套件（266 项，与「只改格式」不匹配，按 spec 收尾清单「别无差别重跑」未跑）；未跑 `manage.py check` / `makemigrations --check`（本改动不涉及模型与路由）。
- 未做浏览器验证：本任务不涉及界面。

## 偏离与理由

无。acceptance 四条（ruff format --check 全绿 / `git diff` 仅格式差异 / 相关测试通过 / audit errors 空）逐条达成。

## 提交与推送

- `[T-031] chore: 存量 core/api/common.py 过 ruff format` → `bfe9dcd`（1 file changed, 5 insertions(+), 3 deletions(-)）。
- 本任务 `gate: none`，notes 标注「机制维护类：commit 后可直接 push 并补 EXECUTED 行」，按 T-026 / T-027 / T-029 同一先例执行 `git push origin codex/release-v0.3.6` → `dc54fea..bfe9dcd`，远端 sha `bfe9dcdc93c0d1488175a375288209345a9d8d56`；已在 `gates.md` 补 EXECUTED 行。

## 连带发现

- 改后全后端 `ruff format --check --target-version py313 .` 报 `126 files already formatted`，即 T-027 报告里那条「仍有 1 个未格式化文件」的连带项已由本任务销项，无新的存量格式债。
