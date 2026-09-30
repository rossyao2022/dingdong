"""Versioned answer-derived observations, independent of vendor algorithms."""

import re
from collections import Counter

from dingdong_ca.core.api.common import ApiError

PURPOSES = {"interest", "talent"}
ISLANDS = ["R", "I", "A", "S", "E", "C"]
DIMENSIONS = ["word", "music", "logic", "space", "body", "self", "social", "nature"]


def validate_scoring(q):
    scoring = q.scoring
    expected = ISLANDS if q.purpose == "interest" else DIMENSIONS
    if not isinstance(scoring, dict) or set(scoring) != {
        "version",
        "source_commit",
        "groups",
        "labels",
    }:
        raise ValueError("计分规则不完整")
    if scoring["version"] != ("interest-mean-v1" if q.purpose == "interest" else "talent-sum-v1"):
        raise ValueError("计分规则版本无效")
    if not isinstance(scoring["source_commit"], str) or not re.fullmatch(
        r"[a-f0-9]{40}", scoring["source_commit"]
    ):
        raise ValueError("内容来源版本无效")
    codes = {item["code"] for item in q.questions}
    canonical = (
        {f"{direction}-{i}": direction for direction in ISLANDS for i in range(3)}
        if q.purpose == "interest"
        else {str(i + 1): DIMENSIONS[i // 3] for i in range(24)}
    )
    groups = scoring["groups"]
    if (
        not isinstance(groups, dict)
        or set(groups) != codes
        or groups != canonical
        or Counter(groups.values()) != Counter(dict.fromkeys(expected, 3))
    ):
        raise ValueError("每个观察方向需要三道题")
    if (
        not isinstance(scoring["labels"], dict)
        or set(scoring["labels"]) != set(expected)
        or any(not isinstance(v, str) or not v.strip() for v in scoring["labels"].values())
    ):
        raise ValueError("观察方向名称无效")
    options = [str(i) for i in (range(5) if q.purpose == "interest" else range(1, 6))]
    if any(
        item["type"] != "single_choice"
        or not item["required"]
        or [o["code"] for o in item["options"]] != options
        for item in q.questions
    ):
        raise ValueError("探索必须使用完整五档单选题")


def selected_context(q, selected):
    if q.purpose == "interest":
        if len(selected) != 3 or len(set(selected)) != 3 or not set(selected) <= set(ISLANDS):
            raise ApiError("VALIDATION_ERROR", 422, "请选择三个不同的岛屿")
    elif selected:
        raise ApiError("VALIDATION_ERROR", 422, "该体验无需选择岛屿")
    return list(selected)


def session_questions(session):
    q = session.questionnaire_version
    if q.purpose == "talent":
        return sorted(q.questions, key=lambda item: int(item["code"]))
    if q.purpose != "interest":
        return q.questions
    selected = session.input_context.get("selected_islands", [])
    groups = q.scoring.get("groups", {})
    return [
        item
        for direction in selected
        for item in sorted(q.questions, key=lambda item: item["code"])
        if groups.get(item["code"]) == direction
    ]


def compute_result(session):
    q = session.questionnaire_version
    if q.purpose not in PURPOSES:
        return None
    selected = session.input_context.get("selected_islands", [])
    direction_ids = selected if q.purpose == "interest" else DIMENSIONS
    rows = []
    questions = session_questions(session)
    for direction in direction_ids:
        codes = [
            item["code"] for item in questions if q.scoring["groups"][item["code"]] == direction
        ]
        total = sum(int(session.answers[code][0]) for code in codes)
        rows.append(
            {
                "id": direction,
                "label": q.scoring["labels"][direction],
                "score": round(total / 3, 4) if q.purpose == "interest" else total,
                "total": total,
                "answered_count": len(codes),
            }
        )
    return {
        "purpose": q.purpose,
        "questionnaire_version_id": str(q.pk),
        "content_version": q.version,
        "scoring_version": q.scoring["version"],
        "source_commit": q.scoring["source_commit"],
        "selected_islands": selected,
        "profiles": rows if q.purpose == "interest" else [],
        "dimensions": rows if q.purpose == "talent" else [],
    }
