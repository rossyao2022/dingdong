"""M5: purpose-aware publication, real editor and frozen session regression."""

import copy

import pytest
from django.core.exceptions import ValidationError

from dingdong_ca.core.api.common import ApiError
from dingdong_ca.core.api.staff import validate_content
from dingdong_ca.core.models import QuestionnaireVersion
from dingdong_ca.testsupport.seed import seed_content

pytestmark = pytest.mark.django_db


def draft(purpose, count):
    original = seed_content()
    return QuestionnaireVersion(
        code="new",
        version="v1",
        purpose=purpose,
        title="一起探索（测试）",
        description="仅记录选择，不作能力评价",
        data_origin="synthetic",
        questions=[{**copy.deepcopy(original.questions[0]), "code": f"Q{i}"} for i in range(count)],
    )


@pytest.mark.parametrize(
    "purpose,count",
    [("exploration", 4), ("exploration", 1), ("assessment", 20), ("assessment", 30)],
)
def test_publish_quantity_depends_on_purpose(purpose, count):
    validate_content(draft(purpose, count))


@pytest.mark.parametrize(
    "purpose,count",
    [("exploration", 0), ("exploration", 11), ("assessment", 19), ("assessment", 31)],
)
def test_publish_rejects_out_of_range(purpose, count):
    with pytest.raises(ApiError):
        validate_content(draft(purpose, count))


def test_published_purpose_and_title_are_frozen():
    q = seed_content()
    q.purpose = "exploration"
    with pytest.raises(ValidationError):
        q.save()


def test_reference_exploration_is_seeded_and_meaningful():
    seed_content()
    q = QuestionnaireVersion.objects.get(purpose="exploration", status="published")
    assert len(q.questions) == 4
    assert q.questions[0]["title"] == "遇到一件从没见过的小玩意儿，你更想先……"
    assert "非正式" in q.description
    for q in QuestionnaireVersion.objects.filter(status="published"):
        assert all(
            "合成选项" not in o["label"] for question in q.questions for o in question["options"]
        )


def test_editor_roundtrip_without_json_input():
    from dingdong_ca.core.questionnaire_admin import QuestionnaireForm

    q = draft("exploration", 1)
    form = QuestionnaireForm(instance=q)
    assert form.fields["questions"].widget.template_name.endswith("question_editor.html")


def test_exploration_completion_records_choices_without_profile(client):
    import uuid

    from test_assessments import setup_assessment

    from dingdong_ca.core.models import ProfileSnapshot

    child, grant, old, _, _ = setup_assessment(client, answer=False)
    config = client.get("/api/v1/assessment-config", {"purpose": "exploration"}).json()
    assert config["purpose"] == "exploration"
    result = client.post(
        f"/api/v1/children/{child['id']}/assessments",
        {
            "request_id": str(uuid.uuid4()),
            "questionnaire_version_id": config["questionnaire_version_id"],
            "consent_grant_id": grant["id"],
        },
        format="json",
    )
    assert result.status_code == 201
    s = result.json()
    patch = client.patch(
        f"/api/v1/assessments/{s['id']}/answers",
        {
            "revision": s["revision"],
            "answers": [
                {"question_code": q["code"], "option_codes": [q["options"][0]["code"]]}
                for q in s["questions"]
            ],
        },
        format="json",
    )
    assert patch.status_code == 200
    url = f"/api/v1/assessments/{s['id']}/complete-exploration"
    result = client.post(url, {"revision": patch.json()["revision"]}, format="json")
    assert result.status_code == 200, result.content
    assert result.json()["status"] == "completed"
    assert len(result.json()["choice_summary"]) == 4
    assert (
        client.post(url, {"revision": patch.json()["revision"]}, format="json").status_code == 200
    )
    assert ProfileSnapshot.objects.count() == 0
    assert client.get(f"/api/v1/assessments/{old['id']}").json()["purpose"] == "assessment"


def test_admin_copy_and_publish_keeps_old_answers_and_permissions(client):
    from conftest import sign_in
    from rest_framework.test import APIClient
    from test_assessments import setup_assessment
    from test_m3 import staff

    child, _, session, _, _ = setup_assessment(client)
    original = QuestionnaireVersion.objects.get(pk=session["questionnaire_version_id"])
    content, _ = staff("content")
    response = content.post(f"/admin/core/questionnaireversion/{original.pk}/copy/", {})
    assert response.status_code == 302
    new = QuestionnaireVersion.objects.get(status="draft", code=original.code)
    new.questions[0]["title"] = "周末一起散步，你最想观察什么？"
    new.save()
    assert (
        content.post(
            f"/api/v1/staff/questionnaires/{new.pk}/publish", {}, format="json"
        ).status_code
        == 200
    )
    assert client.get("/api/v1/assessment-config").json()["questionnaire_version_id"] == str(new.pk)
    old = client.get(f"/api/v1/assessments/{session['id']}").json()
    assert old["questions"][0]["title"] == original.questions[0]["title"]
    assert old["answers"] == session["answers"]
    other = APIClient(enforce_csrf_checks=True)
    sign_in(other, "+8613800000073")
    assert (
        other.patch(
            f"/api/v1/assessments/{session['id']}/answers",
            {"revision": old["revision"], "answers": []},
            format="json",
        ).status_code
        == 404
    )
    operations, _ = staff("operations")
    assert (
        operations.post(f"/admin/core/questionnaireversion/{new.pk}/copy/", {}).status_code == 403
    )
    assert content.get(f"/admin/core/questionnaireversion/{new.pk}/change/").status_code == 200


def test_optional_multiselect_answers_and_catalog(client):
    import uuid

    from test_assessments import setup_assessment
    from test_m3 import staff

    child, grant, _, _, _ = setup_assessment(client, answer=False)
    q = draft("exploration", 2)
    q.questions[0].update(type="multiple_choice", max_choices=2)
    q.questions[1]["required"] = False
    q.save()
    content, _ = staff("content")
    assert (
        content.post(f"/api/v1/staff/questionnaires/{q.pk}/publish", {}, format="json").status_code
        == 200
    )
    config = client.get(
        "/api/v1/assessment-config",
        {"purpose": "exploration", "questionnaire_version_id": str(q.pk)},
    ).json()
    assert config["questionnaire_version_id"] == str(q.pk)
    assert any(
        row["id"] == str(q.pk) and row["question_count"] == 2 for row in config["questionnaires"]
    )
    response = client.post(
        f"/api/v1/children/{child['id']}/assessments",
        {
            "request_id": str(uuid.uuid4()),
            "consent_grant_id": grant["id"],
            "questionnaire_version_id": str(q.pk),
        },
        format="json",
    )
    session = response.json()
    url = f"/api/v1/assessments/{session['id']}/answers"
    assert (
        client.patch(
            url,
            {
                "revision": session["revision"],
                "answers": [{"question_code": "Q0", "option_codes": ["A", "B", "C"]}],
            },
            format="json",
        ).status_code
        == 422
    )
    result = client.patch(
        url,
        {
            "revision": session["revision"],
            "answers": [{"question_code": "Q0", "option_codes": ["A", "B"]}],
        },
        format="json",
    )
    assert result.status_code == 200 and result.json()["status"] == "ready"
    completion = client.post(
        f"/api/v1/assessments/{session['id']}/complete-exploration",
        {"revision": result.json()["revision"]},
        format="json",
    )
    assert completion.status_code == 200 and completion.json()["choice_summary"][1]["choices"] == []


def test_empty_draft_form_can_be_saved_but_not_published():
    from dingdong_ca.core.questionnaire_admin import QuestionnaireForm

    form = QuestionnaireForm(
        data={
            "code": "empty",
            "version": "v1",
            "title": "未完成的体验草稿",
            "purpose": "exploration",
            "description": "仅用于体验",
            "data_origin": "synthetic",
            "schema_version": "questionnaire-v1",
            "questions": "[]",
            "status": "draft",
        }
    )
    assert form.is_valid(), form.errors
    row = form.save()
    with pytest.raises(ApiError):
        validate_content(row)
