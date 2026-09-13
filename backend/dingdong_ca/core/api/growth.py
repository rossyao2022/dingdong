from zoneinfo import ZoneInfo

from django.db.models.functions import TruncDate
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.response import Response

from dingdong_ca.core.models import (
    ActivityRecord,
    BackgroundJob,
    ExternalAssociation,
    ObservationBatch,
    ProfileSnapshot,
    ReportVersion,
)
from dingdong_ca.core.services.sync import association_authorized

from .children import owned_child
from .common import ApiError, endpoint
from .reports import profile_window, serialize_profile, serialize_summary


def window(request):
    try:
        start, end = (
            parse_datetime(request.query_params.get("from", "")),
            parse_datetime(request.query_params.get("to", "")),
        )
        if (
            not start
            or not end
            or timezone.is_naive(start)
            or timezone.is_naive(end)
            or start >= end
        ):
            raise ValueError
        return start, end
    except (TypeError, ValueError):
        raise ApiError("VALIDATION_ERROR", 422, "from/to 必须成对、带时区且起点早于终点") from None


def observation_view(child, start, end):
    view = {
        "availability": "unbound",
        "window": {"start": start.isoformat(), "end": end.isoformat()},
        "updated_at": None,
        "last_success_at": None,
        "source": "dingdong",
        "data_origin": "synthetic",
        "schema_version": None,
        "source_version": None,
        "batch_ids": [],
        "metrics": [],
        "reason": None,
    }
    a = ExternalAssociation.objects.filter(child=child, status="verified").first()
    if not a:
        return view
    check = a.synccheckpoint
    if not association_authorized(a):
        view.update(availability="no_consent", reason="consent_required")
        return view
    latest = (
        ObservationBatch.objects.filter(association=a, window_start=start, window_end=end)
        .order_by("-revision_no")
        .first()
    )
    view["last_success_at"] = check.last_success_at.isoformat() if check.last_success_at else None
    if latest:
        view.update(
            availability="stale" if check.error_code or check.status != "enabled" else "ready",
            updated_at=latest.created_at.isoformat(),
            schema_version=latest.schema_version,
            source_version=latest.source_version,
            batch_ids=[str(latest.pk)],
            metrics=latest.metrics,
            reason=check.error_code or ("sync_paused" if check.status != "enabled" else None),
        )
    else:
        view.update(
            availability="error"
            if check.error_code
            else "no_data"
            if check.last_success_at
            else "not_synced",
            reason=check.error_code,
        )
    return view


@endpoint(["GET"])
def observations(request, child_id):
    child = owned_child(request, child_id)
    start, end = window(request)
    return Response(observation_view(child, start, end))


def trend_for(current, child, start, end):
    result = {
        "available": False,
        "reason": "no_current_window",
        "current_window": profile_window(current) if current else None,
        "previous_window": None,
        "changes": [],
    }
    if not current:
        return result
    previous = (
        ProfileSnapshot.objects.filter(
            child=child, kind="stage", window_start=start - (end - start), window_end=start
        )
        .order_by("-produced_at")
        .first()
    )
    if not previous:
        result["reason"] = "no_previous_window"
        return result
    result["previous_window"] = profile_window(previous)
    if (
        previous.rule_version_id != current.rule_version_id
        or previous.schema_version != current.schema_version
    ):
        result["reason"] = "incompatible_version"
        return result
    old = {m["code"]: m for m in previous.result["metrics"]}
    for m in current.result["metrics"]:
        p = old.get(m["code"])
        if not p or p["unit"] != m["unit"] or p["value"] is None or m["value"] is None:
            result.update(reason="incompatible_metrics", changes=[])
            return result
        result["changes"].append(
            {
                "code": m["code"],
                "unit": m["unit"],
                "current": m["value"],
                "previous": p["value"],
                "delta": m["value"] - p["value"],
            }
        )
    result.update(available=True, reason=None)
    return result


@endpoint(["GET"])
def overview(request, child_id):
    child = owned_child(request, child_id)
    start, end = window(request)
    obs = observation_view(child, start, end)
    initial = (
        ProfileSnapshot.objects.filter(child=child, kind="initial").order_by("-produced_at").first()
    )
    current = (
        ProfileSnapshot.objects.filter(
            child=child,
            kind="stage",
            window_start=start,
            window_end=end,
            profileobservation__observation_id__in=obs["batch_ids"],
        )
        .order_by("-produced_at")
        .first()
    )
    job = (
        BackgroundJob.objects.filter(
            kind="stage_profile", jobobservation__observation_id__in=obs["batch_ids"]
        )
        .order_by("-created_at")
        .first()
    )
    stage = "no_data"
    if job and job.status in ["failed", "cancelled"]:
        stage = "failed"
    elif job and job.status == "waiting":
        stage = "waiting_rule"
    elif job and job.status in ["running", "pending"]:
        stage = "processing"
    elif current:
        stage = "ready"
    completed = ActivityRecord.objects.filter(
        child=child, status="completed", finished_at__gte=start, finished_at__lt=end
    )
    reports = ReportVersion.objects.filter(
        profile_id__in=[p.pk for p in [initial, current] if p]
    ).order_by("-generated_at")[:2]
    return Response(
        {
            "child_id": str(child.pk),
            "window": obs["window"],
            "web_activity_summary": {
                "completed_count": completed.count(),
                "active_days": completed.annotate(
                    day=TruncDate("finished_at", tzinfo=ZoneInfo("Asia/Shanghai"))
                )
                .values("day")
                .distinct()
                .count(),
            },
            "robot_observation": obs,
            "initial_profile": serialize_profile(initial) if initial else None,
            "stage_status": stage,
            "latest_reports": [serialize_summary(r) for r in reports],
            "trend": trend_for(current, child, start, end),
        }
    )
