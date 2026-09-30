"""Authorized shared mock report, using validated pull or frequency-matched push."""

from django.conf import settings
from django.utils.dateparse import parse_datetime
from rest_framework import serializers
from rest_framework.response import Response

from dingdong_ca.core.ca_models import CaAccount
from dingdong_ca.core.models import ConsentGrant
from dingdong_ca.core.services import ca_account, dingdong_client
from dingdong_ca.core.services.dingdong_client import DingDongError
from dingdong_ca.core.services.prototype_reports import (
    WEEKLY_TURNS,
    InvalidPrototypeReport,
    latest_push,
    report_view,
    save_snapshot,
)

from .children import owned_child
from .common import ApiError, endpoint, validate
from .inputs import StrictSerializer


class WeeklyInput(StrictSerializer):
    weekly_turns = serializers.ChoiceField(choices=WEEKLY_TURNS, default=7)


def authorized_account(request, child_id):
    child = owned_child(request, child_id)
    account = CaAccount.objects.filter(child=child, status="active", prototype_demo=True).first()
    if account is None:
        raise ApiError("NOT_FOUND", 404, "当前档案未连接演示伙伴")
    if account.bind_state != "bound":
        raise ApiError("DINGDONG_BIND_PENDING", 409, "机器人尚未连接，请用原标签重试")
    if not ConsentGrant.objects.filter(
        child=child, purpose="dingdong_sync", revoked_at__isnull=True
    ).exists():
        raise ApiError("CONSENT_REQUIRED", 403, "请先同意查看机器人记录")
    return account


@endpoint(["GET"])
def insights(request, child_id):
    if not ca_account.prototype_demo_enabled():
        raise ApiError("NOT_FOUND", 404, "演示未开启")
    account = authorized_account(request, child_id)
    weekly = validate(WeeklyInput, request.query_params)["weekly_turns"]
    snapshot = latest_push(weekly)
    failure = None
    try:
        if not dingdong_client.is_configured():
            raise ApiError("DINGDONG_NOT_CONFIGURED", 503, "伙伴数据暂不可用")
        data = dingdong_client.call(
            "GET",
            "/api/v1/ca/prototype/insights",
            query={"ca_account_id": ca_account.source_account_id(account), "weekly_turns": weekly},
        )
        view = report_view(data, weekly)
        pulled = save_snapshot(view, "pull")
        # A slower response can overlap a newer webhook; compare after receiving pull.
        snapshot = latest_push(weekly)
        if snapshot is None or snapshot.source_updated_at <= parse_datetime(view["updated_at"]):
            snapshot = pulled
    except DingDongError:
        failure = ApiError("DINGDONG_UNAVAILABLE", 502, "伙伴数据暂不可用")
    except InvalidPrototypeReport:
        failure = ApiError("DINGDONG_RESPONSE_INVALID", 502, "伙伴数据暂不可用")
    except ApiError as exc:
        failure = exc
    if failure and snapshot is None:
        raise failure
    # Unbinding/revocation while transport was running must not expose stale access.
    current = authorized_account(request, child_id)
    if current.pk != account.pk:
        raise ApiError("STATE_CONFLICT", 409, "机器人绑定已经改变，请刷新后查看")
    return Response(
        {
            **snapshot.view,
            "sync_source": snapshot.sync_source,
            "prototype_url": settings.DINGDONG_PROTOTYPE_WEB_URL or settings.DINGDONG_BASE_URL,
        }
    )
