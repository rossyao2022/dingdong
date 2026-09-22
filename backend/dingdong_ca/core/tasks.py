"""Database-backed leased jobs; Redis messages carry only a job ID."""

import uuid
from datetime import timedelta

from celery import shared_task
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from kombu.exceptions import OperationalError

from dingdong_ca.core.models import (
    AlgorithmAttempt,
    AssessmentSession,
    BackgroundJob,
    Child,
    ExternalAssociation,
    JobAttempt,
    ReportTemplateVersion,
    ReportVersion,
    RuleVersion,
    SyncCheckpoint,
)
from dingdong_ca.core.services.assessments import authorized, finish_attempt, lock_session
from dingdong_ca.core.services.sync import (
    association_authorized,
    build_stage,
    commit_observation,
    commit_stage,
    lock_association,
)
from dingdong_ca.testsupport.adapter import FixtureFailure
from dingdong_ca.testsupport.models import TestFixture
from dingdong_ca.testsupport.robot import fetch_observation


def publish_job(job_id):
    try:
        run_report_job.delay(job_id)
    except (OperationalError, ConnectionError, OSError):
        pass


def lock_job(job_id):
    initial = BackgroundJob.objects.select_related("profile__algorithm_attempt").get(pk=job_id)
    if initial.association_id:
        context = lock_association(initial.association_id)
    else:
        context = lock_session(initial.profile.algorithm_attempt.session_id)
    return BackgroundJob.objects.select_for_update().get(pk=job_id), context


def job_authorized(job, context):
    if job.association_id:
        return (
            association_authorized(context)
            and SyncCheckpoint.objects.filter(association=context, status="enabled").exists()
        )
    return authorized(context)


def bind_dependency(job):
    if job.kind == "stage_profile" and not job.rule_version_id:
        job.rule_version = RuleVersion.objects.filter(code="stage-rule", status="published").first()
        return bool(job.rule_version_id)
    if job.kind == "report" and not job.template_version_id:
        code = "stage-report" if job.profile.kind == "stage" else "initial-report"
        job.template_version = ReportTemplateVersion.objects.filter(
            code=code, status="published"
        ).first()
        return bool(job.template_version_id)
    return True


def render_report(job, child_id):
    with transaction.atomic():
        fault = (
            TestFixture.objects.select_for_update()
            .filter(
                dataset="phase1-v1",
                kind="fault",
                subject_key=str(child_id),
                consumed_at__isnull=True,
            )
            .first()
        )
        if fault and fault.payload.get("scenario") == "report_failure":
            remaining = fault.payload.get("remaining", 1)
            if type(remaining) is not int or not 1 <= remaining <= 5:
                raise FixtureFailure("FIXTURE_INVALID")
            fault.payload["remaining"] = remaining - 1
            if remaining == 1:
                fault.consumed_at = timezone.now()
            fault.save()
            raise_after = True
        else:
            raise_after = False
    if raise_after:
        raise FixtureFailure("RENDER_FAILED")
    t = job.template_version.template
    choices = []
    if job.profile.algorithm_attempt_id:
        session = job.profile.algorithm_attempt.session
        choices = [
            {
                "code": "choices",
                "title": "本次问卷选择",
                "paragraphs": [
                    q["title"]
                    + "："
                    + (
                        "、".join(
                            o["label"]
                            for o in q["options"]
                            if o["code"] in session.answers.get(q["code"], [])
                        )
                        or "未选择"
                    )
                    for q in session.questionnaire_version.questions
                ],
            }
        ]
    return {
        "sections": [
            {
                "code": "overview",
                "title": t["title"],
                "paragraphs": [
                    t["intro"],
                    *[
                        (
                            f"{m['label']}: 暂无数据"
                            if m["value"] is None
                            else f"{m['label']}: {m['value']} {m['unit']}"
                        )
                        for m in job.profile.result["metrics"]
                    ],
                ],
            },
            *choices,
        ],
        "source_summary": (
            f"题库：{session.questionnaire_version.title} / {session.questionnaire_version.version}。选择来自本次答卷。"
            if choices
            else "内容来自观察记录与本次答卷。"
        ),
    }


@shared_task
def run_report_job(job_id):
    # Name retained for M2 callers; supports sync/stage/report with the same lease protocol.
    try:
        with transaction.atomic():
            job, context = lock_job(job_id)
            if job.status != "pending" or (
                job.next_attempt_at and job.next_attempt_at > timezone.now()
            ):
                return
            if not job_authorized(job, context):
                job.status = "cancelled"
                job.error_code = "CONSENT_REVOKED_OR_PAUSED"
                job.save()
                return
            if not bind_dependency(job):
                job.status = "waiting"
                job.error_code = (
                    "RULE_MISSING" if job.kind == "stage_profile" else "TEMPLATE_MISSING"
                )
                job.save()
                return
            token = uuid.uuid4()
            now = timezone.now()
            job.status = "running"
            job.execution_token = token
            job.attempt_count += 1
            job.lease_expires_at = now + timedelta(seconds=60)
            job.save()
            JobAttempt.objects.create(
                job=job,
                attempt_no=job.attempt_count,
                execution_token=token,
                status="running",
                started_at=now,
            )
            cursor = (
                SyncCheckpoint.objects.get(association=job.association).cursor
                if job.kind == "sync"
                else None
            )
        error = None
        result = None
        try:
            if job.kind == "sync":
                result = fetch_observation(context, cursor)
            elif job.kind == "stage_profile":
                result = build_stage(job)
            elif job.kind == "report":
                result = render_report(job, context.child_id)
            else:
                raise FixtureFailure("JOB_KIND_INVALID")
        except FixtureFailure as e:
            error = e.code
        except (KeyError, TypeError, ValueError):
            error = "INPUT_SCHEMA_INVALID"
        with transaction.atomic():
            job, context = lock_job(job_id)
            if job.status != "running" or job.execution_token != token:
                return
            now = timezone.now()
            if not job_authorized(job, context):
                job.status = "cancelled"
                error = "CONSENT_REVOKED_OR_PAUSED"
            elif job.lease_expires_at <= now:
                error = "LEASE_EXPIRED"
            if not error:
                try:
                    # A savepoint prevents partially committed result/source/checkpoint sets.
                    with transaction.atomic():
                        if job.kind == "sync":
                            commit_observation(job, result, cursor)
                        elif job.kind == "stage_profile":
                            commit_stage(job, result)
                        else:
                            ReportVersion.objects.get_or_create(
                                profile=job.profile,
                                template_version=job.template_version,
                                defaults={
                                    "content": result,
                                    "data_origin": job.profile.data_origin,
                                    "generated_at": now,
                                },
                            )
                    job.status = "succeeded"
                except FixtureFailure as e:
                    error = e.code
            if error and job.status != "cancelled":
                job.status = (
                    "pending"
                    if job.attempt_count < job.max_attempts
                    and error
                    not in [
                        "SOURCE_CONFLICT",
                        "WINDOW_CONFLICT",
                        "UPSTREAM_SCHEMA_INVALID",
                        "RULE_INVALID",
                        "INPUT_SCHEMA_INVALID",
                    ]
                    else "failed"
                )
            if error and job.kind == "sync":
                SyncCheckpoint.objects.filter(association=job.association).update(error_code=error)
            JobAttempt.objects.filter(execution_token=token).update(
                status="succeeded" if job.status == "succeeded" else "failed",
                finished_at=now,
                error_code=error,
            )
            job.error_code = error
            job.execution_token = None
            job.lease_expires_at = None
            job.next_attempt_at = now + timedelta(seconds=10) if job.status == "pending" else None
            job.finished_at = None if job.status == "pending" else now
            job.save()
    except (
        BackgroundJob.DoesNotExist,
        AssessmentSession.DoesNotExist,
        Child.DoesNotExist,
        ExternalAssociation.DoesNotExist,
    ):
        # Approved child deletion may remove a queued/running task before it commits.
        return


@shared_task
def dispatch_pending():
    now = timezone.now()
    ids = BackgroundJob.objects.filter(
        Q(status="running", lease_expires_at__lte=now) | Q(status="waiting")
    ).values_list("pk", flat=True)[:100]
    for ident in ids:
        try:
            with transaction.atomic():
                job, context = lock_job(ident)
                if not job_authorized(job, context):
                    job.status = "cancelled"
                    job.error_code = "CONSENT_REVOKED_OR_PAUSED"
                    job.save()
                    continue
                if job.status == "running" and job.lease_expires_at <= now:
                    JobAttempt.objects.filter(
                        execution_token=job.execution_token, status="running"
                    ).update(status="abandoned", finished_at=now, error_code="LEASE_EXPIRED")
                    job.execution_token = None
                    job.lease_expires_at = None
                    job.status = "pending" if job.attempt_count < job.max_attempts else "failed"
                    job.next_attempt_at = now
                    job.save()
                elif job.status == "waiting" and bind_dependency(job):
                    job.status = "pending"
                    job.error_code = None
                    job.next_attempt_at = now
                    job.save()
        except (
            BackgroundJob.DoesNotExist,
            Child.DoesNotExist,
            ExternalAssociation.DoesNotExist,
            AssessmentSession.DoesNotExist,
        ):
            continue
    for ident in (
        BackgroundJob.objects.filter(status="pending")
        .filter(Q(next_attempt_at__isnull=True) | Q(next_attempt_at__lte=now))
        .values_list("pk", flat=True)[:100]
    ):
        publish_job(str(ident))


@shared_task
def schedule_due_syncs():
    from dingdong_ca.core.services.sync import schedule_sync

    for ident in SyncCheckpoint.objects.filter(
        status="enabled", next_due_at__lte=timezone.now()
    ).values_list("association_id", flat=True)[:100]:
        schedule_sync(ident)


@shared_task
def recover_assessments():
    for ident in AlgorithmAttempt.objects.filter(
        status="running", deadline_at__lte=timezone.now()
    ).values_list("pk", flat=True)[:100]:
        finish_attempt(ident, error="UPSTREAM_TIMEOUT", unknown=True)
