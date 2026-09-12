import uuid

import pytest
from conftest import assert_schema, create_child, sign_in
from django.apps import apps
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db


def test_child_create_update_idempotency_and_contract(client):
    sign_in(client)
    data = {
        "request_id": str(uuid.uuid4()),
        "name": "小芽",
        "gender": "unknown",
        "birth_date": None,
    }
    r = client.post("/api/v1/children", data, format="json")
    assert r.status_code == 201
    child = r.json()
    assert_schema("Child", child)
    r = client.post("/api/v1/children", data, format="json")
    assert r.status_code == 200
    assert r.json()["id"] == child["id"]
    r = client.post("/api/v1/children", {**data, "name": "另一个孩子"}, format="json")
    assert r.status_code == 409
    assert apps.get_model("core", "Child").objects.count() == 1
    r = client.patch("/api/v1/children/" + child["id"], {"name": "新称呼"}, format="json")
    assert r.status_code == 200 and r.json()["name"] == "新称呼"
    # Creation idempotency remains stable even after a legitimate later edit.
    assert client.post("/api/v1/children", data, format="json").status_code == 200
    assert_schema("Children", client.get("/api/v1/children").json())


@pytest.mark.parametrize(
    "field,value",
    [
        ("grade", "一年级"),
        ("family_id", str(uuid.uuid4())),
        ("is_staff", True),
        ("birth_date", "2999-01-01"),
        ("name", "   "),
        ("gender", "invalid"),
    ],
)
def test_invalid_child_fields(client, field, value):
    sign_in(client)
    r = client.post(
        "/api/v1/children",
        {"request_id": str(uuid.uuid4()), "name": "测试", field: value},
        format="json",
    )
    assert r.status_code == 422
    assert_schema("Error", r.json())


def test_family_isolation_and_anonymous_access(client):
    sign_in(client)
    c = create_child(client)
    other = APIClient(enforce_csrf_checks=True)
    sign_in(other, "+8613800000002")
    assert other.get("/api/v1/children").json()["items"] == []
    assert (
        other.patch("/api/v1/children/" + c["id"], {"name": "越权"}, format="json").status_code
        == 404
    )
    assert APIClient().get("/api/v1/children").status_code == 401
