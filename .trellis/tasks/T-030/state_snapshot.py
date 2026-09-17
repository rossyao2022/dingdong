"""T-030：批次状态快照（处置前后各跑一次，作为库内状态证据）。

    cd backend && uv run python manage.py shell < ../.trellis/tasks/T-030/state_snapshot.py
"""

from django.contrib.auth import get_user_model

from dingdong_ca.core.assessment_models import (
    BackgroundJob,
    ConsentGrant,
    ProfileSnapshot,
    ReportVersion,
)
from dingdong_ca.core.integration_models import (
    ExternalAssociation,
    ObservationBatch,
    SyncCheckpoint,
)
from dingdong_ca.core.models import Child, Family, FamilyMembership, LoginGrant

CHILD_ID = "0a4055e4-ffc8-41f2-a8a1-dcc06c85deca"
PARENT_PHONE = "+8613748001381"

User = get_user_model()
child = Child.objects.get(pk=CHILD_ID)
family = Family.objects.get(pk=child.family_id)
parent = User.objects.get(account_kind="parent", phone=PARENT_PHONE)
assoc = ExternalAssociation.objects.get(child=child)
checkpoint = SyncCheckpoint.objects.get(association=assoc)
membership = FamilyMembership.objects.filter(family=family).first()
grant = LoginGrant.objects.filter(user=parent).order_by("-created_at").first()
consent = ConsentGrant.objects.filter(child=child).first()

print(f"Child {child.pk} name={child.name!r} status={child.status!r}")
print(f"Family {family.pk} status={family.status!r}")
print(f"User {parent.pk} phone={parent.phone!r} is_active={parent.is_active!r}")
print(f"FamilyMembership {membership.pk} ended_at={membership.ended_at!r}")
print(f"LoginGrant {grant.pk} revoked_at={grant.revoked_at!r} expires_at={grant.expires_at!r}")
print(f"ConsentGrant {consent.pk} revoked_at={consent.revoked_at!r}")
print(f"ExternalAssociation {assoc.pk} status={assoc.status!r} ended_at={assoc.ended_at!r}")
print(
    f"SyncCheckpoint {checkpoint.pk} status={checkpoint.status!r} "
    f"cursor={checkpoint.cursor} error_code={checkpoint.error_code!r} "
    f"next_due_at={checkpoint.next_due_at!r}"
)
for job in BackgroundJob.objects.filter(association=assoc).order_by("kind", "status"):
    print(
        f"BackgroundJob {job.kind}/{job.status} attempt_count={job.attempt_count} "
        f"error_code={job.error_code!r}"
    )
print(f"ObservationBatch {ObservationBatch.objects.filter(association=assoc).count()} 条")
print(f"ProfileSnapshot {ProfileSnapshot.objects.filter(child=child).count()} 条")
print(f"ReportVersion {ReportVersion.objects.filter(profile__child=child).count()} 条")

# 运营端首页口径（与 ops/services.py dashboard_data 一致）
print(f"[ops] 家庭总数(active)={Family.objects.filter(status='active').count()}")
print(f"[ops] 在册儿童(active)={Child.objects.filter(status='active').count()}")
print(f"[ops] failed_jobs={BackgroundJob.objects.filter(status='failed').count()}")
