"""10.4 固定账号的 NFC 演示：只在显式开启的 demo 环境生效。"""

import uuid
from io import StringIO

import pytest
from conftest import assert_schema, create_child, sign_in
from django.core.management import call_command
from django.test import override_settings
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db
DEMO_TOKEN = "exhibition-only-token"
DEMO_SETTINGS = {
    "APP_ENV": "demo",
    "DINGDONG_PROTOTYPE_DEMO_ENABLED": True,
    "DINGDONG_PROTOTYPE_NFC_TOKEN": DEMO_TOKEN,
    "DINGDONG_BASE_URL": "http://example.test",
    "DINGDONG_API_KEY": "test-key",
    "DINGDONG_ALLOW_HTTP": True,
    "DINGDONG_PROTOTYPE_WEB_URL": "http://example.test/",
}


def issue(client, child, token):
    return client.post(
        f"/api/v1/children/{child['id']}/ca-accounts",
        {"request_id": str(uuid.uuid4()), "nfc_token": token},
        format="json",
    )


@override_settings(**DEMO_SETTINGS)
def test_exhibition_token_uses_fixed_account_and_replay_reuses_it(client, monkeypatch):
    from dingdong_ca.core.services import dingdong_client

    calls = []

    def fake_call(method, path, **kwargs):
        calls.append((method, path, kwargs["payload"]["ca_account_id"]))
        return {"bind_status": "active"}

    monkeypatch.setattr(dingdong_client, "call", fake_call)
    sign_in(client)
    child = create_child(client)
    first = issue(client, child, DEMO_TOKEN)
    assert first.status_code == 201, first.content
    assert first.json()["ca_account_id"] == "ca_dingdong"
    assert first.json()["bind_state"] == "bound"
    second = issue(client, child, DEMO_TOKEN)
    assert second.status_code == 200
    assert second.json()["ca_account_id"] == "ca_dingdong"
    assert calls == [("POST", "/api/v1/ca/account/bind", "ca_dingdong")]


@override_settings(**DEMO_SETTINGS)
def test_other_token_keeps_ulid_and_fixed_account_cannot_cross_children(client, monkeypatch):
    from dingdong_ca.core.services import dingdong_client

    monkeypatch.setattr(dingdong_client, "call", lambda *args, **kwargs: {})
    sign_in(client)
    child = create_child(client)
    ordinary = issue(client, child, "ordinary-token")
    assert ordinary.status_code == 201
    assert ordinary.json()["ca_account_id"].startswith("ca_0")
    second_child = create_child(client, name="演示儿童")
    assert issue(client, second_child, DEMO_TOKEN).json()["ca_account_id"] == "ca_dingdong"
    other = APIClient(enforce_csrf_checks=True)
    sign_in(other, phone="+8613800000099")
    other_child = create_child(other)
    conflict = issue(other, other_child, DEMO_TOKEN)
    assert conflict.status_code == 409
    assert conflict.json()["code"] == "PROTOTYPE_ACCOUNT_OCCUPIED"


@override_settings(**DEMO_SETTINGS)
def test_insights_requires_owner_and_consent_and_returns_live_values(client, monkeypatch):
    from dingdong_ca.core.services import dingdong_client

    calls = []

    def fake_call(method, path, **kwargs):
        calls.append(path)
        if path.endswith("account/bind"):
            return {"bind_status": "active"}
        return {
            "ca_account_id": "ca_dingdong",
            "mode": "prototype_mock",
            "assessment": {"talent_type": "science"},
            "persona": {"character_name": "Nova", "persona_type": "science", "match_score": 82},
            "companion": {"value": 6, "effective_turns": 6},
        }

    monkeypatch.setattr(dingdong_client, "call", fake_call)
    call_command("seed_base", stdout=StringIO())
    call_command("seed_mock", stdout=StringIO())
    sign_in(client)
    child = create_child(client)
    url = f"/api/v1/children/{child['id']}/prototype-demo"
    assert client.get(url).status_code == 404
    assert issue(client, child, DEMO_TOKEN).status_code == 201
    assert client.get(url).status_code == 403
    policy = client.get("/api/v1/policies/current", {"purpose": "dingdong_sync"}).json()
    granted = client.post(
        f"/api/v1/children/{child['id']}/consents",
        {"request_id": str(uuid.uuid4()), "policy_version_id": policy["id"]},
        format="json",
    )
    assert granted.status_code == 201
    data = client.get(url).json()
    assert_schema("PrototypeDemoView", data)
    assert data == {
        "availability": "ready",
        "assessment_type": "science",
        "persona_name": "Nova",
        "persona_type": "science",
        "match_score": 82,
        "companion_value": 6,
        "effective_turns": 6,
        "prototype_url": "http://example.test/",
    }
    assert calls[-1] == "/api/v1/ca/prototype/insights"
    other = APIClient(enforce_csrf_checks=True)
    sign_in(other, phone="+8613800000099")
    assert other.get(url).status_code == 404


@override_settings(**DEMO_SETTINGS)
def test_fixed_account_is_disabled_outside_demo(client):
    with override_settings(APP_ENV="production", DINGDONG_BASE_URL="", DINGDONG_API_KEY=""):
        sign_in(client)
        child = create_child(client)
        account = issue(client, child, DEMO_TOKEN)
        assert account.status_code == 201
        assert account.json()["ca_account_id"] != "ca_dingdong"
        assert client.get(f"/api/v1/children/{child['id']}/prototype-demo").status_code == 404
