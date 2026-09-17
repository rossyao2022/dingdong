"""运营后台的可覆盖式编辑必须防止旧页面静默覆盖（独立验收 P1）。

复现场景（v0.3.2 公网真实浏览器已确认）：
管理员 A 与内容运营 B 打开同一个题库草稿；A 改标题保存成功；B 在更早打开的
旧页面只改用途说明后保存——两边都显示成功，A 的标题被 B 旧页面里的旧值覆盖。

这里从服务端锁死四件事：
1. 过期保存返回 409 且不写入任何字段；
2. 409 里带回服务端当前内容，前端才有"对比后重新编辑"的路径；
3. 缺少修订号不能被当作"没有冲突"放行；
4. 明确携带最新修订号时允许覆盖（用户看过差异后的显式选择）。
"""

import pytest
from ops_helpers import make_family, make_staff, ops_client, post_json

from dingdong_ca.core.models import (
    ActivityContentVersion,
    Child,
    QuestionnaireVersion,
)

pytestmark = pytest.mark.django_db


def question(code, label="情境一"):
    return {
        "code": code,
        "type": "single_choice",
        "title": f"{label}：你更想先做什么？",
        "required": True,
        "min_choices": 1,
        "max_choices": 1,
        "options": [
            {"code": "A", "label": "先看一看"},
            {"code": "B", "label": "直接动手"},
        ],
    }


def new_questionnaire(client, title="并发草稿"):
    response = post_json(
        client,
        "/ops/api/questionnaires",
        {
            "title": title,
            "purpose": "exploration",
            "description": "只记录本次选择，不作能力评价。",
        },
    )
    assert response.status_code == 201, response.content
    return response.json()["questionnaire"]["id"]


def new_activity(client, title="并发活动"):
    response = post_json(
        client,
        "/ops/api/activities",
        {"title": title, "island": "观察岛", "mood": "好奇", "duration_minutes": 15},
    )
    assert response.status_code == 201, response.content
    return response.json()["activity"]["id"]


def activity_content(instruction="第 1 步指引"):
    return {
        "materials": "一张白纸",
        "goal": "陪孩子观察身边的形状",
        "alternative": "没有彩纸可以用铅笔",
        "allowed_styles": ["exploratory"],
        "steps": [{"index": 0, "instruction": instruction, "guide_text": "慢慢来"}],
    }


# --------------------------------------------------------------------------- 题库


def test_stale_questionnaire_save_is_rejected_and_keeps_other_side_edit():
    """旧页面保存必须被拒，且不能覆盖先保存者的标题。"""
    admin = ops_client(make_staff("account_admin"))
    content = ops_client(make_staff("content"))
    version_id = new_questionnaire(content, title="验收隔离草稿")
    stale_revision = QuestionnaireVersion.objects.get(pk=version_id).revision

    # A（管理员）先保存标题
    first = post_json(
        admin,
        f"/ops/api/questionnaires/{version_id}",
        {
            "title": "验收编辑A已保存",
            "description": "说明",
            "questions": [question("Q1")],
            "revision": stale_revision,
        },
    )
    assert first.status_code == 200, first.content
    assert first.json()["questionnaire"]["revision"] == stale_revision + 1

    # B（内容运营）拿着更早的修订号只改用途说明
    second = post_json(
        content,
        f"/ops/api/questionnaires/{version_id}",
        {
            "title": "验收隔离草稿",
            "description": "B 只改了用途说明",
            "questions": [question("Q1")],
            "revision": stale_revision,
        },
    )
    assert second.status_code == 409, second.content
    body = second.json()
    assert body["code"] == "EDIT_CONFLICT"
    assert "已被其他人保存" in body["message"]
    # 服务端当前内容随冲突一起返回，前端才能展示差异
    assert body["current"]["title"] == "验收编辑A已保存"
    assert body["current"]["revision"] == stale_revision + 1

    row = QuestionnaireVersion.objects.get(pk=version_id)
    assert row.title == "验收编辑A已保存"
    assert row.description == "说明"
    assert row.revision == stale_revision + 1


def test_questionnaire_save_without_revision_is_422():
    content = ops_client(make_staff("content"))
    version_id = new_questionnaire(content, title="缺少修订号二")
    import json

    response = content.post(
        f"/ops/api/questionnaires/{version_id}",
        json.dumps({"title": "改个名字", "description": "说明", "questions": []}),
        content_type="application/json",
    )
    assert response.status_code == 422, response.content
    assert "修订号" in response.json()["message"]
    assert QuestionnaireVersion.objects.get(pk=version_id).title == "缺少修订号二"


def test_explicit_revision_allows_user_confirmed_overwrite():
    """用户看过差异后明确用自己的内容覆盖：带着最新修订号重发即可成功。"""
    admin = ops_client(make_staff("account_admin"))
    content = ops_client(make_staff("content"))
    version_id = new_questionnaire(content, title="覆盖流程")
    stale = QuestionnaireVersion.objects.get(pk=version_id).revision

    post_json(
        admin,
        f"/ops/api/questionnaires/{version_id}",
        {
            "title": "A 的标题",
            "description": "说明",
            "questions": [question("Q1")],
            "revision": stale,
        },
    )
    conflict = post_json(
        content,
        f"/ops/api/questionnaires/{version_id}",
        {
            "title": "B 的标题",
            "description": "说明",
            "questions": [question("Q1")],
            "revision": stale,
        },
    )
    assert conflict.status_code == 409

    overwrite = post_json(
        content,
        f"/ops/api/questionnaires/{version_id}",
        {
            "title": "B 的标题",
            "description": "说明",
            "questions": [question("Q1")],
            "revision": conflict.json()["current"]["revision"],
        },
    )
    assert overwrite.status_code == 200, overwrite.content
    assert QuestionnaireVersion.objects.get(pk=version_id).title == "B 的标题"


def test_published_questionnaire_still_rejects_in_place_edit():
    """修订号机制不能放松"已发布不可原地修改"的既有规则。"""
    content = ops_client(make_staff("content"))
    version_id = new_questionnaire(content, title="发布后不可改")
    saved = post_json(
        content,
        f"/ops/api/questionnaires/{version_id}",
        {"title": "发布后不可改", "description": "说明", "questions": [question("Q1")]},
    )
    revision = saved.json()["questionnaire"]["revision"]
    assert content.post(f"/api/v1/staff/questionnaires/{version_id}/publish").status_code == 200

    blocked = post_json(
        content,
        f"/ops/api/questionnaires/{version_id}",
        {
            "title": "偷偷改名",
            "description": "说明",
            "questions": [question("Q1")],
            "revision": revision,
        },
    )
    assert blocked.status_code == 409
    assert "复制为新版本" in blocked.json()["message"]


# --------------------------------------------------------------------------- 活动


def test_stale_activity_save_is_rejected():
    admin = ops_client(make_staff("account_admin"))
    content = ops_client(make_staff("content"))
    activity_id = new_activity(content, title="并发活动隔离")
    stale = ActivityContentVersion.objects.get(pk=activity_id).revision

    first = post_json(
        admin,
        f"/ops/api/activities/{activity_id}",
        {
            "title": "A 改过的活动",
            "island": "观察岛",
            "mood": "好奇",
            "duration_minutes": 20,
            "content": activity_content(),
            "revision": stale,
        },
    )
    assert first.status_code == 200, first.content

    second = post_json(
        content,
        f"/ops/api/activities/{activity_id}",
        {
            "title": "并发活动隔离",
            "island": "观察岛",
            "mood": "好奇",
            "duration_minutes": 30,
            "content": activity_content("B 的指引"),
            "revision": stale,
        },
    )
    assert second.status_code == 409, second.content
    assert second.json()["code"] == "EDIT_CONFLICT"
    assert second.json()["current"]["title"] == "A 改过的活动"

    row = ActivityContentVersion.objects.get(pk=activity_id)
    assert row.title == "A 改过的活动"
    assert row.duration_minutes == 20
    assert row.content["steps"][0]["instruction"] == "第 1 步指引"


# --------------------------------------------------------------------------- 儿童档案


def test_stale_child_profile_update_is_rejected():
    family, children, parent = make_family(child_name="小禾")
    child = children[0]
    admin = ops_client(make_staff("account_admin"))
    operations = ops_client(make_staff("operations"))

    first = admin.post(
        f"/ops/api/children/{child.pk}",
        {"name": "小禾甲", "gender": "female", "birth_date": "", "revision": child.revision},
    )
    assert first.status_code == 200, first.content

    second = operations.post(
        f"/ops/api/children/{child.pk}",
        {"name": "小禾乙", "gender": "male", "birth_date": "", "revision": child.revision},
    )
    assert second.status_code == 409, second.content
    assert second.json()["code"] == "EDIT_CONFLICT"
    assert second.json()["current"]["name"] == "小禾甲"

    child.refresh_from_db()
    assert child.name == "小禾甲"
    assert child.gender == "female"
    assert child.revision == 2


def test_child_profile_requires_revision():
    family, children, parent = make_family(child_name="小舟")
    client = ops_client(make_staff("operations"))
    response = client.post(
        f"/ops/api/children/{children[0].pk}",
        {"name": "改名", "gender": "unknown", "birth_date": ""},
    )
    assert response.status_code == 422
    assert "修订号" in response.json()["message"]
    assert Child.objects.get(pk=children[0].pk).name == "小舟"


# --------------------------------------------------------------------------- 家庭状态与账号角色


def test_family_status_conflict_when_page_is_stale():
    family, children, parent = make_family()
    admin = ops_client(make_staff("account_admin"))
    operations = ops_client(make_staff("operations"))

    assert (
        admin.post(
            f"/ops/api/families/{family.pk}/status",
            {"status": "frozen", "expected_status": "active"},
        ).status_code
        == 200
    )

    stale = operations.post(
        f"/ops/api/families/{family.pk}/status",
        {"status": "frozen", "expected_status": "active"},
    )
    assert stale.status_code == 409, stale.content
    assert stale.json()["code"] == "EDIT_CONFLICT"
    assert stale.json()["current"]["status"] == "frozen"


def test_account_role_change_does_not_silently_overwrite():
    from django.contrib.auth.models import Group

    admin = ops_client(make_staff("account_admin"))
    target = make_staff("operations", name="被改角色的人")
    before = "|".join(sorted(target.groups.values_list("name", flat=True)))

    # 另一个管理员在这期间把角色改成了 content
    target.groups.set(Group.objects.filter(name="content"))

    response = admin.post(
        f"/ops/accounts/{target.pk}/",
        {"action": "roles", "roles": ["operations"], "expected_roles": before},
    )
    assert response.status_code == 302
    target.refresh_from_db()
    assert set(target.groups.values_list("name", flat=True)) == {"content"}


def test_account_status_change_does_not_silently_overwrite():
    admin = ops_client(make_staff("account_admin"))
    target = make_staff("operations", name="被改状态的人")

    target.is_active = False
    target.save(update_fields=["is_active"])

    response = admin.post(
        f"/ops/accounts/{target.pk}/",
        {"action": "status", "is_active": "1", "expected_active": "1"},
    )
    assert response.status_code == 302
    target.refresh_from_db()
    assert target.is_active is False
