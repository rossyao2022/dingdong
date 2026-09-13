"""跨入口修订号保护：家长端、运营后台与技术后台编辑同一份儿童档案。

第二轮独立验收复现：家长通过真实家长 API 修改儿童称呼后，运营旧页面用之前的 revision
保存仍然 200，把家长的新修改覆盖回旧值。根因是只有运营入口递增 revision。
"""

import pytest
from conftest import create_child, sign_in
from ops_helpers import make_family, make_staff, ops_client, post_json

from dingdong_ca.core.models import Child

pytestmark = pytest.mark.django_db


def child_profile_body(**changes):
    body = {"name": "运营旧页面称呼", "gender": "unknown", "birth_date": ""}
    body.update(changes)
    return body


def test_parent_edit_invalidates_ops_stale_revision(client):
    """家长改过之后，运营旧页面用旧 revision 保存必须 409，且不能落库。"""
    sign_in(client)
    created = create_child(client, name="原始称呼")
    child = Child.objects.get(pk=created["id"])
    stale_revision = child.revision
    assert stale_revision >= 1

    ops = ops_client(make_staff("operations"))

    parent_edit = client.patch(
        "/api/v1/children/" + str(child.pk), {"name": "家长刚更正"}, format="json"
    )
    assert parent_edit.status_code == 200, parent_edit.content

    stale = post_json(
        ops,
        "/ops/api/children/" + str(child.pk),
        child_profile_body(name="运营旧页面称呼"),
        revision=stale_revision,
    )
    child.refresh_from_db()
    assert stale.status_code == 409, (
        f"过期运营保存返回 {stale.status_code}；库中称呼={child.name!r}"
    )
    assert stale.json()["code"] == "EDIT_CONFLICT"
    assert child.name == "家长刚更正", "过期运营保存覆盖了家长的修改"


def test_parent_edit_advances_revision(client):
    """家长端的修改也要推进修订号，否则旧 revision 永远有效。"""
    sign_in(client)
    created = create_child(client)
    child = Child.objects.get(pk=created["id"])
    before = child.revision

    response = client.patch(
        "/api/v1/children/" + str(child.pk), {"name": "家长改名"}, format="json"
    )
    assert response.status_code == 200, response.content
    child.refresh_from_db()
    assert child.revision == before + 1


def test_parent_patch_returns_revision(client):
    """家长端需要拿到修订号才能在下一次编辑时声明"我基于哪一版"。"""
    sign_in(client)
    created = create_child(client)
    assert "revision" in created

    response = client.patch(
        "/api/v1/children/" + created["id"], {"name": "家长改名"}, format="json"
    )
    assert response.status_code == 200
    assert response.json()["revision"] == created["revision"] + 1


def test_ops_edit_invalidates_parent_stale_page(client):
    """反向顺序：运营改过之后，家长旧页面带着旧 revision 提交必须 409。"""
    sign_in(client)
    created = create_child(client, name="原始称呼")
    child = Child.objects.get(pk=created["id"])
    stale_revision = created["revision"]

    ops = ops_client(make_staff("operations"))
    fresh = post_json(
        ops, "/ops/api/children/" + str(child.pk), child_profile_body(name="运营更正")
    )
    assert fresh.status_code == 200, fresh.content

    stale = client.patch(
        "/api/v1/children/" + str(child.pk),
        {"name": "家长旧页面称呼", "revision": stale_revision},
        format="json",
    )
    child.refresh_from_db()
    assert stale.status_code == 409, f"家长旧页面返回 {stale.status_code}；库中称呼={child.name!r}"
    assert child.name == "运营更正"


def test_parent_patch_without_revision_stays_compatible(client):
    """已部署的旧客户端不带 revision：仍要能用，但必须推进修订号。"""
    sign_in(client)
    created = create_child(client)
    child = Child.objects.get(pk=created["id"])
    before = child.revision

    legacy = client.patch(
        "/api/v1/children/" + str(created["id"]), {"name": "旧客户端改名"}, format="json"
    )
    assert legacy.status_code == 200, legacy.content
    child.refresh_from_db()
    assert child.name == "旧客户端改名"
    assert child.revision == before + 1


def test_parent_patch_rejects_malformed_revision(client):
    sign_in(client)
    created = create_child(client)
    response = client.patch(
        "/api/v1/children/" + created["id"],
        {"name": "坏修订号", "revision": "abc"},
        format="json",
    )
    assert response.status_code == 422
    assert response.json()["code"] == "VALIDATION_ERROR"


def test_conflict_then_reload_then_save_succeeds(client):
    """冲突不是死路：重新读取最新 revision 后可以正常保存。"""
    sign_in(client)
    created = create_child(client, name="原始称呼")
    child = Child.objects.get(pk=created["id"])

    ops = ops_client(make_staff("operations"))
    stale_revision = child.revision
    assert (
        client.patch(
            "/api/v1/children/" + str(child.pk), {"name": "家长改名"}, format="json"
        ).status_code
        == 200
    )

    assert (
        post_json(
            ops,
            "/ops/api/children/" + str(child.pk),
            child_profile_body(name="运营旧值"),
            revision=stale_revision,
        ).status_code
        == 409
    )

    child.refresh_from_db()
    recovered = post_json(
        ops,
        "/ops/api/children/" + str(child.pk),
        child_profile_body(name="运营确认后的称呼"),
        revision=child.revision,
    )
    assert recovered.status_code == 200, recovered.content
    child.refresh_from_db()
    assert child.name == "运营确认后的称呼"
    assert child.revision == stale_revision + 2


def test_parent_conflict_recovery_reads_latest_via_detail_get(client):
    """家长端冲突恢复是"读一次最新档案再重填"。

    这条读取曾经不存在（路径只注册了 PATCH），家长被 409 打回后拿不到最新档案，
    真实浏览器里表现为"请求被拒绝，请检查方法、格式和权限"，冲突变成死路。
    """
    sign_in(client)
    created = create_child(client, name="原始称呼")
    child = Child.objects.get(pk=created["id"])
    stale_revision = created["revision"]

    ops = ops_client(make_staff("operations"))
    assert (
        post_json(
            ops, "/ops/api/children/" + str(child.pk), child_profile_body(name="运营更正")
        ).status_code
        == 200
    )

    stale = client.patch(
        "/api/v1/children/" + str(child.pk),
        {"name": "家长旧页面保存", "revision": stale_revision},
        format="json",
    )
    assert stale.status_code == 409

    latest = client.get("/api/v1/children/" + str(child.pk))
    assert latest.status_code == 200, latest.content
    assert latest.json()["name"] == "运营更正"

    retry = client.patch(
        "/api/v1/children/" + str(child.pk),
        {"name": "家长重新确认", "revision": latest.json()["revision"]},
        format="json",
    )
    assert retry.status_code == 200, retry.content
    child.refresh_from_db()
    assert child.name == "家长重新确认"


def test_parent_edit_of_other_family_child_is_rejected(client):
    """跨家庭修改仍然被拒绝，不能因为新增 revision 而放宽隔离。"""
    sign_in(client)
    _, children, _ = make_family(phone="+8613800009999")
    other = children[0]

    response = client.patch(
        "/api/v1/children/" + str(other.pk), {"name": "越权改名"}, format="json"
    )
    assert response.status_code == 404
    other.refresh_from_db()
    assert other.name != "越权改名"


def test_conflicting_parent_edits_keep_single_winner(client):
    """两个标签页顺序提交：后提交且持旧 revision 的那个必须失败。"""
    sign_in(client)
    created = create_child(client, name="原始称呼")
    child = Child.objects.get(pk=created["id"])
    first_revision = created["revision"]

    first = client.patch(
        "/api/v1/children/" + str(child.pk),
        {"name": "标签页A", "revision": first_revision},
        format="json",
    )
    assert first.status_code == 200, first.content

    second = client.patch(
        "/api/v1/children/" + str(child.pk),
        {"name": "标签页B", "revision": first_revision},
        format="json",
    )
    assert second.status_code == 409
    child.refresh_from_db()
    assert child.name == "标签页A"


def test_duplicate_submit_with_stale_revision_is_rejected_without_corruption(client):
    """重复提交（双击/重放）只会成功一次，不会把档案改坏。"""
    sign_in(client)
    created = create_child(client, name="原始称呼")
    child = Child.objects.get(pk=created["id"])
    revision = created["revision"]
    body = {"name": "重复提交的名字", "revision": revision}

    first = client.patch("/api/v1/children/" + str(child.pk), body, format="json")
    second = client.patch("/api/v1/children/" + str(child.pk), body, format="json")

    assert first.status_code == 200
    assert second.status_code == 409
    child.refresh_from_db()
    assert child.name == "重复提交的名字"
    assert child.revision == revision + 1, "重复提交不应额外推进修订号"


def test_repeat_after_rereading_revision_succeeds(client):
    """读回最新修订号后再次提交是正常编辑，不是冲突。"""
    sign_in(client)
    created = create_child(client, name="原始称呼")
    child = Child.objects.get(pk=created["id"])

    first = client.patch("/api/v1/children/" + str(child.pk), {"name": "第一次"}, format="json")
    assert first.status_code == 200
    fresh = first.json()["revision"]

    second = client.patch(
        "/api/v1/children/" + str(child.pk),
        {"name": "第二次", "revision": fresh},
        format="json",
    )
    assert second.status_code == 200, second.content
    child.refresh_from_db()
    assert child.name == "第二次"
    assert child.revision == fresh + 1


def test_child_edits_are_serialized_by_row_lock(client):
    """真并发语义：写操作在行锁内做"读修订号→比较→写"。

    第二个进入的写者一定会看到第一个已提交的修订号，因此顺序无论先后，
    都只能有一个赢家，不可能双双写入。
    """
    sign_in(client)
    created = create_child(client, name="原始称呼")
    child = Child.objects.get(pk=created["id"])
    stale_revision = created["revision"]

    ops = ops_client(make_staff("operations"))
    winner = post_json(
        ops,
        "/ops/api/children/" + str(child.pk),
        child_profile_body(name="运营赢家"),
        revision=stale_revision,
    )
    assert winner.status_code == 200

    loser_parent = client.patch(
        "/api/v1/children/" + str(child.pk),
        {"name": "家长输家", "revision": stale_revision},
        format="json",
    )
    assert loser_parent.status_code == 409

    loser_ops = post_json(
        ops,
        "/ops/api/children/" + str(child.pk),
        child_profile_body(name="另一个运营的旧值"),
        revision=stale_revision,
    )
    assert loser_ops.status_code == 409

    child.refresh_from_db()
    assert child.name == "运营赢家"
    assert child.revision == stale_revision + 1
