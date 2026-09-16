"""运营后台：CA 账户只读页的展示、筛选与权限边界。"""

import uuid

import pytest
from ops_helpers import make_family, make_staff, ops_client

from dingdong_ca.core.services import ca_account as service

pytestmark = pytest.mark.django_db

TOKEN = "ROBOT-TOKEN-PLAINTEXT-7788"


def seed_account(child_name="小芽", token=TOKEN, phone="+8613800000007"):
    family, children, parent = make_family(child_name=child_name, phone=phone)
    account, _ = service.issue_account(
        child=children[0],
        user=parent,
        request_id=uuid.uuid4(),
        nfc_token=token,
        robot_ref="DD-ROBOT-0007",
    )
    return account, children[0], parent


def test_page_lists_account_without_leaking_token():
    account, child, parent = seed_account()
    staff = ops_client(make_staff("operations"))
    page = staff.get("/ops/ca-accounts/")
    assert page.status_code == 200
    body = page.content.decode()
    assert account.ca_account_id in body
    assert child.name in body
    assert "DD-ROBOT-0007" in body
    assert parent.phone in body
    # 两个状态维度分别显示，别把"待接通"和"已归档"混成一个词
    assert "待接通" in body and "使用中" in body
    # 明文 token 绝不出现；只允许出现摘要前 8 位
    assert TOKEN not in body
    # 顶部说明必须走"块级子元素"的结构：Tabler 的 .alert 是 flex 容器，
    # 散落的文本节点会各自占一列（真实浏览器里已被这个坑伤过一次）。
    assert 'class="alert alert-info"' in body
    assert "alert-heading" in body
    assert account.nfc_token_hash[:8] in body


def test_page_filters_by_status_bind_state_and_keyword():
    kept, kept_child, _parent = seed_account(child_name="小满")
    gone, _child, _ = seed_account(
        child_name="小松", token="ROBOT-TOKEN-OTHER", phone="+8613800000017"
    )
    service.retire_account(gone, gone.bound_by)
    staff = ops_client(make_staff("technical"))

    active = staff.get("/ops/ca-accounts/?status=active").content.decode()
    assert kept.ca_account_id in active and gone.ca_account_id not in active
    retired = staff.get("/ops/ca-accounts/?status=retired").content.decode()
    assert gone.ca_account_id in retired and kept.ca_account_id not in retired

    unbound = staff.get("/ops/ca-accounts/?bind_state=unbound").content.decode()
    assert kept.ca_account_id in unbound

    by_child = staff.get("/ops/ca-accounts/?q=小满").content.decode()
    assert kept.ca_account_id in by_child and gone.ca_account_id not in by_child

    by_number = staff.get("/ops/ca-accounts/?q=" + kept.ca_account_id[:12]).content.decode()
    assert kept.ca_account_id in by_number


def test_bad_filter_value_is_reported_not_silently_ignored():
    seed_account()
    staff = ops_client(make_staff("operations"))
    page = staff.get("/ops/ca-accounts/?status=nonsense")
    assert page.status_code == 200
    assert "状态" in page.content.decode()


def test_content_role_has_no_access():
    seed_account()
    staff = ops_client(make_staff("content"))
    assert staff.get("/ops/ca-accounts/").status_code == 403


def test_parent_never_reaches_ops_page():
    seed_account()
    from ops_helpers import make_parent

    parent = ops_client(make_parent(phone="+8613800000008"))
    response = parent.get("/ops/ca-accounts/")
    assert response.status_code in {302, 403}
    assert "/ops/login/" in response.get("Location", "") or response.status_code == 403
