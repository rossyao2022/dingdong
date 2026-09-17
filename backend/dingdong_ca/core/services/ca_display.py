"""四个展示面（人设 / 周期成长报告 / 健康度 / 复测）的唯一数据出口。

设计见 `.trellis/tasks/T-021/design.md`。三条纪律：

1. 家长端一律以 `child_id` 为键，`ca_account_id` 不出现在任何响应里；
2. `availability` 复用 `core/api/growth.py` 的 7 值词表，不新造第二套状态词；
3. 合成数据源**零出站**；真源未配置时返回 `not_synced` + `upstream_not_configured`，
   不伪造成功、不显示 0 分。

真源模式目前**没有本地缓存**，所以 `stale`（"显示上次成功同步的数据"）只在合成
数据源下可达（合成故障 + 已有 fixture）。要支持真源的 stale 需要落一份缓存，
属后续任务，不在本任务范围内。
"""

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from dingdong_ca.core.api.common import ApiError, audit
from dingdong_ca.core.ca_models import CaAccount, CaReassessmentEvent
from dingdong_ca.core.models import ConsentGrant
from dingdong_ca.testsupport.models import TestFixture

from . import dingdong_client
from .dingdong_client import BUSINESS_CODES, EMPTY_CODE, DingDongError, DingDongNotConfigured

SOURCE = "dingdong"
SYNTHETIC_SOURCE = "synthetic_fixture"
UPSTREAM_SOURCE = "dingdong"
SYNC_PURPOSE = "dingdong_sync"

# fixture 载体：沿用 testsupport 的自然键，dataset 与其它合成输入一致。
FIXTURE_DATASET = "phase1-v1"
PERSONA_KIND = "ca_display_persona"
GROWTH_KIND = "ca_display_growth"
HEALTH_KIND = "ca_display_health"
REASSESSMENT_KIND = "ca_display_reassessment"
FAULT_KIND = "ca_display_fault"

# 八维成长代理的固定顺序（表 3.5 的字段顺序）；界面按这个顺序渲染条形。
GROWTH_DIMENSIONS = (
    "linguistic",
    "logical",
    "musical",
    "spatial",
    "bodily",
    "intrapersonal",
    "interpersonal",
    "naturalistic",
)

# 八维的中文名（对方 `*_growth` 字段注释：语言 / 逻辑 / 音乐 / 空间 / 实践 /
# 自我认知 / 人际 / 自然成长代理）。与 `stage_label` 同一做法：映射表在后端，
# 前端不维护第二套；键集与 `GROWTH_DIMENSIONS` 一致。
GROWTH_DIMENSION_LABELS = {
    "linguistic": "语言成长代理",
    "logical": "逻辑成长代理",
    "musical": "音乐成长代理",
    "spatial": "空间成长代理",
    "bodily": "实践成长代理",
    "intrapersonal": "自我认知成长代理",
    "interpersonal": "人际成长代理",
    "naturalistic": "自然成长代理",
}

PERIODS = {"15d": 15, "30d": 30}
# 健康度四态。表 3.6 的枚举漏了 insufficient_data（表 7.1 H01 会产出它），
# 这里以表 7.1 为准；未知取值一律落到"不做判断"分支。
HEALTH_STATUSES = ("insufficient_data", "normal", "watch", "reassess")
NOT_JUDGED = "insufficient_data"
# 表 7.2：新角色领先当前角色多少才建议切换。V1 固定不自动切换。
SWITCH_MATCH_DELTA = 15

PERSONA_TYPE_LABELS = {
    "art": "艺术",
    "science": "科学",
    "engineering": "工程",
    "philosophy": "哲学",
    "language": "语言",
    "social": "社交",
}
ENGAGEMENT_STAGE_LABELS = {
    "initial": "起步",
    "exploring": "探索",
    "developing": "成长",
    "deep": "深入",
    "co_creation": "共创",
}
TRIGGER_REASON_LABELS = {
    "low_engagement": "近期互动偏少",
    "continuous_low_engagement": "连续多期互动偏少",
}
# 学习风格取值的中文对照。对方 code 表还没确认（澄清清单确认级 C6），这里按取值
# 直译给家长看，原始 code 由前端放进 `title`；不在表里的取值给 null，前端不猜。
LEARNING_STYLE_LABELS = {
    "imitation": "模仿",
    "open": "开放",
    "reverse": "逆向",
    "cognitive": "认知",
}
# 回写出站失败的家长端说法。设计 §3.3 要求 `40901` 在复测回写场景给一句
# 明确提示，不静默吞掉；这里按业务码映射成中文，内部码不出现在响应里。
SYNC_ERROR_LABELS = {
    "40901": "这次复测的状态已经变了，请刷新页面",
    "40101": "机器人服务鉴权失败，暂时无法同步",
    "40001": "回写被机器人服务拒绝，我们会在后台重试",
    "NOT_CONFIGURED": "机器人数据服务尚未接通，稍后自动重试",
}
SYNC_ERROR_DEFAULT = "回写还没同步到机器人服务，我们会在后台重试"


def sync_error_label(code):
    return SYNC_ERROR_LABELS.get(code, SYNC_ERROR_DEFAULT) if code else None


def synthetic_mode():
    return settings.CA_DISPLAY_DATA_SOURCE == SYNTHETIC_SOURCE


def data_origin():
    return "synthetic" if synthetic_mode() else "live"


def degrade(code, has_data):
    """把一次出站失败的处置翻译成家长端可见的可用性。

    与 `growth.py` 的口径一致：有数据 + 出错 → `stale`（显示上次成功的数据）；
    没数据 → `error`；对方明确"资源不存在"（40401 / HTTP 404）当 `no_data`。
    """
    code = str(code)
    action = BUSINESS_CODES.get(code, ("", "fatal"))[1]
    if action == "empty":
        return "no_data", code
    if has_data:
        return "stale", code
    return "error", code


def _envelope(availability, reason):
    return {
        "availability": availability,
        "data_origin": data_origin(),
        "source": SOURCE,
        "fetched_at": timezone.now().isoformat(),
        "reason": reason,
    }


def _fixture(account, kind):
    row = (
        TestFixture.objects.filter(
            dataset=FIXTURE_DATASET, kind=kind, subject_key=account.ca_account_id
        )
        .order_by("-sequence")
        .first()
    )
    return row.payload if row else None


def _growth_fixture(account, days):
    rows = TestFixture.objects.filter(
        dataset=FIXTURE_DATASET, kind=GROWTH_KIND, subject_key=account.ca_account_id
    ).order_by("sequence")
    for row in rows:
        if row.payload.get("period", {}).get("days") == days:
            return row.payload
    return None


def _fault(account):
    row = (
        TestFixture.objects.filter(
            dataset=FIXTURE_DATASET, kind=FAULT_KIND, subject_key=account.ca_account_id
        )
        .order_by("-sequence")
        .first()
    )
    return str(row.payload.get("code")) if row else None


def _upstream(account, path, *, query=None, payload=None, method="GET", request_id=None):
    params = {"ca_account_id": account.ca_account_id, **(query or {})}
    return dingdong_client.call(method, path, payload=payload, query=params, request_id=request_id)


def _read(account, *, fixture_loader, upstream_loader, empty_reason):
    """取一个面的原始数据，返回 `(payload, availability, reason)`。"""
    if synthetic_mode():
        payload = fixture_loader()
        code = _fault(account)
        if code:
            return (payload, *degrade(code, payload is not None))
        if payload is None:
            return None, "no_data", empty_reason
        return payload, "ready", None
    try:
        return upstream_loader(), "ready", None
    except DingDongNotConfigured:
        return None, "not_synced", "upstream_not_configured"
    except DingDongError as exc:
        # 契约里"没有待处理建议"就是 404（表 4：200/404），不是错误。
        code = EMPTY_CODE if exc.http_status == 404 else exc.code
        return None, *degrade(code, False)


def _resolve(child):
    """四个面共用的起点：活跃账户、用途授权、真源是否接通。

    返回 `(account, blocked)`；`blocked` 为 `(availability, reason)` 时表示
    不必再去取数。
    """
    account = CaAccount.objects.filter(child=child, status="active").first()
    if account is None:
        return None, ("unbound", None)
    if not ConsentGrant.objects.filter(
        child=child, purpose=SYNC_PURPOSE, revoked_at__isnull=True
    ).exists():
        return account, ("no_consent", "consent_required")
    if not synthetic_mode() and not dingdong_client.is_configured():
        return account, ("not_synced", "upstream_not_configured")
    return account, None


def _response(blocked, **payload):
    availability, reason = blocked
    return {**_envelope(availability, reason), **payload}


def _usable(availability):
    """`stale` 也带着上次成功的数据，界面要显示（并标注"上次成功"）。"""
    return availability in ("ready", "stale")


# --- 面一：人设 -------------------------------------------------------------


def _persona_out(payload):
    persona = payload.get("persona")
    if persona:
        tags = persona.get("learning_style_tags") or []
        persona = {
            **persona,
            "type_label": PERSONA_TYPE_LABELS.get(persona.get("persona_type")),
            # 与 tags 同序同长；未知取值给 null，界面用「未识别取值」兜住。
            "learning_style_labels": [LEARNING_STYLE_LABELS.get(tag) for tag in tags],
        }
    binding = payload.get("binding")
    if binding:
        binding = {k: binding.get(k) for k in ("binding_id", "bind_time", "match_score", "status")}
    return persona, binding


def persona_view(child):
    account, blocked = _resolve(child)
    if blocked:
        return _response(blocked, persona=None, binding=None, persona_switched=False)
    payload, availability, reason = _read(
        account,
        fixture_loader=lambda: _fixture(account, PERSONA_KIND),
        upstream_loader=lambda: _upstream(account, "/api/v1/ca/persona/current"),
        empty_reason="no_persona",
    )
    persona = binding = None
    if payload and _usable(availability):
        persona, binding = _persona_out(payload)
    return _response(
        (availability, reason),
        persona=persona,
        binding=binding,
        # V1 没有自动切换路径；只有家长确认后我方才会落这个标记。
        persona_switched=CaReassessmentEvent.objects.filter(
            ca_account=account, persona_switched=True
        ).exists(),
    )


# --- 面二：15 / 30 天成长报告 ------------------------------------------------


def growth_empty_reason(account):
    """区分两种空态：周期还没走完 vs 对方确实没有这个周期。"""
    return (
        "period_incomplete" if (timezone.now() - account.bound_at).days < 15 else "no_period_data"
    )


def _growth_out(payload):
    engagement = payload.get("engagement") or {}
    stage = engagement.get("stage")
    return {
        "period": payload.get("period"),
        "persona": payload.get("persona"),
        "companion": payload.get("companion"),
        "engagement": {**engagement, "stage_label": ENGAGEMENT_STAGE_LABELS.get(stage)},
        # 八维固定顺序；缺失维度给 null，不补 0、不插值。
        "growth_dimensions": {
            key: (payload.get("growth_dimensions") or {}).get(key) for key in GROWTH_DIMENSIONS
        },
        # 八维中文名，键与 `growth_dimensions` 同序同集；前端不硬编码映射。
        "growth_dimension_labels": {
            key: GROWTH_DIMENSION_LABELS.get(key) for key in GROWTH_DIMENSIONS
        },
        "algorithm_version": payload.get("algorithm_version"),
        "generated_at": payload.get("generated_at"),
    }


def growth_view(child, days):
    account, blocked = _resolve(child)
    empty = {
        "period": None,
        "persona": None,
        "companion": None,
        "engagement": None,
        "growth_dimensions": None,
        "growth_dimension_labels": None,
        "algorithm_version": None,
        "generated_at": None,
    }
    if blocked:
        return _response(blocked, **empty)
    payload, availability, reason = _read(
        account,
        fixture_loader=lambda: _growth_fixture(account, days),
        upstream_loader=lambda: _upstream(
            account, "/api/v1/ca/growth/profile", query={"period": str(days) + "d"}
        ),
        empty_reason=growth_empty_reason(account),
    )
    if not payload or not _usable(availability):
        return _response((availability, reason), **empty)
    return _response((availability, reason), **_growth_out(payload))


# --- 面三：互动健康度 -------------------------------------------------------


def _health_out(payload, reason):
    health = dict(payload.get("health") or {})
    if health.get("status") not in HEALTH_STATUSES:
        # 未知枚举值不猜、不按 normal 展示，落"不做判断"分支并记明细码。
        # 判断不了就不该出复测 CTA，所以推荐位一并归零，不把矛盾负载递给界面。
        health["status"] = NOT_JUDGED
        health["reassessment_recommended"] = False
        reason = reason or "unknown_health_status"
    health["trigger_label"] = TRIGGER_REASON_LABELS.get(health.get("trigger_reason"))
    return health, reason


def health_view(child):
    account, blocked = _resolve(child)
    if blocked:
        return _response(blocked, health=None)
    payload, availability, reason = _read(
        account,
        fixture_loader=lambda: _fixture(account, HEALTH_KIND),
        upstream_loader=lambda: _upstream(account, "/api/v1/ca/persona/health"),
        empty_reason="no_health_data",
    )
    if not payload or not _usable(availability):
        return _response((availability, reason), health=None)
    health, reason = _health_out(payload, reason)
    return _response((availability, reason), health=health)


# --- 面四：复测建议与回写 ---------------------------------------------------


def _event_from(payload):
    """复测面的原始负载：合成侧是 `{event, completion}`，对方侧直接给事件对象。"""
    if not payload:
        return None
    return payload.get("event") if synthetic_mode() else payload


def _reassessment_payload(account):
    if synthetic_mode():
        return _fixture(account, REASSESSMENT_KIND)
    try:
        return _upstream(account, "/api/v1/ca/reassessment/current")
    except DingDongError as exc:
        code = EMPTY_CODE if exc.http_status == 404 else exc.code
        raise ApiError(*_event_error(code)) from None


def _local_event(account, event_id):
    """取（必要时按对方给的事件建）本地复测事件行。"""
    event = CaReassessmentEvent.objects.filter(ca_account=account, event_id=event_id).first()
    if event:
        return event
    raw = _event_from(_reassessment_payload(account))
    if not raw or raw.get("event_id") != event_id:
        raise ApiError("REASSESSMENT_UNKNOWN", 404, "复测建议不存在或已失效")
    recommended_at = parse_datetime(raw.get("recommended_at") or "")
    if recommended_at is None:
        raise ApiError("UPSTREAM_UNAVAILABLE", 503, "暂时取不到复测建议，我们会在后台重试")
    return CaReassessmentEvent.objects.create(
        event_id=raw["event_id"],
        ca_account=account,
        child=account.child,
        trigger_type=raw["trigger_type"],
        recommended_at=recommended_at,
        old_profile_id=raw.get("old_profile_id"),
        old_persona_id=raw.get("old_persona_id"),
    )


def _event_error(code):
    availability, _ = degrade(code, False)
    if availability == "no_data":
        return "REASSESSMENT_UNKNOWN", 404, "复测建议不存在或已失效"
    return "UPSTREAM_UNAVAILABLE", 503, "暂时取不到复测建议，我们会在后台重试"


def _event_out(event):
    return {
        "event_id": event.event_id,
        "old_profile_id": event.old_profile_id,
        "old_persona_id": event.old_persona_id,
        "trigger_type": event.trigger_type,
        "trigger_label": TRIGGER_REASON_LABELS.get(event.trigger_type),
        "recommended_at": event.recommended_at.isoformat(),
        "accepted": event.accepted,
        "new_assessment_id": event.new_assessment_id,
        "new_profile_id": event.new_profile_id,
        "new_persona_id": (event.result or {}).get("new_persona_id"),
        "persona_switched": event.persona_switched,
    }


EVENT_FIELDS = (
    "event_id",
    "old_profile_id",
    "old_persona_id",
    "trigger_type",
    "accepted",
    "recommended_at",
    "new_assessment_id",
    "new_profile_id",
    "new_persona_id",
    "persona_switched",
)


def _event_shape(raw):
    """只留契约里的字段，并补后端映射的中文触发原因。

    对方给的是 code（`low_engagement` 等），家长端不该看到英文码（与 T-013 去掉
    `readable-v2` 同一纪律）；上游多带的字段也不透给浏览器。
    """
    event = {key: raw.get(key) for key in EVENT_FIELDS}
    event["trigger_label"] = TRIGGER_REASON_LABELS.get(raw.get("trigger_type"))
    return event


def reassessment_view(child):
    account, blocked = _resolve(child)
    if blocked:
        return _response(blocked, event=None)
    payload, availability, reason = _read(
        account,
        fixture_loader=lambda: _fixture(account, REASSESSMENT_KIND),
        upstream_loader=lambda: _upstream(account, "/api/v1/ca/reassessment/current"),
        empty_reason="no_pending_event",
    )
    if not payload or not _usable(availability):
        return _response((availability, reason), event=None)
    raw = _event_from(payload) or {}
    local = CaReassessmentEvent.objects.filter(
        ca_account=account, event_id=raw.get("event_id")
    ).first()
    if local:
        # 我方状态是权威：家长回写后即使对方还是旧值，也要显示已处理。
        raw = {**raw, **_event_out(local)}
    return _response((availability, reason), event=_event_shape(raw) if raw else None)


def _write_account(child):
    account = CaAccount.objects.filter(child=child, status="active").first()
    if account is None:
        raise ApiError("REASSESSMENT_UNKNOWN", 404, "复测建议不存在或已失效")
    if not ConsentGrant.objects.filter(
        child=child, purpose=SYNC_PURPOSE, revoked_at__isnull=True
    ).exists():
        raise ApiError("CONSENT_REQUIRED", 403, "尚未同意机器人数据同步用途")
    return account


def _sync_out(event, *, method, path, payload, request_id):
    """出站同步：合成数据源零出站；失败只落 pending 标记，不改本地已落库的状态。

    返回 `(还没同步成功, 对方返回的 data)`。契约里没有单独的「读结果」接口，
    所以调用方只能拿这一次出站返回的 data 当结果，不能再 POST 一遍同一个端点。
    """
    if synthetic_mode():
        return False, None
    if not dingdong_client.is_configured():
        CaReassessmentEvent.objects.filter(pk=event.pk).update(
            pending_sync=True, last_error="NOT_CONFIGURED"
        )
        return True, None
    try:
        data = dingdong_client.call(method, path, payload=payload, request_id=request_id)
    except DingDongError as exc:
        CaReassessmentEvent.objects.filter(pk=event.pk).update(
            pending_sync=True, last_error=exc.code
        )
        return True, None
    CaReassessmentEvent.objects.filter(pk=event.pk).update(pending_sync=False, last_error=None)
    return False, dict(data or {})


def _sync_state(event):
    """`(还没同步成功, 家长端说法)`。本地已落库的状态不受出站结果影响。"""
    pending, error = CaReassessmentEvent.objects.filter(pk=event.pk).values_list(
        "pending_sync", "last_error"
    )[0]
    return pending, sync_error_label(error)


def respond(child, event_id, accepted, request_id, user):
    account = _write_account(child)
    event = _local_event(account, event_id)
    if event.accepted is not None:
        if event.accepted != accepted:
            raise ApiError(
                "REASSESSMENT_ALREADY_ANSWERED", 422, "这次复测建议已经处理过了，请刷新页面"
            )
        pending, error = _sync_state(event)
        return {
            "event_id": event.event_id,
            "accepted": event.accepted,
            "data_origin": data_origin(),
            "source": SOURCE,
            "sync_pending": pending,
            "sync_error": error,
        }
    with transaction.atomic():
        row = CaReassessmentEvent.objects.select_for_update().get(pk=event.pk)
        row.accepted = accepted
        row.responded_at = timezone.now()
        row.response_request_key = request_id
        row.save(
            update_fields=[
                "accepted",
                "responded_at",
                "response_request_key",
                "updated_at",
            ]
        )
        audit(user, "ca_reassessment.response", row, detail={"accepted": accepted})
    # 网络调用放事务外：不为一次回写把行锁和事务一起拖住。
    _sync_out(
        row,
        method="POST",
        path="/api/v1/ca/reassessment/" + row.event_id + "/response",
        payload={"accepted": accepted},
        request_id=request_id,
    )
    # 同步状态从库里重读：`_sync_out` 用 queryset.update 写，内存里的 row 是旧值。
    pending, error = _sync_state(row)
    return {
        "event_id": row.event_id,
        "accepted": row.accepted,
        "data_origin": data_origin(),
        "source": SOURCE,
        "sync_pending": pending,
        "sync_error": error,
    }


def _with_switch_verdict(result):
    """表 7.2 的 switch_match_delta 是建议切换的阈值；对方没给判断时按它算。"""
    if result.get("switch_recommended") is None and result.get("match_delta") is not None:
        result["switch_recommended"] = result["match_delta"] >= SWITCH_MATCH_DELTA
    return result


def _fixture_completion(account):
    """合成数据源下的复测结果：表 5 示例③ 的 completion 段。"""
    result = (_fixture(account, REASSESSMENT_KIND) or {}).get("completion")
    if not result:
        raise ApiError("UPSTREAM_UNAVAILABLE", 503, "暂时取不到复测结果，我们会在后台重试")
    return _with_switch_verdict(dict(result))


def complete(child, event_id, assessment_id, request_id, user):
    account = _write_account(child)
    event = _local_event(account, event_id)
    if event.accepted is not True:
        raise ApiError("REASSESSMENT_NOT_ACCEPTED", 422, "还没有确认要重新测评")
    if event.new_assessment_id is not None:
        if event.new_assessment_id != assessment_id:
            raise ApiError("REASSESSMENT_ALREADY_ANSWERED", 422, "这次复测已经回写过了，请刷新页面")
        return _complete_body(event)
    # 合成侧结果来自 fixture；真源侧结果由下面那一次出站 POST 返回。
    result = _fixture_completion(account) if synthetic_mode() else {}
    with transaction.atomic():
        row = CaReassessmentEvent.objects.select_for_update().get(pk=event.pk)
        row.new_assessment_id = assessment_id
        row.new_profile_id = result.get("new_profile_id")
        row.completed_at = timezone.now()
        row.complete_request_key = request_id
        row.result = result
        # V1 恒不自动切换：这里只落建议，persona_switched 仍由家长确认后写。
        row.save(
            update_fields=[
                "new_assessment_id",
                "new_profile_id",
                "completed_at",
                "complete_request_key",
                "result",
                "updated_at",
            ]
        )
        audit(user, "ca_reassessment.complete", row, detail={"assessment_id": assessment_id})
    _, data = _sync_out(
        row,
        method="POST",
        path="/api/v1/ca/reassessment/" + row.event_id + "/complete",
        payload={"new_assessment_id": assessment_id},
        request_id=request_id,
    )
    if data:
        # 对方返回的新角色建议回填本地：重放与后续读取都不必再问对方一次。
        row.result = {**result, **_with_switch_verdict(data)}
        row.new_profile_id = row.result.get("new_profile_id")
        CaReassessmentEvent.objects.filter(pk=row.pk).update(
            result=row.result, new_profile_id=row.new_profile_id
        )
    return _complete_body(row)


def _complete_body(event):
    result = event.result or {}
    pending, error = _sync_state(event)
    return {
        "event_id": event.event_id,
        "new_persona_id": result.get("new_persona_id"),
        "new_persona_name": result.get("new_persona_name"),
        "match_score": result.get("match_score"),
        "current_persona_match_score": result.get("current_persona_match_score"),
        "match_delta": result.get("match_delta"),
        "switch_recommended": result.get("switch_recommended"),
        # 表 7.2 的 auto_switch 在 V1 固定 false；这里显式回传，让"不自动切换"
        # 这条不变量在接口边界上可断言。
        "auto_switch": False,
        "data_origin": data_origin(),
        "source": SOURCE,
        "sync_pending": pending,
        "sync_error": error,
    }
