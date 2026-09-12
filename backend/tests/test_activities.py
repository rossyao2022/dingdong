import uuid

import pytest
from conftest import assert_schema, create_child, sign_in
from django.apps import apps
from django.core.management import call_command
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db


def setup_activity(client):
    call_command("seed_base", verbosity=0)
    call_command("seed_mock", dataset="phase1-v1", mode="cold", verbosity=0)
    sign_in(client, "+8613800000008")
    child = create_child(client)
    r = client.get("/api/v1/activities")
    assert r.status_code == 200
    assert_schema("Activities", r.json())
    activity = r.json()["items"][0]
    data = {
        "request_id": str(uuid.uuid4()),
        "activity_version_id": activity["id"],
        "mode": "guide",
        "style": activity["allowed_styles"][0],
    }
    r = client.post("/api/v1/children/" + child["id"] + "/activity-records", data, format="json")
    assert r.status_code == 201, r.content
    return child, activity, r.json(), data


def test_full_activity_lifecycle_is_persistent_and_idempotent(client):
    child, a, record, data = setup_activity(client)
    assert_schema("ActivityRecord", record)
    url = "/api/v1/activity-records/" + record["id"]
    assert client.post(url + "/finish", {"status": "completed"}, format="json").status_code == 409
    r = client.patch(
        url, {"revision": record["revision"], "step_index": len(a["steps"]) - 1}, format="json"
    )
    assert r.status_code == 200
    finish = {"status": "completed", "feedback": "interesting", "note": "纸桥变稳了"}
    r = client.post(url + "/finish", finish, format="json")
    assert r.status_code == 200
    assert_schema("ActivityRecord", r.json())
    assert client.post(url + "/finish", finish, format="json").status_code == 200
    assert client.post(url + "/finish", {"status": "skipped"}, format="json").status_code == 409
    r = client.get("/api/v1/children/" + child["id"] + "/activity-records")
    assert_schema("ActivityRecords", r.json())
    assert r.json()["summary"] == {"completed_count": 1, "active_days": 1}
    assert (
        apps.get_model("core", "ActivityRecord").objects.filter(child_id=child["id"]).count() == 1
    )


def test_single_active_revision_and_skip(client):
    child, a, record, data = setup_activity(client)
    base = "/api/v1/children/" + child["id"] + "/activity-records"
    assert client.post(base, data, format="json").status_code == 200
    assert (
        client.post(base, {**data, "request_id": str(uuid.uuid4())}, format="json").status_code
        == 409
    )
    url = "/api/v1/activity-records/" + record["id"]
    assert client.patch(url, {"revision": 999, "step_index": 1}, format="json").status_code == 409
    assert client.patch(url, {"revision": 1, "step_index": 999}, format="json").status_code == 422
    assert (
        client.post(
            url + "/finish", {"status": "skipped", "note": "bad"}, format="json"
        ).status_code
        == 422
    )
    assert client.post(url + "/finish", {"status": "skipped"}, format="json").status_code == 200
    assert client.get(base).json()["summary"]["completed_count"] == 0


def test_activity_cross_family_and_retired_content(client):
    child, a, r, data = setup_activity(client)
    apps.get_model("core", "ActivityContentVersion").objects.filter(pk=a["id"]).update(
        status="retired"
    )
    url = "/api/v1/activity-records/" + r["id"]
    assert client.get(url).json()["activity"]["version"] == a["version"]
    other = APIClient(enforce_csrf_checks=True)
    sign_in(other, "+8613800000009")
    assert other.get(url).status_code == 404
    assert other.patch(url, {"revision": 1, "step_index": 1}, format="json").status_code == 404
    assert other.post(url + "/finish", {"status": "skipped"}, format="json").status_code == 404


def test_seeding_idempotent_without_overwriting_content(client):
    call_command("seed_base", verbosity=0)
    call_command("seed_base", verbosity=0)
    call_command("seed_mock", dataset="phase1-v1", mode="cold", verbosity=0)
    Model = apps.get_model("core", "ActivityContentVersion")
    count = Model.objects.count()
    row = Model.objects.first()
    row.title = "用户已编辑"
    row.save(update_fields=["title"])
    call_command("seed_mock", dataset="phase1-v1", mode="cold", verbosity=0)
    row.refresh_from_db()
    assert row.title == "用户已编辑"
    assert Model.objects.count() == count == 8
