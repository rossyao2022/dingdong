"""Trimmed Cookiecutter Django settings: API + Admin, no public email/password signup."""

from pathlib import Path

import environ
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parents[2]
env = environ.Env()
environ.Env.read_env(BASE_DIR / ".env")
APP_ENV = env("APP_ENV", default="development")
DEBUG = APP_ENV == "development"
SECRET_KEY = env(
    "DJANGO_SECRET_KEY", default="local-development-only-change-before-deployment-1234567890"
)
JWT_SIGNING_KEY = env(
    "JWT_SIGNING_KEY", default="local-jwt-key-different-from-django-key-12345678901234567890"
)
SMS_MODE = env("SMS_MODE", default="fixed_code")
INTEGRATION_DATA_SOURCE = env("INTEGRATION_DATA_SOURCE", default="database_fixture")
COOKIE_SECURE = env.bool("COOKIE_SECURE", default=APP_ENV == "production")
if APP_ENV == "production":
    raise ImproperlyConfigured(
        "Production is not enabled during fixture-backed development; real SMS/integrations remain unimplemented."
    )
ALLOWED_HOSTS = ["localhost", "127.0.0.1", "testserver"]
DATABASES = {
    "default": env.db(
        "DATABASE_URL", default="postgres://dingdong:local-dingdong-only@127.0.0.1:55439/dingdong"
    )
}
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "dingdong_ca.users",
    "dingdong_ca.core",
    "dingdong_ca.testsupport",
]
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
]
ROOT_URLCONF = "config.urls"
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "dingdong_ca" / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ]
        },
    }
]
AUTH_USER_MODEL = "users.User"
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
]
TIME_ZONE = "Asia/Shanghai"
USE_TZ = True
LANGUAGE_CODE = "zh-hans"
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_DIRS = [BASE_DIR / "dingdong_ca" / "static"]
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
APPEND_SLASH = False
SESSION_COOKIE_SECURE = COOKIE_SECURE
CSRF_COOKIE_SECURE = COOKIE_SECURE
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [],
    "DEFAULT_PERMISSION_CLASSES": [],
    "DEFAULT_PARSER_CLASSES": ["rest_framework.parsers.JSONParser"],
    "EXCEPTION_HANDLER": "dingdong_ca.core.api.common.contract_exception_handler",
}
DATA_UPLOAD_MAX_MEMORY_SIZE = 65536
SIMPLE_JWT = {
    "SIGNING_KEY": JWT_SIGNING_KEY,
    "ALGORITHM": "HS256",
    "ISSUER": "dingdong-ca",
    "AUDIENCE": "dingdong-web",
}
CELERY_BROKER_URL = env("CELERY_BROKER_URL", default="redis://127.0.0.1:56379/0")
CELERY_TASK_SERIALIZER = "json"
CELERY_ACCEPT_CONTENT = ["json"]
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": "WARNING"},
}

# Never include vendor data, file payloads or task results in the broker/result backend.
CELERY_TASK_IGNORE_RESULT = True
CELERY_TASK_PUBLISH_RETRY = False
CELERY_BROKER_CONNECTION_TIMEOUT = 1
CELERY_BROKER_TRANSPORT_OPTIONS = {"socket_connect_timeout": 1, "socket_timeout": 1}
CELERY_TASK_DEFAULT_QUEUE = "dingdong-ca"
CELERY_BEAT_SCHEDULE = {
    "dispatch-pending-reports": {
        "task": "dingdong_ca.core.tasks.dispatch_pending",
        "schedule": 10.0,
    },
    "recover-expired-assessments": {
        "task": "dingdong_ca.core.tasks.recover_assessments",
        "schedule": 30.0,
    },
}

CELERY_BEAT_SCHEDULE["schedule-sync"] = {
    "task": "dingdong_ca.core.tasks.schedule_due_syncs",
    "schedule": 60.0,
}

# Local parent preview proxies API requests to this server.
CSRF_TRUSTED_ORIGINS = ["http://127.0.0.1:4173", "http://localhost:4173"]
