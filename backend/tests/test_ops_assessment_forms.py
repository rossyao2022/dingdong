"""Actual saved answers become a staff-only, reproducible handoff form."""

import csv
import io
import json
import uuid

import pytest
from django.test import override_settings
from django.urls import reverse
from ops_helpers import make_family, make_staff, ops_client
from test_assessments import submit
from test_demo_reports import fresh_assessment
from test_prototype_exploration import complete, fill, start

from dingdong_ca.core.models import AssessmentSession, AuditEvent, ChildCompanionPreference
from dingdong_ca.core.services.assessment_forms import csv_cell

pytestmark = pytest.mark.django_db


def form_url(child, suffix=""):
    return f"/ops/children/{child['id']}/assessment-form/{suffix}"


def saved_interest(client):
    child, session, _ = start(client)
    done = complete(client, fill(client, session, 3))
    staff = ops_client(make_staff("operations"))
    return child, done, staff


def test_preview_json_csv_and_copy_are_same_selected_snapshot(client):
    child, done, staff = saved_interest(client)
    preview = staff.get(form_url(child))
    assert preview.status_code == 200
    assert "测评表单" in preview.content.decode()
    document = preview.context["document"]
    snapshot = preview.context["snapshot"]
    assert document["schema_version"] == "ca-assessment-form-v1"
    assert len(document["assessments"]) == 1
    item = document["assessments"][0]
    assert item["assessment_id"] == done["id"]
    assert len(item["questions"]) == 9
    assert item["result"]["profiles"][0]["score"] == 3
    assert item["score_range"] == {"minimum": 0, "maximum": 4}
    assert item["professional_result"] is None
    assert all(q["selected_option_codes"] == ["3"] for q in item["questions"])
    exported = staff.get(form_url(child, "json/"), {"snapshot": snapshot})
    assert exported.status_code == 200
    assert exported.json() == document
    assert exported["Cache-Control"] == "private, no-store"
    copied = staff.get(form_url(child, "copy/"), {"snapshot": snapshot})
    assert copied.status_code == 200
    assert copied.content.decode() == preview.context["copy_text"]
    exported_csv = staff.get(form_url(child, "csv/"), {"snapshot": snapshot})
    rows = list(csv.DictReader(io.StringIO(exported_csv.content.decode("utf-8-sig"))))
    assert len(rows) == 9
    assert rows[0]["测评编号"] == done["id"]
    assert json.loads(rows[0]["原始结果"]) == item["result"]
    assert json.loads(rows[0]["范围"]) == item["score_range"]
    assert "= " not in exported_csv.content.decode()
    events = AuditEvent.objects.filter(action__startswith="assessment_form.")
    assert events.count() == 4
    assert all("answers" not in event.detail for event in events)
    assert all(event.detail["digest"] == document["snapshot_digest"] for event in events)
    assert "phone" not in exported.content.decode()
    assert "birth_date" not in exported.content.decode()
    assert "nfc" not in exported.content.decode()
    assert "child_name" not in exported.content.decode()


def test_latest_per_purpose_and_historical_export_survive_new_completion(client):
    child, done, staff = saved_interest(client)
    preview = staff.get(form_url(child))
    old_snapshot = preview.context["snapshot"]
    old = AssessmentSession.objects.get(pk=done["id"])
    response = client.post(
        f"/api/v1/children/{child['id']}/assessments",
        {
            "request_id": str(uuid.uuid4()),
            "questionnaire_version_id": str(old.questionnaire_version_id),
            "consent_grant_id": str(old.consent_grant_id),
            "selected_islands": ["R", "I", "A"],
        },
        format="json",
    )
    newer = complete(client, fill(client, response.json(), 4))
    latest = staff.get(form_url(child)).context["document"]
    assert latest["assessments"][0]["assessment_id"] == newer["id"]
    assert (
        staff.get(form_url(child, "json/"), {"snapshot": old_snapshot}).json()
        == preview.context["document"]
    )
    historical = staff.get(form_url(child), {"session_id": done["id"]})
    assert historical.context["document"]["assessments"][0]["assessment_id"] == done["id"]


def test_snapshot_tampering_cross_child_and_changed_preference_rejected(client):
    child, _, staff = saved_interest(client)
    snapshot = staff.get(form_url(child)).context["snapshot"]
    assert staff.get(form_url(child, "json/"), {"snapshot": snapshot + "x"}).status_code == 422
    assert staff.get(form_url(child, "json/")).status_code == 422
    _, kids, _ = make_family(phone="+8613800000066")
    assert (
        staff.get(form_url({"id": str(kids[0].pk)}, "json/"), {"snapshot": snapshot}).status_code
        == 422
    )
    ChildCompanionPreference.objects.create(child_id=child["id"], guide_mode="open")
    changed = staff.get(form_url(child, "json/"), {"snapshot": snapshot})
    assert changed.status_code == 409
    assert "重新打开" in changed.content.decode()


@pytest.mark.parametrize("role", ["operations", "technical", "account_admin"])
def test_allowed_roles_and_download_permission(client, role):
    child, _, _ = saved_interest(client)
    staff = ops_client(make_staff(role))
    response = staff.get(form_url(child))
    assert response.status_code == 200
    assert (
        staff.get(form_url(child, "json/"), {"snapshot": response.context["snapshot"]}).status_code
        == 200
    )
    assert (
        reverse("ops:assessment_form", kwargs={"child_id": child["id"]})
        in staff.get(f"/ops/children/{child['id']}/").content.decode()
    )


def test_nonstaff_and_content_role_blocked_on_all_routes(client):
    child, _, staff = saved_interest(client)
    snapshot = staff.get(form_url(child)).context["snapshot"]
    content = ops_client(make_staff("content"))
    for suffix in ["", "json/", "csv/", "copy/"]:
        assert client.get(form_url(child, suffix), {"snapshot": snapshot}).status_code == 302
        assert content.get(form_url(child, suffix), {"snapshot": snapshot}).status_code == 403


def test_bad_history_incomplete_or_foreign_session_not_disclosed(client):
    child, done, staff = saved_interest(client)
    unfinished = AssessmentSession.objects.filter(child_id=child["id"], status="draft").first()
    assert staff.get(form_url(child), {"session_id": "bad"}).status_code == 422
    assert staff.get(form_url(child), {"session_id": str(unfinished.pk)}).status_code == 404
    _, kids, _ = make_family(phone="+8613800000066")
    assert (
        staff.get(form_url({"id": str(kids[0].pk)}), {"session_id": done["id"]}).status_code == 404
    )
    empty = staff.get(form_url({"id": str(kids[0].pk)}))
    assert empty.status_code == 200
    assert empty.context["document"]["assessments"] == []
    assert "还没有已完成的测评" in empty.content.decode()


@override_settings(APP_ENV="demo", CA_DEMO_REPORTS_ENABLED=True)
def test_22_questions_included_with_actual_missing_professional_result(client):
    child, session = fresh_assessment(client)
    assert submit(client, session).status_code == 200
    saved = client.get(f"/api/v1/assessments/{session['id']}").json()
    assert len(saved["choice_summary"]) == 22
    assert all(row["choices"] for row in saved["choice_summary"])
    staff = ops_client(make_staff("operations"))
    response = staff.get(form_url(child))
    assert response.status_code == 200
    item = response.context["document"]["assessments"][0]
    assert item["purpose"] == "assessment"
    assert len(item["questions"]) == 22
    assert all(q["selected_option_codes"] for q in item["questions"])
    assert item["professional_result"]["metrics"][0]["value"] is None
    assert item["score_range"] is None


def test_talent_and_four_scenarios_preserve_original_ranges_and_answers(client):
    child, session, _ = start(client, "talent")
    complete(client, fill(client, session, 5))
    old = AssessmentSession.objects.get(pk=session["id"])
    config = client.get("/api/v1/assessment-config", {"purpose": "exploration"}).json()
    response = client.post(
        f"/api/v1/children/{child['id']}/assessments",
        {
            "request_id": str(uuid.uuid4()),
            "questionnaire_version_id": config["questionnaire_version_id"],
            "consent_grant_id": str(old.consent_grant_id),
        },
        format="json",
    )
    assert response.status_code == 201
    choices = response.json()
    answered = client.patch(
        f"/api/v1/assessments/{choices['id']}/answers",
        {
            "revision": choices["revision"],
            "answers": [
                {"question_code": q["code"], "option_codes": ["A"]} for q in choices["questions"]
            ],
        },
        format="json",
    )
    complete(client, answered.json())
    staff = ops_client(make_staff("operations"))
    response = staff.get(form_url(child), {"session_id": ""})
    assert response.status_code == 200
    assessments = {item["purpose"]: item for item in response.context["document"]["assessments"]}
    assert set(assessments) == {"talent", "exploration"}
    assert assessments["talent"]["score_range"] == {"minimum": 3, "maximum": 15}
    assert len(assessments["talent"]["questions"]) == 24
    assert all(row["score"] == 15 for row in assessments["talent"]["result"]["dimensions"])
    assert len(assessments["exploration"]["questions"]) == 4
    assert assessments["exploration"]["guidance_summary"]["counts"] == {
        "cognitive": 4,
        "imitative": 0,
        "reverse": 0,
        "open": 0,
    }
    assert assessments["exploration"]["score_range"] is None


@pytest.mark.parametrize("value", ["=SUM(A1)", "+cmd", "-cmd", "@cmd", "\t=cmd", "\n=cmd"])
def test_csv_formula_cells_are_escaped(value):
    assert csv_cell(value) == "'" + value


def test_non_get_methods_cannot_access_form_routes(client):
    child, _, staff = saved_interest(client)
    for suffix in ["", "json/", "csv/", "copy/"]:
        assert staff.post(form_url(child, suffix), {}, format="json").status_code == 405


def test_expired_snapshot_requires_fresh_preview(client, monkeypatch):
    child, _, staff = saved_interest(client)
    response = staff.get(form_url(child))
    from django.core import signing

    real_time = signing.time.time
    monkeypatch.setattr(signing.time, "time", lambda: real_time() + 8 * 3600 + 1)
    exported = staff.get(form_url(child, "json/"), {"snapshot": response.context["snapshot"]})
    assert exported.status_code == 422
    assert "已过期" in exported.content.decode()
