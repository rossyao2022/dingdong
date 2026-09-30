"""运营登录验证码与密码尝试限制。"""

import pytest
from django.core.cache import cache
from django.test import Client
from django.urls import reverse
from ops_helpers import PASSWORD, issue_ops_captcha, make_staff

pytestmark = pytest.mark.django_db


def image(client, code="2345"):
    response = issue_ops_captcha(client, code)
    assert response["Content-Type"] == "image/png"
    assert response.content.startswith(b"\x89PNG\r\n\x1a\n")
    assert "no-store" in response["Cache-Control"]
    challenge = client.session["ops_captcha"]
    assert set(challenge) == {"nonce", "signature", "issued_at"}
    assert all(value != code for value in challenge.values())
    assert len(challenge["signature"]) == 64


def post(client, user, code="2345", password=PASSWORD):
    return client.post(
        reverse("ops:login"),
        {"username": user.username, "password": password, "captcha": code},
    )


def test_captcha_required_and_correct_code_allows_staff_login():
    user = make_staff("operations")
    client = Client()
    denied = post(client, user)
    assert denied.status_code == 200
    assert "验证码" in denied.content.decode()
    image(client)
    accepted = post(client, user)
    assert accepted.status_code == 302
    assert accepted["Location"] == reverse("ops:dashboard")


def test_wrong_expired_and_replayed_captcha_are_rejected():
    user = make_staff("operations")
    client = Client()
    image(client)
    assert post(client, user, code="9999").status_code == 200
    assert post(client, user).status_code == 200  # 错误尝试已消费验证码
    image(client)
    session = client.session
    session["ops_captcha"]["issued_at"] -= 121
    session.save()
    assert post(client, user).status_code == 200
    image(client)
    used_challenge = client.session["ops_captcha"].copy()
    assert post(client, user).status_code == 302
    client.post(reverse("ops:logout"))
    session = client.session
    session["ops_captcha"] = used_challenge
    session.save()
    assert post(client, user).status_code == 200  # 即使旧会话值被重放，也不能复用


def test_password_failures_are_limited_after_valid_captcha():
    cache.clear()
    user = make_staff("operations")
    client = Client()
    for _ in range(10):
        image(client)
        assert "账号或密码不正确" in post(client, user, password="wrong").content.decode()
    image(client)
    incomplete = client.post(reverse("ops:login"), {"username": user.username, "captcha": "2345"})
    assert incomplete.status_code == 200
    image(client)
    blocked = post(client, user)
    assert blocked.status_code == 200
    assert "尝试过多" in blocked.content.decode()
    assert not client.session.get("_auth_user_id")
