"""会展固定账号的只读聚合结果；仅限授权家长查看。"""

from math import isfinite

from django.conf import settings
from rest_framework.response import Response

from dingdong_ca.core.ca_models import CaAccount
from dingdong_ca.core.models import ConsentGrant
from dingdong_ca.core.services import ca_account, dingdong_client
from dingdong_ca.core.services.dingdong_client import DingDongError

from .children import owned_child
from .common import ApiError, endpoint


def _number(value):
    if isinstance(value, bool):
        return None
    try:
        result = float(value)
    except TypeError, ValueError:
        return None
    if not isfinite(result) or result < 0:
        return None
    return int(result) if result.is_integer() else result


@endpoint(["GET"])
def insights(request, child_id):
    if not ca_account.prototype_demo_enabled():
        raise ApiError("NOT_FOUND", 404, "演示未开启")
    child = owned_child(request, child_id)
    account = CaAccount.objects.filter(
        child=child, status="active", ca_account_id=ca_account.PROTOTYPE_ACCOUNT_ID
    ).first()
    if account is None:
        raise ApiError("NOT_FOUND", 404, "当前档案未连接演示伙伴")
    if not ConsentGrant.objects.filter(
        child=child, purpose="dingdong_sync", revoked_at__isnull=True
    ).exists():
        raise ApiError("CONSENT_REQUIRED", 403, "请先同意查看机器人记录")
    if not dingdong_client.is_configured():
        raise ApiError("DINGDONG_NOT_CONFIGURED", 503, "伙伴数据暂不可用")
    try:
        data = dingdong_client.call(
            "GET",
            "/api/v1/ca/prototype/insights",
            query={"ca_account_id": account.ca_account_id, "weekly_turns": 7},
        )
    except DingDongError:
        raise ApiError("DINGDONG_UNAVAILABLE", 502, "伙伴数据暂不可用") from None
    if data.get("ca_account_id") != ca_account.PROTOTYPE_ACCOUNT_ID:
        raise ApiError("DINGDONG_RESPONSE_INVALID", 502, "伙伴数据暂不可用")
    persona = data.get("persona") or {}
    companion = data.get("companion") or {}
    assessment = data.get("assessment") or {}
    return Response(
        {
            "availability": "ready",
            "assessment_type": assessment.get("talent_type"),
            "persona_name": persona.get("character_name"),
            "persona_type": persona.get("persona_type"),
            "match_score": _number(persona.get("match_score")),
            "companion_value": _number(companion.get("value")),
            "effective_turns": _number(companion.get("effective_turns")),
            "prototype_url": settings.DINGDONG_PROTOTYPE_WEB_URL or settings.DINGDONG_BASE_URL,
        }
    )
