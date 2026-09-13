"""v0.3.4 本地验收环境清理：只做状态变更，保留并补写审计。"""
import json

from django.contrib.auth import get_user_model
from django.db import transaction

from dingdong_ca.core.models import ActivityContentVersion, AuditEvent, Child, Family, FamilyMembership
from dingdong_ca.core.assessment_models import QuestionnaireVersion

User = get_user_model()
REASON = "v0.3.4 本地验收后清理测试数据（状态变更，未删除记录）"

KEEP_FAMILY_PREFIXES = {"c6f180f9", "662228c6"}  # 合成儿童1 / 合成儿童2
TEST_STAFF_PREFIXES = ("local-accept-",)
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
targets = [f for f in Family.objects.all() if str(f.id)[:8] not in KEEP_FAMILY_PREFIXES]
assert len(targets) == 13, f"expected 13 test families, got {len(targets)}"

closed, archived, retired_qv, retired_acv, deactivated, audit_rows = [], [], [], [], [], 0

with transaction.atomic():
    for fam in targets:
        owner = (
            FamilyMembership.objects.select_related("user")
            .filter(family=fam, ended_at__isnull=True)
            .first()
        )
        if owner and owner.user.is_active and not owner.user.is_staff:
            User.objects.filter(pk=owner.user.pk).update(is_active=False)
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
            archived.append(str(child.id))
        if fam.status == "active":
            Family.objects.filter(pk=fam.pk).update(status="closed")
            AuditEvent.objects.create(
                action="family.freeze",
                target_kind="family",
                target_id=fam.pk,
                target_label=f"本地验收测试家庭 {str(fam.pk)[:8]}",
                detail={"before": "active", "after": "closed", "reason": REASON},
            )
            audit_rows += 1
            closed.append(str(fam.id))

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

    # 注意：Django 的 startswith 不接受元组，这里逐个前缀查询
    staff_qs = User.objects.none()
    for prefix in TEST_STAFF_PREFIXES:
        staff_qs = staff_qs | User.objects.filter(username__startswith=prefix)
    for u in staff_qs.filter(is_active=True):
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
print("closed_families:", len(closed))
print("archived_children:", len(archived))
print("retired_questionnaires:", len(retired_qv))
print("retired_activities:", len(retired_acv))
print("deactivated_accounts:", len(deactivated), sorted(deactivated))
print("audit_rows_added:", audit_rows)
print("published QV now:", sorted(f"{q.code}/v{q.version}" for q in QuestionnaireVersion.objects.filter(status="published")))
print("published ACV now:", sorted(f"{a.code}/v{a.version}" for a in ActivityContentVersion.objects.filter(status="published")))
print("active children now:", sorted(Child.objects.filter(status="active").values_list("name", flat=True)))
print("active families now:", Family.objects.filter(status="active").count())
