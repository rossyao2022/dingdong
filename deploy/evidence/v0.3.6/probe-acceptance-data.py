#!/usr/bin/env python3
"""列出本轮（v0.3.6）公网验收在演示库里新建的对象，供清理脚本确定名单。

按"创建时间 >= 本轮验收开始时刻"筛选，并打印足够定位的字段。
**只读**，不做任何修改。

用法（在 api 容器内执行，见 SKILL 的 base64 送法）：
    docker exec -w /app -e PYTHONPATH=/app -e DJANGO_SETTINGS_MODULE=config.settings.deployment \
      dingdong-demo-api-1 python /tmp/dd-probe.py
"""

import os

import django

django.setup()

from django.contrib.auth import get_user_model  # noqa: E402
from django.utils.dateparse import parse_datetime  # noqa: E402

from dingdong_ca.core.assessment_models import QuestionnaireVersion  # noqa: E402
from dingdong_ca.core.models import (  # noqa: E402
    ActivityContentVersion,
    Child,
    Family,
)

CUTOFF = parse_datetime(os.environ["DD_CUTOFF"])
print("cutoff:", CUTOFF)

print("\n--- QuestionnaireVersion ---")
for q in QuestionnaireVersion.objects.filter(created_at__gte=CUTOFF).order_by("code", "version"):
    print(f"  {q.code}\t{q.version}\t{q.status}\t{q.title[:28]}")

print("\n--- ActivityContentVersion ---")
for a in ActivityContentVersion.objects.filter(created_at__gte=CUTOFF).order_by("code", "version"):
    print(f"  {a.code}\t{a.version}\t{a.status}\t{a.title[:28]}")

print("\n--- Child （本轮新建）---")
children = list(Child.objects.filter(created_at__gte=CUTOFF))
for c in children:
    print(f"  {c.id}\t{c.status}\t{c.name}")
family_ids = {c.family_id for c in children}
print("\n--- Child （按称呼前缀匹配，含更早遗留）---")
prefixes = ("冲突保留", "P1跨入口", "界面验收隔离儿童", "独立复验", "P2验收隔离儿童")
matched = [c for c in Child.objects.all() if c.name.startswith(prefixes)]
for c in sorted(matched, key=lambda x: x.name):
    print(f"  {c.id}\t{c.status}\t{c.name}")
family_ids |= {c.family_id for c in matched}

print("\n--- Family （涉及本轮儿童）---")
for f in Family.objects.filter(pk__in=family_ids):
    print(f"  {f.id}\t{f.status}")

print("\n--- 工作人员 acpt036_* ---")
for u in get_user_model().objects.filter(username__startswith="acpt036_"):
    print(f"  {u.username}\tactive={u.is_active}\t{list(u.groups.values_list('name', flat=True))}")

print("\n--- 家长账号（本轮新建）---")
for u in get_user_model().objects.filter(date_joined__gte=CUTOFF, is_staff=False):
    print(f"  {u.username}\tactive={u.is_active}")
