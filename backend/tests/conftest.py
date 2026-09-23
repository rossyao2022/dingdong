import json
import uuid
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator
from rest_framework.test import APIClient

SPEC = json.loads((Path(__file__).resolve().parents[2] / "设计/API/openapi.json").read_text())


@pytest.fixture(autouse=True)
def no_real_network(monkeypatch):
    """所有测试绝不允许真连对方端点：宁可报错，也不要偷偷发一次网络请求。

    顺带把 DingDong 配置清空：本地 ``backend/.env`` 已配真实联调值，测试的
    默认语义是「未配置」；需要已配置语义的用例用 ``override_settings`` 显式写。
    """
    from django.conf import settings

    from dingdong_ca.core.services import dingdong_client

    def refuse(*args, **kwargs):
        raise AssertionError("测试不得发起真实出站调用")

    monkeypatch.setattr(dingdong_client, "_open", refuse)
    monkeypatch.setattr(settings, "DINGDONG_BASE_URL", "")
    monkeypatch.setattr(settings, "DINGDONG_API_KEY", "")
    monkeypatch.setattr(settings, "DINGDONG_ALLOW_HTTP", False)
    monkeypatch.setattr(settings, "DINGDONG_PUSH_SECRET", "")


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
