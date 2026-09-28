"""The provider seam must send the right template and conceal credentials and codes."""

import json
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from django.test import override_settings

from dingdong_ca.core.services.aliyun_verify_sms import SmsDeliveryError, send_verification_code

PROVIDER_SETTINGS = {
    "ALIYUN_VERIFY_ACCESS_KEY_ID": "test-dingdong-key-id",
    "ALIYUN_VERIFY_ACCESS_KEY_SECRET": "test-dingdong-secret",
    "ALIYUN_VERIFY_SIGN_NAME": "恒创联众",
    "ALIYUN_VERIFY_TEMPLATE_CODE": "100001",
    "ALIYUN_VERIFY_ENDPOINT": "dypnsapi.aliyuncs.com",
}


@override_settings(**PROVIDER_SETTINGS)
def test_provider_uses_dingdong_credentials_and_code_template(caplog):
    with patch("dingdong_ca.core.services.aliyun_verify_sms.SmsClient") as client_class:
        client_class.return_value.send_sms_verify_code.return_value = SimpleNamespace(
            body=SimpleNamespace(code="OK")
        )
        send_verification_code("+8613800000042", "12345", out_id="challenge-1")
    config = client_class.call_args.args[0]
    assert config.access_key_id == PROVIDER_SETTINGS["ALIYUN_VERIFY_ACCESS_KEY_ID"]
    assert config.access_key_secret == PROVIDER_SETTINGS["ALIYUN_VERIFY_ACCESS_KEY_SECRET"]
    assert config.endpoint == "dypnsapi.aliyuncs.com"
    request = client_class.return_value.send_sms_verify_code.call_args.args[0]
    assert request.country_code == "86"
    assert request.phone_number == "13800000042"
    assert request.template_code == "100001"
    assert request.sign_name == "恒创联众"
    assert json.loads(request.template_param) == {"code": "12345", "min": "5"}
    assert request.out_id == "challenge-1"
    assert request.return_verify_code is False
    assert "12345" not in caplog.text
    assert "test-dingdong-secret" not in caplog.text


@override_settings(**{**PROVIDER_SETTINGS, "ALIYUN_VERIFY_ACCESS_KEY_ID": ""})
def test_missing_credentials_rejects_without_sdk_call():
    with patch("dingdong_ca.core.services.aliyun_verify_sms.SmsClient") as client_class:
        with pytest.raises(SmsDeliveryError) as error:
            send_verification_code("+8613800000042", "12345")
    assert error.value.reason == "not_configured"
    client_class.assert_not_called()


@override_settings(**PROVIDER_SETTINGS)
def test_sdk_exception_and_rejection_do_not_leak_code_or_key(caplog):
    with patch("dingdong_ca.core.services.aliyun_verify_sms.SmsClient") as client_class:
        client_class.return_value.send_sms_verify_code.side_effect = RuntimeError(
            "request secret=test-dingdong-secret code=12345"
        )
        with pytest.raises(SmsDeliveryError):
            send_verification_code("+8613800000042", "12345")
    assert "12345" not in caplog.text
    assert "test-dingdong-secret" not in caplog.text

    with patch("dingdong_ca.core.services.aliyun_verify_sms.SmsClient") as client_class:
        client_class.return_value.send_sms_verify_code.return_value = SimpleNamespace(
            body=SimpleNamespace(code="AMOUNT_NOT_ENOUGH", message="code=12345")
        )
        with pytest.raises(SmsDeliveryError) as error:
            send_verification_code("+8613800000042", "12345")
    assert error.value.reason == "quota_exhausted"
    assert "12345" not in caplog.text


@override_settings(**PROVIDER_SETTINGS)
def test_provider_biz_frequency_is_a_rate_limit(caplog):
    with patch("dingdong_ca.core.services.aliyun_verify_sms.SmsClient") as client_class:
        client_class.return_value.send_sms_verify_code.return_value = SimpleNamespace(
            body=SimpleNamespace(code="biz.FREQUENCY")
        )
        with pytest.raises(SmsDeliveryError) as error:
            send_verification_code("+8613800000042", "12345")
    assert error.value.reason == "rate_limited"
    assert error.value.message == "短信发送太频繁，请稍后再试"
    assert "12345" not in caplog.text
