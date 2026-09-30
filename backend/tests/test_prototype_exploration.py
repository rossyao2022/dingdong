"""Reference explorations use actual child answers, never professional fixture scores."""

import copy
import uuid
from io import StringIO

import pytest
from conftest import assert_schema
from django.core.exceptions import ValidationError
from django.core.management import call_command
from rest_framework.test import APIClient
from test_assessments import setup_assessment

from dingdong_ca.core.models import AssessmentSession, ProfileSnapshot, QuestionnaireVersion

pytestmark = pytest.mark.django_db


def start(client, purpose="interest", selected=None):
    child, grant, *_ = setup_assessment(client, answer=False)
    call_command("import_prototype_content", apply=True, publish=True, stdout=StringIO())
    config = client.get("/api/v1/assessment-config", {"purpose": purpose}).json()
    assert config["available"]
    payload = {
        "request_id": str(uuid.uuid4()),
        "questionnaire_version_id": config["questionnaire_version_id"],
        "consent_grant_id": grant["id"],
    }
    if purpose == "interest":
        payload["selected_islands"] = selected or ["C", "R", "E"]
    response = client.post(f"/api/v1/children/{child['id']}/assessments", payload, format="json")
    assert response.status_code == 201, response.content
    return child, response.json(), payload


def fill(client, session, value):
    response = client.patch(
        f"/api/v1/assessments/{session['id']}/answers",
        {
            "revision": session["revision"],
            "answers": [
                {"question_code": q["code"], "option_codes": [str(value)]}
                for q in session["questions"]
            ],
        },
        format="json",
    )
    assert response.status_code == 200, response.content
    return response.json()


def complete(client, session):
    response = client.post(
        f"/api/v1/assessments/{session['id']}/complete-exploration",
        {"revision": session["revision"]},
        format="json",
    )
    assert response.status_code == 200, response.content
    return response.json()


@pytest.mark.parametrize("value", [0, 4])
def test_interest_order_subset_actual_scores_and_idempotency(client, value):
    child, session, payload = start(client)
    assert len(session["questions"]) == 9
    assert [q["code"] for q in session["questions"]] == [
        f"{x}-{i}" for x in ["C", "R", "E"] for i in range(3)
    ]
    assert session["exploration_result"] is None
    replay = client.post(f"/api/v1/children/{child['id']}/assessments", payload, format="json")
    assert replay.status_code == 200 and replay.json()["id"] == session["id"]
    conflict = {**payload, "selected_islands": ["R", "C", "E"]}
    assert (
        client.post(
            f"/api/v1/children/{child['id']}/assessments", conflict, format="json"
        ).status_code
        == 409
    )
    bad = client.patch(
        f"/api/v1/assessments/{session['id']}/answers",
        {"revision": 1, "answers": [{"question_code": "I-0", "option_codes": ["4"]}]},
        format="json",
    )
    assert bad.status_code == 422
    session = fill(client, session, value)
    done = complete(client, session)
    result = done["exploration_result"]
    assert [p["id"] for p in result["profiles"]] == ["C", "R", "E"]
    assert all(p["score"] == value and p["total"] == value * 3 for p in result["profiles"])
    assert result["scoring_version"] == "interest-mean-v1"
    assert result["questionnaire_version_id"] == session["questionnaire_version_id"]
    assert complete(client, session) == done
    assert client.get(f"/api/v1/assessments/{session['id']}").json()["exploration_result"] == result
    assert ProfileSnapshot.objects.count() == 0
    assert fill_rejected(client, session).json()["code"] == "STATE_CONFLICT"
    model = AssessmentSession.objects.get(pk=session["id"])
    model.answers = {}
    with pytest.raises(ValidationError):
        model.save()
    assert_schema("Assessment", done)


def fill_rejected(client, session):
    return client.patch(
        f"/api/v1/assessments/{session['id']}/answers",
        {"revision": session["revision"], "answers": []},
        format="json",
    )


@pytest.mark.parametrize("value", [1, 5])
def test_talent_scores_and_filter(client, value):
    child, session, _ = start(client, "talent")
    assert len(session["questions"]) == 24
    session = fill(client, session, value)
    done = complete(client, session)
    assert len(done["exploration_result"]["dimensions"]) == 8
    assert all(d["score"] == value * 3 for d in done["exploration_result"]["dimensions"])
    rows = client.get(f"/api/v1/children/{child['id']}/assessments", {"purpose": "talent"}).json()[
        "items"
    ]
    assert len(rows) == 1 and rows[0]["id"] == session["id"]


def test_incomplete_revision_wrong_options_and_family_isolation(client):
    from conftest import sign_in

    child, session, payload = start(client)
    url = f"/api/v1/assessments/{session['id']}"
    assert (
        client.post(url + "/complete-exploration", {"revision": 1}, format="json").json()["code"]
        == "ANSWERS_INCOMPLETE"
    )
    bad = client.patch(
        url + "/answers",
        {"revision": 1, "answers": [{"question_code": "C-0", "option_codes": ["5"]}]},
        format="json",
    )
    assert bad.status_code == 422
    session = fill(client, session, 0)
    assert (
        client.patch(url + "/answers", {"revision": 1, "answers": []}, format="json").json()["code"]
        == "REVISION_CONFLICT"
    )
    other = APIClient(enforce_csrf_checks=True)
    sign_in(other, "+8613800000034")
    assert other.get(url).status_code == 404
    assert other.get(f"/api/v1/children/{child['id']}/assessments").status_code == 404
    assert (
        other.post(
            url + "/complete-exploration", {"revision": session["revision"]}, format="json"
        ).status_code
        == 404
    )
    for selected in [[], ["R", "R", "A"], ["R", "I"], ["R", "I", "X"]]:
        data = {**payload, "request_id": str(uuid.uuid4()), "selected_islands": selected}
        assert (
            client.post(
                f"/api/v1/children/{child['id']}/assessments", data, format="json"
            ).status_code
            == 422
        )


def test_import_dry_run_repeat_and_frozen_scoring():
    call_command("import_prototype_content", stdout=StringIO())
    assert QuestionnaireVersion.objects.count() == 0
    call_command("import_prototype_content", apply=True, publish=True, stdout=StringIO())
    call_command("import_prototype_content", apply=True, publish=True, stdout=StringIO())
    assert QuestionnaireVersion.objects.count() == 2
    q = QuestionnaireVersion.objects.get(purpose="interest")
    q.scoring = copy.deepcopy(q.scoring)
    q.scoring["version"] = "changed"
    with pytest.raises(ValidationError):
        q.save()


def test_ops_new_version_preserves_history_and_scoring(client):
    from ops_helpers import make_staff, ops_client, post_json

    child, session, _ = start(client)
    session = fill(client, session, 2)
    original = complete(client, session)
    staff = ops_client(make_staff("content", "operations"))
    old_id = session["questionnaire_version_id"]
    copied = post_json(
        staff, f"/ops/api/questionnaires/{old_id}/copy", {"request_id": str(uuid.uuid4())}
    )
    assert copied.status_code == 201, copied.content
    new_id = copied.json()["id"]
    old = QuestionnaireVersion.objects.get(pk=old_id)
    new = QuestionnaireVersion.objects.get(pk=new_id)
    assert new.scoring == old.scoring
    questions = copy.deepcopy(new.questions)
    questions[0]["title"] = "换一种安全材料，再试一次搭建。"
    saved = post_json(
        staff,
        f"/ops/api/questionnaires/{new_id}",
        {
            "title": new.title,
            "description": new.description,
            "questions": questions,
            "revision": new.revision,
        },
    )
    assert saved.status_code == 200, saved.content
    published = staff.post(f"/api/v1/staff/questionnaires/{new_id}/publish")
    assert published.status_code == 200, published.content
    assert client.get(f"/api/v1/assessments/{session['id']}").json() == original
    assert client.get("/api/v1/assessment-config", {"purpose": "interest"}).json()[
        "questionnaire_version_id"
    ] == str(new_id)
    old.refresh_from_db()
    assert old.status == "retired"
    old.scoring = {**old.scoring, "version": "changed"}
    with pytest.raises(ValidationError):
        old.save()
    preview = staff.get(f"/ops/questionnaires/{new_id}/preview/")
    assert preview.status_code == 200 and "换一种安全材料" in preview.content.decode()
    detail = staff.get(f"/ops/children/{child['id']}/")
    assert detail.status_code == 200 and "本次观察结果" in detail.content.decode()
    assert "2.00 / 4" in detail.content.decode()


def test_reference_content_matches_parent_choices_and_guide_activities():
    from dingdong_ca.core.models import ActivityContentVersion
    from dingdong_ca.core.services.prototype_content import reference_data

    call_command("import_prototype_content", apply=True, publish=True, stdout=StringIO())
    q = QuestionnaireVersion.objects.get(purpose="interest")
    assert [x["label"] for x in q.questions[0]["options"]] == [
        "很不喜欢",
        "不太喜欢",
        "不确定",
        "有点喜欢",
        "非常喜欢",
    ]
    data = reference_data()
    for pattern, code in [
        ("whorl", "prototype-paper-bridge"),
        ("loop", "prototype-building"),
        ("reverse", "prototype-story-route"),
        ("arch", "prototype-two-plays"),
    ]:
        actual = ActivityContentVersion.objects.get(code=code)
        source = data["fingerprint_guides"][pattern]["activity"]
        assert actual.title == source["title"]
        assert actual.content["materials"] == source["materials"]
        assert [s["instruction"] for s in actual.content["steps"]] == source["steps"]
    assert (
        ActivityContentVersion.objects.filter(status="published", data_origin="reference").count()
        == 10
    )


def test_talent_ties_retain_all_dimensions(client):
    _, session, _ = start(client, "talent")
    session = fill(client, session, 3)
    result = complete(client, session)["exploration_result"]
    assert [row["id"] for row in result["dimensions"]] == [
        "word",
        "music",
        "logic",
        "space",
        "body",
        "self",
        "social",
        "nature",
    ]
    assert all(row["score"] == 9 for row in result["dimensions"])


def test_purpose_filter_cursor_is_bound_and_original_sort_preserved(client):
    child, old, payload = start(client)
    newer = client.post(
        f"/api/v1/children/{child['id']}/assessments",
        {**payload, "request_id": str(uuid.uuid4()), "selected_islands": ["R", "I", "A"]},
        format="json",
    ).json()
    url = f"/api/v1/children/{child['id']}/assessments"
    filtered = client.get(url, {"purpose": "interest", "page_size": 1}).json()
    assert filtered["items"][0]["id"] == newer["id"]
    next_page = client.get(
        url, {"purpose": "interest", "cursor": filtered["next_cursor"], "page_size": 1}
    ).json()
    assert next_page["items"][0]["id"] == old["id"]
    assert (
        client.get(url, {"purpose": "talent", "cursor": filtered["next_cursor"]}).status_code == 422
    )
    assert client.get(url).json()["items"][-1]["id"] == newer["id"]


def test_reference_exploration_independent_of_algorithm_gate(client, settings):
    child, session, payload = start(client)
    settings.INTEGRATION_DATA_SOURCE = "disabled"
    assert client.get("/api/v1/assessment-config", {"purpose": "interest"}).json()["available"]
    assert not client.get("/api/v1/assessment-config").json()["available"]
    assert (
        client.post(
            f"/api/v1/children/{child['id']}/assessments",
            {**payload, "request_id": str(uuid.uuid4())},
            format="json",
        ).status_code
        == 201
    )
    assert (
        client.post(
            f"/api/v1/assessments/{session['id']}/submit", {}, format="multipart"
        ).status_code
        == 422
    )


@pytest.mark.parametrize("change", ["rating", "group", "source", "required"])
def test_publish_rejects_invalid_scoring_and_options(change):
    from dingdong_ca.core.api.common import ApiError
    from dingdong_ca.core.api.staff import validate_content
    from dingdong_ca.core.services.prototype_content import questionnaire_payloads

    q = QuestionnaireVersion(**questionnaire_payloads()[0])
    if change == "rating":
        q.questions[0]["options"][0]["code"] = "5"
    elif change == "group":
        q.scoring["groups"]["R-0"] = "I"
    elif change == "source":
        q.scoring["source_commit"] = "z" * 40
    else:
        q.questions[0]["required"] = False
    with pytest.raises(ApiError):
        validate_content(q)
