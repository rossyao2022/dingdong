"""运营后台的通用服务：分页、JSON 信封、审计、工作首页数据。

这里不重复业务规则：内容校验、任务重试、事项处理仍然调用 core 里
已经过测试的实现，运营后台只负责"用运营看得懂的方式呈现和触发"。
"""

import uuid
from urllib.parse import urlencode

from django.core.paginator import EmptyPage, Paginator
from django.db.models import Q
from django.http import JsonResponse
from django.utils import timezone

from dingdong_ca.core.models import AuditEvent

PAGE_SIZE = 20


# --------------------------------------------------------------------------- 分页


def paginate(request, queryset, per_page=PAGE_SIZE):
    try:
        number = int(request.GET.get("page", "1"))
        if number < 1:
            raise ValueError
    except TypeError, ValueError:
        number = 1
    paginator = Paginator(queryset, per_page)
    try:
        return paginator.page(number)
    except EmptyPage:
        return paginator.page(max(paginator.num_pages, 1))


def query_string(request, **changes):
    """保留当前筛选条件，只替换指定参数，并去掉 page。"""
    params = request.GET.copy()
    params.pop("page", None)
    for key, value in changes.items():
        if value is None or value == "":
            params.pop(key, None)
        else:
            params[key] = value
    encoded = params.urlencode()
    return ("?" + encoded) if encoded else ""


def page_links(request, page_obj):
    base = query_string(request)
    return {
        "page": page_obj.number,
        "pages": page_obj.paginator.num_pages,
        "total": page_obj.paginator.count,
        "has_previous": page_obj.has_previous(),
        "has_next": page_obj.has_next(),
        "base": base,
        "previous_url": query_string(request, page=page_obj.previous_page_number())
        if page_obj.has_previous()
        else None,
        "next_url": query_string(request, page=page_obj.next_page_number())
        if page_obj.has_next()
        else None,
        "first_url": query_string(request, page=1),
    }


def window(request, width=2):
    """给分页控件生成一段连续页码。"""
    page = request["page"] if isinstance(request, dict) else request.number
    pages = request["pages"] if isinstance(request, dict) else request.paginator.num_pages
    start = max(1, page - width)
    end = min(pages, page + width)
    return range(start, end + 1)


# --------------------------------------------------------------------------- JSON 信封


def json_ok(payload=None, status=200):
    body = {"ok": True, **(payload or {})}
    response = JsonResponse(body, status=status)
    response["Cache-Control"] = "no-store"
    return response


def json_error(code, message, status=400, fields=None, trace_id=None):
    body = {
        "ok": False,
        "code": code,
        "message": message,
        "field_errors": fields or [],
        "trace_id": trace_id or str(uuid.uuid4()),
    }
    response = JsonResponse(body, status=status)
    response["Cache-Control"] = "no-store"
    return response


class OpsError(Exception):
    """带业务语言的运营后台错误。"""

    def __init__(self, code, message, status=400, fields=None):
        self.code = code
        self.message = message
        self.status = status
        self.fields = fields or []


# --------------------------------------------------------------------------- 审计


def ops_audit(actor, action, target=None, label="", detail=None):
    """关键操作统一写审计。target 可以是任意带 pk / _meta 的对象。"""
    AuditEvent.objects.create(
        actor=actor,
        action=action,
        target_kind=(target._meta.db_table if target is not None else ""),
        target_id=(target.pk if target is not None else None),
        target_label=(label or "")[:200],
        detail=detail or {},
    )


def audit_feed(queryset, limit=20):
    return queryset.select_related("actor").order_by("-created_at")[:limit]


# --------------------------------------------------------------------------- 工作首页


def dashboard_data():
    """首页统计。每项都返回口径说明，避免"看起来像报表"的假数字。"""
    now = timezone.now()
    since = now - timezone.timedelta(days=7)
    from dingdong_ca.core.models import (
        ActivityRecord,
        AssessmentSession,
        BackgroundJob,
        Child,
        DataRequest,
        Family,
        QuestionnaireVersion,
        ReportVersion,
    )

    open_services = DataRequest.objects.filter(status__in=["open", "processing"])
    failed_jobs = BackgroundJob.objects.filter(status="failed")
    waiting_jobs = BackgroundJob.objects.filter(status="waiting")
    draft_questionnaires = QuestionnaireVersion.objects.filter(status="draft")

    metrics = [
        {
            "key": "families",
            "label": "家庭总数",
            "value": Family.objects.filter(status="active").count(),
            "scope": "口径：状态为“正常”的家庭记录数（含历史测试家庭）。",
        },
        {
            "key": "children",
            "label": "在册儿童",
            "value": Child.objects.filter(status="active").count(),
            "scope": "口径：状态为“正常”的儿童档案数，不含已归档。",
        },
        {
            "key": "new_children",
            "label": "近 7 天新增儿童",
            "value": Child.objects.filter(created_at__gte=since).count(),
            "scope": "口径：创建时间在过去 7 天内的儿童档案数。",
        },
        {
            "key": "new_sessions",
            "label": "近 7 天新增答卷",
            "value": AssessmentSession.objects.filter(created_at__gte=since).count(),
            "scope": "口径：创建时间在过去 7 天内的答卷数，含未提交草稿。",
        },
        {
            "key": "reports",
            "label": "近 7 天生成报告",
            "value": ReportVersion.objects.filter(generated_at__gte=since).count(),
            "scope": "口径：生成时间在过去 7 天内的报告份数。",
        },
        {
            "key": "activities",
            "label": "近 7 天活动记录",
            "value": ActivityRecord.objects.filter(created_at__gte=since).count(),
            "scope": "口径：创建时间在过去 7 天内的活动记录数，含进行中与已完成。",
        },
    ]

    return {
        "metrics": metrics,
        "counters": {
            "open_services": open_services.count(),
            "failed_jobs": failed_jobs.count(),
            "waiting_jobs": waiting_jobs.count(),
            "draft_questionnaires": draft_questionnaires.count(),
        },
        "open_service_items": list(
            open_services.select_related("child").order_by("created_at")[:5]
        ),
        "failed_job_items": [_job_row(j) for j in failed_jobs.order_by("-updated_at")[:5]],
        "waiting_job_items": [_job_row(j) for j in waiting_jobs.order_by("-updated_at")[:5]],
        "draft_questionnaire_items": list(draft_questionnaires.order_by("-updated_at")[:5]),
        "recent_audit": list(
            AuditEvent.objects.select_related("actor").order_by("-created_at")[:8]
        ),
    }


def _job_row(job):
    from .labels import job_error

    title, advice, retryable = job_error(job.error_code)
    return {"job": job, "reason": title, "advice": advice, "retryable": retryable}


# --------------------------------------------------------------------------- 家庭与儿童查询


def family_queryset(keyword):
    """按手机号、家长称呼、儿童称呼查询家庭。"""
    from dingdong_ca.core.models import Family

    rows = Family.objects.all()
    keyword = (keyword or "").strip()
    if keyword:
        rows = rows.filter(
            Q(
                familymembership__ended_at__isnull=True,
                familymembership__user__phone__icontains=keyword,
            )
            | Q(
                familymembership__ended_at__isnull=True,
                familymembership__user__name__icontains=keyword,
            )
            | Q(
                familymembership__ended_at__isnull=True,
                familymembership__user__username__icontains=keyword,
            )
            | Q(child__name__icontains=keyword)
        )
    return rows.distinct()


def family_summary(family):
    from dingdong_ca.core.models import Child, FamilyMembership

    member = (
        FamilyMembership.objects.select_related("user")
        .filter(family=family, ended_at__isnull=True)
        .first()
    )
    return {
        "family": family,
        "member": member,
        "children": list(Child.objects.filter(family=family).order_by("created_at")),
        "child_count": Child.objects.filter(family=family, status="active").count(),
    }


def child_bundle(child):
    """儿童详情需要的全部关联数据，一次取齐，避免运营逐页翻找。"""
    from dingdong_ca.core.models import (
        ActivityRecord,
        AssessmentSession,
        ConsentGrant,
        DataRequest,
        ExternalAssociation,
        ProfileSnapshot,
        ReportVersion,
        SyncCheckpoint,
    )

    sessions = list(
        AssessmentSession.objects.filter(child=child)
        .select_related("questionnaire_version")
        .order_by("-created_at")
    )
    profiles = list(ProfileSnapshot.objects.filter(child=child).order_by("-produced_at"))
    reports = list(
        ReportVersion.objects.filter(profile__child=child)
        .select_related("profile", "template_version")
        .order_by("-generated_at")
    )
    associations = list(ExternalAssociation.objects.filter(child=child).order_by("-created_at"))
    checkpoints = {
        row.association_id: row
        for row in SyncCheckpoint.objects.filter(association__in=[a.pk for a in associations])
    }
    return {
        "sessions": sessions,
        "profiles": profiles,
        "reports": reports,
        "associations": [(a, checkpoints.get(a.pk)) for a in associations],
        "activities": list(
            ActivityRecord.objects.filter(child=child)
            .select_related("activity_version")
            .order_by("-created_at")
        ),
        "consents": list(
            ConsentGrant.objects.filter(child=child)
            .select_related("policy_version")
            .order_by("-created_at")
        ),
        "requests": list(DataRequest.objects.filter(child=child).order_by("-created_at")),
        "audit": list(
            AuditEvent.objects.filter(target_id=child.pk)
            .select_related("actor")
            .order_by("-created_at")[:10]
        ),
    }


def urlencode_params(**params):
    return "?" + urlencode({k: v for k, v in params.items() if v not in (None, "")})
