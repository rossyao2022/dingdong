"""一次性运营登录图形验证码；图片和答案均由服务端生成。"""

import hashlib
import hmac
import random
import secrets
import struct
import zlib

from django.conf import settings
from django.core.cache import cache
from django.http import HttpResponse
from django.utils import timezone
from django.views.decorators.http import require_GET

SESSION_KEY = "ops_captcha"
LIFETIME_SECONDS = 120
DIGITS = "23456789"
FONT = {
    "2": ("01110", "10001", "00001", "00010", "00100", "01000", "11111"),
    "3": ("11110", "00001", "00001", "01110", "00001", "00001", "11110"),
    "4": ("00010", "00110", "01010", "10010", "11111", "00010", "00010"),
    "5": ("11111", "10000", "10000", "11110", "00001", "00001", "11110"),
    "6": ("01111", "10000", "10000", "11110", "10001", "10001", "01110"),
    "7": ("11111", "00001", "00010", "00100", "01000", "01000", "01000"),
    "8": ("01110", "10001", "10001", "01110", "10001", "10001", "01110"),
    "9": ("01110", "10001", "10001", "01111", "00001", "00010", "11100"),
}
WIDTH, HEIGHT = 174, 52


def _signature(nonce, answer):
    return hmac.new(
        settings.SECRET_KEY.encode(), f"{nonce}:{answer}".encode(), hashlib.sha256
    ).hexdigest()


def issue(request):
    answer = "".join(secrets.choice(DIGITS) for _ in range(4))
    nonce = secrets.token_hex(12)
    request.session[SESSION_KEY] = {
        "nonce": nonce,
        "signature": _signature(nonce, answer),
        "issued_at": int(timezone.now().timestamp()),
    }
    return answer


def consume(request, answer):
    challenge = request.session.pop(SESSION_KEY, None)
    if not isinstance(challenge, dict) or not answer or len(answer) != 4:
        return False
    issued = challenge.get("issued_at")
    if (
        not isinstance(issued, int)
        or not 0 <= timezone.now().timestamp() - issued <= LIFETIME_SECONDS
    ):
        return False
    nonce = challenge.get("nonce", "")
    signature = challenge.get("signature", "")
    if not isinstance(nonce, str) or not isinstance(signature, str):
        return False
    if not cache.add(f"ops-captcha-used:{nonce}", 1, timeout=LIFETIME_SECONDS):
        return False
    return hmac.compare_digest(signature, _signature(nonce, answer))


def _chunk(kind, payload):
    body = kind + payload
    return struct.pack(">I", len(payload)) + body + struct.pack(">I", zlib.crc32(body))


def render_png(answer):
    """用标准库绘制小幅 RGB PNG，避免新增部署依赖。"""
    rng = random.Random(secrets.randbits(64))
    pixels = bytearray((244, 248, 251) * (WIDTH * HEIGHT))

    def dot(x, y, color):
        if 0 <= x < WIDTH and 0 <= y < HEIGHT:
            offset = (y * WIDTH + x) * 3
            pixels[offset : offset + 3] = bytes(color)

    for _ in range(170):
        dot(rng.randrange(WIDTH), rng.randrange(HEIGHT), (173, 201, 213))
    for index, digit in enumerate(answer):
        left = 10 + index * 41 + rng.randrange(3)
        top = 6 + rng.randrange(6)
        color = (25 + rng.randrange(20), 70 + rng.randrange(25), 95 + rng.randrange(25))
        for row, pattern in enumerate(FONT[digit]):
            for col, mark in enumerate(pattern):
                if mark == "1":
                    for dy in range(4):
                        for dx in range(4):
                            dot(left + col * 4 + dx, top + row * 4 + dy, color)
    raw = b"".join(b"\x00" + pixels[y * WIDTH * 3 : (y + 1) * WIDTH * 3] for y in range(HEIGHT))
    return (
        b"\x89PNG\r\n\x1a\n"
        + _chunk(b"IHDR", struct.pack(">IIBBBBB", WIDTH, HEIGHT, 8, 2, 0, 0, 0))
        + _chunk(b"IDAT", zlib.compress(raw, level=6))
        + _chunk(b"IEND", b"")
    )


@require_GET
def image(request):
    response = HttpResponse(render_png(issue(request)), content_type="image/png")
    response["Cache-Control"] = "no-store, no-cache, must-revalidate"
    response["Pragma"] = "no-cache"
    response["X-Content-Type-Options"] = "nosniff"
    return response
