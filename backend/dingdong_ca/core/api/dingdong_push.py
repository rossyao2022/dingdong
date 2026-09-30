"""DingDong → CA 的 Prototype webhook 接收端。

对方在互动里程碑（每 3 次有效对话）时主动 POST 完整 Prototype Insights，
合同见 `材料/文档/DingDong_CA_Prototype_Demo_Logic_v1.0.docx` §7–§9。四要件：

1. **HMAC-SHA256 验签**：``HMAC_SHA256(DINGDONG_PUSH_SECRET,
   X-Dingdong-Timestamp + "." + 原始 body)`` 与
   ``X-Dingdong-Signature: sha256=<hex>`` 比对。必须用收到的**原始 body**，
   不能 parse 后再序列化——字节不一致就验不过（对方文档 §8 明确要求）。
2. **幂等**：同一 ``X-Dingdong-Event-ID`` 只处理一次；重复到达仍回 2xx，
   让对方的 outbox 补偿投递停止，但不再落第二条（文档 §8 要求按 event_id 去重）。
3. **时间窗**：``X-Dingdong-Timestamp`` 距当前超过窗口即拒绝。窗口默认
   2 小时，覆盖对方 outbox 补偿投递最长约 1 小时的退避（对方文档 §7），
   避免合法重试被误拒。
4. **成功 2xx**：非 2xx 会触发对方重试（对方文档 §11）。
"""

import hashlib
import hmac
import json
import time

from django.conf import settings
from django.db import IntegrityError, transaction
from rest_framework.response import Response

from dingdong_ca.core.integration_models import DingDongPushEvent
from dingdong_ca.core.services.prototype_reports import event_log, process_event, push_log

from .common import ApiError, endpoint


def _verify_signature(secret, timestamp, raw_body, provided):
    expected = hmac.new(
        secret.encode("utf-8"), timestamp.encode("ascii") + b"." + raw_body, hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest("sha256=" + expected, provided or ""):
        raise ApiError("PUSH_SIGNATURE_INVALID", 403, "推送签名不匹配")


def _extract(payload, key, max_length):
    """从 payload 提取冗余列的值，解析不到就留空，不以提取成败定接收成败。"""
    value = payload.get(key)
    return str(value)[:max_length] if value is not None else ""


@endpoint(["POST"], anonymous=True)
def prototype_events(request):
    try:
        return receive_event(request)
    except ApiError as exc:
        push_log(request.headers.get("X-Dingdong-Event-ID", ""), "rejected", exc.code)
        raise


def receive_event(request):
    secret = settings.DINGDONG_PUSH_SECRET
    if not secret:
        # 双方还没约定 CA_PUSH_SECRET：如实拒绝，不伪造通过。
        raise ApiError("PUSH_NOT_CONFIGURED", 403, "推送密钥未配置")
    signature = request.headers.get("X-Dingdong-Signature")
    timestamp = request.headers.get("X-Dingdong-Timestamp")
    event_id = request.headers.get("X-Dingdong-Event-ID")
    if not (signature and timestamp and event_id):
        raise ApiError("PUSH_HEADERS_MISSING", 400, "缺少推送请求头")
    if not timestamp.isascii() or not timestamp.isdecimal() or len(timestamp) > 20:
        raise ApiError("PUSH_TIMESTAMP_INVALID", 400, "时间戳不合法")
    try:
        ts = int(timestamp)
    except ValueError:
        raise ApiError("PUSH_TIMESTAMP_INVALID", 400, "时间戳不合法") from None
    if abs(time.time() - ts) > settings.DINGDONG_PUSH_TIMESTAMP_WINDOW_SECONDS:
        raise ApiError("PUSH_TIMESTAMP_STALE", 403, "推送时间戳超出允许窗口")
    # 注意：取原始 body 必须在访问 request.data 之前（视图内不读 request.data），
    # 否则流被 DRF parser 消费后原始字节不可得，验签必败。
    raw_body = request.body
    _verify_signature(secret, timestamp, raw_body, signature)
    try:
        payload = json.loads(raw_body.decode("utf-8"), parse_constant=lambda value: value)
    except (UnicodeDecodeError, ValueError):
        raise ApiError("INVALID_JSON", 400, "请求体不是合法 JSON") from None
    if not isinstance(payload, dict):
        raise ApiError("PUSH_PAYLOAD_INVALID", 400, "请求体必须是 JSON 对象")
    data = payload.get("data")
    data = data if isinstance(data, dict) else {}
    event_type = request.headers.get("X-Dingdong-Event-Type") or payload.get("event_type") or ""
    if len(event_id) > 64:
        raise ApiError("PUSH_HEADERS_INVALID", 400, "事件标识过长")
    try:
        # savepoint 隔离：唯一键冲突只回滚到 savepoint，不弄坏外层事务。
        with transaction.atomic():
            event = DingDongPushEvent.objects.create(
                event_id=event_id[:64],
                event_type=str(event_type)[:64],
                ca_account_id=_extract(data, "ca_account_id", 64),
                occurred_at=_extract(payload, "occurred_at", 64),
                payload=payload,
            )
    except IntegrityError:
        # 同一 event_id 因对方网络重试再次到达：幂等回 2xx 止住补偿投递。
        event = DingDongPushEvent.objects.get(event_id=event_id)
        if event.processing_status == "received":
            process_event(event.pk)
        event_log(event, "duplicate")
        return Response({"code": 0, "duplicate": True}, status=200)
    process_event(event.pk)
    return Response({"code": 0, "duplicate": False}, status=201)
