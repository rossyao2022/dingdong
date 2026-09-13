"""第二轮独立验收的两个复现脚本，原样纳入回归。

这两个用例在修复前必须是红的（见 deploy/evidence/review-v0.3.3/），
修复后作为稳定回归保留，防止同类缺陷再次出现。
调用方式与验收方一致：`pytest tests/test_independent_recheck.py`。
"""

import pytest
from conftest import create_child, sign_in
from ops_helpers import make_staff, ops_client, post_json
from test_ops_content import question

from dingdong_ca.core.models import Child, QuestionnaireVersion

pytestmark = pytest.mark.django_db


# ---------------------------------------------------------------------------
# 原验收脚本：cross-entry-repro.py
# ---------------------------------------------------------------------------
def test_parent_edit_invalidates_ops_stale_revision(client):
    sign_in(client)
    data = create_child(client)
    child = Child.objects.get(pk=data["id"])
    old_revision = child.revision
    ops = ops_client(make_staff("operations"))
    response = client.patch(
        "/api/v1/children/" + str(child.pk), {"name": "家长刚刚更正"}, format="json"
    )
    assert response.status_code == 200
    response = post_json(
        ops,
        "/ops/api/children/" + str(child.pk),
        {"name": "运营旧页面称呼", "gender": "unknown", "birth_date": ""},
        revision=old_revision,
    )
    child.refresh_from_db()
    assert response.status_code == 409, (
        f"stale write returned {response.status_code}; persisted name={child.name}"
    )
    assert child.name == "家长刚刚更正"


# ---------------------------------------------------------------------------
# 原验收脚本：title-collision-repro.py
# ---------------------------------------------------------------------------
def test_distinct_titles_do_not_retire_each_other():
    client = ops_client(make_staff("content"))
    ids = []
    for title in ["ABC 观察", "ABC 绘画"]:
        r = post_json(client, "/ops/api/questionnaires", {"title": title, "purpose": "exploration"})
        assert r.status_code == 201
        key = r.json()["questionnaire"]["id"]
        ids.append(key)
        assert (
            post_json(
                client,
                f"/ops/api/questionnaires/{key}",
                {"title": title, "description": "隔离验收", "questions": [question("Q1")]},
            ).status_code
            == 200
        )
        assert client.post(f"/api/v1/staff/questionnaires/{key}/publish").status_code == 200
    first = QuestionnaireVersion.objects.get(pk=ids[0])
    assert first.status == "published", f"Unrelated first title was {first.status}"
    assert first.code != QuestionnaireVersion.objects.get(pk=ids[1]).code
