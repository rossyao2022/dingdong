from django.conf import settings
from django.db import models
from django.db.models import Q

from .assessment_models import ImmutableResult, PublishedVersion
from .models import Entity


class ExternalAssociation(Entity):
    child = models.ForeignKey("Child", on_delete=models.PROTECT)
    requested_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    consent_grant = models.ForeignKey("ConsentGrant", on_delete=models.PROTECT)
    create_request_key = models.UUIDField()
    proof_digest = models.CharField(max_length=64)
    provider = models.CharField(max_length=32, default="dingdong")
    external_subject_id = models.CharField(max_length=255)
    subject_kind = models.CharField(max_length=32, default="test_child")
    status = models.CharField(max_length=16, default="verified")
    verified_at = models.DateTimeField()
    ended_at = models.DateTimeField(null=True)
    data_origin = models.CharField(max_length=16, default="synthetic")

    class Meta:
        db_table = "external_association"
        constraints = [
            models.UniqueConstraint(
                fields=["requested_by", "create_request_key"], name="association_create_unique"
            ),
            models.UniqueConstraint(
                fields=["child", "provider"],
                condition=Q(status="verified"),
                name="child_one_association",
            ),
            models.UniqueConstraint(
                fields=["provider", "subject_kind", "external_subject_id"],
                condition=Q(status="verified"),
                name="subject_one_association",
            ),
            models.CheckConstraint(
                condition=Q(status="verified", ended_at__isnull=True)
                | Q(status="revoked", ended_at__isnull=False),
                name="association_end_valid",
            ),
        ]


class SyncCheckpoint(Entity):
    association = models.OneToOneField(ExternalAssociation, on_delete=models.PROTECT)
    status = models.CharField(max_length=16, default="enabled")
    cursor = models.PositiveBigIntegerField(default=0)
    last_success_at = models.DateTimeField(null=True)
    next_due_at = models.DateTimeField(null=True)
    error_code = models.CharField(max_length=64, null=True)

    class Meta:
        db_table = "sync_checkpoint"


class ObservationBatch(ImmutableResult):
    association = models.ForeignKey(ExternalAssociation, on_delete=models.PROTECT)
    logical_key = models.CharField(max_length=128)
    source_version = models.CharField(max_length=64)
    revision_no = models.PositiveIntegerField()
    schema_version = models.CharField(max_length=32, default="test-observation-v1")
    window_start = models.DateTimeField()
    window_end = models.DateTimeField()
    metrics = models.JSONField()
    content_digest = models.CharField(max_length=64)
    supersedes = models.ForeignKey("self", null=True, on_delete=models.PROTECT)

    class Meta:
        db_table = "observation_batch"
        constraints = [
            models.UniqueConstraint(
                fields=["association", "logical_key", "revision_no"],
                name="observation_revision_unique",
            ),
            models.UniqueConstraint(
                fields=["association", "logical_key", "source_version"],
                name="observation_source_unique",
            ),
            models.CheckConstraint(
                condition=Q(window_end__gt=models.F("window_start")),
                name="observation_window_valid",
            ),
        ]


class RuleVersion(PublishedVersion):
    config = models.JSONField()
    frozen_fields = ("config",)

    class Meta:
        db_table = "rule_version"
        constraints = [
            models.UniqueConstraint(fields=["code", "version"], name="rule_version_unique"),
            models.UniqueConstraint(
                fields=["code"], condition=Q(status="published"), name="rule_one_published"
            ),
        ]


class ProfileObservation(Entity):
    profile = models.ForeignKey("ProfileSnapshot", on_delete=models.CASCADE)
    observation = models.ForeignKey(ObservationBatch, on_delete=models.PROTECT)

    class Meta:
        db_table = "profile_observation"
        constraints = [
            models.UniqueConstraint(
                fields=["profile", "observation"], name="profile_observation_unique"
            )
        ]


class JobObservation(Entity):
    job = models.ForeignKey("BackgroundJob", on_delete=models.CASCADE)
    observation = models.ForeignKey(ObservationBatch, on_delete=models.PROTECT)

    class Meta:
        db_table = "job_observation"
        constraints = [
            models.UniqueConstraint(fields=["job", "observation"], name="job_observation_unique")
        ]


class DataRequest(Entity):
    child = models.ForeignKey("Child", null=True, on_delete=models.SET_NULL)
    requester = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    create_request_key = models.UUIDField()
    kind = models.CharField(max_length=16)
    reason_code = models.CharField(max_length=32)
    status = models.CharField(max_length=16, default="open")
    resolution_code = models.CharField(max_length=32, null=True)
    resolution_note = models.CharField(max_length=500, blank=True, default="")
    completed_at = models.DateTimeField(null=True)

    class Meta:
        db_table = "data_request"
        constraints = [
            models.UniqueConstraint(
                fields=["requester", "create_request_key"], name="data_request_create_unique"
            )
        ]


class DingDongPushEvent(Entity):
    """DingDong → CA 主动推送的入站事件（Prototype webhook）。

    对方在互动里程碑（每 3 次有效对话）POST 该时刻完整 Prototype Insights，
    合同见 `材料/文档/DingDong_CA_Prototype_Demo_Logic_v1.0.docx` §7–§9。
    幂等以 ``event_id`` 为准：网络重试导致同一事件多次到达时只落一条，
    但每次都回 2xx，让对方的 outbox 补偿投递停止。
    """

    event_id = models.CharField(max_length=64, unique=True)
    event_type = models.CharField(max_length=64, blank=True, default="")
    # payload 原文里的 occurred_at / data.ca_account_id 提列为冗余列，
    # 供运营查询与后续展示面消费；解析不到就留空，不以提取成败定接收成败。
    ca_account_id = models.CharField(max_length=64, blank=True, default="")
    occurred_at = models.CharField(max_length=64, blank=True, default="")
    payload = models.JSONField()
    processing_status = models.CharField(max_length=16, default="received")
    processing_error = models.CharField(max_length=64, blank=True, default="")

    class Meta:
        db_table = "dingdong_push_event"
        indexes = [models.Index(fields=["created_at"])]
        constraints = [
            models.CheckConstraint(
                condition=Q(processing_status__in=["received", "processed", "ignored", "invalid"]),
                name="dingdong_push_processing_valid",
            ),
        ]


class PrototypeReportSnapshot(ImmutableResult):
    """Validated shared mock source, never a formal child assessment report."""

    source_account_id = models.CharField(max_length=64)
    weekly_turns = models.PositiveSmallIntegerField()
    source_updated_at = models.DateTimeField()
    sync_source = models.CharField(max_length=8)
    event = models.OneToOneField(DingDongPushEvent, null=True, on_delete=models.PROTECT)
    content_hash = models.CharField(max_length=64)
    view = models.JSONField()

    class Meta:
        db_table = "prototype_report_snapshot"
        verbose_name = verbose_name_plural = "演示伙伴报告快照"
        indexes = [models.Index(fields=["weekly_turns", "-source_updated_at"])]
        constraints = [
            models.CheckConstraint(
                condition=Q(weekly_turns__in=[3, 7, 14, 21]), name="prototype_weekly_valid"
            ),
            models.CheckConstraint(
                condition=Q(sync_source__in=["pull", "push"]), name="prototype_sync_source_valid"
            ),
            models.CheckConstraint(
                condition=Q(source_account_id="ca_dingdong"), name="prototype_fixed_source_valid"
            ),
            models.CheckConstraint(
                condition=Q(sync_source="pull", event__isnull=True)
                | Q(sync_source="push", event__isnull=False),
                name="prototype_event_source_valid",
            ),
            models.UniqueConstraint(
                fields=["weekly_turns", "content_hash"],
                condition=Q(sync_source="pull"),
                name="prototype_pull_content_unique",
            ),
        ]
