"""运营后台：题库与活动的可视化维护、发布保护与历史数据安全。"""

import copy
import uuid

import pytest
from django.utils import timezone
from ops_helpers import make_family, make_session, make_staff, ops_client, post_json

from dingdong_ca.core.models import (
    ActivityContentVersion,
    ActivityRecord,
    QuestionnaireVersion,
)

pytestmark = pytest.mark.django_db


def question(code, label="情境一"):
    return {
        "code": code,
        "type": "single_choice",
        "title": f"{label}：你更想先做什么？",
        "required": True,
        "min_choices": 1,
        "max_choices": 1,
        "options": [
            {"code": "A", "label": "先看一看"},
            {"code": "B", "label": "直接动手"},
        ],
    }


def activity_content(steps=1):
    return {
        "materials": "一张白纸、几支彩笔",
        "goal": "陪孩子观察身边的形状",
        "alternative": "没有彩笔可以用铅笔",
        "allowed_styles": ["exploratory", "creative"],
        "steps": [
            {
                "index": index,
                "instruction": f"第 {index + 1} 步指引",
                "guide_text": "慢慢来，不着急",
            }
            for index in range(steps)
        ],
    }


def create_questionnaire(client, purpose="exploration", title="运营新建体验题"):
    response = post_json(
        client,
        "/ops/api/questionnaires",
        {
            "code": "ops-" + uuid.uuid4().hex[:8],
            "version": "v1",
            "purpose": purpose,
            "title": title,
            "description": "只记录本次选择，不作能力评价。",
        },
    )
    assert response.status_code == 201, response.content
    return response.json()["questionnaire"]["id"]


# --------------------------------------------------------------------------- 题库


def test_questionnaire_draft_save_preview_publish_flow():
    client = ops_client(make_staff("content"))
    version_id = create_questionnaire(client)

    saved = post_json(
        client,
        f"/ops/api/questionnaires/{version_id}",
        {
            "title": "四个小情境（运营）",
            "description": "非正式体验，只记录选择。",
            "questions": [question(f"Q{i}") for i in range(4)],
        },
    )
    assert saved.status_code == 200
    assert len(saved.json()["questionnaire"]["questions"]) == 4

    check = post_json(client, f"/ops/api/questionnaires/{version_id}/check", {})
    assert check.json()["problems"] == []

    published = client.post(f"/api/v1/staff/questionnaires/{version_id}/publish")
    assert published.status_code == 200, published.content
    row = QuestionnaireVersion.objects.get(pk=version_id)
    assert row.status == "published"
    assert row.published_at is not None


def test_draft_allows_unfinished_but_publish_blocks():
    client = ops_client(make_staff("content"))
    version_id = create_questionnaire(client)

    empty = post_json(
        client,
        f"/ops/api/questionnaires/{version_id}",
        {"title": "空草稿", "description": "待补充", "questions": []},
    )
    assert empty.status_code == 200

    check = post_json(client, f"/ops/api/questionnaires/{version_id}/check", {})
    problems = check.json()["problems"]
    assert problems and "1–10" in problems[0]

    blocked = client.post(f"/api/v1/staff/questionnaires/{version_id}/publish")
    assert blocked.status_code == 422


def test_publish_check_reports_missing_options():
    client = ops_client(make_staff("content"))
    version_id = create_questionnaire(client)
    single_option = question("Q1")
    single_option["options"] = [{"code": "A", "label": "只有一个选项"}]
    post_json(
        client,
        f"/ops/api/questionnaires/{version_id}",
        {"title": "选项不足", "description": "检查提示", "questions": [single_option]},
    )
    check = post_json(client, f"/ops/api/questionnaires/{version_id}/check", {})
    assert any("至少需要 2 个选项" in item for item in check.json()["problems"])


def test_questionnaire_rejects_duplicate_option_text():
    client = ops_client(make_staff("content"))
    version_id = create_questionnaire(client)
    duplicated = question("Q1")
    duplicated["options"] = [
        {"code": "A", "label": "一样"},
        {"code": "B", "label": "一样"},
    ]
    response = post_json(
        client,
        f"/ops/api/questionnaires/{version_id}",
        {"title": "重复选项", "description": "检查", "questions": [duplicated]},
    )
    assert response.status_code == 422
    assert "重复的选项文字" in response.json()["message"]


def test_published_version_cannot_be_edited_in_place():
    client = ops_client(make_staff("content"))
    version_id = create_questionnaire(client)
    post_json(
        client,
        f"/ops/api/questionnaires/{version_id}",
        {"title": "发布前", "description": "说明", "questions": [question("Q1")]},
    )
    assert client.post(f"/api/v1/staff/questionnaires/{version_id}/publish").status_code == 200

    response = post_json(
        client,
        f"/ops/api/questionnaires/{version_id}",
        {"title": "发布后改名", "description": "说明", "questions": [question("Q1")]},
    )
    assert response.status_code == 409
    assert "复制为新版本" in response.json()["message"]
    assert QuestionnaireVersion.objects.get(pk=version_id).title == "发布前"


def test_copy_creates_editable_draft_with_same_questions():
    client = ops_client(make_staff("content"))
    version_id = create_questionnaire(client)
    post_json(
        client,
        f"/ops/api/questionnaires/{version_id}",
        {"title": "原始版本", "description": "说明", "questions": [question("Q1"), question("Q2")]},
    )
    client.post(f"/api/v1/staff/questionnaires/{version_id}/publish")

    copied = post_json(client, f"/ops/api/questionnaires/{version_id}/copy", {"version": "v2"})
    assert copied.status_code == 201
    new_id = copied.json()["id"]
    new = QuestionnaireVersion.objects.get(pk=new_id)
    assert new.status == "draft"
    assert new.version == "v2"
    assert [q["code"] for q in new.questions] == ["Q1", "Q2"]

    duplicate_version = post_json(
        client, f"/ops/api/questionnaires/{version_id}/copy", {"version": "v2"}
    )
    assert duplicate_version.status_code == 409


def test_publishing_new_version_retires_old_and_keeps_history():
    client = ops_client(make_staff("content"))
    first_id = create_questionnaire(client, title="第一版")
    post_json(
        client,
        f"/ops/api/questionnaires/{first_id}",
        {"title": "第一版", "description": "说明", "questions": [question("Q1")]},
    )
    assert client.post(f"/api/v1/staff/questionnaires/{first_id}/publish").status_code == 200

    family, children, parent = make_family()
    session = make_session(children[0], parent, first_id)

    copied = post_json(client, f"/ops/api/questionnaires/{first_id}/copy", {"version": "v2"})
    second_id = copied.json()["id"]
    post_json(
        client,
        f"/ops/api/questionnaires/{second_id}",
        {"title": "第二版", "description": "说明", "questions": [question("Q1"), question("Q2")]},
    )
    assert client.post(f"/api/v1/staff/questionnaires/{second_id}/publish").status_code == 200

    first = QuestionnaireVersion.objects.get(pk=first_id)
    assert first.status == "retired"
    assert QuestionnaireVersion.objects.get(pk=second_id).status == "published"
    session.refresh_from_db()
    assert str(session.questionnaire_version_id) == str(first_id)
    assert len(first.questions) == 1


def test_retire_published_questionnaire():
    client = ops_client(make_staff("content"))
    version_id = create_questionnaire(client)
    post_json(
        client,
        f"/ops/api/questionnaires/{version_id}",
        {"title": "将被停用", "description": "说明", "questions": [question("Q1")]},
    )
    client.post(f"/api/v1/staff/questionnaires/{version_id}/publish")

    response = post_json(client, f"/ops/api/questionnaires/{version_id}/retire", {})
    assert response.status_code == 200
    assert QuestionnaireVersion.objects.get(pk=version_id).status == "retired"

    again = post_json(client, f"/ops/api/questionnaires/{version_id}/retire", {})
    assert again.json()["already"] is True


def test_questionnaire_editor_page_embeds_question_data():
    """编辑器完全依赖页面内嵌的题目数据；缺失会让整个编辑页脚本失效。"""
    client = ops_client(make_staff("content"))
    version_id = create_questionnaire(client)
    post_json(
        client,
        f"/ops/api/questionnaires/{version_id}",
        {"title": "内嵌数据", "description": "说明", "questions": [question("Q1"), question("Q2")]},
    )
    page = client.get(f"/ops/questionnaires/{version_id}/")
    assert page.status_code == 200
    body = page.content.decode()
    assert 'id="questionnaire-data"' in body
    assert '"questions"' in body
    assert "Q1" in body and "Q2" in body


def test_published_questionnaire_page_still_offers_copy_action():
    """页面自己提示"请复制为新版本"，就必须真的提供复制入口，否则运营会走进死路。"""
    client = ops_client(make_staff("content"))
    version_id = create_questionnaire(client)
    post_json(
        client,
        f"/ops/api/questionnaires/{version_id}",
        {"title": "已发布", "description": "说明", "questions": [question("Q1")]},
    )
    assert client.post(f"/api/v1/staff/questionnaires/{version_id}/publish").status_code == 200

    body = client.get(f"/ops/questionnaires/{version_id}/").content.decode()
    assert "该版本不可编辑" in body
    assert 'id="copy"' in body
    assert "复制为新版本" in body
    # 已发布版本不能再原地保存或发布
    assert 'id="save"' not in body
    assert 'id="publish"' not in body


def test_activity_editor_page_embeds_content_data():
    client = ops_client(make_staff("content"))
    activity_id = create_activity(client)
    post_json(
        client,
        f"/ops/api/activities/{activity_id}",
        {
            "title": "内嵌活动",
            "island": "观察岛",
            "mood": "好奇",
            "duration_minutes": 15,
            "content": activity_content(steps=2),
        },
    )
    body = client.get(f"/ops/activities/{activity_id}/").content.decode()
    assert 'id="activity-data"' in body
    assert '"steps"' in body
    assert '"instruction"' in body
    assert "陪孩子观察身边的形状" in body or "\\u966a\\u5b69\\u5b50" in body


def test_published_activity_page_still_offers_copy_action():
    client = ops_client(make_staff("content"))
    activity_id = create_activity(client)
    post_json(
        client,
        f"/ops/api/activities/{activity_id}",
        {
            "title": "已发布活动",
            "island": "观察岛",
            "mood": "好奇",
            "duration_minutes": 15,
            "content": activity_content(steps=1),
        },
    )
    assert client.post(f"/api/v1/staff/activities/{activity_id}/publish").status_code == 200

    body = client.get(f"/ops/activities/{activity_id}/").content.decode()
    assert "该版本不可编辑" in body
    assert 'id="copy"' in body
    assert 'id="save"' not in body
    assert 'id="publish"' not in body


def test_operations_role_cannot_edit_questionnaires():
    client = ops_client(make_staff("operations"))
    response = post_json(
        client,
        "/ops/api/questionnaires",
        {"code": "nope", "version": "v1", "purpose": "exploration", "title": "无权限"},
    )
    assert response.status_code == 403
    assert response.json()["code"] == "PERMISSION_DENIED"


def test_questionnaire_create_rejects_duplicate_identity():
    client = ops_client(make_staff("content"))
    payload = {
        "code": "fixed-code",
        "version": "v1",
        "purpose": "exploration",
        "title": "固定标识",
        "description": "说明",
    }
    assert post_json(client, "/ops/api/questionnaires", payload).status_code == 201
    again = post_json(client, "/ops/api/questionnaires", payload)
    assert again.status_code == 409


# --------------------------------------------------------------------------- 活动


def create_activity(client, title="运营新建活动"):
    response = post_json(
        client,
        "/ops/api/activities",
        {
            "code": "act-" + uuid.uuid4().hex[:8],
            "version": "v1",
            "title": title,
            "island": "观察岛",
            "mood": "好奇",
            "duration_minutes": 15,
        },
    )
    assert response.status_code == 201, response.content
    return response.json()["activity"]["id"]


def test_activity_draft_publish_flow_and_step_order():
    client = ops_client(make_staff("content"))
    activity_id = create_activity(client)
    saved = post_json(
        client,
        f"/ops/api/activities/{activity_id}",
        {
            "title": "一起找形状",
            "island": "观察岛",
            "mood": "好奇",
            "duration_minutes": 20,
            "content": activity_content(steps=3),
        },
    )
    assert saved.status_code == 200
    assert [step["index"] for step in saved.json()["activity"]["content"]["steps"]] == [0, 1, 2]

    check = post_json(client, f"/ops/api/activities/{activity_id}/check", {})
    assert check.json()["problems"] == []

    published = client.post(f"/api/v1/staff/activities/{activity_id}/publish")
    assert published.status_code == 200, published.content
    assert ActivityContentVersion.objects.get(pk=activity_id).status == "published"


def test_activity_publish_requires_steps():
    client = ops_client(make_staff("content"))
    activity_id = create_activity(client)
    post_json(
        client,
        f"/ops/api/activities/{activity_id}",
        {
            "title": "没有步骤",
            "island": "观察岛",
            "mood": "好奇",
            "duration_minutes": 10,
            "content": activity_content(steps=0),
        },
    )
    check = post_json(client, f"/ops/api/activities/{activity_id}/check", {})
    assert any("至少需要 1 个步骤" in item for item in check.json()["problems"])
    assert client.post(f"/api/v1/staff/activities/{activity_id}/publish").status_code == 422


def test_activity_content_change_does_not_touch_started_records():
    client = ops_client(make_staff("content"))
    activity_id = create_activity(client, title="第一版活动")
    post_json(
        client,
        f"/ops/api/activities/{activity_id}",
        {
            "title": "第一版活动",
            "island": "观察岛",
            "mood": "好奇",
            "duration_minutes": 15,
            "content": activity_content(steps=2),
        },
    )
    client.post(f"/api/v1/staff/activities/{activity_id}/publish")

    family, children, parent = make_family()
    record = ActivityRecord.objects.create(
        child=children[0],
        started_by=parent,
        activity_version_id=activity_id,
        create_request_key=uuid.uuid4(),
        mode="web",
        style="exploratory",
        status="active",
        step_index=1,
        started_at=timezone.now(),
    )

    copied = post_json(client, f"/ops/api/activities/{activity_id}/copy", {"version": "v2"})
    second_id = copied.json()["id"]
    post_json(
        client,
        f"/ops/api/activities/{second_id}",
        {
            "title": "第二版活动",
            "island": "观察岛",
            "mood": "好奇",
            "duration_minutes": 25,
            "content": activity_content(steps=5),
        },
    )
    assert client.post(f"/api/v1/staff/activities/{second_id}/publish").status_code == 200

    record.refresh_from_db()
    assert str(record.activity_version_id) == str(activity_id)
    assert record.step_index == 1
    original = ActivityContentVersion.objects.get(pk=activity_id)
    assert original.status == "retired"
    assert len(original.content["steps"]) == 2
    assert original.duration_minutes == 15


def test_activity_retire_reports_active_records():
    client = ops_client(make_staff("content"))
    activity_id = create_activity(client)
    post_json(
        client,
        f"/ops/api/activities/{activity_id}",
        {
            "title": "停用测试",
            "island": "观察岛",
            "mood": "好奇",
            "duration_minutes": 15,
            "content": activity_content(steps=1),
        },
    )
    client.post(f"/api/v1/staff/activities/{activity_id}/publish")

    family, children, parent = make_family()
    ActivityRecord.objects.create(
        child=children[0],
        started_by=parent,
        activity_version_id=activity_id,
        create_request_key=uuid.uuid4(),
        mode="web",
        style="exploratory",
        started_at=timezone.now(),
    )
    response = post_json(client, f"/ops/api/activities/{activity_id}/retire", {})
    assert response.status_code == 200
    assert response.json()["active_records"] == 1


def test_activity_editor_rejects_out_of_range_duration():
    client = ops_client(make_staff("content"))
    activity_id = create_activity(client)
    response = post_json(
        client,
        f"/ops/api/activities/{activity_id}",
        {
            "title": "时长错误",
            "island": "观察岛",
            "mood": "好奇",
            "duration_minutes": 0,
            "content": activity_content(steps=1),
        },
    )
    assert response.status_code == 422
    assert "1–600" in response.json()["message"]


def test_activity_editor_requires_goal_and_styles_on_publish():
    client = ops_client(make_staff("content"))
    activity_id = create_activity(client)
    content = activity_content(steps=1)
    content["goal"] = ""
    content["allowed_styles"] = []
    post_json(
        client,
        f"/ops/api/activities/{activity_id}",
        {
            "title": "缺少目标",
            "island": "观察岛",
            "mood": "好奇",
            "duration_minutes": 15,
            "content": content,
        },
    )
    problems = post_json(client, f"/ops/api/activities/{activity_id}/check", {}).json()["problems"]
    assert any("活动目标" in item for item in problems)
    assert any("可展示风格" in item for item in problems)


def test_activity_copy_keeps_content_independent():
    client = ops_client(make_staff("content"))
    activity_id = create_activity(client)
    post_json(
        client,
        f"/ops/api/activities/{activity_id}",
        {
            "title": "原始活动",
            "island": "观察岛",
            "mood": "好奇",
            "duration_minutes": 15,
            "content": activity_content(steps=2),
        },
    )
    copied = post_json(client, f"/ops/api/activities/{activity_id}/copy", {"version": "v2"})
    second = ActivityContentVersion.objects.get(pk=copied.json()["id"])
    original = ActivityContentVersion.objects.get(pk=activity_id)
    second.content["steps"][0]["instruction"] = "改过的指引"
    second.save()
    original.refresh_from_db()
    assert original.content["steps"][0]["instruction"] == "第 1 步指引"
    assert copy.deepcopy(original.content) != second.content
