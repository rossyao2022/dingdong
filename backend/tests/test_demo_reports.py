"""Fresh unbound families use the real report job, with no fabricated scores."""

import uuid
from io import StringIO

import pytest
from conftest import create_child, sign_in
from django.apps import apps
from django.core.management import call_command
from django.test import override_settings
from test_assessments import submit

pytestmark = pytest.mark.django_db


def fresh_assessment(client):
    call_command("seed_mock", dataset="phase1-v1", mode="cold", stdout=StringIO())
    sign_in(client, "+8613800000082")
    child = create_child(client)
    policy = client.get("/api/v1/policies/current", {"purpose": "assessment_processing"}).json()
    consent = client.post(
        f"/api/v1/children/{child['id']}/consents",
        {
            "request_id": str(uuid.uuid4()),
            "policy_version_id": policy["id"],
        },
        format="json",
    ).json()
    config = client.get("/api/v1/assessment-config").json()
    response = client.post(
        f"/api/v1/children/{child['id']}/assessments",
        {
            "request_id": str(uuid.uuid4()),
            "questionnaire_version_id": config["questionnaire_version_id"],
            "consent_grant_id": consent["id"],
        },
        format="json",
    )
    assert response.status_code == 201, response.content
    session = response.json()
    response = client.patch(
        f"/api/v1/assessments/{session['id']}/answers",
        {
            "revision": session["revision"],
            "answers": [
                {"question_code": q["code"], "option_codes": [q["options"][0]["code"]]}
                for q in config["questions"]
            ],
        },
        format="json",
    )
    assert response.status_code == 200, response.content
    assert (
        not apps.get_model("testsupport", "TestFixture")
        .objects.filter(subject_key=child["id"])
        .exists()
    )
    assert not apps.get_model("core", "CaAccount").objects.filter(child_id=child["id"]).exists()
    return child, response.json()


@override_settings(APP_ENV="demo", CA_DEMO_REPORTS_ENABLED=True)
def test_fresh_unbound_family_completes_real_report_job(client):
    _, session = fresh_assessment(client)
    key = str(uuid.uuid4())
    result = submit(client, session, request_id=key)
    assert result.status_code == 200, result.content
    profile = apps.get_model("core", "ProfileSnapshot").objects.get(pk=result.json()["profile_id"])
    assert all(metric["value"] is None for metric in profile.result["metrics"])
    Report = apps.get_model("core", "ReportVersion")
    assert not Report.objects.exists()
    job = apps.get_model("core", "BackgroundJob").objects.get(profile=profile)
    from dingdong_ca.core.tasks import run_report_job

    run_report_job(str(job.pk))
    run_report_job(str(job.pk))
    completed = client.get(f"/api/v1/assessments/{session['id']}").json()
    assert completed["report_status"] == "ready"
    report = client.get("/api/v1/reports/" + completed["report_id"])
    assert report.status_code == 200 and report.json()["data_origin"] == "synthetic"
    answers = next(section for section in report.json()["sections"] if section["code"] == "choices")
    assert len(answers["paragraphs"]) == 22
    assert all("未选择" not in answer for answer in answers["paragraphs"])
    assert Report.objects.count() == 1
    assert submit(client, session, request_id=key).status_code == 200
    assert apps.get_model("core", "AlgorithmAttempt").objects.count() == 1


@pytest.mark.parametrize(
    "app_env, enabled, expected",
    [
        ("demo", False, "FIXTURE_NOT_FOUND"),
        ("test", True, "FIXTURE_NOT_FOUND"),
        ("production", True, "INTEGRATION_NOT_READY"),
    ],
)
def test_demo_fallback_cannot_enable_formal_or_disabled_flow(client, app_env, enabled, expected):
    child, session = fresh_assessment(client)
    from dingdong_ca.testsupport.adapter import FixtureFailure, initial_result

    with override_settings(APP_ENV=app_env, CA_DEMO_REPORTS_ENABLED=enabled):
        with pytest.raises(FixtureFailure) as error:
            initial_result(child["id"], session["questionnaire_version_id"])
    assert error.value.code == expected


@override_settings(APP_ENV="demo", CA_DEMO_REPORTS_ENABLED=True)
@pytest.mark.parametrize(
    "kind, payload, expected",
    [
        ("initial_result", {}, "UPSTREAM_SCHEMA_INVALID"),
        ("fault", {"scenario": "assessment_failure"}, "UPSTREAM_UNAVAILABLE"),
    ],
)
def test_demo_fallback_preserves_existing_fault_and_invalid_input(client, kind, payload, expected):
    child, session = fresh_assessment(client)
    Fixture = apps.get_model("testsupport", "TestFixture")
    Fixture.objects.create(
        dataset="phase1-v1", kind=kind, subject_key=child["id"], sequence=1, payload=payload
    )
    from dingdong_ca.testsupport.adapter import FixtureFailure, initial_result

    with pytest.raises(FixtureFailure) as error:
        initial_result(child["id"], session["questionnaire_version_id"])
    assert error.value.code == expected


@override_settings(APP_ENV="demo", CA_DEMO_REPORTS_ENABLED=True)
def test_demo_fallback_only_accepts_original_synthetic_assessment_bank(client):
    child, _ = fresh_assessment(client)
    Questionnaire = apps.get_model("core", "QuestionnaireVersion")
    from dingdong_ca.testsupport.adapter import FixtureFailure, initial_result

    other = Questionnaire.objects.filter(purpose="exploration", status="published").first()
    assert other is not None
    with pytest.raises(FixtureFailure) as error:
        initial_result(child["id"], other.pk)
    assert error.value.code == "FIXTURE_NOT_FOUND"
    with override_settings(INTEGRATION_DATA_SOURCE="real_vendor"):
        with pytest.raises(FixtureFailure) as error:
            initial_result(child["id"], other.pk)
    assert error.value.code == "INTEGRATION_NOT_READY"
