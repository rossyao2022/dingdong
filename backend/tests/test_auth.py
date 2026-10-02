import json
import re
from datetime import timedelta
from io import StringIO

import pytest
from conftest import assert_schema, csrf, sign_in
from django.apps import apps
from django.core.management import call_command
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken

from dingdong_ca.core.api.accounts import token_pair

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize("phone", ["", "   "])
def test_blank_phone_error_is_chinese_without_internal_repr(client, phone):
    """空手机号必须回中文提示；不许把 ErrorDetail 的 repr 当文案透给家长端。"""
    csrf(client)
    r = client.post("/api/v1/auth/sms", {"phone": phone}, format="json")
    assert r.status_code == 422
    data = r.json()
    assert_schema("Error", data)
    assert "ErrorDetail(" not in json.dumps(data, ensure_ascii=False)
    assert data["field_errors"], "空手机号应给出字段级提示"
    for item in data["field_errors"]:
        assert item["message"].strip()
        assert not item["message"].startswith("[")
        assert re.search(r"[\u4e00-\u9fff]", item["message"])


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


def test_persistent_login_keeps_short_access_and_durable_cookie(client):
    data = sign_in(client)
    grant = apps.get_model("core", "LoginGrant").objects.get(user_id=data["user"]["id"])
    assert grant.expires_at is None
    assert data["expires_in"] == 600
    access = AccessToken(data["access_token"])
    refresh = RefreshToken(client.cookies["refresh_token"].value)
    assert 599 <= access["exp"] - access["iat"] <= 600
    assert 400 * 24 * 60 * 60 - 1 <= refresh["exp"] - refresh["iat"] <= 400 * 24 * 60 * 60
    assert int(client.cookies["refresh_token"]["max-age"]) == 400 * 24 * 60 * 60
    assert client.cookies["refresh_token"]["samesite"] == "Lax"


def test_persistent_refresh_survives_original_seven_days_and_extends_cookie(client, monkeypatch):
    data = sign_in(client)
    old_refresh = RefreshToken(client.cookies["refresh_token"].value)
    later = timezone.now() + timedelta(days=8)
    monkeypatch.setattr(timezone, "now", lambda: later)
    r = client.post("/api/v1/auth/refresh", {}, format="json")
    assert r.status_code == 200
    new_refresh = RefreshToken(client.cookies["refresh_token"].value)
    assert new_refresh["exp"] > old_refresh["exp"] + 7 * 24 * 60 * 60
    assert int(client.cookies["refresh_token"]["max-age"]) == 400 * 24 * 60 * 60
    client.credentials(HTTP_AUTHORIZATION="Bearer " + r.json()["access_token"])
    assert client.get("/api/v1/me").status_code == 200
    grant = apps.get_model("core", "LoginGrant").objects.get(user_id=data["user"]["id"])
    assert grant.expires_at is None


def test_saved_cookie_restores_login_without_saved_access_token(client):
    data = sign_in(client)
    reopened = APIClient(enforce_csrf_checks=True)
    reopened.cookies["refresh_token"] = client.cookies["refresh_token"].value
    assert reopened.get("/api/v1/me").status_code == 401
    csrf(reopened)
    r = reopened.post("/api/v1/auth/refresh", {}, format="json")
    assert r.status_code == 200
    reopened.credentials(HTTP_AUTHORIZATION="Bearer " + r.json()["access_token"])
    assert reopened.get("/api/v1/me").json()["id"] == data["user"]["id"]


def test_valid_legacy_login_upgrades_on_refresh(client):
    data = sign_in(client)
    grant = apps.get_model("core", "LoginGrant").objects.get(user_id=data["user"]["id"])
    grant.expires_at = timezone.now() + timedelta(days=2)
    grant.save(update_fields=["expires_at"])
    _, legacy_refresh = token_pair(grant)
    client.cookies["refresh_token"] = legacy_refresh
    r = client.post("/api/v1/auth/refresh", {}, format="json")
    assert r.status_code == 200
    grant.refresh_from_db()
    assert grant.expires_at is None
    assert int(client.cookies["refresh_token"]["max-age"]) == 400 * 24 * 60 * 60


@pytest.mark.parametrize("invalid", ["expired", "revoked", "disabled"])
def test_refresh_never_revives_invalid_login(client, invalid):
    data = sign_in(client)
    grant = apps.get_model("core", "LoginGrant").objects.get(user_id=data["user"]["id"])
    if invalid == "expired":
        grant.expires_at = timezone.now() - timedelta(seconds=1)
        grant.save(update_fields=["expires_at"])
    elif invalid == "revoked":
        grant.revoked_at = timezone.now()
        grant.save(update_fields=["revoked_at"])
    else:
        grant.user.is_active = False
        grant.user.save(update_fields=["is_active"])
    old_jti = grant.current_refresh_jti
    r = client.post("/api/v1/auth/refresh", {}, format="json")
    assert r.status_code == 401
    assert "refresh_token" not in r.cookies
    grant.refresh_from_db()
    assert grant.current_refresh_jti == old_jti
    if invalid == "expired":
        assert grant.expires_at is not None


def test_cleanup_preserves_persistent_login_and_removes_old_revoked_grant(client):
    data = sign_in(client)
    Grant = apps.get_model("core", "LoginGrant")
    grant = Grant.objects.get(user_id=data["user"]["id"])
    Grant.objects.filter(pk=grant.pk).update(created_at=timezone.now() - timedelta(days=500))
    call_command("cleanup_auth", stdout=StringIO())
    assert Grant.objects.filter(pk=grant.pk).exists()
    assert client.get("/api/v1/me").status_code == 200
    grant.revoked_at = timezone.now()
    grant.save(update_fields=["revoked_at"])
    call_command("cleanup_auth", stdout=StringIO())
    assert Grant.objects.filter(pk=grant.pk).exists()
    grant.revoked_at = timezone.now() - timedelta(days=2)
    grant.save(update_fields=["revoked_at"])
    call_command("cleanup_auth", stdout=StringIO())
    assert not Grant.objects.filter(pk=grant.pk).exists()


def test_refresh_rotation_persistent_grant_and_logout(client):
    data = sign_in(client)
    Grant = apps.get_model("core", "LoginGrant")
    grant = Grant.objects.get(user_id=data["user"]["id"])
    assert grant.expires_at is None
    original_refresh = client.cookies["refresh_token"].value
    old_access = data["access_token"]
    r = client.post("/api/v1/auth/refresh", {}, format="json")
    assert r.status_code == 200
    assert_schema("TokenResponse", r.json())
    new_refresh = client.cookies["refresh_token"].value
    assert new_refresh != original_refresh
    grant.refresh_from_db()
    assert grant.expires_at is None
    client.cookies["refresh_token"] = original_refresh
    assert client.post("/api/v1/auth/refresh", {}, format="json").status_code == 401
    client.cookies["refresh_token"] = new_refresh
    assert client.post("/api/v1/auth/logout", {}, format="json").status_code == 204
    assert client.cookies["refresh_token"]["max-age"] == 0
    client.cookies["refresh_token"] = new_refresh
    assert client.post("/api/v1/auth/refresh", {}, format="json").status_code == 401
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
