# v0.3.19 会展稳定性修复发布验收

日期：2026-09-30。用户明确放行部署，目标为 `1.15.23.152` 的独立 `dingdong-prod-trial`。上一版本 v0.3.18。运行时代码已完整合入 CA 默认主干 `main`，与发布包源码提交 `45f4ea792a00ae059d561d5d068b4e7421c00b2c` 一致。

## 本版上线内容

固定演示号禁止停用/不同标签换机；原号原标签可重新连接；未接通不查询旧伙伴数值；NFC 刷新后提示重碰原标签；短信发码冷却倒计时在退出/刷新后保留；新增受限的报告合成输入准备命令。完整本地验证见[修复与发布准备](EXHIBITION_HARDENING_20260930_V0319.md)。本版无数据库迁移或依赖变化。

## 备份与发布

- 数据库已先备份至 `/opt/dingdong/backups/pre-v0.3.19-20260930.dump`，160224 字节，0600 权限；`pg_restore --list` 可读。SHA-256：`aa2488bdeab89f46119e39a0862fee023150ac5ea6f6e2d0e580d5c51b1f459f`。[备份证据](evidence/v0.3.19/production-backup.txt)。备份只留服务器，没有下载家庭数据。
- 包 `dingdong-v0.3.19.tar.gz` 本地和服务器 SHA-256 均为 `03c15189a74bd9dfc7c531e546f99f2db7d9e733ca22beb4408dbec2c36fedc5`。保留原包；补充发布 Dockerfile 不改变 VERSION/backend/frontend 的已验证运行时代码。[等价记录](evidence/v0.3.19/production-source-equivalence.txt)。
- 从已验证 v0.3.18 镜像离线构建新镜像，Compose 静默校验、Django check 与 migrate --check 均通过。[构建记录](evidence/v0.3.19/production-build.txt)。没有运行 init、seed 或发布运营内容。
- 仅重建 API、Worker、Beat、Web；PostgreSQL/Redis 保持原容器和数据卷运行。短信、Prototype、推送四组原 env 沿用，只作为命令参数，不读取或打印。没有新增短信、改密钥、改 R2/CDN、修改同机其他应用。

## 发布中发现并修复的问题

首次手机截图发现机器人图片加载失败。发布脚本的 `umask 077` 使归档中未显式记录的图片子目录解压为 root 的 0700；Web COPY 保留权限，nginx 无法读取并返回 404。只测输入框布局没有识别坏图，不能视为完整页面验收。[问题记录](evidence/v0.3.19/production-static-permission-issue.json)。

已在[本版离线 Web Dockerfile](Dockerfile.web.from-v0318)统一公开静态目录 0755、文件 0644，重建 Web 镜像和容器后恢复；[标准 Web Dockerfile](Dockerfile.web)也补同样步骤，避免后续包部署复发。权限修复仅作用于公开静态目录，不涉及配置和密钥。[修复执行记录](evidence/v0.3.19/production-static-fix.txt)。

## 公网与服务验收

- [六容器状态](evidence/v0.3.19/production-health.txt)：四个应用使用 0.3.19，API/PostgreSQL/Redis 健康，应用重启次数为 0。Worker 实际 ping 返回 pong。
- [公网核验](evidence/v0.3.19/production-public.json)：家长入口 200，运营入口跳到登录页后 200，`/dingdong/version.txt` 为 0.3.19，runtime 为 `demo / aliyun_verify / database_fixture`。
- JS/CSS 关键文件摘要与本地一致；[全部 17 项公网图片与素材](evidence/v0.3.19/production-assets.json)逐个返回 200，字节与本地一致。
- 公网真实 Chrome 登录布局在 320/390/430/760/761/800/900/1024/1280px [通过](evidence/v0.3.19/production-mobile-browser.txt)；[390×844 家长和运营页面检查](evidence/v0.3.19/production-mobile-smoke.json)无横向溢出、坏图或页面脚本错误，未触发发码。家长/运营两张截图已目视核验。[家长截图](evidence/v0.3.19/production-parent-login-390.png)、[运营截图](evidence/v0.3.19/production-ops-login-390.png)。
- [部署回归 10 项](evidence/v0.3.19/production-deploy-tests.txt)通过。首次本地命令缺 pytest/模块路径，不计验收；随后使用项目虚拟环境及 PYTHONPATH=backend 重跑通过。

## 原演示儿童报告准备

新版容器执行专用命令预检通过，`--apply` 写入后再执行一次确认幂等。[命令与 Worker 记录](evidence/v0.3.19/production-report-prepare.txt)。[只读复核](evidence/v0.3.19/production-readiness.json)确认：原固定号 active/unbound，原 NFC 摘要匹配，合成输入 1 条、准备审计 1 条；真实适配器读入校验通过，专业分数留空。原儿童报告仍为 0、机器人用途授权仍为 0；没有替家长绑定/授权，没有创建成品报告。

生产 API 可通过真实出站请求读取对方 `ca_dingdong` 聚合。此探针仅证实对方可达，未绑定的家长仍被业务门禁拦住；不能用探针代替家长 E2E。

## 使用与待彩排

家长入口 `https://1.15.23.152/dingdong/`；运营入口 `https://1.15.23.152/ops/`。两份本机 v0.3.19 PDF 的上线状态已同步，家长第 1 页换成当前公网截图；其他截图仍注明隔离 E2E 来源，运营密码仅留在授权的私密 PDF，不入 Git。[PDF 复核](evidence/v0.3.19/production-pdf-check.json)。

工作人员仍需用原手机、原 NFC 标签和原儿童现场完成真实短信登录、重绑、用途授权、问卷提交/报告生成、DingDong 人设和聊天、CA 返回刷新。本次不发短信、未用真实家长账号登录、未碰实体 NFC，不能称已完成真机 E2E。正式账号、多游客并行使用、正式成长/健康子接口、真实 milestone 仍待 DingDong 正式接入，不是本次会展展示上线的结论。

## 回滚

保留 `/opt/dingdong/releases/dingdong-v0.3.18` 与两类 v0.3.18 镜像。进入该目录，沿用原四组 env 并设置 `APP_VERSION=0.3.18`，执行 Compose `up -d --no-build --no-deps --force-recreate api worker beat web`。无迁移，不回退 PostgreSQL/Redis。合成输入属于本次授权补充，不自动删行或恢复全库；如后续需撤回先核对新业务记录。不会改 R2/CDN。
