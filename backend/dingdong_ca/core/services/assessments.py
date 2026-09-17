from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from dingdong_ca.core.api.common import ApiError, audit
from dingdong_ca.core.models import (
    AlgorithmAttempt,
    AssessmentSession,
    BackgroundJob,
    Child,
    ConsentGrant,
    FamilyMembership,
    ProfileSnapshot,
    ReportTemplateVersion,
)
from dingdong_ca.testsupport.adapter import FixtureFailure, initial_result


def missing_questions(session):
    return [
        q["code"]
        for q in session.questionnaire_version.questions
        if q["required"] and not session.answers.get(q["code"])
    ]


def authorized(session):
    grant = session.consent_grant
    return (
        grant.child_id == session.child_id
        and grant.purpose == "assessment_processing"
        and grant.policy_version.purpose == grant.purpose
        and grant.revoked_at is None
        and session.child.status == "active"
        and session.child.family.status == "active"
        and session.started_by.is_active
        and session.started_by.account_kind == "parent"
        and FamilyMembership.objects.filter(
            user=session.started_by, family_id=session.child.family_id, ended_at__isnull=True
        ).exists()
    )


def lock_session(session_id):
    # All writes/revocations/worker result commits lock the child before consent and session.
    initial = AssessmentSession.objects.get(pk=session_id)
    Child.objects.select_for_update().get(pk=initial.child_id)
    ConsentGrant.objects.select_for_update().get(pk=initial.consent_grant_id)
    return AssessmentSession.objects.select_for_update().get(pk=session_id)


def require_authorized(session):
    if not authorized(session):
        raise ApiError("CONSENT_REQUIRED", 403, "本次测评授权已失效")


def merge_answers(session_id, revision, answers):
    with transaction.atomic():
        session = lock_session(session_id)
        require_authorized(session)
        if session.status not in ["draft", "ready"] or session.expires_at <= timezone.now():
            raise ApiError("STATE_CONFLICT", 409, "当前会话不能修改答案")
        if session.revision != revision:
            raise ApiError("REVISION_CONFLICT", 409, "记录已更新")
        questions = {q["code"]: q for q in session.questionnaire_version.questions}
        seen = set()
        merged = dict(session.answers)
        for answer in answers:
            code = answer["question_code"]
            values = answer["option_codes"]
            if code in seen or code not in questions:
                raise ApiError("VALIDATION_ERROR", 422, "题码重复或无效")
            seen.add(code)
            question = questions[code]
            if (
                len(values) != len(set(values))
                or not set(values) <= {x["code"] for x in question["options"]}
                or len(values) > question["max_choices"]
            ):
                raise ApiError("VALIDATION_ERROR", 422, "选项无效")
            if values and len(values) < question["min_choices"]:
                raise ApiError("VALIDATION_ERROR", 422, "选择数量不足")
            if values:
                merged[code] = values
            else:
                merged.pop(code, None)
        session.answers = merged
        session.revision += 1
        session.status = "ready" if not missing_questions(session) else "draft"
        session.save(update_fields=["answers", "revision", "status", "updated_at"])
        return session


def begin_attempt(session_id, request_id, revision):
    with transaction.atomic():
        session = lock_session(session_id)
        require_authorized(session)
        old = AlgorithmAttempt.objects.filter(request_id=request_id).first()
        if old:
            if old.session_id != session.pk or old.request_revision != revision:
                raise ApiError("IDEMPOTENCY_CONFLICT", 409, "提交请求不一致")
            return old, False
        if (
            settings.INTEGRATION_DATA_SOURCE != "database_fixture"
            or session.questionnaire_version.data_origin != "synthetic"
        ):
            raise ApiError("INTEGRATION_NOT_READY", 503, "真实算法尚未接入")
        if (
            session.status not in ["ready", "needs_recapture"]
            or session.expires_at <= timezone.now()
        ):
            if missing_questions(session):
                raise ApiError("ANSWERS_INCOMPLETE", 422, "请先完成问卷")
            raise ApiError("STATE_CONFLICT", 409, "当前会话不能再次提交")
        if revision != session.revision:
            raise ApiError("REVISION_CONFLICT", 409, "问卷已更新")
        if missing_questions(session):
            raise ApiError("ANSWERS_INCOMPLETE", 422, "请先完成问卷")
        now = timezone.now()
        attempt = AlgorithmAttempt.objects.create(
            session=session,
            request_id=request_id,
            request_revision=revision,
            attempt_no=AlgorithmAttempt.objects.filter(session=session).count() + 1,
            started_at=now,
            deadline_at=now + timedelta(seconds=30),
        )
        session.status = "processing"
        session.submitted_at = now
        session.save(update_fields=["status", "submitted_at", "updated_at"])
        audit(session.started_by, "assessment.submit", attempt)
        return attempt, True


def execute_attempt(attempt):
    # No images reach this database adapter; the caller has validated and closed synthetic uploads.
    try:
        result = initial_result(attempt.session.child_id, attempt.session.questionnaire_version_id)
        return finish_attempt(attempt.pk, result=result)
    except FixtureFailure as exc:
        return finish_attempt(attempt.pk, error=exc.code, unknown=exc.unknown)


def finish_attempt(attempt_id, *, result=None, error=None, unknown=False):
    initial = AlgorithmAttempt.objects.get(pk=attempt_id)
    with transaction.atomic():
        session = lock_session(initial.session_id)
        attempt = AlgorithmAttempt.objects.select_for_update().get(pk=attempt_id)
        if attempt.status != "running":
            return attempt
        now = timezone.now()
        if not authorized(session) or session.status != "processing":
            attempt.status = "cancelled"
            attempt.error_code = "CONSENT_REVOKED"
            attempt.finished_at = now
            attempt.save()
            session.status = "cancelled"
            session.save(update_fields=["status", "updated_at"])
            return attempt
        if now > attempt.deadline_at:
            error = "UPSTREAM_TIMEOUT"
            unknown = True
            result = None
        if error:
            attempt.status = "unknown" if unknown else "failed"
            attempt.error_code = error
            attempt.finished_at = now
            attempt.save()
            session.status = "result_unknown" if unknown else "needs_recapture"
            session.save(update_fields=["status", "updated_at"])
            return attempt
        attempt.status = "succeeded"
        attempt.algorithm_version = result["algorithm_version"]
        attempt.finished_at = now
        attempt.save()
        profile = ProfileSnapshot.objects.create(
            child_id=session.child_id,
            algorithm_attempt=attempt,
            schema_version=result["schema_version"],
            result={"metrics": result["metrics"]},
            data_origin="synthetic",
            produced_at=now,
        )
        session.status = "completed"
        session.completed_at = now
        session.save(update_fields=["status", "completed_at", "updated_at"])
        template = ReportTemplateVersion.objects.filter(
            code="initial-report", status="published"
        ).first()
        job = BackgroundJob.objects.create(
            profile=profile,
            template_version=template,
            business_key="initial-report:" + str(profile.pk),
            status="pending" if template else "waiting",
            error_code=None if template else "TEMPLATE_MISSING",
            next_attempt_at=now,
        )
        from dingdong_ca.core.tasks import publish_job

        transaction.on_commit(lambda: publish_job(str(job.pk)))
        return attempt


def cancel_session(session_id):
    with transaction.atomic():
        session = lock_session(session_id)
        if session.status == "completed":
            raise ApiError("STATE_CONFLICT", 409, "已完成的测评不能取消")
        AlgorithmAttempt.objects.filter(
            session=session, status__in=["prepared", "running", "unknown"]
        ).update(status="cancelled", finished_at=timezone.now())
        if session.status not in ["cancelled", "expired"]:
            session.status = "cancelled"
            session.save(update_fields=["status", "updated_at"])
            audit(session.started_by, "assessment.cancel", session)
        return session
