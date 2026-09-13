"""非法筛选不能静默忽略，更不能打出 500（独立验收 P2）。

复现场景（v0.3.2 公网已确认）：登录后访问 /ops/audit/?start=2026-99-99 返回 500。
日期参数没有校验就传给数据库查询。

这里覆盖：不存在的日期、格式错误、开始晚于结束、空值、正常边界，
以及状态/类型等枚举筛选的非法值。
"""

import datetime

import pytest
from ops_helpers import make_staff, ops_client

from dingdong_ca.core.models import AuditEvent

pytestmark = pytest.mark.django_db


def audit_client(role="operations"):
    client = ops_client(make_staff(role))
    AuditEvent.objects.create(action="family.freeze", target_kind="family", target_label="边界")
    return client


def test_impossible_date_returns_page_with_chinese_hint():
    client = audit_client()
    response = client.get("/ops/audit/", {"start": "2026-99-99"})
    assert response.status_code == 200
    body = response.content.decode()
    assert "开始日期" in body
    assert "不是有效日期" in body
    # 用户输入必须保留
    assert 'value="2026-99-99"' in body
    assert response.context["filter_problems"]


def test_malformed_date_returns_page_with_chinese_hint():
    client = audit_client()
    for value in ["2026-13-01", "20260912", "昨天", "2026-02-30"]:
        response = client.get("/ops/audit/", {"end": value})
        assert response.status_code == 200, value
        assert "不是有效日期" in response.content.decode(), value
        assert f'value="{value}"' in response.content.decode(), value


def test_start_after_end_is_reported_and_not_applied():
    client = audit_client()
    response = client.get("/ops/audit/", {"start": "2026-09-12", "end": "2026-09-01"})
    assert response.status_code == 200
    body = response.content.decode()
    assert "开始日期晚于结束日期" in body
    assert response.context["filter_problems"]


def test_empty_dates_are_fine():
    client = audit_client()
    response = client.get("/ops/audit/")
    assert response.status_code == 200
    assert response.context["filter_problems"] == []


def test_valid_boundary_dates_filter_correctly():
    client = audit_client()
    today = datetime.date.today()
    AuditEvent.objects.create(action="family.restore", target_kind="family", target_label="边界")
    response = client.get("/ops/audit/", {"start": today.isoformat(), "end": today.isoformat()})
    assert response.status_code == 200
    assert response.context["filter_problems"] == []
    assert response.context["page"]["total"] >= 1
    assert response.context["start"] == today.isoformat()

    future = today + datetime.timedelta(days=1)
    empty = client.get("/ops/audit/", {"start": future.isoformat()})
    assert empty.status_code == 200
    assert empty.context["page"]["total"] == 0


def test_invalid_action_filter_is_reported():
    client = audit_client()
    response = client.get("/ops/audit/", {"action": "not.a.real.action"})
    assert response.status_code == 200
    assert "不是有效选项" in response.content.decode()


def test_invalid_enum_filters_do_not_crash_or_silently_pass():
    """状态、类型、来源等枚举筛选遇到非法值同样要给出提示。"""
    admin = ops_client(make_staff("account_admin"))
    cases = [
        ("/ops/questionnaires/", {"status": "no-such-status"}),
        ("/ops/questionnaires/", {"purpose": "no-such-purpose"}),
        ("/ops/activities/", {"status": "no-such-status"}),
        ("/ops/services/", {"status": "no-such-status"}),
        ("/ops/services/", {"kind": "no-such-kind"}),
        ("/ops/jobs/", {"status": "no-such-status"}),
        ("/ops/jobs/", {"kind": "no-such-kind"}),
        ("/ops/reports/", {"origin": "no-such-origin"}),
    ]
    for path, params in cases:
        response = admin.get(path, params)
        assert response.status_code == 200, (path, params)
        assert response.context["filter_problems"], (path, params)


def test_invalid_page_number_falls_back_instead_of_failing():
    client = audit_client()
    for value in ["0", "-3", "abc", "999999"]:
        response = client.get("/ops/audit/", {"page": value})
        assert response.status_code == 200, value
        assert response.context["page"]["page"] >= 1


def test_invalid_filters_on_every_page_never_return_500():
    """把可疑参数打到每个列表页，全部必须是 200 而不是 500。"""
    admin = ops_client(make_staff("account_admin"))
    for path in [
        "/ops/",
        "/ops/families/",
        "/ops/questionnaires/",
        "/ops/activities/",
        "/ops/reports/",
        "/ops/jobs/",
        "/ops/services/",
        "/ops/audit/",
        "/ops/accounts/",
    ]:
        response = admin.get(
            path,
            {
                "status": "??",
                "kind": "??",
                "action": "??",
                "purpose": "??",
                "origin": "??",
                "start": "2026-99-99",
                "end": "not-a-date",
                "page": "abc",
                "q": "\u0000",
            },
        )
        assert response.status_code == 200, path
