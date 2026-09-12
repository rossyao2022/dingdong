import json
import uuid
from io import StringIO

import pytest
from conftest import assert_schema, create_child, sign_in
from django.apps import apps
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db


def setup_assessment(client, *, answer=True):
    call_command("seed_mock", dataset="phase1-v1", mode="cold", stdout=StringIO())
    sign_in(client, "+8613800000018")
    child = create_child(client)
    r = client.get("/api/v1/policies/current", {"purpose": "assessment_processing"})
    assert r.status_code == 200, r.content
    policy = r.json()
    assert_schema("Policy", policy)
    consent_request = {"request_id": str(uuid.uuid4()), "policy_version_id": policy["id"]}
    r = client.post(f"/api/v1/children/{child['id']}/consents", consent_request, format="json")
    assert r.status_code == 201, r.content
    consent = r.json()
    assert_schema("Consent", consent)
    config = client.get("/api/v1/assessment-config").json()
    assert_schema("AssessmentConfig", config)
    assert len(config["questions"]) == 22
    request = {
        "request_id": str(uuid.uuid4()),
        "questionnaire_version_id": config["questionnaire_version_id"],
        "consent_grant_id": consent["id"],
    }
    r = client.post(f"/api/v1/children/{child['id']}/assessments", request, format="json")
    assert r.status_code == 201, r.content
    session = r.json()
    assert_schema("Assessment", session)
    if answer:
        r = client.patch(
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
        assert r.status_code == 200, r.content
        session = r.json()
    call_command(
        "inject_fixture",
        dataset="phase1-v1",
        child_id=child["id"],
        scenario="assessment_success",
        stdout=StringIO(),
    )
    return child, consent, session, request, consent_request


def upload(session, request_id=None):
    from dingdong_ca.testsupport.synthetic import synthetic_png

    return {
        "request_id": request_id or str(uuid.uuid4()),
        "revision": str(session["revision"]),
        **{
            f"slot_{i}": SimpleUploadedFile(
                f"synthetic-{i}.png", synthetic_png(i), content_type="image/png"
            )
            for i in range(1, 6)
        },
    }


def submit(client, session, **kwargs):
    return client.post(
        f"/api/v1/assessments/{session['id']}/submit", upload(session, **kwargs), format="multipart"
    )


def test_consent_idempotency_revoke_and_family_isolation(client):
    child, consent, session, _, data = setup_assessment(client)
    r = client.post(f"/api/v1/children/{child['id']}/consents", data, format="json")
    assert r.status_code == 200 and r.json()["id"] == consent["id"]
    assert_schema("Consents", client.get(f"/api/v1/children/{child['id']}/consents").json())
    other = APIClient(enforce_csrf_checks=True)
    sign_in(other, "+8613800000019")
    assert (
        other.post(f"/api/v1/consents/{consent['id']}/revoke", {}, format="json").status_code == 404
    )
    assert other.get(f"/api/v1/assessments/{session['id']}").status_code == 404
    assert (
        client.post(f"/api/v1/consents/{consent['id']}/revoke", {}, format="json").status_code
        == 200
    )
    assert (
        client.post(f"/api/v1/consents/{consent['id']}/revoke", {}, format="json").status_code
        == 200
    )
    assert submit(client, session).status_code == 403
    assert apps.get_model("core", "ProfileSnapshot").objects.count() == 0


def test_answers_revision_unknown_codes_and_clear(client):
    _, _, session, _, _ = setup_assessment(client, answer=False)
    url = f"/api/v1/assessments/{session['id']}/answers"
    assert client.patch(url, {"revision": 9, "answers": []}, format="json").status_code == 409
    for answer in [
        {"question_code": "UNKNOWN", "option_codes": ["A"]},
        {"question_code": "Q01", "option_codes": ["UNKNOWN"]},
        {"question_code": "Q01", "option_codes": ["A", "B"]},
    ]:
        assert (
            client.patch(url, {"revision": 1, "answers": [answer]}, format="json").status_code
            == 422
        )
    r = client.patch(
        url,
        {"revision": 1, "answers": [{"question_code": "Q01", "option_codes": ["A"]}]},
        format="json",
    )
    assert r.status_code == 200 and "Q01" not in r.json()["missing_question_codes"]
    r = client.patch(
        url,
        {
            "revision": r.json()["revision"],
            "answers": [{"question_code": "Q01", "option_codes": []}],
        },
        format="json",
    )
    assert "Q01" in r.json()["missing_question_codes"]
    assert submit(client, r.json()).status_code == 422


def test_session_creation_idempotent_and_published_questionnaire_is_frozen(client):
    child, _, session, data, _ = setup_assessment(client)
    r = client.post(f"/api/v1/children/{child['id']}/assessments", data, format="json")
    assert r.status_code == 200 and r.json()["id"] == session["id"]
    Model = apps.get_model("core", "QuestionnaireVersion")
    row = Model.objects.get(pk=session["questionnaire_version_id"])
    row.questions[0]["title"] = "不允许修改发布内容"
    with pytest.raises(Exception, match="published|发布"):
        row.save()
    row.refresh_from_db()
    assert (
        client.get(f"/api/v1/assessments/{session['id']}").json()["questions"][0]["title"]
        == row.questions[0]["title"]
    )


def test_initial_profile_and_real_report_job_are_created_once(client):
    _, _, session, _, _ = setup_assessment(client)
    key = str(uuid.uuid4())
    r = submit(client, session, request_id=key)
    assert r.status_code == 200, r.content
    assert_schema("SubmitResult", r.json())
    assert r.json()["status"] == "completed"
    assert apps.get_model("core", "ProfileSnapshot").objects.count() == 1
    assert (
        apps.get_model("core", "ReportVersion").objects.count() == 0
    )  # no prebuilt report returned by API
    job = apps.get_model("core", "BackgroundJob").objects.get(profile_id=r.json()["profile_id"])
    from dingdong_ca.core.tasks import run_report_job

    run_report_job(str(job.pk))
    run_report_job(str(job.pk))
    response = client.get(f"/api/v1/assessments/{session['id']}")
    assert response.json()["report_status"] == "ready"
    report = client.get("/api/v1/reports/" + response.json()["report_id"])
    assert report.status_code == 200
    assert_schema("Report", report.json())
    assert report.json()["data_origin"] == "synthetic"
    assert apps.get_model("core", "ReportVersion").objects.count() == 1
    assert submit(client, session, request_id=key).status_code == 200
    assert apps.get_model("core", "AlgorithmAttempt").objects.count() == 1
    assert submit(client, session).status_code == 409


@pytest.mark.parametrize("bad", ["missing", "unknown", "duplicate", "invalid", "oversize"])
def test_upload_rejects_invalid_input_without_creating_attempt(client, bad):
    _, _, session, _, _ = setup_assessment(client)
    data = upload(session)
    if bad == "missing":
        del data["slot_5"]
    if bad == "unknown":
        data["slot_6"] = data.pop("slot_5")
    if bad == "duplicate":
        data["slot_1"] = [
            data["slot_1"],
            SimpleUploadedFile("extra.png", b"bad", content_type="image/png"),
        ]
    if bad == "invalid":
        data["slot_1"] = SimpleUploadedFile(
            "not-synthetic.png", b"not-an-image", content_type="image/png"
        )
    if bad == "oversize":
        data["slot_1"] = SimpleUploadedFile(
            "oversize.png", b"x" * (1024 * 1024 + 1), content_type="image/png"
        )
    r = client.post(f"/api/v1/assessments/{session['id']}/submit", data, format="multipart")
    assert r.status_code in [413, 422], r.content
    assert_schema("Error", r.json())
    assert apps.get_model("core", "AlgorithmAttempt").objects.count() == 0


def test_fixture_output_is_whitelisted_not_arbitrary_json(client):
    child, _, session, _, _ = setup_assessment(client)
    Fixture = apps.get_model("testsupport", "TestFixture")
    row = Fixture.objects.get(kind="initial_result", subject_key=child["id"])
    row.payload["fingerprint_template"] = "must-never-save"
    row.save()
    r = submit(client, session)
    assert r.status_code == 503
    assert apps.get_model("core", "ProfileSnapshot").objects.count() == 0
    assert "must-never-save" not in r.content.decode()


def test_timeout_can_be_cancelled_and_does_not_create_results(client):
    child, _, session, _, _ = setup_assessment(client)
    call_command(
        "inject_fixture",
        dataset="phase1-v1",
        child_id=child["id"],
        scenario="assessment_timeout",
        stdout=StringIO(),
    )
    key = str(uuid.uuid4())
    r = submit(client, session, request_id=key)
    assert r.status_code == 202 and r.json()["status"] == "result_unknown"
    assert submit(client, session, request_id=key).status_code == 202
    assert submit(client, session).status_code == 409
    assert (
        client.post(f"/api/v1/assessments/{session['id']}/cancel", {}, format="json").status_code
        == 200
    )
    assert apps.get_model("core", "ProfileSnapshot").objects.count() == 0


def test_report_job_rechecks_revoked_consent(client):
    _, consent, session, _, _ = setup_assessment(client)
    assert submit(client, session).status_code == 200
    client.post(f"/api/v1/consents/{consent['id']}/revoke", {}, format="json")
    from dingdong_ca.core.tasks import run_report_job

    job = apps.get_model("core", "BackgroundJob").objects.get()
    run_report_job(str(job.pk))
    job.refresh_from_db()
    assert job.status == "cancelled"
    assert apps.get_model("core", "ReportVersion").objects.count() == 0


def test_upload_uses_only_memory_even_when_default_spill_threshold_is_tiny(
    client, settings, tmp_path, caplog
):
    _, _, session, _, _ = setup_assessment(client)
    settings.FILE_UPLOAD_MAX_MEMORY_SIZE = 1
    settings.FILE_UPLOAD_TEMP_DIR = str(tmp_path)
    r = submit(client, session)
    assert r.status_code == 200, r.content
    assert list(tmp_path.iterdir()) == []
    for name in ["AssessmentSession", "AlgorithmAttempt", "ProfileSnapshot", "BackgroundJob"]:
        rows = list(apps.get_model("core", name).objects.values())
        text = json.dumps(rows, default=str)
        assert "synthetic-1.png" not in text and "base64" not in text
    assert "synthetic-1.png" not in caplog.text


def test_profile_and_report_lists_are_family_scoped(client):
    child, _, session, _, _ = setup_assessment(client)
    submit(client, session)
    from dingdong_ca.core.tasks import run_report_job

    run_report_job(str(apps.get_model("core", "BackgroundJob").objects.get().pk))
    profiles = client.get(f"/api/v1/children/{child['id']}/profiles")
    reports = client.get(f"/api/v1/children/{child['id']}/reports")
    assert_schema("Profiles", profiles.json())
    assert_schema("Reports", reports.json())
    other = APIClient(enforce_csrf_checks=True)
    sign_in(other, "+8613800000019")
    assert other.get(f"/api/v1/children/{child['id']}/profiles").status_code == 404
    assert other.get("/api/v1/reports/" + reports.json()["items"][0]["id"]).status_code == 404


def test_revocation_between_algorithm_start_and_completion_discards_result(client):
    child, consent, session, _, _ = setup_assessment(client)
    from dingdong_ca.core.services.assessments import begin_attempt, execute_attempt

    attempt, _ = begin_attempt(session["id"], uuid.uuid4(), session["revision"])
    client.post(f"/api/v1/consents/{consent['id']}/revoke", {}, format="json")
    assert execute_attempt(attempt).status == "cancelled"
    assert apps.get_model("core", "ProfileSnapshot").objects.count() == 0


def test_failed_attempt_allows_explicit_recapture(client):
    child, _, session, _, _ = setup_assessment(client)
    call_command(
        "inject_fixture", child_id=child["id"], scenario="assessment_failure", stdout=StringIO()
    )
    assert submit(client, session).status_code == 503
    assert client.get(f"/api/v1/assessments/{session['id']}").json()["status"] == "needs_recapture"
    call_command(
        "inject_fixture", child_id=child["id"], scenario="assessment_success", stdout=StringIO()
    )
    assert submit(client, session).status_code == 200
    assert apps.get_model("core", "AlgorithmAttempt").objects.count() == 2
    assert apps.get_model("core", "ProfileSnapshot").objects.count() == 1


def test_report_retry_uses_database_fault_and_creates_one_report(client):
    from django.utils import timezone

    from dingdong_ca.core.tasks import dispatch_pending, run_report_job

    child, _, session, _, _ = setup_assessment(client)
    call_command(
        "inject_fixture", child_id=child["id"], scenario="report_failure", stdout=StringIO()
    )
    submit(client, session)
    Job = apps.get_model("core", "BackgroundJob")
    job = Job.objects.get()
    run_report_job(str(job.pk))
    job.refresh_from_db()
    assert job.status == "pending" and job.attempt_count == 1
    assert apps.get_model("core", "ReportVersion").objects.count() == 0
    Job.objects.filter(pk=job.pk).update(next_attempt_at=timezone.now())
    dispatch_pending()
    job.refresh_from_db()
    assert job.status == "succeeded" and job.attempt_count == 2
    assert apps.get_model("core", "ReportVersion").objects.count() == 1


def test_expired_worker_lease_is_recovered(client):
    from datetime import timedelta

    from django.utils import timezone

    from dingdong_ca.core.tasks import dispatch_pending

    _, _, session, _, _ = setup_assessment(client)
    submit(client, session)
    job = apps.get_model("core", "BackgroundJob").objects.get()
    token = uuid.uuid4()
    past = timezone.now() - timedelta(minutes=2)
    job.status = "running"
    job.execution_token = token
    job.lease_expires_at = past
    job.attempt_count = 1
    job.save()
    attempt = apps.get_model("core", "JobAttempt").objects.create(
        job=job, attempt_no=1, execution_token=token, status="running", started_at=past
    )
    dispatch_pending()
    job.refresh_from_db()
    attempt.refresh_from_db()
    assert job.status == "succeeded" and job.attempt_count == 2
    assert attempt.status == "abandoned"
    assert apps.get_model("core", "ReportVersion").objects.count() == 1


def test_algorithm_crash_recovery_keeps_unknown_until_cancel(client):
    from datetime import timedelta

    from django.utils import timezone

    from dingdong_ca.core.services.assessments import begin_attempt, execute_attempt
    from dingdong_ca.core.tasks import recover_assessments

    _, _, session, _, _ = setup_assessment(client)
    attempt, _ = begin_attempt(session["id"], uuid.uuid4(), session["revision"])
    apps.get_model("core", "AlgorithmAttempt").objects.filter(pk=attempt.pk).update(
        deadline_at=timezone.now() - timedelta(seconds=1)
    )
    recover_assessments()
    assert execute_attempt(attempt).status == "unknown"
    assert submit(client, session).status_code == 409
    assert apps.get_model("core", "ProfileSnapshot").objects.count() == 0


def test_missing_template_waits_and_dispatcher_resumes_when_published(client):
    from dingdong_ca.core.tasks import dispatch_pending

    _, _, session, _, _ = setup_assessment(client)
    Template = apps.get_model("core", "ReportTemplateVersion")
    template = Template.objects.get(code="initial-report")
    template.status = "retired"
    template.save()
    assert submit(client, session).status_code == 200
    job = apps.get_model("core", "BackgroundJob").objects.get()
    assert job.status == "waiting"
    assert apps.get_model("core", "ReportVersion").objects.count() == 0
    template.status = "published"
    template.save()
    dispatch_pending()
    job.refresh_from_db()
    assert job.status == "succeeded"
    assert apps.get_model("core", "ReportVersion").objects.count() == 1


def test_report_failure_stops_at_retry_limit(client):
    from dingdong_ca.core.tasks import run_report_job

    child, _, session, _, _ = setup_assessment(client)
    call_command(
        "inject_fixture", child_id=child["id"], scenario="report_failure", stdout=StringIO()
    )
    submit(client, session)
    job = apps.get_model("core", "BackgroundJob").objects.get()
    job.max_attempts = 1
    job.save()
    run_report_job(str(job.pk))
    run_report_job(str(job.pk))
    job.refresh_from_db()
    assert job.status == "failed" and job.attempt_count == 1
    assert apps.get_model("core", "ReportVersion").objects.count() == 0


def test_assessment_listing_resumes_server_answers_and_is_family_scoped(client):
    child, _, session, _, _ = setup_assessment(client)
    result = client.get(f"/api/v1/children/{child['id']}/assessments")
    assert_schema("Assessments", result.json())
    assert result.json()["items"][0]["id"] == session["id"]
    assert len(result.json()["items"][0]["answers"]) == 22
    other = APIClient(enforce_csrf_checks=True)
    sign_in(other, "+8613800000029")
    assert other.get(f"/api/v1/children/{child['id']}/assessments").status_code == 404
