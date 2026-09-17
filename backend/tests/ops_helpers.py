"""运营后台测试的公共构造器。"""

import json
import uuid
from io import StringIO

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.management import call_command
from django.utils import timezone
from rest_framework.test import APIClient

PASSWORD = "ops-pass-123456"


def roles_ready():
    call_command("seed_base", stdout=StringIO())


def make_staff(*roles, name="测试运营", superuser=False):
    roles_ready()
    user = get_user_model().objects.create_user(
        username="ops-" + uuid.uuid4().hex[:10],
        password=PASSWORD,
        name=name,
        account_kind="staff",
        is_staff=True,
    )
    if superuser:
        user.is_superuser = True
        user.save(update_fields=["is_superuser"])
    user.groups.set(Group.objects.filter(name__in=roles))
    return user


def make_parent(phone="+8613800000001", name="家长甲"):
    user = get_user_model().objects.create(
        username="parent-" + uuid.uuid4().hex[:10],
        account_kind="parent",
        phone=phone,
        name=name,
        is_staff=False,
    )
    user.set_unusable_password()
    user.save(update_fields=["password"])
    return user


def make_family(child_name="小芽", phone="+8613800000001", parent_name="家长甲", children=1):
    from dingdong_ca.core.models import Child, Family, FamilyMembership

    parent = make_parent(phone=phone, name=parent_name)
    family = Family.objects.create()
    FamilyMembership.objects.create(family=family, user=parent, role="owner")
    kids = [
        Child.objects.create(
            family=family,
            created_by=parent,
            create_request_key=uuid.uuid4(),
            create_payload={},
            name=child_name if index == 0 else f"{child_name}{index + 1}",
        )
        for index in range(children)
    ]
    return family, kids, parent


def make_service_request(child, requester, kind="support", reason="support_needed"):
    from dingdong_ca.core.models import DataRequest

    return DataRequest.objects.create(
        child=child,
        requester=requester,
        create_request_key=uuid.uuid4(),
        kind=kind,
        reason_code=reason,
    )


def make_failed_job(child=None, kind="report"):
    from dingdong_ca.core.models import BackgroundJob

    return BackgroundJob.objects.create(
        kind=kind,
        business_key=f"job-{uuid.uuid4().hex}",
        status="failed",
        error_code="RENDER_FAILED",
        attempt_count=3,
        max_attempts=5,
        finished_at=timezone.now(),
    )


def make_session(child, parent, questionnaire_version, purpose="assessment_processing"):
    """构造一条真实的测评会话（含政策版本与同意授权），用于验证历史数据不被内容改动影响。"""
    from dingdong_ca.core.assessment_models import (
        AssessmentSession,
        ConsentGrant,
        PolicyVersion,
    )

    policy, _ = PolicyVersion.objects.get_or_create(
        purpose=purpose,
        version="v1",
        defaults={
            "code": f"policy-{purpose}",
            "data_origin": "synthetic",
            "body": "测试用授权条款。",
            "status": "published",
            "published_at": timezone.now(),
        },
    )
    consent = ConsentGrant.objects.create(
        child=child,
        granted_by=parent,
        policy_version=policy,
        purpose=purpose,
        create_request_key=uuid.uuid4(),
    )
    return AssessmentSession.objects.create(
        child=child,
        started_by=parent,
        consent_grant=consent,
        questionnaire_version_id=getattr(questionnaire_version, "pk", questionnaire_version),
        create_request_key=uuid.uuid4(),
        expires_at=timezone.now() + timezone.timedelta(days=1),
    )


def ops_client(user):
    """带 CSRF 的会话客户端：既用于页面，也用于 /api/v1/staff/* 与 /ops/api/*。"""
    client = APIClient(enforce_csrf_checks=True)
    client.force_login(user)
    response = client.get("/api/v1/auth/csrf")
    client.credentials(HTTP_X_CSRFTOKEN=response.json()["csrf_token"])
    return client


_CONTENT_SAVE_MODELS = ("questionnaires", "activities", "children")


def post_json(client, url, payload, revision=None):
    """POST JSON。内容保存接口未显式给出修订号时，自动使用库内当前修订号。"""
    body = dict(payload)
    if revision is None:
        body.setdefault("revision", _lookup_revision(url))
    else:
        body["revision"] = revision
    if body.get("revision") is None:
        body.pop("revision", None)
    return client.post(url, json.dumps(body), content_type="application/json")


def _lookup_revision(url):
    import re

    from dingdong_ca.core.models import ActivityContentVersion, Child, QuestionnaireVersion

    match = re.fullmatch(r"/ops/api/(questionnaires|activities|children)/([0-9a-fA-F-]{36})", url)
    if not match:
        return None
    model = {
        "questionnaires": QuestionnaireVersion,
        "activities": ActivityContentVersion,
        "children": Child,
    }[match.group(1)]
    row = model.objects.filter(pk=match.group(2)).first()
    return None if row is None else row.revision
