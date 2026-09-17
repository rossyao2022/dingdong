from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.response import Response

from dingdong_ca.core.models import (
    AlgorithmAttempt,
    AssessmentSession,
    BackgroundJob,
    ConsentGrant,
    ProfileSnapshot,
    QuestionnaireVersion,
    ReportVersion,
)
from dingdong_ca.core.services.assessments import (
    begin_attempt,
    cancel_session,
    execute_attempt,
    lock_session,
    merge_answers,
    missing_questions,
    require_authorized,
)

from .children import owned_child
from .common import ApiError, audit, endpoint, family_for, validate
from .inputs import AnswersInput, AssessmentCreate
from .uploads import MAX_FILE, MAX_TOTAL, SLOTS, BoundedMultipartParser, validate_synthetic_input


def owned_session(request, ident):
    return get_object_or_404(
        AssessmentSession.objects.select_related("questionnaire_version"),
        pk=ident,
        child__family=family_for(request.user),
    )


def serialize_session(session):
    attempt = AlgorithmAttempt.objects.filter(session=session).order_by("-attempt_no").first()
    profile = ProfileSnapshot.objects.filter(algorithm_attempt__session=session).first()
    report = ReportVersion.objects.filter(profile=profile).first() if profile else None
    job = BackgroundJob.objects.filter(profile=profile).first() if profile else None
    report_status = (
        "ready"
        if report
        else "failed"
        if job and job.status in ["failed", "cancelled"]
        else "processing"
        if job and job.status in ["pending", "running"]
        else "not_started"
    )
    return {
        "id": str(session.pk),
        "child_id": str(session.child_id),
        "status": session.status,
        "revision": session.revision,
        "questionnaire_version_id": str(session.questionnaire_version_id),
        "questions": session.questionnaire_version.questions,
        "purpose": session.questionnaire_version.purpose,
        "questionnaire_code": session.questionnaire_version.code,
        "title": session.questionnaire_version.title,
        "description": session.questionnaire_version.description,
        "version": session.questionnaire_version.version,
        "choice_summary": [
            {
                "question": q["title"],
                "choices": [
                    o["label"]
                    for o in q["options"]
                    if o["code"] in session.answers.get(q["code"], [])
                ],
            }
            for q in session.questionnaire_version.questions
        ]
        if session.status == "completed" and session.questionnaire_version.purpose == "exploration"
        else [],
        "answers": [{"question_code": k, "option_codes": v} for k, v in session.answers.items()],
        "missing_question_codes": missing_questions(session),
        "attempt_status": attempt.status if attempt else None,
        "profile_id": str(profile.pk) if profile else None,
        "report_id": str(report.pk) if report else None,
        "report_status": report_status,
        "data_origin": session.questionnaire_version.data_origin,
    }


@endpoint(["GET"])
def config(request):
    purpose = request.query_params.get("purpose", "assessment")
    if purpose not in ["assessment", "exploration"]:
        raise ApiError("VALIDATION_ERROR", 422, "题库用途无效")
    published = QuestionnaireVersion.objects.filter(status="published").order_by(
        "-published_at", "-id"
    )
    ident = request.query_params.get("questionnaire_version_id")
    if ident:
        import uuid

        try:
            ident = uuid.UUID(ident)
        except ValueError:
            raise ApiError("VALIDATION_ERROR", 422, "题库版本无效") from None
        q = get_object_or_404(published, pk=ident, purpose=purpose)
    else:
        q = published.filter(
            code="exploration" if purpose == "exploration" else "initial-assessment",
            purpose=purpose,
        ).first()
        if q is None:
            q = published.filter(purpose=purpose).first()
    ready = bool(
        q
        and q.data_origin == "synthetic"
        and settings.INTEGRATION_DATA_SOURCE == "database_fixture"
    )
    return Response(
        {
            "available": ready,
            "questionnaires": [
                {
                    "id": str(row.pk),
                    "code": row.code,
                    "purpose": row.purpose,
                    "title": row.title,
                    "description": row.description,
                    "version": row.version,
                    "question_count": len(row.questions),
                }
                for row in published
            ],
            "reason": None if ready else "integration_not_ready",
            "questionnaire_version_id": str(q.pk) if q else None,
            "questions": q.questions if q else [],
            "purpose": purpose,
            "title": q.title if q else "",
            "description": q.description if q else "",
            "version": q.version if q else "",
            "input_requirements": {
                "collection_mode": "synthetic_only" if ready else "disabled",
                "slots": [] if purpose == "exploration" else SLOTS,
                "mime_types": ["image/png"],
                "max_file_bytes": MAX_FILE,
                "max_total_bytes": MAX_TOTAL,
                "birth_date_required": False,
            },
            "data_origin": q.data_origin if q else "synthetic",
        }
    )


@endpoint(["GET", "POST"])
def create(request, child_id):
    if request.method == "GET":
        from .common import paginate

        child = owned_child(request, child_id)
        return Response(
            paginate(
                AssessmentSession.objects.filter(child=child),
                request,
                serialize_session,
                "assessments:" + str(child.pk),
            )
        )
    data = validate(AssessmentCreate, request.data)
    with transaction.atomic():
        child = owned_child(request, child_id, lock=True)
        existing = AssessmentSession.objects.filter(
            started_by=request.user, create_request_key=data["request_id"]
        ).first()
        if existing:
            if (
                existing.child_id != child.pk
                or existing.consent_grant_id != data["consent_grant_id"]
                or existing.questionnaire_version_id != data["questionnaire_version_id"]
            ):
                raise ApiError("IDEMPOTENCY_CONFLICT", 409, "创建请求不一致")
            return Response(serialize_session(existing))
        consent = get_object_or_404(
            ConsentGrant.objects.select_for_update(), pk=data["consent_grant_id"], child=child
        )
        if consent.revoked_at or consent.purpose != "assessment_processing":
            raise ApiError("CONSENT_REQUIRED", 403, "请同意测评用途")
        q = get_object_or_404(
            QuestionnaireVersion, pk=data["questionnaire_version_id"], status="published"
        )
        if q.data_origin != "synthetic" or settings.INTEGRATION_DATA_SOURCE != "database_fixture":
            raise ApiError("INTEGRATION_NOT_READY", 503, "真实算法尚未接入")
        today = timezone.localdate()
        context = {"reference_date": today.isoformat()}
        if child.birth_date:
            context["age_months"] = (
                (today.year - child.birth_date.year) * 12
                + today.month
                - child.birth_date.month
                - int(today.day < child.birth_date.day)
            )
        session = AssessmentSession.objects.create(
            child=child,
            started_by=request.user,
            consent_grant=consent,
            questionnaire_version=q,
            create_request_key=data["request_id"],
            input_context=context,
            expires_at=timezone.now() + timedelta(days=7),
        )
        audit(request.user, "assessment.create", session)
    return Response(serialize_session(session), status=201)


@endpoint(["GET"])
def detail(request, session_id):
    return Response(serialize_session(owned_session(request, session_id)))


@endpoint(["PATCH"])
def answers(request, session_id):
    owned_session(request, session_id)
    data = validate(AnswersInput, request.data)
    return Response(serialize_session(merge_answers(session_id, **data)))


@endpoint(["POST"], parsers=[BoundedMultipartParser])
def submit(request, session_id):
    session = owned_session(request, session_id)
    require_authorized(session)
    if session.questionnaire_version.purpose != "assessment":
        raise ApiError("VALIDATION_ERROR", 422, "探索体验无需提交图片，请完成体验")
    if settings.INTEGRATION_DATA_SOURCE != "database_fixture":
        raise ApiError("INTEGRATION_NOT_READY", 503, "真实算法尚未接入")
    data = validate_synthetic_input(request)
    # Free upload buffers before any external-source work or transaction/result creation.
    for buffer in getattr(request._request, "_ca_upload_buffers", []):
        buffer.close()
    attempt, is_new = begin_attempt(session_id, **data)
    if is_new:
        attempt = execute_attempt(attempt)
    if attempt.status == "failed":
        raise ApiError(
            attempt.error_code or "UPSTREAM_UNAVAILABLE", 503, "处理失败，请查询状态后重新采集"
        )
    if attempt.status == "cancelled":
        raise ApiError("STATE_CONFLICT", 409, "测评已取消")
    session.refresh_from_db()
    view = serialize_session(session)
    return Response(
        {
            "session_id": str(session.pk),
            "status": session.status,
            "attempt_id": str(attempt.pk),
            "profile_id": view["profile_id"],
            "report_status": view["report_status"],
        },
        status=202 if attempt.status in ["running", "prepared", "unknown"] else 200,
    )


@endpoint(["POST"])
def cancel(request, session_id):
    owned_session(request, session_id)
    return Response(serialize_session(cancel_session(session_id)))


@endpoint(["POST"])
def complete_exploration(request, session_id):
    owned_session(request, session_id)
    from rest_framework import serializers

    from .inputs import StrictSerializer

    class CompletionInput(StrictSerializer):
        revision = serializers.IntegerField(min_value=1)

    data = validate(CompletionInput, request.data)
    with transaction.atomic():
        session = lock_session(session_id)
        require_authorized(session)
        if session.questionnaire_version.purpose != "exploration":
            raise ApiError("VALIDATION_ERROR", 422, "此入口仅用于探索体验")
        if data["revision"] != session.revision:
            raise ApiError("REVISION_CONFLICT", 409, "答案已更新，请刷新后确认")
        if session.status == "completed":
            return Response(serialize_session(session))
        if session.status not in ["draft", "ready"] or session.expires_at <= timezone.now():
            raise ApiError("STATE_CONFLICT", 409, "当前体验不能提交")
        if missing_questions(session):
            raise ApiError("ANSWERS_INCOMPLETE", 422, "请完成必填题")
        session.status = "completed"
        session.submitted_at = session.completed_at = timezone.now()
        session.save(update_fields=["status", "submitted_at", "completed_at", "updated_at"])
        audit(request.user, "exploration.complete", session)
        return Response(serialize_session(session))
