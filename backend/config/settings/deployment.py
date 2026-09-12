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
# Only nginx is published; nginx overwrites this header using PUBLIC_ORIGIN.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_CONTENT_TYPE_NOSNIFF = True
