from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework.response import Response

from dingdong_ca.core.models import Child, Family

from .common import ApiError, audit, endpoint, family_for, paginate, validate
from .inputs import ChildCreate, ChildInput


def serialize_child(row):
    return {
        "id": str(row.pk),
        "family_id": str(row.family_id),
        "name": row.name,
        "gender": row.gender,
        "birth_date": row.birth_date.isoformat() if row.birth_date else None,
        "status": row.status,
        "created_at": row.created_at.isoformat(),
        "updated_at": row.updated_at.isoformat(),
    }


def owned_child(request, child_id, lock=False):
    qs = Child.objects.filter(family=family_for(request.user), status="active")
    if lock:
        qs = qs.select_for_update()
    return get_object_or_404(qs, pk=child_id)


@endpoint(["GET", "POST"])
def children(request):
    family = family_for(request.user)
    if request.method == "GET":
        return Response(
            paginate(
                Child.objects.filter(family=family),
                request,
                serialize_child,
                "children:" + str(family.pk),
            )
        )
    data = validate(ChildCreate, request.data)
    key = data.pop("request_id")
    normalized = {
        **data,
        "birth_date": data["birth_date"].isoformat() if data["birth_date"] else None,
    }
    with transaction.atomic():
        Family.objects.select_for_update().get(pk=family.pk)
        row = Child.objects.filter(created_by=request.user, create_request_key=key).first()
        if row:
            if row.create_payload != normalized:
                raise ApiError("IDEMPOTENCY_CONFLICT", 409, "创建请求内容不一致")
            return Response(serialize_child(row), status=200)
        row = Child.objects.create(
            family=family,
            created_by=request.user,
            create_request_key=key,
            create_payload=normalized,
            **data,
        )
        audit(request.user, "child.create", row)
    return Response(serialize_child(row), status=201)


@endpoint(["PATCH"])
def child_detail(request, child_id):
    data = validate(ChildInput, request.data, partial=True)
    with transaction.atomic():
        row = owned_child(request, child_id, lock=True)
        for k, v in data.items():
            setattr(row, k, v)
        row.save()
        audit(request.user, "child.update", row)
    return Response(serialize_child(row))
