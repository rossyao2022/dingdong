from django.urls import path

from . import api, views

app_name = "ops"

urlpatterns = [
    path("", views.dashboard, name="dashboard"),
    path("login/", views.OpsLoginView.as_view(), name="login"),
    path("logout/", views.logout_view, name="logout"),
    path("password/", views.password_change, name="password"),
    # 家庭与儿童
    path("families/", views.families, name="families"),
    path("families/<uuid:family_id>/", views.family_detail, name="family_detail"),
    path("children/<uuid:child_id>/", views.child_detail, name="child_detail"),
    # 题库
    path("questionnaires/", views.questionnaires, name="questionnaires"),
    path("questionnaires/new/", views.questionnaire_new, name="questionnaire_new"),
    path("questionnaires/<uuid:version_id>/", views.questionnaire_edit, name="questionnaire_edit"),
    path(
        "questionnaires/<uuid:version_id>/preview/",
        views.questionnaire_preview,
        name="questionnaire_preview",
    ),
    # 活动
    path("activities/", views.activities, name="activities"),
    path("activities/new/", views.activity_new, name="activity_new"),
    path("activities/<uuid:version_id>/", views.activity_edit, name="activity_edit"),
    path(
        "activities/<uuid:version_id>/preview/",
        views.activity_preview,
        name="activity_preview",
    ),
    # 报告与任务
    path("reports/", views.reports, name="reports"),
    path("reports/<uuid:report_id>/", views.report_detail, name="report_detail"),
    path("jobs/", views.jobs, name="jobs"),
    path("jobs/<uuid:job_id>/", views.job_detail, name="job_detail"),
    # CA 账户（只读）
    path("ca-accounts/", views.ca_accounts, name="ca_accounts"),
    # 服务事项
    path("services/", views.services, name="services"),
    path("services/<uuid:request_id>/", views.service_detail, name="service_detail"),
    # 账号与审计
    path("accounts/", views.accounts, name="accounts"),
    path("accounts/new/", views.account_new, name="account_new"),
    path("accounts/<uuid:user_id>/", views.account_detail, name="account_detail"),
    path(
        "accounts/<uuid:user_id>/reset-password/",
        views.account_reset_password,
        name="account_reset_password",
    ),
    path("audit/", views.audit_log, name="audit"),
    # JSON 动作（同源、会话 + CSRF）
    path("api/questionnaires", api.questionnaire_create, name="api_questionnaire_create"),
    path(
        "api/questionnaires/<uuid:version_id>",
        api.questionnaire_save,
        name="api_questionnaire_save",
    ),
    path(
        "api/questionnaires/<uuid:version_id>/check",
        api.questionnaire_check,
        name="api_questionnaire_check",
    ),
    path(
        "api/questionnaires/<uuid:version_id>/copy",
        api.questionnaire_copy,
        name="api_questionnaire_copy",
    ),
    path(
        "api/questionnaires/<uuid:version_id>/retire",
        api.questionnaire_retire,
        name="api_questionnaire_retire",
    ),
    path("api/activities", api.activity_create, name="api_activity_create"),
    path("api/activities/<uuid:version_id>", api.activity_save, name="api_activity_save"),
    path(
        "api/activities/<uuid:version_id>/check",
        api.activity_check,
        name="api_activity_check",
    ),
    path(
        "api/activities/<uuid:version_id>/copy",
        api.activity_copy,
        name="api_activity_copy",
    ),
    path(
        "api/activities/<uuid:version_id>/retire",
        api.activity_retire,
        name="api_activity_retire",
    ),
    path("api/families/<uuid:family_id>/status", api.family_status, name="api_family_status"),
    path("api/children/<uuid:child_id>", api.child_profile, name="api_child_profile"),
]
