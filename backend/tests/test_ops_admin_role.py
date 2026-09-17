"""运营后台的 account_admin 角色必须真的"全部权限"。

回归背景（v0.3.0 真实缺陷，公网浏览器验收时发现）：
运营后台把 `account_admin` 定义为拥有全部权限点（见 dingdong_ca/ops/permissions.py），
页面因此对管理员显示"发布""重试该任务"等按钮；但这些动作复用的是
`/api/v1/staff/*`，那里按具体角色放行（发布要 `content`、重试要 `technical`），
于是管理员点下去拿到 403"角色不允许此操作"——按钮变成摆设。

这里从服务端锁死两件事：
1. account_admin 能通过复用接口的角色判定；
2. 没有任何相关角色的工作人员仍然被拒（不能顺手把门开大）。
"""

import pytest
from ops_helpers import make_staff, ops_client, post_json
from test_ops_content import create_questionnaire, question

from dingdong_ca.core.models import QuestionnaireVersion

pytestmark = pytest.mark.django_db


def _publishable(client):
    version_id = create_questionnaire(client)
    saved = post_json(
        client,
        f"/ops/api/questionnaires/{version_id}",
        {
            "title": "管理员发布验证",
            "description": "只记录本次选择，不作能力评价。",
            "questions": [question(f"Q{i}") for i in range(2)],
        },
    )
    assert saved.status_code == 200, saved.content
    return version_id


def test_account_admin_can_publish_via_reused_staff_endpoint():
    """只有 account_admin 角色的管理员，发布必须真的成功。"""
    client = ops_client(make_staff("account_admin", name="管理员"))
    version_id = _publishable(client)

    published = client.post(f"/api/v1/staff/questionnaires/{version_id}/publish")
    assert published.status_code == 200, published.content
    assert QuestionnaireVersion.objects.get(pk=version_id).status == "published"


def test_account_admin_is_not_blocked_by_role_on_retry():
    """重试接口至少不能因为"角色不允许此操作"把管理员挡在门外。"""
    client = ops_client(make_staff("account_admin", name="管理员"))
    response = client.post("/api/v1/staff/jobs/00000000-0000-0000-0000-000000000000/retry")
    assert response.status_code != 403, response.content


def test_staff_without_matching_role_is_still_denied():
    """没有命中角色的工作人员仍然被拒，account_admin 的放行不能扩大成"人人可发"。"""
    version_id = _publishable(ops_client(make_staff("content", name="内容运营")))

    outsider = ops_client(make_staff("operations", name="普通运营"))
    denied = outsider.post(f"/api/v1/staff/questionnaires/{version_id}/publish")
    assert denied.status_code == 403
    assert "角色不允许此操作" in denied.content.decode()
    assert QuestionnaireVersion.objects.get(pk=version_id).status == "draft"
