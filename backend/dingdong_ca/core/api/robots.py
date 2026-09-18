import hashlib

from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import serializers
from rest_framework.response import Response

from dingdong_ca.core.models import ConsentGrant, ExternalAssociation, SyncCheckpoint
from dingdong_ca.core.services.associations import end_association
from dingdong_ca.core.services.sync import lock_association, schedule_sync
from dingdong_ca.testsupport.adapter import FixtureFailure
from dingdong_ca.testsupport.models import TestFixture
from dingdong_ca.testsupport.robot import require_fixture_mode

from .children import owned_child
from .common import ApiError, audit, endpoint, family_for, paginate, validate
from .inputs import StrictSerializer

# `PROOF_INVALID` 的默认文案就是 code 本身，家长在核验对话框里只会看到
# 一行 `PROOF_INVALID`（T-040 的 P-17）。这里给一句能照做的中文。
PROOF_INVALID_MESSAGE = "凭据无法核验，请核对机器人标签上的凭据，或重新绑定机器人。"


class VerifyInput(StrictSerializer):
    request_id = serializers.UUIDField()
    consent_grant_id = serializers.UUIDField()
    entry_proof = serializers.CharField(min_length=1, max_length=2048, trim_whitespace=False)


def serialize_association(a):
    check = a.synccheckpoint
    return {
        "id": str(a.pk),
        "child_id": str(a.child_id),
        "provider": a.provider,
        "status": a.status,
        "verified_at": a.verified_at.isoformat(),
        "ended_at": a.ended_at.isoformat() if a.ended_at else None,
        "sync_status": check.status,
        "last_success_at": check.last_success_at.isoformat() if check.last_success_at else None,
        "data_origin": a.data_origin,
    }


@endpoint(["POST"])
def verify(request, child_id):
    data = validate(VerifyInput, request.data)
    try:
        require_fixture_mode()
    except FixtureFailure as e:
        raise ApiError(e.code, 503) from None
    digest = hashlib.sha256(data["entry_proof"].encode()).hexdigest()
    try:
        with transaction.atomic():
            child = owned_child(request, child_id, lock=True)
            old = ExternalAssociation.objects.filter(
                requested_by=request.user, create_request_key=data["request_id"]
            ).first()
            if old:
                if (
                    old.child_id != child.pk
                    or old.consent_grant_id != data["consent_grant_id"]
                    or old.proof_digest != digest
                ):
                    raise ApiError("IDEMPOTENCY_CONFLICT", 409)
                return Response(serialize_association(old))
            grant = get_object_or_404(
                ConsentGrant.objects.select_for_update(), pk=data["consent_grant_id"], child=child
            )
            if grant.purpose != "dingdong_sync" or grant.revoked_at:
                raise ApiError("CONSENT_REQUIRED", 403)
            fixture = (
                TestFixture.objects.select_for_update()
                .filter(dataset="phase1-v1", kind="identity", subject_key=str(child.pk), sequence=1)
                .first()
            )
            if not fixture or fixture.consumed_at:
                raise ApiError("PROOF_INVALID", 422, PROOF_INVALID_MESSAGE)
            payload = fixture.payload
            try:
                expiry = parse_datetime(payload["expires_at"])
                valid = (
                    set(payload)
                    == {"proof_digest", "family_id", "external_subject_id", "expires_at"}
                    and payload["proof_digest"] == digest
                    and payload["family_id"] == str(child.family_id)
                    and expiry
                    and timezone.is_aware(expiry)
                    and expiry > timezone.now()
                    and isinstance(payload["external_subject_id"], str)
                    and payload["external_subject_id"].startswith("TEST-SUBJECT-")
                    and len(payload["external_subject_id"]) <= 255
                )
            except (KeyError, TypeError, ValueError):
                valid = False
            if not valid:
                raise ApiError("PROOF_INVALID", 422, PROOF_INVALID_MESSAGE)
            a = ExternalAssociation.objects.create(
                child=child,
                requested_by=request.user,
                consent_grant=grant,
                create_request_key=data["request_id"],
                proof_digest=digest,
                external_subject_id=payload["external_subject_id"],
                verified_at=timezone.now(),
            )
            SyncCheckpoint.objects.create(association=a, next_due_at=timezone.now())
            fixture.consumed_at = timezone.now()
            fixture.save()
            schedule_sync(a.pk)
            audit(request.user, "association.verify", a)
            return Response(serialize_association(a), status=201)
    except IntegrityError:
        raise ApiError("ASSOCIATION_CONFLICT", 409) from None


@endpoint(["GET"])
def associations(request, child_id):
    child = owned_child(request, child_id)
    return Response(
        paginate(
            ExternalAssociation.objects.filter(child=child),
            request,
            serialize_association,
            "associations:" + str(child.pk),
        )
    )


@endpoint(["POST"])
def revoke(request, association_id):
    get_object_or_404(
        ExternalAssociation, pk=association_id, child__family=family_for(request.user)
    )
    with transaction.atomic():
        # 与「归档旧号」共用同一个结束动作，两处落的状态不会漂移。
        a = end_association(lock_association(association_id), request.user)
        return Response(serialize_association(a))
