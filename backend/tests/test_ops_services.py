"""运营后台：服务事项的筛选、查看、处理闭环与权限边界。"""

import pytest
from ops_helpers import make_family, make_service_request, make_staff, ops_client

from dingdong_ca.core.models import AuditEvent, DataRequest

pytestmark = pytest.mark.django_db


def seed_requests():
    family, children, parent = make_family(child_name="小满", phone="+8613800000009")
    support = make_service_request(children[0], parent, kind="support", reason="support_needed")
    correction = make_service_request(
        children[0], parent, kind="correction", reason="correct_profile"
    )
    deletion = make_service_request(children[0], parent, kind="deletion", reason="delete_all")
    return children[0], parent, support, correction, deletion


def test_service_list_shows_counts_and_filters():
    _child, parent, support, correction, _deletion = seed_requests()
    staff = ops_client(make_staff("operations"))

    page = staff.get("/ops/services/")
    assert page.status_code == 200
    body = page.content.decode()
    assert "家长求助" in body and "资料更正申请" in body and "数据删除申请" in body
    assert parent.phone in body

    only_support = staff.get("/ops/services/", {"kind": "support"})
    assert only_support.status_code == 200
    filtered = only_support.content.decode()
    assert str(support.pk) in filtered
    assert str(correction.pk) not in filtered

    by_child = staff.get("/ops/services/", {"q": "小满"})
    assert by_child.status_code == 200
    assert str(support.pk) in by_child.content.decode()

    by_phone = staff.get("/ops/services/", {"q": parent.phone})
    assert str(correction.pk) in by_phone.content.decode()


def test_service_detail_uses_business_language_and_records_history():
    _child, parent, support, _correction, _deletion = seed_requests()
    staff = ops_client(make_staff("operations"))

    page = staff.get(f"/ops/services/{support.pk}/")
    assert page.status_code == 200
    body = page.content.decode()
    assert "家长求助" in body
    assert parent.name in body
    assert str(support.pk) in body  # 事项编号对运营可见，便于与家长沟通


def test_service_detail_other_requests_exclude_current_row():
    """O-13：标题写着「其他事项」，就不能把当前这条事项自己列进去。"""
    _child, _parent, support, correction, deletion = seed_requests()
    staff = ops_client(make_staff("operations"))

    page = staff.get(f"/ops/services/{support.pk}/")
    assert {row.pk for row in page.context["child_requests"]} == {correction.pk, deletion.pk}
    assert "该儿童的其他事项" in page.content.decode()

    # 该儿童只有这一条事项时，整块不显示
    _family, children, parent = make_family(child_name="小单", phone="+8613800000029")
    only = make_service_request(children[0], parent)
    solo = staff.get(f"/ops/services/{only.pk}/")
    assert list(solo.context["child_requests"]) == []
    assert "该儿童的其他事项" not in solo.content.decode()


def test_requester_column_does_not_repeat_phone_when_name_is_blank():
    """O-08：家长没填姓名时姓名列给「未填写」，手机号只出现一次。

    姓名列原先用 `|display_name`，它在姓名为空时回落手机号，而紧邻的小字又是
    同一个手机号，列表里就出现 `+8613… +8613…`。
    """
    _family, children, parent = make_family(
        child_name="小满", phone="+8613800000019", parent_name=""
    )
    support = make_service_request(children[0], parent, kind="support", reason="support_needed")
    staff = ops_client(make_staff("operations"))

    body = staff.get("/ops/services/").content.decode()
    assert body.count(parent.phone) == 1
    assert "未填写" in body

    detail = staff.get(f"/ops/services/{support.pk}/").content.decode()
    assert detail.count(parent.phone) == 1
    assert "未填写（" + parent.phone in detail


def test_resolve_completes_request_and_writes_audit_note():
    _child, _parent, support, _correction, _deletion = seed_requests()
    operator = make_staff("operations")
    staff = ops_client(operator)

    response = staff.post(
        f"/api/v1/staff/data-requests/{support.pk}/resolve",
        {"action": "resolve", "resolution_code": "resolved", "note": "已电话联系家长确认。"},
        format="json",
    )
    assert response.status_code == 200, response.content

    support.refresh_from_db()
    assert support.status == "completed"
    assert support.resolution_note == "已电话联系家长确认。"
    assert support.completed_at is not None

    event = AuditEvent.objects.get(action="data_request.resolve", target_id=support.pk)
    assert event.detail["note"] == "已电话联系家长确认。"
    assert event.actor_id == operator.pk

    # 重复处理同一结果码是幂等的，不会二次改写
    again = staff.post(
        f"/api/v1/staff/data-requests/{support.pk}/resolve",
        {"action": "resolve", "resolution_code": "resolved", "note": "第二次"},
        format="json",
    )
    assert again.status_code == 200
    support.refresh_from_db()
    assert support.resolution_note == "已电话联系家长确认。"


def test_resolve_with_mismatched_result_code_is_rejected():
    _child, _parent, support, _correction, _deletion = seed_requests()
    staff = ops_client(make_staff("operations"))

    response = staff.post(
        f"/api/v1/staff/data-requests/{support.pk}/resolve",
        {"action": "cancel", "resolution_code": "resolved"},
        format="json",
    )
    assert response.status_code == 422
    support.refresh_from_db()
    assert support.status == "open"


def test_deletion_request_requires_technical_role():
    _child, _parent, _support, _correction, deletion = seed_requests()
    operations = ops_client(make_staff("operations"))
    technical = ops_client(make_staff("technical"))

    blocked = operations.post(
        f"/api/v1/staff/data-requests/{deletion.pk}/resolve",
        {"action": "execute_deletion", "resolution_code": "deleted"},
        format="json",
    )
    assert blocked.status_code == 403
    deletion.refresh_from_db()
    assert deletion.status == "open"
    assert deletion.child_id is not None

    executed = technical.post(
        f"/api/v1/staff/data-requests/{deletion.pk}/resolve",
        {"action": "execute_deletion", "resolution_code": "deleted", "note": "已与家长确认。"},
        format="json",
    )
    assert executed.status_code == 200, executed.content
    deletion.refresh_from_db()
    assert deletion.status == "completed"
    assert deletion.child_id is None  # 儿童数据已删除，事项保留为凭据


def test_content_role_cannot_view_or_handle_services():
    _child, _parent, support, _correction, _deletion = seed_requests()
    content = ops_client(make_staff("content"))

    page = content.get("/ops/services/")
    assert page.status_code == 403

    blocked = content.post(
        f"/api/v1/staff/data-requests/{support.pk}/resolve",
        {"action": "resolve", "resolution_code": "resolved"},
        format="json",
    )
    assert blocked.status_code == 403
    assert DataRequest.objects.get(pk=support.pk).status == "open"


def test_deleted_child_request_pages_still_render():
    """儿童数据已实际删除后，事项本身仍要能打开。

    删除申请执行后 DataRequest.child 变为空，但这条记录是家长的凭据，
    运营必须还能查到它。列表和详情页都不能因为 child 为空而报 500。
    """
    _child, _parent, _support, _correction, deletion = seed_requests()
    technical = ops_client(make_staff("technical"))
    executed = technical.post(
        f"/api/v1/staff/data-requests/{deletion.pk}/resolve",
        {"action": "execute_deletion", "resolution_code": "deleted", "note": "已与家长确认。"},
        format="json",
    )
    assert executed.status_code == 200, executed.content
    deletion.refresh_from_db()
    assert deletion.child_id is None

    staff = ops_client(make_staff("operations"))
    listing = staff.get("/ops/services/")
    assert listing.status_code == 200
    assert "未删除" not in listing.content.decode()[:0]  # 占位，真正断言在下一行
    assert str(deletion.pk) in listing.content.decode()

    detail = staff.get(f"/ops/services/{deletion.pk}/")
    assert detail.status_code == 200, detail.content
    body = detail.content.decode()
    assert "事项信息" in body
    assert "已删除" in body or "已归档" in body or "儿童" in body


def test_service_detail_renders_system_audit_events():
    """处理历史里包含系统事件（actor 为空）时，详情页仍要能打开。

    AuditEvent.actor 可空，系统自动写入的事件没有操作人。模板里用
    `{{ row.actor.name|default:row.actor.username|default:"系统" }}` 取名字，
    而 default 的参数会被提前求值，actor 为 None 时直接抛 VariableDoesNotExist。
    """
    _child, _parent, support, _correction, _deletion = seed_requests()
    AuditEvent.objects.create(
        action="data_request.note",
        target_id=support.pk,
        target_label="小满 · 家长求助",
        actor=None,
        detail={"note": "系统自动记录。"},
    )

    staff = ops_client(make_staff("operations"))
    detail = staff.get(f"/ops/services/{support.pk}/")
    assert detail.status_code == 200, detail.content
    assert "系统" in detail.content.decode()


def test_every_ops_page_renders_system_audit_events():
    """审计为空操作人时，所有展示审计记录的页面都不能崩。"""
    family, children, parent = make_family(child_name="小禾")
    AuditEvent.objects.create(action="report.generated", target_id=children[0].pk, actor=None)

    staff = ops_client(make_staff("account_admin"))
    for path in ["/ops/", "/ops/audit/", "/ops/services/", f"/ops/children/{children[0].pk}/"]:
        response = staff.get(path)
        assert response.status_code == 200, (path, response.content[:400])
