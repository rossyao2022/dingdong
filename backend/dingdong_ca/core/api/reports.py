from django.shortcuts import get_object_or_404
from rest_framework.response import Response

from dingdong_ca.core.models import ProfileSnapshot, ReportVersion

from .children import owned_child
from .common import ApiError, endpoint, family_for, paginate


def serialize_profile(row):
    return {
        "id": str(row.pk),
        "child_id": str(row.child_id),
        "kind": row.kind,
        "metrics": row.result["metrics"],
        "schema_version": row.schema_version,
        "rule_version": row.rule_version.version if row.rule_version_id else None,
        "algorithm_version": row.algorithm_attempt.algorithm_version
        if row.algorithm_attempt_id
        else None,
        "window": profile_window(row),
        "produced_at": row.produced_at.isoformat(),
        "source_observation_ids": [
            str(x) for x in row.profileobservation_set.values_list("observation_id", flat=True)
        ],
        "data_origin": row.data_origin,
    }


def serialize_summary(row):
    return {
        "id": str(row.pk),
        "profile_id": str(row.profile_id),
        "kind": row.profile.kind,
        "window": profile_window(row.profile),
        "generated_at": row.generated_at.isoformat(),
        "data_origin": row.data_origin,
    }


def filter_kind(qs, request, prefix=""):
    kind = request.query_params.get("kind")
    if kind:
        if kind not in ["initial", "stage"]:
            raise ApiError("VALIDATION_ERROR", 422, "画像类型不合法")
        qs = qs.filter(**{prefix + "kind": kind})
    return qs


@endpoint(["GET"])
def profiles(request, child_id):
    child = owned_child(request, child_id)
    qs = filter_kind(
        ProfileSnapshot.objects.select_related("algorithm_attempt").filter(child=child), request
    )
    return Response(
        paginate(
            qs,
            request,
            serialize_profile,
            "profiles:" + str(child.pk) + ":" + request.query_params.get("kind", ""),
        )
    )


@endpoint(["GET"])
def reports(request, child_id):
    child = owned_child(request, child_id)
    qs = filter_kind(
        ReportVersion.objects.select_related("profile").filter(profile__child=child),
        request,
        "profile__",
    )
    return Response(
        paginate(
            qs,
            request,
            serialize_summary,
            "reports:" + str(child.pk) + ":" + request.query_params.get("kind", ""),
        )
    )


@endpoint(["GET"])
def detail(request, report_id):
    row = get_object_or_404(
        ReportVersion.objects.select_related("profile", "template_version"),
        pk=report_id,
        profile__child__family=family_for(request.user),
        profile__child__status="active",
    )
    return Response(
        {
            **serialize_summary(row),
            "child_id": str(row.profile.child_id),
            "template_version": row.template_version.version,
            "content_schema_version": row.content_schema_version,
            "sections": row.content["sections"],
            "source_summary": row.content["source_summary"],
        }
    )


def profile_window(row):
    return (
        {"start": row.window_start.isoformat(), "end": row.window_end.isoformat()}
        if row.window_start
        else None
    )
