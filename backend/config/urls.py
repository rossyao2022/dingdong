from django.contrib import admin
from django.urls import include, path
from django.views import defaults

from dingdong_ca.core.api import (
    accounts,
    activities,
    assessments,
    ca_accounts,
    children,
    consents,
    data_requests,
    growth,
    reports,
    robots,
    staff,
)


def handler403(request, exception=None):
    """运营后台走自己的"权限不足"页；其余路径保持 Django 默认行为。"""
    if request.path.startswith("/ops/"):
        from dingdong_ca.ops.responses import forbidden

        return forbidden(request, "当前账号没有访问该功能的权限。")
    return defaults.permission_denied(request, exception)


def handler404(request, exception=None):
    """运营后台走自己的"记录不存在"页；家长端 API 不受影响。"""
    if request.path.startswith("/ops/"):
        from dingdong_ca.ops.responses import not_found

        return not_found(request, "记录不存在或已被删除，请返回列表重新选择。")
    return defaults.page_not_found(request, exception)


urlpatterns = [
    path("api/v1/children/<uuid:child_id>/associations/verify", robots.verify),
    path("api/v1/children/<uuid:child_id>/associations", robots.associations),
    path("api/v1/associations/<uuid:association_id>/revoke", robots.revoke),
    path("api/v1/children/<uuid:child_id>/observations", growth.observations),
    path("api/v1/children/<uuid:child_id>/growth-overview", growth.overview),
    path("api/v1/children/<uuid:child_id>/data-requests", data_requests.requests),
    path("api/v1/data-requests", data_requests.receipts),
    path("api/v1/staff/jobs/<uuid:job_id>", staff.job_detail),
    path("api/v1/staff/jobs/<uuid:job_id>/retry", staff.retry),
    path("api/v1/staff/data-requests/<uuid:request_id>/resolve", staff.resolve),
    *[
        path("api/v1/staff/" + kind + "/<uuid:version_id>/publish", staff.publish, {"kind": kind})
        for kind in ["questionnaires", "activities", "report-templates", "rules"]
    ],
    *[
        path(
            "api/v1/staff/associations/<uuid:association_id>/" + action,
            staff.pause_resume,
            {"action": action},
        )
        for action in ["pause", "resume"]
    ],
    *[
        path("api/v1/staff/users/<uuid:staff_id>/" + action, staff.staff_user, {"action": action})
        for action in ["roles", "status"]
    ],
    path("api/v1/policies/current", consents.policy),
    path("api/v1/children/<uuid:child_id>/consents", consents.consents),
    path("api/v1/consents/<uuid:consent_id>/revoke", consents.revoke),
    path("api/v1/assessment-config", assessments.config),
    path("api/v1/children/<uuid:child_id>/assessments", assessments.create),
    path("api/v1/assessments/<uuid:session_id>", assessments.detail),
    path("api/v1/assessments/<uuid:session_id>/answers", assessments.answers),
    path("api/v1/assessments/<uuid:session_id>/submit", assessments.submit),
    path("api/v1/assessments/<uuid:session_id>/cancel", assessments.cancel),
    path(
        "api/v1/assessments/<uuid:session_id>/complete-exploration",
        assessments.complete_exploration,
    ),
    path("api/v1/children/<uuid:child_id>/profiles", reports.profiles),
    path("api/v1/children/<uuid:child_id>/reports", reports.reports),
    path("api/v1/reports/<uuid:report_id>", reports.detail),
    path("admin/", admin.site.urls),
    path("ops/", include("dingdong_ca.ops.urls")),
    path("api/v1/runtime", accounts.runtime),
    path("api/v1/auth/csrf", accounts.csrf),
    path("api/v1/auth/sms", accounts.sms),
    path("api/v1/auth/login", accounts.login),
    path("api/v1/auth/refresh", accounts.refresh),
    path("api/v1/auth/logout", accounts.logout),
    path("api/v1/me", accounts.me),
    path("api/v1/children", children.children),
    path("api/v1/children/<uuid:child_id>", children.child_detail),
    path("api/v1/activities", activities.activities),
    path("api/v1/children/<uuid:child_id>/activity-records", activities.records),
    path("api/v1/activity-records/<uuid:record_id>", activities.record_detail),
    path("api/v1/activity-records/<uuid:record_id>/finish", activities.finish),
    # CA 账户（NFC 承接与换机）：ca_account_id 是不透明字符串，不是 UUID
    path("api/v1/children/<uuid:child_id>/ca-accounts", ca_accounts.child_accounts),
    path("api/v1/ca-accounts/<str:ca_account_id>", ca_accounts.account_detail),
    path("api/v1/ca-accounts/<str:ca_account_id>/retire", ca_accounts.account_retire),
]
