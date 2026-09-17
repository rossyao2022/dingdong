# T-030 报告

## goal

按 `.trellis/tasks/T-020/report.md` 的注入清单（儿童/家庭/家长/关联/阶段画像/报告/后台任务）逐条以状态变更方式清理（归档/停用等既有状态字段），不物理 DELETE，处置写入审计。

## 实际做了什么

**结论：清单已逐条处置，运营端与家长端都不再把该批次显示为活跃态；处置过程写审计，并把首次写入的审计文案修成运营端可读的中文。**

1. **库内对照（处置前）**：清单 9 类对象在库内逐一确认（`before-state.txt`）。两处与清单不符，以库内实际为准并记录：清单写第 4 条后台任务为 `sync/pending`，库内实际已是 `sync/failed`（重试走完，`attempt_count=5`）；清单外另有 5 类由该批次连带产生的对象（`FamilyMembership`、`LoginGrant`、`ConsentGrant`、`ProfileObservation`，无 `CaAccount`）。
2. **处置（只改状态字段，不物理删除）**：儿童 `active→archived`、家庭 `active→closed`、家长账号 `is_active=True→False`、伙伴关联 `verified→revoked`+`ended_at`、同步游标 `enabled→paused`+`next_due_at=None`、失败任务 `failed→cancelled`+`error_code=CONSENT_REVOKED_OR_PAUSED`+`finished_at`；清单外连带对象按既有状态字段处理：`ConsentGrant.revoked_at`、`FamilyMembership.ended_at`、`LoginGrant.revoked_at`+`revoke_reason='synthetic_dispose'`。观察批次/阶段画像/阶段报告是 `ImmutableResult`（禁原地修改），无可变更状态字段，随儿童归档退出活跃视图。
3. **审计**：每条处置写一条 `AuditEvent(action="synthetic.dispose")`，并在 `ops/labels.py` 补三个中文词条（`AUDIT_ACTION["synthetic.dispose"]`、`TARGET_KIND["sync_checkpoint"]`、`TARGET_KIND["family_membership"]`），否则运营端会显示英文代码与「未知（sync_checkpoint）」。
4. **审计文案修正**：首次写库的 detail 直接拼了 Python repr（`status: 'archived'`、`datetime.datetime(...)`），运营端「说明」列被撑成长条、长 reason 被 `humanize_value` 截成「编号 T-020 合成」。修正为 `{reason: 清理注入的合成测试批次, before: 正常, after: 已归档, note?: …}`，只改 detail 文案，动作/对象/时间不动（`audit-rows-before-repair.txt` vs `audit-rows-after-repair.txt`）。
5. **续跑核对补做的部分**：上一轮处置后仍有 2 条该家长未失效的登录凭据（`aec9ff58-…`、`96563219-…`，均为上一轮 before 阶段真实 Chrome 登录产生），本轮按同一脚本回收，最终 `家长未失效登录凭据=0 条`。
6. **验收用例**：`frontend/tests/t030-batch-disposal.spec.js`（真实 Chrome，不拦截任何接口），用 `T030_PHASE=before|after` 两阶段跑同一文件：before 断言运营端仍显示活跃态、家长端能看到该儿童；after 断言首页失败任务归零、家庭「已关闭」、儿童「已归档」、关联「已撤回」、游标「已暂停」、审计页中文且无英文代码，家长端登录被拒（`账号已停用`），并回归正常家长账号不受影响。

## 验证命令与真实输出

- `cd backend && uv run python manage.py shell < ../.trellis/tasks/T-030/state_snapshot.py`
  → 处置后：`Child … status='archived'`、`Family … status='closed'`、`User … is_active=False`、`FamilyMembership ended_at=2026-09-17 13:32:26.655002+00:00`、`ExternalAssociation status='revoked'`、`SyncCheckpoint status='paused' next_due_at=None`、`BackgroundJob sync/cancelled error_code='CONSENT_REVOKED_OR_PAUSED'`、`[ops] 家庭总数(active)=233`、`[ops] 在册儿童(active)=224`、`[ops] failed_jobs=0`（处置前对应 `234 / 225 / 1`）。
- `cd backend && uv run python manage.py shell < ../.trellis/tasks/T-030/audit_rows_snapshot.py`
  → 末次：`AuditEvent(synthetic.dispose)=10`、`家长未失效登录凭据=0 条`、`家长 is_active=False`。
- `cd backend && T030_APPLY=1 uv run python manage.py shell < ../.trellis/tasks/T-030/dispose_synthetic_batch.py`（末次幂等复跑）
  → `汇总：状态变更 0 项，已是目标状态 4 项，无状态字段 3 项`、`已写库：状态变更 0 项，审计 synthetic.dispose × 0 条`。
- `cd frontend && T030_PHASE=after npx playwright test tests/t030-batch-disposal.spec.js`
  → `3 passed (13.1s)`；单条耗时 6.9s / 2.0s / 3.6s（`after-phase-final.txt`）。
- `cd backend && uv run pytest tests/test_ops_console.py` → `41 passed in 150.08s (0:02:30)`。
- `cd backend && uv run pytest tests/test_ops_audit_scope.py tests/test_ca_accounts.py` → `36 passed in 81.30s (0:01:21)`。
- `python3 scripts/audit_documents.py` → `{"markdown_files": 80, "local_links_checked": 497, "archived_files_checked": 85, "operations": 55, "schemas": 65, "errors": []}`。

证据文件（`.trellis/tasks/T-030/`）：`before-state.txt`、`after-state.txt`、`final-state.txt`、`resume-state.txt`、`dispose-output.txt`、`dispose-apply-final.txt`、`repair-dryrun.txt`、`audit-repair-apply.txt`、`audit-rows-before-repair.txt`、`audit-rows-after-repair.txt`、`after-phase-run.txt`、`after-phase-rerun.txt`、`after-phase-final.txt`；截图 `shots/`：before 4 张（运营首页/家庭详情/儿童详情/家长端可见）、after 7 张（运营首页/家庭详情/儿童详情/审计页含 390×844/家长端登录被拒/正常家长回归）。

## 未验证项

- **before 阶段用例无法在处置后重跑**：数据已归档，`T030_PHASE=before` 的断言前提已不存在。before 证据是上一轮 21:32 那次真实 Chrome 运行的 4 张截图 + `before-state.txt`（该次运行没有留日志文件）。
- **上一轮首次写库为何漏掉 2 条登录凭据未查清**：脚本文件在上一轮 21:57 被改过（改前版本无留档），无法比对过滤条件差异。只确认现象（`audit-rows-before-repair.txt` 记录 2 条 `revoked_at=None`）与本轮已回收。
- **未跑全量后端 pytest**：只跑了引用词表/审计相关的三个文件（`test_ops_console.py` 41 passed、`test_ops_audit_scope.py` + `test_ca_accounts.py` 36 passed）。
- **未接真实短信/外部供应商**：本任务全程为本地库（`127.0.0.1/dingdong`）与本地服务，不涉及任何外部调用。

## 偏离与理由

- **审计行 detail 写库后被原地修正**：属审计记录的文案改写。理由与边界：动作、对象、时间、操作人均不动，只把 detail 换成同义中文；不改会长期污染运营端（长 repr 撑坏「说明」列、reason 被截成「编号 T-020 合成」）。修正前后逐条留在 `audit-rows-before-repair.txt` / `audit-rows-after-repair.txt`。
- **回收了清单外的登录凭据**：清单只列了「家长」对象，脚本按该家长所有未失效凭据处理（首轮 1 条 + 续跑 2 条，共 3 条）。理由：家长账号已停用，残留可用凭据与该批次「不再活跃」的验收相冲突。
- **家长账号停用不单列审计行**：`TARGET_KIND["app_user"]` 的词条是「工作人员账号」，对家长账号是错的对象类型，改词表会牵连既有工作人员审计。故只改 `is_active` 并记入本报告与儿童行的 detail。
- **验收用例放在 `frontend/tests/`**：Playwright 需要 `frontend/node_modules`，放任务目录跑不起来（文件头注释已写明）。
- **脚本放在任务目录而非产品代码里**：属一次性运维动作，不进后端包；`T-020` 的注入清单是唯一入口，脚本默认预演、`T030_APPLY=1` 才写库。
