"""运营后台的通用服务：分页、JSON 信封、审计、工作首页数据。

这里不重复业务规则：内容校验、任务重试、事项处理仍然调用 core 里
已经过测试的实现，运营后台只负责"用运营看得懂的方式呈现和触发"。
"""

import datetime
import re
import uuid
from urllib.parse import urlencode

from django.core.paginator import EmptyPage, Paginator
from django.db.models import Q
from django.http import JsonResponse
from django.utils import timezone

from dingdong_ca.core.models import AuditEvent

PAGE_SIZE = 20
# 首页「最近操作」的可见事件范围：与 /ops/audit/ 完全同一套数据，同样的 audit.view 权限。
RECENT_AUDIT_LIMIT = 8
# 日期筛选只接受扩展 ISO 形式，避免 20260912 这类写法绕开"格式错误"提示。
DATE_PATTERN = re.compile(r"\d{4}-\d{2}-\d{2}")


# --------------------------------------------------------------------------- 筛选参数校验
# 非法筛选值不能静默忽略：运营会以为自己看到的是筛选后的结果。
# 统一在这里把非法值摘出来，交给页面用中文提示，同时保留用户输入。


def parse_choice(raw, mapping, label):
    """返回 (有效值, 错误说明)。空值表示未筛选，不算错误。"""
    value = (raw or "").strip() if isinstance(raw, str) else ""
    if not value:
        return "", ""
    if value in mapping:
        return value, ""
    return "", f"{label}“{value}”不是有效选项，本次未按该条件筛选。"


def parse_date_filter(raw, label):
    """严格校验 ISO 扩展日期（YYYY-MM-DD）。返回 (date 或 None, 错误说明)。

    只接受 YYYY-MM-DD：Python 3.11 起 date.fromisoformat 会顺带接受
    20260912 这类紧凑写法，但页面上给运营的说明写的是 2026-09-12，
    宽松接受会让"格式错误"和"格式正确"的边界变得难以解释。
    """
    value = (raw or "").strip() if isinstance(raw, str) else ""
    if not value:
        return None, ""
    if DATE_PATTERN.fullmatch(value):
        try:
            return datetime.date.fromisoformat(value), ""
        except ValueError:
            pass  # 2026-02-30、2026-13-01：格式像日期，但那天不存在。
    return (
        None,
        f"{label}“{value}”不是有效日期（应为 2026-09-12 这样的真实日期），本次未按日期筛选。",
    )


def parse_date_range(start_raw, end_raw):
    """校验开始/结束日期以及先后顺序。返回 (start, end, 问题列表)。"""
    problems = []
    start, error = parse_date_filter(start_raw, "开始日期")
    if error:
        problems.append(error)
    end, error = parse_date_filter(end_raw, "结束日期")
    if error:
        problems.append(error)
    if start and end and start > end:
        problems.append("开始日期晚于结束日期，两者调换后才能正确筛选。")
        start = end = None
    return start, end, problems


def parse_keyword(raw, max_length=80):
    """清洗检索词：去掉首尾空白与控制字符，并限制长度。

    控制字符（如 \\x00）直接送进 ORM 会触发数据库异常，属于"非法输入引起
    未处理异常"的一类问题，因此在入口处统一消掉。
    """
    if not isinstance(raw, str):
        return ""
    cleaned = "".join(ch for ch in raw if ch.isprintable() and ch not in "\r\n\t")
    return cleaned.strip()[:max_length]


def parse_int(raw, label, minimum=None, maximum=None):
    """严格校验整数筛选值。返回 (int 或 None, 错误说明)。"""
    value = (raw or "").strip() if isinstance(raw, str) else ""
    if not value:
        return None, ""
    try:
        number = int(value)
    except (TypeError, ValueError):
        return None, f"{label}“{value}”不是有效整数，本次未按该条件筛选。"
    if minimum is not None and number < minimum:
        return None, f"{label}不能小于 {minimum}，本次未按该条件筛选。"
    if maximum is not None and number > maximum:
        return None, f"{label}不能大于 {maximum}，本次未按该条件筛选。"
    return number, ""


# --------------------------------------------------------------------------- 分页


def paginate(request, queryset, per_page=PAGE_SIZE):
    try:
        number = int(request.GET.get("page", "1"))
        if number < 1:
            raise ValueError
    except (TypeError, ValueError):
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


def json_error(code, message, status=400, fields=None, trace_id=None, extra=None):
    body = {
        "ok": False,
        "code": code,
        "message": message,
        "field_errors": fields or [],
        "trace_id": trace_id or str(uuid.uuid4()),
        **(extra or {}),
    }
    response = JsonResponse(body, status=status)
    response["Cache-Control"] = "no-store"
    return response


class OpsError(Exception):
    """带业务语言的运营后台错误。"""

    def __init__(self, code, message, status=400, fields=None, extra=None):
        self.code = code
        self.message = message
        self.status = status
        self.fields = fields or []
        self.extra = extra or {}


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


def dashboard_data(user=None):
    """首页统计与待办。每项都返回口径说明，避免"看起来像报表"的假数字。

    可见范围在服务端按权限裁剪，不依赖模板隐藏：
    - 审计：只有 audit.view 的角色拿到「最近操作」；
    - 家庭与儿童口径：family.view；
    - 答卷/报告/活动口径、报告失败数：report.view；
    - 待办（服务事项、生成任务、题库草稿）：各自的 view 权限。

    返回的字典里只包含该角色有权看到的键；模板仍保留 `{% if perms.x %}` 判断，
    两层一致，任一入口（首页、详情页、接口）都不能绕过权限。
    """
    from .permissions import has_permission

    def allowed(permission):
        return bool(user is not None and has_permission(user, permission))

    can_family = allowed("family.view")
    can_services = allowed("service.view")
    can_jobs = allowed("job.view")
    can_content = allowed("questionnaire.view")
    can_reports = allowed("report.view")
    can_audit = allowed("audit.view")

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

    metrics = []
    if can_family:
        metrics += [
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
                "label": "近 7 天新建档案（含已归档）",
                "value": Child.objects.filter(created_at__gte=since).count(),
                "scope": "口径：创建时间在过去 7 天内的儿童档案数，含已归档；与“在册儿童”不同口径，所以可能更大。",
            },
        ]
    if can_reports:
        metrics += [
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

    counters = {}
    if can_services:
        counters["open_services"] = DataRequest.objects.filter(
            status__in=["open", "processing"]
        ).count()
    if can_jobs:
        counters["failed_jobs"] = BackgroundJob.objects.filter(status="failed").count()
        counters["waiting_jobs"] = BackgroundJob.objects.filter(status="waiting").count()
    if can_reports:
        counters["failed_report_jobs"] = BackgroundJob.objects.filter(
            kind="report", status="failed"
        ).count()
    if can_content:
        counters["draft_questionnaires"] = QuestionnaireVersion.objects.filter(
            status="draft"
        ).count()

    return {
        "metrics": metrics,
        "counters": counters,
        "can_view_audit": can_audit,
        "open_service_items": list(
            DataRequest.objects.filter(status__in=["open", "processing"])
            .select_related("child")
            # 首页先看刚进来的求助：取最新的 5 条（模板写明条数与排序）。
            .order_by("-created_at")[:5]
        )
        if can_services
        else [],
        "failed_job_items": [
            _job_row(j)
            for j in BackgroundJob.objects.filter(status="failed").order_by("-updated_at")[:5]
        ]
        if can_jobs
        else [],
        "waiting_job_items": [
            _job_row(j)
            for j in BackgroundJob.objects.filter(status="waiting").order_by("-updated_at")[:5]
        ]
        if can_jobs
        else [],
        "draft_questionnaire_items": list(
            QuestionnaireVersion.objects.filter(status="draft").order_by("-updated_at")[:5]
        )
        if can_content
        else [],
        "recent_audit": list(
            AuditEvent.objects.select_related("actor").order_by("-created_at")[:RECENT_AUDIT_LIMIT]
        )
        if can_audit
        else [],
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


def child_bundle(child, include_audit=True):
    """儿童详情需要的全部关联数据，一次取齐，避免运营逐页翻找。

    `include_audit=False` 时不查询该档案的操作记录：没有 audit.view 的角色
    不能通过详情页看到审计信息。
    """
    from dingdong_ca.core.models import (
        ActivityRecord,
        AssessmentSession,
        CaAccount,
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
        # 同一孩子同一时刻只有一个活跃号（数据库条件唯一约束保证）；换机后的旧号是
        # retired，只说明"这个孩子以前绑过机器人"，不作为在用的账户展示。
        "ca_account": CaAccount.objects.filter(child=child, status="active").first(),
        "retired_accounts": CaAccount.objects.filter(child=child, status="retired").count(),
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
        )
        if include_audit
        else [],
    }


def urlencode_params(**params):
    return "?" + urlencode({k: v for k, v in params.items() if v not in (None, "")})
