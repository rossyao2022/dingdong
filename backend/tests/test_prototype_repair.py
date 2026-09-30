"""Approved audit repairs: child preferences, safe export, summaries and deletion guard."""

import copy
import uuid
from io import StringIO

import pytest
from conftest import assert_schema, create_child, sign_in
from django.apps import apps
from django.core.management import call_command
from django.utils import timezone
from ops_helpers import make_staff, ops_client
from rest_framework.test import APIClient
from test_assessments import setup_assessment
from test_ca_accounts import issue, setup_child

from dingdong_ca.core.models import (
    CaAccount,
    CaReassessmentEvent,
    QuestionnaireVersion,
)

pytestmark = pytest.mark.django_db


def core_snapshot():
    return {
        model._meta.db_table: list(model.objects.order_by("pk").values())
        for model in apps.get_app_config("core").get_models()
    }


@pytest.mark.parametrize("state", ["unbound", "bound", "retired", "fixed"])
def test_delete_guard_returns_structured_conflict_and_changes_nothing(client, settings, state):
    child, grant, session, *_ = setup_assessment(client, answer=False)
    token = "SYNTHETIC-NFC-DELETE-TEST"
    if state == "fixed":
        settings.APP_ENV = "demo"
        settings.DINGDONG_PROTOTYPE_DEMO_ENABLED = True
        settings.DINGDONG_PROTOTYPE_NFC_TOKEN = token
    response = issue(client, child, token=token)
    assert response.status_code == 201
    account = CaAccount.objects.get(ca_account_id=response.json()["ca_account_id"])
    if state == "fixed":
        assert account.ca_account_id == "ca_dingdong"
    assert (
        client.patch(
            f"/api/v1/children/{child['id']}/companion-preference",
            {"guide_mode": "open", "revision": 0},
            format="json",
        ).status_code
        == 200
    )
    if state == "bound":
        CaAccount.objects.filter(pk=account.pk).update(bind_state="bound")
    elif state == "retired":
        assert (
            client.post(
                f"/api/v1/ca-accounts/{account.ca_account_id}/retire", {}, format="json"
            ).status_code
            == 200
        )
    request = client.post(
        f"/api/v1/children/{child['id']}/data-requests",
        {"request_id": str(uuid.uuid4()), "kind": "deletion", "reason_code": "delete_child_data"},
        format="json",
    )
    assert request.status_code == 201
    staff = ops_client(make_staff("technical"))
    snapshot = core_snapshot()
    response = staff.post(
        f"/api/v1/staff/data-requests/{request.json()['id']}/resolve",
        {"action": "execute_deletion", "resolution_code": "deleted"},
        format="json",
    )
    assert response.status_code == 409, response.content
    assert response.json()["code"] == "CA_ACCOUNT_CONFLICT"
    assert "机器人" in response.json()["message"]
    assert core_snapshot() == snapshot


def test_preference_read_is_write_free_and_patch_is_owned_versioned(client):
    child = setup_child(client)
    url = f"/api/v1/children/{child['id']}/companion-preference"
    snapshot = core_snapshot()
    response = client.get(url)
    assert response.status_code == 200
    assert response.json() == {"child_id": child["id"], "guide_mode": "cognitive", "revision": 0}
    assert core_snapshot() == snapshot
    patch = client.patch(url, {"guide_mode": "imitative", "revision": 0}, format="json")
    assert patch.status_code == 200 and patch.json()["revision"] == 1
    assert_schema("CompanionPreference", patch.json())
    assert client.get(url).json() == patch.json()
    assert (
        client.patch(url, {"guide_mode": "reverse", "revision": 0}, format="json").json()["code"]
        == "REVISION_CONFLICT"
    )
    assert (
        client.patch(url, {"guide_mode": "emotional", "revision": 1}, format="json").status_code
        == 422
    )
    assert client.patch(url, {"guide_mode": "open"}, format="json").status_code == 422
    other = APIClient(enforce_csrf_checks=True)
    sign_in(other, "+8613800000089")
    assert other.get(url).status_code == 404
    assert other.patch(url, {"guide_mode": "open", "revision": 1}, format="json").status_code == 404
    second = create_child(client, name="另一个合成儿童")
    assert (
        client.get(f"/api/v1/children/{second['id']}/companion-preference").json()["revision"] == 0
    )
    modes = ["reverse", "open", "cognitive"]
    for revision, mode in enumerate(modes, 1):
        saved = client.patch(url, {"guide_mode": mode, "revision": revision}, format="json")
        assert saved.status_code == 200 and saved.json()["revision"] == revision + 1
    audits = apps.get_model("core", "AuditEvent").objects.filter(
        action="companion_preference.update"
    )
    assert audits.count() == 4
    assert all(
        "测试" not in row.target_label and set(row.detail) <= {"guide_mode", "revision"}
        for row in audits
    )


def test_activity_guide_mode_is_independent_idempotent_and_legacy_compatible(client):
    call_command("seed_mock", dataset="phase1-v1", mode="cold", stdout=StringIO())
    child = setup_child(client)
    activity = client.get("/api/v1/activities").json()["items"][0]
    url = f"/api/v1/children/{child['id']}/activity-records"
    payload = {
        "request_id": str(uuid.uuid4()),
        "activity_version_id": activity["id"],
        "mode": "guide",
        "style": activity["allowed_styles"][0],
        "guide_mode": "reverse",
    }
    result = client.post(url, payload, format="json")
    assert result.status_code == 201, result.content
    record = result.json()
    assert record["guide_mode"] == "reverse" and record["style"] == payload["style"]
    assert_schema("ActivityRecord", record)
    assert client.post(url, payload, format="json").status_code == 200
    assert (
        client.post(url, {**payload, "guide_mode": "open"}, format="json").json()["code"]
        == "IDEMPOTENCY_CONFLICT"
    )
    assert (
        client.post(url, {**payload, "guide_mode": "emotional"}, format="json").status_code == 422
    )
    assert (
        client.post(
            f"/api/v1/activity-records/{record['id']}/finish", {"status": "skipped"}, format="json"
        ).status_code
        == 200
    )
    payload.pop("guide_mode")
    payload["request_id"] = str(uuid.uuid4())
    legacy = client.post(url, payload, format="json")
    assert legacy.status_code == 201 and legacy.json()["guide_mode"] == ""


def session_for(client, child, grant, q):
    response = client.post(
        f"/api/v1/children/{child['id']}/assessments",
        {
            "request_id": str(uuid.uuid4()),
            "questionnaire_version_id": str(q.pk),
            "consent_grant_id": grant["id"],
        },
        format="json",
    )
    assert response.status_code == 201
    session = response.json()
    saved = client.patch(
        f"/api/v1/assessments/{session['id']}/answers",
        {
            "revision": session["revision"],
            "answers": [
                {"question_code": f"Q{i:02}", "option_codes": [code]}
                for i, code in enumerate(["A", "B", "A", "D"], 1)
            ],
        },
        format="json",
    )
    assert saved.status_code == 200
    finished = client.post(
        f"/api/v1/assessments/{session['id']}/complete-exploration",
        {"revision": saved.json()["revision"]},
        format="json",
    )
    assert finished.status_code == 200
    return finished.json()


def test_guidance_summary_uses_fixed_option_codes_only_for_completed_default_bank(client):
    child, grant, _, *_ = setup_assessment(client, answer=False)
    source = QuestionnaireVersion.objects.get(code="exploration", status="published")
    source.status = "retired"
    source.save()
    questions = copy.deepcopy(source.questions)
    for question in questions:
        question["options"].reverse()
    q = QuestionnaireVersion.objects.create(
        code="exploration",
        version="v2",
        title=source.title,
        description=source.description,
        purpose="exploration",
        data_origin="synthetic",
        questions=questions,
        status="published",
    )
    result = session_for(client, child, grant, q)
    assert result["guidance_summary"] == {
        "questionnaire_version_id": str(q.pk),
        "content_version": "v2",
        "answered_count": 4,
        "counts": {"cognitive": 2, "imitative": 1, "reverse": 0, "open": 1},
    }
    assert_schema("Assessment", result)
    custom = QuestionnaireVersion.objects.create(
        code="custom-other-four",
        version="v1",
        title=source.title,
        description=source.description,
        purpose="exploration",
        data_origin="synthetic",
        questions=questions,
        status="published",
    )
    assert session_for(client, child, grant, custom)["guidance_summary"] is None


def test_export_contains_current_child_actual_records_without_credentials_or_images(client):
    from test_prototype_exploration import complete, fill, start

    child, interest, payload = start(client)
    done = complete(client, fill(client, interest, 3))
    assert issue(client, child, token="SYNTHETIC-SECRET-TOKEN-FOR-EXPORT").status_code == 201
    preference_url = f"/api/v1/children/{child['id']}/companion-preference"
    assert (
        client.patch(
            preference_url, {"guide_mode": "open", "revision": 0}, format="json"
        ).status_code
        == 200
    )
    second = create_child(client, name="不应出现在本次导出的儿童")
    other = APIClient(enforce_csrf_checks=True)
    sign_in(other, "+8613800000091")
    url = f"/api/v1/children/{child['id']}/export"
    assert other.get(url).status_code == 404
    response = client.get(url)
    assert response.status_code == 200, response.content
    data = response.json()
    assert_schema("ChildExport", data)
    assert data["schema_version"] == "ca-child-export-v1"
    assert data["child"]["id"] == child["id"]
    assert data["companion_preference"]["guide_mode"] == "open"
    assert (
        len(data["explorations"]) == 1
        and data["explorations"][0]["exploration_result"] == done["exploration_result"]
    )
    assert data["activities"] == []
    assert second["id"] not in response.content.decode()
    assert all(item["purpose"] != "assessment" for item in data["explorations"])
    encoded = response.content.decode()
    for excluded in [
        "phone",
        "access_token",
        "refresh_token",
        "password",
        "nfc_token",
        "fingerprint",
        "upload",
        "SYNTHETIC-SECRET-TOKEN-FOR-EXPORT",
    ]:
        assert excluded not in encoded


def test_delete_child_without_robot_removes_guide_preference(client):
    child = setup_child(client)
    preference_url = f"/api/v1/children/{child['id']}/companion-preference"
    assert (
        client.patch(
            preference_url, {"guide_mode": "open", "revision": 0}, format="json"
        ).status_code
        == 200
    )
    event_model = apps.get_model("core", "AuditEvent")
    preference_event = event_model.objects.get(action="companion_preference.update")
    assert preference_event.target_id is not None
    request = client.post(
        f"/api/v1/children/{child['id']}/data-requests",
        {"request_id": str(uuid.uuid4()), "kind": "deletion", "reason_code": "delete_child_data"},
        format="json",
    ).json()
    staff = ops_client(make_staff("technical"))
    response = staff.post(
        f"/api/v1/staff/data-requests/{request['id']}/resolve",
        {"action": "execute_deletion", "resolution_code": "deleted"},
        format="json",
    )
    assert response.status_code == 200
    assert apps.get_model("core", "ChildCompanionPreference").objects.count() == 0
    preference_event.refresh_from_db()
    assert preference_event.target_id is None


def test_operator_preview_explains_full_bank_and_independent_publish(client):
    from ops_helpers import post_json

    call_command("import_prototype_content", apply=True, publish=True, stdout=StringIO())
    staff = ops_client(make_staff("content"))
    create_page = staff.get("/ops/questionnaires/new/")
    assert create_page.status_code == 200
    assert "复制当前默认题库为新版本" in create_page.content.decode()
    for purpose, words in [
        ("interest", ["整库预览", "18", "9", "0–4"]),
        ("talent", ["整库预览", "24", "3–15"]),
    ]:
        default = QuestionnaireVersion.objects.get(code=f"prototype-{purpose}")
        preview = staff.get(f"/ops/questionnaires/{default.pk}/preview/")
        assert preview.status_code == 200
        assert all(word in preview.content.decode() for word in words)
        copied = post_json(
            staff,
            "/ops/api/questionnaires",
            {"title": "独立参考问卷", "purpose": purpose, "description": "供运营预览的新草稿"},
        )
        assert copied.status_code == 201
        independent_id = copied.json()["questionnaire"]["id"]
        preview = staff.get(f"/ops/questionnaires/{independent_id}/preview/")
        assert "不会替换当前展会首页" in preview.content.decode()
        edit = staff.get(f"/ops/questionnaires/{independent_id}/")
        assert "不会替换当前展会首页" in edit.content.decode()


@pytest.mark.django_db(transaction=True)
def test_concurrent_initial_preference_patch_has_one_winner(client):
    from concurrent.futures import ThreadPoolExecutor

    from django.db import close_old_connections

    login = sign_in(client, "+8613800000092")
    child = create_child(client)
    url = f"/api/v1/children/{child['id']}/companion-preference"

    def attempt(mode):
        close_old_connections()
        try:
            concurrent = APIClient()
            concurrent.credentials(HTTP_AUTHORIZATION="Bearer " + login["access_token"])
            response = concurrent.patch(url, {"guide_mode": mode, "revision": 0}, format="json")
            return response.status_code, response.json().get("code")
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(attempt, ["imitative", "reverse"]))
    assert sorted(status for status, _ in results) == [200, 409]
    assert [code for status, code in results if status == 409] == ["REVISION_CONFLICT"]
    assert (
        apps.get_model("core", "ChildCompanionPreference")
        .objects.filter(child_id=child["id"])
        .count()
        == 1
    )
    assert client.get(url).json()["revision"] == 1


def test_export_includes_fixed_activity_guidance_and_four_choice_records(client):
    child, grant, *_ = setup_assessment(client, answer=False)
    q = QuestionnaireVersion.objects.get(code="exploration", status="published")
    completed = session_for(client, child, grant, q)
    activity = client.get("/api/v1/activities").json()["items"][0]
    record = client.post(
        f"/api/v1/children/{child['id']}/activity-records",
        {
            "request_id": str(uuid.uuid4()),
            "activity_version_id": activity["id"],
            "mode": "guide",
            "style": activity["allowed_styles"][0],
            "guide_mode": "imitative",
        },
        format="json",
    ).json()
    export = client.get(f"/api/v1/children/{child['id']}/export")
    assert export.status_code == 200
    assert_schema("ChildExport", export.json())
    assert export.json()["activities"] == [record]
    assert export.json()["explorations"] == [completed]
    assert export.json()["companion_preference"]["revision"] == 0


def test_deletion_guard_covers_protected_historical_event_before_mutation(client):
    child, grant, *_ = setup_assessment(client, answer=False)
    other_child = create_child(client, name="关联历史所属的另一个合成儿童")
    account_response = issue(client, other_child, token="SYNTHETIC-EVENT-HISTORY")
    account = CaAccount.objects.get(ca_account_id=account_response.json()["ca_account_id"])
    # Defensive legacy-state check: event child FK is independently protected.
    CaReassessmentEvent.objects.create(
        event_id="synthetic-history",
        ca_account=account,
        child_id=child["id"],
        trigger_type="manual",
        recommended_at=timezone.now(),
    )
    request = client.post(
        f"/api/v1/children/{child['id']}/data-requests",
        {"request_id": str(uuid.uuid4()), "kind": "deletion", "reason_code": "delete_child_data"},
        format="json",
    ).json()
    staff = ops_client(make_staff("technical"))
    snapshot = core_snapshot()
    response = staff.post(
        f"/api/v1/staff/data-requests/{request['id']}/resolve",
        {"action": "execute_deletion", "resolution_code": "deleted"},
        format="json",
    )
    assert response.status_code == 409 and response.json()["code"] == "CA_ACCOUNT_CONFLICT"
    assert core_snapshot() == snapshot
