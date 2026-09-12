"""运营后台：报告查询、内容查看与生成异常处理。

这里刻意复用家长侧真实链路（seed_mock + 机器人同步 + 后台任务）产生报告与失败任务，
避免用假数据验证运营界面。
"""

from io import StringIO

import pytest
from django.apps import apps
from django.core.management import call_command
from ops_helpers import make_staff, ops_client
from test_m3 import run_jobs, setup_robot

pytestmark = pytest.mark.django_db


def seed_report(client):
    """走真实流程生成一份阶段报告，返回 (child, report)。"""
    child, _grant, _association, _data = setup_robot(client)
    run_jobs()
    report = apps.get_model("core", "ReportVersion").objects.get()
    return child, report


def seed_failed_report_job(client):
    """构造一个真实失败的报告任务（上游数据故障），返回 job。"""
    from dingdong_ca.core.tasks import run_report_job

    child, _grant, _association, _data = setup_robot(client)
    call_command(
        "inject_fixture", child_id=child["id"], scenario="report_failure", stdout=StringIO()
    )
    Job = apps.get_model("core", "BackgroundJob")
    run_report_job(str(Job.objects.get(kind="sync").pk))
    run_report_job(str(Job.objects.get(kind="stage_profile").pk))
    job = Job.objects.get(kind="report")
    job.max_attempts = 1
    job.save()
    run_report_job(str(job.pk))
    job.refresh_from_db()
    assert job.status == "failed"
    assert job.error_code == "RENDER_FAILED"
    return child, job


def test_report_list_shows_generated_reports_and_filters(client):
    child, report = seed_report(client)
    staff = ops_client(make_staff("operations"))

    page = staff.get("/ops/reports/")
    assert page.status_code == 200
    body = page.content.decode()
    assert child["name"] in body
    assert "已生成报告" in body

    hit = staff.get("/ops/reports/", {"q": child["name"]})
    assert hit.status_code == 200
    assert child["name"] in hit.content.decode()

    miss = staff.get("/ops/reports/", {"q": "这个名字不存在"})
    assert miss.status_code == 200
    assert "还没有生成的报告" in miss.content.decode()


def test_report_detail_renders_content_for_operator(client):
    child, report = seed_report(client)
    staff = ops_client(make_staff("operations"))

    page = staff.get(f"/ops/reports/{report.pk}/")
    assert page.status_code == 200
    body = page.content.decode()
    assert child["name"] in body
    assert "报告内容" in body or "内容" in body


def test_report_detail_missing_returns_business_404(client):
    staff = ops_client(make_staff("operations"))
    page = staff.get("/ops/reports/00000000-0000-0000-0000-000000000000/")
    assert page.status_code == 404
    assert "找不到" in page.content.decode() or "不存在" in page.content.decode()


def test_failed_job_is_explained_in_business_language_and_retryable(client):
    _child, job = seed_failed_report_job(client)
    technical = ops_client(make_staff("technical"))

    listing = technical.get("/ops/jobs/", {"only_problem": "1"})
    assert listing.status_code == 200
    body = listing.content.decode()
    assert "报告内容生成失败" in body

    detail = technical.get(f"/ops/jobs/{job.pk}/")
    assert detail.status_code == 200
    detail_body = detail.content.decode()
    assert "报告内容生成失败" in detail_body
    assert "重试" in detail_body
    # 业务语言在前，技术错误码只作为次要参考保留给技术运维
    assert detail_body.index("报告内容生成失败") < detail_body.index("RENDER_FAILED")

    first = technical.post(f"/api/v1/staff/jobs/{job.pk}/retry")
    assert first.status_code == 202
    second = technical.post(f"/api/v1/staff/jobs/{job.pk}/retry")
    assert second.status_code == 409


def test_operations_role_cannot_open_jobs_or_retry(client):
    _child, job = seed_failed_report_job(client)
    operations = ops_client(make_staff("operations"))

    page = operations.get("/ops/jobs/")
    assert page.status_code == 403
    assert "权限" in page.content.decode()

    retry = operations.post(f"/api/v1/staff/jobs/{job.pk}/retry")
    assert retry.status_code == 403


def test_dashboard_counts_failed_jobs_truthfully(client):
    _child, _job = seed_failed_report_job(client)
    staff = ops_client(make_staff("technical"))

    page = staff.get("/ops/")
    assert page.status_code == 200
    assert "报告内容生成失败" in page.content.decode() or "生成任务" in page.content.decode()
