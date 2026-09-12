from .base import *  # noqa: F403

APP_ENV = "test"
DEBUG = False
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
COOKIE_SECURE = False
CELERY_TASK_ALWAYS_EAGER = True

MIDDLEWARE = [m for m in MIDDLEWARE if m != "whitenoise.middleware.WhiteNoiseMiddleware"]  # noqa: F405
