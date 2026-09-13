"""v0.3.4 验收后清理：只做状态变更（停用/归档/退役），不物理删除，保留并补写审计。"""
import json

from django.contrib.auth import get_user_model
from django.db import transaction

from dingdong_ca.core.models import ActivityContentVersion, AuditEvent, Child, Family, FamilyMembership
from dingdong_ca.core.assessment_models import QuestionnaireVersion

User = get_user_model()

REASON = "v0.3.4 公网验收后清理测试数据（状态变更，未删除记录）"

# 验收产生的测试家庭（其余为合成演示家庭，保留）
TEST_FAMILY_PREFIXES = """
238ee5d5 2735384c a2d7e4e2 d577147d c3cff958 ca5cb302 2a2bd447 d6f4e90e 6b7b04fd 9017e2d7
e8a68e12 331cb2db e4d4fb9f 893bd434 dec6d136 1baa3d09 7e837c2c 2a09c65c ba3c7d31 df26758a
9dd8a518 7a725602 100f92cd 09f84bd5 f68c7074 a817e8f1 ebba5eb5 cdea8c14
""".split()
TEST_STAFF_PREFIX = "acpt034_"
TEST_CONTENT_PREFIXES = ("pub-", "qn-", "pub-act-", "act-")


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
families = [f for f in Family.objects.all() if str(f.id)[:8] in TEST_FAMILY_PREFIXES]
assert len(families) == 28, f"expected 28 test families, got {len(families)}"

retired_qv, retired_acv, archived_children, closed_families, deactivated = [], [], [], [], []
audit_rows = 0

with transaction.atomic():
    for fam in families:
        owner = (
            FamilyMembership.objects.select_related("user")
            .filter(family=fam, ended_at__isnull=True)
            .first()
        )
        if owner and owner.user.is_active and not owner.user.is_staff:
            owner.user.is_active = False
            owner.user.save(update_fields=["is_active"])
            deactivated.append(owner.user.username)
        for child in Child.objects.filter(family=fam).exclude(status="archived"):
            Child.objects.filter(pk=child.pk).update(status="archived")
            AuditEvent.objects.create(
                action="child.profile_update",
                target_kind="child",
                target_id=child.pk,
                target_label=child.name[:200],
                detail={"before": "active", "after": "archived", "reason": REASON},
            )
            audit_rows += 1
            archived_children.append(str(child.id))
        if fam.status == "active":
            Family.objects.filter(pk=fam.pk).update(status="closed")
            AuditEvent.objects.create(
                action="family.freeze",
                target_kind="family",
                target_id=fam.pk,
                target_label=f"验收测试家庭 {str(fam.pk)[:8]}",
                detail={"before": "active", "after": "closed", "reason": REASON},
            )
            audit_rows += 1
            closed_families.append(str(fam.id))

    for q in QuestionnaireVersion.objects.exclude(status="retired"):
        if q.code.startswith(TEST_CONTENT_PREFIXES):
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
            retired_qv.append(f"{q.code}/v{q.version}")

    for a in ActivityContentVersion.objects.exclude(status="retired"):
        if a.code.startswith(TEST_CONTENT_PREFIXES):
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
            retired_acv.append(f"{a.code}/v{a.version}")

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
print("closed_families:", len(closed_families), closed_families)
print("archived_children:", len(archived_children))
print("retired_questionnaires:", len(retired_qv), retired_qv)
print("retired_activities:", len(retired_acv), retired_acv)
print("deactivated_accounts:", len(deactivated), deactivated)
print("audit_rows_added:", audit_rows)
print("published QV now:", [f"{q.code}/v{q.version}" for q in QuestionnaireVersion.objects.filter(status="published")])
print("published ACV now:", [f"{a.code}/v{a.version}" for a in ActivityContentVersion.objects.filter(status="published")])
print("active children now:", list(Child.objects.filter(status="active").values_list("name", flat=True)))
print("active families now:", Family.objects.filter(status="active").count())
