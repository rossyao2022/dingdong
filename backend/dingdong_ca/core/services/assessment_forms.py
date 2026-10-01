"""Read-only, answer-derived CA handoff forms. No supplier mappings or sender."""

import csv
import hashlib
import io
import json

from dingdong_ca.core.models import AssessmentSession, ChildCompanionPreference, ProfileSnapshot
from dingdong_ca.core.services.exploration import guidance_summary, session_questions

SCHEMA_VERSION = "ca-assessment-form-v1"
PURPOSES = ("interest", "talent", "exploration", "assessment")
PURPOSE_LABELS = {
    "interest": "六岛兴趣探索",
    "talent": "八维日常观察",
    "exploration": "探索体验",
    "assessment": "测评问卷",
}
GUIDE_LABELS = {"cognitive": "认知式", "imitative": "模仿式", "reverse": "反向式", "open": "开放式"}


def completed_sessions(child):
    return (
        AssessmentSession.objects.select_related("questionnaire_version")
        .filter(
            child=child,
            status="completed",
            completed_at__isnull=False,
            questionnaire_version__purpose__in=PURPOSES,
        )
        .order_by("-completed_at", "-id")
    )


def canonical_json(value):
    return json.dumps(
        value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False
    )


def assessment_form(child, sessions=None):
    """Fixed session selection keeps a preview reproducible after newer completions."""
    if sessions is None:
        latest = {}
        for session in completed_sessions(child):
            latest.setdefault(session.questionnaire_version.purpose, session)
        sessions = [latest[purpose] for purpose in PURPOSES if purpose in latest]
    sessions = list(sessions)
    profiles = {
        profile.algorithm_attempt.session_id: profile
        for profile in ProfileSnapshot.objects.select_related("algorithm_attempt").filter(
            child=child, algorithm_attempt__session_id__in=[session.pk for session in sessions]
        )
    }
    preference = ChildCompanionPreference.objects.filter(child=child).first()
    document = {
        "schema_version": SCHEMA_VERSION,
        "child_id": str(child.pk),
        "companion_preference": {
            "guide_mode": preference.guide_mode if preference else None,
            "label": GUIDE_LABELS.get(preference.guide_mode) if preference else None,
            "revision": preference.revision if preference else None,
            "missing_reason": None if preference else "not_selected",
        },
        "assessments": [session_form(session, profiles.get(session.pk)) for session in sessions],
    }
    document["snapshot_digest"] = hashlib.sha256(canonical_json(document).encode()).hexdigest()
    return document


def session_form(session, profile=None):
    q = session.questionnaire_version
    questions = []
    for question in session_questions(session):
        selected = session.answers.get(question["code"], [])
        selected = [selected] if isinstance(selected, str) else selected
        options = [
            {"code": option["code"], "label": option["label"]} for option in question["options"]
        ]
        labels = {option["code"]: option["label"] for option in options}
        questions.append(
            {
                "code": question["code"],
                "title": question["title"],
                "type": question["type"],
                "options": options,
                "selected_option_codes": selected,
                "selected_option_labels": [labels.get(code, code) for code in selected],
            }
        )
    professional = None
    if profile:
        # Only validated metrics, never algorithm inputs or raw image material.
        professional = {
            "schema_version": profile.schema_version,
            "data_origin": profile.data_origin,
            "algorithm_version": profile.algorithm_attempt.algorithm_version,
            "metrics": [
                {
                    key: metric.get(key)
                    for key in ("code", "label", "value", "unit", "missing_reason")
                }
                for metric in profile.result.get("metrics", [])
            ],
        }
    return {
        "assessment_id": str(session.pk),
        "purpose": q.purpose,
        "purpose_label": PURPOSE_LABELS[q.purpose],
        "title": q.title,
        "completed_at": session.completed_at.isoformat(),
        "questionnaire_version_id": str(q.pk),
        "content_version": q.version,
        "scoring_version": (q.scoring or {}).get("version"),
        "source_commit": (q.scoring or {}).get("source_commit"),
        "selected_islands": session.input_context.get("selected_islands", []),
        "questions": questions,
        "score_range": (
            {"minimum": 0, "maximum": 4}
            if q.purpose == "interest"
            else {"minimum": 3, "maximum": 15}
            if q.purpose == "talent"
            else None
        ),
        "result": session.exploration_result,
        "guidance_summary": guidance_summary(session),
        "professional_result": professional,
        "professional_missing_reason": "not_provided" if professional is None else None,
    }


def chinese_form(document):
    lines = [
        "CA测评表单",
        f"格式版本：{document['schema_version']}",
        f"表单摘要：{document['snapshot_digest']}",
        "当前网页陪伴方式：" + (document["companion_preference"]["label"] or "未选择"),
    ]
    for item in document["assessments"]:
        lines.extend(
            [
                "",
                f"{item['title']}（{item['purpose_label']}）",
                f"测评编号：{item['assessment_id']}",
                f"完成时间：{item['completed_at']}",
                f"题库版本：{item['content_version']}",
                f"计分版本：{item['scoring_version'] or '无独立计分规则'}",
                f"内容来源版本：{item['source_commit'] or '未提供'}",
                "所选岛屿：" + ("、".join(item["selected_islands"]) or "无需选择"),
            ]
        )
        for index, question in enumerate(item["questions"], 1):
            lines.append(
                f"{index}. {question['title']}\n回答：{'、'.join(question['selected_option_labels']) or '未选择'}"
            )
            lines.append(
                "选项："
                + "；".join(f"{option['code']} {option['label']}" for option in question["options"])
            )
        for label, key in (
            ("原始结果", "result"),
            ("计分范围", "score_range"),
            ("情境回答分布", "guidance_summary"),
            ("专业结果", "professional_result"),
        ):
            lines.append(
                f"{label}：{canonical_json(item[key]) if item[key] is not None else '未提供'}"
            )
    if not document["assessments"]:
        lines.append("还没有已完成的测评。")
    return "\n".join(lines)


def csv_cell(value):
    """Prevent questionnaire text from becoming spreadsheet formulas on opening."""
    text = str(value)
    return "'" + text if text.lstrip().startswith(("=", "+", "-", "@")) else text


def csv_form(document):
    output = io.StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow(
        [
            "格式版本",
            "表单摘要",
            "网页陪伴方式",
            "测评编号",
            "用途",
            "问卷",
            "完成时间",
            "题库版本",
            "计分版本",
            "来源版本",
            "所选岛屿",
            "题号",
            "题目",
            "选项",
            "回答代码",
            "回答",
            "范围",
            "原始结果",
            "情境回答分布",
            "专业结果",
        ]
    )
    for item in document["assessments"]:
        for question in item["questions"]:
            row = [
                document["schema_version"],
                document["snapshot_digest"],
                document["companion_preference"]["label"] or "未选择",
                item["assessment_id"],
                item["purpose_label"],
                item["title"],
                item["completed_at"],
                item["content_version"],
                item["scoring_version"] or "",
                item["source_commit"] or "",
                canonical_json(item["selected_islands"]),
                question["code"],
                question["title"],
                canonical_json(question["options"]),
                canonical_json(question["selected_option_codes"]),
                "、".join(question["selected_option_labels"]),
                canonical_json(item["score_range"]),
                canonical_json(item["result"]),
                canonical_json(item["guidance_summary"]),
                canonical_json(item["professional_result"]),
            ]
            writer.writerow([csv_cell(value) for value in row])
    return "\ufeff" + output.getvalue()
