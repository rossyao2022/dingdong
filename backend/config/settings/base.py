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

# --- CA × DingDong 对接（见 设计/CA对接_C1_ca_account_id设计_20260916.md） ---
# 对外暴露的 CA 账户号前缀。号码形态一经对外发布即冻结，改前缀等于换契约。
CA_ACCOUNT_ID_PREFIX = env("CA_ACCOUNT_ID_PREFIX", default="ca_")
# NFC token 只存 HMAC 摘要，明文不落库。未显式配置时由 SECRET_KEY 派生——
# 够用但换 SECRET_KEY 会让既有摘要失配（家长需重新绑定一次），生产请显式设。
NFC_TOKEN_HMAC_KEY = env("NFC_TOKEN_HMAC_KEY", default="") or (SECRET_KEY + ":ca-nfc-token")
# DingDong Data Service。两者留空时客户端显式报"未配置"，不伪造成功。
DINGDONG_BASE_URL = env("DINGDONG_BASE_URL", default="")
DINGDONG_API_KEY = env("DINGDONG_API_KEY", default="")
DINGDONG_TIMEOUT_SECONDS = env.float("DINGDONG_TIMEOUT_SECONDS", default=5.0)
# 四个展示面（人设 / 周期成长报告 / 健康度 / 复测）的数据源，见
# `.trellis/tasks/T-021/design.md` §2。与 INTEGRATION_DATA_SOURCE 分开：
# 那个管测评与观察的 fixture 闸门，语义不同，不共用值域。
# synthetic_fixture 读 test_fixture 表且零出站；dingdong 调对方，未配置时
# 返回 not_synced + upstream_not_configured，不伪造成功。
CA_DISPLAY_DATA_SOURCE = env("CA_DISPLAY_DATA_SOURCE", default="synthetic_fixture")

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
    "dingdong_ca.ops",
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
                # 运营后台静态资源的版本号，用于击穿静态文件缓存。
                "dingdong_ca.ops.context.ops_assets",
            ]
        },
    }
]
AUTH_USER_MODEL = "users.User"
LOGIN_URL = "/ops/login/"
LOGIN_REDIRECT_URL = "/ops/"
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
