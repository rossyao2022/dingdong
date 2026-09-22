"""四个展示面（人设 / 周期成长报告 / 健康度 / 复测）的合成输入。

一一对应《DingDong_CA_数据库字段与接口.xlsx》表 6 的 6 个 mock 账号，payload 保持
对方契约的原始形状，这样"界面该长什么样"有对方给的预期答案可对（表 6 最后一列）。

这里只放合成数据：不含 `nfc_token`、不含任何凭据、不含真实家庭数据。人设名与
公开描述里只有 `persona_art_01`（Mia）与 `persona_philosophy_01`（Socrates）在
原始材料中出现过，其余人设名是本文件为演示补的合成值。
"""

from dingdong_ca.core.services.ca_display import (
    FAULT_KIND,
    FIXTURE_DATASET,
    GROWTH_DIMENSIONS,
    GROWTH_KIND,
    HEALTH_KIND,
    PERSONA_KIND,
    REASSESSMENT_KIND,
)

from .models import TestFixture

DATASET = FIXTURE_DATASET

_PERSONAS = {
    "persona_art_01": ("Mia", "art", "艺术创作陪学伙伴", ["imitation", "open"]),
    "persona_science_01": ("Newton", "science", "科学探索陪学伙伴", ["cognitive"]),
    "persona_philosophy_01": ("Socrates", "philosophy", "哲学思辨陪学伙伴", ["reverse"]),
    "persona_language_01": ("Homer", "language", "语言表达陪学伙伴", ["open"]),
    "persona_science_02": ("Ada", "science", "科学实验陪学伙伴", ["cognitive", "reverse"]),
}


def persona_payload(persona_id, binding_id, match_score, bind_time, status="active"):
    name, kind, description, tags = _PERSONAS[persona_id]
    return {
        "persona": {
            "persona_id": persona_id,
            "persona_name": name,
            "persona_type": kind,
            "public_description": description,
            "learning_style_tags": tags,
            "talent_weight_version": "pw_v1",
        },
        "binding": {
            "binding_id": binding_id,
            "bind_time": bind_time,
            "match_score": match_score,
            "status": status,
        },
    }


def growth_payload(
    *,
    persona_id,
    match_score,
    days,
    start,
    end,
    companion_start,
    companion_end,
    index,
    stage,
    progress,
    dimensions,
    generated_at,
    profile_id,
):
    return {
        "profile_id": profile_id,
        "persona": {
            "persona_id": persona_id,
            "persona_name": _PERSONAS[persona_id][0],
            "persona_type": _PERSONAS[persona_id][1],
            "match_score": match_score,
        },
        "period": {"days": days, "start": start, "end": end},
        "companion": {
            "start": companion_start,
            "end": companion_end,
            "delta": companion_end - companion_start,
        },
        "engagement": {"index": index, "stage": stage, "stage_progress": progress},
        "growth_dimensions": dict(zip(GROWTH_DIMENSIONS, dimensions, strict=True)),
        "algorithm_version": "growth_v1",
        "generated_at": generated_at,
    }


def health_payload(
    *,
    health_id,
    persona_id,
    observation_days,
    companion_delta,
    health_score,
    status,
    recommended,
    trigger_reason,
    evaluated_at,
):
    return {
        "health": {
            "health_id": health_id,
            "persona_id": persona_id,
            "observation_days": observation_days,
            "companion_delta": companion_delta,
            "health_score": health_score,
            "status": status,
            "reassessment_recommended": recommended,
            "trigger_reason": trigger_reason,
            "evaluated_at": evaluated_at,
        }
    }


def event_payload(*, event_id, old_profile_id, old_persona_id, trigger_type, recommended_at):
    return {
        "event_id": event_id,
        "old_profile_id": old_profile_id,
        "old_persona_id": old_persona_id,
        "trigger_type": trigger_type,
        "recommended_at": recommended_at,
        "accepted": None,
        "new_assessment_id": None,
        "new_profile_id": None,
        "new_persona_id": None,
        "persona_switched": False,
    }


def reassessment_payload(event, completion):
    """复测面同时存两段：待处理事件（表 3.7）与复测完成结果（表 5 示例③）。"""
    return {"event": event, "completion": completion}


_ART_DIMS = [64, 48, 66, 62, 44, 57, 51, 42]
_SCIENCE_DIMS = [58, 79, 51, 74, 63, 66, 60, 71]
_PHILOSOPHY_DIMS = [61, 55, 47, 50, 41, 72, 68, 44]
_LOW_DIMS = [40, 52, 38, 47, 35, 44, 41, 39]
_SWITCH_DIMS = [55, 50, 60, 57, 43, 49, 46, 45]

# 场景名 -> fixture 行。growth 为 None 表示对方还没有该周期数据（新用户）。
DISPLAY_SCENARIOS = {
    "ca_display_normal_art": {
        "persona": persona_payload(
            "persona_art_01", "bind_mock_001", 82, "2026-09-01T02:05:00+08:00"
        ),
        "growth": [
            growth_payload(
                persona_id="persona_art_01",
                match_score=82,
                days=15,
                start="2026-09-01",
                end="2026-09-15",
                companion_start=12,
                companion_end=47,
                index=58.31,
                stage="developing",
                progress=55,
                dimensions=_ART_DIMS,
                generated_at="2026-09-16T00:10:00+08:00",
                profile_id="profile_mock_001",
            )
        ],
        "health": health_payload(
            health_id="health_mock_001",
            persona_id="persona_art_01",
            observation_days=15,
            companion_delta=35,
            health_score=82,
            status="normal",
            recommended=False,
            trigger_reason=None,
            evaluated_at="2026-09-15T16:10:00+08:00",
        ),
        "reassessment": None,
    },
    "ca_display_normal_science": {
        "persona": persona_payload(
            "persona_science_01", "bind_mock_002", 88, "2026-09-01T02:05:00+08:00"
        ),
        "growth": [
            growth_payload(
                persona_id="persona_science_01",
                match_score=88,
                days=30,
                start="2026-09-01",
                end="2026-09-30",
                companion_start=20,
                companion_end=84,
                index=71.4,
                stage="deep",
                progress=62,
                dimensions=_SCIENCE_DIMS,
                generated_at="2026-10-01T00:10:00+08:00",
                profile_id="profile_mock_002",
            )
        ],
        "health": health_payload(
            health_id="health_mock_003",
            persona_id="persona_science_01",
            observation_days=30,
            companion_delta=64,
            health_score=88,
            status="normal",
            recommended=False,
            trigger_reason=None,
            evaluated_at="2026-09-30T16:10:00+08:00",
        ),
        "reassessment": None,
    },
    "ca_display_watch": {
        "persona": persona_payload(
            "persona_philosophy_01", "bind_mock_003", 85, "2026-09-01T02:05:00+08:00"
        ),
        "growth": [
            growth_payload(
                persona_id="persona_philosophy_01",
                match_score=85,
                days=15,
                start="2026-09-01",
                end="2026-09-15",
                companion_start=8,
                companion_end=18,
                index=41.2,
                stage="exploring",
                progress=35,
                dimensions=_PHILOSOPHY_DIMS,
                generated_at="2026-09-16T00:10:00+08:00",
                profile_id="profile_mock_004",
            )
        ],
        "health": health_payload(
            health_id="health_mock_004",
            persona_id="persona_philosophy_01",
            observation_days=15,
            companion_delta=10,
            health_score=55,
            status="watch",
            recommended=False,
            trigger_reason="low_engagement",
            evaluated_at="2026-09-15T16:10:00+08:00",
        ),
        "reassessment": None,
    },
    "ca_display_reassess": {
        "persona": persona_payload(
            "persona_science_01", "bind_mock_004", 73, "2026-09-01T02:05:00+08:00"
        ),
        "growth": [
            growth_payload(
                persona_id="persona_science_01",
                match_score=73,
                days=15,
                start="2026-09-01",
                end="2026-09-15",
                companion_start=30,
                companion_end=33,
                index=33.7,
                stage="initial",
                progress=18,
                dimensions=_LOW_DIMS,
                generated_at="2026-09-23T00:10:00+08:00",
                profile_id="profile_mock_005",
            )
        ],
        "health": health_payload(
            health_id="health_mock_002",
            persona_id="persona_science_01",
            observation_days=21,
            companion_delta=3,
            health_score=28,
            status="reassess",
            recommended=True,
            trigger_reason="continuous_low_engagement",
            evaluated_at="2026-09-22T09:00:00+08:00",
        ),
        "reassessment": reassessment_payload(
            event_payload(
                event_id="reassess_mock_001",
                old_profile_id="profile_mock_005",
                old_persona_id="persona_science_01",
                trigger_type="low_engagement",
                recommended_at="2026-09-22T01:00:00+08:00",
            ),
            {
                "new_profile_id": "profile_mock_006",
                "new_persona_id": "persona_science_02",
                "new_persona_name": "Ada",
                "match_score": 79,
                "current_persona_match_score": 73,
                "match_delta": 6,
                "switch_recommended": False,
            },
        ),
    },
    "ca_display_new_user": {
        "persona": persona_payload(
            "persona_language_01", "bind_mock_005", 79, "2026-09-15T02:05:00+08:00"
        ),
        # 绑定不满一个周期：对方没有周期报告，不是"报告为空"。
        "growth": None,
        "health": health_payload(
            health_id="health_mock_005",
            persona_id="persona_language_01",
            observation_days=3,
            companion_delta=0,
            health_score=0,
            status="insufficient_data",
            recommended=False,
            trigger_reason=None,
            evaluated_at="2026-09-18T09:00:00+08:00",
        ),
        "reassessment": None,
    },
    "ca_display_switch": {
        "persona": persona_payload(
            "persona_art_01", "bind_mock_006", 69, "2026-09-01T02:05:00+08:00"
        ),
        "growth": [
            growth_payload(
                persona_id="persona_art_01",
                match_score=69,
                days=30,
                start="2026-09-01",
                end="2026-09-30",
                companion_start=15,
                companion_end=21,
                index=36.5,
                stage="exploring",
                progress=28,
                dimensions=_SWITCH_DIMS,
                generated_at="2026-10-01T00:10:00+08:00",
                profile_id="profile_mock_007",
            )
        ],
        "health": health_payload(
            health_id="health_mock_006",
            persona_id="persona_art_01",
            observation_days=30,
            companion_delta=6,
            health_score=41,
            status="reassess",
            recommended=True,
            trigger_reason="continuous_low_engagement",
            evaluated_at="2026-09-30T16:10:00+08:00",
        ),
        "reassessment": reassessment_payload(
            event_payload(
                event_id="reassess_mock_002",
                old_profile_id="profile_mock_007",
                old_persona_id="persona_art_01",
                trigger_type="low_engagement",
                recommended_at="2026-09-30T17:00:00+08:00",
            ),
            {
                "new_profile_id": "profile_mock_003",
                "new_persona_id": "persona_philosophy_01",
                "new_persona_name": "Socrates",
                "match_score": 86,
                "current_persona_match_score": 69,
                "match_delta": 17,
                "switch_recommended": True,
            },
        ),
    },
}


def inject_display(child_id, scenario, dataset=DATASET, ca_account_id=None):
    """按场景写 fixture 行；返回 `ca_account_id` 供后续断言。"""
    from dingdong_ca.core.ca_models import CaAccount

    account_id = ca_account_id or (
        CaAccount.objects.filter(child_id=child_id, status="active")
        .values_list("ca_account_id", flat=True)
        .first()
    )
    if not account_id:
        raise ValueError("该儿童没有活跃 CA 账户；先绑定机器人再注入展示面数据")
    rows = DISPLAY_SCENARIOS[scenario]
    for kind, payload in [
        (PERSONA_KIND, rows["persona"]),
        (HEALTH_KIND, rows["health"]),
        (REASSESSMENT_KIND, rows["reassessment"]),
    ]:
        if payload is None:
            TestFixture.objects.filter(dataset=dataset, kind=kind, subject_key=account_id).delete()
            continue
        TestFixture.objects.update_or_create(
            dataset=dataset,
            kind=kind,
            subject_key=account_id,
            sequence=1,
            defaults={"payload": payload, "consumed_at": None},
        )
    # 周期报告按 sequence 区分周期：1 = 15 天，2 = 30 天。
    TestFixture.objects.filter(dataset=dataset, kind=GROWTH_KIND, subject_key=account_id).delete()
    for growth in rows["growth"] or []:
        sequence = 1 if growth["period"]["days"] == 15 else 2
        TestFixture.objects.create(
            dataset=dataset,
            kind=GROWTH_KIND,
            subject_key=account_id,
            sequence=sequence,
            payload=growth,
        )
    return account_id


def inject_display_fault(child_id, code, dataset=DATASET, ca_account_id=None):
    """注入一次合成出站失败（业务码原样写，供降级路径验证）。"""
    from dingdong_ca.core.ca_models import CaAccount

    account_id = ca_account_id or (
        CaAccount.objects.filter(child_id=child_id, status="active")
        .values_list("ca_account_id", flat=True)
        .first()
    )
    if not account_id:
        raise ValueError("该儿童没有活跃 CA 账户；先绑定机器人再注入展示面数据")
    TestFixture.objects.update_or_create(
        dataset=dataset,
        kind=FAULT_KIND,
        subject_key=account_id,
        sequence=1,
        defaults={"payload": {"code": str(code)}, "consumed_at": None},
    )
    return account_id


def clear_display_fixtures(dataset=DATASET, ca_account_id=None):
    kinds = [PERSONA_KIND, GROWTH_KIND, HEALTH_KIND, REASSESSMENT_KIND, FAULT_KIND]
    rows = TestFixture.objects.filter(dataset=dataset, kind__in=kinds)
    if ca_account_id:
        rows = rows.filter(subject_key=ca_account_id)
    rows.delete()


def display_scenarios():
    return sorted(DISPLAY_SCENARIOS)
