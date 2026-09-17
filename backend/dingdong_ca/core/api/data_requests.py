from django.db import transaction
from rest_framework import serializers
from rest_framework.response import Response

from dingdong_ca.core.models import DataRequest

from .children import owned_child
from .common import ApiError, endpoint, paginate, validate
from .inputs import StrictSerializer


class RequestInput(StrictSerializer):
    request_id = serializers.UUIDField()
    kind = serializers.ChoiceField(choices=["support", "deletion", "correction"])
    reason_code = serializers.ChoiceField(
        choices=["support_needed", "delete_child_data", "correct_profile"]
    )

    def validate(self, data):
        if (
            data["reason_code"]
            != {
                "support": "support_needed",
                "deletion": "delete_child_data",
                "correction": "correct_profile",
            }[data["kind"]]
        ):
            raise serializers.ValidationError("事项类型与原因不匹配")
        return data


def serialize_request(r):
    return {
        "id": str(r.pk),
        "child_id": str(r.child_id) if r.child_id else None,
        "kind": r.kind,
        "status": r.status,
        "reason_code": r.reason_code,
        "resolution_code": r.resolution_code,
        "created_at": r.created_at.isoformat(),
        "completed_at": r.completed_at.isoformat() if r.completed_at else None,
    }


@endpoint(["GET", "POST"])
def requests(request, child_id):
    if request.method == "GET":
        child = owned_child(request, child_id)
        return Response(
            paginate(
                DataRequest.objects.filter(child=child, requester=request.user),
                request,
                serialize_request,
                "child-requests:" + str(child.pk),
            )
        )
    data = validate(RequestInput, request.data)
    with transaction.atomic():
        child = owned_child(request, child_id, lock=True)
        old = DataRequest.objects.filter(
            requester=request.user, create_request_key=data["request_id"]
        ).first()
        if old:
            if (
                old.child_id != child.pk
                or old.kind != data["kind"]
                or old.reason_code != data["reason_code"]
            ):
                raise ApiError("IDEMPOTENCY_CONFLICT", 409)
            return Response(serialize_request(old))
        row = DataRequest.objects.create(
            child=child,
            requester=request.user,
            create_request_key=data["request_id"],
            kind=data["kind"],
            reason_code=data["reason_code"],
        )
    return Response(serialize_request(row), status=201)


@endpoint(["GET"])
def receipts(request):
    return Response(
        paginate(
            DataRequest.objects.filter(requester=request.user),
            request,
            serialize_request,
            "receipts:" + str(request.user.pk),
        )
    )
