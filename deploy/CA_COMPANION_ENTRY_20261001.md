# CA 天赋陪伴空间入口适配（2026-10-01）

提交前验收记录：**本地适配已实现，浏览器验收受运行环境阻塞；未部署。** 基线 `ca-main` / `c688e29` / v0.3.26，版本号不变。用户随后批准提交推送至CA私有仓独立分支；实际发布结果以远程分支SHA回读为准。

## 变更与保留边界

- 我的 DingDong、个人报告、展会体验、机器人管理四处入口共用新标签“进入 DINGDONG 天赋陪伴空间”。
- 公开网页默认地址为 `https://www.dingdongrobo.top/dingdong/companion/main`；保持普通新标签导航、`target="_blank"`、`rel="noopener noreferrer"`，不用 iframe。
- 供应商按其新约定建立共享 `ca_dingdong` Web 会话。CA 不增加手机号、CA Cookie、JWT、NFC token 或一次性 launch code；不承诺个人 SSO/会话隔离。
- 显式 URL 覆盖、原 demo gate、登录/家庭/儿童归属、NFC、绑定/未绑/pending/unknown 入口规则与授权检查不改。
- 后端已有 GET `/api/v1/ca/prototype/insights`、固定 `ca_account_id=ca_dingdong`、默认 `weekly_turns=7` 和 `X-API-Key` 符合约定，调用逻辑不改。保留 3/7/14/21、首读 `cached=1`、手动刷新、同频率缓存保护。

## 配置对应与部署限制

| 配置 | 值/说明 |
| --- | --- |
| `DINGDONG_PROTOTYPE_WEB_URL` | `https://www.dingdongrobo.top/dingdong/companion/main` |
| `DINGDONG_BASE_URL` | `https://www.dingdongrobo.top`，仍由实际配置显式设置；本地样例保持空值，只在注释说明目标，避免改变合成测试的断开状态 |
| `DINGDONG_API_KEY` | 双方约定的供应商 `CA_API_KEY`，只放后端；样例留空 |
| `DINGDONG_ALLOW_HTTP` | `False`，新地址用 HTTPS |
| `DINGDONG_PROTOTYPE_DEMO_ENABLED` | 默认仍关闭，本次不替用户开启 |

本轮只更新代码/Compose 默认值和 `backend/.env.example`。**未读取或修改真实 `.env`，未取得新密钥，未修改生产。** 若线上显式配置旧地址，默认值不会覆盖它；另行授权发布时须核对/更新实际网页 URL，并确认 API base/key。

直接 Django 进程未设置网页变量时采用新默认；显式空字符串仍按原服务逻辑回退 API base。Compose `${VAR:-default}` 对未设置和空字符串都采用新默认。此处两种启动方式的空值行为不同，已分别检查；建议显式填完整新地址。

## 本轮验证

| 命令/检查 | 结果 |
| --- | --- |
| `npm --prefix frontend run check` | 通过，生产 JS 语法检查 |
| `npm --prefix frontend run test:unit` | **124 通过、0 失败** |
| `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s deploy/tests -p test_companion_entry_config.py -v` | **4 通过**，源码配置表达式、实际无依赖 URL helper、demo gate、安全 URL、显式覆盖 |
| `deploy/tests/test_nginx_routes.py`、`test_legacy_compat.py`、`test_production_trial_gate.py` 内测试函数直接执行 | **6 通过**，不是完整 pytest 部署套件 |
| 新增 Python/修改设置文件 `ast.parse`，修改 E2E/Storybook 文件 `node --check` | 通过，不等于 Django import、ruff 或 Storybook build |
| `git diff --check` | 通过 |
| `PYTHONDONTWRITEBYTECODE=1 python3 scripts/audit_documents.py` | **受阻**；checkout不含忽略的历史输入 `材料/原始数据/归档校验.json`，不能声称文档审计通过 |
| 本地 Chromium 组件验收 | **受阻，0 浏览器用例通过**；启动报 `socket() failed: Operation not permitted`，申请执行沙盒提升后重试一次仍相同 |
| 后端 pytest、Django check/迁移检查、ruff、完整登录/绑定 E2E、Storybook build | **未运行**；缺 Python 3.14、Django/pytest、PostgreSQL/Redis、Node 开发依赖，未安装 |
| 真实供应商、真实手机/平板硬件、生产 | **未验证**；没有请求供应商、建立会话、发短信或生产写入 |

TDD 红灯阶段确实观察到旧入口标签断言失败、新配置默认断言失败，修改后转绿。新增 `backend/tests/test_companion_entry_contract.py` 检查真实客户端请求构造，只替换 `_open` 供应商传输层，断言 GET/HTTPS/完整路径、两个 query、key/Accept header、无 body/Cookie/Authorization；环境缺失，本轮未运行。

浏览器脚本 `.trellis/tasks/10-01-ca-companion-entry/check-components.py` 使用生产组件/CSS、现有 Storybook 合成输入，计划覆盖 1280/768/390/320px、完整标签/新标签、绑定状态和报告呈现；不 mock 业务 API，阻断供应商导航。当前无成功截图；即使以后通过，也不等于真实登录/后端/供应商验收。

完整隔离环境可用后的命令（本轮未执行）：

```sh
uv run --directory backend pytest tests/test_companion_entry_contract.py tests/test_exhibition.py tests/test_prototype_demo.py tests/test_prototype_report_cache.py tests/test_prototype_closed_loop.py tests/test_ca_accounts.py -q
cd frontend
npx playwright test tests/parent-robot-experience.spec.js tests/binding-visibility.spec.js --reporter=list
```

不得连接生产数据库或用真实供应商密钥/真实短信运行这些测试。

## Git 与收尾

初始 checkout 只有指向 `rossyao2022/dingdong` 的origin。本轮按用户既定模型调整本地别名：origin指向私有 `ivesyi/dingdong-ca`，upstream保留 `rossyao2022/dingdong`；新分支为 `codex/ca-companion-entry-20261001`。只向私有CA新分支发布，不更新main或upstream/ca-main，未配置或放宽永久hooks。

任务保持验证未完成，暂不归档。用户在明确告知后批准**仅本次豁免缺历史材料的文档审计**，其失败记录保留；敏感路径扫描、任务ID提交标题和已通过代码检查不豁免。这不是长期规则，不修改hook脚本/永久配置，也不把审计标为通过。未合并或部署，未触达用户 Mac、DC 或生产服务器。
