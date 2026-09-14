#!/usr/bin/env python3
"""v0.3.6 公网验收：在容器内创建本轮隔离的运营账号（上一轮的已停用）。

三个角色分别对应：全部权限 / 运营 / 内容。
账号名前缀 acpt036_，供验收后定向停用。
密码由调用方通过 DD_PW 环境变量传入，不落盘、不写进仓库。

用法（密码在本地生成后写入临时变量，不进命令历史、不落进仓库）：
    PW=$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-16)
    B64=$(base64 < deploy/evidence/v0.3.6/prepare-acceptance-accounts.py | tr -d '\n')
    ssh dell "echo '$B64' | base64 -d > /tmp/dd-acct-v036.py \
      && docker cp /tmp/dd-acct-v036.py dingdong-demo-api-1:/tmp/ \
      && docker exec -w /app -e PYTHONPATH=/app \
           -e DJANGO_SETTINGS_MODULE=config.settings.deployment -e DD_PW='$PW' \
           dingdong-demo-api-1 python /tmp/dd-acct-v036.py"

**`-w /app -e PYTHONPATH=/app` 不能省**：按路径执行脚本时 `sys.path[0]` 是脚本所在目录，
容器里 `config` 包只存在于 `/app`，少了这两个参数会报 `ModuleNotFoundError: No module named 'config'`。

输出：每个账号一行 "ready <username> <roles>"。
"""

import os

import django

django.setup()

from django.contrib.auth import get_user_model  # noqa: E402
from django.contrib.auth.models import Group  # noqa: E402

ACCOUNTS = [
    ("acpt036_admin", "account_admin"),
    ("acpt036_operator", "operations"),
    ("acpt036_content", "content"),
]


def main() -> None:
    user_model = get_user_model()
    password = os.environ["DD_PW"]
    for username, group in ACCOUNTS:
        user, _ = user_model.objects.get_or_create(
            username=username, defaults={"account_kind": "staff", "is_staff": True}
        )
        user.set_password(password)
        user.is_active = True
        user.is_staff = True
        user.account_kind = "staff"
        user.save()
        user.groups.set(Group.objects.filter(name=group))
        print("ready", username, list(user.groups.values_list("name", flat=True)))


if __name__ == "__main__":
    main()
