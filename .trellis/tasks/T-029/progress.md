# T-029 progress

## Plan（已完成）
- 任务：刷新 `.trellis/tasks/T-008/shots/empty-credential.png`，核对截图仍满足 T-008 验收。
- 验收怎么客观验证：跑 `npx playwright test tests/ca-account.spec.js` 全绿（含该图对应的「手填绑定：空凭据就地提示，对话框不关」断言）+ 图像像素比对（弹窗正文区差异应为 0）+ 连续多次运行哈希一致（证明确变化不是靠碰运气）+ `npm run check` + `audit_documents.py` errors 空。
- 开工前置：`SmsChallenge` 近 1 小时 `client_ip=127.0.0.1` 计数 19（上限 50）；CLI 侧库 `127.0.0.1 55439 dingdong`；`127.0.0.1:8017/ops/` 返回 302、`127.0.0.1:4173/` 返回 200。

## Implement（已完成）
- 改动文件 1 个：`frontend/tests/ca-account.spec.js`（第 243-245 行新增 3 行：2 行注释 + `await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));`），在截图前固定背景滚动位置。
- 截图产物：`.trellis/tasks/T-008/shots/empty-credential.png` 由 197704 字节（HEAD 版 `3e4d692a60917c6ff1d2a4d67d761559f8519b465fd2401fa84b399b41b0f393`）刷新为 189622 字节（`46197db652aaef0275ada44ceefc5c76032eec6ea54565ce3d6fb8e976c7f6db`）。
- 未改产品代码（`frontend/app.js` 等零改动）。

## Verify（已完成）
- 改动前全量：`npx playwright test tests/ca-account.spec.js --reporter=list` → `8 passed (54.2s)`（原文 `spec-run.txt`）。
- 改动前单条连跑两次（同一份代码）：`1 passed (5.1s)` 后哈希 `3e4d692a…`/197704 字节；`1 passed (5.7s)` 后哈希 `2c1d7c6436d7a844ca87f15422d26238a218cf231ae6c21e9008d2080bbb010a`/188099 字节 → 运行间不确定（原文 `rerun-hashes.txt`）。
- 像素比对（HEAD 版 vs 188099 版）：可见差异 `rows=403 px=51299`，全部落在背景；弹窗正文区（x300-990, y90-630）差异 `0` px（原文 `diff-analysis.txt`）。
- 改动后单条连跑三次：`1 passed (5.1s)` / `1 passed (5.8s)` / `1 passed (4.8s)`，三次哈希均为 `46197db6…`、189622 字节（原文 `determinism-3runs.txt`）。
- 改动后全量：`npx playwright test tests/ca-account.spec.js --reporter=list` → `8 passed (54.3s)`，跑完截图哈希仍为 `46197db6…`（连续 4 次同字节，原文 `spec-run-after-fix.txt`）。
- 像素比对（HEAD 版 vs 新图）：弹窗正文区差异 `0` px；背景差异 `rows=357 px=56007`（原文 `diff-head-vs-final.txt`）。
- `npm run check` → exit 0（原文 `check.txt`）。
- `npm run test:unit` → `tests 16` / `pass 16` / `fail 0` / `duration_ms 79.101458`（原文 `unit.txt`）。
- `python3 scripts/audit_documents.py` → `{"markdown_files": 80, "local_links_checked": 497, "archived_files_checked": 85, "operations": 55, "schemas": 65, "errors": []}`。

## 简报前提核对（与磁盘/实测不符）
- 简报写「T-026 轮核实为真漂移：197704→188099 字节、可见差异 199203 px，成因是弹窗背后页面滚动位置变化」。前半段实测成立（188099 那版可复现），但「真漂移」的定性不成立：同一份代码连跑两次即出现该差异，两次运行之间没有任何代码变化 → 是运行间不确定，不是相对当前代码过期。滚动位置成因成立。

## Finish（进行中）
- 下一步：写 `report.md` → commit（首行 `[T-029]`）→ push（本任务 notes 授权机制维护类直推）→ 补 gates.md EXECUTED 行 → 追加 experiment-log → 重写 status.md。
- 门禁动作执行（简报第 1 节，先于本任务）：决定段 `APPROVE T-021 review` 已执行，`git push origin codex/release-v0.3.6` → `1bf231c..d2b44c7`，远端 sha `d2b44c74d665539c123833d166355148a8affe11`；T-021 `status` 已改 `done`。
