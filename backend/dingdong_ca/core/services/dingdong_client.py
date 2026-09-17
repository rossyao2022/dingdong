"""DingDong Data Service 的调用客户端（出站）。

契约：8 个 `/api/v1/ca/*` 全部由**我方发起**，请求头带 `X-API-Key`，全链路
HTTPS，响应封套 `{code, message, request_id}`，业务码见 docx 表 13。

**这一层现在只覆盖传输与错误码映射**：base URL 与 `X-API-Key` 还没拿到
（澄清清单 D10 / D12），所以 `is_configured()` 为假时调用直接抛
`DingDongNotConfigured`——**绝不伪造成功**，也不接 fixture 冒充对方。
``request_id`` 放请求头是临时约定：文档只说"建议携带 `request_id`"，
没写位置，最终以 D5 的答复为准，所以不额外往 body 里塞字段
（对方若校验严格，多余字段会吃 40001）。
"""

import json
import logging
import urllib.error
import urllib.parse
import urllib.request

from django.conf import settings

logger = logging.getLogger(__name__)

# docx 表 13：业务码 -> (中文含义, 我方处置)。
# 处置取值：retry 延时重试 / stop 停止调用并告警 / empty 当作"暂无数据" /
# fatal 我方请求有问题（重试无用）/ conflict 业务冲突。
BUSINESS_CODES = {
    "0": ("成功", "ok"),
    "40001": ("请求参数错误", "fatal"),
    "40101": ("鉴权失败", "stop"),
    "40401": ("资源不存在", "empty"),
    "40901": ("绑定或状态冲突", "conflict"),
    "42901": ("请求过于频繁", "retry"),
    "50001": ("对方服务端错误", "retry"),
}
RETRY_CODE = "42901"
STOP_CODE = "40101"
EMPTY_CODE = "40401"


class DingDongError(Exception):
    """一次出站调用失败。``code`` 是业务码或传输层自造码。"""

    def __init__(self, code, message="", *, http_status=None, action=None):
        super().__init__(message or code)
        self.code = code
        self.message = message or code
        self.http_status = http_status
        self.action = action or BUSINESS_CODES.get(code, ("", "fatal"))[1]

    @property
    def retryable(self):
        return self.action == "retry"

    @property
    def means_empty(self):
        return self.action == "empty"


class DingDongNotConfigured(DingDongError):
    """缺 base URL 或 `X-API-Key`。调用方应据此显示"尚未接通"，而不是编造结果。"""

    def __init__(self):
        super().__init__("NOT_CONFIGURED", "尚未配置 DingDong base URL 或 X-API-Key", action="stop")


def is_configured():
    return bool(settings.DINGDONG_BASE_URL and settings.DINGDONG_API_KEY)


def _endpoint(path):
    base = settings.DINGDONG_BASE_URL.rstrip("/")
    parts = urllib.parse.urlsplit(base)
    if parts.scheme != "https":
        # 文档表 12 要求所有接口走 HTTPS；对方或我方配成明文就应当立刻失败，
        # 而不是把凭据和画像明文发出去。
        raise DingDongError("INSECURE_ENDPOINT", "接口必须使用 HTTPS", http_status=None)
    if not parts.netloc:
        raise DingDongError("INVALID_BASE_URL", "base URL 不合法")
    return base + path


def _open(request, timeout):
    """独立成函数，便于测试注入假传输层。"""
    return urllib.request.urlopen(request, timeout=timeout)  # noqa: S310 - 已强制 https


def call(method, path, *, payload=None, query=None, request_id=None):
    """发起一次出站调用；返回封套里的 ``data``（没有就返回整个封套）。

    失败一律抛 `DingDongError`，调用方按 ``action`` 决定重试、告警还是当空态。
    """
    if not is_configured():
        raise DingDongNotConfigured()
    url = _endpoint(path)
    if query:
        url = url + "?" + urllib.parse.urlencode(query)
    body = None
    headers = {
        "X-API-Key": settings.DINGDONG_API_KEY,
        "Accept": "application/json",
    }
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if request_id:
        # 绑定与复测回写要幂等；位置待 D5 确认，暂放请求头。
        headers["X-Request-Id"] = str(request_id)
    request = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with _open(request, settings.DINGDONG_TIMEOUT_SECONDS) as response:
            raw = response.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        raise DingDongError(
            "HTTP_" + str(exc.code), "对方返回 HTTP 错误", http_status=exc.code
        ) from None
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        raise DingDongError("TRANSPORT", "连接对方失败：%s" % exc) from None
    try:
        envelope = json.loads(raw)
    except ValueError:
        raise DingDongError("MALFORMED_BODY", "对方返回的不是 JSON") from None
    if not isinstance(envelope, dict) or "code" not in envelope:
        raise DingDongError("MALFORMED_BODY", "响应缺少 code 字段") from None
    code = str(envelope["code"])
    if code != "0":
        meaning, action = BUSINESS_CODES.get(code, ("未知业务码", "fatal"))
        if action == "stop":
            logger.error("DingDong 鉴权失败（%s），停止调用并检查密钥配置", code)
        raise DingDongError(code, envelope.get("message") or meaning, action=action)
    return envelope.get("data", envelope)


def retry_delay_seconds(attempt):
    """`42901` 的延时重试退避：1s、2s、4s……上限 60s。"""
    return min(60, 2 ** max(0, attempt - 1))
