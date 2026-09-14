"""v0.3.6 公网验收后清理：只做状态变更（停用/归档/退役），不物理删除，保留并补写审计。

目标对象严格限定为本轮（v0.3.6 公网验收）由浏览器用例与准备脚本创建的隔离数据：

- 儿童：称呼前缀 ``冲突保留*``（家长端冲突恢复 5 项）、``P1跨入口*``（P1 跨入口 2 项）、
  ``界面验收隔离儿童*``（准备脚本建立的隔离家庭）。只处理**仍未归档**的，
  更早轮次同名前缀的儿童在上轮已归档，本轮不会重复动。
- 内容：本轮 stamp 为 ``mu0u*`` 的题库/活动版本，逐条 ``code + version`` 定位
  （见下方清单，由只读探针 ``probe-acceptance-data.py`` 按创建时间筛出）。
- 临时工作人员：``acpt036_`` 三个账号。
- 家长账号：受影响家庭的在册成员，以及本轮验收期间新建的家长账号。

既有合成演示家庭、更早轮次的历史测试数据与真实业务对象一律不动。
不引入新的审计动作码，全部复用既有动作码。

用法（在 api 容器内执行，见 SKILL 的 base64 送法）。
"""

import json
import os
from datetime import UTC, datetime

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.deployment")
django.setup()

from django.contrib.auth import get_user_model  # noqa: E402
from django.db import transaction  # noqa: E402

from dingdong_ca.core.assessment_models import QuestionnaireVersion  # noqa: E402
from dingdong_ca.core.models import (  # noqa: E402
    ActivityContentVersion,
    AuditEvent,
    Child,
    Family,
    FamilyMembership,
)

User = get_user_model()

REASON = "v0.3.6 公网验收后清理测试数据（状态变更，未删除记录）"

# 本轮验收开始时刻（= 2026-09-14 14:00 CST），用于圈定"本轮新建的家长账号"。
CUTOFF = datetime(2026, 9, 14, 6, 0, tzinfo=UTC)

CHILD_NAME_PREFIXES = ("冲突保留", "P1跨入口", "界面验收隔离儿童")
TEST_STAFF_PREFIX = "acpt036_"

# 本轮创建、需要退役的题库版本（code, version）
RETIRE_QV = [
    ("qn-mu0ujppu-3feaaf3059e5", "v1"),
    ("qn-mu0ujppu-3feaaf3059e5", "v2"),
    ("qn-mu0ujw1j-7f80e4546a2f", "v1"),
    ("qn-p1mu0ui7zzabc-2f260f82d35a", "v1"),
    ("qn-p1mu0ui7zzabc-b1561834480d", "v1"),
    ("qn-p1mu0uigy1-1f928c831250", "v1"),
    ("qn-p1mu0uigy1-1f928c831250-2", "v1"),
    ("qn-p1mu0uiqrt-681666cc20e0", "v1"),
    ("qn-p1mu0uiqrt-681666cc20e0", "v2"),
]

# 本轮创建、需要退役的活动版本（code, version）
RETIRE_ACV = [
    ("act-mu0ukhkb-3120453fcfed", "v1"),
    ("act-p1mu0uj0lsabc-45a688eecf3d", "v1"),
    ("act-p1mu0uj0lsabc-fca20d8fcd4a", "v1"),
]


def tally():
    return {
        "families_active": Family.objects.filter(status="active").count(),
        "children_active": Child.objects.filter(status="active").count(),
        "qv_published": QuestionnaireVersion.objects.filter(status="published").count(),
        "acv_published": ActivityContentVersion.objects.filter(status="published").count(),
        "staff_active": User.objects.filter(is_staff=True, is_active=True).count(),
        "parents_active": User.objects.filter(is_staff=False, is_active=True).count(),
        "audit": AuditEvent.objects.count(),
    }


before = tally()

children = [
    c
    for c in Child.objects.all()
    if c.name.startswith(CHILD_NAME_PREFIXES) and c.status != "archived"
]
family_ids = {c.family_id for c in children}

retired_qv, retired_acv, archived_children, closed_families = [], [], [], []
deactivated = []
audit_rows = 0

with transaction.atomic():
    for child in children:
        Child.objects.filter(pk=child.pk).update(status="archived")
        AuditEvent.objects.create(
            action="child.profile_update",
            target_kind="child",
            target_id=child.pk,
            target_label=child.name[:200],
            detail={"before": child.status, "after": "archived", "reason": REASON},
        )
        audit_rows += 1
        archived_children.append(str(child.id))

    for fam in Family.objects.filter(pk__in=family_ids):
        # 先停用这个家庭的在册家长账号（运营账号是 staff，不在这里处理）
        for membership in FamilyMembership.objects.select_related("user").filter(
            family=fam, ended_at__isnull=True
        ):
            owner = membership.user
            if owner and owner.is_active and not owner.is_staff:
                User.objects.filter(pk=owner.pk).update(is_active=False)
                deactivated.append(owner.username)
        if fam.status == "active":
            Family.objects.filter(pk=fam.pk).update(status="closed")
            AuditEvent.objects.create(
                action="family.freeze",
                target_kind="family",
                target_id=fam.pk,
                target_label=f"v0.3.6 验收测试家庭 {str(fam.pk)[:8]}",
                detail={"before": "active", "after": "closed", "reason": REASON},
            )
            audit_rows += 1
            closed_families.append(str(fam.id))

    for code, version in RETIRE_QV:
        for q in QuestionnaireVersion.objects.filter(code=code, version=version).exclude(
            status="retired"
        ):
            prior = q.status
            QuestionnaireVersion.objects.filter(pk=q.pk).update(status="retired")
            AuditEvent.objects.create(
                action="questionnaire.retire",
                target_kind="questionnaire_version",
                target_id=q.pk,
                target_label=f"{q.code} · {q.version}"[:200],
                detail={"before": prior, "after": "retired", "reason": REASON},
            )
            audit_rows += 1
            retired_qv.append(f"{q.code}/{q.version}")

    for code, version in RETIRE_ACV:
        for a in ActivityContentVersion.objects.filter(code=code, version=version).exclude(
            status="retired"
        ):
            prior = a.status
            ActivityContentVersion.objects.filter(pk=a.pk).update(status="retired")
            AuditEvent.objects.create(
                action="activity.retire",
                target_kind="activity_content_version",
                target_id=a.pk,
                target_label=f"{a.code} · {a.version}"[:200],
                detail={"before": prior, "after": "retired", "reason": REASON},
            )
            audit_rows += 1
            retired_acv.append(f"{a.code}/{a.version}")

    for u in User.objects.filter(username__startswith=TEST_STAFF_PREFIX, is_active=True):
        username = u.username
        User.objects.filter(pk=u.pk).update(is_active=False)
        AuditEvent.objects.create(
            action="staff.status",
            target_kind="app_user",
            target_id=u.pk,
            target_label=username[:200],
            detail={"after": "disabled", "reason": REASON},
        )
        audit_rows += 1
        deactivated.append(username)

# 兜底：本轮验收期间新建、但不在受影响家庭里的家长账号（例如 ops-p1 的跨入口家庭）
with transaction.atomic():
    stragglers = User.objects.filter(
        date_joined__gte=CUTOFF, is_staff=False, is_active=True
    )
    for u in stragglers:
        username = u.username
        User.objects.filter(pk=u.pk).update(is_active=False)
        AuditEvent.objects.create(
            action="staff.status",
            target_kind="app_user",
            target_id=u.pk,
            target_label=username[:200],
            detail={"after": "disabled", "reason": REASON},
        )
        audit_rows += 1
        deactivated.append(username)

after = tally()

print("BEFORE:", json.dumps(before, ensure_ascii=False))
print("AFTER :", json.dumps(after, ensure_ascii=False))
print("matched_children:", len(children), sorted(c.name for c in children))
print("closed_families:", len(closed_families), sorted(f[:8] for f in closed_families))
print("archived_children:", len(archived_children))
print("retired_questionnaires:", len(retired_qv), retired_qv)
print("retired_activities:", len(retired_acv), retired_acv)
print("deactivated_accounts:", len(deactivated), sorted(deactivated))
print("audit_rows_added:", audit_rows)
print(
    "published QV now:",
    sorted(f"{q.code}/v{q.version}" for q in QuestionnaireVersion.objects.filter(status="published")),
)
print(
    "published ACV now:",
    sorted(f"{a.code}/v{a.version}" for a in ActivityContentVersion.objects.filter(status="published")),
)
print(
    "active children now:",
    sorted(Child.objects.filter(status="active").values_list("name", flat=True)),
)
print("active families now:", Family.objects.filter(status="active").count())
print(
    "active staff now:",
    sorted(User.objects.filter(is_staff=True, is_active=True).values_list("username", flat=True)),
)
