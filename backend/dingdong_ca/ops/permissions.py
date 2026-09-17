"""运营后台的角色与权限。

两件事必须区分清楚：
1. 能不能进后台（staff 身份）；
2. 进来之后能做什么（角色）。
服务端在每个页面和每个动作上都重新判断，前端隐藏菜单只是体验，不是权限。
"""

from functools import wraps

from django.contrib.auth.views import redirect_to_login
from django.http import Http404
from django.shortcuts import resolve_url

# 角色代码 -> 运营可见名称
ROLE_LABELS = {
    "account_admin": "管理员",
    "operations": "运营",
    "content": "内容运营",
    "technical": "技术运维",
}

# 建议的账号组合，账号管理页直接展示给管理员
ROLE_PRESETS = [
    ("operations", "运营专员", ["operations"]),
    ("operations_content", "运营专员（含题库活动）", ["operations", "content"]),
    ("content", "内容运营", ["content"]),
    ("technical", "技术运维", ["technical"]),
    ("account_admin", "管理员（全部权限）", ["account_admin"]),
]

# 权限点 -> 允许的角色
PERMISSIONS = {
    "dashboard.view": {"operations", "content", "technical", "account_admin"},
    "family.view": {"operations", "technical", "account_admin"},
    "family.edit": {"operations", "account_admin"},
    "child.view": {"operations", "technical", "account_admin"},
    "child.edit": {"operations", "account_admin"},
    "questionnaire.view": {"content", "account_admin"},
    "questionnaire.edit": {"content", "account_admin"},
    "activity.view": {"content", "account_admin"},
    "activity.edit": {"content", "account_admin"},
    "report.view": {"operations", "technical", "account_admin"},
    "report.retry": {"technical", "account_admin"},
    "job.view": {"technical", "account_admin"},
    "association.manage": {"technical", "account_admin"},
    "ca_account.view": {"operations", "technical", "account_admin"},
    "service.view": {"operations", "technical", "account_admin"},
    "service.handle": {"operations", "technical", "account_admin"},
    "service.delete": {"technical", "account_admin"},
    "audit.view": {"operations", "technical", "account_admin"},
    "account.manage": {"account_admin"},
}

# 导航：标题 -> (权限点, 视图名, 分组, 图标)
# 图标只做辅助识别，不替代文字标签（Tabler Icons 类名，见 static/ops/vendor）。
NAVIGATION = [
    ("工作首页", "dashboard.view", "ops:dashboard", "日常", "ti-layout-dashboard"),
    ("家庭与儿童", "family.view", "ops:families", "日常", "ti-users"),
    ("服务事项", "service.view", "ops:services", "日常", "ti-lifebuoy"),
    ("报告管理", "report.view", "ops:reports", "日常", "ti-file-analytics"),
    ("题库管理", "questionnaire.view", "ops:questionnaires", "内容", "ti-list-check"),
    ("活动管理", "activity.view", "ops:activities", "内容", "ti-balloon"),
    ("生成任务", "job.view", "ops:jobs", "技术", "ti-refresh-dot"),
    # 与生成任务同组，regroup 依赖列表按组有序，插在别的组里会重复出现组标题
    ("CA 账户", "ca_account.view", "ops:ca_accounts", "技术", "ti-robot"),
    ("账号与权限", "account.manage", "ops:accounts", "管理", "ti-shield-lock"),
    ("操作审计", "audit.view", "ops:audit", "管理", "ti-history"),
]


def is_ops_staff(user):
    return bool(
        user
        and user.is_authenticated
        and user.is_active
        and user.is_staff
        and getattr(user, "account_kind", None) == "staff"
    )


def roles_for(user):
    if not is_ops_staff(user):
        return set()
    if user.is_superuser:
        return set(ROLE_LABELS)
    return set(user.groups.values_list("name", flat=True))


def has_permission(user, permission):
    allowed = PERMISSIONS.get(permission)
    if not allowed:
        return False
    roles = roles_for(user)
    return bool(roles & allowed)


def role_labels(user):
    roles = roles_for(user)
    if not roles:
        return ["未分配角色"]
    return [ROLE_LABELS.get(code, code) for code in sorted(roles, key=list(ROLE_LABELS).index)]


def navigation(user):
    items = []
    for title, permission, view, group, icon in NAVIGATION:
        if has_permission(user, permission):
            items.append({"title": title, "view": view, "group": group, "icon": icon})
    return items


def ops_page(permission):
    """页面视图装饰器：先要求工作人员登录，再要求具体权限。

    权限不足时直接渲染"权限不足"页（403），而不是抛异常交给全局 handler，
    这样不会影响家长端 API 的既有 404/403 契约。

    详情页找不到记录时（`get_object_or_404`）同样在这里兜住：全局 handler404
    只在 DEBUG=False 时生效，本地开发下会退回 Django 调试页，把 URL 配置和
    内部路径暴露给运营。统一在这里渲染"记录不存在"页，两种模式表现一致。
    """

    def decorate(view):
        @wraps(view)
        def wrapped(request, *args, **kwargs):
            from .responses import forbidden, not_found

            if not is_ops_staff(request.user):
                return redirect_to_login(request.get_full_path(), resolve_url("ops:login"), "next")
            if not has_permission(request.user, permission):
                return forbidden(request, f"当前账号的角色不能访问该功能（需要：{permission}）。")
            request.ops_roles = roles_for(request.user)
            try:
                return view(request, *args, **kwargs)
            except Http404:
                return not_found(request, "记录不存在或已被删除，请返回列表重新选择。")

        return wrapped

    return decorate
