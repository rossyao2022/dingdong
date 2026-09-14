"""Public demo deployment; real integrations and production remain disabled."""

from urllib.parse import urlsplit

from .base import *

APP_ENV = "demo"
DEBUG = False
origin = env("PUBLIC_ORIGIN")
parsed = urlsplit(origin)
if (
    parsed.scheme not in {"http", "https"}
    or not parsed.hostname
    or parsed.path
    or parsed.query
    or parsed.fragment
    or parsed.username
    or parsed.password
):
    raise ImproperlyConfigured("PUBLIC_ORIGIN must be an http(s) origin without a path")
for key in ("DJANGO_SECRET_KEY", "JWT_SIGNING_KEY"):
    if len(env(key, default="")) < 50 or env(key).startswith("local-"):
        raise ImproperlyConfigured(
            f"{key} must be a unique random secret of at least 50 characters"
        )
if SECRET_KEY == JWT_SIGNING_KEY:
    raise ImproperlyConfigured("Django and JWT keys must be different")
origins = [origin] + [
    value.strip() for value in env("ADDITIONAL_ORIGINS", default="").split(",") if value.strip()
]
for value in origins[1:]:
    extra = urlsplit(value)
    if (
        extra.scheme != parsed.scheme
        or not extra.hostname
        or extra.hostname == "*"
        or extra.path
        or extra.query
        or extra.fragment
        or extra.username
        or extra.password
    ):
        raise ImproperlyConfigured(
            "ADDITIONAL_ORIGINS must contain origins using the PUBLIC_ORIGIN scheme without paths"
        )
ALLOWED_HOSTS = list(dict.fromkeys(urlsplit(value).hostname for value in origins))
CSRF_TRUSTED_ORIGINS = list(dict.fromkeys(origins))
COOKIE_SECURE = parsed.scheme == "https"
SESSION_COOKIE_SECURE = COOKIE_SECURE
CSRF_COOKIE_SECURE = COOKIE_SECURE
# Django 默认发 `Cross-Origin-Opener-Policy: same-origin`，SecurityMiddleware 不看协议。
# 但 Chrome 只在"可信源"（https 或 localhost）上认可这个响应头：在明文 HTTP 入口上它会
# 被忽略，并在**每一个页面的控制台打一条错误**，把真正的错误淹掉。所以和上面的
# COOKIE_SECURE 一样按 scheme 决定——纯 HTTP 入口不发，将来切到 https 自动恢复。
SECURE_CROSS_ORIGIN_OPENER_POLICY = "same-origin" if parsed.scheme == "https" else None
# Only nginx is published; nginx overwrites this header using PUBLIC_ORIGIN.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_CONTENT_TYPE_NOSNIFF = True
