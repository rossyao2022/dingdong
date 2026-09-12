"""运营后台的统一响应页面（权限不足、记录不存在）。

不注册为全局 handler403/handler404，避免影响家长端 API 的既有契约。
"""

from django.shortcuts import render

from . import labels as L


def _shell(request):
    from .permissions import ROLE_LABELS, is_ops_staff, navigation, roles_for

    staff = is_ops_staff(request.user)
    return {
        "nav": navigation(request.user) if staff else [],
        "current": "",
        "operator": request.user if staff else None,
        "ops_role_labels": [ROLE_LABELS[c] for c in roles_for(request.user) if c in ROLE_LABELS]
        if staff
        else [],
        "labels": L,
    }


def forbidden(request, reason=""):
    return render(
        request,
        "ops/forbidden.html",
        {**_shell(request), "reason": reason},
        status=403,
    )


def not_found(request, reason=""):
    return render(
        request,
        "ops/not_found.html",
        {**_shell(request), "reason": reason},
        status=404,
    )
