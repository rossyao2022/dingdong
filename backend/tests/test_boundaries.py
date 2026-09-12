import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta

import pytest
from conftest import assert_schema, create_child, csrf, sign_in
from django.apps import apps
from django.core.management import call_command
from django.db import IntegrityError, close_old_connections, connection, transaction
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken


@pytest.mark.django_db
def test_postgres_and_phone_constraint(client):
    assert connection.vendor == "postgresql"
    d = sign_in(client)
    User = apps.get_model("users", "User")
    with pytest.raises(IntegrityError), transaction.atomic():
        User.objects.create(username="collision", account_kind="parent", phone="+8613800000001")
    assert User.objects.filter(id=d["user"]["id"]).exists()


@pytest.mark.django_db
def test_expired_jwt_and_csrf_on_refresh(client):
    d = sign_in(client)
    t = AccessToken(d["access_token"])
    t["exp"] = int((timezone.now() - timedelta(seconds=2)).timestamp())
    client.credentials(HTTP_AUTHORIZATION="Bearer " + str(t))
    assert client.get("/api/v1/me").status_code == 401
    assert client.post("/api/v1/auth/refresh", {}, format="json").status_code == 403


@pytest.mark.django_db
def test_pagination_and_filter_bound_cursor(client):
    sign_in(client)
    for n in range(3):
        create_child(client, name=f"测试{n}")
    r = client.get("/api/v1/children?page_size=2")
    assert_schema("Children", r.json())
    assert len(r.json()["items"]) == 2
    r2 = client.get("/api/v1/children", {"page_size": 2, "cursor": r.json()["next_cursor"]})
    assert len(r2.json()["items"]) == 1 and r2.json()["next_cursor"] is None
    assert {x["id"] for x in r.json()["items"]}.isdisjoint({x["id"] for x in r2.json()["items"]})
    assert client.get("/api/v1/activities", {"cursor": r.json()["next_cursor"]}).status_code == 422
    assert client.get("/api/v1/children?page_size=101").status_code == 422


@pytest.mark.django_db
def test_activity_summary_uses_whole_result_and_shanghai_dates(client):
    call_command("seed_mock", dataset="phase1-v1", mode="cold", verbosity=0)
    sign_in(client)
    child = create_child(client)
    a = client.get("/api/v1/activities").json()["items"][0]
    for _ in range(3):
        r = client.post(
            f"/api/v1/children/{child['id']}/activity-records",
            {
                "request_id": str(uuid.uuid4()),
                "activity_version_id": a["id"],
                "mode": "web",
                "style": a["allowed_styles"][0],
            },
            format="json",
        ).json()
        url = "/api/v1/activity-records/" + r["id"]
        client.patch(url, {"revision": 1, "step_index": 2}, format="json")
        assert (
            client.post(url + "/finish", {"status": "completed"}, format="json").status_code == 200
        )
    Model = apps.get_model("core", "ActivityRecord")
    rows = list(Model.objects.filter(child_id=child["id"]).order_by("id"))
    # Distinct UTC dates but same Shanghai date; do not accidentally group by UTC.
    from datetime import datetime
    from datetime import timezone as dtz

    for row, at in zip(
        rows,
        [
            datetime(2026, 9, 10, 17, tzinfo=dtz.utc),
            datetime(2026, 9, 11, 1, tzinfo=dtz.utc),
            datetime(2026, 9, 11, 2, tzinfo=dtz.utc),
        ],
        strict=True,
    ):
        Model.objects.filter(pk=row.pk).update(started_at=at - timedelta(minutes=3), finished_at=at)
    r = client.get(f"/api/v1/children/{child['id']}/activity-records", {"page_size": 1})
    assert len(r.json()["items"]) == 1
    assert r.json()["summary"] == {"completed_count": 3, "active_days": 1}


@pytest.mark.django_db(transaction=True)
def test_concurrent_code_consumption_is_once(client):
    csrf(client)
    c = client.post("/api/v1/auth/sms", {"phone": "+8613800000001"}, format="json").json()

    def attempt(_):
        close_old_connections()
        try:
            c2 = APIClient(enforce_csrf_checks=True)
            csrf(c2)
            return c2.post(
                "/api/v1/auth/login",
                {"challenge_id": c["challenge_id"], "code": "00000"},
                format="json",
            ).status_code
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(attempt, range(2)))
    assert sorted(results) == [200, 422]
    assert apps.get_model("core", "LoginGrant").objects.count() == 1


@pytest.mark.django_db(transaction=True)
def test_concurrent_start_has_one_active_record(client):
    call_command("seed_mock", dataset="phase1-v1", mode="cold", verbosity=0)
    d = sign_in(client)
    child = create_child(client)
    a = client.get("/api/v1/activities").json()["items"][0]

    def attempt(_):
        close_old_connections()
        try:
            c = APIClient()
            c.credentials(HTTP_AUTHORIZATION="Bearer " + d["access_token"])
            return c.post(
                f"/api/v1/children/{child['id']}/activity-records",
                {
                    "request_id": str(uuid.uuid4()),
                    "activity_version_id": a["id"],
                    "mode": "web",
                    "style": a["allowed_styles"][0],
                },
                format="json",
            ).status_code
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(attempt, range(2)))
    assert sorted(results) == [201, 409]
    assert (
        apps.get_model("core", "ActivityRecord")
        .objects.filter(child_id=child["id"], status="active")
        .count()
        == 1
    )
