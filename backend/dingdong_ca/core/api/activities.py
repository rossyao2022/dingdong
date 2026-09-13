from zoneinfo import ZoneInfo

from django.db import transaction
from django.db.models.functions import TruncDate
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.response import Response

from dingdong_ca.core.models import ActivityContentVersion, ActivityRecord

from .children import owned_child
from .common import ApiError, audit, endpoint, family_for, paginate, validate
from .inputs import ActivityCreate, ActivityFinish, ActivityProgress


def serialize_activity(a):
    return {
        "id": str(a.pk),
        "code": a.code,
        "version": a.version,
        "title": a.title,
        "island": a.island,
        "mood": a.mood,
        "duration_minutes": a.duration_minutes,
        "materials": a.content["materials"],
        "goal": a.content["goal"],
        "alternative": a.content["alternative"],
        "allowed_styles": a.content["allowed_styles"],
        "steps": a.content["steps"],
        "data_origin": a.data_origin,
    }


def serialize_record(r):
    return {
        "id": str(r.pk),
        "child_id": str(r.child_id),
        "activity_version_id": str(r.activity_version_id),
        "activity": serialize_activity(r.activity_version),
        "mode": r.mode,
        "style": r.style,
        "status": r.status,
        "step_index": r.step_index,
        "revision": r.revision,
        "started_at": r.started_at.isoformat(),
        "finished_at": r.finished_at.isoformat() if r.finished_at else None,
        "feedback": r.feedback,
        "note": r.note,
        "source": r.source,
        "data_origin": r.activity_version.data_origin,
    }


def owned_record(request, ident, lock=False):
    qs = ActivityRecord.objects.select_related("activity_version").filter(
        child__family=family_for(request.user), child__status="active"
    )
    if lock:
        qs = qs.select_for_update(of=("self",))
    return get_object_or_404(qs, pk=ident)


@endpoint(["GET"])
def activities(request):
    qs = ActivityContentVersion.objects.filter(status="published")
    for key in ["island", "mood"]:
        if request.query_params.get(key):
            qs = qs.filter(**{key: request.query_params[key]})
    scope = "activities:" + str(
        sorted((k, v) for k, v in request.query_params.items() if k not in ["cursor", "page_size"])
    )
    return Response(paginate(qs, request, serialize_activity, scope))


@endpoint(["GET", "POST"])
def records(request, child_id):
    if request.method == "GET":
        child = owned_child(request, child_id)
        qs = ActivityRecord.objects.select_related("activity_version").filter(child=child)
        status = request.query_params.get("status")
        if status:
            if status not in ["active", "completed", "skipped"]:
                raise ApiError("VALIDATION_ERROR", 422, "活动状态不合法")
            qs = qs.filter(status=status)
        start, end = request.query_params.get("from"), request.query_params.get("to")
        if start or end:
            try:
                start, end = parse_datetime(start or ""), parse_datetime(end or "")
                if (
                    not start
                    or not end
                    or timezone.is_naive(start)
                    or timezone.is_naive(end)
                    or start >= end
                ):
                    raise ValueError
            except (ValueError, TypeError):
                raise ApiError("VALIDATION_ERROR", 422, "from/to 必须成对且带时区") from None
            qs = qs.filter(finished_at__gte=start, finished_at__lt=end)
        completed = qs.filter(status="completed")
        summary = {
            "completed_count": completed.count(),
            "active_days": completed.annotate(
                day=TruncDate("finished_at", tzinfo=ZoneInfo("Asia/Shanghai"))
            )
            .values("day")
            .distinct()
            .count(),
        }
        scope = (
            "records:"
            + str(child.pk)
            + ":"
            + str(
                sorted(
                    (k, v)
                    for k, v in request.query_params.items()
                    if k not in ["cursor", "page_size"]
                )
            )
        )
        return Response({**paginate(qs, request, serialize_record, scope), "summary": summary})
    data = validate(ActivityCreate, request.data)
    with transaction.atomic():
        child = owned_child(request, child_id, lock=True)
        row = (
            ActivityRecord.objects.select_related("activity_version")
            .filter(started_by=request.user, create_request_key=data["request_id"])
            .first()
        )
        if row:
            if (
                row.child_id != child.pk
                or row.activity_version_id != data["activity_version_id"]
                or row.mode != data["mode"]
                or row.style != data["style"]
            ):
                raise ApiError("IDEMPOTENCY_CONFLICT", 409, "创建请求内容不一致")
            return Response(serialize_record(row))
        if ActivityRecord.objects.filter(child=child, status="active").exists():
            raise ApiError("ACTIVE_ACTIVITY_EXISTS", 409, "请先继续或跳过已有活动")
        activity = get_object_or_404(
            ActivityContentVersion, pk=data["activity_version_id"], status="published"
        )
        if data["style"] not in activity.content["allowed_styles"]:
            raise ApiError("VALIDATION_ERROR", 422, "引导方式不支持")
        row = ActivityRecord.objects.create(
            child=child,
            started_by=request.user,
            activity_version=activity,
            create_request_key=data["request_id"],
            mode=data["mode"],
            style=data["style"],
            started_at=timezone.now(),
        )
        audit(request.user, "activity.start", row)
    return Response(serialize_record(row), status=201)


@endpoint(["GET", "PATCH"])
def record_detail(request, record_id):
    if request.method == "GET":
        return Response(serialize_record(owned_record(request, record_id)))
    data = validate(ActivityProgress, request.data)
    with transaction.atomic():
        row = owned_record(request, record_id, lock=True)
        if row.status != "active":
            raise ApiError("STATE_CONFLICT", 409, "活动已经结束")
        if row.revision != data["revision"]:
            raise ApiError("REVISION_CONFLICT", 409, "记录已更新，请刷新后重试")
        if data["step_index"] >= len(row.activity_version.content["steps"]):
            raise ApiError("VALIDATION_ERROR", 422, "步骤超出范围")
        row.step_index = data["step_index"]
        row.revision += 1
        row.save()
    return Response(serialize_record(row))


@endpoint(["POST"])
def finish(request, record_id):
    data = validate(ActivityFinish, request.data)
    with transaction.atomic():
        row = owned_record(request, record_id, lock=True)
        if row.status != "active":
            if any(getattr(row, k) != v for k, v in data.items()):
                raise ApiError("STATE_CONFLICT", 409, "活动已经结束且内容不一致")
            return Response(serialize_record(row))
        if (
            data["status"] == "completed"
            and row.step_index != len(row.activity_version.content["steps"]) - 1
        ):
            raise ApiError("STATE_CONFLICT", 409, "请先完成最后一步")
        for k, v in data.items():
            setattr(row, k, v)
        row.finished_at = timezone.now()
        row.revision += 1
        row.save()
        audit(request.user, "activity." + row.status, row)
    return Response(serialize_record(row))
