"""Authenticated exhibition preview does not grant access to any child's data."""

from rest_framework.response import Response

from dingdong_ca.core.services import ca_account
from dingdong_ca.core.services.exhibition import record_visit
from dingdong_ca.core.services.prototype_reports import shared_snapshot

from .common import ApiError, endpoint, validate
from .inputs import ExhibitionVisitInput
from .prototype_demo import WeeklyInput


def require_enabled():
    if not ca_account.prototype_demo_enabled():
        raise ApiError("NOT_FOUND", 404, "展会体验未开启")


@endpoint(["GET"])
def report(request):
    require_enabled()
    weekly = validate(WeeklyInput, request.query_params)["weekly_turns"]
    snapshot = shared_snapshot(weekly)
    require_enabled()
    return Response(
        {
            **snapshot.view,
            "sync_source": snapshot.sync_source,
            "prototype_url": ca_account.prototype_chat_url(),
        }
    )


@endpoint(["POST"])
def visits(request):
    require_enabled()
    data = validate(ExhibitionVisitInput, request.data)
    result, created = record_visit(request.user, data["event"], data["request_id"])
    return Response(result, status=201 if created else 200)
