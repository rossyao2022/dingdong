"""Authorized shared mock report, using validated pull or frequency-matched push."""

from rest_framework import serializers
from rest_framework.response import Response

from dingdong_ca.core.ca_models import CaAccount
from dingdong_ca.core.models import ConsentGrant
from dingdong_ca.core.services import ca_account
from dingdong_ca.core.services.prototype_reports import WEEKLY_TURNS, shared_snapshot

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
    snapshot = shared_snapshot(weekly)
    # Unbinding/revocation while transport was running must not expose stale access.
    current = authorized_account(request, child_id)
    if current.pk != account.pk:
        raise ApiError("STATE_CONFLICT", 409, "机器人绑定已经改变，请刷新后查看")
    return Response(
        {
            **snapshot.view,
            "sync_source": snapshot.sync_source,
            "prototype_url": ca_account.prototype_chat_url(),
        }
    )
