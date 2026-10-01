"""Staff-only form preview and exports, all bound to the selected snapshot."""

import uuid

from django.core import signing
from django.http import Http404, HttpResponse
from django.shortcuts import get_object_or_404, render
from django.views.decorators.http import require_GET

from dingdong_ca.core.models import Child
from dingdong_ca.core.services.assessment_forms import (
    assessment_form,
    canonical_json,
    chinese_form,
    completed_sessions,
    csv_form,
)

from .permissions import has_permission, ops_page
from .responses import forbidden
from .services import ops_audit
from .views import base_context

SNAPSHOT_SALT = "ca-assessment-form-v1"


def private_response(response):
    response["Cache-Control"] = "private, no-store"
    response["X-Content-Type-Options"] = "nosniff"
    return response


def form_error(request, child, message, status):
    return private_response(
        render(
            request,
            "ops/assessment_form_error.html",
            base_context(request, "families", child=child, message=message),
            status=status,
        )
    )


def selected_history(child, raw_id):
    try:
        session_id = uuid.UUID(raw_id)
    except (ValueError, TypeError, AttributeError):
        return None
    return [get_object_or_404(completed_sessions(child), pk=session_id)]


def load_snapshot(child, token):
    """The URL carries IDs and digest only, never the family's answer data."""
    value = signing.loads(token, salt=SNAPSHOT_SALT, max_age=8 * 60 * 60)
    if value["child_id"] != str(child.pk):
        raise ValueError("wrong child")
    identifiers = [uuid.UUID(item) for item in value["sessions"]]
    if len(set(identifiers)) != len(identifiers) or len(identifiers) > 4:
        raise ValueError("invalid sessions")
    available = {row.pk: row for row in completed_sessions(child).filter(pk__in=identifiers)}
    if len(available) != len(identifiers):
        raise Http404
    document = assessment_form(child, [available[ident] for ident in identifiers])
    return document, document["snapshot_digest"] == value["digest"]


@ops_page("child.view")
@require_GET
def preview(request, child_id):
    if not has_permission(request.user, "report.view"):
        return forbidden(request)
    child = get_object_or_404(Child, pk=child_id)
    sessions = None
    if request.GET.get("session_id"):
        sessions = selected_history(child, request.GET["session_id"])
        if sessions is None:
            return form_error(request, child, "请选择有效的历史测评。", 422)
    document = assessment_form(child, sessions)
    token = signing.dumps(
        {
            "child_id": str(child.pk),
            "sessions": [item["assessment_id"] for item in document["assessments"]],
            "digest": document["snapshot_digest"],
        },
        salt=SNAPSHOT_SALT,
        compress=True,
    )
    ops_audit(
        request.user,
        "assessment_form.preview",
        child,
        "测评表单",
        {"digest": document["snapshot_digest"], "assessment_count": len(document["assessments"])},
    )
    return private_response(
        render(
            request,
            "ops/assessment_form.html",
            base_context(
                request,
                "families",
                child=child,
                document=document,
                copy_text=chinese_form(document),
                snapshot=token,
                history=completed_sessions(child),
                selected_session=request.GET.get("session_id", ""),
            ),
        )
    )


@ops_page("child.view")
@require_GET
def download(request, child_id, format_name):
    if not has_permission(request.user, "report.view"):
        return forbidden(request)
    child = get_object_or_404(Child, pk=child_id)
    try:
        token = request.GET.get("snapshot", "")
        if not token or len(token) > 4096:
            raise ValueError("missing snapshot")
        document, unchanged = load_snapshot(child, token)
    except (signing.BadSignature, ValueError, TypeError, KeyError):
        return form_error(request, child, "表单链接无效或已过期，请重新打开测评表单。", 422)
    if not unchanged:
        return form_error(request, child, "记录已更新，请重新打开测评表单后再复制或下载。", 409)
    if format_name == "json":
        response = HttpResponse(
            canonical_json(document), content_type="application/json; charset=utf-8"
        )
    elif format_name == "csv":
        response = HttpResponse(csv_form(document), content_type="text/csv; charset=utf-8")
    elif format_name == "copy":
        response = HttpResponse(chinese_form(document), content_type="text/plain; charset=utf-8")
    else:
        raise Http404
    if format_name != "copy":
        response["Content-Disposition"] = (
            f'attachment; filename="ca-assessment-form-{document["snapshot_digest"][:12]}.{format_name}"'
        )
    ops_audit(
        request.user,
        "assessment_form." + format_name,
        child,
        "测评表单",
        {"digest": document["snapshot_digest"], "assessment_count": len(document["assessments"])},
    )
    return private_response(response)
