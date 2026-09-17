import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q


class Entity(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Family(Entity):
    status = models.CharField(max_length=16, default="active")

    class Meta:
        db_table = "family"
        constraints = [
            models.CheckConstraint(
                condition=Q(status__in=["active", "frozen", "closed"]), name="family_status_valid"
            )
        ]


class FamilyMembership(Entity):
    family = models.ForeignKey(Family, on_delete=models.PROTECT)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    role = models.CharField(max_length=16, default="owner")
    ended_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "family_membership"
        constraints = [
            models.UniqueConstraint(
                fields=["family"], condition=Q(ended_at__isnull=True), name="family_one_owner"
            ),
            models.UniqueConstraint(
                fields=["user"], condition=Q(ended_at__isnull=True), name="parent_one_family"
            ),
            models.CheckConstraint(condition=Q(role="owner"), name="membership_role_owner"),
        ]


class SmsChallenge(Entity):
    phone = models.CharField(max_length=16)
    client_ip = models.GenericIPAddressField()
    purpose = models.CharField(max_length=24, default="login")
    code_digest = models.CharField(max_length=64, null=True)
    status = models.CharField(max_length=16, default="sent")
    failed_attempts = models.PositiveSmallIntegerField(default=0)
    expires_at = models.DateTimeField()
    consumed_at = models.DateTimeField(null=True)

    class Meta:
        db_table = "sms_challenge"
        indexes = [
            models.Index(fields=["phone", "created_at"]),
            models.Index(fields=["client_ip", "created_at"]),
            models.Index(fields=["expires_at"]),
        ]
        constraints = [
            models.CheckConstraint(condition=Q(failed_attempts__lte=5), name="sms_attempt_limit"),
            models.CheckConstraint(
                condition=Q(status__in=["sent", "consumed", "expired", "locked"]),
                name="sms_status_valid",
            ),
        ]


class LoginGrant(Entity):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    current_refresh_jti = models.UUIDField(unique=True)
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True)
    revoke_reason = models.CharField(max_length=32, blank=True)
    last_refreshed_at = models.DateTimeField(null=True)

    class Meta:
        db_table = "login_grant"
        indexes = [models.Index(fields=["user", "created_at"]), models.Index(fields=["expires_at"])]


class Child(Entity):
    family = models.ForeignKey(Family, on_delete=models.PROTECT)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    create_request_key = models.UUIDField()
    # Immutable original request supports idempotent retries after later profile edits.
    create_payload = models.JSONField()
    name = models.CharField(max_length=80)
    gender = models.CharField(max_length=16, default="unknown")
    birth_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=16, default="active")
    # 修订号：任何入口（家长端、运营后台、技术后台、内部任务）更正档案时都前进，
    # 旧页面据此被拒绝，避免静默覆盖别人刚保存的修改。
    revision = models.PositiveBigIntegerField(default=1, editable=False)

    class Meta:
        db_table = "child"
        indexes = [models.Index(fields=["family", "status", "created_at"])]
        constraints = [
            models.UniqueConstraint(
                fields=["created_by", "create_request_key"], name="child_create_idempotent"
            ),
            models.CheckConstraint(
                condition=Q(gender__in=["unknown", "male", "female"]), name="child_gender_valid"
            ),
            models.CheckConstraint(
                condition=Q(status__in=["active", "archived"]), name="child_status_valid"
            ),
        ]


class ActivityContentVersion(Entity):
    code = models.CharField(max_length=64)
    version = models.CharField(max_length=32)
    title = models.CharField(max_length=120)
    island = models.CharField(max_length=32)
    mood = models.CharField(max_length=32)
    duration_minutes = models.PositiveSmallIntegerField()
    content = models.JSONField()
    status = models.CharField(max_length=16, default="draft")
    data_origin = models.CharField(max_length=16)
    published_at = models.DateTimeField(null=True)
    published_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.PROTECT)
    # 修订号：与题库一致，保存草稿时做乐观并发控制；防止旧页面静默覆盖。
    revision = models.PositiveBigIntegerField(default=1)
    create_request_key = models.UUIDField(null=True, blank=True)

    class Meta:
        db_table = "activity_content_version"
        constraints = [
            models.UniqueConstraint(fields=["code", "version"], name="activity_version_unique"),
            models.UniqueConstraint(
                fields=["code"], condition=Q(status="published"), name="activity_one_published"
            ),
            models.UniqueConstraint(
                fields=["create_request_key"],
                condition=Q(create_request_key__isnull=False),
                name="activity_create_request_unique",
            ),
            models.CheckConstraint(
                condition=Q(status__in=["draft", "published", "retired"]),
                name="activity_content_status",
            ),
            models.CheckConstraint(
                condition=Q(data_origin__in=["synthetic", "live"]), name="activity_origin"
            ),
            models.CheckConstraint(
                condition=Q(duration_minutes__gt=0), name="activity_duration_positive"
            ),
        ]


class ActivityRecord(Entity):
    child = models.ForeignKey(Child, on_delete=models.PROTECT)
    started_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    activity_version = models.ForeignKey(ActivityContentVersion, on_delete=models.PROTECT)
    create_request_key = models.UUIDField()
    mode = models.CharField(max_length=16)
    style = models.CharField(max_length=32)
    status = models.CharField(max_length=16, default="active")
    step_index = models.PositiveIntegerField(default=0)
    revision = models.PositiveBigIntegerField(default=1)
    started_at = models.DateTimeField()
    finished_at = models.DateTimeField(null=True)
    feedback = models.CharField(max_length=32, null=True)
    note = models.CharField(max_length=160, default="", blank=True)
    source = models.CharField(max_length=24, default="web_self_report")

    class Meta:
        db_table = "activity_record"
        indexes = [models.Index(fields=["child", "status", "finished_at"])]
        constraints = [
            models.UniqueConstraint(
                fields=["started_by", "create_request_key"], name="activity_create_idempotent"
            ),
            models.UniqueConstraint(
                fields=["child"], condition=Q(status="active"), name="child_one_active_activity"
            ),
            models.CheckConstraint(
                condition=Q(status__in=["active", "completed", "skipped"]),
                name="activity_record_status",
            ),
            models.CheckConstraint(
                condition=Q(mode__in=["guide", "web"]), name="activity_record_mode"
            ),
            models.CheckConstraint(
                condition=Q(source="web_self_report"), name="activity_source_web"
            ),
            models.CheckConstraint(
                condition=(
                    Q(status="active", finished_at__isnull=True)
                    | Q(status__in=["completed", "skipped"], finished_at__isnull=False)
                ),
                name="activity_finished_state",
            ),
            models.CheckConstraint(
                condition=~Q(status="skipped") | Q(note="", feedback__isnull=True),
                name="skipped_without_feedback",
            ),
            models.CheckConstraint(
                condition=Q(finished_at__isnull=True) | Q(finished_at__gte=models.F("started_at")),
                name="activity_time_order",
            ),
        ]


class AuditEvent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    action = models.CharField(max_length=64)
    target_kind = models.CharField(max_length=64)
    target_id = models.UUIDField(null=True)
    target_label = models.CharField(max_length=200, blank=True, default="")
    detail = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "audit_event"
        indexes = [
            models.Index(fields=["created_at"]),
            models.Index(fields=["action", "created_at"]),
        ]


# Register separated business models with Django's core app.
from .assessment_models import (  # noqa: E402,F401
    AlgorithmAttempt,
    AssessmentSession,
    BackgroundJob,
    ConsentGrant,
    JobAttempt,
    PolicyVersion,
    ProfileSnapshot,
    QuestionnaireVersion,
    ReportTemplateVersion,
    ReportVersion,
)
from .ca_models import CaAccount, CaReassessmentEvent  # noqa: E402,F401
from .integration_models import (  # noqa: E402,F401
    DataRequest,
    ExternalAssociation,
    JobObservation,
    ObservationBatch,
    ProfileObservation,
    RuleVersion,
    SyncCheckpoint,
)
