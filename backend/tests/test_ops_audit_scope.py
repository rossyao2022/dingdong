"""首页与其他入口不得绕过审计权限（独立验收 P1）。

复现场景（v0.3.2 公网真实浏览器已确认）：
内容运营访问 /ops/audit/ 得到 403，但 /ops/ 首页的「最近操作」直接显示全站
最近 8 条审计记录，其中包含儿童业务名称与操作人员。

这里从服务端锁死：
1. 没有 audit.view 的角色在任何入口都拿不到审计数据；
2. 有权限的角色日常工作不被误拦；
3. 首页各卡片/统计按角色可见范围裁剪，不靠模板隐藏；
4. 停用账号与角色变更对已登录会话立即生效。
"""

import uuid

import pytest
from django.contrib.auth.models import Group
from ops_helpers import make_family, make_service_request, make_staff, ops_client, post_json
from test_ops_content import create_questionnaire, question

from dingdong_ca.core.models import AuditEvent

pytestmark = pytest.mark.django_db

# 只可能出现在审计记录里的合成标记，用来判断审计内容是否泄漏到别的入口
AUDIT_MARKER = "合成审计标记-儿童改名-9f3a"


def seed_audit():
    actor = make_staff("operations", name="合成操作人")
    family, children, parent = make_family(child_name="审计标记儿童")
    AuditEvent.objects.create(
        actor=actor,
        action="child.profile_update",
        target_kind="child",
        target_id=children[0].pk,
        target_label=AUDIT_MARKER,
        detail={"after": {"name": AUDIT_MARKER}},
    )
    return actor, family, children


# --------------------------------------------------------------------------- 首页


def test_content_role_cannot_read_audit_from_dashboard():
    seed_audit()
    client = ops_client(make_staff("content", name="内容运营"))
    response = client.get(reverse_url())
    assert response.status_code == 200
    assert response.context["recent_audit"] == []
    body = response.content.decode()
    assert AUDIT_MARKER not in body
    assert "最近操作" not in body
    # 首页本身仍可用，只是没有审计区块
    assert "工作首页" in body


def test_operations_role_still_sees_audit_on_dashboard():
    seed_audit()
    client = ops_client(make_staff("operations", name="普通运营"))
    response = client.get(reverse_url())
    assert response.status_code == 200
    body = response.content.decode()
    assert AUDIT_MARKER in body
    assert response.context["recent_audit"]


def test_content_role_is_denied_the_audit_page_itself():
    client = ops_client(make_staff("content"))
    response = client.get("/ops/audit/")
    assert response.status_code == 403
    assert "权限不足" in response.content.decode()


def test_audit_view_permission_is_the_only_source_of_the_dashboard_feed():
    """构造一个只有 dashboard.view 的自定义角色，确认首页依然不给审计。"""
    seed_audit()
    Group.objects.get_or_create(name="dashboard_only")
    from dingdong_ca.ops import permissions as ops_permissions

    original = dict(ops_permissions.PERMISSIONS)
    ops_permissions.PERMISSIONS["dashboard.view"] = set(original["dashboard.view"]) | {
        "dashboard_only"
    }
    try:
        client = ops_client(make_staff("dashboard_only", name="只读首页"))
        response = client.get(reverse_url())
        assert response.status_code == 200
        assert response.context["recent_audit"] == []
        assert AUDIT_MARKER not in response.content.decode()
    finally:
        ops_permissions.PERMISSIONS.clear()
        ops_permissions.PERMISSIONS.update(original)


def test_dashboard_scope_is_trimmed_per_role():
    """首页统计与待办按角色可见范围返回，不依赖模板隐藏。"""
    family, children, parent = make_family()
    make_service_request(children[0], parent)

    content = ops_client(make_staff("content"))
    context = content.get(reverse_url()).context
    assert context["metrics"] == []
    assert "open_services" not in context["counters"]
    assert context["open_service_items"] == []

    operations = ops_client(make_staff("operations"))
    context = operations.get(reverse_url()).context
    assert {metric["key"] for metric in context["metrics"]} >= {"families", "children"}
    assert "open_services" in context["counters"]


# --------------------------------------------------------------------------- 其他入口


def test_pages_rendering_audit_are_all_permission_gated():
    """会展示审计块的页面，对没有 audit.view 的角色一律 403。"""
    _, family, children = seed_audit()
    client = ops_client(make_staff("content"))
    for path in [
        "/ops/audit/",
        f"/ops/families/{family.pk}/",
        f"/ops/children/{children[0].pk}/",
        "/ops/jobs/",
        "/ops/accounts/",
        "/ops/services/",
    ]:
        response = client.get(path)
        assert response.status_code == 403, path
        assert AUDIT_MARKER not in response.content.decode(), path


def test_reused_staff_endpoints_match_console_roles():
    """复用的 /api/v1/staff/* 接口与运营后台的角色判定必须一致。"""
    import json

    admin = ops_client(make_staff("account_admin"))
    version_id = create_questionnaire(admin, title="接口一致性")
    post_json(
        admin,
        f"/ops/api/questionnaires/{version_id}",
        {"title": "接口一致性", "description": "说明", "questions": [question("Q1")]},
    )

    operations = ops_client(make_staff("operations"))
    content = ops_client(make_staff("content"))
    technical = ops_client(make_staff("technical"))

    publish_url = f"/api/v1/staff/questionnaires/{version_id}/publish"
    assert operations.post(publish_url).status_code == 403
    assert technical.post(publish_url).status_code == 403
    assert content.post(publish_url).status_code == 200

    missing_job = "00000000-0000-0000-0000-000000000000"
    assert content.post(f"/api/v1/staff/jobs/{missing_job}/retry").status_code == 403
    assert operations.post(f"/api/v1/staff/jobs/{missing_job}/retry").status_code == 403
    # technical 与 account_admin 只受"任务不存在"限制，不受角色限制
    assert technical.post(f"/api/v1/staff/jobs/{missing_job}/retry").status_code == 404
    assert admin.post(f"/api/v1/staff/jobs/{missing_job}/retry").status_code == 404

    missing_request = "00000000-0000-0000-0000-000000000000"
    resolve_url = f"/api/v1/staff/data-requests/{missing_request}/resolve"
    body = {"action": "resolve", "resolution_code": "resolved", "note": ""}
    assert post_json(content, resolve_url, body).status_code == 403
    assert post_json(operations, resolve_url, body).status_code == 404

    missing_user = "00000000-0000-0000-0000-000000000000"
    roles_url = f"/api/v1/staff/users/{missing_user}/roles"
    payload = json.dumps({"role_codes": ["operations"]})
    denied = operations.patch(roles_url, payload, content_type="application/json")
    assert denied.status_code == 403
    allowed = admin.patch(roles_url, payload, content_type="application/json")
    assert allowed.status_code == 404


# --------------------------------------------------------------------------- 会话生效


def test_disabled_account_loses_its_existing_session():
    user = make_staff("operations", name="会被停用")
    client = ops_client(user)
    assert client.get("/ops/").status_code == 200

    user.is_active = False
    user.save(update_fields=["is_active"])

    response = client.get("/ops/")
    assert response.status_code == 302
    assert response["Location"].startswith("/ops/login/")


def test_role_change_applies_to_existing_session():
    user = make_staff("operations", name="会被改角色")
    client = ops_client(user)
    assert client.get("/ops/accounts/").status_code == 403

    user.groups.set(Group.objects.filter(name="account_admin"))
    assert client.get("/ops/accounts/").status_code == 200

    user.groups.set(Group.objects.filter(name="content"))
    assert client.get("/ops/accounts/").status_code == 403
    assert client.get("/ops/questionnaires/").status_code == 200


# --------------------------------------------------------------------------- 对象列


def test_audit_object_column_shows_chinese_target_names():
    """审计「对象」列必须是运营看得懂的中文，不能出现表名或英文模型名。

    真实记录（本地合成库 2026-09-17 10:15）：家长登录一条写的是
    「未知（login_grant） login grant（parent-a4f7a3365ec2479fbb61a3ffc9c6a5d4）」。
    """
    from django.utils import timezone

    from dingdong_ca.core.api.common import audit
    from dingdong_ca.core.models import LoginGrant

    # 家长没填姓名时 describe_target 会借关联家长的名字，正是线上那条记录的形状
    _, _, parent = make_family(child_name="对象词条儿童", parent_name="")
    grant = LoginGrant.objects.create(
        user=parent,
        current_refresh_jti=uuid.uuid4(),
        expires_at=timezone.now() + timezone.timedelta(days=1),
    )
    audit(parent, "auth.login", grant)

    body = ops_client(make_staff("account_admin")).get("/ops/audit/").content.decode()
    rows = body.split("<tbody>", 1)[1].split("</tbody>", 1)[0]

    assert "登录凭据" in rows
    for raw in ("login_grant", "login grant"):
        assert raw not in rows, f"审计表格出现了内部码 {raw}"


def test_audit_object_subline_parent_name_falls_back_to_phone():
    """审计「对象」列副行里，家长没填姓名时回落手机号，不显示 parent-<uuid>。"""
    from django.utils import timezone

    from dingdong_ca.core.api.common import audit
    from dingdong_ca.core.models import LoginGrant

    _, _, parent = make_family(child_name="副行儿童", parent_name="")
    grant = LoginGrant.objects.create(
        user=parent,
        current_refresh_jti=uuid.uuid4(),
        expires_at=timezone.now() + timezone.timedelta(days=1),
    )
    audit(parent, "auth.login", grant)

    body = ops_client(make_staff("account_admin")).get("/ops/audit/").content.decode()
    rows = body.split("<tbody>", 1)[1].split("</tbody>", 1)[0]
    assert "parent-" not in rows
    assert parent.username not in rows
    assert parent.phone in rows


def test_audit_object_label_translates_model_names():
    """`describe_target` 的「英文模型名（关联对象名）」写法在页面上要变成中文。"""
    from dingdong_ca.ops.templatetags.ops_labels import audit_target

    assert audit_target("login grant（家长甲）") == "登录凭据（家长甲）"
    assert audit_target("assessment session（小芽）") == "答卷（小芽）"
    assert audit_target("consent grant（小芽）") == "授权记录（小芽）"
    # 已经是业务名称的标签、空值、未知模型名都不动
    assert audit_target("小芽") == "小芽"
    assert audit_target("") == ""
    assert audit_target("synthetic fixture（小芽）") == "synthetic fixture（小芽）"


def reverse_url():
    from django.urls import reverse

    return reverse("ops:dashboard")
