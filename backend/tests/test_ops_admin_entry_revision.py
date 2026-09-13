"""技术后台（Django admin）也能改内容草稿，必须与运营后台共用同一套修订号保护。

否则：管理员在 /admin/ 改了一份草稿，运营旧页面拿着旧 revision 保存仍会成功，
把管理员的修改静默覆盖——和独立验收发现的家长端漏增修订号是同一类缺陷。
"""

import pytest
from django.contrib.admin.sites import site as admin_site
from django.test import RequestFactory
from ops_helpers import make_staff, ops_client, post_json
from test_ops_content import question

from dingdong_ca.core.models import QuestionnaireVersion

pytestmark = pytest.mark.django_db


def draft_questionnaire(client, title="管理员可见草稿"):
    response = post_json(
        client, "/ops/api/questionnaires", {"title": title, "purpose": "exploration"}
    )
    assert response.status_code == 201, response.content
    version_id = response.json()["questionnaire"]["id"]
    saved = post_json(
        client,
        f"/ops/api/questionnaires/{version_id}",
        {"title": title, "description": "草稿", "questions": [question("Q1")]},
    )
    assert saved.status_code == 200, saved.content
    return version_id


def admin_save(model, pk):
    """模拟技术后台在一次 change 表单提交里保存草稿。"""
    model_admin = admin_site._registry[model]
    row = model.objects.get(pk=pk)
    request = RequestFactory().post("/admin/")
    request.user = make_staff("account_admin", superuser=True)
    model_admin.save_model(request, row, form=None, change=True)
    return row


def test_django_admin_draft_save_advances_revision():
    client = ops_client(make_staff("content"))
    version_id = draft_questionnaire(client)
    before = QuestionnaireVersion.objects.get(pk=version_id).revision

    admin_save(QuestionnaireVersion, version_id)

    after = QuestionnaireVersion.objects.get(pk=version_id).revision
    assert after == before + 1, "技术后台保存草稿没有推进修订号"


def test_ops_stale_save_after_admin_edit_conflicts():
    client = ops_client(make_staff("content"))
    version_id = draft_questionnaire(client)
    stale_revision = QuestionnaireVersion.objects.get(pk=version_id).revision

    admin_save(QuestionnaireVersion, version_id)

    stale = post_json(
        client,
        f"/ops/api/questionnaires/{version_id}",
        {"title": "运营旧页面标题", "description": "草稿", "questions": [question("Q1")]},
        revision=stale_revision,
    )
    assert stale.status_code == 409, stale.content
    assert stale.json()["code"] == "EDIT_CONFLICT"
    assert QuestionnaireVersion.objects.get(pk=version_id).title != "运营旧页面标题"
