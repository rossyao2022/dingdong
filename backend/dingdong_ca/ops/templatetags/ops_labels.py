"""模板过滤器：把内部代码翻译成运营看得懂的中文，避免在模板里写 if 链。"""

import re
from functools import lru_cache

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
    "ACTIVITY_ISLAND": L.ACTIVITY_ISLAND,
    "ACTIVITY_MOOD": L.ACTIVITY_MOOD,
    "FAMILY_ROLE": L.FAMILY_ROLE,
    "ACTIVITY_RECORD_STATUS": L.ACTIVITY_RECORD_STATUS,
    "ASSESSMENT_STATUS": L.ASSESSMENT_STATUS,
    "PROFILE_KIND": L.PROFILE_KIND,
    "ASSOCIATION_STATUS": L.ASSOCIATION_STATUS,
    "CHECKPOINT_STATUS": L.CHECKPOINT_STATUS,
    "CA_ACCOUNT_STATUS": L.CA_ACCOUNT_STATUS,
    "CA_ACCOUNT_BIND_STATE": L.CA_ACCOUNT_BIND_STATE,
    "SERVICE_KIND": L.SERVICE_KIND,
    "SERVICE_REASON": L.SERVICE_REASON,
    "SERVICE_STATUS": L.SERVICE_STATUS,
    "SERVICE_RESOLUTION": L.SERVICE_RESOLUTION,
    "JOB_STATUS": L.JOB_STATUS,
    "JOB_KIND": L.JOB_KIND,
    "CONSENT_PURPOSE": L.CONSENT_PURPOSE,
    "TARGET_KIND": L.TARGET_KIND,
}

# 状态 -> 颜色。取值是 Tabler/Bootstrap 的浅色底色工具类（bg-*-lt），
# 由组件库提供样式，本文件只负责"什么状态用什么颜色"这一个业务判断。
# 不要在这里写自定义 CSS 类名，否则颜色又回到各页面各自实现。
STATUS_TONE = {
    "draft": "bg-secondary-lt",
    "published": "bg-green-lt",
    "retired": "bg-secondary-lt",
    "active": "bg-green-lt",
    "frozen": "bg-yellow-lt",
    "closed": "bg-secondary-lt",
    "archived": "bg-secondary-lt",
    "completed": "bg-green-lt",
    "succeeded": "bg-green-lt",
    "failed": "bg-red-lt",
    "cancelled": "bg-secondary-lt",
    "skipped": "bg-secondary-lt",
    "open": "bg-yellow-lt",
    "processing": "bg-azure-lt",
    "pending": "bg-azure-lt",
    "running": "bg-azure-lt",
    "waiting": "bg-yellow-lt",
    "unknown": "bg-yellow-lt",
    "verified": "bg-green-lt",
    "revoked": "bg-secondary-lt",
    "paused": "bg-yellow-lt",
    "enabled": "bg-green-lt",
    "expired": "bg-secondary-lt",
    "needs_recapture": "bg-yellow-lt",
    "result_unknown": "bg-yellow-lt",
    "ready": "bg-teal-lt",
    # CA 账户的绑定状态：待接通是"还没接上"，用提示色而不是错误色
    "bound": "bg-green-lt",
    "unbound": "bg-yellow-lt",
}


@register.filter
def label(value, mapping_name):
    return L.label(MAPS.get(mapping_name, {}), value)


@register.filter
def known_label(value, mapping_name):
    """自由填写字段的中文优先显示：词表命中给中文，未命中原样返回。

    不能直接用 `label`：它把未命中的取值渲染成「未知（观察岛）」，而岛屿与情绪
    是运营自己填的自由文本（`Activity.island` / `mood` 没有 choices），把运营
    写的标签说成「未知」比显示原文更糟。
    """
    if not value:
        return "—"
    return MAPS.get(mapping_name, {}).get(value) or value


@register.filter
def tone(value):
    """状态 -> Tabler 浅色底色工具类。未知状态回退中性色，不显示成醒目颜色。"""
    return STATUS_TONE.get(value, "bg-secondary-lt")


@register.filter
def audit_target(value):
    """审计「对象」名。describe_target 的兜底写成「英文模型名（关联对象名）」，运营看不懂。"""
    return L.target_name(value, _model_names_by_verbose_name())


@lru_cache(maxsize=1)
def _model_names_by_verbose_name():
    """英文模型名 -> 中文对象词条。取自模型注册表，不手抄一份英文名。"""
    from django.apps import apps

    return {
        model._meta.verbose_name: L.TARGET_KIND[model._meta.db_table]
        for model in apps.get_models()
        if model._meta.db_table in L.TARGET_KIND
    }


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
    """安全地取一个账号的展示名：姓名 →（家长）手机号 → 用户名 → 兜底文字。

    不要写成 `{{ user.name|default:user.username|default:"系统" }}`：
    default 的参数会被提前求值，user 为 None 时会抛 VariableDoesNotExist，
    把整个页面变成 500。审计记录的操作人是可空的，必须在这里兜住。
    家长账号的 username 是 `parent-<uuid>` 内部标识，没填姓名时回落手机号，
    不给运营看内部账号。
    """
    if value is None:
        return fallback
    return getattr(value, "display_name", "") or fallback


@register.filter
def account_name(value, fallback="未填写"):
    """账号的姓名本身，不回落手机号。

    列表里「家长」与「手机号」是相邻两列时用这个：`display_name` 会在没填姓名时
    回落手机号，两列就重复同一个号码。需要手机号的地方仍用 `display_name`。
    """
    if value is None:
        return fallback
    return getattr(value, "name", "") or fallback


@register.filter
def version_label(value, fallback="—"):
    """内容版本代码的展示名：只留版本号（`readable-v2` → `v2`）。

    内部 code 不进正文；模板需要时自己把它放进 `title` 属性。
    """
    if not value:
        return fallback
    found = re.findall(r"v\d+(?:\.\d+)*", str(value), re.IGNORECASE)
    return found[-1] if found else str(value)


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
