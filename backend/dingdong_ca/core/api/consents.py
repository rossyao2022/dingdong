from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.response import Response

from dingdong_ca.core.models import (
    AlgorithmAttempt,
    AssessmentSession,
    Child,
    ConsentGrant,
    PolicyVersion,
)

from .children import owned_child
from .common import ApiError, audit, endpoint, family_for, paginate, validate
from .inputs import ConsentInput

PURPOSES = ["assessment_processing", "dingdong_sync"]


def serialize_consent(row):
    return {
        "id": str(row.pk),
        "child_id": str(row.child_id),
        "purpose": row.purpose,
        "policy_version_id": str(row.policy_version_id),
        "granted_at": row.created_at.isoformat(),
        "revoked_at": row.revoked_at.isoformat() if row.revoked_at else None,
    }


@endpoint(["GET"], anonymous=True)
def policy(request):
    purpose = request.query_params.get("purpose")
    if purpose not in PURPOSES:
        raise ApiError("VALIDATION_ERROR", 422, "用途不合法")
    row = PolicyVersion.objects.filter(purpose=purpose, status="published").first()
    if row is None:
        raise ApiError("CONFIG_NOT_READY", 503, "用途说明尚未发布")
    return Response(
        {"id": str(row.pk), "purpose": row.purpose, "version": row.version, "body": row.body}
    )


@endpoint(["GET", "POST"])
def consents(request, child_id):
    if request.method == "GET":
        child = owned_child(request, child_id)
        return Response(
            paginate(
                ConsentGrant.objects.filter(child=child),
                request,
                serialize_consent,
                "consents:" + str(child.pk),
            )
        )
    data = validate(ConsentInput, request.data)
    with transaction.atomic():
        child = owned_child(request, child_id, lock=True)
        existing = ConsentGrant.objects.filter(
            granted_by=request.user, create_request_key=data["request_id"]
        ).first()
        if existing:
            if (
                existing.child_id != child.pk
                or existing.policy_version_id != data["policy_version_id"]
            ):
                raise ApiError("IDEMPOTENCY_CONFLICT", 409, "授权请求内容不一致")
            return Response(serialize_consent(existing))
        row = get_object_or_404(PolicyVersion, pk=data["policy_version_id"], status="published")
        old = ConsentGrant.objects.filter(
            child=child, purpose=row.purpose, revoked_at__isnull=True
        ).first()
        if old:
            raise ApiError("STATE_CONFLICT", 409, "该用途已有有效授权；请使用现有授权")
        grant = ConsentGrant.objects.create(
            child=child,
            granted_by=request.user,
            policy_version=row,
            purpose=row.purpose,
            create_request_key=data["request_id"],
        )
        audit(request.user, "consent.grant", grant)
    return Response(serialize_consent(grant), status=201)


@endpoint(["POST"])
def revoke(request, consent_id):
    initial = get_object_or_404(ConsentGrant, pk=consent_id, child__family=family_for(request.user))
    with transaction.atomic():
        Child.objects.select_for_update().get(pk=initial.child_id)
        grant = ConsentGrant.objects.select_for_update().get(pk=initial.pk)
        if grant.revoked_at is None:
            grant.revoked_at = timezone.now()
            grant.save(update_fields=["revoked_at", "updated_at"])
            sessions = AssessmentSession.objects.filter(consent_grant=grant).exclude(
                status__in=["completed", "cancelled", "expired"]
            )
            AlgorithmAttempt.objects.filter(
                session__in=sessions, status__in=["prepared", "running", "unknown"]
            ).update(status="cancelled", finished_at=timezone.now(), error_code="consent_revoked")
            sessions.update(status="cancelled")
            audit(request.user, "consent.revoke", grant)
    return Response(serialize_consent(grant))
