"""M2 entities: initial assessment only; vendor/stage models will follow separately."""

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q

from .models import Entity


class PublishedVersion(Entity):
    code = models.CharField(max_length=64)
    version = models.CharField(max_length=32)
    status = models.CharField(max_length=16, default="draft")
    data_origin = models.CharField(max_length=16)
    published_at = models.DateTimeField(null=True)
    published_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.PROTECT)
    frozen_fields = ()

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        if self.pk:
            old = type(self).objects.filter(pk=self.pk).first()
            if old and old.status in ["published", "retired"]:
                if self.status not in ["published", "retired"] or any(
                    getattr(old, k) != getattr(self, k)
                    for k in ("code", "version", "data_origin", *self.frozen_fields)
                ):
                    raise ValidationError("published 内容不可原地修改；请创建新版本")
        return super().save(*args, **kwargs)


class PolicyVersion(PublishedVersion):
    purpose = models.CharField(max_length=32)
    body = models.TextField()
    frozen_fields = ("purpose", "body")

    class Meta:
        db_table = "policy_version"
        constraints = [
            models.UniqueConstraint(fields=["purpose", "version"], name="policy_version_unique"),
            models.UniqueConstraint(
                fields=["purpose"], condition=Q(status="published"), name="policy_one_published"
            ),
            models.CheckConstraint(
                condition=Q(purpose__in=["assessment_processing", "dingdong_sync"]),
                name="policy_purpose_valid",
            ),
        ]


class ConsentGrant(Entity):
    child = models.ForeignKey("Child", on_delete=models.PROTECT)
    granted_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    policy_version = models.ForeignKey(PolicyVersion, on_delete=models.PROTECT)
    purpose = models.CharField(max_length=32)
    create_request_key = models.UUIDField()
    revoked_at = models.DateTimeField(null=True)

    class Meta:
        db_table = "consent_grant"
        constraints = [
            models.UniqueConstraint(
                fields=["granted_by", "create_request_key"], name="consent_create_unique"
            ),
            models.UniqueConstraint(
                fields=["child", "purpose"],
                condition=Q(revoked_at__isnull=True),
                name="consent_one_active",
            ),
        ]


class QuestionnaireVersion(PublishedVersion):
    purpose = models.CharField(
        max_length=24,
        default="assessment",
        choices=[("exploration", "探索偏好体验"), ("assessment", "正式测评流程（测试）")],
    )
    title = models.CharField(max_length=160, default="日常情境问卷（测试）")
    description = models.TextField(default="仅用于测试流程，非专业量表，不作能力评价。")
    schema_version = models.CharField(max_length=32, default="questionnaire-v1")
    questions = models.JSONField(default=list, blank=True)
    # 修订号：运营后台保存草稿时用它做乐观并发控制，防止旧页面静默覆盖别人的修改。
    # 系统字段：不出现在任何表单里，由接口在事务内维护。
    revision = models.PositiveBigIntegerField(default=1, editable=False)
    # 新建请求幂等键：双击或重试不会产生两份内容。
    create_request_key = models.UUIDField(null=True, blank=True, editable=False)
    frozen_fields = ("schema_version", "questions", "purpose", "title", "description")

    def __str__(self):
        return f"{self.title} · {self.version}"

    class Meta:
        verbose_name = "题库版本"
        verbose_name_plural = "题库管理"
        db_table = "questionnaire_version"
        constraints = [
            models.UniqueConstraint(
                fields=["code", "version"], name="questionnaire_version_unique"
            ),
            models.UniqueConstraint(
                fields=["code"], condition=Q(status="published"), name="questionnaire_one_published"
            ),
            models.UniqueConstraint(
                fields=["create_request_key"],
                condition=Q(create_request_key__isnull=False),
                name="questionnaire_create_request_unique",
            ),
        ]


class ReportTemplateVersion(PublishedVersion):
    template = models.JSONField()
    frozen_fields = ("template",)

    class Meta:
        db_table = "report_template_version"
        constraints = [
            models.UniqueConstraint(fields=["code", "version"], name="template_version_unique"),
            models.UniqueConstraint(
                fields=["code"], condition=Q(status="published"), name="template_one_published"
            ),
        ]


class AssessmentSession(Entity):
    child = models.ForeignKey("Child", on_delete=models.PROTECT)
    started_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    consent_grant = models.ForeignKey(ConsentGrant, on_delete=models.PROTECT)
    questionnaire_version = models.ForeignKey(QuestionnaireVersion, on_delete=models.PROTECT)
    create_request_key = models.UUIDField()
    status = models.CharField(max_length=24, default="draft")
    answers = models.JSONField(default=dict)
    input_context = models.JSONField(default=dict)
    revision = models.PositiveBigIntegerField(default=1)
    submitted_at = models.DateTimeField(null=True)
    completed_at = models.DateTimeField(null=True)
    expires_at = models.DateTimeField()

    class Meta:
        db_table = "assessment_session"
        constraints = [
            models.UniqueConstraint(
                fields=["started_by", "create_request_key"], name="assessment_create_unique"
            ),
            models.CheckConstraint(
                condition=Q(
                    status__in=[
                        "draft",
                        "ready",
                        "processing",
                        "needs_recapture",
                        "result_unknown",
                        "completed",
                        "cancelled",
                        "expired",
                    ]
                ),
                name="assessment_status_valid",
            ),
        ]
        indexes = [models.Index(fields=["child", "created_at"])]


class AlgorithmAttempt(Entity):
    session = models.ForeignKey(AssessmentSession, on_delete=models.PROTECT)
    attempt_no = models.PositiveIntegerField()
    request_id = models.UUIDField(unique=True)
    request_revision = models.PositiveBigIntegerField()
    provider = models.CharField(max_length=64, default="database_fixture")
    algorithm_version = models.CharField(max_length=128, null=True)
    status = models.CharField(max_length=24, default="running")
    started_at = models.DateTimeField()
    deadline_at = models.DateTimeField()
    finished_at = models.DateTimeField(null=True)
    error_code = models.CharField(max_length=64, null=True)

    class Meta:
        db_table = "algorithm_attempt"
        constraints = [
            models.UniqueConstraint(fields=["session", "attempt_no"], name="attempt_number_unique"),
            models.UniqueConstraint(
                fields=["session"],
                condition=Q(status__in=["prepared", "running", "unknown"]),
                name="attempt_one_active",
            ),
            models.CheckConstraint(
                condition=Q(
                    status__in=[
                        "prepared",
                        "running",
                        "succeeded",
                        "failed",
                        "unknown",
                        "cancelled",
                    ]
                ),
                name="attempt_status_valid",
            ),
        ]


class ImmutableResult(Entity):
    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise ValidationError("结果不可原地修改")
        return super().save(*args, **kwargs)


class ProfileSnapshot(ImmutableResult):
    child = models.ForeignKey("Child", on_delete=models.PROTECT)
    kind = models.CharField(max_length=16, default="initial")
    algorithm_attempt = models.OneToOneField(AlgorithmAttempt, null=True, on_delete=models.PROTECT)
    schema_version = models.CharField(max_length=32)
    result = models.JSONField()
    data_origin = models.CharField(max_length=16)
    produced_at = models.DateTimeField()

    rule_version = models.ForeignKey("RuleVersion", null=True, on_delete=models.PROTECT)
    window_start = models.DateTimeField(null=True)
    window_end = models.DateTimeField(null=True)
    generation_key = models.CharField(max_length=255, null=True, unique=True)

    class Meta:
        db_table = "profile_snapshot"
        indexes = [models.Index(fields=["child", "produced_at"])]
        constraints = [
            models.CheckConstraint(
                condition=Q(
                    kind="initial",
                    algorithm_attempt__isnull=False,
                    rule_version__isnull=True,
                    window_start__isnull=True,
                    window_end__isnull=True,
                )
                | Q(
                    kind="stage",
                    algorithm_attempt__isnull=True,
                    rule_version__isnull=False,
                    window_start__isnull=False,
                    window_end__gt=models.F("window_start"),
                ),
                name="profile_source_valid",
            )
        ]


class BackgroundJob(Entity):
    kind = models.CharField(max_length=32, default="report")
    profile = models.ForeignKey(ProfileSnapshot, null=True, on_delete=models.PROTECT)
    association = models.ForeignKey("ExternalAssociation", null=True, on_delete=models.PROTECT)
    rule_version = models.ForeignKey("RuleVersion", null=True, on_delete=models.PROTECT)
    template_version = models.ForeignKey(ReportTemplateVersion, null=True, on_delete=models.PROTECT)
    business_key = models.CharField(max_length=255, unique=True)
    status = models.CharField(max_length=24, default="pending")
    attempt_count = models.PositiveIntegerField(default=0)
    max_attempts = models.PositiveIntegerField(default=5)
    next_attempt_at = models.DateTimeField(null=True)
    execution_token = models.UUIDField(null=True)
    lease_expires_at = models.DateTimeField(null=True)
    finished_at = models.DateTimeField(null=True)
    error_code = models.CharField(max_length=64, null=True)

    class Meta:
        db_table = "background_job"
        constraints = [
            models.CheckConstraint(
                condition=Q(
                    status__in=[
                        "pending",
                        "running",
                        "waiting",
                        "unknown",
                        "succeeded",
                        "failed",
                        "cancelled",
                    ]
                ),
                name="job_status_valid",
            )
        ]
        indexes = [models.Index(fields=["status", "next_attempt_at"])]


class JobAttempt(Entity):
    job = models.ForeignKey(BackgroundJob, on_delete=models.PROTECT)
    attempt_no = models.PositiveIntegerField()
    execution_token = models.UUIDField(unique=True)
    status = models.CharField(max_length=16)
    started_at = models.DateTimeField()
    finished_at = models.DateTimeField(null=True)
    error_code = models.CharField(max_length=64, null=True)

    class Meta:
        db_table = "job_attempt"
        constraints = [
            models.UniqueConstraint(fields=["job", "attempt_no"], name="job_attempt_unique")
        ]


class ReportVersion(ImmutableResult):
    profile = models.ForeignKey(ProfileSnapshot, on_delete=models.PROTECT)
    template_version = models.ForeignKey(ReportTemplateVersion, on_delete=models.PROTECT)
    content_schema_version = models.CharField(max_length=32, default="report-v1")
    content = models.JSONField()
    data_origin = models.CharField(max_length=16)
    generated_at = models.DateTimeField()

    class Meta:
        db_table = "report_version"
        constraints = [
            models.UniqueConstraint(
                fields=["profile", "template_version"], name="report_input_unique"
            )
        ]
