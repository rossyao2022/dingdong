"""Real SMS mode keeps the existing one-use login contract without sending in tests."""

from unittest.mock import patch

import pytest
from conftest import csrf
from django.apps import apps
from django.test import override_settings

pytestmark = pytest.mark.django_db
SMS_URL = "/api/v1/auth/sms"
LOGIN_URL = "/api/v1/auth/login"
PHONE = "+8613800000042"


@override_settings(SMS_MODE="aliyun_verify")
def test_real_sms_code_is_random_secret_and_one_use(client):
    csrf(client)
    with (
        patch("dingdong_ca.core.api.accounts.secrets.randbelow", return_value=12344),
        patch("dingdong_ca.core.api.accounts.send_verification_code") as send,
    ):
        response = client.post(SMS_URL, {"phone": PHONE}, format="json")
    assert response.status_code == 200
    payload = response.json()
    send.assert_called_once_with(PHONE, "12345", out_id=payload["challenge_id"])
    assert "12345" not in str(payload)
    challenge = apps.get_model("core", "SmsChallenge").objects.get(pk=payload["challenge_id"])
    assert challenge.status == "sent"
    assert challenge.code_digest and "12345" not in challenge.code_digest
    assert (
        client.post(
            LOGIN_URL, {"challenge_id": str(challenge.pk), "code": "00000"}, format="json"
        ).status_code
        == 422
    )
    assert (
        client.post(
            LOGIN_URL, {"challenge_id": str(challenge.pk), "code": "12345"}, format="json"
        ).status_code
        == 200
    )
    csrf(client)  # Successful login rotates the CSRF token.
    assert (
        client.post(
            LOGIN_URL, {"challenge_id": str(challenge.pk), "code": "12345"}, format="json"
        ).status_code
        == 422
    )


@override_settings(SMS_MODE="aliyun_verify")
def test_send_failure_never_issues_a_usable_challenge_or_falls_back(client):
    from dingdong_ca.core.services.aliyun_verify_sms import SmsDeliveryError

    csrf(client)
    with (
        patch("dingdong_ca.core.api.accounts.secrets.randbelow", return_value=23456),
        patch(
            "dingdong_ca.core.api.accounts.send_verification_code",
            side_effect=SmsDeliveryError("unavailable"),
        ),
    ):
        response = client.post(SMS_URL, {"phone": PHONE}, format="json")
    assert response.status_code == 503
    assert response.json()["code"] == "SMS_UNAVAILABLE"
    assert "challenge_id" not in response.json()
    challenge = apps.get_model("core", "SmsChallenge").objects.get(phone=PHONE)
    assert challenge.status == "failed"
    assert challenge.code_digest is None


@override_settings(SMS_MODE="aliyun_verify")
def test_real_mode_rejects_non_mainland_phone_before_provider(client):
    csrf(client)
    with patch("dingdong_ca.core.api.accounts.send_verification_code") as send:
        response = client.post(SMS_URL, {"phone": "+12025550123"}, format="json")
    assert response.status_code == 422
    send.assert_not_called()
    assert apps.get_model("core", "SmsChallenge").objects.count() == 0


@override_settings(SMS_MODE="aliyun_verify")
def test_real_mode_respects_cooldown_without_second_provider_call(client):
    csrf(client)
    with patch("dingdong_ca.core.api.accounts.send_verification_code") as send:
        first = client.post(SMS_URL, {"phone": PHONE}, format="json")
        second = client.post(SMS_URL, {"phone": PHONE}, format="json")
    assert first.status_code == 200
    assert second.status_code == 429
    send.assert_called_once()


@override_settings(SMS_MODE="unknown")
def test_unknown_sms_mode_fails_closed(client):
    csrf(client)
    response = client.post(SMS_URL, {"phone": PHONE}, format="json")
    assert response.status_code == 503
    assert apps.get_model("core", "SmsChallenge").objects.count() == 0


def test_switch_to_real_mode_rejects_existing_fixed_code_challenge(client):
    csrf(client)
    with override_settings(SMS_MODE="fixed_code"):
        challenge = client.post(SMS_URL, {"phone": PHONE}, format="json").json()
    with override_settings(SMS_MODE="aliyun_verify"):
        response = client.post(
            LOGIN_URL,
            {"challenge_id": challenge["challenge_id"], "code": "00000"},
            format="json",
        )
    assert response.status_code == 422
    assert response.json()["code"] == "SMS_CODE_INVALID"
