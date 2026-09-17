from datetime import timedelta

import pytest
from conftest import assert_schema, csrf, sign_in
from django.apps import apps
from django.utils import timezone
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db


def test_fixed_code_login_creates_real_family_and_grant(client):
    data = sign_in(client)
    assert_schema("LoginResponse", data)
    User = apps.get_model("users", "User")
    assert User.objects.filter(account_kind="parent").count() == 1
    user = User.objects.get(pk=data["user"]["id"])
    assert not user.has_usable_password()
    assert not user.is_staff
    assert apps.get_model("core", "Family").objects.count() == 1
    assert apps.get_model("core", "LoginGrant").objects.filter(user=user).count() == 1
    assert client.cookies["refresh_token"]["httponly"]
    assert client.cookies["refresh_token"]["path"] == "/api/v1/auth/"
    assert_schema("User", client.get("/api/v1/me").json())


def test_csrf_is_enforced_before_login(client):
    r = client.post("/api/v1/auth/sms", {"phone": "+8613800000001"}, format="json")
    assert r.status_code == 403
    assert_schema("Error", r.json())


def test_sms_rate_limit_and_error_shape(client):
    csrf(client)
    assert (
        client.post("/api/v1/auth/sms", {"phone": "+8613800000001"}, format="json").status_code
        == 200
    )
    r = client.post("/api/v1/auth/sms", {"phone": "+8613800000001"}, format="json")
    assert r.status_code == 429
    assert int(r["Retry-After"]) > 0
    assert_schema("Error", r.json())


@pytest.mark.parametrize("code", ["0000", 0, "abcde"])
def test_code_is_strict_five_character_string(client, code):
    csrf(client)
    c = client.post("/api/v1/auth/sms", {"phone": "+8613800000001"}, format="json").json()
    r = client.post(
        "/api/v1/auth/login", {"challenge_id": c["challenge_id"], "code": code}, format="json"
    )
    assert r.status_code == 422


def test_wrong_attempts_persist_and_lock(client):
    csrf(client)
    c = client.post("/api/v1/auth/sms", {"phone": "+8613800000001"}, format="json").json()
    for _ in range(5):
        assert (
            client.post(
                "/api/v1/auth/login",
                {"challenge_id": c["challenge_id"], "code": "11111"},
                format="json",
            ).status_code
            == 422
        )
    row = apps.get_model("core", "SmsChallenge").objects.get(pk=c["challenge_id"])
    assert row.failed_attempts == 5 and row.status == "locked"
    assert (
        client.post(
            "/api/v1/auth/login",
            {"challenge_id": c["challenge_id"], "code": "00000"},
            format="json",
        ).status_code
        == 422
    )
    assert apps.get_model("users", "User").objects.count() == 0


def test_challenge_consumed_and_expired(client):
    csrf(client)
    c = client.post("/api/v1/auth/sms", {"phone": "+8613800000001"}, format="json").json()
    payload = {"challenge_id": c["challenge_id"], "code": "00000"}
    assert client.post("/api/v1/auth/login", payload, format="json").status_code == 200
    client.credentials(HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value)
    assert client.post("/api/v1/auth/login", payload, format="json").status_code == 422
    csrf(client)
    c = client.post("/api/v1/auth/sms", {"phone": "+8613800000002"}, format="json").json()
    apps.get_model("core", "SmsChallenge").objects.filter(pk=c["challenge_id"]).update(
        expires_at=timezone.now() - timedelta(seconds=1)
    )
    r = client.post(
        "/api/v1/auth/login", {"challenge_id": c["challenge_id"], "code": "00000"}, format="json"
    )
    assert r.status_code == 422
    assert r.json()["code"] == "SMS_CHALLENGE_EXPIRED"


def test_refresh_rotation_fixed_deadline_and_logout(client):
    data = sign_in(client)
    Grant = apps.get_model("core", "LoginGrant")
    grant = Grant.objects.get(user_id=data["user"]["id"])
    deadline = grant.expires_at
    original_refresh = client.cookies["refresh_token"].value
    old_access = data["access_token"]
    r = client.post("/api/v1/auth/refresh", {}, format="json")
    assert r.status_code == 200
    assert_schema("TokenResponse", r.json())
    new_refresh = client.cookies["refresh_token"].value
    assert new_refresh != original_refresh
    grant.refresh_from_db()
    assert grant.expires_at == deadline
    client.cookies["refresh_token"] = original_refresh
    assert client.post("/api/v1/auth/refresh", {}, format="json").status_code == 401
    client.cookies["refresh_token"] = new_refresh
    assert client.post("/api/v1/auth/logout", {}, format="json").status_code == 204
    client.credentials(HTTP_AUTHORIZATION="Bearer " + old_access)
    assert client.get("/api/v1/me").status_code == 401


def test_other_login_survives_one_device_logout(client):
    sign_in(client)
    Challenge = apps.get_model("core", "SmsChallenge")
    Challenge.objects.update(created_at=timezone.now() - timedelta(seconds=61))
    second = APIClient(enforce_csrf_checks=True)
    sign_in(second)
    assert apps.get_model("users", "User").objects.count() == 1
    assert client.post("/api/v1/auth/logout", {}, format="json").status_code == 204
    assert second.get("/api/v1/me").status_code == 200


def test_disabled_user_and_forged_token_rejected(client):
    d = sign_in(client)
    apps.get_model("users", "User").objects.filter(pk=d["user"]["id"]).update(is_active=False)
    assert client.get("/api/v1/me").status_code == 401
    client.credentials(HTTP_AUTHORIZATION="Bearer invalid-token")
    assert client.get("/api/v1/me").status_code == 401


def test_staff_cannot_login_as_parent(client):
    apps.get_model("users", "User").objects.create_user(
        username="staff",
        phone="+8613800000001",
        account_kind="staff",
        is_staff=True,
        password="test-pass",
    )
    csrf(client)
    r = client.post("/api/v1/auth/sms", {"phone": "+8613800000001"}, format="json")
    # A separate parent identity is allowed by the design, but must never authenticate staff.
    c = r.json()
    r = client.post(
        "/api/v1/auth/login", {"challenge_id": c["challenge_id"], "code": "00000"}, format="json"
    )
    assert r.status_code == 200
    user = apps.get_model("users", "User").objects.get(pk=r.json()["user"]["id"])
    assert user.account_kind == "parent" and not user.is_staff
