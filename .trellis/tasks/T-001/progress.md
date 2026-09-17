# T-001 进度

- 阶段：Plan 完成 / Implement 完成 / Verify 完成 / Finish 进行中
- Plan：acceptance 三条 = 文件存在且 ≤10 行、四件事（启停/批门禁/看状态/加任务）各至少一条、首行 `[T-001]` 提交入库；验证方式 = `wc -l` + 人工核对四要素 + `git log` 首行。
- 改动文件：`.trellis/loop/README.md`（新建）、`.trellis/loop/queue.md`（T-001 status: todo → doing）
- 命令与结果：
  - `wc -l .trellis/loop/README.md` → `7 .trellis/loop/README.md`
  - `python3 scripts/audit_documents.py` → `{"markdown_files": 80, "local_links_checked": 497, "archived_files_checked": 85, "operations": 55, "schemas": 65, "errors": []}`
- 下一步：提交（首行 `[T-001] docs: ...`），queue.md 标 done，写 report.md 与 status.md。
