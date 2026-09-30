"""Shared exhibition is separate from child-owned report and device assignment."""

import json
import uuid
from pathlib import Path

import pytest
from conftest import assert_schema, sign_in
from django.apps import apps
from django.test import override_settings
from ops_helpers import make_staff, ops_client

from dingdong_ca.core.services import dingdong_client

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def exhibition_config(settings, monkeypatch):
    settings.APP_ENV = "demo"
    settings.DINGDONG_PROTOTYPE_DEMO_ENABLED = True
    settings.DINGDONG_BASE_URL = "http://supplier.test"
    settings.DINGDONG_API_KEY = "test-only"
    settings.DINGDONG_ALLOW_HTTP = True
    settings.DINGDONG_PROTOTYPE_WEB_URL = "http://supplier.test"
    payload = json.loads((Path(__file__).parent / "fixtures/prototype-insights.json").read_text())
    monkeypatch.setattr(dingdong_client, "call", lambda *a, **k: payload)


def visit(client, event="entered", request_id=None):
    return client.post(
        "/api/v1/exhibition/visits",
        {"event": event, "request_id": request_id or str(uuid.uuid4())},
        format="json",
    )


def test_preview_auth_shared_source_and_no_personal_assignment(client):
    assert client.get("/api/v1/exhibition/report").status_code == 401
    sign_in(client)
    response = client.get("/api/v1/exhibition/report")
    assert response.status_code == 200, response.content
    assert_schema("ExhibitionReport", response.json())
    for name in ["CaAccount", "ReportVersion", "ExhibitionVisitor"]:
        assert apps.get_model("core", name).objects.count() == 0
    runtime = client.get("/api/v1/runtime").json()
    assert runtime["exhibition_enabled"] is True
    assert runtime["exhibition_chat_url"] == "http://supplier.test"
    with override_settings(APP_ENV="production"):
        assert client.get("/api/v1/exhibition/report").status_code == 404
        assert visit(client).status_code == 404
        assert client.get("/api/v1/runtime").json()["exhibition_chat_url"] is None


def test_invalid_report_never_marked_viewed_and_push_frequency_fallback(client, monkeypatch):
    sign_in(client)
    assert client.get("/api/v1/exhibition/report?weekly_turns=5").status_code == 422
    monkeypatch.setattr(dingdong_client, "call", lambda *a, **k: {"ca_account_id": "real-child"})
    assert client.get("/api/v1/exhibition/report").json()["code"] == "DINGDONG_RESPONSE_INVALID"
    assert apps.get_model("core", "ExhibitionVisitor").objects.count() == 0
    from dingdong_ca.core.services.prototype_reports import report_view, save_snapshot

    payload = json.loads((Path(__file__).parent / "fixtures/prototype-insights.json").read_text())
    event = apps.get_model("core", "DingDongPushEvent").objects.create(
        event_id="exhibition-synthetic-push", payload={}
    )
    save_snapshot(report_view(payload, 7), "push", event)
    assert client.get("/api/v1/exhibition/report").json()["sync_source"] == "push"
    assert client.get("/api/v1/exhibition/report?weekly_turns=14").status_code == 502


def test_visits_idempotent_scoped_and_strict(client):
    assert visit(client).status_code == 401
    sign_in(client)
    key = str(uuid.uuid4())
    first = visit(client, request_id=key)
    assert first.status_code == 201, first.content
    assert_schema("ExhibitionVisitorReceipt", first.json())
    assert first.json()["last_report_viewed_at"] is None
    duplicate = visit(client, request_id=key)
    assert duplicate.status_code == 200 and duplicate.json() == first.json()
    assert visit(client, "report_viewed", key).json()["code"] == "STATE_CONFLICT"
    viewed = visit(client, "report_viewed")
    assert viewed.status_code == 201 and viewed.json()["last_report_viewed_at"]
    Visitor = apps.get_model("core", "ExhibitionVisitor")
    assert Visitor.objects.count() == 1
    assert Visitor.objects.get().user.phone == "+8613800000001"
    assert visit(client, "purchase").status_code == 422
    assert (
        client.post(
            "/api/v1/exhibition/visits",
            {"event": "entered", "request_id": str(uuid.uuid4()), "phone": "123"},
            format="json",
        ).status_code
        == 422
    )


@pytest.mark.parametrize(
    "role,allowed",
    [("operations", True), ("technical", True), ("account_admin", True), ("content", False)],
)
def test_ops_followup_roles_revision_audit_and_csrf(client, role, allowed):
    sign_in(client)
    visitor_id = visit(client).json()["id"]
    operator = make_staff(role)
    staff = ops_client(operator)
    url = f"/ops/exhibition/{visitor_id}/"
    assert staff.get("/ops/exhibition/").status_code == (200 if allowed else 403)
    page = staff.get(url)
    assert page.status_code == (200 if allowed else 403)
    result = staff.post(url, {"revision": 1, "status": "contacted", "note": "已电话沟通"})
    assert result.status_code == (302 if allowed else 403)
    if allowed:
        Visitor = apps.get_model("core", "ExhibitionVisitor")
        row = Visitor.objects.get(pk=visitor_id)
        assert row.status == "contacted" and row.revision == 2
        assert (
            apps.get_model("core", "AuditEvent")
            .objects.filter(action="exhibition.followup", target_id=row.pk, actor=operator)
            .count()
            == 1
        )
        assert (
            staff.post(url, {"revision": 1, "status": "closed", "note": "旧页面"}).status_code
            == 409
        )
        row.refresh_from_db()
        assert row.status == "contacted"
        staff.credentials()
        assert staff.post(url, {"revision": 2, "status": "closed", "note": ""}).status_code == 403


def test_receipts_do_not_change_on_later_views_or_different_parent(client):
    from rest_framework.test import APIClient

    sign_in(client)
    key = str(uuid.uuid4())
    entered = visit(client, request_id=key).json()
    viewed = visit(client, "report_viewed").json()
    assert viewed["id"] == entered["id"] and viewed["last_report_viewed_at"]
    assert visit(client, request_id=key).json() == entered
    other = APIClient(enforce_csrf_checks=True)
    sign_in(other, "+8613800000049")
    assert visit(other, request_id=key).json()["id"] != entered["id"]
    assert apps.get_model("core", "ExhibitionVisitor").objects.count() == 2


@pytest.mark.parametrize(
    "url",
    [
        "javascript:alert(1)",
        "https://user:password@supplier.test",
        "https://supplier.test?phone=123",
        "https://supplier.test#token",
        "https://[broken",
    ],
)
def test_chat_url_never_returns_unsafe_config(client, settings, url):
    settings.DINGDONG_PROTOTYPE_WEB_URL = url
    assert client.get("/api/v1/runtime").json()["exhibition_chat_url"] is None
    sign_in(client)
    response = client.get("/api/v1/exhibition/report")
    assert response.status_code == 200 and response.json()["prototype_url"] is None
    assert_schema("ExhibitionReport", response.json())


def test_bound_chat_survives_report_failure_and_clears_on_retire(client, monkeypatch, settings):
    from test_prototype_closed_loop import prepare_bound
    from test_prototype_demo import DEMO_TOKEN

    settings.DINGDONG_PROTOTYPE_NFC_TOKEN = DEMO_TOKEN
    child, account, _ = prepare_bound(client, monkeypatch)
    assert account["chat_url"] == "http://supplier.test"
    monkeypatch.setattr(dingdong_client, "call", lambda *a, **k: {})
    assert client.get(f"/api/v1/children/{child['id']}/prototype-demo").status_code == 502
    assert (
        client.get(f"/api/v1/ca-accounts/{account['ca_account_id']}").json()["chat_url"]
        == "http://supplier.test"
    )
    assert (
        client.post(
            f"/api/v1/ca-accounts/{account['ca_account_id']}/retire", {}, format="json"
        ).json()["chat_url"]
        is None
    )


def test_ops_invalid_input_filter_and_escaped_note(client):
    sign_in(client)
    visitor_id = visit(client).json()["id"]
    staff = ops_client(make_staff("operations"))
    url = f"/ops/exhibition/{visitor_id}/"
    assert (
        staff.post(url, {"status": "purchase_intent", "revision": 1, "note": ""}).status_code == 422
    )
    assert (
        staff.post(url, {"status": "pending", "revision": 1, "note": "x" * 2001}).status_code == 422
    )
    assert (
        staff.post(
            url, {"status": "pending", "revision": 1, "note": "<script>alert(1)</script>"}
        ).status_code
        == 302
    )
    text = staff.get(url).content.decode()
    assert "&lt;script&gt;alert(1)&lt;/script&gt;" in text
    assert "<script>alert(1)</script>" not in text
    page = staff.get("/ops/exhibition/?status=bogus&q=%00&page=bad")
    assert page.status_code == 200 and "不是有效" in page.content.decode()


@pytest.mark.django_db(transaction=True)
def test_concurrent_visit_retries_create_one_receipt(client):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier

    from django.db import close_old_connections
    from rest_framework.test import APIClient

    login = sign_in(client)
    key = str(uuid.uuid4())
    gate = Barrier(2)

    def send():
        close_old_connections()
        try:
            worker = APIClient(enforce_csrf_checks=True)
            worker.credentials(HTTP_AUTHORIZATION="Bearer " + login["access_token"])
            gate.wait(timeout=5)
            result = visit(worker, request_id=key)
            return result.status_code, result.json()
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: send(), range(2)))
    assert sorted(code for code, _ in results) == [200, 201]
    assert results[0][1] == results[1][1]
    assert apps.get_model("core", "ExhibitionVisitor").objects.count() == 1
    assert apps.get_model("core", "ExhibitionVisit").objects.count() == 1
