"""T-030：列出 synthetic.dispose 审计行的 detail（文案修正前后各跑一次）。

    cd backend && uv run python manage.py shell < ../.trellis/tasks/T-030/audit_rows_snapshot.py
"""

from django.contrib.auth import get_user_model

from dingdong_ca.core.models import AuditEvent, LoginGrant

PARENT_PHONE = "+8613748001381"

User = get_user_model()
parent = User.objects.get(account_kind="parent", phone=PARENT_PHONE)

print(f"AuditEvent(synthetic.dispose)={AuditEvent.objects.filter(action='synthetic.dispose').count()}")
for row in AuditEvent.objects.filter(action="synthetic.dispose").order_by("created_at"):
    print(f"{row.target_kind}/{row.pk} detail={row.detail}")

live = LoginGrant.objects.filter(user=parent, revoked_at__isnull=True)
print(f"家长未失效登录凭据={live.count()} 条")
for grant in live:
    print(f"  login_grant/{grant.pk} created_at={grant.created_at!r}")
print(f"家长 is_active={parent.is_active!r}")
