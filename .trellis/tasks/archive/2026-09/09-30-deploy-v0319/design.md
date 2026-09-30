# 发布设计

使用既有 SHA256 校验过的 v0.3.19 发布包，运行时代码与 CA main 一致。依赖未变，离线基于既有 v0.3.18 backend/web 镜像复制新代码并 collectstatic。沿用四组受限 env 文件，仅作为 Compose 参数，不读取或输出密钥。

数据库先用 pg_dump -Fc 备份并核验目录清单；不运行 seed/init。新镜像执行 Django check 与 migrate --check。只重建 api/worker/beat/web，PostgreSQL/Redis 保持运行。成功后专用准备命令限定原固定号、原标签和原儿童，只写一个合成输入；现有不同数据拒绝覆盖。

失败时停止并记录，必要时原 env 与 APP_VERSION=0.3.18 重建四应用。无新增迁移，数据库不随应用回滚。仅新增 fixture 亦不自动删除或恢复全库。其他生产项目保持原状。
