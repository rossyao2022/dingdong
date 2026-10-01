# 设计
最小行为缺口：模块功能齐但无主任务，历史同名重复；运营手工拼表；报告仅push故障回退忽略pull。
frontend app入口+纯主线/记录组件，复用真实答卷/活动API，绑定独立区域，历史保留；白名单/版本图/发布清单同步。不新框架、不构造CA综合结论。
backend表单纯聚合及ops服务端预览/JSON/CSV；最新每用途completed/历史指定，题干+答复+计分输出版本范围，稳定快照同源；staff权限审计。无新外部sender。
prototype_reports/cache同weekly已验证push/pull比较，cache-first可显式refresh+stale；保留家庭和当前绑定前后核验、无全局私人授权绕过。预热command只真实GET，生产apply需放行。
尽可能不新增模型迁移，保留旧22题API/Worker与报告，将家长呈现改体验回答。新版本0.3.25，生产24直到获放行并实际发布；与原始视觉/本地完整性兼容。
