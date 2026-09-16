"""家长端的 CA 账户接口：NFC 承接、建号、查询与归档。

对应 `设计/CA对接_C1_ca_account_id设计_20260916.md` §7 的落地清单。
对外调用的 8 个 DingDong 接口**不在这里**——那些是我方发起的出站调用，
需要对方给 base URL 与 key，见 D10/D12。
"""

from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.response import Response

from dingdong_ca.core.ca_models import CaAccount
from dingdong_ca.core.services import ca_account as service

from .children import owned_child
from .common import endpoint, family_for, paginate, validate
from .inputs import StrictSerializer, StrictString


class IssueInput(StrictSerializer):
    request_id = serializers.UUIDField()
    # NFC token 来自机器人标签上的 NDEF URI，含 token 原文，不能 trim。
    nfc_token = StrictString(min_length=1, max_length=2048, trim_whitespace=False)
    robot_ref = StrictString(max_length=64, required=False)


def serialize_account(row):
    return {
        "ca_account_id": row.ca_account_id,
        "child_id": str(row.child_id),
        "family_id": str(row.family_id),
        "robot_ref": row.robot_ref,
        # 只给短指纹：运营比对"是不是同一台机器人"够用，且无法反推原文。
        "nfc_token_fingerprint": service.token_fingerprint(row.nfc_token_hash),
        "status": row.status,
        "bind_state": row.bind_state,
        "bound_at": row.bound_at.isoformat(),
        "unbound_at": row.unbound_at.isoformat() if row.unbound_at else None,
        "created_at": row.created_at.isoformat(),
    }


@endpoint(["GET", "POST"])
def child_accounts(request, child_id):
    # 不加行锁：建号时 service 会在自己的事务里锁住孩子，串行化并发建号。
    child = owned_child(request, child_id)
    if request.method == "GET":
        return Response(
            paginate(
                CaAccount.objects.filter(child=child),
                request,
                serialize_account,
                "ca-accounts:" + str(child.pk),
            )
        )
    data = validate(IssueInput, request.data)
    account, created = service.issue_account(
        child=child,
        user=request.user,
        request_id=data["request_id"],
        nfc_token=data["nfc_token"],
        robot_ref=data.get("robot_ref"),
    )
    return Response(serialize_account(account), status=201 if created else 200)


@endpoint(["GET"])
def account_detail(request, ca_account_id):
    # 已归档的号也要能读：家长端"上一台设备的历史记录"靠它。
    row = get_object_or_404(
        CaAccount.objects.filter(family=family_for(request.user)), ca_account_id=ca_account_id
    )
    return Response(serialize_account(row))


@endpoint(["POST"])
def account_retire(request, ca_account_id):
    row = get_object_or_404(
        CaAccount.objects.filter(family=family_for(request.user)), ca_account_id=ca_account_id
    )
    service.retire_account(row, request.user)
    return Response(serialize_account(row))
