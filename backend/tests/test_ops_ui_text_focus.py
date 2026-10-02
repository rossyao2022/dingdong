"""Presentation regressions: definitions remain available without competing with actions."""

from html.parser import HTMLParser

import pytest
from django.template.loader import render_to_string


class Page(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.stack = []
        self.nodes = []
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        node = {"tag": tag, "attrs": dict(attrs), "parents": list(self.stack), "text": ""}
        self.nodes.append(node)
        if tag not in {"input", "img", "link", "meta", "br", "hr"}:
            self.stack.append(node)

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, -1, -1):
            if self.stack[index]["tag"] == tag:
                del self.stack[index:]
                break

    def handle_data(self, data):
        for node in self.stack:
            node["text"] += data

    def with_class(self, name):
        return [n for n in self.nodes if name in n["attrs"].get("class", "").split()]


def dashboard(**perms):
    return render_to_string(
        "ops/dashboard.html",
        {
            "perms": perms,
            "counters": {
                "open_services": 7,
                "failed_jobs": 3,
                "waiting_jobs": 2,
                "draft_questionnaires": 4,
            },
            "metrics": [
                {"label": f"指标 {i}", "value": i, "scope": f"完整统计口径 {i}"} for i in range(10)
            ],
        },
    )


def test_dashboard_definitions_are_closed_and_separate_from_counter_links():
    html = dashboard(services=True, jobs=True, questionnaires=True)
    page = Page(html)
    scopes = page.with_class("ops-metric-scope")
    assert len(scopes) == 14
    for scope in scopes:
        assert scope["tag"] == "details"
        assert "open" not in scope["attrs"]
        assert not any(n["tag"] == "a" for n in scope["parents"])
        summary = [n for n in page.nodes if n["tag"] == "summary" and scope in n["parents"]]
        assert len(summary) == 1
        assert "统计口径" in summary[0]["text"]
    links = [n for n in page.with_class("ops-stat-main") if n["tag"] == "a"]
    assert {n["attrs"]["href"] for n in links} == {
        "/ops/services/?status=open",
        "/ops/jobs/?status=failed",
        "/ops/jobs/?status=waiting",
        "/ops/questionnaires/?status=draft",
    }
    assert all("统计口径" not in n["text"] for n in links)
    for i in range(10):
        assert f"完整统计口径 {i}" in html
    assert html.index('aria-label="统计"') > html.index("待办清单")
    task_section = html.split("待办清单", 1)[1].split('aria-label="统计"', 1)[0]
    assert "失败任务不会自动重试" in task_section


@pytest.mark.parametrize("real_sms, expected", [(True, "阿里云短信"), (False, "固定验证码")])
def test_footer_states_runtime_sms_mode(real_sms, expected):
    html = render_to_string("ops/base.html", {"ops_real_sms": real_sms})
    footer = Page(html).with_class("ops-footer")[0]["text"]
    assert expected in footer
    assert "演示环境" in footer
    assert "未接入真实短信" not in footer
    assert "专业测评" in footer


def test_accounts_reference_is_closed_after_primary_list():
    html = render_to_string("ops/accounts.html", {"page": {"total": 0}})
    page = Page(html)
    roles = next(n for n in page.nodes if n["tag"] == "details" and "角色说明" in n["text"])
    assert "open" not in roles["attrs"]
    assert html.index("后台账号") < html.index("角色说明")
    assert "技术运维" in roles["text"]
    assert "一个账号可以同时拥有多个角色" in roles["text"]


@pytest.mark.parametrize("name, count", [("services", 4), ("ca_accounts", 3)])
def test_overview_definitions_do_not_replace_counter_navigation(name, count):
    html = render_to_string(f"ops/{name}.html", {"page": {"total": 0}})
    page = Page(html)
    assert len(page.with_class("ops-stat-main")) == count
    scopes = page.with_class("ops-metric-scope")
    assert len(scopes) == count
    for scope in scopes:
        assert "open" not in scope["attrs"]
        assert not any(n["tag"] == "a" for n in scope["parents"])
        assert "口径：" in scope["text"]


@pytest.mark.parametrize("kind", ["support", "correction", "deletion"])
def test_service_guidance_matches_request_and_deletion_warning_stays_visible(kind):
    import uuid
    from types import SimpleNamespace

    html = render_to_string(
        "ops/service_detail.html",
        {
            "row": SimpleNamespace(pk=uuid.uuid4(), kind=kind, status="open"),
            "can_handle": True,
            "can_delete": True,
        },
    )
    guide = html.split("处理指引", 1)[1]
    assert ("先联系家长确认问题" in guide) is (kind == "support")
    assert ("修改，再回到本页确认已处理" in guide) is (kind == "correction")
    assert ("删除不可撤销，执行前请与家长确认" in guide) is (kind == "deletion")
    if kind == "deletion":
        button = next(
            n for n in Page(html).nodes if n["tag"] == "button" and n["text"] == "执行数据删除"
        )
        assert "不可撤销" in button["attrs"]["data-ops-confirm"]
        assert not any(n["tag"] == "details" for n in button["parents"])
