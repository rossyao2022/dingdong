#!/usr/bin/env python3
"""列出 2026-09-15 本轮全量验收在演示库里新建的对象，供清理脚本确定名单。

按"创建时间 >= 本轮验收开始时刻"筛选，并附按称呼前缀匹配的结果。
**只读**，不做任何修改。

用法（在 api 容器内执行，见 SKILL 的 base64 送法）：
    docker exec -w /app -e PYTHONPATH=/app -e DJANGO_SETTINGS_MODULE=config.settings.deployment \
      -e DD_CUTOFF=2026-09-15T13:00:00+00:00 dingdong-demo-api-1 python /tmp/dd-probe-demo.py
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

print("\n--- QuestionnaireVersion （本轮新建）---")
for q in QuestionnaireVersion.objects.filter(created_at__gte=CUTOFF).order_by("code", "version"):
    print(f"  {q.code}\t{q.version}\t{q.status}\t{q.title[:32]}")

print("\n--- ActivityContentVersion （本轮新建）---")
for a in ActivityContentVersion.objects.filter(created_at__gte=CUTOFF).order_by("code", "version"):
    print(f"  {a.code}\t{a.version}\t{a.status}\t{a.title[:32]}")

print("\n--- Child （本轮新建）---")
children = list(Child.objects.filter(created_at__gte=CUTOFF))
for c in children:
    print(f"  {c.id}\t{c.status}\t{c.name}")
family_ids = {c.family_id for c in children}

print("\n--- Child （按称呼前缀匹配，含更早遗留）---")
prefixes = ("演示验收儿童", "冲突保留", "P1跨入口")
matched = [c for c in Child.objects.all() if c.name.startswith(prefixes)]
for c in sorted(matched, key=lambda x: x.name):
    print(f"  {c.id}\t{c.status}\t{c.name}")
family_ids |= {c.family_id for c in matched}

print("\n--- Family （涉及本轮儿童）---")
for f in Family.objects.filter(pk__in=family_ids):
    print(f"  {f.id}\t{f.status}")

print("\n--- 工作人员 acptdemo_* ---")
for u in get_user_model().objects.filter(username__startswith="acptdemo_"):
    print(f"  {u.username}\tactive={u.is_active}\t{list(u.groups.values_list('name', flat=True))}")

print("\n--- 家长账号（本轮新建）---")
for u in get_user_model().objects.filter(date_joined__gte=CUTOFF, is_staff=False):
    print(f"  {u.username}\tactive={u.is_active}")

print("\n--- 当前稳态计数 ---")
print("  active families:", Family.objects.filter(status="active").count())
print("  active children:", Child.objects.filter(status="active").count())
print("  published QV:", QuestionnaireVersion.objects.filter(status="published").count())
print("  published ACV:", ActivityContentVersion.objects.filter(status="published").count())
print("  active staff:", get_user_model().objects.filter(is_staff=True, is_active=True).count())
print("  active parents:", get_user_model().objects.filter(is_staff=False, is_active=True).count())
