# 后端验证（2026-10-02）

## 实现
- 新LoginGrant.expires_at=NULL，无固定授权截止；0018仅AlterField(null=True)，无批量更新或历史授权复活。
- 有效旧授权刷新后转NULL；旧截止、撤销、用户停用在升级前检查。
- access仍10分钟；refresh JWT与HttpOnly/SameSite=Lax cookie每次重新签发400天，Secure沿用生产配置。cookie路径仍/api/v1/auth/。
- 当前JTI严格轮换与回放拒绝保持；退出撤销本设备授权并删除cookie，其他设备不受影响。
- cleanup_auth保留活跃NULL授权；超过24小时的撤销授权可清理，旧过期授权清理不变。
- rg复查LoginGrant.expires_at消费者：accounts的签发/刷新、common的access鉴权、cleanup_auth已适配；后台审计仅展示/关联，不比较截止。

## TDD证据
先新增关键认证测试并替换固定7天断言，旧实现运行tests/test_auth.py得到5 failed / 16 passed：无固定授权、跨原7天续期、旧授权升级、撤销清理和持久授权轮换测试失败。完成实现后通过。其后补充仅持久cookie的新客户端恢复及撤销24小时保留边界。

## 本轮命令和结果
从backend目录执行：

```sh
env -u PYTHONPATH -u PGOPTIONS .venv/bin/python -m pytest tests/test_auth.py tests/test_boundaries.py tests/test_ops_audit_scope.py -q --reuse-db
.venv/bin/ruff check .
.venv/bin/ruff format --check --target-version py313 dingdong_ca/core/api/accounts.py dingdong_ca/core/api/common.py dingdong_ca/core/models.py dingdong_ca/core/management/commands/cleanup_auth.py dingdong_ca/core/migrations/0018_persistent_login_grant.py tests/test_auth.py
env -u PYTHONPATH -u PGOPTIONS .venv/bin/python manage.py check
env -u PYTHONPATH -u PGOPTIONS .venv/bin/python manage.py makemigrations --check --dry-run
```

- 认证22项、边界与审计18项，共40 passed，1.35s；隔离PostgreSQL测试库应用0018，不动开发家庭资料。
- ruff全部通过；格式首次发现Django自动迁移的引号/空行，格式化该新文件后6 files already formatted。
- Django system check零问题；无待生成迁移。
- 仅本地HTTP/APIClient验证，不宣称已做浏览器关闭重开或生产手测；没有真实短信/供应商调用。

## 回滚约束
旧代码直接比较expires_at或调用timestamp，不支持NULL。若上线后产生NULL授权，不能直接切回旧应用；需兼容的前向修复，或先把NULL截止填为未来400天且保持revoked_at/revoke_reason，再切回旧代码。0018反向恢复NOT NULL也必须先处理NULL，不能删授权或恢复撤销授权。凭据仅最长400天滚动留存，浏览器清cookie/换设备/超过凭据留存仍需登录。
