"""CA 账户（`ca_account_id`）与 DingDong 客户端的边界测试。

对照 `设计/CA对接_C1_ca_account_id设计_20260916.md` 的三项决定：
账户级、一台机器人一个号、一台机器人服务一个孩子、换机发新号。
"""

import json
import uuid

import pytest
from conftest import create_child, sign_in
from django.test import override_settings
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db

ACCOUNT = "/api/v1/ca-accounts/"


def issue(client, child, token="ROBOT-TOKEN-A", request_id=None, **extra):
    body = {
        "request_id": request_id or str(uuid.uuid4()),
        "nfc_token": token,
        **extra,
    }
    return client.post("/api/v1/children/" + child["id"] + "/ca-accounts", body, format="json")


def setup_child(client, phone="+8613800000001"):
    sign_in(client, phone=phone)
    return create_child(client)


# --- 号码形态与建号 ---------------------------------------------------------


def test_issue_returns_opaque_number_without_faking_binding(client):
    child = setup_child(client)
    r = issue(client, child)
    assert r.status_code == 201, r.content
    body = r.json()
    # ca_ + 26 位 Crockford Base32（无 I/L/O/U）
    assert body["ca_account_id"].startswith("ca_")
    suffix = body["ca_account_id"][3:]
    assert len(suffix) == 26
    assert set(suffix) <= set("0123456789ABCDEFGHJKMNPQRSTVWXYZ")
    assert body["child_id"] == child["id"]
    assert body["status"] == "active"
    # 没配 base URL / key 之前不许显示"已绑定"
    assert body["bind_state"] == "unbound"
    assert body["bound_at"]
    assert body["unbound_at"] is None


def test_token_plaintext_never_reaches_database(client):
    from dingdong_ca.core.ca_models import CaAccount
    from dingdong_ca.core.services import ca_account as service

    child = setup_child(client)
    token = "ROBOT-TOKEN-SECRET-9f2c"
    assert issue(client, child, token=token).status_code == 201
    row = CaAccount.objects.get()
    assert token not in json.dumps({"hash": row.nfc_token_hash, "id": row.ca_account_id})
    assert row.nfc_token_hash == service.nfc_token_digest(token)
    assert len(row.nfc_token_hash) == 64
    # 对外只给短指纹，够比对不可反推
    assert (
        issue(client, child, token=token).json()["nfc_token_fingerprint"]
        == (row.nfc_token_hash[:8])
    )


def test_ulid_is_time_ordered_and_format_checked():
    from datetime import timedelta

    from django.utils import timezone

    from dingdong_ca.core.services import ca_account as service

    now = timezone.now()
    early = service.new_ca_account_id(now)
    later = service.new_ca_account_id(now + timedelta(seconds=1))
    assert early < later, "ULID 应随时序单调，便于排查与分页"
    assert service.is_valid_ca_account_id(early)
    assert not service.is_valid_ca_account_id("ca_short")
    assert not service.is_valid_ca_account_id("xx_01JC8Z9K3M7QXR2V6TB4NDH5PF")
    # Crockford 排除了 I/L/O/U，避免 0/O、1/I 抄错
    assert not service.is_valid_ca_account_id("ca_01JC8Z9K3M7QXR2V6TB4NDH5PI")


# --- 幂等与换机 -------------------------------------------------------------


def test_replaying_same_request_id_returns_same_number(client):
    child = setup_child(client)
    request_id = str(uuid.uuid4())
    first = issue(client, child, request_id=request_id)
    assert first.status_code == 201
    again = issue(client, child, request_id=request_id)
    assert again.status_code == 200
    assert again.json()["ca_account_id"] == first.json()["ca_account_id"]
    conflict = issue(client, child, token="ROBOT-TOKEN-B", request_id=request_id)
    assert conflict.status_code == 409
    assert conflict.json()["code"] == "IDEMPOTENCY_CONFLICT"


def test_same_robot_rebind_reuses_number(client):
    child = setup_child(client)
    first = issue(client, child, token="ROBOT-TOKEN-A")
    again = issue(client, child, token="ROBOT-TOKEN-A")
    assert again.status_code == 200
    assert again.json()["ca_account_id"] == first.json()["ca_account_id"]


def test_changing_robot_requires_retiring_old_number_first(client):
    child = setup_child(client)
    first = issue(client, child, token="ROBOT-TOKEN-A").json()
    # 直接换机器人：不许悄悄改号，也不许自动归档
    repl = issue(client, child, token="ROBOT-TOKEN-B")
    assert repl.status_code == 409
    assert repl.json()["code"] == "ACCOUNT_REPLACEMENT_REQUIRED"
    # 显式两步：先归档旧号
    retired = client.post(ACCOUNT + first["ca_account_id"] + "/retire", {}, format="json")
    assert retired.status_code == 200
    assert retired.json()["status"] == "retired"
    assert retired.json()["unbound_at"]
    # 再为新机器人发新号
    second = issue(client, child, token="ROBOT-TOKEN-B")
    assert second.status_code == 201
    assert second.json()["ca_account_id"] != first["ca_account_id"]


def test_retired_number_stays_readable_but_stops_resolving(client):
    from dingdong_ca.core.api.common import ApiError
    from dingdong_ca.core.services import ca_account as service

    child = setup_child(client)
    first = issue(client, child, token="ROBOT-TOKEN-A").json()
    client.post(ACCOUNT + first["ca_account_id"] + "/retire", {}, format="json")
    # 家长端"上一台设备的历史记录"要读得到
    assert client.get(ACCOUNT + first["ca_account_id"]).status_code == 200
    assert client.get(ACCOUNT + first["ca_account_id"]).json()["status"] == "retired"
    # 但对外调用不再认它
    with pytest.raises(ApiError) as exc:
        service.resolve_account(first["ca_account_id"])
    assert (exc.value.code, exc.value.status) == ("CA_ACCOUNT_UNKNOWN", 404)


def test_one_robot_cannot_hold_two_active_accounts(client):
    """同一台机器人绑到第二个家庭时必须被数据库条件唯一约束挡住。"""
    first = setup_child(client)
    a = issue(client, first, token="ROBOT-TOKEN-SHARED")
    assert a.status_code == 201
    other = APIClient(enforce_csrf_checks=True)
    second = setup_child(other, phone="+8613800000002")
    blocked = issue(other, second, token="ROBOT-TOKEN-SHARED")
    assert blocked.status_code == 409
    assert blocked.json()["code"] == "CA_ACCOUNT_CONFLICT"


def test_retire_is_idempotent(client):
    child = setup_child(client)
    first = issue(client, child).json()
    one = client.post(ACCOUNT + first["ca_account_id"] + "/retire", {}, format="json")
    two = client.post(ACCOUNT + first["ca_account_id"] + "/retire", {}, format="json")
    assert (one.status_code, two.status_code) == (200, 200)
    assert one.json()["unbound_at"] == two.json()["unbound_at"]


# --- 归属与可见性 -----------------------------------------------------------


def test_accounts_are_scoped_to_the_owning_family(client):
    child = setup_child(client)
    mine = issue(client, child).json()
    assert len(client.get("/api/v1/children/" + child["id"] + "/ca-accounts").json()["items"]) == 1
    other = APIClient(enforce_csrf_checks=True)
    sign_in(other, phone="+8613800000002")
    assert other.get(ACCOUNT + mine["ca_account_id"]).status_code == 404
    assert (
        other.post(ACCOUNT + mine["ca_account_id"] + "/retire", {}, format="json").status_code
        == 404
    )
    # 别人的孩子也不能拿来建号
    assert issue(other, child).status_code == 404


def test_audit_records_creation_and_retirement(client):
    from dingdong_ca.core.models import AuditEvent

    child = setup_child(client)
    first = issue(client, child).json()
    client.post(ACCOUNT + first["ca_account_id"] + "/retire", {}, format="json")
    actions = list(AuditEvent.objects.values_list("action", "target_kind"))
    assert ("ca_account.create", "ca_account") in actions
    assert ("ca_account.retire", "ca_account") in actions


def test_audit_labels_cover_ca_account_actions():
    from dingdong_ca.ops import labels as L

    assert L.AUDIT_ACTION["ca_account.create"] == "建立 CA 账户"
    assert L.AUDIT_ACTION["ca_account.retire"] == "归档 CA 账户"
    assert L.TARGET_KIND["ca_account"] == "CA 账户"


# --- DingDong 客户端 --------------------------------------------------------


class FakeResponse:
    def __init__(self, payload):
        self._payload = json.dumps(payload).encode("utf-8")

    def read(self):
        return self._payload

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


@pytest.fixture(autouse=True)
def no_real_network(monkeypatch):
    """测试里绝不允许真连对方端点：宁可报错，也不要偷偷发一次网络请求。"""
    from dingdong_ca.core.services import dingdong_client

    def refuse(*args, **kwargs):
        raise AssertionError("测试不得发起真实出站调用")

    monkeypatch.setattr(dingdong_client, "_open", refuse)


@pytest.fixture
def transport(no_real_network, monkeypatch):
    from dingdong_ca.core.services import dingdong_client

    seen = {"payload": {"code": 0, "message": "ok", "request_id": "r-1", "data": {}}}

    def fake_open(request, timeout):
        seen["request"] = request
        seen["timeout"] = timeout
        return FakeResponse(seen["payload"])

    monkeypatch.setattr(dingdong_client, "_open", fake_open)
    return seen


def test_client_refuses_to_call_when_not_configured():
    from dingdong_ca.core.services.dingdong_client import DingDongNotConfigured, call, is_configured

    assert not is_configured()
    with pytest.raises(DingDongNotConfigured):
        call("POST", "/api/v1/ca/account/bind", payload={})


@override_settings(DINGDONG_BASE_URL="https://dd.example.com", DINGDONG_API_KEY="k-test")
def test_client_sends_key_https_and_idempotency_header(transport):
    from dingdong_ca.core.services import dingdong_client

    dingdong_client.call(
        "POST", "/api/v1/ca/account/bind", payload={"ca_account_id": "ca_X"}, request_id="req-9"
    )
    headers = {k.lower(): v for k, v in transport["request"].headers.items()}
    assert headers["x-api-key"] == "k-test"
    assert headers["x-request-id"] == "req-9"
    assert headers["content-type"] == "application/json"
    assert transport["request"].get_method() == "POST"
    assert transport["request"].full_url.startswith("https://dd.example.com/api/v1/ca/")


@override_settings(DINGDONG_BASE_URL="http://dd.example.com", DINGDONG_API_KEY="k-test")
def test_client_rejects_plaintext_base_url():
    from dingdong_ca.core.services.dingdong_client import DingDongError, call

    with pytest.raises(DingDongError) as exc:
        call("GET", "/api/v1/ca/profile/current")
    assert exc.value.code == "INSECURE_ENDPOINT"


@pytest.mark.parametrize(
    ("code", "action", "retryable", "empty"),
    [
        ("40001", "fatal", False, False),
        ("40101", "stop", False, False),
        ("40401", "empty", False, True),
        ("40901", "conflict", False, False),
        ("42901", "retry", True, False),
        ("50001", "retry", True, False),
    ],
)
def test_business_codes_map_to_handling(transport, code, action, retryable, empty):
    from dingdong_ca.core.services.dingdong_client import DingDongError, call

    with override_settings(DINGDONG_BASE_URL="https://dd.example.com", DINGDONG_API_KEY="k"):
        transport["payload"] = {"code": code, "message": "对方不给力"}
        with pytest.raises(DingDongError) as exc:
            call("GET", "/api/v1/ca/persona/current")
    assert exc.value.code == code
    assert exc.value.action == action
    assert exc.value.retryable is retryable
    assert exc.value.means_empty is empty
    assert exc.value.message == "对方不给力"


def test_bind_attempt_is_skipped_while_unconfigured(client):
    """未配置 base URL/key 时建号照常，但 bind_state 必须留在 unbound，不许伪造绑定。"""
    child = setup_child(client)
    assert issue(client, child).json()["bind_state"] == "unbound"


@override_settings(DINGDONG_BASE_URL="https://dd.example.com", DINGDONG_API_KEY="k-test")
def test_bind_success_flips_state(client, transport):
    from dingdong_ca.core.ca_models import CaAccount

    transport["payload"] = {"code": 0, "message": "ok", "request_id": "r-2", "data": {}}
    child = setup_child(client)
    assert issue(client, child).json()["bind_state"] == "bound"
    assert CaAccount.objects.get().bind_state == "bound"


@override_settings(DINGDONG_BASE_URL="https://dd.example.com", DINGDONG_API_KEY="k-test")
def test_bind_failure_keeps_account_and_stays_unbound(client, transport):
    """绑定失败不回滚建号：号码仍有效，状态如实停在 unbound。"""
    from dingdong_ca.core.ca_models import CaAccount

    transport["payload"] = {"code": 50001, "message": "对方炸了"}
    child = setup_child(client)
    r = issue(client, child)
    assert r.status_code == 201
    assert r.json()["bind_state"] == "unbound"
    assert CaAccount.objects.count() == 1
