import uuid
from functools import wraps

from django.core import signing
from django.db.models import Q
from django.http import Http404
from django.utils import timezone
from rest_framework.authentication import SessionAuthentication
from rest_framework.decorators import api_view
from rest_framework.exceptions import ParseError, PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken

from dingdong_ca.core.models import AuditEvent, FamilyMembership, LoginGrant


class ApiError(Exception):
    def __init__(self, code, status=409, message=None, fields=None, headers=None):
        self.code, self.status = code, status
        self.message = message or code
        self.fields = fields or []
        self.headers = headers or {}


def authenticate_parent(request):
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise ApiError("AUTH_REQUIRED", 401, "请先登录")
    try:
        token = AccessToken(auth[7:])
        grant = LoginGrant.objects.select_related("user").get(
            id=token["grant_id"], user_id=token["user_id"]
        )
    except (TokenError, KeyError, ValueError, ValidationError, LoginGrant.DoesNotExist):
        raise ApiError("AUTH_REQUIRED", 401, "登录已失效") from None
    if (
        grant.revoked_at
        or grant.expires_at <= timezone.now()
        or not grant.user.is_active
        or grant.user.account_kind != "parent"
    ):
        raise ApiError("LOGIN_REVOKED", 401, "登录已撤销")
    request.user = grant.user
    request.login_grant = grant


# 运营后台把 account_admin 定义为"全部权限"（见 dingdong_ca/ops/permissions.py）。
# 这里复用的旧 staff 接口按具体角色放行，所以必须把 account_admin 视为满足任一角色；
# 否则管理员在运营后台看得到按钮，点下去却拿到"角色不允许此操作"。
STAFF_ADMIN_ROLE = "account_admin"


def family_for(user):
    row = (
        FamilyMembership.objects.select_related("family")
        .filter(user=user, ended_at__isnull=True, family__status="active")
        .first()
    )
    if not row:
        raise ApiError("PERMISSION_DENIED", 403, "家庭档案当前不可用")
    return row.family


def endpoint(methods, *, anonymous=False, csrf=False, parsers=None, staff_roles=None):
    def decorate(fn):
        @wraps(fn)
        def wrapped(request, *args, **kwargs):
            trace = str(uuid.uuid4())
            try:
                if csrf:
                    SessionAuthentication().enforce_csrf(request)
                if staff_roles is not None:
                    user = request.user
                    if (
                        not user.is_authenticated
                        or not user.is_active
                        or not user.is_staff
                        or user.account_kind != "staff"
                    ):
                        raise ApiError("PERMISSION_DENIED", 403, "需要工作人员登录")
                    if (
                        not user.is_superuser
                        and not user.groups.filter(
                            name__in=[*staff_roles, STAFF_ADMIN_ROLE]
                        ).exists()
                    ):
                        raise ApiError("PERMISSION_DENIED", 403, "角色不允许此操作")
                elif not anonymous:
                    authenticate_parent(request)
                response = fn(request, *args, **kwargs)
            except ApiError as exc:
                response = Response(
                    {
                        "code": exc.code,
                        "message": exc.message,
                        "field_errors": exc.fields,
                        "trace_id": trace,
                    },
                    status=exc.status,
                    headers=exc.headers,
                )
            except (ValidationError, ParseError) as exc:
                detail = exc.detail
                fields = (
                    [
                        {"field": str(k), "code": "invalid", "message": str(v)}
                        for k, v in detail.items()
                    ]
                    if isinstance(detail, dict)
                    else []
                )
                response = Response(
                    {
                        "code": "INVALID_JSON"
                        if isinstance(exc, ParseError)
                        else "VALIDATION_ERROR",
                        "message": "请求字段不合法",
                        "field_errors": fields,
                        "trace_id": trace,
                    },
                    status=400 if isinstance(exc, ParseError) else 422,
                )
            except PermissionDenied:
                response = Response(
                    {
                        "code": "PERMISSION_DENIED",
                        "message": "请求校验失败",
                        "field_errors": [],
                        "trace_id": trace,
                    },
                    status=403,
                )
            except Http404:
                response = Response(
                    {
                        "code": "NOT_FOUND",
                        "message": "记录不存在",
                        "field_errors": [],
                        "trace_id": trace,
                    },
                    status=404,
                )
            finally:
                for buffer in getattr(request._request, "_ca_upload_buffers", []):
                    buffer.close()
            response["X-Request-ID"] = trace
            response["Cache-Control"] = "no-store"
            return response

        if staff_roles is not None:
            wrapped.authentication_classes = [SessionAuthentication]
        if parsers is not None:
            wrapped.parser_classes = parsers
        return api_view(methods)(wrapped)

    return decorate


def validate(serializer, data, **kwargs):
    s = serializer(data=data, **kwargs)
    s.is_valid(raise_exception=True)
    return s.validated_data


def describe_target(obj):
    """给审计记录一个人能读懂的对象名称，避免只留下 UUID。"""
    for attr in ("title", "code", "username", "name"):
        value = getattr(obj, attr, None)
        if isinstance(value, str) and value.strip():
            version = getattr(obj, "version", None)
            return f"{value.strip()} · {version}" if version else value.strip()
    # 自己没有名字的对象（答卷、授权、关联等）：借用关联对象的名字
    for attr in ("child", "family", "user", "started_by", "actor"):
        related = getattr(obj, attr, None)
        if related is not None:
            name = getattr(related, "name", "") or getattr(related, "username", "")
            if name:
                return f"{obj._meta.verbose_name}（{name}）"
    # 最后的兜底也只给短编号：运营不需要看完整的内部 UUID。
    # 对象类型由页面按 target_kind 显示中文，这里不重复带英文模型名。
    return f"编号 {str(obj.pk)[:8]}"


def audit(user, action, obj, label="", detail=None):
    AuditEvent.objects.create(
        actor=user,
        action=action,
        target_kind=obj._meta.db_table,
        target_id=obj.pk,
        target_label=(label or describe_target(obj))[:200],
        detail=detail or {},
    )


def paginate(queryset, request, serialize, scope):
    try:
        size = int(request.query_params.get("page_size", "20"))
        if not 1 <= size <= 100:
            raise ValueError
    except ValueError:
        raise ApiError("VALIDATION_ERROR", 422, "page_size 必须在 1..100") from None
    cursor = request.query_params.get("cursor")
    if cursor:
        try:
            payload = signing.loads(cursor, salt="ca-pagination")
            if payload["scope"] != scope:
                raise ValueError
            queryset = queryset.filter(
                Q(created_at__gt=payload["at"]) | Q(created_at=payload["at"], id__gt=payload["id"])
            )
        except (signing.BadSignature, ValueError, KeyError):
            raise ApiError("VALIDATION_ERROR", 422, "分页游标无效") from None
    rows = list(queryset.order_by("created_at", "id")[: size + 1])
    more = len(rows) > size
    rows = rows[:size]
    next_cursor = None
    if more:
        last = rows[-1]
        next_cursor = signing.dumps(
            {"at": last.created_at.isoformat(), "id": str(last.pk), "scope": scope},
            salt="ca-pagination",
            compress=True,
        )
    return {"items": [serialize(r) for r in rows], "next_cursor": next_cursor}


def contract_exception_handler(exc, context):
    """Normalize DRF's pre-view errors (including parser and method errors)."""
    from rest_framework.views import exception_handler

    response = exception_handler(exc, context)
    if response is None:
        return None  # Unexpected programming errors remain visible to Django/test failures.
    trace = str(uuid.uuid4())
    codes = {
        400: "INVALID_JSON",
        401: "AUTH_REQUIRED",
        403: "PERMISSION_DENIED",
        404: "NOT_FOUND",
        405: "METHOD_NOT_ALLOWED",
        415: "UNSUPPORTED_MEDIA_TYPE",
        429: "RATE_LIMITED",
    }
    response.data = {
        "code": codes.get(response.status_code, "REQUEST_REJECTED"),
        "message": "请求被拒绝，请检查方法、格式和权限",
        "field_errors": [],
        "trace_id": trace,
    }
    response["X-Request-ID"] = trace
    response["Cache-Control"] = "no-store"
    return response
