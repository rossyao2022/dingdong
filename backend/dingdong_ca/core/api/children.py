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
        # 家长端需要这个修订号才能声明"我这次编辑基于哪一版"。也是运营后台
        # 过期保存会被拒的依据。
        "revision": row.revision,
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


@endpoint(["GET", "PATCH"])
def child_detail(request, child_id):
    if request.method == "GET":
        # 冲突恢复必须先能读到"服务端现在是什么"。旧页面保存被拒后，
        # 家长端靠这一次读取拿到最新档案与最新修订号，而不是靠猜。
        return Response(serialize_child(owned_child(request, child_id)))
    data = validate(ChildInput, request.data, partial=True)
    expected = data.pop("revision", None)
    if not data:
        raise ApiError("VALIDATION_ERROR", 422, "至少提供一个可编辑字段")
    with transaction.atomic():
        row = owned_child(request, child_id, lock=True)
        # 档案是一个整体：任何入口（家长端、运营后台、技术后台、内部任务）改过，
        # 修订号就会前进。旧页面拿着过期修订号保存一律拒绝，而不是静默覆盖。
        if expected is not None and row.revision != expected:
            raise ApiError(
                "EDIT_CONFLICT",
                409,
                "这份档案在你打开之后已被更正过，为避免覆盖最新内容，本次没有保存。"
                "请刷新页面确认最新信息后再提交。",
                [{"field": "revision"}],
            )
        for k, v in data.items():
            setattr(row, k, v)
        row.revision = row.revision + 1
        row.save()
        audit(request.user, "child.update", row, detail={"revision": row.revision})
    return Response(serialize_child(row))
