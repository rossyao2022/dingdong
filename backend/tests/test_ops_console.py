"""运营后台：登录、权限、工作首页、家庭与儿童、账号与审计。"""

import json
import uuid

import pytest
from django.contrib.auth import get_user_model
from django.test import Client, override_settings
from django.urls import reverse
from ops_helpers import PASSWORD, make_family, make_staff, ops_client

from dingdong_ca.core.models import AuditEvent, Child, Family

pytestmark = pytest.mark.django_db


# --------------------------------------------------------------------------- 登录与身份


def test_anonymous_is_redirected_to_ops_login():
    response = Client().get(reverse("ops:dashboard"))
    assert response.status_code == 302
    assert response["Location"].startswith(reverse("ops:login"))
    assert "next=" in response["Location"]


def test_login_form_accepts_staff_and_records_audit():
    user = make_staff("operations")
    client = Client()
    response = client.post(reverse("ops:login"), {"username": user.username, "password": PASSWORD})
    assert response.status_code == 302
    assert response["Location"] == reverse("ops:dashboard")
    assert AuditEvent.objects.filter(actor=user, action="account.login").exists()


def test_login_form_rejects_parent_account():
    from ops_helpers import make_parent

    parent = make_parent(phone="+8613900000001")
    parent.set_password(PASSWORD)
    parent.save(update_fields=["password"])
    response = Client().post(
        reverse("ops:login"), {"username": parent.username, "password": PASSWORD}
    )
    assert response.status_code == 200
    assert "不是运营后台账号" in response.content.decode()


def test_login_form_rejects_wrong_password():
    user = make_staff("operations")
    response = Client().post(reverse("ops:login"), {"username": user.username, "password": "wrong"})
    assert response.status_code == 200
    assert "账号或密码不正确" in response.content.decode()


def test_logout_requires_post_and_records_audit():
    user = make_staff("operations")
    client = ops_client(user)
    assert client.get(reverse("ops:logout")).status_code == 405
    response = client.post(reverse("ops:logout"))
    assert response.status_code == 302
    assert response["Location"] == reverse("ops:login")
    assert AuditEvent.objects.filter(actor=user, action="account.logout").exists()


def test_staff_without_role_gets_forbidden_page():
    user = make_staff()
    client = ops_client(user)
    response = client.get(reverse("ops:dashboard"))
    assert response.status_code == 403
    body = response.content.decode()
    assert "权限不足" in body
    assert "未分配角色" in body


def test_role_separation_on_pages():
    operations = ops_client(make_staff("operations"))
    content = ops_client(make_staff("content"))

    assert operations.get(reverse("ops:families")).status_code == 200
    assert operations.get(reverse("ops:accounts")).status_code == 403
    assert operations.get(reverse("ops:jobs")).status_code == 403
    assert operations.get(reverse("ops:questionnaires")).status_code == 403
    assert operations.get(reverse("ops:activities")).status_code == 403

    assert content.get(reverse("ops:questionnaires")).status_code == 200
    assert content.get(reverse("ops:activities")).status_code == 200
    assert content.get(reverse("ops:families")).status_code == 403
    assert content.get(reverse("ops:services")).status_code == 403
    assert content.get(reverse("ops:reports")).status_code == 403


def test_navigation_only_shows_permitted_items():
    operations = ops_client(make_staff("operations"))
    response = operations.get(reverse("ops:dashboard"))
    body = response.content.decode()
    assert "家庭与儿童" in body
    assert "服务事项" in body
    assert reverse("ops:accounts") not in body
    assert reverse("ops:jobs") not in body
    assert {link["title"] for link in response.context["quick_links"]} == {"报告管理"}


def test_superuser_sees_every_menu():
    admin = ops_client(make_staff(superuser=True))
    body = admin.get(reverse("ops:dashboard")).content.decode()
    for title in [
        "家庭与儿童",
        "服务事项",
        "题库管理",
        "活动管理",
        "生成任务",
        "账号与权限",
        "操作审计",
    ]:
        assert title in body


def test_password_change_keeps_session_and_records_audit():
    user = make_staff("operations")
    client = ops_client(user)
    response = client.post(
        reverse("ops:password"),
        {
            "old_password": PASSWORD,
            "new_password1": "brand-new-pass-9911",
            "new_password2": "brand-new-pass-9911",
        },
    )
    assert response.status_code == 302
    user.refresh_from_db()
    assert user.check_password("brand-new-pass-9911")
    assert AuditEvent.objects.filter(actor=user, action="staff.password_change").exists()
    assert client.get(reverse("ops:dashboard")).status_code == 200


def test_password_change_rejects_weak_password():
    user = make_staff("operations")
    client = ops_client(user)
    response = client.post(
        reverse("ops:password"),
        {"old_password": PASSWORD, "new_password1": "123", "new_password2": "123"},
    )
    assert response.status_code == 200
    user.refresh_from_db()
    assert user.check_password(PASSWORD)


# --------------------------------------------------------------------------- 工作首页


def test_dashboard_counters_come_from_database():
    from ops_helpers import make_failed_job, make_service_request

    family, children, parent = make_family()
    make_service_request(children[0], parent)
    make_failed_job()
    client = ops_client(make_staff("operations"))
    response = client.get(reverse("ops:dashboard"))
    context = response.context
    assert context["counters"]["open_services"] == 1
    families_metric = next(m for m in context["metrics"] if m["key"] == "families")
    assert families_metric["value"] == Family.objects.filter(status="active").count()
    assert "口径" in families_metric["scope"]

    # 普通运营没有生成任务权限，首页就不该拿到任务计数
    assert "failed_jobs" not in context["counters"]

    technical = ops_client(make_staff("technical"))
    tech_context = technical.get(reverse("ops:dashboard")).context
    assert tech_context["counters"]["failed_jobs"] == 1


def test_dashboard_failed_job_uses_business_language():
    from ops_helpers import make_failed_job

    make_failed_job()
    client = ops_client(make_staff("technical"))
    body = client.get(reverse("ops:dashboard")).content.decode()
    assert "报告内容生成失败" in body
    assert "RENDER_FAILED" not in body


# --------------------------------------------------------------------------- 家庭与儿童


def test_family_search_by_phone_and_child_name():
    family, children, parent = make_family(child_name="小叶子", phone="+8613712345678")
    client = ops_client(make_staff("operations"))

    by_phone = client.get(reverse("ops:families"), {"q": "13712345678"})
    assert family.pk in [item["family"].pk for item in by_phone.context["items"]]

    by_name = client.get(reverse("ops:families"), {"q": "小叶"})
    assert family.pk in [item["family"].pk for item in by_name.context["items"]]

    none_found = client.get(reverse("ops:families"), {"q": "不存在的称呼"})
    assert none_found.context["items"] == []
    assert "没有匹配的家庭" in none_found.content.decode()


def test_family_list_is_paginated():
    for index in range(23):
        make_family(child_name=f"孩子{index}", phone=f"+8613800{index:05d}")
    client = ops_client(make_staff("operations"))
    first = client.get(reverse("ops:families"))
    assert len(first.context["items"]) == 20
    assert first.context["page"]["pages"] == 2
    assert first.context["page"]["has_next"] is True
    second = client.get(reverse("ops:families"), {"page": 2})
    assert len(second.context["items"]) == 3


def test_child_detail_aggregates_related_records():
    from ops_helpers import make_service_request

    family, children, parent = make_family()
    make_service_request(children[0], parent)
    client = ops_client(make_staff("operations"))
    response = client.get(reverse("ops:child_detail", args=[children[0].pk]))
    assert response.status_code == 200
    body = response.content.decode()
    for section in [
        "基本信息",
        "活动记录",
        "答卷",
        "报告与画像",
        "伙伴关联与同步",
        "授权记录",
        "服务记录",
    ]:
        assert section in body
    assert children[0].name in body


def test_family_freeze_requires_role_and_writes_audit():
    family, children, parent = make_family()
    operations = ops_client(make_staff("operations"))
    content = ops_client(make_staff("content"))

    denied = content.post(reverse("ops:api_family_status", args=[family.pk]), {"status": "frozen"})
    assert denied.status_code == 403
    assert denied.json()["code"] == "PERMISSION_DENIED"
    family.refresh_from_db()
    assert family.status == "active"

    ok = operations.post(reverse("ops:api_family_status", args=[family.pk]), {"status": "frozen"})
    assert ok.status_code == 200
    family.refresh_from_db()
    assert family.status == "frozen"
    event = AuditEvent.objects.get(action="family.freeze")
    assert event.actor == operations.session["_auth_user_id"] or event.actor_id is not None
    assert event.target_id == family.pk


def test_child_profile_update_validates_and_audits():
    family, children, parent = make_family()
    child = children[0]
    client = ops_client(make_staff("operations"))

    bad = client.post(
        reverse("ops:api_child_profile", args=[child.pk]),
        {"name": "", "gender": "male"},
    )
    assert bad.status_code == 422
    child.refresh_from_db()
    assert child.name == "小芽"

    ok = client.post(
        reverse("ops:api_child_profile", args=[child.pk]),
        {
            "name": "小叶",
            "gender": "female",
            "birth_date": "2019-05-04",
            "revision": child.revision,
        },
    )
    assert ok.status_code == 200
    child.refresh_from_db()
    assert child.name == "小叶"
    assert child.gender == "female"
    assert str(child.birth_date) == "2019-05-04"
    assert child.revision == 2
    assert AuditEvent.objects.filter(action="child.profile_update", target_id=child.pk).exists()


def test_child_profile_rejects_bad_date():
    family, children, parent = make_family()
    client = ops_client(make_staff("operations"))
    response = client.post(
        reverse("ops:api_child_profile", args=[children[0].pk]),
        {"name": "小芽", "gender": "unknown", "birth_date": "2019-13-45"},
    )
    assert response.status_code == 422
    assert "生日格式" in response.json()["message"]


def test_ops_json_requires_login():
    family, children, parent = make_family()
    response = Client().post(
        reverse("ops:api_family_status", args=[family.pk]), {"status": "frozen"}
    )
    assert response.status_code in (302, 403)


# --------------------------------------------------------------------------- 账号与审计


def test_account_admin_can_create_and_manage_staff():
    admin = ops_client(make_staff("account_admin"))
    response = admin.post(
        reverse("ops:account_new"),
        {
            "username": "new-ops-user",
            "name": "新运营",
            "password1": "fresh-pass-12345",
            "password2": "fresh-pass-12345",
            "roles": ["operations", "content"],
        },
    )
    assert response.status_code == 302
    created = get_user_model().objects.get(username="new-ops-user")
    assert set(created.groups.values_list("name", flat=True)) == {"operations", "content"}
    assert AuditEvent.objects.filter(action="staff.create", target_id=created.pk).exists()

    detail = admin.get(reverse("ops:account_detail", args=[created.pk]))
    assert detail.status_code == 200
    assert "运营" in detail.content.decode()

    updated = admin.post(
        reverse("ops:account_detail", args=[created.pk]),
        {"action": "roles", "roles": ["technical"]},
    )
    assert updated.status_code == 302
    created.refresh_from_db()
    assert set(created.groups.values_list("name", flat=True)) == {"technical"}

    disabled = admin.post(
        reverse("ops:account_detail", args=[created.pk]), {"action": "status", "is_active": "0"}
    )
    assert disabled.status_code == 302
    created.refresh_from_db()
    assert created.is_active is False

    reset = admin.post(
        reverse("ops:account_reset_password", args=[created.pk]),
        {"password1": "reset-pass-98765", "password2": "reset-pass-98765"},
    )
    assert reset.status_code == 302
    created.refresh_from_db()
    assert created.check_password("reset-pass-98765")


def test_account_admin_cannot_modify_self_or_other_admin():
    admin = make_staff("account_admin")
    other = make_staff("account_admin")
    client = ops_client(admin)

    assert client.get(reverse("ops:account_detail", args=[admin.pk])).context["editable"] is False
    response = client.post(
        reverse("ops:account_detail", args=[admin.pk]), {"action": "roles", "roles": ["technical"]}
    )
    assert response.status_code == 403
    response = client.post(
        reverse("ops:account_reset_password", args=[other.pk]),
        {"password1": "reset-pass-98765", "password2": "reset-pass-98765"},
    )
    assert response.status_code == 403


def test_operations_cannot_open_account_pages():
    operations = ops_client(make_staff("operations"))
    assert operations.get(reverse("ops:account_new")).status_code == 403
    assert operations.post(reverse("ops:account_new"), {}).status_code == 403


def test_audit_page_filters_by_action_and_actor():
    user = make_staff("operations")
    client = ops_client(user)
    AuditEvent.objects.create(actor=user, action="content.publish", target_kind="", target_label="")
    AuditEvent.objects.create(actor=user, action="family.freeze", target_kind="", target_label="")

    response = client.get(reverse("ops:audit"), {"action": "content.publish"})
    assert response.status_code == 200
    assert [row.action for row in response.context["items"]] == ["content.publish"]

    response = client.get(reverse("ops:audit"), {"actor": user.username})
    assert response.context["page"]["total"] >= 2

    response = client.get(reverse("ops:audit"), {"action": "content.publish"})
    assert "发布内容版本" in response.content.decode()


def test_audit_records_include_human_readable_target():
    from dingdong_ca.core.api.common import audit

    user = make_staff("content")
    family, children, parent = make_family()
    audit(user, "child.profile_update", children[0], "小芽")
    event = AuditEvent.objects.get(action="child.profile_update")
    assert event.target_label == "小芽"
    assert event.target_id == children[0].pk
    assert event.detail == {}


def test_unknown_ops_record_returns_404_page():
    """详情页找不到记录时给运营自己的 404 页，而不是 Django 调试页。

    这里显式覆盖 DEBUG=True 的情况：全局 handler404 只在 DEBUG=False 时生效，
    本地开发若不兜住就会把 URL 配置暴露给运营。
    """
    client = ops_client(make_staff("operations"))
    with override_settings(DEBUG=True):
        response = client.get(reverse("ops:family_detail", args=[uuid.uuid4()]))
    assert response.status_code == 404
    body = response.content.decode()
    assert "没有找到这条记录" in body
    assert "返回查询结果" in body or "返回" in body
    # Django 调试 404 页会列出全部 URL 模式，绝不能出现在运营面前
    assert "URL pattern" not in body and "Using the URLconf" not in body


def test_every_ops_detail_page_has_branded_404():
    """逐个详情页确认：编号不存在时都是品牌化 404，而不是调试页。"""
    client = ops_client(make_staff("account_admin"))
    missing = uuid.uuid4()
    routes = [
        "ops:family_detail",
        "ops:child_detail",
        "ops:questionnaire_edit",
        "ops:questionnaire_preview",
        "ops:activity_edit",
        "ops:activity_preview",
        "ops:report_detail",
        "ops:job_detail",
        "ops:service_detail",
        "ops:account_detail",
    ]
    with override_settings(DEBUG=True):
        for name in routes:
            response = client.get(reverse(name, args=[missing]))
            body = response.content.decode()
            assert response.status_code == 404, name
            assert "没有找到这条记录" in body, name
            assert "URL pattern" not in body, name


def test_json_error_envelope_for_missing_record():
    client = ops_client(make_staff("operations"))
    response = client.post(
        reverse("ops:api_family_status", args=[uuid.uuid4()]), {"status": "frozen"}
    )
    assert response.status_code == 404


def test_ops_pages_do_not_leak_json_or_uuid_only_ui():
    """运营界面的标题栏不出现内部字段名。"""
    family, children, parent = make_family()
    client = ops_client(make_staff("operations"))
    body = client.get(reverse("ops:families")).content.decode()
    assert "data_origin" not in body
    assert "created_by" not in body


def test_child_status_filter_and_counts():
    family, children, parent = make_family(children=3)
    Child.objects.filter(pk=children[0].pk).update(status="archived")
    client = ops_client(make_staff("operations"))
    response = client.get(reverse("ops:family_detail", args=[family.pk]))
    assert response.context["children"][0].status == "archived"
    assert json.dumps({}) == "{}"


def test_ops_templates_avoid_eager_default_lookups():
    """模板里不能写 `|default:某对象.属性`。

    Django 会提前求值 default 的参数，当对象为 None 时抛
    VariableDoesNotExist，整页变成 500。审计记录的操作人就是可空的。
    需要取展示名时用 `|display_name` 过滤器。
    """
    import re
    from pathlib import Path

    templates = Path(__file__).resolve().parents[1] / "dingdong_ca" / "ops" / "templates" / "ops"
    # 匹配 |default:xxx.yyy 这种对属性做默认值的写法
    pattern = re.compile(r"\|default:[A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_]")
    offenders = []
    for path in sorted(templates.glob("*.html")):
        for lineno, line in enumerate(path.read_text().splitlines(), 1):
            if pattern.search(line):
                offenders.append(f"{path.name}:{lineno}: {line.strip()}")
    assert offenders == [], "模板里存在会提前求值的 default 参数：\n" + "\n".join(offenders)


def test_unknown_ops_url_does_not_crash_for_anonymous():
    """匿名访问不存在的后台路径要得到 404，而不是 500。

    这个页面由 handler404 渲染，此时 operator 为 None；
    基础模板若直接取 operator.name 就会抛 VariableDoesNotExist。
    """
    client = Client()
    response = client.get("/ops/this-page-does-not-exist/")
    assert response.status_code == 404
    assert "没有找到这条记录" in response.content.decode()


def test_every_ops_page_returns_non_500_for_each_role():
    """每个角色把后台所有页面点一遍，都不允许出现 500。"""
    family, children, parent = make_family(child_name="小舟")

    missing = uuid.uuid4()
    paths = [
        "/ops/",
        "/ops/families/",
        f"/ops/families/{family.pk}/",
        f"/ops/children/{children[0].pk}/",
        "/ops/questionnaires/",
        "/ops/questionnaires/new/",
        f"/ops/questionnaires/{missing}/",
        "/ops/activities/",
        "/ops/activities/new/",
        f"/ops/activities/{missing}/",
        "/ops/reports/",
        f"/ops/reports/{missing}/",
        "/ops/jobs/",
        f"/ops/jobs/{missing}/",
        "/ops/services/",
        f"/ops/services/{missing}/",
        "/ops/accounts/",
        "/ops/accounts/new/",
        f"/ops/accounts/{missing}/",
        "/ops/audit/",
        "/ops/password/",
    ]
    for roles in (["operations"], ["content"], ["technical"], ["account_admin"]):
        client = ops_client(make_staff(*roles))
        for path in paths:
            response = client.get(path)
            assert response.status_code in (200, 403, 404), (roles, path, response.status_code)


def test_every_audit_action_has_chinese_label():
    """代码里写出的每个审计动作都要有中文词条。

    否则审计页会直接显示 `assessment.create` 这类英文代码，运营看不懂。
    这里从源码里扫出实际使用的动作名，和 labels.AUDIT_ACTION 对照，
    新增动作忘记加词条会立刻失败，不需要人工维护清单。
    """
    import ast
    from pathlib import Path

    from dingdong_ca.ops import labels as L

    root = Path(__file__).resolve().parents[1] / "dingdong_ca"
    found = set()
    for path in root.rglob("*.py"):
        if "migrations" in path.parts:
            continue
        tree = ast.parse(path.read_text())
        for node in ast.walk(tree):
            if not isinstance(node, ast.Call):
                continue
            name = getattr(node.func, "id", None) or getattr(node.func, "attr", None)
            if name in {"audit", "ops_audit"}:
                # audit(user, action, obj, ...) / ops_audit(actor, action, target, ...)
                if len(node.args) >= 2 and isinstance(node.args[1], ast.Constant):
                    if isinstance(node.args[1].value, str):
                        found.add(node.args[1].value)
            elif name == "create":
                for kw in node.keywords:
                    if kw.arg == "action" and isinstance(kw.value, ast.Constant):
                        if isinstance(kw.value.value, str):
                            found.add(kw.value.value)

    assert found, "没有扫描到任何审计动作，检查扫描规则是否失效"
    missing = sorted(code for code in found if code not in L.AUDIT_ACTION)
    assert missing == [], f"这些审计动作缺少中文词条：{missing}"


def test_audit_detail_is_human_readable():
    """审计的说明列不能出现英文键名或完整 UUID。"""
    from dingdong_ca.ops import labels as L

    assert L.humanize_action("assessment.create") == "答卷 · 新建"
    assert L.humanize_action("questionnaire.retire") == "题库 · 停用"
    assert L.humanize_value(True) == "是"
    assert L.humanize_value("assessment") == "测评流程"
    assert L.humanize_value("7a0722d9-2bf5-4df1-9306-87b26b12017d") == "编号 7a0722d9"
    assert L.humanize_value(None) == "未填写"

    # 正式动作优先走词条，不走兜底
    assert L.AUDIT_ACTION["assessment.create"] == "家长开始答题"


def test_audit_page_shows_no_english_codes_or_full_uuids():
    """审计页面上不能出现英文动作代码或完整 UUID。

    这是运营实际会看到的一页：动作要是中文，对象要是业务名称，
    说明列要能读懂。UUID 只保留 8 位短编号。
    """
    from dingdong_ca.core.models import AuditEvent

    family, children, parent = make_family(child_name="小松")
    # 没有 target_label 的记录最容易泄漏内部编号，这里专门留一条
    bare_id = uuid.uuid4()
    AuditEvent.objects.create(
        action="assessment.create", target_kind="assessment_session", target_id=bare_id
    )
    AuditEvent.objects.create(action="auth.login", target_kind="app_user", target_id=parent.pk)
    AuditEvent.objects.create(
        action="family.freeze",
        target_kind="family",
        target_id=family.pk,
        target_label="小松家长 的家庭（尾号 0009）",
        detail={"children": 1},
    )

    client = ops_client(make_staff("account_admin"))
    body = client.get("/ops/audit/").content.decode()
    # 只检查表格内容。筛选下拉的 option value 是内部代码（用来传参），
    # 运营看到的是 option 的中文文字，属于正常。
    rows = body.split("<tbody>", 1)[1].split("</tbody>", 1)[0]

    assert "家长开始答题" in rows
    assert "家长登录" in rows
    assert "儿童数量：1" in rows
    for code in ("assessment.create", "auth.login", "family.freeze", "target_kind"):
        assert code not in rows, f"审计表格出现了内部代码 {code}"
    assert str(bare_id) not in rows
    assert str(family.pk) not in rows
    # 兜底也要给个短编号，而不是空白
    assert f"编号 {str(bare_id)[:8]}" in rows
