import hashlib
import json
from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from dingdong_ca.core.models import (
    BackgroundJob,
    Child,
    ConsentGrant,
    ExternalAssociation,
    FamilyMembership,
    JobObservation,
    ObservationBatch,
    ProfileObservation,
    ProfileSnapshot,
    ReportTemplateVersion,
    RuleVersion,
    SyncCheckpoint,
)
from dingdong_ca.testsupport.adapter import FixtureFailure


def lock_association(ident):
    initial = ExternalAssociation.objects.get(pk=ident)
    Child.objects.select_for_update().get(pk=initial.child_id)
    ConsentGrant.objects.select_for_update().get(pk=initial.consent_grant_id)
    return ExternalAssociation.objects.select_for_update().get(pk=ident)


def association_authorized(a):
    c = a.consent_grant
    return (
        a.status == "verified"
        and c.revoked_at is None
        and c.child_id == a.child_id
        and c.purpose == "dingdong_sync"
        and a.child.status == "active"
        and a.child.family.status == "active"
        and a.requested_by.is_active
        and FamilyMembership.objects.filter(
            user=a.requested_by, family=a.child.family, ended_at__isnull=True
        ).exists()
    )


def schedule_sync(ident):
    with transaction.atomic():
        a = lock_association(ident)
        check = SyncCheckpoint.objects.select_for_update().get(association=a)
        if not association_authorized(a) or check.status != "enabled":
            return None
        old = BackgroundJob.objects.filter(
            association=a, kind="sync", status__in=["pending", "running", "waiting", "failed"]
        ).first()
        if old:
            return old
        import uuid

        job = BackgroundJob.objects.create(
            kind="sync",
            association=a,
            business_key="sync:" + str(a.pk) + ":" + str(uuid.uuid4()),
            next_attempt_at=timezone.now(),
        )
        from dingdong_ca.core.tasks import publish_job

        transaction.on_commit(lambda: publish_job(str(job.pk)))
        return job


def enqueue_stage(observation, rule=None):
    # Each test observation is one complete, fixed-window aggregate, not an event stream.
    rule = rule or RuleVersion.objects.filter(code="stage-rule", status="published").first()
    key = "stage:" + str(observation.pk) + ":" + (str(rule.pk) if rule else "waiting")
    job, new = BackgroundJob.objects.get_or_create(
        business_key=key,
        defaults={
            "kind": "stage_profile",
            "association": observation.association,
            "rule_version": rule,
            "status": "pending" if rule else "waiting",
            "error_code": None if rule else "RULE_MISSING",
            "next_attempt_at": timezone.now(),
        },
    )
    if new:
        JobObservation.objects.create(job=job, observation=observation)
    from dingdong_ca.core.tasks import publish_job

    transaction.on_commit(lambda: publish_job(str(job.pk)))
    return job


def commit_observation(job, payload, cursor):
    checkpoint = SyncCheckpoint.objects.select_for_update().get(association=job.association)
    if checkpoint.cursor != cursor:
        raise FixtureFailure("CURSOR_CONFLICT")
    if payload:
        digest, latest, existing = inspect_observation(job.association, payload)
        if not existing:
            obs = ObservationBatch.objects.create(
                association=job.association,
                logical_key=payload["logical_key"],
                source_version=payload["source_version"],
                revision_no=payload["revision_no"],
                schema_version=payload["schema_version"],
                window_start=payload["window_start"],
                window_end=payload["window_end"],
                metrics=payload["metrics"],
                content_digest=digest,
                supersedes=latest,
            )
            enqueue_stage(obs)
        checkpoint.cursor += 1
    checkpoint.last_success_at = timezone.now()
    checkpoint.error_code = None
    checkpoint.next_due_at = timezone.now() + timedelta(minutes=5)
    checkpoint.save()


def build_stage(job):
    from dingdong_ca.testsupport.robot import require_fixture_mode

    require_fixture_mode()
    rows = list(JobObservation.objects.filter(job=job).select_related("observation"))
    if len(rows) != 1 or rows[0].observation.association_id != job.association_id:
        raise FixtureFailure("INPUT_INVALID")
    obs = rows[0].observation
    config = job.rule_version.config
    if (
        job.rule_version.data_origin != "synthetic"
        or not isinstance(config, dict)
        or set(config) != {"implementation", "multiplier"}
        or config["implementation"] != "test-count-v1"
        or type(config["multiplier"]) is not int
        or not 1 <= config["multiplier"] <= 10
    ):
        raise FixtureFailure("RULE_INVALID")
    return obs, [{**m, "value": m["value"] * config["multiplier"]} for m in obs.metrics]


def commit_stage(job, result):
    obs, metrics = result
    key = "stage:" + str(obs.pk) + ":" + str(job.rule_version_id)
    profile, new = ProfileSnapshot.objects.get_or_create(
        generation_key=key,
        defaults={
            "child_id": job.association.child_id,
            "kind": "stage",
            "rule_version": job.rule_version,
            "schema_version": "test-stage-profile-v1",
            "window_start": obs.window_start,
            "window_end": obs.window_end,
            "result": {"metrics": metrics},
            "data_origin": "synthetic",
            "produced_at": timezone.now(),
        },
    )
    if new:
        ProfileObservation.objects.create(profile=profile, observation=obs)
        template = ReportTemplateVersion.objects.filter(
            code="stage-report", status="published"
        ).first()
        report = BackgroundJob.objects.create(
            kind="report",
            profile=profile,
            association=job.association,
            template_version=template,
            business_key="stage-report:" + str(profile.pk),
            status="pending" if template else "waiting",
            error_code=None if template else "TEMPLATE_MISSING",
            next_attempt_at=timezone.now(),
        )
        from dingdong_ca.core.tasks import publish_job

        transaction.on_commit(lambda: publish_job(str(report.pk)))


def inspect_observation(association, payload):
    canonical = {k: v.isoformat() if hasattr(v, "isoformat") else v for k, v in payload.items()}
    digest = hashlib.sha256(
        json.dumps(canonical, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()
    latest = (
        ObservationBatch.objects.filter(association=association, logical_key=payload["logical_key"])
        .order_by("-revision_no")
        .first()
    )
    existing = ObservationBatch.objects.filter(
        association=association,
        logical_key=payload["logical_key"],
        source_version=payload["source_version"],
    ).first()
    if existing:
        if existing.content_digest != digest:
            raise FixtureFailure("SOURCE_CONFLICT")
    else:
        if latest and (
            payload["revision_no"] != latest.revision_no + 1
            or payload["window_start"] != latest.window_start
            or payload["window_end"] != latest.window_end
        ):
            raise FixtureFailure("SOURCE_CONFLICT")
        if not latest and payload["revision_no"] != 1:
            raise FixtureFailure("SOURCE_CONFLICT")
        overlap = (
            ObservationBatch.objects.filter(
                association=association,
                window_start__lt=payload["window_end"],
                window_end__gt=payload["window_start"],
            )
            .exclude(logical_key=payload["logical_key"])
            .exists()
        )
        if overlap:
            raise FixtureFailure("WINDOW_CONFLICT")
    return digest, latest, existing
