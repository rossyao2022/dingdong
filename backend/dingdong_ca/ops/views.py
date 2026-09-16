"""运营后台页面视图。

所有页面都先判断 staff 身份，再判断角色权限；无权限时进入统一的"权限不足"页。
页面本身不写业务规则，写操作一律走已测试的服务端接口。
"""

from django.contrib import messages
from django.contrib.auth import logout, update_session_auth_hash
from django.contrib.auth.views import LoginView
from django.db.models import Q
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils.http import url_has_allowed_host_and_scheme
from django.views.decorators.http import require_POST

from dingdong_ca.core.models import (
    ActivityContentVersion,
    AuditEvent,
    BackgroundJob,
    CaAccount,
    Child,
    DataRequest,
    Family,
    QuestionnaireVersion,
    ReportVersion,
)

from . import labels as L
from .forms import OpsLoginForm, OpsPasswordChangeForm, StaffCreateForm, StaffPasswordResetForm
from .permissions import (
    ROLE_LABELS,
    ROLE_PRESETS,
    has_permission,
    is_ops_staff,
    navigation,
    ops_page,
    roles_for,
)
from .responses import forbidden
from .services import (
    child_bundle,
    dashboard_data,
    family_queryset,
    family_summary,
    ops_audit,
    page_links,
    paginate,
    parse_choice,
    parse_date_range,
    parse_keyword,
    window,
)


def base_context(request, current, **extra):
    return {
        "nav": navigation(request.user),
        "current": current,
        "ops_roles": roles_for(request.user),
        "ops_role_labels": [ROLE_LABELS[c] for c in roles_for(request.user) if c in ROLE_LABELS],
        "operator": request.user,
        "labels": L,
        **extra,
    }


def can(request, permission):
    return has_permission(request.user, permission)


# --------------------------------------------------------------------------- 登录与账号


class OpsLoginView(LoginView):
    template_name = "ops/login.html"
    form_class = OpsLoginForm
    redirect_authenticated_user = True

    def get_success_url(self):
        target = self.get_redirect_url()
        if target and url_has_allowed_host_and_scheme(
            target, allowed_hosts={self.request.get_host()}, require_https=self.request.is_secure()
        ):
            return target
        return reverse("ops:dashboard")

    def form_valid(self, form):
        response = super().form_valid(form)
        user = self.request.user
        ops_audit(user, "account.login", user, user.name or user.username)
        return response


@require_POST
def logout_view(request):
    if is_ops_staff(request.user):
        ops_audit(
            request.user, "account.logout", request.user, request.user.name or request.user.username
        )
    logout(request)
    messages.success(request, "已退出登录。")
    return redirect("ops:login")


@ops_page("dashboard.view")
def password_change(request):
    form = OpsPasswordChangeForm(request.user, request.POST or None)
    if request.method == "POST" and form.is_valid():
        user = form.save()
        update_session_auth_hash(request, user)
        ops_audit(user, "staff.password_change", user, user.name or user.username)
        messages.success(request, "密码已更新，其他设备上的旧登录仍然有效。")
        return redirect("ops:password")
    return render(request, "ops/password.html", base_context(request, "password", form=form))


# --------------------------------------------------------------------------- 工作首页


QUICK_LINKS = [
    ("题库管理", "ops:questionnaires", "questionnaire.view"),
    ("活动管理", "ops:activities", "activity.view"),
    ("报告管理", "ops:reports", "report.view"),
    ("生成任务", "ops:jobs", "job.view"),
    ("账号与权限", "ops:accounts", "account.manage"),
]


@ops_page("dashboard.view")
def dashboard(request):
    data = dashboard_data(request.user)
    return render(
        request,
        "ops/dashboard.html",
        base_context(
            request,
            "dashboard",
            quick_links=[
                {"title": title, "view": view}
                for title, view, permission in QUICK_LINKS
                if can(request, permission)
            ],
            perms={
                "jobs": can(request, "job.view"),
                "services": can(request, "service.view"),
                "reports": can(request, "report.view"),
                "questionnaires": can(request, "questionnaire.view"),
                "audit": can(request, "audit.view"),
            },
            **data,
        ),
    )


# --------------------------------------------------------------------------- 家庭与儿童


@ops_page("family.view")
def families(request):
    keyword = parse_keyword(request.GET.get("q"))
    rows = family_queryset(keyword)
    page_obj = paginate(request, rows.order_by("-created_at"))
    items = [family_summary(family) for family in page_obj.object_list]
    return render(
        request,
        "ops/families.html",
        base_context(
            request,
            "families",
            keyword=keyword,
            items=items,
            page=page_links(request, page_obj),
            pages=window(page_obj),
            empty_hint="没有匹配的家庭。可以换一个手机号或儿童称呼再试。",
        ),
    )


@ops_page("family.view")
def family_detail(request, family_id):
    family = get_object_or_404(Family, pk=family_id)
    summary = family_summary(family)
    return render(
        request,
        "ops/family_detail.html",
        base_context(
            request,
            "families",
            family=family,
            member=summary["member"],
            children=summary["children"],
            can_edit_family=can(request, "family.edit"),
            can_edit_child=can(request, "child.edit"),
            can_view_reports=can(request, "report.view"),
            can_view_services=can(request, "service.view"),
            can_manage_association=can(request, "association.manage"),
        ),
    )


@ops_page("child.view")
def child_detail(request, child_id):
    child = get_object_or_404(Child.objects.select_related("family"), pk=child_id)
    can_view_audit = can(request, "audit.view")
    bundle = child_bundle(child, include_audit=can_view_audit)
    member = (
        child.family.familymembership_set.select_related("user")
        .filter(ended_at__isnull=True)
        .first()
    )
    return render(
        request,
        "ops/child_detail.html",
        base_context(
            request,
            "families",
            child=child,
            family=child.family,
            member=member,
            sessions=[(s, answer_rows(s)) for s in bundle["sessions"]],
            profiles=bundle["profiles"],
            reports=bundle["reports"],
            associations=bundle["associations"],
            activities=bundle["activities"],
            consents=bundle["consents"],
            requests=bundle["requests"],
            audit_rows=bundle["audit"],
            can_edit_child=can(request, "child.edit"),
            can_view_reports=can(request, "report.view"),
            can_view_services=can(request, "service.view"),
            can_manage_association=can(request, "association.manage"),
            can_view_audit=can_view_audit,
            can_retry=can(request, "report.retry"),
        ),
    )


def answer_rows(session):
    """把答卷答案翻译成"题目 + 选项文字"，运营不需要看代码。"""
    questions = session.questionnaire_version.questions or []
    answers = session.answers or {}
    rows = []
    for question in questions:
        selected = answers.get(question.get("code"), [])
        if isinstance(selected, str):
            selected = [selected]
        labels = [
            option.get("label")
            for option in question.get("options", [])
            if option.get("code") in (selected or [])
        ]
        rows.append({"title": question.get("title"), "answers": labels or ["未选择"]})
    return rows


# --------------------------------------------------------------------------- 题库


@ops_page("questionnaire.view")
def questionnaires(request):
    status, status_error = parse_choice(request.GET.get("status"), L.CONTENT_STATUS, "状态")
    purpose, purpose_error = parse_choice(
        request.GET.get("purpose"), L.QUESTIONNAIRE_PURPOSE, "用途"
    )
    keyword = parse_keyword(request.GET.get("q"))
    rows = QuestionnaireVersion.objects.all()
    if status:
        rows = rows.filter(status=status)
    if purpose:
        rows = rows.filter(purpose=purpose)
    if keyword:
        rows = rows.filter(
            Q(title__icontains=keyword) | Q(code__icontains=keyword) | Q(version__icontains=keyword)
        )
    page_obj = paginate(request, rows.order_by("-updated_at"))
    return render(
        request,
        "ops/questionnaires.html",
        base_context(
            request,
            "questionnaires",
            items=page_obj.object_list,
            page=page_links(request, page_obj),
            pages=window(page_obj),
            status=status,
            purpose=purpose,
            keyword=keyword,
            filter_problems=[e for e in (status_error, purpose_error) if e],
            can_edit=can(request, "questionnaire.edit"),
            empty_hint="没有匹配的题库版本。可以清空筛选条件，或新建一个草稿。",
        ),
    )


@ops_page("questionnaire.view")
def questionnaire_new(request):
    if not can(request, "questionnaire.edit"):
        return forbidden(request, "只有内容运营或管理员可以新建题库。")
    return render(
        request,
        "ops/questionnaire_new.html",
        base_context(
            request,
            "questionnaires",
            purposes=list(L.QUESTIONNAIRE_PURPOSE.items()),
            ranges={"exploration": "1–10", "assessment": "20–30"},
        ),
    )


@ops_page("questionnaire.view")
def questionnaire_edit(request, version_id):
    row = get_object_or_404(QuestionnaireVersion, pk=version_id)
    return render(
        request,
        "ops/questionnaire_edit.html",
        base_context(
            request,
            "questionnaires",
            row=row,
            can_edit=can(request, "questionnaire.edit") and row.status == "draft",
            can_manage=can(request, "questionnaire.edit"),
            problems=None,
            payload={
                "title": row.title,
                "description": row.description,
                "questions": row.questions or [],
            },
            history=list(
                QuestionnaireVersion.objects.filter(code=row.code)
                .order_by("-created_at")
                .values("id", "version", "status", "updated_at")
            ),
        ),
    )


@ops_page("questionnaire.view")
def questionnaire_preview(request, version_id):
    row = get_object_or_404(QuestionnaireVersion, pk=version_id)
    return render(
        request,
        "ops/questionnaire_preview.html",
        base_context(request, "questionnaires", row=row, purpose_label=row.get_purpose_display()),
    )


# --------------------------------------------------------------------------- 活动


@ops_page("activity.view")
def activities(request):
    status, status_error = parse_choice(request.GET.get("status"), L.CONTENT_STATUS, "状态")
    keyword = parse_keyword(request.GET.get("q"))
    rows = ActivityContentVersion.objects.all()
    if status:
        rows = rows.filter(status=status)
    if keyword:
        rows = rows.filter(
            Q(title__icontains=keyword) | Q(code__icontains=keyword) | Q(version__icontains=keyword)
        )
    page_obj = paginate(request, rows.order_by("-updated_at"))
    return render(
        request,
        "ops/activities.html",
        base_context(
            request,
            "activities",
            items=page_obj.object_list,
            page=page_links(request, page_obj),
            pages=window(page_obj),
            status=status,
            keyword=keyword,
            filter_problems=[e for e in (status_error,) if e],
            can_edit=can(request, "activity.edit"),
            empty_hint="没有匹配的活动版本。可以清空筛选条件，或新建一个草稿。",
        ),
    )


@ops_page("activity.view")
def activity_new(request):
    if not can(request, "activity.edit"):
        return forbidden(request, "只有内容运营或管理员可以新建活动。")
    return render(
        request,
        "ops/activity_new.html",
        base_context(request, "activities", styles=list(L.ACTIVITY_STYLE.items())),
    )


@ops_page("activity.view")
def activity_edit(request, version_id):
    row = get_object_or_404(ActivityContentVersion, pk=version_id)
    return render(
        request,
        "ops/activity_edit.html",
        base_context(
            request,
            "activities",
            row=row,
            styles=list(L.ACTIVITY_STYLE.items()),
            can_edit=can(request, "activity.edit") and row.status == "draft",
            can_manage=can(request, "activity.edit"),
            payload={
                "title": row.title,
                "island": row.island,
                "mood": row.mood,
                "duration_minutes": row.duration_minutes,
                "content": row.content or {},
            },
            history=list(
                ActivityContentVersion.objects.filter(code=row.code)
                .order_by("-created_at")
                .values("id", "version", "status", "updated_at")
            ),
            active_records=row.activityrecord_set.filter(status="active").count(),
            total_records=row.activityrecord_set.count(),
        ),
    )


@ops_page("activity.view")
def activity_preview(request, version_id):
    row = get_object_or_404(ActivityContentVersion, pk=version_id)
    return render(
        request,
        "ops/activity_preview.html",
        base_context(request, "activities", row=row),
    )


# --------------------------------------------------------------------------- 报告与任务


@ops_page("report.view")
def reports(request):
    keyword = parse_keyword(request.GET.get("q"))
    origin, origin_error = parse_choice(request.GET.get("origin"), L.DATA_ORIGIN, "数据来源")
    rows = ReportVersion.objects.select_related("profile__child", "template_version")
    if keyword:
        rows = rows.filter(profile__child__name__icontains=keyword)
    if origin:
        rows = rows.filter(data_origin=origin)
    page_obj = paginate(request, rows.order_by("-generated_at"))
    failed = BackgroundJob.objects.filter(kind="report", status="failed").count()
    return render(
        request,
        "ops/reports.html",
        base_context(
            request,
            "reports",
            items=page_obj.object_list,
            page=page_links(request, page_obj),
            pages=window(page_obj),
            keyword=keyword,
            origin=origin,
            filter_problems=[e for e in (origin_error,) if e],
            failed_count=failed,
            empty_hint="还没有生成的报告。报告由家长完成测评后由后台任务自动生成。",
        ),
    )


@ops_page("report.view")
def report_detail(request, report_id):
    row = get_object_or_404(
        ReportVersion.objects.select_related("profile__child", "template_version"), pk=report_id
    )
    sections = (row.content or {}).get("sections", [])
    jobs = BackgroundJob.objects.filter(kind="report", profile=row.profile).order_by("-created_at")
    return render(
        request,
        "ops/report_detail.html",
        base_context(
            request,
            "reports",
            row=row,
            child=row.profile.child,
            sections=sections,
            source_summary=(row.content or {}).get("source_summary", ""),
            jobs=jobs,
            can_retry=can(request, "report.retry"),
        ),
    )


@ops_page("job.view")
def jobs(request):
    status, status_error = parse_choice(request.GET.get("status"), L.JOB_STATUS, "状态")
    kind, kind_error = parse_choice(request.GET.get("kind"), L.JOB_KIND, "任务类型")
    rows = BackgroundJob.objects.all()
    if status:
        rows = rows.filter(status=status)
    if kind:
        rows = rows.filter(kind=kind)
    if request.GET.get("only_problem") == "1":
        rows = rows.filter(status__in=["failed", "waiting", "unknown"])
    page_obj = paginate(request, rows.order_by("-updated_at"))
    items = []
    for job in page_obj.object_list:
        title, advice, retryable = L.job_error(job.error_code)
        items.append({"job": job, "reason": title, "advice": advice, "retryable": retryable})
    return render(
        request,
        "ops/jobs.html",
        base_context(
            request,
            "jobs",
            items=items,
            page=page_links(request, page_obj),
            pages=window(page_obj),
            status=status,
            kind=kind,
            filter_problems=[e for e in (status_error, kind_error) if e],
            only_problem=request.GET.get("only_problem") == "1",
            can_retry=can(request, "report.retry"),
            empty_hint="没有匹配的生成任务。",
        ),
    )


@ops_page("job.view")
def job_detail(request, job_id):
    job = get_object_or_404(BackgroundJob, pk=job_id)
    title, advice, retryable = L.job_error(job.error_code)
    attempts = job.jobattempt_set.order_by("-attempt_no")
    subject = None
    if job.profile_id:
        subject = job.profile.child
    elif job.association_id:
        subject = job.association.child
    return render(
        request,
        "ops/job_detail.html",
        base_context(
            request,
            "jobs",
            job=job,
            reason=title,
            advice=advice,
            retryable=retryable,
            attempts=attempts,
            subject=subject,
            can_retry=can(request, "report.retry"),
            audit_rows=AuditEvent.objects.filter(target_id=job.pk)
            .select_related("actor")
            .order_by("-created_at")[:10]
            if can(request, "audit.view")
            else [],
        ),
    )


# --------------------------------------------------------------------------- 服务事项


@ops_page("service.view")
def services(request):
    status, status_error = parse_choice(request.GET.get("status"), L.SERVICE_STATUS, "状态")
    kind, kind_error = parse_choice(request.GET.get("kind"), L.SERVICE_KIND, "事项类型")
    keyword = parse_keyword(request.GET.get("q"))
    rows = DataRequest.objects.select_related("child", "requester")
    if status:
        rows = rows.filter(status=status)
    if kind:
        rows = rows.filter(kind=kind)
    if keyword:
        rows = rows.filter(
            Q(child__name__icontains=keyword) | Q(requester__phone__icontains=keyword)
        )
    page_obj = paginate(request, rows.order_by("-created_at"))
    counts = {
        key: DataRequest.objects.filter(status=key).count()
        for key in ["open", "processing", "completed", "cancelled"]
    }
    return render(
        request,
        "ops/services.html",
        base_context(
            request,
            "services",
            items=page_obj.object_list,
            page=page_links(request, page_obj),
            pages=window(page_obj),
            status=status,
            kind=kind,
            keyword=keyword,
            filter_problems=[e for e in (status_error, kind_error) if e],
            counts=counts,
            can_handle=can(request, "service.handle"),
            empty_hint="没有匹配的服务事项。",
        ),
    )


@ops_page("service.view")
def service_detail(request, request_id):
    row = get_object_or_404(DataRequest.objects.select_related("child", "requester"), pk=request_id)
    can_view_audit = can(request, "audit.view")
    history = (
        AuditEvent.objects.filter(
            Q(target_id=row.pk) | Q(action="data_request.note", target_id=row.pk)
        )
        .select_related("actor")
        .order_by("-created_at")
        if can_view_audit
        else AuditEvent.objects.none()
    )
    return render(
        request,
        "ops/service_detail.html",
        base_context(
            request,
            "services",
            row=row,
            history=history,
            can_handle=can(request, "service.handle"),
            can_delete=can(request, "service.delete"),
            can_view_audit=can_view_audit,
            child_requests=DataRequest.objects.filter(child=row.child).order_by("-created_at")
            if row.child_id
            else [],
        ),
    )


# --------------------------------------------------------------------------- 账号与审计


@ops_page("account.manage")
def accounts(request):
    from django.contrib.auth import get_user_model

    keyword = parse_keyword(request.GET.get("q"))
    rows = get_user_model().objects.filter(account_kind="staff", is_staff=True)
    if keyword:
        rows = rows.filter(Q(username__icontains=keyword) | Q(name__icontains=keyword))
    page_obj = paginate(request, rows.order_by("username"))
    items = []
    for user in page_obj.object_list:
        items.append(
            {
                "user": user,
                "role_labels": [
                    ROLE_LABELS[c]
                    for c in sorted(user.groups.values_list("name", flat=True))
                    if c in ROLE_LABELS
                ],
                "is_self": user.pk == request.user.pk,
            }
        )
    return render(
        request,
        "ops/accounts.html",
        base_context(
            request,
            "accounts",
            items=items,
            page=page_links(request, page_obj),
            pages=window(page_obj),
            keyword=keyword,
            presets=ROLE_PRESETS,
            empty_hint="没有匹配的账号。",
        ),
    )


@ops_page("account.manage")
def account_new(request):
    form = StaffCreateForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        user = form.save()
        ops_audit(
            request.user,
            "staff.create",
            user,
            user.name or user.username,
            {"roles": form.cleaned_data["roles"]},
        )
        messages.success(request, f"已创建账号 {user.username}，请让本人首次登录后立即修改密码。")
        return redirect("ops:account_detail", user_id=user.pk)
    return render(
        request,
        "ops/account_new.html",
        base_context(request, "accounts", form=form, presets=ROLE_PRESETS),
    )


def _modifiable(request, user):
    """与 /api/v1/staff/users 一致的保护：不能改自己、超级管理员和其他管理员。"""
    from django.contrib.auth import get_user_model

    if not isinstance(user, get_user_model()):
        return False
    return not (
        user.pk == request.user.pk
        or user.is_superuser
        or user.groups.filter(name="account_admin").exists()
    )


@ops_page("account.manage")
def account_detail(request, user_id):
    from django.contrib.auth import get_user_model
    from django.contrib.auth.models import Group

    user = get_object_or_404(get_user_model(), pk=user_id, account_kind="staff", is_staff=True)
    editable = _modifiable(request, user)
    if request.method == "POST":
        if not editable:
            return forbidden(request, "不能通过业务入口修改自己、超级管理员或其他管理员。")
        action = request.POST.get("action")
        if action == "roles":
            current_key = "|".join(sorted(user.groups.values_list("name", flat=True)))
            expected_key = (request.POST.get("expected_roles") or "").strip()
            if expected_key and expected_key != current_key:
                # 别人在你打开这一页之后改过角色：不能静默覆盖，要求刷新后重做。
                messages.error(
                    request,
                    "该账号的角色刚刚已被其他管理员修改，本次没有保存。请刷新页面确认最新角色后再操作。",
                )
                return redirect("ops:account_detail", user_id=user.pk)
            codes = [c for c in request.POST.getlist("roles") if c in ROLE_LABELS]
            if not codes:
                messages.error(request, "请至少保留一个角色，否则该账号将无法使用后台。")
                return redirect("ops:account_detail", user_id=user.pk)
            user.groups.set(Group.objects.filter(name__in=codes))
            ops_audit(
                request.user, "staff.roles", user, user.name or user.username, {"roles": codes}
            )
            messages.success(request, "角色已更新，该账号下次请求即生效。")
        elif action == "status":
            expected_active = request.POST.get("expected_active")
            actual_active = "1" if user.is_active else "0"
            if expected_active in ("0", "1") and expected_active != actual_active:
                messages.error(
                    request,
                    "该账号的启用状态刚刚已被其他管理员修改，本次没有保存。请刷新页面确认后再操作。",
                )
                return redirect("ops:account_detail", user_id=user.pk)
            user.is_active = request.POST.get("is_active") == "1"
            user.save(update_fields=["is_active"])
            ops_audit(
                request.user,
                "staff.status",
                user,
                user.name or user.username,
                {"is_active": user.is_active},
            )
            messages.success(request, "账号状态已更新。" if user.is_active else "账号已停用。")
        return redirect("ops:account_detail", user_id=user.pk)
    return render(
        request,
        "ops/account_detail.html",
        base_context(
            request,
            "accounts",
            account=user,
            editable=editable,
            assigned=sorted(user.groups.values_list("name", flat=True)),
            role_choices=[(code, ROLE_LABELS[code]) for code in ROLE_LABELS],
            assigned_key="|".join(sorted(user.groups.values_list("name", flat=True))),
            audit_rows=AuditEvent.objects.filter(target_id=user.pk)
            .select_related("actor")
            .order_by("-created_at")[:10]
            if can(request, "audit.view")
            else [],
        ),
    )


@ops_page("account.manage")
def account_reset_password(request, user_id):
    from django.contrib.auth import get_user_model

    user = get_object_or_404(get_user_model(), pk=user_id, account_kind="staff", is_staff=True)
    if not _modifiable(request, user):
        return forbidden(request, "不能重置自己、超级管理员或其他管理员的密码。")
    form = StaffPasswordResetForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        user.set_password(form.cleaned_data["password1"])
        user.save(update_fields=["password"])
        ops_audit(request.user, "staff.password_reset", user, user.name or user.username)
        messages.success(request, f"已重置 {user.username} 的密码，请通过安全渠道告知本人。")
        return redirect("ops:account_detail", user_id=user.pk)
    return render(
        request,
        "ops/account_reset_password.html",
        base_context(request, "accounts", form=form, account=user),
    )


@ops_page("audit.view")
def audit_log(request):
    action, action_error = parse_choice(request.GET.get("action"), L.AUDIT_ACTION, "动作")
    actor = parse_keyword(request.GET.get("actor"))
    start_raw = (request.GET.get("start") or "").strip()
    end_raw = (request.GET.get("end") or "").strip()
    start, end, date_errors = parse_date_range(start_raw, end_raw)
    filter_problems = ([action_error] if action_error else []) + date_errors

    rows = AuditEvent.objects.select_related("actor")
    if action:
        rows = rows.filter(action=action)
    if actor:
        rows = rows.filter(Q(actor__username__icontains=actor) | Q(actor__name__icontains=actor))
    if start:
        rows = rows.filter(created_at__date__gte=start)
    if end:
        rows = rows.filter(created_at__date__lte=end)
    page_obj = paginate(request, rows.order_by("-created_at"))
    return render(
        request,
        "ops/audit.html",
        base_context(
            request,
            "audit",
            items=page_obj.object_list,
            page=page_links(request, page_obj),
            pages=window(page_obj),
            action=action,
            actor=actor,
            start=start_raw,
            end=end_raw,
            filter_problems=filter_problems,
            action_choices=sorted(L.AUDIT_ACTION.items()),
            empty_hint="没有匹配的操作记录。",
        ),
    )


# --------------------------------------------------------------------------- CA 账户
# 只读页。号码不可在这里代改：换机是家长端的显式两步（先归档旧号，再发新号），
# 运营只负责看清"哪个孩子对应哪台机器人、接通了没有"。


@ops_page("ca_account.view")
def ca_accounts(request):
    status, status_error = parse_choice(request.GET.get("status"), L.CA_ACCOUNT_STATUS, "状态")
    bind_state, bind_error = parse_choice(
        request.GET.get("bind_state"), L.CA_ACCOUNT_BIND_STATE, "绑定状态"
    )
    keyword = parse_keyword(request.GET.get("q"))
    rows = CaAccount.objects.select_related("child", "family", "bound_by")
    if status:
        rows = rows.filter(status=status)
    if bind_state:
        rows = rows.filter(bind_state=bind_state)
    if keyword:
        rows = rows.filter(
            Q(ca_account_id__icontains=keyword)
            | Q(child__name__icontains=keyword)
            | Q(bound_by__phone__icontains=keyword)
        )
    page_obj = paginate(request, rows.order_by("-created_at"))
    counts = {key: CaAccount.objects.filter(status=key).count() for key in ["active", "retired"]}
    return render(
        request,
        "ops/ca_accounts.html",
        base_context(
            request,
            "ca_accounts",
            items=page_obj.object_list,
            page=page_links(request, page_obj),
            pages=window(page_obj),
            status=status,
            bind_state=bind_state,
            keyword=keyword,
            filter_problems=[e for e in (status_error, bind_error) if e],
            counts=counts,
            unbound=CaAccount.objects.filter(status="active", bind_state="unbound").count(),
            empty_hint="没有匹配的 CA 账户。家长用机器人 NFC 绑定时才会生成账户号。",
        ),
    )


# --------------------------------------------------------------------------- 权限不足
# 权限不足页由 ops.responses 提供；这里不再注册全局 handler，避免影响家长端契约。


__all__ = [
    "OpsLoginView",
    "account_detail",
    "account_new",
    "account_reset_password",
    "accounts",
    "activities",
    "activity_edit",
    "activity_new",
    "activity_preview",
    "audit_log",
    "ca_accounts",
    "child_detail",
    "dashboard",
    "families",
    "family_detail",
    "job_detail",
    "jobs",
    "logout_view",
    "password_change",
    "questionnaire_edit",
    "questionnaire_new",
    "questionnaire_preview",
    "questionnaires",
    "report_detail",
    "reports",
    "service_detail",
    "services",
]
