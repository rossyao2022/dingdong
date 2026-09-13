import hashlib
import hmac
import uuid
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import connection, transaction
from django.middleware.csrf import get_token, rotate_token
from django.utils import timezone
from rest_framework.response import Response
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken

from dingdong_ca.core.models import Family, FamilyMembership, LoginGrant, SmsChallenge

from .common import ApiError, audit, endpoint, family_for, validate
from .inputs import LoginInput, SmsInput

COOKIE_PATH = "/api/v1/auth/"


def serialize_user(user):
    number = user.phone
    masked = (
        number[3:6] + "****" + number[-4:]
        if number.startswith("+86")
        else number[:3] + "****" + number[-4:]
    )
    return {"id": str(user.pk), "phone_masked": masked, "family_id": str(family_for(user).pk)}


def advisory(key):
    # Stable PostgreSQL lock; no new lock table and no Python process-local mutex.
    with connection.cursor() as cursor:
        cursor.execute("SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))", [key])


def digest(challenge_id, phone, code):
    return hmac.new(
        settings.SECRET_KEY.encode(),
        f"{challenge_id}:{phone}:login:{code}".encode(),
        hashlib.sha256,
    ).hexdigest()


def token_pair(grant):
    refresh = RefreshToken()
    refresh["user_id"] = str(grant.user_id)
    refresh["grant_id"] = str(grant.pk)
    refresh["jti"] = grant.current_refresh_jti.hex
    refresh["exp"] = int(grant.expires_at.timestamp())
    access = AccessToken()
    access["user_id"] = str(grant.user_id)
    access["grant_id"] = str(grant.pk)
    access["exp"] = int(min(timezone.now() + timedelta(minutes=10), grant.expires_at).timestamp())
    return str(access), str(refresh)


def signed_response(grant, *, user=False):
    access, refresh = token_pair(grant)
    data = {
        "access_token": access,
        "token_type": "Bearer",
        "expires_in": min(600, max(1, int((grant.expires_at - timezone.now()).total_seconds()))),
    }
    if user:
        data["user"] = serialize_user(grant.user)
    response = Response(data)
    response.set_cookie(
        "refresh_token",
        refresh,
        max_age=max(0, int((grant.expires_at - timezone.now()).total_seconds())),
        path=COOKIE_PATH,
        secure=settings.COOKIE_SECURE,
        httponly=True,
        samesite="Lax",
    )
    return response


@endpoint(["GET"], anonymous=True)
def runtime(request):
    return Response(
        {
            "environment": settings.APP_ENV,
            "sms_mode": settings.SMS_MODE,
            "data_source": settings.INTEGRATION_DATA_SOURCE,
            "fixture_dataset": None,
        }
    )


@endpoint(["GET"], anonymous=True)
def csrf(request):
    return Response({"csrf_token": get_token(request)})


@endpoint(["POST"], anonymous=True, csrf=True)
def sms(request):
    data = validate(SmsInput, request.data)
    if settings.SMS_MODE != "fixed_code":
        raise ApiError("INTEGRATION_NOT_READY", 503, "短信供应商尚未接入")
    phone = data["phone"]
    ip = request.META.get("REMOTE_ADDR", "127.0.0.1")
    now = timezone.now()
    with transaction.atomic():
        advisory("sms-phone:" + phone)
        advisory("sms-ip:" + ip)
        latest = SmsChallenge.objects.filter(phone=phone).order_by("-created_at").first()
        if latest and (now - latest.created_at).total_seconds() < 60:
            seconds = max(1, 60 - int((now - latest.created_at).total_seconds()))
            raise ApiError(
                "RATE_LIMITED", 429, "请稍后再次获取验证码", headers={"Retry-After": str(seconds)}
            )
        since = now - timedelta(hours=1)
        if (
            SmsChallenge.objects.filter(phone=phone, created_at__gt=since).count() >= 10
            or SmsChallenge.objects.filter(client_ip=ip, created_at__gt=since).count() >= 50
        ):
            raise ApiError("RATE_LIMITED", 429, "验证码请求过多", headers={"Retry-After": "3600"})
        SmsChallenge.objects.filter(phone=phone, status="sent").update(
            status="expired", code_digest=None
        )
        ident = uuid.uuid4()
        row = SmsChallenge.objects.create(
            id=ident,
            phone=phone,
            client_ip=ip,
            expires_at=now + timedelta(minutes=5),
            code_digest=digest(ident, phone, "00000"),
        )
    return Response({"challenge_id": str(row.pk), "expires_in": 300, "retry_after": 60})


@endpoint(["POST"], anonymous=True, csrf=True)
def login(request):
    data = validate(LoginInput, request.data)
    initial = SmsChallenge.objects.filter(pk=data["challenge_id"]).first()
    if not initial:
        raise ApiError("SMS_CODE_INVALID", 422, "验证码无效")
    error = None
    grant = None
    with transaction.atomic():
        advisory("sms-phone:" + initial.phone)
        row = SmsChallenge.objects.select_for_update().get(pk=initial.pk)
        now = timezone.now()
        if row.status != "sent":
            error = ApiError("SMS_CHALLENGE_USED", 422, "请重新获取验证码")
        elif row.expires_at <= now:
            row.status = "expired"
            row.code_digest = None
            row.save(update_fields=["status", "code_digest", "updated_at"])
            error = ApiError("SMS_CHALLENGE_EXPIRED", 422, "验证码已过期")
        elif not hmac.compare_digest(
            row.code_digest or "", digest(row.pk, row.phone, data["code"])
        ):
            row.failed_attempts += 1
            if row.failed_attempts >= 5:
                row.status = "locked"
                row.code_digest = None
            row.save(update_fields=["failed_attempts", "status", "code_digest", "updated_at"])
            error = ApiError("SMS_CODE_INVALID", 422, "验证码错误")
        else:
            User = get_user_model()
            user = User.objects.filter(account_kind="parent", phone=row.phone).first()
            if user is None:
                user = User(
                    username="parent-" + uuid.uuid4().hex, phone=row.phone, account_kind="parent"
                )
                user.set_unusable_password()
                user.save()
                family = Family.objects.create()
                FamilyMembership.objects.create(family=family, user=user)
            if not user.is_active:
                error = ApiError("LOGIN_REVOKED", 401, "账号已停用")
            else:
                family_for(user)
                row.status = "consumed"
                row.code_digest = None
                row.consumed_at = now
                row.save(update_fields=["status", "code_digest", "consumed_at", "updated_at"])
                grant = LoginGrant.objects.create(
                    user=user, current_refresh_jti=uuid.uuid4(), expires_at=now + timedelta(days=7)
                )
                audit(user, "auth.login", grant)
    # Persist failed-attempt counters before returning an error; never raise inside that transaction.
    if error:
        raise error
    rotate_token(request)
    return signed_response(grant, user=True)


def cookie_grant(request, lock=False):
    try:
        token = RefreshToken(request.COOKIES.get("refresh_token", ""))
        query = LoginGrant.objects.select_related("user")
        if lock:
            query = query.select_for_update(of=("self",))
        grant = query.get(pk=token["grant_id"], user_id=token["user_id"])
        if str(grant.current_refresh_jti) != str(uuid.UUID(token["jti"])):
            raise ValueError
        if (
            grant.revoked_at
            or grant.expires_at <= timezone.now()
            or not grant.user.is_active
            or grant.user.account_kind != "parent"
        ):
            raise ValueError
        return grant
    except (TokenError, ValueError, KeyError, LoginGrant.DoesNotExist):
        raise ApiError("LOGIN_REVOKED", 401, "请重新登录") from None


@endpoint(["POST"], anonymous=True, csrf=True)
def refresh(request):
    with transaction.atomic():
        grant = cookie_grant(request, lock=True)
        grant.current_refresh_jti = uuid.uuid4()
        grant.last_refreshed_at = timezone.now()
        grant.save(update_fields=["current_refresh_jti", "last_refreshed_at", "updated_at"])
        response = signed_response(grant)
    return response


@endpoint(["POST"], anonymous=True, csrf=True)
def logout(request):
    with transaction.atomic():
        try:
            grant = cookie_grant(request, lock=True)
        except ApiError:
            grant = None
        if grant:
            grant.revoked_at = timezone.now()
            grant.revoke_reason = "logout"
            grant.save(update_fields=["revoked_at", "revoke_reason", "updated_at"])
            audit(grant.user, "auth.logout", grant)
    response = Response(status=204)
    response.delete_cookie("refresh_token", path=COOKIE_PATH, samesite="Lax")
    return response


@endpoint(["GET"])
def me(request):
    return Response(serialize_user(request.user))
