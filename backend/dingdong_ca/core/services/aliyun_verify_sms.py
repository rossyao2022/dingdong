"""Aliyun phone verification SMS delivery; local challenges verify our own codes."""

import json
import logging
import re

from alibabacloud_dypnsapi20170525 import models as sms_models
from alibabacloud_dypnsapi20170525.client import Client as SmsClient
from alibabacloud_tea_openapi import models as open_api_models
from django.conf import settings

logger = logging.getLogger(__name__)


class SmsDeliveryError(Exception):
    def __init__(self, reason="unavailable", message="短信暂时无法发送，请稍后再试"):
        self.reason = reason
        self.message = message
        super().__init__(message)


def _safe_code(value):
    return (
        value
        if isinstance(value, str) and re.fullmatch(r"[A-Za-z0-9_.-]{1,64}", value)
        else "UNKNOWN"
    )


def send_verification_code(phone: str, code: str, *, out_id: str | None = None) -> None:
    """Send one code; return only after Aliyun accepts the request.

    Never log the request body, SDK exception message, full phone, or code.
    """
    key_id = settings.ALIYUN_VERIFY_ACCESS_KEY_ID.strip()
    key_secret = settings.ALIYUN_VERIFY_ACCESS_KEY_SECRET.strip()
    sign_name = settings.ALIYUN_VERIFY_SIGN_NAME.strip()
    template_code = settings.ALIYUN_VERIFY_TEMPLATE_CODE.strip()
    if not all((key_id, key_secret, sign_name, template_code)):
        logger.error("aliyun_verify_configuration_missing")
        raise SmsDeliveryError("not_configured")
    if not re.fullmatch(r"\+86(1\d{10})", phone):
        raise SmsDeliveryError("unsupported_phone", "目前仅支持中国大陆手机号")

    config = open_api_models.Config(
        access_key_id=key_id,
        access_key_secret=key_secret,
        endpoint=settings.ALIYUN_VERIFY_ENDPOINT,
        region_id=settings.ALIYUN_VERIFY_REGION,
        protocol="HTTPS",
        connect_timeout=3000,
        read_timeout=5000,
    )
    request = sms_models.SendSmsVerifyCodeRequest(
        country_code="86",
        phone_number=phone[3:],
        sign_name=sign_name,
        template_code=template_code,
        template_param=json.dumps({"code": code, "min": "5"}, separators=(",", ":")),
        valid_time=300,
        interval=60,
        duplicate_policy=1,
        code_length=5,
        code_type=1,
        return_verify_code=False,
        auto_retry=0,
        out_id=out_id,
    )
    try:
        response = SmsClient(config).send_sms_verify_code(request)
    except Exception as exc:
        # SDK exceptions can echo signed requests or template parameters.
        logger.warning("aliyun_verify_request_failed exception_type=%s", type(exc).__name__)
        raise SmsDeliveryError("network_or_auth") from None

    body = getattr(response, "body", None)
    provider_code = _safe_code(getattr(body, "code", None))
    if provider_code != "OK":
        logger.warning("aliyun_verify_rejected provider_code=%s", provider_code)
        if provider_code in {
            "BUSINESS_LIMIT_CONTROL",
            "FREQUENCY_FAIL",
            "isv.BUSINESS_LIMIT_CONTROL",
            "biz.FREQUENCY",
        }:
            raise SmsDeliveryError("rate_limited", "短信发送太频繁，请稍后再试")
        if provider_code in {"AMOUNT_NOT_ENOUGH", "isv.AMOUNT_NOT_ENOUGH"}:
            raise SmsDeliveryError("quota_exhausted")
        raise SmsDeliveryError("provider_rejected")

    logger.info("aliyun_verify_accepted phone_ending=%s", phone[-4:])
