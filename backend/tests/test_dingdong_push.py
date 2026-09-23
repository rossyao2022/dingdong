"""DingDong → CA Prototype webhook 接收端用例。

合同见 `材料/文档/DingDong_CA_Prototype_Demo_Logic_v1.0.docx` §7–§11：
HMAC-SHA256 验签（原始 body）、X-Dingdong-Event-ID 幂等、timestamp 时间窗、
成功 2xx。
"""

import hashlib
import hmac
import json
import time

import pytest
from django.test import override_settings
from rest_framework.test import APIClient  # noqa: F401 - 标注与 conftest 同源

from dingdong_ca.core.integration_models import DingDongPushEvent

pytestmark = pytest.mark.django_db

PUSH_SECRET = "dd-push-secret"
PUSH_URL = "/api/dingdong/prototype/events"
EVENT_TYPE = "dingdong.prototype.companion_milestone"


def _sign(secret, timestamp, raw):
    return (
        "sha256="
        + hmac.new(
            secret.encode("utf-8"), timestamp.encode("ascii") + b"." + raw, hashlib.sha256
        ).hexdigest()
    )


def _push(
    client,
    raw,
    *,
    secret=PUSH_SECRET,
    event_id="evt-001",
    timestamp=None,
    signature=None,
    event_type=EVENT_TYPE,
    with_headers=True,
):
    ts = str(timestamp if timestamp is not None else int(time.time()))
    headers = {}
    if with_headers:
        headers = {
            "HTTP_X_DINGDONG_SIGNATURE": signature
            if signature is not None
            else _sign(secret, ts, raw),
            "HTTP_X_DINGDONG_TIMESTAMP": ts,
            "HTTP_X_DINGDONG_EVENT_ID": event_id,
            "HTTP_X_DINGDONG_EVENT_TYPE": event_type,
        }
    return client.post(PUSH_URL, data=raw, content_type="application/json", **headers)


def _payload_bytes(event_id="evt-001"):
    """对方文档 §9 的 milestone payload 样例。"""
    return json.dumps(
        {
            "event_id": event_id,
            "event_type": EVENT_TYPE,
            "occurred_at": "2026-09-22T10:30:00+00:00",
            "milestone": {"interval": 3, "completed_turns": 3},
            "data": {
                "ca_account_id": "ca_dingdong",
                "mode": "prototype_mock",
                "companion": {"value": 3, "effective_turns": 3, "source": "web_chat"},
            },
        }
    ).encode("utf-8")


@override_settings(DINGDONG_PUSH_SECRET=PUSH_SECRET)
def test_valid_push_is_stored(client):
    raw = _payload_bytes()
    response = _push(client, raw)
    assert response.status_code == 201, response.content
    assert response.json()["code"] == 0
    row = DingDongPushEvent.objects.get(event_id="evt-001")
    assert row.event_type == EVENT_TYPE
    assert row.ca_account_id == "ca_dingdong"
    assert row.occurred_at == "2026-09-22T10:30:00+00:00"
    assert row.payload["data"]["companion"]["value"] == 3


@override_settings(DINGDONG_PUSH_SECRET=PUSH_SECRET)
def test_signature_uses_raw_body_not_reserialized(client):
    """验签必须按收到的原始字节：非紧凑 JSON + 中文值，parse 再 dumps 必验不过。"""
    raw = (
        '{ "event_id" : "evt-raw" ,  "note" : "中文内容含空格" ,\n'
        '  "data" : { "ca_account_id" : "ca_dingdong" } }'
    ).encode("utf-8")
    response = _push(client, raw, event_id="evt-raw")
    assert response.status_code == 201, response.content
    assert DingDongPushEvent.objects.filter(event_id="evt-raw").exists()


@override_settings(DINGDONG_PUSH_SECRET=PUSH_SECRET)
def test_duplicate_event_id_is_idempotent(client):
    raw = _payload_bytes()
    first = _push(client, raw)
    assert first.status_code == 201
    # 对方 outbox 补偿投递重发同一事件：仍回 2xx 止住重试，但不落第二条。
    second = _push(client, raw)
    assert second.status_code == 200
    assert second.json() == {"code": 0, "duplicate": True}
    assert DingDongPushEvent.objects.count() == 1


@override_settings(DINGDONG_PUSH_SECRET=PUSH_SECRET)
def test_wrong_signature_rejected(client):
    response = _push(client, _payload_bytes(), signature="sha256=" + "0" * 64)
    assert response.status_code == 403
    assert response.json()["code"] == "PUSH_SIGNATURE_INVALID"
    assert DingDongPushEvent.objects.count() == 0


@override_settings(DINGDONG_PUSH_SECRET=PUSH_SECRET)
def test_missing_headers_rejected(client):
    response = _push(client, _payload_bytes(), with_headers=False)
    assert response.status_code == 400
    assert response.json()["code"] == "PUSH_HEADERS_MISSING"
    assert DingDongPushEvent.objects.count() == 0


@override_settings(DINGDONG_PUSH_SECRET=PUSH_SECRET, DINGDONG_PUSH_TIMESTAMP_WINDOW_SECONDS=7200.0)
def test_stale_timestamp_rejected(client):
    stale = int(time.time()) - 7201
    response = _push(client, _payload_bytes(), timestamp=stale)
    assert response.status_code == 403
    assert response.json()["code"] == "PUSH_TIMESTAMP_STALE"
    assert DingDongPushEvent.objects.count() == 0


def test_secret_not_configured_rejected(client):
    response = _push(client, _payload_bytes())
    assert response.status_code == 403
    assert response.json()["code"] == "PUSH_NOT_CONFIGURED"
    assert DingDongPushEvent.objects.count() == 0


@override_settings(DINGDONG_PUSH_SECRET=PUSH_SECRET)
def test_invalid_json_rejected(client):
    response = _push(client, b"not-json{")
    assert response.status_code == 400
    assert response.json()["code"] == "INVALID_JSON"
    assert DingDongPushEvent.objects.count() == 0


@override_settings(DINGDONG_PUSH_SECRET=PUSH_SECRET)
def test_non_object_payload_rejected(client):
    response = _push(client, json.dumps([1, 2]).encode(), event_id="evt-arr")
    assert response.status_code == 400
    assert response.json()["code"] == "PUSH_PAYLOAD_INVALID"
    assert DingDongPushEvent.objects.count() == 0
