"""跨进程运营登录密码尝试限制。"""

import hashlib
import hmac

from django.conf import settings
from django.core.cache import cache

WINDOW_SECONDS = 15 * 60
MAX_FAILURES = 10


def _key(username):
    normalized = (username or "").strip().casefold()
    digest = hmac.new(settings.SECRET_KEY.encode(), normalized.encode(), hashlib.sha256).hexdigest()
    return f"ops-login-fail:{digest}"


def is_limited(username):
    return int(cache.get(_key(username), 0)) >= MAX_FAILURES


def record_failure(username):
    key = _key(username)
    if cache.add(key, 1, timeout=WINDOW_SECONDS):
        return
    try:
        cache.incr(key)
    except ValueError:
        cache.add(key, 1, timeout=WINDOW_SECONDS)


def clear_failures(username):
    cache.delete(_key(username))
