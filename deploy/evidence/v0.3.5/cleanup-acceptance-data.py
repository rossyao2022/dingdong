"""v0.3.5 公网验收后清理：只做状态变更（停用/归档/退役），不物理删除，保留并补写审计。

目标对象严格限定为本轮（v0.3.5 公网验收）由浏览器用例与准备脚本创建的隔离数据：
- 儿童：``冲突保留*``（家长端冲突恢复 5 项）、``P1跨入口*``（P1 跨入口 2 项）、
  ``P2验收隔离儿童*``（准备脚本建立的隔离家庭，含首次试跑失败留下的一个）。
- 内容：本轮 stamp 前缀为 ``mu0k`` 的题库/活动版本（P1 消歧、同名、版本替代与
  ops-public 题库/活动用例）。
- 临时工作人员：``acpt035_`` 三个账号。

既有合成演示家庭与真实业务对象一律不动。
"""

import json

from django.contrib.auth import get_user_model
from django.db import transaction

from dingdong_ca.core.assessment_models import QuestionnaireVersion
from dingdong_ca.core.models import (
    ActivityContentVersion,
    AuditEvent,
    Child,
    Family,
    FamilyMembership,
)

User = get_user_model()

REASON = "v0.3.5 公网验收后清理测试数据（状态变更，未删除记录）"

CHILD_NAME_PREFIXES = ("冲突保留", "P1跨入口", "P2验收隔离儿童", "独立复验")
TEST_STAFF_PREFIX = "acpt035_"

# 本轮创建、需要退役的题库版本（code, version）
RETIRE_QV = [
    ("qn-p1mu0kc4jeabc-c06650d352d9", "v1"),
    ("qn-p1mu0kc4jeabc-4d23f0012d71", "v1"),
    ("qn-p1mu0kcauw-8b6bc9c92157", "v1"),
    ("qn-p1mu0kcauw-8b6bc9c92157-2", "v1"),
    ("qn-p1mu0kchdr-296c39edfff2", "v2"),
    ("qn-mu0ke7q1-1d282445ac34", "v1"),
    ("qn-mu0ke7q1-1d282445ac34", "v2"),
    ("qn-mu0kebl5-f97b6cb3a350", "v1"),
    ("qn-mu0ki2dj-22405914f77f", "v1"),
    ("qn-mu0ki2dj-22405914f77f", "v2"),
    ("qn-mu0ki6ip-dfcff03d8937", "v1"),
]

# 本轮创建、需要退役的活动版本（code, version）
RETIRE_ACV = [
    ("act-p1mu0kcntkabc-8e4f1d39dae6", "v1"),
    ("act-p1mu0kcntkabc-9d4ecc0b1670", "v1"),
    ("act-mu0kehwn-4620ede151ec", "v1"),
    ("act-mu0kid42-cd7bc7a31658", "v1"),
]


def tally():
    return {
        "families_active": Family.objects.filter(status="active").count(),
        "children_active": Child.objects.filter(status="active").count(),
        "qv_published": QuestionnaireVersion.objects.filter(status="published").count(),
        "acv_published": ActivityContentVersion.objects.filter(status="published").count(),
        "staff_active": User.objects.filter(is_staff=True, is_active=True).count(),
        "audit": AuditEvent.objects.count(),
    }


before = tally()

children = [
    c for c in Child.objects.all() if c.name.startswith(CHILD_NAME_PREFIXES)
]
family_ids = {c.family_id for c in children}

retired_qv, retired_acv, archived_children, closed_families, deactivated = [], [], [], [], []
audit_rows = 0

with transaction.atomic():
    for child in children:
        if child.status != "archived":
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
        owner = (
            FamilyMembership.objects.select_related("user")
            .filter(family=fam, ended_at__isnull=True)
            .first()
        )
        if owner and owner.user.is_active and not owner.user.is_staff:
            owner.user.is_active = False
            owner.user.save(update_fields=["is_active"])
            deactivated.append(owner.user.username)
        if fam.status == "active":
            Family.objects.filter(pk=fam.pk).update(status="closed")
            AuditEvent.objects.create(
                action="family.freeze",
                target_kind="family",
                target_id=fam.pk,
                target_label=f"v0.3.5 验收测试家庭 {str(fam.pk)[:8]}",
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

after = tally()

print("BEFORE:", json.dumps(before, ensure_ascii=False))
print("AFTER :", json.dumps(after, ensure_ascii=False))
print("matched_children:", len(children), sorted(c.name for c in children))
print("closed_families:", len(closed_families), sorted(f[:8] for f in closed_families))
print("archived_children:", len(archived_children))
print("retired_questionnaires:", len(retired_qv), retired_qv)
print("retired_activities:", len(retired_acv), retired_acv)
print("deactivated_accounts:", len(deactivated), deactivated)
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
