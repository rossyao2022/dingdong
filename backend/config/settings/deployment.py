"""Public demo deployment; real integrations and production remain disabled."""
from urllib.parse import urlsplit

from .base import *

APP_ENV = "demo"
DEBUG = False
origin = env("PUBLIC_ORIGIN")
parsed = urlsplit(origin)
if (parsed.scheme not in {"http", "https"} or not parsed.hostname
        or parsed.path or parsed.query or parsed.fragment or parsed.username
        or parsed.password):
    raise ImproperlyConfigured("PUBLIC_ORIGIN must be an http(s) origin without a path")
for key in ("DJANGO_SECRET_KEY", "JWT_SIGNING_KEY"):
    if len(env(key, default="")) < 50 or env(key).startswith("local-"):
        raise ImproperlyConfigured(f"{key} must be a unique random secret of at least 50 characters")
if SECRET_KEY == JWT_SIGNING_KEY:
    raise ImproperlyConfigured("Django and JWT keys must be different")
ALLOWED_HOSTS = [parsed.hostname]
CSRF_TRUSTED_ORIGINS = [origin]
COOKIE_SECURE = parsed.scheme == "https"
SESSION_COOKIE_SECURE = COOKIE_SECURE
CSRF_COOKIE_SECURE = COOKIE_SECURE
# Only nginx is published; nginx overwrites this header using PUBLIC_ORIGIN.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_CONTENT_TYPE_NOSNIFF = True
