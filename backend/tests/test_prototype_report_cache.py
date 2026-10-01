"""Frequency-scoped report cache without supplier or family side effects."""

from datetime import timedelta
from io import StringIO

import pytest
from conftest import sign_in
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import override_settings
from django.utils import timezone
from test_prototype_closed_loop import prepare_bound, push, sample_report
from test_prototype_demo import DEMO_SETTINGS

from dingdong_ca.core.models import CaAccount, ConsentGrant, PrototypeReportSnapshot
from dingdong_ca.core.services import dingdong_client
from dingdong_ca.core.services.prototype_reports import report_view, save_snapshot

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def demo(settings):
    for key, value in DEMO_SETTINGS.items():
        setattr(settings, key, value)


def outage(*args, **kwargs):
    raise dingdong_client.DingDongError("TRANSPORT", "test-only outage")


def never_call(*args, **kwargs):
    raise AssertionError("cache-only must not contact supplier")


def test_cache_only_empty_auth_frequency_and_no_transport(client, monkeypatch):
    assert client.get("/api/v1/exhibition/report?cached=1").status_code == 401
    sign_in(client)
    monkeypatch.setattr(dingdong_client, "call", never_call)
    response = client.get("/api/v1/exhibition/report?cached=1")
    assert response.status_code == 404 and response.json()["code"] == "NOT_FOUND"
    save_snapshot(report_view(sample_report(14), 14), "pull")
    assert client.get("/api/v1/exhibition/report?cached=1").status_code == 404
    response = client.get("/api/v1/exhibition/report?cached=1&weekly_turns=14")
    assert response.status_code == 200 and response.json()["weekly_turns"] == 14
    assert response.json()["availability"] == "ready"
    assert client.get("/api/v1/exhibition/report?cached=maybe").status_code == 422


def test_fault_falls_back_to_pull_and_old_cache_is_stale(client, monkeypatch):
    sign_in(client)
    monkeypatch.setattr(dingdong_client, "call", lambda *a, **k: sample_report())
    assert client.get("/api/v1/exhibition/report").status_code == 200
    monkeypatch.setattr(dingdong_client, "call", outage)
    fallback = client.get("/api/v1/exhibition/report")
    assert fallback.status_code == 200
    assert fallback.json()["availability"] == "stale" and fallback.json()["sync_source"] == "pull"
    assert client.get("/api/v1/exhibition/report?weekly_turns=3").status_code == 502
    row = PrototypeReportSnapshot.objects.get()
    # Simulate an earlier validated observation; contents remain unchanged.
    PrototypeReportSnapshot.objects.filter(pk=row.pk).update(
        created_at=timezone.now() - timedelta(days=2),
        view={key: value for key, value in row.view.items() if not key.startswith("_")},
    )
    monkeypatch.setattr(dingdong_client, "call", never_call)
    old = client.get("/api/v1/exhibition/report?cached=1")
    assert old.json()["availability"] == "stale"


def test_cache_rejects_revoked_or_unbound_and_disabled_environment(client, monkeypatch):
    child, account, grant = prepare_bound(client, monkeypatch)
    url = f"/api/v1/children/{child['id']}/prototype-demo"
    assert client.get(url).status_code == 200
    monkeypatch.setattr(dingdong_client, "call", never_call)
    assert client.get(url + "?cached=1").status_code == 200
    ConsentGrant.objects.filter(pk=grant["id"]).update(revoked_at=timezone.now())
    assert client.get(url + "?cached=1").status_code == 403
    ConsentGrant.objects.filter(pk=grant["id"]).update(revoked_at=None)
    CaAccount.objects.filter(ca_account_id=account["ca_account_id"]).update(bind_state="unbound")
    assert client.get(url + "?cached=1").status_code == 409
    with override_settings(APP_ENV="production"):
        assert client.get("/api/v1/exhibition/report?cached=1").status_code == 404
        assert client.get(url + "?cached=1").status_code == 404


def test_equal_companion_time_repeated_pull_restores_current_persona(client, monkeypatch):
    sign_in(client)
    first = sample_report()
    second = sample_report()
    second["persona"]["character_name"] = "Changed selection"
    payloads = iter([first, second, first])
    monkeypatch.setattr(dingdong_client, "call", lambda *a, **k: next(payloads))
    for expected in [first, second, first]:
        response = client.get("/api/v1/exhibition/report").json()
        assert response["persona_name"] == expected["persona"]["character_name"]
    monkeypatch.setattr(dingdong_client, "call", never_call)
    cached = client.get("/api/v1/exhibition/report?cached=1").json()
    assert cached["persona_name"] == first["persona"]["character_name"]
    assert not any(key.startswith("_") for key in cached)


def test_pull_overlapping_newer_pull_cannot_become_current(client, monkeypatch):
    sign_in(client)
    newer = report_view(sample_report(), 7)
    newer["persona_name"] = "Newer response"

    def overlapping(*args, **kwargs):
        save_snapshot(newer, "pull")
        return sample_report()

    monkeypatch.setattr(dingdong_client, "call", overlapping)
    response = client.get("/api/v1/exhibition/report")
    assert response.status_code == 200 and response.json()["persona_name"] == "Newer response"
    monkeypatch.setattr(dingdong_client, "call", never_call)
    assert (
        client.get("/api/v1/exhibition/report?cached=1").json()["persona_name"] == "Newer response"
    )


def test_invalid_stored_projection_is_never_returned(client, monkeypatch):
    sign_in(client)
    invalid = report_view(sample_report(), 7)
    invalid["growth"]["curve"] = []
    save_snapshot(invalid, "pull")
    monkeypatch.setattr(dingdong_client, "call", never_call)
    assert client.get("/api/v1/exhibition/report?cached=1").status_code == 404


def test_warm_default_dryrun_apply_four_real_gets_and_disabled_guard(monkeypatch):
    output = StringIO()
    monkeypatch.setattr(dingdong_client, "call", never_call)
    call_command("warm_prototype_reports", stdout=output)
    assert "dry-run" in output.getvalue() and PrototypeReportSnapshot.objects.count() == 0
    calls = []

    def supplier(method, path, **kwargs):
        assert method == "GET" and path == "/api/v1/ca/prototype/insights"
        calls.append(kwargs["query"])
        return sample_report(kwargs["query"]["weekly_turns"])

    monkeypatch.setattr(dingdong_client, "call", supplier)
    call_command("warm_prototype_reports", apply=True, stdout=StringIO())
    assert [c["weekly_turns"] for c in calls] == [3, 7, 14, 21]
    assert {c["ca_account_id"] for c in calls} == {"ca_dingdong"}
    assert PrototypeReportSnapshot.objects.count() == 4
    assert CaAccount.objects.count() == 0
    with override_settings(DINGDONG_PROTOTYPE_DEMO_ENABLED=False):
        with pytest.raises(CommandError):
            call_command("warm_prototype_reports", apply=True, stdout=StringIO())
    assert len(calls) == 4


def test_warm_failure_never_claims_old_cache_refreshed(monkeypatch):
    save_snapshot(report_view(sample_report(), 7), "pull")
    monkeypatch.setattr(dingdong_client, "call", outage)
    output = StringIO()
    with pytest.raises(CommandError):
        call_command("warm_prototype_reports", apply=True, stdout=output)
    assert "ready" not in output.getvalue()
    assert PrototypeReportSnapshot.objects.count() == 1


@override_settings(DINGDONG_PUSH_SECRET="synthetic-only-signing-secret")
def test_equal_source_push_during_pull_wins_and_next_pull_can_change_persona(client, monkeypatch):
    sign_in(client)
    changed = sample_report()
    changed["persona"]["character_name"] = "Webhook selection"

    def transport(*args, **kwargs):
        assert push(client, changed, "push-during-pull").status_code == 201
        return sample_report()

    monkeypatch.setattr(dingdong_client, "call", transport)
    response = client.get("/api/v1/exhibition/report")
    assert response.status_code == 200
    assert response.json()["sync_source"] == "push"
    assert response.json()["persona_name"] == "Webhook selection"
    monkeypatch.setattr(dingdong_client, "call", lambda *a, **k: sample_report())
    response = client.get("/api/v1/exhibition/report")
    assert response.json()["sync_source"] == "pull"
    assert response.json()["persona_name"] == sample_report()["persona"]["character_name"]


def test_parent_cache_cannot_read_other_family_and_guard_after_transport(client, monkeypatch):
    from rest_framework.test import APIClient

    child, account, grant = prepare_bound(client, monkeypatch)
    url = f"/api/v1/children/{child['id']}/prototype-demo"
    assert client.get(url).status_code == 200
    monkeypatch.setattr(dingdong_client, "call", never_call)
    other = APIClient(enforce_csrf_checks=True)
    sign_in(other, "+8613800000047")
    assert other.get(url + "?cached=1").status_code == 404

    def revoked_transport(*args, **kwargs):
        ConsentGrant.objects.filter(pk=grant["id"]).update(revoked_at=timezone.now())
        return sample_report()

    monkeypatch.setattr(dingdong_client, "call", revoked_transport)
    assert client.get(url).status_code == 403


def test_disable_during_transport_blocks_report(client, monkeypatch, settings):
    child, account, grant = prepare_bound(client, monkeypatch)

    def disabled_transport(*args, **kwargs):
        settings.DINGDONG_PROTOTYPE_DEMO_ENABLED = False
        return sample_report()

    monkeypatch.setattr(dingdong_client, "call", disabled_transport)
    assert client.get(f"/api/v1/children/{child['id']}/prototype-demo").status_code == 404
