"""运营后台：CA 账户只读页的展示、筛选与权限边界。"""

import re
import uuid
from pathlib import Path

import pytest
from ops_helpers import make_family, make_staff, ops_client

from dingdong_ca.core.services import ca_account as service

pytestmark = pytest.mark.django_db

TOKEN = "ROBOT-TOKEN-PLAINTEXT-7788"

OPS_TEMPLATES = Path(__file__).resolve().parents[1] / "dingdong_ca" / "ops" / "templates"


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


def test_parent_without_name_shows_phone_not_internal_account():
    """CA 账户页「绑定家长」列：家长没填姓名时回落手机号，不显示 parent-<uuid>。"""
    account, child, parent = seed_account()
    parent.name = ""
    parent.save(update_fields=["name"])
    staff = ops_client(make_staff("operations"))
    body = staff.get("/ops/ca-accounts/").content.decode()
    assert "parent-" not in body
    assert parent.username not in body
    assert parent.phone in body


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


def test_page_does_not_render_template_comment_as_text():
    seed_account()
    staff = ops_client(make_staff("operations"))
    body = staff.get("/ops/ca-accounts/").content.decode()
    assert "{#" not in body
    assert "内容必须包在一个块级容器里" not in body


def test_bound_parent_column_and_credential_label():
    """O-08/O-11：绑定家长列不重复手机号；凭据摘要不再叫「指纹」。

    「指纹」在家长端已因容易被理解成生物特征而去掉（T-012/P-09），运营端
    同一份界面里还留着，两处口径不一致。
    """
    family, children, parent = make_family(
        child_name="小芽", phone="+8613800000029", parent_name=""
    )
    service.issue_account(
        child=children[0],
        user=parent,
        request_id=uuid.uuid4(),
        nfc_token="ROBOT-TOKEN-PLAINTEXT-0041",
        robot_ref="DD-ROBOT-0041",
    )
    staff = ops_client(make_staff("operations"))

    body = staff.get("/ops/ca-accounts/").content.decode()
    assert body.count(parent.phone) == 1
    assert "未填写" in body
    assert "凭据前 8 位" in body
    assert "指纹" not in body


def test_ops_templates_have_no_multiline_django_comment():
    """Django 的 tag_re 不带 re.DOTALL，跨行 {# … #} 不会当注释，会原样渲染成正文。"""
    offenders = []
    for path in sorted(OPS_TEMPLATES.rglob("*.html")):
        text = path.read_text(encoding="utf-8")
        for match in re.finditer(r"\{#(.*?)#\}", text, flags=re.DOTALL):
            if "\n" in match.group(1):
                line = text[: match.start()].count("\n") + 1
                offenders.append(f"{path.relative_to(OPS_TEMPLATES)}:{line}")
    assert offenders == []


def test_parent_never_reaches_ops_page():
    seed_account()
    from ops_helpers import make_parent

    parent = ops_client(make_parent(phone="+8613800000008"))
    response = parent.get("/ops/ca-accounts/")
    assert response.status_code in {302, 403}
    assert "/ops/login/" in response.get("Location", "") or response.status_code == 403
