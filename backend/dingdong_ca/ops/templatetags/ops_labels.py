"""模板过滤器：把内部代码翻译成运营看得懂的中文，避免在模板里写 if 链。"""

from django import template

from dingdong_ca.ops import labels as L

register = template.Library()

# 允许模板直接引用的映射表
MAPS = {
    "FAMILY_STATUS": L.FAMILY_STATUS,
    "CHILD_STATUS": L.CHILD_STATUS,
    "GENDER": L.GENDER,
    "QUESTIONNAIRE_PURPOSE": L.QUESTIONNAIRE_PURPOSE,
    "CONTENT_STATUS": L.CONTENT_STATUS,
    "DATA_ORIGIN": L.DATA_ORIGIN,
    "QUESTION_TYPE": L.QUESTION_TYPE,
    "ACTIVITY_STYLE": L.ACTIVITY_STYLE,
    "ACTIVITY_RECORD_STATUS": L.ACTIVITY_RECORD_STATUS,
    "ASSESSMENT_STATUS": L.ASSESSMENT_STATUS,
    "PROFILE_KIND": L.PROFILE_KIND,
    "ASSOCIATION_STATUS": L.ASSOCIATION_STATUS,
    "CHECKPOINT_STATUS": L.CHECKPOINT_STATUS,
    "SERVICE_KIND": L.SERVICE_KIND,
    "SERVICE_REASON": L.SERVICE_REASON,
    "SERVICE_STATUS": L.SERVICE_STATUS,
    "SERVICE_RESOLUTION": L.SERVICE_RESOLUTION,
    "JOB_STATUS": L.JOB_STATUS,
    "JOB_KIND": L.JOB_KIND,
    "CONSENT_PURPOSE": L.CONSENT_PURPOSE,
    "TARGET_KIND": L.TARGET_KIND,
}

STATUS_TONE = {
    "draft": "badge-muted",
    "published": "badge-ok",
    "retired": "badge-muted",
    "active": "badge-ok",
    "frozen": "badge-warn",
    "closed": "badge-muted",
    "archived": "badge-muted",
    "completed": "badge-ok",
    "succeeded": "badge-ok",
    "failed": "badge-danger",
    "cancelled": "badge-muted",
    "skipped": "badge-muted",
    "open": "badge-warn",
    "processing": "badge-accent",
    "pending": "badge-accent",
    "running": "badge-accent",
    "waiting": "badge-warn",
    "unknown": "badge-warn",
    "verified": "badge-ok",
    "revoked": "badge-muted",
    "paused": "badge-warn",
    "enabled": "badge-ok",
    "expired": "badge-muted",
    "needs_recapture": "badge-warn",
    "result_unknown": "badge-warn",
    "ready": "badge-accent",
}


@register.filter
def label(value, mapping_name):
    return L.label(MAPS.get(mapping_name, {}), value)


@register.filter
def tone(value):
    return STATUS_TONE.get(value, "badge-muted")


@register.filter
def audit_action(value):
    """操作名。代码里新增动作却忘了加中文时，这里也要给出可读结果。

    只用 L.AUDIT_ACTION.get(value, value) 会在页面上直接显示
    `assessment.create` 这类英文代码，运营看不懂。兜底策略是尽量把它
    拆成可读形式，同时由测试保证所有动作都有正式中文。
    """
    return L.AUDIT_ACTION.get(value) or L.humanize_action(value)


@register.filter
def audit_detail(value):
    """把审计 detail 字典渲染成"中文键：中文值"的短句列表。

    不能直接输出原始键值：键是英文内部名，值里可能有 UUID。
    """
    if not value:
        return []
    if not isinstance(value, dict):
        return [L.humanize_value(value)]
    return [
        f"{L.DETAIL_KEY.get(key, key)}：{L.humanize_value(item)}" for key, item in value.items()
    ]


@register.filter
def short_ref(value):
    """内部编号只给前 8 位。运营报障时需要引用，但不需要看完整 UUID。"""
    if not value:
        return "—"
    return f"编号 {str(value)[:8]}"


@register.filter
def job_reason(value):
    return L.job_error(value)[0]


@register.filter
def job_advice(value):
    return L.job_error(value)[1]


@register.filter
def job_retryable(value):
    return L.job_error(value)[2]


@register.filter
def display_name(value, fallback="系统"):
    """安全地取一个账号的展示名：姓名 → 用户名 → 兜底文字。

    不要写成 `{{ user.name|default:user.username|default:"系统" }}`：
    default 的参数会被提前求值，user 为 None 时会抛 VariableDoesNotExist，
    把整个页面变成 500。审计记录的操作人是可空的，必须在这里兜住。
    """
    if value is None:
        return fallback
    return getattr(value, "name", "") or getattr(value, "username", "") or fallback


@register.filter
def version_name(value, fallback="—"):
    """报告模板版本的展示名：模板标题 → 版本代码 → 占位符。"""
    if value is None:
        return fallback
    template = getattr(value, "template", None) or {}
    if isinstance(template, dict):
        title = template.get("title", "")
    else:
        title = getattr(template, "title", "")
    return title or getattr(value, "code", "") or fallback
