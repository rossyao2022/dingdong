"""Exhibition source mapping, handover and verified report projections."""

import uuid

import pytest
from conftest import create_child, sign_in
from django.test import override_settings
from rest_framework.test import APIClient
from test_ca_accounts import issue
from test_prototype_demo import DEMO_SETTINGS, DEMO_TOKEN

from dingdong_ca.core.models import CaAccount

pytestmark = pytest.mark.django_db


@override_settings(**DEMO_SETTINGS)
def test_two_families_handover_preserves_old_account_and_uses_fixed_source(client, monkeypatch):
    from dingdong_ca.core.services import dingdong_client

    calls = []
    monkeypatch.setattr(
        dingdong_client, "call", lambda method, path, **kw: calls.append((method, path, kw)) or {}
    )
    sign_in(client)
    child_a = create_child(client)
    request_id = str(uuid.uuid4())
    first = issue(client, child_a, DEMO_TOKEN, request_id=request_id)
    assert first.status_code == 201
    assert first.json()["is_prototype_demo"] is True
    old_id = first.json()["ca_account_id"]
    other = APIClient(enforce_csrf_checks=True)
    sign_in(other, "+8613800000079")
    child_b = create_child(other)
    assert issue(other, child_b, DEMO_TOKEN).json()["code"] == "PROTOTYPE_ACCOUNT_OCCUPIED"
    assert other.post(f"/api/v1/ca-accounts/{old_id}/retire", {}, format="json").status_code == 404
    assert client.post(f"/api/v1/ca-accounts/{old_id}/retire", {}, format="json").status_code == 200
    replay = issue(client, child_a, DEMO_TOKEN, request_id=request_id)
    assert replay.status_code == 409
    assert replay.json()["code"] == "CA_ACCOUNT_RETIRED"
    second = issue(other, child_b, DEMO_TOKEN)
    assert second.status_code == 201 and second.json()["is_prototype_demo"] is True
    assert second.json()["ca_account_id"] != old_id
    assert second.json()["ca_account_id"].startswith("ca_0")
    old = CaAccount.objects.get(ca_account_id=old_id)
    assert old.status == "retired" and str(old.child_id) == child_a["id"]
    assert (
        old.prototype_demo
        and CaAccount.objects.filter(prototype_demo=True, status="active").count() == 1
    )
    assert (
        client.post(
            f"/api/v1/ca-accounts/{second.json()['ca_account_id']}/retire", {}, format="json"
        ).status_code
        == 404
    )
    assert [c[2]["payload"]["ca_account_id"] for c in calls] == ["ca_dingdong", "ca_dingdong"]
    assert all(c[1].endswith("account/bind") for c in calls)


def sample_report(weekly=7, updated="2026-09-30T09:36:29.185359+00:00"):
    import json
    from pathlib import Path

    data = json.loads((Path(__file__).parent / "fixtures/prototype-insights.json").read_text())
    data["growth"]["weekly_turns"] = weekly
    data["companion"]["updated_at"] = updated
    return data


def prepare_bound(client, monkeypatch):
    from io import StringIO

    from django.core.management import call_command

    from dingdong_ca.core.services import dingdong_client

    call_command("seed_mock", stdout=StringIO())
    monkeypatch.setattr(
        dingdong_client,
        "call",
        lambda method, path, **kw: (
            {} if method == "POST" else sample_report(kw["query"]["weekly_turns"])
        ),
    )
    sign_in(client)
    child = create_child(client)
    account = issue(client, child, DEMO_TOKEN).json()
    policy = client.get("/api/v1/policies/current", {"purpose": "dingdong_sync"}).json()
    grant = client.post(
        f"/api/v1/children/{child['id']}/consents",
        {"request_id": str(uuid.uuid4()), "policy_version_id": policy["id"]},
        format="json",
    ).json()
    return child, account, grant


def push(
    client, data, event_id="synthetic-event", event_type="dingdong.prototype.companion_milestone"
):
    import copy
    import hashlib
    import hmac
    import json
    import time

    from django.conf import settings

    data = copy.deepcopy(data)
    data["companion"]["effective_turns"] = 24
    raw = json.dumps(
        {
            "event_type": event_type,
            "occurred_at": data["companion"]["updated_at"],
            "milestone": {"interval": 3, "completed_turns": 24},
            "data": data,
        }
    ).encode()
    stamp = str(int(time.time()))
    signature = (
        "sha256="
        + hmac.new(
            settings.DINGDONG_PUSH_SECRET.encode(), stamp.encode() + b"." + raw, hashlib.sha256
        ).hexdigest()
    )
    return client.post(
        "/api/dingdong/prototype/events",
        raw,
        content_type="application/json",
        HTTP_X_DINGDONG_TIMESTAMP=stamp,
        HTTP_X_DINGDONG_SIGNATURE=signature,
        HTTP_X_DINGDONG_EVENT_ID=event_id,
        HTTP_X_DINGDONG_EVENT_TYPE=event_type,
    )


@override_settings(**DEMO_SETTINGS, DINGDONG_PUSH_SECRET="synthetic-only-signing-secret")
def test_verified_push_projection_and_frequency_specific_outage_fallback(client, monkeypatch):
    from dingdong_ca.core.models import DingDongPushEvent, PrototypeReportSnapshot
    from dingdong_ca.core.services import dingdong_client

    child, account, grant = prepare_bound(client, monkeypatch)
    url = f"/api/v1/children/{child['id']}/prototype-demo"
    data = client.get(url, {"weekly_turns": 14}).json()
    assert data["weekly_turns"] == 14 and data["growth"]["weekly_turns"] == 14
    assert len(data["assessment"]["baseline_scores"]) == 8
    assert data["growth"]["curve"][-1]["day"] == 180
    assert data["sync_source"] == "pull"
    assert push(client, sample_report()).status_code == 201
    event = DingDongPushEvent.objects.get(event_id="synthetic-event")
    assert event.processing_status == "processed" and event.processing_error == ""
    assert PrototypeReportSnapshot.objects.filter(event=event).count() == 1
    duplicate = push(client, sample_report())
    assert duplicate.status_code == 200 and duplicate.json()["duplicate"]
    assert PrototypeReportSnapshot.objects.filter(event=event).count() == 1
    monkeypatch.setattr(
        dingdong_client,
        "call",
        lambda *args, **kw: (_ for _ in ()).throw(
            dingdong_client.DingDongError("TRANSPORT", "synthetic outage")
        ),
    )
    fallback = client.get(url)
    assert fallback.status_code == 200 and fallback.json()["sync_source"] == "push"
    assert client.get(url, {"weekly_turns": 14}).status_code == 502
    assert client.get(url, {"weekly_turns": 6}).status_code == 422
    assert (
        client.post(
            f"/api/v1/ca-accounts/{account['ca_account_id']}/retire", {}, format="json"
        ).status_code
        == 200
    )
    assert client.get(url).status_code == 404


@override_settings(**DEMO_SETTINGS, DINGDONG_PUSH_SECRET="synthetic-only-signing-secret")
def test_older_push_or_pull_cannot_replace_latest_verified_snapshot(client, monkeypatch):
    child, account, grant = prepare_bound(client, monkeypatch)
    latest = sample_report(updated="2026-09-30T10:36:00+00:00")
    latest["companion"]["value"] = 33
    assert push(client, latest, "newest").status_code == 201
    older = sample_report(updated="2026-09-30T09:00:00+00:00")
    assert push(client, older, "older").status_code == 201
    response = client.get(f"/api/v1/children/{child['id']}/prototype-demo")
    assert response.status_code == 200
    assert response.json()["sync_source"] == "push" and response.json()["companion_value"] == 33


@override_settings(**DEMO_SETTINGS, DINGDONG_PUSH_SECRET="synthetic-only-signing-secret")
@pytest.mark.parametrize(
    "case",
    [
        "unknown_event",
        "wrong_source",
        "mode",
        "dimensions",
        "nan",
        "curve_order",
        "curve_number",
        "huge",
    ],
)
def test_invalid_or_unsupported_push_is_retained_without_projection(client, monkeypatch, case):
    from dingdong_ca.core.models import DingDongPushEvent, PrototypeReportSnapshot

    child, account, grant = prepare_bound(client, monkeypatch)
    data = sample_report()
    event_type = "dingdong.prototype.companion_milestone"
    if case == "unknown_event":
        event_type = "unexpected.created"
    if case == "wrong_source":
        data["ca_account_id"] = "ca_someone_else"
    if case == "mode":
        data["mode"] = "production"
    if case == "dimensions":
        data["assessment"]["baseline_scores"].pop("bodily")
    if case == "huge":
        data["growth"]["current"]["dimensions"]["logical"] = 10**1000
    if case == "nan":
        data["growth"]["current"]["dimensions"]["logical"] = float("nan")
    if case == "curve_order":
        data["growth"]["curve"].reverse()
    if case == "curve_number":
        data["growth"]["curve"][0]["dimensions"]["logical"] = True
    response = push(client, data, event_type=event_type)
    assert response.status_code == 201
    event = DingDongPushEvent.objects.get()
    assert event.processing_status in ["ignored", "invalid"] and event.processing_error
    assert PrototypeReportSnapshot.objects.count() == 0


def test_operator_push_page_is_technical_only_and_excludes_payload(client):
    from ops_helpers import make_staff, ops_client

    from dingdong_ca.core.models import DingDongPushEvent

    DingDongPushEvent.objects.create(
        event_id="secret-id-visible-only-as-hash",
        payload={"password": "NEVER_SHOW_RAW_BODY"},
        processing_status="ignored",
        processing_error="UNSUPPORTED_EVENT",
    )
    denied = ops_client(make_staff("content")).get("/ops/dingdong-push/")
    assert denied.status_code == 403
    allowed = ops_client(make_staff("technical")).get("/ops/dingdong-push/")
    assert allowed.status_code == 200
    html = allowed.content.decode()
    assert "推送接收与报告快照" in html and "UNSUPPORTED_EVENT" in html
    assert "NEVER_SHOW_RAW_BODY" not in html and "secret-id-visible-only-as-hash" not in html


@override_settings(**DEMO_SETTINGS)
@pytest.mark.django_db(transaction=True)
def test_concurrent_demo_ownership_has_one_winner(monkeypatch):
    from concurrent.futures import ThreadPoolExecutor

    from django.db import close_old_connections

    from dingdong_ca.core.services import dingdong_client

    monkeypatch.setattr(dingdong_client, "call", lambda *args, **kw: {})
    contenders = []
    for phone in ["+8613800000076", "+8613800000077"]:
        c = APIClient(enforce_csrf_checks=True)
        sign_in(c, phone)
        contenders.append((c, create_child(c)))

    def run(args):
        close_old_connections()
        try:
            return issue(args[0], args[1], DEMO_TOKEN).status_code
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(run, contenders))
    assert sorted(results) == [201, 409]
    assert CaAccount.objects.filter(prototype_demo=True, status="active").count() == 1


@override_settings(**DEMO_SETTINGS)
def test_late_bind_response_does_not_revive_retired_account(client, monkeypatch):
    from django.utils import timezone

    from dingdong_ca.core.services import dingdong_client

    def retiring_transport(*args, **kw):
        row = CaAccount.objects.get()
        CaAccount.objects.filter(pk=row.pk).update(status="retired", unbound_at=timezone.now())
        return {}

    monkeypatch.setattr(dingdong_client, "call", retiring_transport)
    sign_in(client)
    child = create_child(client)
    response = issue(client, child, DEMO_TOKEN)
    assert response.json()["status"] == "retired" and response.json()["bind_state"] == "unbound"


@override_settings(**DEMO_SETTINGS)
def test_disabled_prototype_cannot_send_fixed_source_to_formal_transport(client, monkeypatch):
    from dingdong_ca.core.services import ca_account, dingdong_client

    child, account, grant = prepare_bound(client, monkeypatch)
    row = CaAccount.objects.get(ca_account_id=account["ca_account_id"])
    CaAccount.objects.filter(pk=row.pk).update(bind_state="unbound")
    row.refresh_from_db()

    def unexpected(*args, **kw):
        raise AssertionError("no source transport when prototype disabled")

    monkeypatch.setattr(dingdong_client, "call", unexpected)
    with override_settings(DINGDONG_PROTOTYPE_DEMO_ENABLED=False):
        assert ca_account.attempt_bind(row, DEMO_TOKEN) is None
        with pytest.raises(dingdong_client.DingDongNotConfigured):
            ca_account.source_account_id(row)
        assert client.get(f"/api/v1/children/{child['id']}/prototype-demo").status_code == 404


@override_settings(**DEMO_SETTINGS, DINGDONG_PUSH_SECRET="synthetic-only-signing-secret")
def test_snapshot_is_immutable_and_revoked_consent_blocks_cache(client, monkeypatch):
    from django.core.exceptions import ValidationError

    from dingdong_ca.core.models import PrototypeReportSnapshot

    child, account, grant = prepare_bound(client, monkeypatch)
    assert push(client, sample_report()).status_code == 201
    snapshot = PrototypeReportSnapshot.objects.get()
    snapshot.view["companion_value"] = 999
    with pytest.raises(ValidationError):
        snapshot.save()
    assert (
        client.post("/api/v1/consents/" + grant["id"] + "/revoke", {}, format="json").status_code
        == 200
    )
    assert client.get(f"/api/v1/children/{child['id']}/prototype-demo").status_code == 403


@override_settings(DINGDONG_PUSH_SECRET="synthetic-only-signing-secret")
def test_unicode_timestamp_is_structured_rejection_without_event(client, caplog):
    from dingdong_ca.core.models import DingDongPushEvent

    response = client.post(
        "/api/dingdong/prototype/events",
        b"{}",
        content_type="application/json",
        HTTP_X_DINGDONG_TIMESTAMP="١٧٨٠٠٠٠٠٠٠",
        HTTP_X_DINGDONG_SIGNATURE="sha256=invalid",
        HTTP_X_DINGDONG_EVENT_ID="NO_RAW_EVENT_ID",
    )
    assert response.status_code == 400 and response.json()["code"] == "PUSH_TIMESTAMP_INVALID"
    assert not DingDongPushEvent.objects.exists()
    assert "NO_RAW_EVENT_ID" not in caplog.text


@override_settings(**DEMO_SETTINGS, DINGDONG_PUSH_SECRET="synthetic-only-signing-secret")
def test_milestone_count_mismatch_does_not_promote(client, monkeypatch):
    import hashlib
    import hmac
    import json
    import time

    from dingdong_ca.core.models import DingDongPushEvent, PrototypeReportSnapshot

    prepare_bound(client, monkeypatch)
    raw = json.dumps(
        {"data": sample_report(), "milestone": {"interval": 3, "completed_turns": 3}}
    ).encode()
    stamp = str(int(time.time()))
    signed = (
        "sha256="
        + hmac.new(
            b"synthetic-only-signing-secret", stamp.encode() + b"." + raw, hashlib.sha256
        ).hexdigest()
    )
    response = client.post(
        "/api/dingdong/prototype/events",
        raw,
        content_type="application/json",
        HTTP_X_DINGDONG_TIMESTAMP=stamp,
        HTTP_X_DINGDONG_SIGNATURE=signed,
        HTTP_X_DINGDONG_EVENT_ID="invalid-count",
        HTTP_X_DINGDONG_EVENT_TYPE="dingdong.prototype.companion_milestone",
    )
    assert response.status_code == 201
    assert DingDongPushEvent.objects.get().processing_error == "INVALID_MILESTONE"
    assert not PrototypeReportSnapshot.objects.exists()


@override_settings(**DEMO_SETTINGS, DINGDONG_PUSH_SECRET="synthetic-only-signing-secret")
def test_equal_timestamp_prefers_fresh_pull_for_persona_change(client, monkeypatch):
    from dingdong_ca.core.services import dingdong_client

    child, account, grant = prepare_bound(client, monkeypatch)
    assert push(client, sample_report()).status_code == 201
    fresh = sample_report()
    fresh["persona"]["character_name"] = "Current selection"
    monkeypatch.setattr(dingdong_client, "call", lambda *args, **kw: fresh)
    response = client.get(f"/api/v1/children/{child['id']}/prototype-demo")
    assert response.status_code == 200
    assert response.json()["sync_source"] == "pull"
    assert response.json()["persona_name"] == "Current selection"
