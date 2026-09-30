"""Exhibition activity/follow-up pages, sharing the console's roles and CSRF."""

from django.contrib import messages
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_http_methods

from dingdong_ca.core.api.common import ApiError
from dingdong_ca.core.models import AuditEvent, ExhibitionVisitor
from dingdong_ca.core.services.exhibition import update_followup

from .forms import ExhibitionFollowupForm
from .permissions import has_permission, ops_page
from .responses import forbidden
from .services import page_links, paginate, parse_choice, parse_keyword, window
from .views import base_context

STATUSES = {"pending": "待联系", "contacted": "已联系", "closed": "已结束"}


@ops_page("exhibition.view")
@require_http_methods(["GET"])
def visitors(request):
    keyword = parse_keyword(request.GET.get("q", ""))
    status, problem = parse_choice(request.GET.get("status"), STATUSES, "跟进状态")
    rows = ExhibitionVisitor.objects.select_related("user")
    if keyword:
        rows = rows.filter(user__phone__icontains=keyword)
    if status:
        rows = rows.filter(status=status)
    page = paginate(request, rows)
    return render(
        request,
        "ops/exhibition.html",
        base_context(
            request,
            "exhibition",
            items=page.object_list,
            page=page_links(request, page),
            pages=window(page),
            keyword=keyword,
            status=status,
            statuses=STATUSES,
            filter_problems=[problem] if problem else [],
        ),
    )


@ops_page("exhibition.view")
@require_http_methods(["GET", "POST"])
def detail(request, visitor_id):
    row = get_object_or_404(ExhibitionVisitor.objects.select_related("user"), pk=visitor_id)
    form = ExhibitionFollowupForm(
        request.POST if request.method == "POST" else None,
        initial={
            "revision": row.revision,
            "status": row.status,
            "note": row.note,
        },
    )
    code = 200
    if request.method == "POST":
        if not has_permission(request.user, "exhibition.handle"):
            return forbidden(request, "当前账号不能修改跟进记录。")
        if form.is_valid():
            try:
                update_followup(row.pk, request.user, **form.cleaned_data)
            except ApiError as error:
                form.add_error(None, error.message)
                code = error.status
            else:
                messages.success(request, "跟进记录已保存。")
                return redirect("ops:exhibition_detail", visitor_id=row.pk)
        else:
            code = 422
    history = (
        AuditEvent.objects.filter(target_kind="exhibition_visitor", target_id=row.pk)
        .select_related("actor")
        .order_by("-created_at")[:20]
    )
    return render(
        request,
        "ops/exhibition_detail.html",
        base_context(
            request,
            "exhibition",
            row=row,
            form=form,
            history=history,
        ),
        status=code,
    )
