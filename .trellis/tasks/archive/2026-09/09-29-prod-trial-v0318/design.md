# 发布设计

复用 v0.3.17 的已验证镜像，以仓库内离线 Dockerfile 覆盖 v0.3.18 源码及前端资源。Compose 仍使用独立 `dingdong-prod-trial` 项目与现有四组环境覆盖文件。仅重建 API、Worker、Beat、Web；PostgreSQL、Redis 与数据卷保持原状。此版无迁移。发布前做 PostgreSQL 自定义格式备份，校验发布包和镜像。回退时从保留的 v0.3.17 发布目录以同组环境文件重建四个应用容器。
