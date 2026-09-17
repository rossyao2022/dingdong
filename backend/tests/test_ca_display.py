"""四个展示面（人设 / 周期成长报告 / 健康度 / 复测）的数据层与家长端接口。

对照 `.trellis/tasks/T-021/design.md`：可用性词表沿用 `growth.py` 既有 7 值、
业务码按 `BUSINESS_CODES` 处置、家长端一律以 `child_id` 为键（不出现
`ca_account_id`）、合成数据源零出站、真源未配置时如实报 `not_synced`。
"""

import json
import urllib.error
import uuid
from datetime import timedelta
from io import StringIO

import pytest
from conftest import assert_schema, create_child, sign_in
from django.core.management import call_command
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from dingdong_ca.testsupport import ca_display as fixtures
from dingdong_ca.testsupport.models import TestFixture

pytestmark = pytest.mark.django_db

PERSONA = "/api/v1/children/%s/companion-persona"
GROWTH = "/api/v1/children/%s/growth-cycle"
HEALTH = "/api/v1/children/%s/companion-health"
REASSESS = "/api/v1/children/%s/reassessment"
RESPOND = "/api/v1/children/%s/reassessment/%s/response"
COMPLETE = "/api/v1/children/%s/reassessment/%s/complete"

ALL_READS = (PERSONA, GROWTH, HEALTH, REASSESS)
ENVELOPE_KEYS = {"availability", "data_origin", "source", "fetched_at", "reason"}
UPSTREAM = dict(
    CA_DISPLAY_DATA_SOURCE="dingdong",
    DINGDONG_BASE_URL="https://dd.example.com",
    DINGDONG_API_KEY="k-test",
)


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
    """假传输层：`calls` 记录每次出站请求，`payload` / `http_error` 决定对方怎么答。"""
    from dingdong_ca.core.services import dingdong_client

    seen = {"calls": [], "payload": {"code": 0, "message": "ok", "data": {}}, "http_error": None}

    def fake_open(request, timeout):
        seen["calls"].append(request)
        if seen["http_error"]:
            raise urllib.error.HTTPError(request.full_url, seen["http_error"], "err", {}, None)
        return FakeResponse(seen["payload"])

    monkeypatch.setattr(dingdong_client, "_open", fake_open)
    return seen


# --- 夹具 -------------------------------------------------------------------


def add_child(client, token="ROBOT-TOKEN-A"):
    """给当前登录家庭再加一个儿童（含 CA 账户），不重复登录以免撞短信频控。"""
    child = create_child(client)
    r = client.post(
        "/api/v1/children/" + child["id"] + "/ca-accounts",
        {"request_id": str(uuid.uuid4()), "nfc_token": token},
        format="json",
    )
    assert r.status_code == 201, r.content
    return child, r.json()["ca_account_id"]


def setup_child(client, phone="+8613800000001", token="ROBOT-TOKEN-A"):
    """登录 + 建儿童 + 建 CA 账户（对方未配置时 `bind_state` 停在 unbound）。"""
    from dingdong_ca.testsupport.seed import seed_content

    seed_content()
    sign_in(client, phone=phone)
    if token is None:
        return create_child(client), None
    return add_child(client, token)


def grant_sync(client, child):
    policy = client.get("/api/v1/policies/current", {"purpose": "dingdong_sync"}).json()
    r = client.post(
        "/api/v1/children/" + child["id"] + "/consents",
        {"request_id": str(uuid.uuid4()), "policy_version_id": policy["id"]},
        format="json",
    )
    assert r.status_code == 201, r.content
    return r.json()


def ready_child(client, scenario="ca_display_normal_art", phone="+8613800000001", **kwargs):
    """已绑定 + 已授权 + 注入指定合成场景的儿童。"""
    child, account_id = setup_child(client, phone=phone, **kwargs)
    return prepare(client, child, account_id, scenario)


def ready_extra_child(client, scenario, token):
    """同一登录家庭里再备一个就绪儿童（不重复登录，短信有 60 秒频控）。"""
    child, account_id = add_child(client, token)
    return prepare(client, child, account_id, scenario)


def prepare(client, child, account_id, scenario):
    grant_sync(client, child)
    call_command("inject_fixture", child_id=child["id"], scenario=scenario, stdout=StringIO())
    return child, account_id


def set_fault(account_id, code):
    """注入一次合成出站失败（业务码原样写，供降级路径验证）。"""
    fixtures.inject_display_fault(None, code, ca_account_id=account_id)


def put_fixture(account_id, kind, payload):
    TestFixture.objects.update_or_create(
        dataset=fixtures.DATASET,
        kind=kind,
        subject_key=account_id,
        sequence=1,
        defaults={"payload": payload, "consumed_at": None},
    )


def local_event(account_id, event_id, accepted=None):
    from dingdong_ca.core.ca_models import CaAccount, CaReassessmentEvent

    account = CaAccount.objects.get(ca_account_id=account_id)
    return CaReassessmentEvent.objects.create(
        event_id=event_id,
        ca_account=account,
        child=account.child,
        trigger_type="low_engagement",
        recommended_at=timezone.now(),
        accepted=accepted,
        responded_at=timezone.now() if accepted is not None else None,
    )


def read(client, template, child, period="15d"):
    return client.get(template % child["id"], {"period": period})


# --- 可用性词表：7 个取值 ----------------------------------------------------


def test_unbound_when_child_has_no_active_account(client):
    child, _ = setup_child(client, token=None)
    body = read(client, PERSONA, child).json()
    assert body["availability"] == "unbound"
    assert body["persona"] is None and body["binding"] is None
    assert body["persona_switched"] is False


def test_no_consent_when_sync_purpose_not_granted(client):
    child, _ = setup_child(client)
    for template in ALL_READS:
        body = read(client, template, child).json()
        assert body["availability"] == "no_consent", template
        assert body["reason"] == "consent_required"


def test_no_consent_again_after_revoke(client):
    child, _ = ready_child(client)
    grant = client.get("/api/v1/children/" + child["id"] + "/consents").json()["items"][0]
    revoked = client.post("/api/v1/consents/" + grant["id"] + "/revoke", {}, format="json")
    assert revoked.status_code == 200, revoked.content
    assert read(client, PERSONA, child).json()["availability"] == "no_consent"


@override_settings(CA_DISPLAY_DATA_SOURCE="dingdong")
def test_not_synced_when_upstream_not_configured(client):
    child, _ = ready_child(client)
    for template in ALL_READS:
        body = read(client, template, child).json()
        assert body["availability"] == "not_synced", template
        assert body["reason"] == "upstream_not_configured"
    # 未接通时不给任何数值，也不许显示 0 分
    assert read(client, HEALTH, child).json()["health"] is None
    assert read(client, GROWTH, child).json()["growth_dimensions"] is None


def test_no_data_when_synthetic_fixture_absent(client):
    child, _ = setup_child(client)
    grant_sync(client, child)
    for template in ALL_READS:
        assert read(client, template, child).json()["availability"] == "no_data", template
    assert read(client, PERSONA, child).json()["reason"] == "no_persona"
    assert read(client, REASSESS, child).json()["event"] is None


def test_ready_with_synthetic_scenario(client):
    child, _ = ready_child(client)
    for template in (PERSONA, GROWTH, HEALTH):
        body = read(client, template, child).json()
        assert body["availability"] == "ready", template
        assert body["data_origin"] == "synthetic"
        assert body["source"] == "dingdong"
        assert body["reason"] is None
        assert body["fetched_at"]
        assert set(body) >= ENVELOPE_KEYS
    # 复测面只有待处理事件时才是 ready（`ca_display_normal_art` 没有事件）
    assert read(client, REASSESS, child).json()["availability"] == "no_data"
    pending, _ = ready_extra_child(client, "ca_display_switch", "ROBOT-TOKEN-SWITCH")
    assert read(client, REASSESS, pending).json()["availability"] == "ready"


def test_stale_when_sync_failed_but_data_present(client):
    child, account_id = ready_child(client)
    set_fault(account_id, "50001")
    body = read(client, PERSONA, child).json()
    assert (body["availability"], body["reason"]) == ("stale", "50001")
    # 显示上次成功的数据，不是空态
    assert body["persona"]["persona_id"] == "persona_art_01"


def test_error_when_sync_failed_without_data(client):
    child, account_id = setup_child(client)
    grant_sync(client, child)
    set_fault(account_id, "50001")
    body = read(client, PERSONA, child).json()
    assert (body["availability"], body["reason"]) == ("error", "50001")
    assert body["persona"] is None


def test_all_seven_availability_values_are_reachable(client):
    """词表不新造：`growth.py` 的 7 个取值在四个面上都能出现。"""
    seen = set()
    child, _ = setup_child(client, token=None)
    seen.add(read(client, PERSONA, child).json()["availability"])
    bound, account_id = setup_child(client, phone="+8613800000002", token="ROBOT-TOKEN-A")
    seen.add(read(client, PERSONA, bound).json()["availability"])
    grant_sync(client, bound)
    seen.add(read(client, PERSONA, bound).json()["availability"])
    with override_settings(CA_DISPLAY_DATA_SOURCE="dingdong"):
        seen.add(read(client, PERSONA, bound).json()["availability"])
    set_fault(account_id, "40401")
    seen.add(read(client, PERSONA, bound).json()["availability"])
    set_fault(account_id, "50001")
    seen.add(read(client, PERSONA, bound).json()["availability"])
    assert seen == {"unbound", "no_consent", "not_synced", "no_data", "error"}

    ready, ready_account = ready_child(client, phone="+8613800000003", token="ROBOT-TOKEN-B")
    seen.add(read(client, PERSONA, ready).json()["availability"])
    set_fault(ready_account, "50001")
    seen.add(read(client, PERSONA, ready).json()["availability"])
    assert seen == {
        "unbound",
        "no_consent",
        "not_synced",
        "no_data",
        "error",
        "ready",
        "stale",
    }


# --- 业务码处置（设计 §3.3） -------------------------------------------------


@pytest.mark.parametrize(
    ("code", "action", "with_data", "without_data"),
    [
        ("42901", "retry", "stale", "error"),
        ("50001", "retry", "stale", "error"),
        ("40101", "stop", "stale", "error"),
        ("40901", "conflict", "stale", "error"),
        ("40001", "fatal", "stale", "error"),
        ("40401", "empty", "no_data", "no_data"),
    ],
)
def test_business_codes_map_to_parent_facing_availability(
    client, code, action, with_data, without_data
):
    from dingdong_ca.core.services.dingdong_client import BUSINESS_CODES

    # 与客户端词表同源：处置语义漂移时这里会一起红
    assert BUSINESS_CODES[code][1] == action

    child, account_id = ready_child(client)
    set_fault(account_id, code)
    assert read(client, PERSONA, child).json()["availability"] == with_data

    other, other_account = setup_child(client, phone="+8613800000002", token="ROBOT-TOKEN-B")
    grant_sync(client, other)
    set_fault(other_account, code)
    assert read(client, PERSONA, other).json()["availability"] == without_data


@pytest.mark.parametrize("code", ["42901", "50001", "40101", "40901", "40001", "40401"])
@override_settings(**UPSTREAM)
def test_upstream_business_codes_never_show_fake_data(client, transport, code):
    child, _ = ready_child(client)
    transport["payload"] = {"code": code, "message": "对方不给力"}
    body = read(client, PERSONA, child).json()
    assert body["availability"] == ("no_data" if code == "40401" else "error")
    assert body["persona"] is None
    assert body["reason"] == code


@override_settings(**UPSTREAM)
def test_upstream_http_404_is_treated_as_no_data(client, transport):
    """契约里复测面只有 200/404：404 是「没有待处理建议」，不是错误。"""
    child, _ = ready_child(client, "ca_display_switch")
    transport["http_error"] = 404
    body = read(client, REASSESS, child).json()
    assert (body["availability"], body["reason"]) == ("no_data", "40401")
    assert body["event"] is None


@override_settings(**UPSTREAM)
def test_write_conflict_40901_shows_chinese_hint_not_raw_code(client, transport):
    child, account_id = ready_child(client, "ca_display_switch")
    event = local_event(account_id, "reassess_mock_002")
    transport["payload"] = {"code": "40901", "message": "绑定或状态冲突"}
    body = client.post(
        RESPOND % (child["id"], event.event_id),
        {"request_id": str(uuid.uuid4()), "accepted": True},
        format="json",
    ).json()
    # 本地状态先落库、出站失败如实标记，不出现半截状态
    assert body["accepted"] is True
    assert body["sync_pending"] is True
    assert body["sync_error"] == "这次复测的状态已经变了，请刷新页面"
    assert "40901" not in json.dumps(body, ensure_ascii=False)


# --- 复测回写：幂等与半截态 --------------------------------------------------


def test_response_is_idempotent_and_conflicting_answer_is_422(client):
    from dingdong_ca.core.ca_models import CaReassessmentEvent
    from dingdong_ca.core.models import AuditEvent

    child, _ = ready_child(client, "ca_display_switch")
    url = RESPOND % (child["id"], "reassess_mock_002")
    request_id = str(uuid.uuid4())
    first = client.post(url, {"request_id": request_id, "accepted": True}, format="json")
    assert first.status_code == 200, first.content
    assert first.json()["accepted"] is True
    assert first.json()["data_origin"] == "synthetic"

    again = client.post(url, {"request_id": request_id, "accepted": True}, format="json")
    assert again.status_code == 200
    assert again.json() == first.json()

    conflict = client.post(url, {"request_id": str(uuid.uuid4()), "accepted": False}, format="json")
    assert conflict.status_code == 422
    assert conflict.json()["code"] == "REASSESSMENT_ALREADY_ANSWERED"

    assert CaReassessmentEvent.objects.count() == 1
    assert CaReassessmentEvent.objects.get().accepted is True
    assert AuditEvent.objects.filter(action="ca_reassessment.response").count() == 1


def test_declined_reassessment_is_remembered_and_shown(client):
    child, _ = ready_child(client, "ca_display_switch")
    url = RESPOND % (child["id"], "reassess_mock_002")
    declined = client.post(url, {"request_id": str(uuid.uuid4()), "accepted": False}, format="json")
    assert declined.status_code == 200
    assert declined.json()["accepted"] is False
    # 我方状态是权威：对方还是旧值，也要显示已处理
    assert read(client, REASSESS, child).json()["event"]["accepted"] is False


def test_same_event_id_is_answerable_by_two_accounts(client):
    """P-10：事件 id 由对方发放、跨账户可能重名，唯一性按账户而不是全局。

    两个儿童各自的账户收到同一个 `event_id`（合成 fixture 的两个复测场景就是
    这样）时，第二个不再撞唯一约束拿 500；幂等语义按账户隔离。
    """
    from dingdong_ca.core.ca_models import CaReassessmentEvent

    first, _ = ready_child(client, "ca_display_reassess")
    second, _ = ready_extra_child(client, "ca_display_reassess", "ROBOT-TOKEN-SECOND")
    first_url = RESPOND % (first["id"], "reassess_mock_001")
    second_url = RESPOND % (second["id"], "reassess_mock_001")

    declined = client.post(
        first_url, {"request_id": str(uuid.uuid4()), "accepted": False}, format="json"
    )
    assert declined.status_code == 200, declined.content
    accepted = client.post(
        second_url, {"request_id": str(uuid.uuid4()), "accepted": True}, format="json"
    )
    assert accepted.status_code == 200, accepted.content

    # 同账户 + 同 event_id + 同 accepted 重放返回首次结果，不新增行
    replay = client.post(
        first_url, {"request_id": str(uuid.uuid4()), "accepted": False}, format="json"
    )
    assert replay.status_code == 200
    assert replay.json() == declined.json()
    # 换个答案仍按账户拒绝
    conflict = client.post(
        first_url, {"request_id": str(uuid.uuid4()), "accepted": True}, format="json"
    )
    assert conflict.status_code == 422
    assert conflict.json()["code"] == "REASSESSMENT_ALREADY_ANSWERED"

    assert CaReassessmentEvent.objects.count() == 2
    assert read(client, REASSESS, first).json()["event"]["accepted"] is False
    assert read(client, REASSESS, second).json()["event"]["accepted"] is True


def test_complete_is_idempotent_and_never_auto_switches(client):
    from dingdong_ca.core.ca_models import CaReassessmentEvent

    child, _ = ready_child(client, "ca_display_switch")
    event_id = "reassess_mock_002"
    assert (
        client.post(
            RESPOND % (child["id"], event_id),
            {"request_id": str(uuid.uuid4()), "accepted": True},
            format="json",
        ).status_code
        == 200
    )
    url = COMPLETE % (child["id"], event_id)
    first = client.post(
        url, {"request_id": str(uuid.uuid4()), "assessment_id": "assessment-1"}, format="json"
    )
    assert first.status_code == 200, first.content
    body = first.json()
    assert body["switch_recommended"] is True
    assert body["match_delta"] == 17
    assert body["new_persona_name"] == "Socrates"
    assert body["auto_switch"] is False

    again = client.post(
        url, {"request_id": str(uuid.uuid4()), "assessment_id": "assessment-1"}, format="json"
    )
    assert again.status_code == 200
    assert again.json() == body

    conflict = client.post(
        url, {"request_id": str(uuid.uuid4()), "assessment_id": "assessment-2"}, format="json"
    )
    assert conflict.status_code == 422
    assert conflict.json()["code"] == "REASSESSMENT_ALREADY_ANSWERED"

    assert CaReassessmentEvent.objects.count() == 1
    # V1 没有任何自动切换路径
    assert CaReassessmentEvent.objects.get().persona_switched is False


def test_complete_before_response_is_422(client):
    child, _ = ready_child(client, "ca_display_switch")
    r = client.post(
        COMPLETE % (child["id"], "reassess_mock_002"),
        {"request_id": str(uuid.uuid4()), "assessment_id": "assessment-1"},
        format="json",
    )
    assert r.status_code == 422
    assert r.json()["code"] == "REASSESSMENT_NOT_ACCEPTED"


def test_unknown_event_id_is_404_on_both_writes(client):
    child, _ = ready_child(client, "ca_display_switch")
    for template, body in [
        (RESPOND, {"accepted": True}),
        (COMPLETE, {"assessment_id": "assessment-1"}),
    ]:
        r = client.post(
            template % (child["id"], "reassess_mock_999"),
            {"request_id": str(uuid.uuid4()), **body},
            format="json",
        )
        assert r.status_code == 404, template
        assert r.json()["code"] == "REASSESSMENT_UNKNOWN"


@override_settings(**UPSTREAM)
def test_replay_does_not_call_upstream_twice(client, transport):
    child, account_id = ready_child(client, "ca_display_switch")
    event = local_event(account_id, "reassess_mock_002")
    # 建号时的那次绑定出站不计入本次回写的计数
    transport["calls"].clear()
    url = RESPOND % (child["id"], event.event_id)
    request_id = str(uuid.uuid4())
    first = client.post(url, {"request_id": request_id, "accepted": True}, format="json")
    assert first.status_code == 200, first.content
    assert len(transport["calls"]) == 1
    again = client.post(url, {"request_id": request_id, "accepted": True}, format="json")
    assert again.status_code == 200
    assert again.json()["sync_pending"] is False
    assert len(transport["calls"]) == 1


@override_settings(**UPSTREAM)
def test_complete_replay_does_not_call_upstream_twice(client, transport):
    child, account_id = ready_child(client, "ca_display_switch")
    event = local_event(account_id, "reassess_mock_002", accepted=True)
    transport["calls"].clear()
    transport["payload"] = {
        "code": 0,
        "message": "ok",
        "data": {
            "new_profile_id": "profile_mock_003",
            "new_persona_id": "persona_philosophy_01",
            "new_persona_name": "Socrates",
            "match_delta": 17,
        },
    }
    url = COMPLETE % (child["id"], event.event_id)
    first = client.post(
        url, {"request_id": str(uuid.uuid4()), "assessment_id": "assessment-1"}, format="json"
    )
    assert first.status_code == 200, first.content
    # 对方没给判断时按表 7.2 的阈值算：17 ≥ 15
    assert first.json()["switch_recommended"] is True
    assert len(transport["calls"]) == 1
    again = client.post(
        url, {"request_id": str(uuid.uuid4()), "assessment_id": "assessment-1"}, format="json"
    )
    assert again.json() == first.json()
    assert len(transport["calls"]) == 1


@override_settings(**UPSTREAM)
def test_complete_write_failure_is_reported_not_swallowed(client, transport):
    child, account_id = ready_child(client, "ca_display_switch")
    event = local_event(account_id, "reassess_mock_002", accepted=True)
    transport["calls"].clear()
    transport["payload"] = {"code": "40901", "message": "绑定或状态冲突"}
    url = COMPLETE % (child["id"], event.event_id)
    body = client.post(
        url, {"request_id": str(uuid.uuid4()), "assessment_id": "assessment-1"}, format="json"
    ).json()
    # 本地已落库、出站失败如实标记，不出现半截状态
    assert body["sync_pending"] is True
    assert body["sync_error"] == "这次复测的状态已经变了，请刷新页面"
    assert body["auto_switch"] is False
    assert len(transport["calls"]) == 1
    # 重放不再出站，也不重复落库
    again = client.post(
        url, {"request_id": str(uuid.uuid4()), "assessment_id": "assessment-1"}, format="json"
    )
    assert again.status_code == 200
    assert again.json() == body
    assert len(transport["calls"]) == 1


# --- 入参、隔离与零出站 ------------------------------------------------------


@pytest.mark.parametrize("period", ["7d", "15", "30", "1d", "15D", ""])
def test_growth_period_rejects_anything_but_15d_and_30d(client, period):
    child, _ = ready_child(client)
    r = client.get(GROWTH % child["id"], {"period": period})
    assert r.status_code == 422
    assert r.json()["code"] == "VALIDATION_ERROR"


def test_growth_period_missing_is_422(client):
    child, _ = ready_child(client)
    assert client.get(GROWTH % child["id"]).status_code == 422


def test_growth_serves_each_tab_from_its_own_period(client):
    child, _ = ready_child(client, "ca_display_normal_science")
    assert read(client, GROWTH, child, "30d").json()["period"]["days"] == 30
    # 该场景只有 30 天报告：15 天 Tab 是空态，不是拿 30 天的数据顶
    missing = read(client, GROWTH, child, "15d").json()
    assert missing["availability"] == "no_data"
    assert missing["growth_dimensions"] is None


def test_growth_empty_reason_distinguishes_not_yet_and_no_period_data(client):
    from dingdong_ca.core.ca_models import CaAccount

    child, account_id = setup_child(client)
    grant_sync(client, child)
    assert read(client, GROWTH, child).json()["reason"] == "period_incomplete"
    CaAccount.objects.filter(ca_account_id=account_id).update(
        bound_at=timezone.now() - timedelta(days=40)
    )
    assert read(client, GROWTH, child).json()["reason"] == "no_period_data"


def test_display_endpoints_are_scoped_to_the_owning_family(client):
    child, _ = ready_child(client, "ca_display_switch")
    other = APIClient(enforce_csrf_checks=True)
    sign_in(other, phone="+8613800000002")
    for template in ALL_READS:
        assert read(other, template, child).status_code == 404, template
    for template, body in [
        (RESPOND, {"accepted": True}),
        (COMPLETE, {"assessment_id": "assessment-1"}),
    ]:
        r = other.post(
            template % (child["id"], "reassess_mock_002"),
            {"request_id": str(uuid.uuid4()), **body},
            format="json",
        )
        assert r.status_code == 404, template


def test_synthetic_mode_makes_zero_outbound_calls(client):
    """`no_real_network` 是 autouse：合成模式下任何一次出站都会立刻 AssertionError。"""
    child, _ = ready_child(client, "ca_display_switch")
    for template in ALL_READS:
        assert read(client, template, child).status_code == 200, template
    responded = client.post(
        RESPOND % (child["id"], "reassess_mock_002"),
        {"request_id": str(uuid.uuid4()), "accepted": True},
        format="json",
    )
    assert responded.status_code == 200
    assert responded.json()["data_origin"] == "synthetic"
    assert responded.json()["sync_pending"] is False
    completed = client.post(
        COMPLETE % (child["id"], "reassess_mock_002"),
        {"request_id": str(uuid.uuid4()), "assessment_id": "assessment-1"},
        format="json",
    )
    assert completed.status_code == 200
    assert completed.json()["data_origin"] == "synthetic"


def test_ca_account_id_never_reaches_the_parent_api(client):
    child, account_id = ready_child(client, "ca_display_switch")
    bodies = [read(client, template, child).json() for template in ALL_READS]
    bodies.append(
        client.post(
            RESPOND % (child["id"], "reassess_mock_002"),
            {"request_id": str(uuid.uuid4()), "accepted": True},
            format="json",
        ).json()
    )
    bodies.append(
        client.post(
            COMPLETE % (child["id"], "reassess_mock_002"),
            {"request_id": str(uuid.uuid4()), "assessment_id": "assessment-1"},
            format="json",
        ).json()
    )
    blob = json.dumps(bodies, ensure_ascii=False)
    assert "ca_account_id" not in blob
    assert account_id not in blob


# --- 展示映射与契约形状 ------------------------------------------------------


def test_persona_view_maps_type_to_chinese(client):
    child, _ = ready_child(client)
    body = read(client, PERSONA, child).json()
    assert body["persona"]["type_label"] == "艺术"
    assert body["persona"]["learning_style_tags"] == ["imitation", "open"]
    # 学习风格取值也给中文对照：与 tags 同序，原 code 留给界面放进 title。
    assert body["persona"]["learning_style_labels"] == ["模仿", "开放"]
    assert body["binding"]["match_score"] == 82
    assert set(body["binding"]) == {"binding_id", "bind_time", "match_score", "status"}


def test_persona_view_leaves_unknown_learning_style_label_null(client):
    """对方 code 表未确认：不在映射表里的取值给 null，界面不猜中文。"""
    child, account_id = ready_child(client)
    payload = fixtures.persona_payload(
        "persona_art_01", "bind_mock_001", 82, "2026-09-01T02:05:00+08:00"
    )
    payload["persona"]["learning_style_tags"] = ["imitation", "unseen_tag"]
    put_fixture(account_id, fixtures.PERSONA_KIND, payload)
    body = read(client, PERSONA, child).json()
    assert body["persona"]["learning_style_tags"] == ["imitation", "unseen_tag"]
    assert body["persona"]["learning_style_labels"] == ["模仿", None]


def test_growth_dimensions_keep_fixed_order_and_missing_stay_null(client):
    child, account_id = ready_child(client)
    payload = fixtures.growth_payload(
        persona_id="persona_art_01",
        match_score=82,
        days=15,
        start="2026-09-01",
        end="2026-09-15",
        companion_start=12,
        companion_end=47,
        index=58.31,
        stage="developing",
        progress=55,
        dimensions=[64, None, 66, None, 44, 57, 51, 42],
        generated_at="2026-09-16T00:10:00+08:00",
        profile_id="profile_under_test",
    )
    payload["growth_dimensions"]["creativity"] = 99  # 契约外维度不进响应
    put_fixture(account_id, fixtures.GROWTH_KIND, payload)

    body = read(client, GROWTH, child).json()
    dims = body["growth_dimensions"]
    assert list(dims) == list(fixtures.GROWTH_DIMENSIONS)
    assert dims["logical"] is None and dims["spatial"] is None
    # 缺失维度不补 0、不插值
    assert set(dims.values()) - {None} == {64, 66, 44, 57, 51, 42}
    assert body["companion"] == {"start": 12, "end": 47, "delta": 35}
    assert body["engagement"]["stage_label"] == "成长"
    assert body["algorithm_version"] == "growth_v1"


def test_growth_dimension_labels_come_from_backend_in_fixed_order(client):
    """八维中文名由后端下发（与 `stage_label` 同一做法），键与八维同序同集。"""
    child, account_id = ready_child(client)
    payload = fixtures.growth_payload(
        persona_id="persona_art_01",
        match_score=82,
        days=15,
        start="2026-09-01",
        end="2026-09-15",
        companion_start=12,
        companion_end=47,
        index=58.31,
        stage="developing",
        progress=55,
        dimensions=[64, None, 66, None, 44, 57, 51, 42],
        generated_at="2026-09-16T00:10:00+08:00",
        profile_id="profile_under_test",
    )
    put_fixture(account_id, fixtures.GROWTH_KIND, payload)

    body = read(client, GROWTH, child).json()
    labels = body["growth_dimension_labels"]
    assert list(labels) == list(fixtures.GROWTH_DIMENSIONS)
    assert labels["linguistic"] == "语言成长代理"
    assert labels["bodily"] == "实践成长代理"
    assert labels["naturalistic"] == "自然成长代理"
    assert all(labels.values())


def test_health_view_maps_trigger_reason_to_chinese(client):
    child, _ = ready_child(client, "ca_display_reassess")
    health = read(client, HEALTH, child).json()["health"]
    assert health["status"] == "reassess"
    assert health["trigger_label"] == "连续多期互动偏少"
    assert health["observation_days"] == 21
    assert health["reassessment_recommended"] is True


def test_unknown_health_status_falls_back_to_not_judged(client):
    """表 3.6 枚举写得不全：未知取值不猜、不按 normal 展示，也不给复测 CTA。"""
    child, account_id = ready_child(client)
    put_fixture(
        account_id,
        fixtures.HEALTH_KIND,
        fixtures.health_payload(
            health_id="health_under_test",
            persona_id="persona_art_01",
            observation_days=20,
            companion_delta=10,
            health_score=77,
            status="switch_candidate",
            recommended=True,
            trigger_reason="low_engagement",
            evaluated_at="2026-09-22T09:00:00+08:00",
        ),
    )
    body = read(client, HEALTH, child).json()
    assert body["availability"] == "ready"
    assert body["reason"] == "unknown_health_status"
    assert body["health"]["status"] == "insufficient_data"
    assert body["health"]["reassessment_recommended"] is False


# --- 合成输入的纪律 ----------------------------------------------------------


def test_responses_match_the_published_contract(client):
    """响应形状与 `设计/API/openapi.json` 的 schema 一致，空态与有数据态都要对。"""
    read_schemas = [
        (PERSONA, "CompanionPersonaView"),
        (GROWTH, "GrowthCycleView"),
        (HEALTH, "CompanionHealthView"),
        (REASSESS, "ReassessmentView"),
    ]
    ready, _ = ready_child(client, "ca_display_switch")
    for template, schema in read_schemas:
        assert_schema(schema, read(client, template, ready).json())

    bare, _ = add_child(client, "ROBOT-TOKEN-EMPTY")
    grant_sync(client, bare)
    for template, schema in read_schemas:
        body = read(client, template, bare).json()
        assert body["availability"] == "no_data"
        assert_schema(schema, body)

    unbound, _ = add_child(client, "ROBOT-TOKEN-UNBOUND")  # 未授权 → no_consent
    for template, schema in read_schemas:
        assert_schema(schema, read(client, template, unbound).json())

    assert_schema(
        "ReassessmentResponseResult",
        client.post(
            RESPOND % (ready["id"], "reassess_mock_002"),
            {"request_id": str(uuid.uuid4()), "accepted": True},
            format="json",
        ).json(),
    )
    assert_schema(
        "ReassessmentCompleteResult",
        client.post(
            COMPLETE % (ready["id"], "reassess_mock_002"),
            {"request_id": str(uuid.uuid4()), "assessment_id": "assessment-1"},
            format="json",
        ).json(),
    )


def test_display_scenarios_match_the_six_mock_accounts():
    assert fixtures.display_scenarios() == [
        "ca_display_new_user",
        "ca_display_normal_art",
        "ca_display_normal_science",
        "ca_display_reassess",
        "ca_display_switch",
        "ca_display_watch",
    ]


def test_synthetic_display_payloads_carry_no_credentials():
    blob = json.dumps(fixtures.DISPLAY_SCENARIOS, ensure_ascii=False).lower()
    for banned in ["nfc_token", "nfc", "api_key", "apikey", "secret", "password", "bearer"]:
        assert banned not in blob, banned


def test_every_display_scenario_is_injectable_and_readable(client):
    setup_child(client)
    for scenario in fixtures.display_scenarios():
        child, account_id = ready_extra_child(client, scenario, "ROBOT-" + scenario)
        assert TestFixture.objects.filter(
            kind=fixtures.HEALTH_KIND, subject_key=account_id
        ).exists()
        assert read(client, HEALTH, child).json()["availability"] == "ready"


def test_inject_fixture_command_accepts_display_scenarios(client):
    child, account_id = setup_child(client)
    out = StringIO()
    call_command("inject_fixture", child_id=child["id"], scenario="ca_display_reassess", stdout=out)
    assert account_id in out.getvalue()
    assert TestFixture.objects.filter(
        kind=fixtures.REASSESSMENT_KIND, subject_key=account_id
    ).exists()
