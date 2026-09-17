# 自循环状态

- 当前任务：T-028（起草给 DingDong 侧的三层澄清清单，只产出文档、不发送）——Plan/Implement/Verify/Finish 走完，`status` 改 `gated` 并在 `gates.md` 申请段补 `REQUEST T-028 external`。产出 `.trellis/tasks/T-028/dingdong-clarifications.md`（336 行 / 29588 字节）：阻塞级 3 项（B1 base URL=D12、B2 `X-API-Key`=D10、B3 换机旧号处置=D20）、确认级 6 组 27 条（C1 契约基线与接口语义 / C2 儿童设备映射与权属核验 / C3 窗口游标与指标单位 / C4 同步频率与阶段规则 / C5 甲方算法输入输出与超时幂等 / C6 展示面数据契约=T-021 §6 五条）、后置级 2 项（真实短信、生产部署条件），32 条统一「为什么需要 / 当前降级 / 接入动作」；§4 覆盖对照表（PROJECT_MEMORY 待确认 4 项逐项映射、C1 设计未做项 2 条、D1–D20 落点 20/20、N1–N10 来源）+ §5 32 行回复模板。验证：`audit_documents.py` errors `[]`（改动前基线亦 `[]`）；内联自检条目三要素 33/33/33、D 号无缺、敏感词 0 命中、3 个相对链接目标存在。详见 `.trellis/tasks/T-028/report.md`。
- 上一个任务：T-031（存量 `core/api/common.py` 过 ruff format）——`describe_target` 内 name 表达式换行风格（+5/−3，语义逐字未动）；改后 `ruff format --check --target-version py313 .` `126 files already formatted`、`pytest tests/test_ops_audit_scope.py tests/test_auth.py -q` `26 passed in 58.97s`、audit errors `[]`；按 notes「机制维护类可直推」push，远端 sha `bfe9dcd`。

- 最近 5 轮（取自 `runs.log`，采样于本 worker 收尾提交前；本轮 T-028 的 `ROUND ... DONE` 行由驱动在本 worker 退出后写回）：

| 任务 | 结果 | 耗时 | 提交 | 备注 |
| --- | --- | --- | --- | --- |
| T-031 | RATE_LIMITED | 95s | c893a3d | 开工即中断（rc=1, dirty-worktree） |
| T-031 | RATE_LIMITED | 320s | c893a3d | 连续第 2 次，驱动曾标 blocked（orchestrator 14:25Z 已解锁） |
| T-028 | RATE_LIMITED | 702s | d80891c | 两个模型都限流（连续第 5 次） |
| T-036 | DONE | 577s | dc54fea | 账本瘦身完成 |
| T-031 | DONE | 311s | 3b3a337 | 格式化完成并 push |

- 累计（`runs.log` 已记录 38 轮，本轮 DONE 行待驱动写回后变 39）：DONE 25 / RATE_LIMITED 11 / GATED 1 / FAIL 1；「两个模型都限流」连续计数行 5 次，Pro 兜底单日上限触顶（`FALLBACK_LIMIT`）5 次。
- 待 orchestrator 处理的事：有，两条。
  1. **新增 `REQUEST T-028 external`（15:24Z）**：澄清清单已就绪，发送属 external 动作，需 Yihu 放行后由人执行。放行前它保持 `gated`，驱动会跳过。
  2. **本文件末尾「## 驱动告警」一节的 T-031 blocked 已过期**（orchestrator 14:25Z 已解锁，T-031 已 done）；按 prompt「原样保留」的要求未改该节，仅在此说明。
- 下一步：队列下一个 `todo` = T-032（展示面 A：四个面的数据层与家长端接口，gate=none，可直推）；其后 T-033→T-035（展示面 B–D）、T-024（常设巡检，gate=review）。

## 驱动告警
- 需 orchestrator：T-031 连续失败 2 次，已自动标 blocked（2026-09-17T14:22:17Z）。
