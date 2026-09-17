import uuid
from io import StringIO

import pytest
from conftest import assert_schema, create_child, sign_in
from django.apps import apps
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.management import call_command
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db
WINDOW = {"from": "2026-09-01T00:00:00Z", "to": "2026-09-08T00:00:00Z"}


def staff(role):
    call_command("seed_base", stdout=StringIO())
    u = get_user_model().objects.create_user(
        username=str(uuid.uuid4()), account_kind="staff", is_staff=True
    )
    u.groups.add(Group.objects.get(name=role))
    c = APIClient(enforce_csrf_checks=True)
    c.force_login(u)
    c.get("/api/v1/auth/csrf")
    c.credentials(HTTP_X_CSRFTOKEN=c.cookies["csrftoken"].value)
    return c, u


def setup_robot(client, scenario="sync_success", verify=True):
    call_command("seed_mock", stdout=StringIO())
    sign_in(client, "+8613800000031")
    child = create_child(client)
    p = client.get("/api/v1/policies/current", {"purpose": "dingdong_sync"}).json()
    r = client.post(
        f"/api/v1/children/{child['id']}/consents",
        {"request_id": str(uuid.uuid4()), "policy_version_id": p["id"]},
        format="json",
    )
    assert r.status_code == 201
    grant = r.json()
    out = StringIO()
    call_command("inject_fixture", child_id=child["id"], scenario=scenario, stdout=out)
    data = {
        "request_id": str(uuid.uuid4()),
        "consent_grant_id": grant["id"],
        "entry_proof": "TEST-PROOF-" + child["id"],
    }
    if not verify:
        return child, grant, data
    r = client.post(f"/api/v1/children/{child['id']}/associations/verify", data, format="json")
    assert r.status_code == 201, r.content
    assert_schema("Association", r.json())
    return child, grant, r.json(), data


def run_jobs():
    from dingdong_ca.core.tasks import run_report_job

    Job = apps.get_model("core", "BackgroundJob")
    for _ in range(4):
        for job in list(Job.objects.filter(status="pending")):
            run_report_job(str(job.pk))


def sync_again(association):
    from dingdong_ca.core.services.sync import schedule_sync

    schedule_sync(association["id"])
    run_jobs()


def test_verify_and_sync_stage_report_contract(client):
    child, _, association, data = setup_robot(client)
    r = client.post(f"/api/v1/children/{child['id']}/associations/verify", data, format="json")
    assert r.status_code == 200 and r.json()["id"] == association["id"]
    run_jobs()
    r = client.get(f"/api/v1/children/{child['id']}/observations", WINDOW)
    assert r.status_code == 200, r.content
    assert_schema("ObservationView", r.json())
    assert r.json()["availability"] == "ready"
    assert r.json()["metrics"][0]["value"] == 3
    r = client.get(f"/api/v1/children/{child['id']}/growth-overview", WINDOW)
    assert_schema("GrowthOverview", r.json())
    assert r.json()["stage_status"] == "ready"
    assert r.json()["web_activity_summary"]["completed_count"] == 0
    assert r.json()["latest_reports"][0]["kind"] == "stage"
    reports = client.get(f"/api/v1/children/{child['id']}/reports").json()
    assert_schema("Report", client.get("/api/v1/reports/" + reports["items"][0]["id"]).json())


@pytest.mark.parametrize(
    "scenario,count,value,error",
    [
        ("sync_duplicate", 1, 3, None),
        ("sync_correction", 2, 5, None),
        ("sync_conflict", 1, 3, "SOURCE_CONFLICT"),
        ("sync_failure", 1, 3, "UPSTREAM_TIMEOUT"),
    ],
)
def test_sync_revisions_and_cursor_are_atomic(client, scenario, count, value, error):
    child, _, association, _ = setup_robot(client, scenario)
    run_jobs()
    sync_again(association)
    Obs = apps.get_model("core", "ObservationBatch")
    Check = apps.get_model("core", "SyncCheckpoint")
    assert Obs.objects.count() == count
    checkpoint = Check.objects.get()
    assert checkpoint.cursor == (1 if error else 2)
    assert checkpoint.error_code == error
    view = client.get(f"/api/v1/children/{child['id']}/observations", WINDOW).json()
    assert view["metrics"][0]["value"] == value
    assert view["availability"] == ("stale" if error else "ready")
    assert apps.get_model("core", "ProfileSnapshot").objects.count() == count


def test_revoked_consent_blocks_sync_and_new_results(client):
    child, grant, _, _ = setup_robot(client)
    client.post("/api/v1/consents/" + grant["id"] + "/revoke", {}, format="json")
    run_jobs()
    assert apps.get_model("core", "ObservationBatch").objects.count() == 0
    assert (
        client.get(f"/api/v1/children/{child['id']}/observations", WINDOW).json()["availability"]
        == "no_consent"
    )


def test_bad_identity_proof_and_cross_family_rejected(client):
    child, _, data = setup_robot(client, verify=False)
    bad = {**data, "entry_proof": "TEST-PROOF-OTHER"}
    assert (
        client.post(
            f"/api/v1/children/{child['id']}/associations/verify", bad, format="json"
        ).status_code
        == 422
    )
    other = APIClient(enforce_csrf_checks=True)
    sign_in(other, "+8613800000032")
    assert (
        other.post(
            f"/api/v1/children/{child['id']}/associations/verify", data, format="json"
        ).status_code
        == 404
    )
    assert other.get(f"/api/v1/children/{child['id']}/observations", WINDOW).status_code == 404


def test_staff_csrf_roles_pause_resume_and_job_read(client):
    _, _, association, _ = setup_robot(client)
    technical, u = staff("technical")
    content, _ = staff("content")
    url = "/api/v1/staff/associations/" + association["id"] + "/pause"
    assert content.post(url, {}, format="json").status_code == 403
    assert client.post(url, {}, format="json").status_code == 403
    naked = APIClient(enforce_csrf_checks=True)
    naked.force_login(u)
    assert naked.post(url, {}, format="json").status_code == 403
    assert technical.post(url, {}, format="json").json()["sync_status"] == "paused"
    assert (
        technical.post(url.replace("/pause", "/resume"), {}, format="json").json()["sync_status"]
        == "enabled"
    )
    job = apps.get_model("core", "BackgroundJob").objects.get(kind="sync")
    assert_schema("Job", technical.get("/api/v1/staff/jobs/" + str(job.pk)).json())
    assert (
        technical.post(
            "/api/v1/staff/jobs/" + str(job.pk) + "/retry", {}, format="json"
        ).status_code
        == 409
    )


def test_rule_missing_then_publish_resumes_stage(client):
    child, _, _, _ = setup_robot(client, "rule_missing")
    run_jobs()
    view = client.get(f"/api/v1/children/{child['id']}/growth-overview", WINDOW).json()
    assert view["stage_status"] == "waiting_rule"
    rule = apps.get_model("core", "RuleVersion").objects.get()
    content, _ = staff("content")
    r = content.post(f"/api/v1/staff/rules/{rule.pk}/publish", {}, format="json")
    assert r.status_code == 200, r.content
    from dingdong_ca.core.tasks import dispatch_pending

    dispatch_pending()
    run_jobs()
    assert (
        client.get(f"/api/v1/children/{child['id']}/growth-overview", WINDOW).json()["stage_status"]
        == "ready"
    )


def test_staff_cannot_promote_self_or_parent(client):
    admin, u = staff("account_admin")
    _, target = staff("operations")
    url = "/api/v1/staff/users/"
    assert (
        admin.patch(
            url + str(u.pk) + "/roles", {"role_codes": ["technical"]}, format="json"
        ).status_code
        == 403
    )
    assert (
        admin.patch(
            url + str(target.pk) + "/roles", {"role_codes": ["account_admin"]}, format="json"
        ).status_code
        == 422
    )
    r = admin.patch(url + str(target.pk) + "/roles", {"role_codes": ["content"]}, format="json")
    assert r.status_code == 200
    assert_schema("StaffResult", r.json())
    assert (
        admin.patch(url + str(target.pk) + "/status", {"is_active": False}, format="json").json()[
            "is_active"
        ]
        is False
    )


def test_delete_child_actually_cleans_business_data_and_keeps_private_receipt(client):
    child, _, _, _ = setup_robot(client)
    run_jobs()
    r = client.post(
        f"/api/v1/children/{child['id']}/data-requests",
        {"request_id": str(uuid.uuid4()), "kind": "deletion", "reason_code": "delete_child_data"},
        format="json",
    )
    assert r.status_code == 201, r.content
    assert_schema("DataRequest", r.json())
    operations, _ = staff("operations")
    technical, _ = staff("technical")
    url = "/api/v1/staff/data-requests/" + r.json()["id"] + "/resolve"
    assert (
        operations.post(
            url, {"action": "execute_deletion", "resolution_code": "deleted"}, format="json"
        ).status_code
        == 403
    )
    response = technical.post(
        url, {"action": "execute_deletion", "resolution_code": "deleted"}, format="json"
    )
    assert response.status_code == 200, response.content
    assert response.json()["child_id"] is None
    for name in [
        "Child",
        "ExternalAssociation",
        "ObservationBatch",
        "ProfileSnapshot",
        "ReportVersion",
        "BackgroundJob",
        "ConsentGrant",
    ]:
        assert (
            apps.get_model("core", name)
            .objects.filter(**({"pk": child["id"]} if name == "Child" else {}))
            .count()
            == 0
        )
    receipts = client.get("/api/v1/data-requests").json()
    assert_schema("DataRequests", receipts)
    assert receipts["items"][0]["status"] == "completed"


@pytest.mark.parametrize(
    "kind,model",
    [
        ("questionnaires", "QuestionnaireVersion"),
        ("activities", "ActivityContentVersion"),
        ("report-templates", "ReportTemplateVersion"),
    ],
)
def test_content_publish_validates_and_preserves_previous_version(client, kind, model):
    call_command("seed_mock", stdout=StringIO())
    content, _ = staff("content")
    technical, _ = staff("technical")
    Model = apps.get_model("core", model)
    old = Model.objects.filter(status="published").first()
    data = {
        field.name: getattr(old, field.name)
        for field in Model._meta.fields
        if field.name not in ["id", "created_at", "updated_at", "published_by", "published_at"]
    }
    data.update(version="test-v2", status="draft")
    row = Model.objects.create(**data)
    url = f"/api/v1/staff/{kind}/{row.pk}/publish"
    assert technical.post(url, {}, format="json").status_code == 403
    r = content.post(url, {}, format="json")
    assert r.status_code == 200, r.content
    assert_schema("PublishResult", r.json())
    old.refresh_from_db()
    assert old.status == "retired"
    assert content.post(url, {}, format="json").status_code == 200


def test_invalid_questionnaire_cannot_replace_published_content(client):
    call_command("seed_mock", stdout=StringIO())
    Model = apps.get_model("core", "QuestionnaireVersion")
    row = Model.objects.create(
        code="initial-assessment", version="invalid-v2", data_origin="synthetic", questions=[]
    )
    content, _ = staff("content")
    assert (
        content.post(
            f"/api/v1/staff/questionnaires/{row.pk}/publish", {}, format="json"
        ).status_code
        == 422
    )
    assert Model.objects.filter(
        code="initial-assessment", status="published", version="readable-v2"
    ).exists()


def test_rule_change_creates_new_profile_without_mutating_old_report(client):
    child, _, _, _ = setup_robot(client)
    run_jobs()
    Profile = apps.get_model("core", "ProfileSnapshot")
    Report = apps.get_model("core", "ReportVersion")
    old = Profile.objects.get()
    oldreport = Report.objects.get()
    text = oldreport.content
    rule = apps.get_model("core", "RuleVersion").objects.create(
        code="stage-rule",
        version="test-rule-v2",
        data_origin="synthetic",
        config={"implementation": "test-count-v1", "multiplier": 2},
    )
    content, _ = staff("content")
    assert (
        content.post(f"/api/v1/staff/rules/{rule.pk}/publish", {}, format="json").status_code == 200
    )
    run_jobs()
    oldreport.refresh_from_db()
    assert (
        Profile.objects.count() == 2 and Report.objects.count() == 2 and oldreport.content == text
    )
    assert Profile.objects.exclude(pk=old.pk).get().result["metrics"][0]["value"] == 6


def test_staff_report_retry_and_duplicate_click(client):
    child, _, _, _ = setup_robot(client)
    call_command(
        "inject_fixture", child_id=child["id"], scenario="report_failure", stdout=StringIO()
    )
    from dingdong_ca.core.tasks import run_report_job

    Job = apps.get_model("core", "BackgroundJob")
    run_report_job(str(Job.objects.get(kind="sync").pk))
    run_report_job(str(Job.objects.get(kind="stage_profile").pk))
    job = Job.objects.get(kind="report")
    job.max_attempts = 1
    job.save()
    run_report_job(str(job.pk))
    job.refresh_from_db()
    assert job.status == "failed"
    technical, _ = staff("technical")
    url = f"/api/v1/staff/jobs/{job.pk}/retry"
    r = technical.post(url, {}, format="json")
    assert r.status_code == 202, r.content
    assert technical.post(url, {}, format="json").status_code == 409
    run_report_job(str(job.pk))
    assert apps.get_model("core", "ReportVersion").objects.count() == 1


def test_fresh_overview_no_fake_zero_profile_and_invalid_windows(client):
    call_command("seed_mock", stdout=StringIO())
    sign_in(client, "+8613800000033")
    child = create_child(client)
    url = f"/api/v1/children/{child['id']}/growth-overview"
    r = client.get(url, WINDOW)
    assert_schema("GrowthOverview", r.json())
    assert r.json()["initial_profile"] is None and r.json()["robot_observation"]["metrics"] == []
    for query in [
        {},
        {"from": WINDOW["from"]},
        {"from": WINDOW["to"], "to": WINDOW["from"]},
        {"from": "2026-09-01", "to": WINDOW["to"]},
    ]:
        assert client.get(url, query).status_code == 422


def test_unbind_stops_sync_without_moving_historical_records(client):
    child, _, association, _ = setup_robot(client)
    run_jobs()
    r = client.post("/api/v1/associations/" + association["id"] + "/revoke", {}, format="json")
    assert_schema("Association", r.json())
    assert r.json()["status"] == "revoked"
    assert (
        client.post(
            "/api/v1/associations/" + association["id"] + "/revoke", {}, format="json"
        ).status_code
        == 200
    )
    assert_schema("Associations", client.get(f"/api/v1/children/{child['id']}/associations").json())
    sync_again(association)
    assert apps.get_model("core", "ObservationBatch").objects.count() == 1
    assert (
        client.get(f"/api/v1/children/{child['id']}/observations", WINDOW).json()["availability"]
        == "unbound"
    )


@pytest.mark.parametrize(
    "kind,reason", [("support", "support_needed"), ("correction", "correct_profile")]
)
def test_service_requests_idempotency_resolution_and_receipt_isolation(client, kind, reason):
    child, _, _, _ = setup_robot(client)
    data = {"request_id": str(uuid.uuid4()), "kind": kind, "reason_code": reason}
    url = f"/api/v1/children/{child['id']}/data-requests"
    r = client.post(url, data, format="json")
    assert r.status_code == 201
    assert client.post(url, data, format="json").json()["id"] == r.json()["id"]
    assert_schema("DataRequests", client.get(url).json())
    operations, _ = staff("operations")
    r = operations.post(
        "/api/v1/staff/data-requests/" + r.json()["id"] + "/resolve",
        {"action": "resolve", "resolution_code": "resolved"},
        format="json",
    )
    assert r.status_code == 200
    assert r.json()["status"] == "completed"
    other = APIClient(enforce_csrf_checks=True)
    sign_in(other, "+8613800000034")
    assert other.get("/api/v1/data-requests").json()["items"] == []


def test_unexpected_observation_fields_are_rejected_without_persisting(client):
    _, _, _, _ = setup_robot(client)
    fixture = apps.get_model("testsupport", "TestFixture").objects.get(kind="observation")
    fixture.payload["unexpected_raw_data"] = "SYNTHETIC-REJECT-MARKER"
    fixture.save()
    run_jobs()
    assert apps.get_model("core", "ObservationBatch").objects.count() == 0
    assert apps.get_model("core", "SyncCheckpoint").objects.get().cursor == 0
    assert (
        apps.get_model("core", "BackgroundJob").objects.get(kind="sync").error_code
        == "UPSTREAM_SCHEMA_INVALID"
    )


def test_admin_pages_expose_only_fixed_role_actions(client):
    child, _, association, _ = setup_robot(client)
    technical, _ = staff("technical")
    operations, _ = staff("operations")
    content, _ = staff("content")
    page = technical.get("/admin/core/externalassociation/" + association["id"] + "/change/")
    assert page.status_code == 200 and "暂停同步".encode() in page.content
    page = operations.get("/admin/core/externalassociation/" + association["id"] + "/change/")
    assert page.status_code == 200 and "暂停同步".encode() not in page.content
    assert operations.get("/admin/core/backgroundjob/").status_code == 403
    q = apps.get_model("core", "QuestionnaireVersion").objects.get(
        code="initial-assessment", status="published"
    )
    page = content.get(f"/admin/core/questionnaireversion/{q.pk}/change/")
    assert page.status_code == 200 and "发布此版本".encode() not in page.content
    q = apps.get_model("core", "QuestionnaireVersion").objects.create(
        code="initial-assessment",
        version="draft-v2",
        questions=q.questions,
        data_origin="synthetic",
    )
    page = content.get(f"/admin/core/questionnaireversion/{q.pk}/change/")
    assert "发布此版本".encode() in page.content


def test_trend_compares_only_equal_adjacent_compatible_windows(client):
    child, _, association, _ = setup_robot(client)
    run_jobs()
    Fixture = apps.get_model("testsupport", "TestFixture")
    source = Fixture.objects.get(kind="observation")
    payload = {
        **source.payload,
        "logical_key": "TEST-WINDOW-20260908",
        "window_start": "2026-09-08T00:00:00Z",
        "window_end": "2026-09-15T00:00:00Z",
        "metrics": [{**source.payload["metrics"][0], "value": 5}],
    }
    Fixture.objects.create(
        dataset="phase1-v1",
        kind="observation",
        subject_key=child["id"],
        sequence=2,
        payload=payload,
    )
    sync_again(association)
    url = f"/api/v1/children/{child['id']}/growth-overview"
    query = {"from": payload["window_start"], "to": payload["window_end"]}
    view = client.get(url, query).json()
    assert_schema("GrowthOverview", view)
    assert view["trend"]["available"] and view["trend"]["changes"][0]["delta"] == 2
    rule = apps.get_model("core", "RuleVersion").objects.create(
        code="stage-rule",
        version="test-rule-v2",
        data_origin="synthetic",
        config={"implementation": "test-count-v1", "multiplier": 2},
    )
    content, _ = staff("content")
    content.post(f"/api/v1/staff/rules/{rule.pk}/publish", {}, format="json")
    from dingdong_ca.core.tasks import run_report_job

    job = apps.get_model("core", "BackgroundJob").objects.get(
        kind="stage_profile",
        rule_version=rule,
        jobobservation__observation__logical_key=payload["logical_key"],
    )
    run_report_job(str(job.pk))
    view = client.get(url, query).json()
    assert not view["trend"]["available"] and view["trend"]["reason"] == "incompatible_version"


def test_expired_or_consumed_proof_cannot_create_new_association(client):
    from datetime import timedelta

    from django.utils import timezone

    child, _, data = setup_robot(client, verify=False)
    Fixture = apps.get_model("testsupport", "TestFixture")
    proof = Fixture.objects.get(kind="identity")
    proof.payload["expires_at"] = (timezone.now() - timedelta(seconds=1)).isoformat()
    proof.save()
    url = f"/api/v1/children/{child['id']}/associations/verify"
    assert client.post(url, data, format="json").status_code == 422
    proof.payload["expires_at"] = (timezone.now() + timedelta(hours=1)).isoformat()
    proof.save()
    association = client.post(url, data, format="json").json()
    client.post("/api/v1/associations/" + association["id"] + "/revoke", {}, format="json")
    data["request_id"] = str(uuid.uuid4())
    assert client.post(url, data, format="json").status_code == 422


def test_all_scenario_names_are_injectable_without_prebuilt_results(client):
    from dingdong_ca.core.management.commands.inject_fixture import LOCAL_SCENARIOS

    child, _, _ = setup_robot(client, verify=False)
    for scenario in LOCAL_SCENARIOS:
        call_command("inject_fixture", child_id=child["id"], scenario=scenario, stdout=StringIO())
    for name in ["ExternalAssociation", "ProfileSnapshot", "ReportVersion", "BackgroundJob"]:
        assert apps.get_model("core", name).objects.count() == 0


def test_sync_manual_retry_requires_resolved_source_conflict(client):
    child, _, association, _ = setup_robot(client, "sync_conflict")
    run_jobs()
    sync_again(association)
    job = apps.get_model("core", "BackgroundJob").objects.get(kind="sync", status="failed")
    technical, _ = staff("technical")
    url = f"/api/v1/staff/jobs/{job.pk}/retry"
    assert technical.post(url, {}, format="json").status_code == 409
    fixture = apps.get_model("testsupport", "TestFixture").objects.get(
        kind="observation", subject_key=child["id"], sequence=2
    )
    fixture.payload.update(source_version="fixture-r2", revision_no=2)
    fixture.save()
    assert technical.post(url, {}, format="json").status_code == 202
    run_jobs()
    assert apps.get_model("core", "SyncCheckpoint").objects.get().cursor == 2


def test_every_openapi_operation_has_a_real_view():
    import json
    import re
    from pathlib import Path

    from django.urls import resolve

    spec = json.loads((Path(__file__).resolve().parents[2] / "设计/API/openapi.json").read_text())
    operations = 0
    for path, methods in spec["paths"].items():
        url = "/api/v1" + re.sub(r"\{[^}]+\}", str(uuid.uuid4()), path)
        view = resolve(url).func
        for method in methods:
            assert method in view.cls.http_method_names, (method, path)
            operations += 1
    # 操作数从 50 增到 51：v0.3.4 给 /children/{child_id} 补上 GET，
    # 家长端在被 409 打回后需要读一次服务端最新档案与修订号（此前只有 PATCH）。
    # 51 增到 55：CA 对接的 CA 账户四个操作（列/建、详情、归档）——
    # 家长绑机器人（NFC 承接）与换机归档要走我们自己服务端的接口。
    assert operations == 55


def test_initial_fixture_tracks_current_questionnaire_and_can_target_fixed_old_session(client):
    child, _, _ = setup_robot(client, verify=False)
    Model = apps.get_model("core", "QuestionnaireVersion")
    old = Model.objects.get(code="initial-assessment", status="published")
    new = Model.objects.create(
        code=old.code, version="test-v2", data_origin="synthetic", questions=old.questions
    )
    content, _ = staff("content")
    assert (
        content.post(
            f"/api/v1/staff/questionnaires/{new.pk}/publish", {}, format="json"
        ).status_code
        == 200
    )
    call_command(
        "inject_fixture", child_id=child["id"], scenario="assessment_success", stdout=StringIO()
    )
    fixture = apps.get_model("testsupport", "TestFixture").objects.get(
        kind="initial_result", subject_key=child["id"]
    )
    assert fixture.payload["questionnaire_version_id"] == str(new.pk)
    call_command(
        "inject_fixture",
        child_id=child["id"],
        scenario="assessment_success",
        questionnaire_version_id=str(old.pk),
        stdout=StringIO(),
    )
    fixture.refresh_from_db()
    assert fixture.payload["questionnaire_version_id"] == str(old.pk)
