# 回滚说明 · 当前测试环境 v0.3.9

本文件说明如何在 tigery 演示环境回退到上一版本，以及各层需要同时还原什么。

## 当前版本：v0.3.9 → v0.3.8

v0.3.9 无新增数据库迁移。测试环境升级前备份位于 `/home/tigery/services/dingdong/backups/pre-v0.3.9-20260927.dump`。若需回退，沿用 v0.3.8 发布目录及其原有主机侧配置，在 `tigery` 上执行：

```sh
base=/home/tigery/services/dingdong/releases
APP_VERSION=0.3.8 docker compose \
  --env-file "$base/dingdong-v0.3.8/deploy/.env" \
  -f "$base/dingdong-v0.3.8/deploy/compose.yml" \
  up -d --build --wait
```

随后核对公网 `/dingdong/version.txt` 为 `0.3.8`、`/api/v1/runtime` 为 `demo`、`/ops/login/` 可打开。保留原数据卷，不执行 `down -v`。以下是更早版本的历史回退说明，涉及 v0.3.4 等旧路径时不能直接套用于当前版本。

**关键原则：回滚不是"换一个镜像标签"就完事。** 版本、镜像标签、入口配置、数据库迁移四者必须一起考虑，只改其一会出现接口 404、Host 不匹配或迁移残留。

---

## 0. 历史发布（v0.3.6 / v0.3.5 / v0.3.4 / v0.3.3 / v0.3.2 / v0.3.1 / v0.3.0）引入了什么

| 类别 | 内容 | 回滚影响 |
| --- | --- | --- |
| 代码 | v0.3.6：运营后台界面改版——本地化 Tabler 1.5.1 + Tabler Icons 3.46.0、25 个页面统一到重建的应用外壳、静态资源 `?v=` 缓存击穿、403/404 页共用外壳、导航补图标 | **只影响观感与静态资源地址**。回滚后运营界面退回改版前样式；`?v=` 消失，浏览器需自行刷新才能看到旧界面。无功能与数据影响 |
| 配置 | v0.3.6：`deploy/compose.yml` 新增**必填** `APP_VERSION`（用于 `?v=` 缓存击穿并在页脚显示） | **回滚到 v0.3.5 前必须把 `.env` 里的 `APP_VERSION` 一起处理**：旧版 `compose.yml` 不引用该变量，留着无害；但若保留新 `compose.yml` 而 `.env` 缺 `APP_VERSION`，容器会直接启动失败而不是降级 |
| 配置 | v0.3.6：`deployment.py` 在明文 HTTP 下不再发 `Cross-Origin-Opener-Policy` | 回滚后恢复"公网每个页面的控制台都有一条 COOP 错误"。纯 HTTP 下该头本就无法生效，无实际防护差异 |
| 代码 | v0.3.5：家长端档案编辑命中 `409` 后**保留未保存输入**并提供"查看最新 / 载入最新 / 用我的修改保存"三条可恢复路径 | 回滚后恢复"一被挡下就重建表单、家长这次填写被静默丢弃"的旧行为；服务端并发保护仍在（数据不会被覆盖），但用户的填写会丢 |
| 代码 | v0.3.4：儿童档案修订号在家长端与技术后台也前进、内容标识保留标题摘要并取唯一标识、新增 `GET /api/v1/children/<id>` | 回滚后恢复"家长改档被运营旧页面静默覆盖"与"不同标题同号互相停用"，且家长端冲突恢复路径再次 405 |
| 代码 | v0.3.3：题库/活动/儿童的修订号并发控制、首页审计权限裁剪、筛选参数校验、标识与版本自动生成 | 回滚后恢复"后保存者覆盖"与"首页显示审计"的旧行为 |
| 代码 | 新增 `dingdong_ca.ops` 应用、模板、静态资源（v0.3.0） | 回滚到 v0.2.x 后 `/ops/` 路径整体消失 |
| 权限 | 复用接口把 `account_admin` 视为满足任一 staff 角色（v0.3.2） | **回滚 v0.3.2 会让管理员的"发布""重试"按钮再次 403** |
| 配置 | `deploy/nginx.conf.template` 代理白名单补上 `ops/`（v0.3.1） | **回滚 v0.3.1 会让 `/ops/` 再次变成容器 nginx 404** |
| 配置 | 上海 nginx 增加根路径 `location ^~ /ops/` → 隧道 | 回滚到 v0.3.0 之前需同时删掉这条，否则 `/ops/` 指向已下线的后台 |
| 数据库迁移 | v0.3.3：`0007_activitycontentversion_create_request_key_and_more`（`revision` / `create_request_key`，可空） | **只增不删**：不删列、不改既有数据。v0.3.4 / v0.3.5 / v0.3.6 均无新增迁移，复用 `0007` |
| 数据库迁移 | v0.3.0：`0006_auditevent_detail_auditevent_target_label_and_more` | 同上，**只增不删** |
| 配置 | `INSTALLED_APPS` 增加 `dingdong_ca.ops`；新增 `LOGIN_URL` / `LOGIN_REDIRECT_URL`；`config/urls.py` 新增 `/ops/` 路由与按前缀分流的 403/404 处理 | 回滚代码后这些配置一并回退 |
| 家长端 | v0.3.5 改了档案编辑的冲突恢复交互；v0.3.4 改了档案编辑的请求与恢复；v0.3.6 与 v0.3.3 起认证与权限逻辑未改动 | 回滚代码后一并回退 |

> **不要回滚到 v0.3.0 或 v0.3.1**：前者在 Docker 下 `/ops/` 根本打不开，后者管理员按钮会 403。**v0.3.5 是 v0.3.6 之前的可用发布，是常规回滚目标**——它功能完整（含冲突恢复与内容身份修复），只是运营界面还是改版前的老样子、公网控制台带 COOP 噪音。
>
> **`0006`+`0007` 迁移可安全保留**：两版都只加列和索引，旧版本代码不会读到这些列，回滚到旧镜像后迁移记录仍留在数据库里也不会报错。不需要反向迁移。

---

## 1. 回滚到 v0.3.4（上一版本）

### 1.1 在 tigery 上操作

```sh
ssh dell
cd /home/tigery/services/dingdong
```

把 `deploy/.env` 里的版本改回上一版：

```sh
sed -i 's/^APP_VERSION=.*/APP_VERSION=0.3.4/' deploy/.env
grep '^APP_VERSION' deploy/.env
```

用上一版发布包重建并启动（发布包内 `RELEASE.json` 记录了精确提交）：

```sh
ls -d releases/dingdong-v0.3.4
cp releases/dingdong-v0.3.4/deploy/.env.example deploy/.env.rollback 2>/dev/null || true
docker compose --env-file deploy/.env -f deploy/compose.yml up -d --build --wait
```

> 注意：**不要覆盖 `deploy/.env`**。里面的 `DJANGO_SECRET_KEY`、`JWT_SIGNING_KEY`、`POSTGRES_PASSWORD`、`PUBLIC_ORIGIN`、`ADDITIONAL_ORIGINS` 都是主机侧生成并沿用的，重建镜像不需要它们变化。只需要改 `APP_VERSION`。

### 1.2 验证回滚结果

```sh
curl --noproxy '*' -s http://110.42.225.196/dingdong/version.txt
curl --noproxy '*' -s http://110.42.225.196/api/v1/runtime
```

期望：版本回到 `0.3.4`，runtime 为 `demo`。`/ops/` 仍可打开，家长端首页仍正常。

### 1.3 不需要动的部分

- **上海 nginx 配置**：`/dingdong/`、`/api/v1/`、`/admin/`、`/static/` 的转发规则在 v0.2.2 之后没变，回滚到 v0.3.4 无需修改。
- **SSH 反向隧道**：`dingdong-relay` 服务无需重启，它只转发端口，与版本无关。
- **数据卷**：`postgres_data`、`redis_data` 保留，家庭与答卷数据不受影响。
- **数据库迁移**：`0006`、`0007` 保留即可，见上文说明。

---

## 2. 只回滚某一层的情况

| 只想回滚 | 做法 | 风险 |
| --- | --- | --- |
| 只回滚后端镜像 | 改 `APP_VERSION` 后 `docker compose up -d api worker beat init web` | `web` 镜像与 `api` 版本不一致会导致静态资源与后端接口不匹配 |
| 只回滚前端静态 | 不建议。`Dockerfile.web` 与后端同版本构建 | 静态资源引用新接口时会出现 404 |
| 只回滚 nginx 入口 | 编辑上海服务器 `/etc/nginx/dingdong-location.conf` 后 `nginx -t && nginx -reload` | 会同时影响 `/api/v1/` 与 `/admin/` |
| 只回滚数据库 | 不需要。`0006` / `0007` 均为向后兼容的加列迁移 | 若强行 `migrate core 0006` 会报错，因为迁移记录与实际结构不一致 |

---

## 3. 紧急停用入口（不删数据）

如果只需要临时下线后台，不涉及版本：

1. **只关运营后台**：在上海服务器 nginx 里为 `/ops/` 加一条 `return 404;`，`nginx -t && nginx -r`，其余路径不受影响。
2. **关整个演示站**：删除 `game-lobby.conf` 中 include `dingdong-location.conf` 的行，`nginx -t && nginx -r`。
3. **关隧道**：tigery 上 `systemctl --user disable --now dingdong-relay`。
4. **停容器**：`docker compose -f deploy/compose.yml down`（**不加 `-v`**，加了会删数据卷）。

恢复时按相反顺序操作。

---

## 4. 回滚后必须重新验收的最小集

回滚后不要只看容器起来了就宣布成功，至少确认：

- [ ] `version.txt` 显示目标版本
- [ ] `/api/v1/runtime` 返回 `demo`
- [ ] 家长端首页可打开，登录 → 保存档案 → 刷新恢复可用
- [ ] `/admin/` 登录页可打开（HTTP 下 CSRF 依赖 same-origin 策略，见 `ADMIN_CSRF_FIX_20260912.md`）
- [ ] `/ops/login/` 返回 200 且能登录（回滚到 v0.3.5 时后台仍在；只有回滚到 v0.2.x 才应消失）
- [ ] `docker compose ps` 中 api / worker / beat / web / postgres / redis 均健康

---

## 5. 历史发布参考

| 版本 | 分支 / 标签 | 说明 |
| --- | --- | --- |
| v0.3.6 | `codex/release-v0.3.6` | 运营后台界面改版（本地化组件体系 + 缓存击穿 + 明文入口 COOP 静音）（**v0.3.5 之后的可用发布，常规回滚目标**） |
| v0.3.5 | `codex/release-v0.3.5` | 家长端档案冲突后保留未保存输入并提供三条可恢复路径（**v0.3.6 之前的可用发布，功能完整，只是运营界面为改版前样式**） |
| v0.3.4 | `codex/release-v0.3.4` | 儿童档案修订号覆盖全部入口 + 内容标识保留标题摘要并独立化（**v0.3.5 之前的可用发布，常规回滚目标**） |
| v0.3.3 | `codex/release-v0.3.3` | 修复独立验收的并发覆盖 / 首页审计越权 / 非法筛选 500 / 免技术标识（**v0.3.4 之前的可用发布，常规回滚目标**） |
| v0.3.2 | `codex/release-v0.3.2` | 管理员角色放行 + 窄屏返回路径修复（缺少并发保护与内容标识修复） |
| v0.3.1 | `codex/release-v0.3.1` | 修复运营后台在 Docker 下的 nginx 404（**管理员按钮仍 403，不要回滚到此版**） |
| v0.3.0 | `codex/release-v0.3.0` | 运营后台（**Docker 部署下 `/ops/` 不可达，不要回滚到此版**） |
| v0.2.5 | `codex/release-v0.2.5` | 后台 CSRF 修复 |
| v0.2.4 | `codex/release-v0.2.4` | 双入口登录 |
| v0.2.3 | `codex/release-v0.2.3` | HTTP 请求编号修复 |
| v0.2.2 | `codex/release-v0.2.2` | 上海公网 80 端口入口 |

各版本的发布包在 `dist/dingdong-v<版本>.tar.gz`，附 `.sha256`。远端发布目录 `/home/tigery/services/dingdong/releases/dingdong-v<版本>`。

入口与隧道配置见 [上海公网入口](relay/README.md)，历史部署见 [部署记录](DEPLOYMENT_20260912.md)。
