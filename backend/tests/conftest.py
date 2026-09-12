import json
import uuid
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator
from rest_framework.test import APIClient

SPEC = json.loads((Path(__file__).resolve().parents[2] / "设计/API/openapi.json").read_text())


@pytest.fixture
def client():
    return APIClient(enforce_csrf_checks=True)


def csrf(client):
    response = client.get("/api/v1/auth/csrf")
    assert response.status_code == 200, response.content
    client.credentials(HTTP_X_CSRFTOKEN=response.json()["csrf_token"])


def sign_in(client, phone="+8613800000001"):
    csrf(client)
    response = client.post("/api/v1/auth/sms", {"phone": phone}, format="json")
    assert response.status_code == 200, response.content
    challenge = response.json()["challenge_id"]
    response = client.post(
        "/api/v1/auth/login", {"challenge_id": challenge, "code": "00000"}, format="json"
    )
    assert response.status_code == 200, response.content
    token = response.json()["access_token"]
    client.credentials(
        HTTP_AUTHORIZATION="Bearer " + token, HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value
    )
    return response.json()


def create_child(client, **changes):
    data = {"request_id": str(uuid.uuid4()), "name": "测试小芽", **changes}
    response = client.post("/api/v1/children", data, format="json")
    assert response.status_code == 201, response.content
    return response.json()


def assert_schema(name, data):
    schema = {"$ref": "#/components/schemas/" + name, "components": SPEC["components"]}
    Draft202012Validator(schema).validate(data)
