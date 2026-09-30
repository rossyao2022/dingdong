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
        from test_prototype_closed_loop import sample_report

        data = sample_report()
        data["persona"]["match_score"] = 82
        data["companion"].update(value=6, effective_turns=6)
        return data

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
    assert {
        key: data[key]
        for key in [
            "availability",
            "assessment_type",
            "persona_name",
            "persona_type",
            "match_score",
            "companion_value",
            "effective_turns",
            "prototype_url",
        ]
    } == {
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


@override_settings(**DEMO_SETTINGS)
def test_demo_can_be_retired_but_cannot_change_robot_without_retirement(client, monkeypatch):
    from dingdong_ca.core.ca_models import CaAccount
    from dingdong_ca.core.services import dingdong_client

    monkeypatch.setattr(dingdong_client, "call", lambda *args, **kwargs: {})
    sign_in(client)
    child = create_child(client)
    assert issue(client, child, DEMO_TOKEN).status_code == 201
    assert (
        issue(client, child, "different-robot-token").json()["code"]
        == "ACCOUNT_REPLACEMENT_REQUIRED"
    )
    retired = client.post("/api/v1/ca-accounts/ca_dingdong/retire", {}, format="json")
    assert retired.status_code == 200
    assert CaAccount.objects.get(ca_account_id="ca_dingdong").status == "retired"
    new = issue(client, child, DEMO_TOKEN)
    assert new.status_code == 201 and new.json()["ca_account_id"] != "ca_dingdong"
    assert new.json()["is_prototype_demo"] is True


@override_settings(**DEMO_SETTINGS)
def test_unbound_demo_does_not_read_old_values_and_same_token_retries(client, monkeypatch):
    from dingdong_ca.core.services import dingdong_client

    calls = []

    def failing_call(method, path, **kwargs):
        calls.append(path)
        raise dingdong_client.DingDongError("TRANSPORT", "temporary review outage")

    monkeypatch.setattr(dingdong_client, "call", failing_call)
    sign_in(client)
    child = create_child(client)
    first = issue(client, child, DEMO_TOKEN)
    assert first.json()["bind_state"] == "unbound"
    view = client.get(f"/api/v1/children/{child['id']}/prototype-demo")
    assert view.status_code == 409
    assert view.json()["code"] == "DINGDONG_BIND_PENDING"
    assert "companion_value" not in view.json()
    assert calls == ["/api/v1/ca/account/bind"]
    monkeypatch.setattr(dingdong_client, "call", lambda *args, **kwargs: {})
    retry = issue(client, child, DEMO_TOKEN)
    assert retry.status_code == 200
    assert retry.json()["ca_account_id"] == first.json()["ca_account_id"]
    assert retry.json()["bind_state"] == "bound"


@override_settings(**DEMO_SETTINGS)
def test_report_prepare_is_dry_by_default_and_idempotent_for_fixed_child(client, monkeypatch):
    from dingdong_ca.core.assessment_models import QuestionnaireVersion
    from dingdong_ca.core.models import AuditEvent
    from dingdong_ca.core.services import dingdong_client
    from dingdong_ca.testsupport.adapter import initial_result
    from dingdong_ca.testsupport.models import TestFixture

    monkeypatch.setattr(dingdong_client, "call", lambda *args, **kwargs: {})
    call_command("seed_base", stdout=StringIO())
    call_command("seed_mock", stdout=StringIO())
    sign_in(client)
    child = create_child(client)
    assert issue(client, child, DEMO_TOKEN).status_code == 201
    before = TestFixture.objects.count()
    call_command("prepare_prototype_demo_report", stdout=StringIO())
    assert TestFixture.objects.count() == before
    call_command("prepare_prototype_demo_report", apply=True, stdout=StringIO())
    q = QuestionnaireVersion.objects.get(code="initial-assessment", status="published")
    result = initial_result(child["id"], q.pk)
    assert result["metrics"][0]["value"] is None
    call_command("prepare_prototype_demo_report", apply=True, stdout=StringIO())
    assert TestFixture.objects.count() == before + 1
    assert AuditEvent.objects.filter(action="prototype_demo.prepare_report").count() == 1


def test_report_prepare_refuses_outside_demo():
    from django.core.management.base import CommandError

    with pytest.raises(CommandError, match="仅限"):
        call_command("prepare_prototype_demo_report", apply=True, stdout=StringIO())


@override_settings(**DEMO_SETTINGS)
@pytest.mark.parametrize("case", ["wrong_tag", "inactive_child", "different_input", "fault"])
def test_report_prepare_refuses_to_change_conflicting_data(client, monkeypatch, case):
    from django.core.management.base import CommandError

    from dingdong_ca.core.ca_models import CaAccount
    from dingdong_ca.core.models import Child
    from dingdong_ca.core.services import dingdong_client
    from dingdong_ca.testsupport.models import TestFixture

    monkeypatch.setattr(dingdong_client, "call", lambda *args, **kwargs: {})
    call_command("seed_base", stdout=StringIO())
    call_command("seed_mock", stdout=StringIO())
    sign_in(client)
    child = create_child(client)
    issue(client, child, DEMO_TOKEN)
    if case == "wrong_tag":
        CaAccount.objects.filter(ca_account_id="ca_dingdong").update(nfc_token_hash="0" * 64)
    elif case == "inactive_child":
        Child.objects.filter(pk=child["id"]).update(status="archived")
    else:
        TestFixture.objects.create(
            dataset="phase1-v1",
            kind="initial_result" if case == "different_input" else "fault",
            subject_key=child["id"],
            sequence=1,
            payload={"scenario": "assessment_failure"} if case == "fault" else {"keep": "original"},
        )
    before = list(TestFixture.objects.order_by("id").values("id", "payload"))
    with pytest.raises(CommandError):
        call_command("prepare_prototype_demo_report", apply=True, stdout=StringIO())
    assert list(TestFixture.objects.order_by("id").values("id", "payload")) == before
