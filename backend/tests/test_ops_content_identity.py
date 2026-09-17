"""内容身份：不同标题必须是不同内容，发布一个不能停用另一个。

第二轮独立验收复现：`generated_code` 在英文 slug 长度 ≥3 时丢弃标题摘要，
"ABC 观察" 与 "ABC 绘画" 都得到 `qn-abc`，被误当作同一内容的 v1/v2；
发布第二份会把第一份置为 retired。活动使用同一函数，同样受影响。
"""

import hashlib

import pytest
from ops_helpers import make_staff, ops_client, post_json
from test_ops_content import activity_content, question

from dingdong_ca.core.models import ActivityContentVersion, QuestionnaireVersion

pytestmark = pytest.mark.django_db

CODE_LIMIT = 48


def create_questionnaire(client, title, purpose="exploration"):
    response = post_json(client, "/ops/api/questionnaires", {"title": title, "purpose": purpose})
    assert response.status_code == 201, response.content
    return response.json()["questionnaire"]["id"]


def fill_questionnaire(client, version_id, title):
    response = post_json(
        client,
        f"/ops/api/questionnaires/{version_id}",
        {"title": title, "description": "隔离验收", "questions": [question("Q1")]},
    )
    assert response.status_code == 200, response.content


def publish_questionnaire(client, version_id):
    response = client.post(f"/api/v1/staff/questionnaires/{version_id}/publish")
    assert response.status_code == 200, response.content


def create_activity(client, title):
    response = post_json(
        client,
        "/ops/api/activities",
        {"title": title, "island": "观察岛", "mood": "好奇", "duration_minutes": 15},
    )
    assert response.status_code == 201, response.content
    return response.json()["activity"]["id"]


def fill_activity(client, version_id, title):
    response = post_json(
        client,
        f"/ops/api/activities/{version_id}",
        {
            "title": title,
            "island": "观察岛",
            "mood": "好奇",
            "duration_minutes": 15,
            "content": activity_content(steps=1),
        },
    )
    assert response.status_code == 200, response.content


def code_of(version_id, model=QuestionnaireVersion):
    return model.objects.get(pk=version_id).code


# --------------------------------------------------------------------------- 题库身份


def test_distinct_titles_do_not_retire_each_other():
    """独立验收的原始复现：两份不同题库都要保持 published。"""
    client = ops_client(make_staff("content"))
    version_ids = []
    for title in ["ABC 观察", "ABC 绘画"]:
        version_id = create_questionnaire(client, title)
        version_ids.append(version_id)
        fill_questionnaire(client, version_id, title)
        publish_questionnaire(client, version_id)

    first, second = (QuestionnaireVersion.objects.get(pk=pk) for pk in version_ids)
    assert first.code != second.code, "不同标题被归入同一个内部标识"
    assert first.status == "published", f"无关的第一份被置为 {first.status}"
    assert second.status == "published"


@pytest.mark.parametrize(
    ("left", "right"),
    [
        ("ABC 观察", "ABC 绘画"),
        ("观察记录", "绘画记录"),
        ("ABC-观察", "ABC 观察"),
        ("abc 观察", "ABC 观察"),
        ("一起观察形状", "一起观察颜色"),
        (
            "这是一份用于验证超长共同前缀的观察记录（甲）",
            "这是一份用于验证超长共同前缀的观察记录（乙）",
        ),
    ],
)
def test_similar_titles_get_distinct_codes(left, right):
    client = ops_client(make_staff("content"))
    first_id = create_questionnaire(client, left)
    second_id = create_questionnaire(client, right)
    assert code_of(first_id) != code_of(second_id)


def test_generated_code_respects_length_limit():
    client = ops_client(make_staff("content"))
    title = "observation-record-" * 8 + "alpha"
    assert len(title) <= 160
    version_id = create_questionnaire(client, title)
    code = code_of(version_id)
    digest = hashlib.sha1(title.strip().encode("utf-8")).hexdigest()[:12]
    assert len(code) <= CODE_LIMIT
    # 摘要必须活到截断之后：长 slug 被裁掉可以，摘要被裁掉才是缺陷
    assert code.endswith(digest)


def test_long_common_prefix_does_not_collapse_codes():
    """两个只差结尾的长标题，不能因为 slug 被截断而共用标识。"""
    client = ops_client(make_staff("content"))
    prefix = "observation-record-" * 8
    assert len(prefix + "alpha") <= 160
    first_id = create_questionnaire(client, prefix + "alpha")
    second_id = create_questionnaire(client, prefix + "beta")
    first_code = code_of(first_id)
    second_code = code_of(second_id)
    assert first_code != second_code
    assert len(first_code) <= CODE_LIMIT and len(second_code) <= CODE_LIMIT


def test_same_title_twice_creates_independent_contents():
    """同名不等于同一内容：每次"新建"都是独立内容，各自可以发布。"""
    client = ops_client(make_staff("content"))
    version_ids = []
    for _ in range(2):
        version_id = create_questionnaire(client, "同名观察")
        version_ids.append(version_id)
        fill_questionnaire(client, version_id, "同名观察")
        publish_questionnaire(client, version_id)

    rows = [QuestionnaireVersion.objects.get(pk=pk) for pk in version_ids]
    assert rows[0].code != rows[1].code
    assert rows[0].version == "v1" and rows[1].version == "v1"
    assert [row.status for row in rows] == ["published", "published"]


def test_copy_creates_new_version_and_publish_retires_previous():
    """显式的"复制为新版本"才是同一内容的新版本，发布后按规则替代旧版本。"""
    client = ops_client(make_staff("content"))
    first_id = create_questionnaire(client, "版本演进")
    fill_questionnaire(client, first_id, "版本演进")
    publish_questionnaire(client, first_id)

    copied = post_json(client, f"/ops/api/questionnaires/{first_id}/copy", {})
    assert copied.status_code == 201, copied.content
    second_id = copied.json()["id"]
    assert copied.json()["version"] == "v2"

    first = QuestionnaireVersion.objects.get(pk=first_id)
    second = QuestionnaireVersion.objects.get(pk=second_id)
    assert first.code == second.code

    fill_questionnaire(client, second_id, "版本演进")
    publish_questionnaire(client, second_id)

    first.refresh_from_db()
    assert first.status == "retired"
    assert QuestionnaireVersion.objects.get(pk=second_id).status == "published"


def test_create_retry_with_same_request_key_is_idempotent():
    """同一次创建的重复提交（双击/重试）不能产生第二份内容。"""
    import uuid as uuid_module

    client = ops_client(make_staff("content"))
    request_key = str(uuid_module.uuid4())
    payload = {"title": "幂等观察", "purpose": "exploration", "request_key": request_key}

    first = post_json(client, "/ops/api/questionnaires", payload)
    second = post_json(client, "/ops/api/questionnaires", payload)
    assert first.status_code == 201
    assert second.status_code in (200, 201)
    assert first.json()["questionnaire"]["id"] == second.json()["questionnaire"]["id"], (
        "重复提交产生了第二份内容"
    )
    assert QuestionnaireVersion.objects.filter(title="幂等观察").count() == 1


def test_publish_retires_only_same_content():
    """发布只停用同一内部标识的旧发布版本，不影响其他内容。"""
    client = ops_client(make_staff("content"))
    ids = []
    for title in ["互不相关甲", "互不相关乙", "互不相关丙"]:
        version_id = create_questionnaire(client, title)
        ids.append(version_id)
        fill_questionnaire(client, version_id, title)
        publish_questionnaire(client, version_id)

    statuses = [QuestionnaireVersion.objects.get(pk=pk).status for pk in ids]
    assert statuses == ["published", "published", "published"]
    assert len({code_of(pk) for pk in ids}) == 3


# --------------------------------------------------------------------------- 活动身份


def test_activity_distinct_titles_do_not_retire_each_other():
    client = ops_client(make_staff("content"))
    ids = []
    for title in ["ABC 观察", "ABC 绘画"]:
        activity_id = create_activity(client, title)
        ids.append(activity_id)
        fill_activity(client, activity_id, title)
        response = client.post(f"/api/v1/staff/activities/{activity_id}/publish")
        assert response.status_code == 200, response.content

    first = ActivityContentVersion.objects.get(pk=ids[0])
    assert first.code != ActivityContentVersion.objects.get(pk=ids[1]).code
    assert first.status == "published", f"无关的第一份活动被置为 {first.status}"


def test_activity_same_title_twice_creates_independent_contents():
    client = ops_client(make_staff("content"))
    ids = []
    for _ in range(2):
        activity_id = create_activity(client, "同名活动")
        ids.append(activity_id)
        fill_activity(client, activity_id, "同名活动")
        assert client.post(f"/api/v1/staff/activities/{activity_id}/publish").status_code == 200

    rows = [ActivityContentVersion.objects.get(pk=pk) for pk in ids]
    assert rows[0].code != rows[1].code
    assert [row.status for row in rows] == ["published", "published"]


# --------------------------------------------------------------------------- 真并发


@pytest.mark.django_db(transaction=True)
def test_concurrent_creates_get_distinct_codes():
    """真并发：三个线程同时新建同名题库，不能撞同一个标识，也不能丢内容。"""
    import threading

    from django.db import connections

    user = make_staff("content")
    workers = 3
    barrier = threading.Barrier(workers)
    statuses = []
    errors = []
    lock = threading.Lock()

    def worker():
        try:
            client = ops_client(user)
            barrier.wait(timeout=20)
            response = post_json(
                client,
                "/ops/api/questionnaires",
                {"title": "并发同名题库", "purpose": "exploration"},
            )
            with lock:
                statuses.append(response.status_code)
        except Exception as exc:  # noqa: BLE001 - 线程内异常要带回主线程断言
            with lock:
                errors.append(repr(exc))
        finally:
            connections.close_all()

    threads = [threading.Thread(target=worker) for _ in range(workers)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=40)

    assert not errors, errors
    assert statuses == [201] * workers, statuses
    rows = QuestionnaireVersion.objects.filter(title="并发同名题库")
    assert rows.count() == workers, "并发创建丢内容或产生了重复条目"
    codes = list(rows.values_list("code", flat=True))
    assert len(set(codes)) == workers, f"并发创建撞了标识：{codes}"


@pytest.mark.django_db(transaction=True)
def test_concurrent_copies_never_reuse_a_version():
    """真并发：同一版本同时"复制为新版本"，版本号必须互不相同。"""
    import threading

    from django.db import connections

    user = make_staff("content")
    client = ops_client(user)
    source_id = create_questionnaire(client, "并发复制来源")
    fill_questionnaire(client, source_id, "并发复制来源")
    publish_questionnaire(client, source_id)
    source_code = code_of(source_id)

    workers = 3
    barrier = threading.Barrier(workers)
    created = []
    errors = []
    lock = threading.Lock()

    def worker():
        try:
            worker_client = ops_client(user)
            barrier.wait(timeout=20)
            response = post_json(worker_client, f"/ops/api/questionnaires/{source_id}/copy", {})
            with lock:
                created.append((response.status_code, response.json().get("id")))
        except Exception as exc:  # noqa: BLE001
            with lock:
                errors.append(repr(exc))
        finally:
            connections.close_all()

    threads = [threading.Thread(target=worker) for _ in range(workers)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=40)

    assert not errors, errors
    assert [code for code, _ in created] == [201] * workers, created
    versions = list(
        QuestionnaireVersion.objects.filter(code=source_code).values_list("version", flat=True)
    )
    assert len(set(versions)) == len(versions), f"并发复制撞了版本号：{versions}"
    assert len(versions) == workers + 1, versions
