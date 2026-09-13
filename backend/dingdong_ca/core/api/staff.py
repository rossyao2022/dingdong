from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.db import connection, transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers
from rest_framework.response import Response

from dingdong_ca.core import models as m
from dingdong_ca.core.services.deletion import delete_child
from dingdong_ca.core.services.sync import (
    association_authorized,
    enqueue_stage,
    lock_association,
    schedule_sync,
)
from dingdong_ca.core.tasks import bind_dependency, job_authorized, lock_job, publish_job

from .common import ApiError, audit, endpoint, validate
from .data_requests import serialize_request
from .inputs import StrictSerializer
from .robots import serialize_association

# 运营后台审计列表使用的中文名称；保持与后台展示一致。
KIND_LABEL = {"report": "报告生成", "stage_profile": "阶段画像", "sync": "数据同步"}
# 发布内容版本时用于审计说明，运营看到的是中文而不是内部集合名
CONTENT_KIND_LABEL = {"questionnaires": "题库", "activities": "活动", "rules": "规则"}


def serialize_job(job):
    return {
        "id": str(job.pk),
        "kind": job.kind,
        "status": job.status,
        "attempt_count": job.attempt_count,
        "error_code": job.error_code,
        "next_attempt_at": job.next_attempt_at.isoformat() if job.next_attempt_at else None,
    }


def validate_content(row):
    try:
        if row.data_origin != "synthetic":
            raise ValueError
        if isinstance(row, m.QuestionnaireVersion):
            bounds = {"exploration": (1, 10), "assessment": (20, 30)}.get(row.purpose)
            if (
                not bounds
                or not isinstance(row.questions, list)
                or not bounds[0] <= len(row.questions) <= bounds[1]
                or not row.title.strip()
                or not row.description.strip()
            ):
                raise ValueError
            seen = set()
            for q in row.questions:
                if (
                    set(q)
                    != {
                        "code",
                        "type",
                        "title",
                        "required",
                        "min_choices",
                        "max_choices",
                        "options",
                    }
                    or q["code"] in seen
                    or not q["code"]
                    or not isinstance(q["title"], str)
                    or not q["title"].strip()
                    or type(q["required"]) is not bool
                ):
                    raise ValueError
                seen.add(q["code"])
                if (
                    q["type"] not in ["single_choice", "multiple_choice"]
                    or type(q["min_choices"]) is not int
                    or type(q["max_choices"]) is not int
                    or not 1 <= q["min_choices"] <= q["max_choices"] <= len(q["options"])
                    or len(q["options"]) < 2
                ):
                    raise ValueError
                if q["type"] == "single_choice" and (
                    q["min_choices"] != 1 or q["max_choices"] != 1
                ):
                    raise ValueError
                codes = [o["code"] for o in q["options"]]
                if len(codes) != len(set(codes)) or any(
                    set(o) != {"code", "label"}
                    or not isinstance(o["label"], str)
                    or not o["label"].strip()
                    or not isinstance(o["code"], str)
                    or not o["code"]
                    for o in q["options"]
                ):
                    raise ValueError
        elif isinstance(row, m.RuleVersion):
            c = row.config
            if (
                set(c) != {"implementation", "multiplier"}
                or c["implementation"] != "test-count-v1"
                or type(c["multiplier"]) is not int
                or not 1 <= c["multiplier"] <= 10
            ):
                raise ValueError
        elif isinstance(row, m.ReportTemplateVersion):
            if set(row.template) != {"title", "intro"} or any(
                not isinstance(v, str) or not 1 <= len(v) <= 2000 for v in row.template.values()
            ):
                raise ValueError
        else:
            c = row.content
            if (
                set(c) != {"materials", "goal", "alternative", "allowed_styles", "steps"}
                or not c["steps"]
                or row.duration_minutes < 1
            ):
                raise ValueError
            if any(not isinstance(c[k], str) for k in ["materials", "goal", "alternative"]):
                raise ValueError
            if not c["allowed_styles"] or not set(c["allowed_styles"]) <= {
                "cognitive",
                "emotional",
                "creative",
                "exploratory",
            }:
                raise ValueError
            for i, step in enumerate(c["steps"]):
                if (
                    set(step) != {"index", "instruction", "guide_text"}
                    or step["index"] != i
                    or not isinstance(step["instruction"], str)
                    or not isinstance(step["guide_text"], str)
                ):
                    raise ValueError
    except (KeyError, TypeError, ValueError):
        raise ApiError("CONTENT_INVALID", 422, "发布内容不符合当前测试协议") from None


@endpoint(["POST"], staff_roles=["content"], csrf=True)
def publish(request, version_id, kind):
    Model = {
        "questionnaires": m.QuestionnaireVersion,
        "activities": m.ActivityContentVersion,
        "report-templates": m.ReportTemplateVersion,
        "rules": m.RuleVersion,
    }[kind]
    with transaction.atomic():
        initial = get_object_or_404(Model, pk=version_id)
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT pg_advisory_xact_lock(hashtextextended(%s,0))", [kind + ":" + initial.code]
            )
        row = Model.objects.select_for_update().get(pk=version_id)
        if row.status == "retired":
            raise ApiError("STATE_CONFLICT", 409, "停用版本请复制为新版本")
        validate_content(row)
        if row.status != "published":
            Model.objects.filter(code=row.code, status="published").exclude(pk=row.pk).update(
                status="retired"
            )
            row.status = "published"
            row.published_at = timezone.now()
            row.published_by = request.user
            row.save()
            audit(
                request.user,
                "content.publish",
                row,
                "",
                {"kind": CONTENT_KIND_LABEL.get(kind, kind), "code": row.code},
            )
            if kind == "rules":
                # Queue the latest source revision only; do not rewrite older profiles.
                for obs in m.ObservationBatch.objects.filter(supersedes__isnull=True):
                    latest = (
                        m.ObservationBatch.objects.filter(
                            association=obs.association, logical_key=obs.logical_key
                        )
                        .order_by("-revision_no")
                        .first()
                    )
                    waiting = m.BackgroundJob.objects.filter(
                        kind="stage_profile", status="waiting", jobobservation__observation=latest
                    ).exists()
                    if not waiting:
                        enqueue_stage(latest, row)
        return Response(
            {
                "id": str(row.pk),
                "code": row.code,
                "version": row.version,
                "status": row.status,
                "published_at": row.published_at.isoformat(),
            }
        )


@endpoint(["GET"], staff_roles=["technical"])
def job_detail(request, job_id):
    return Response(serialize_job(get_object_or_404(m.BackgroundJob, pk=job_id)))


@endpoint(["POST"], staff_roles=["technical"], csrf=True)
def retry(request, job_id):
    get_object_or_404(m.BackgroundJob, pk=job_id)
    with transaction.atomic():
        job, context = lock_job(job_id)
        if job.status != "failed":
            raise ApiError("STATE_CONFLICT", 409, "仅失败任务可人工重试")
        if not job_authorized(job, context):
            raise ApiError("CONSENT_REQUIRED", 403)
        if not bind_dependency(job):
            raise ApiError("DEPENDENCY_NOT_READY", 409)
        from dingdong_ca.core.services.sync import build_stage, inspect_observation
        from dingdong_ca.testsupport.adapter import FixtureFailure
        from dingdong_ca.testsupport.robot import fetch_observation

        try:
            if job.kind == "sync":
                payload = fetch_observation(context, context.synccheckpoint.cursor)
                if payload:
                    inspect_observation(context, payload)
            elif job.kind == "stage_profile":
                build_stage(job)
            elif job.kind == "report":
                validate_content(job.template_version)
        except FixtureFailure as exc:
            raise ApiError("DEPENDENCY_NOT_READY", 409, exc.code) from None
        # New bounded retry allowance retains every previous attempt number.
        job.max_attempts = job.attempt_count + 5
        job.status = "pending"
        job.error_code = None
        job.finished_at = None
        job.next_attempt_at = timezone.now()
        job.save()
        audit(request.user, "job.retry", job)
        transaction.on_commit(lambda: publish_job(str(job.pk)))
        return Response(serialize_job(job), status=202)


@endpoint(["POST"], staff_roles=["technical"], csrf=True)
def pause_resume(request, association_id, action):
    get_object_or_404(m.ExternalAssociation, pk=association_id)
    with transaction.atomic():
        a = lock_association(association_id)
        if action == "resume" and not association_authorized(a):
            raise ApiError("CONSENT_REQUIRED", 403)
        check = m.SyncCheckpoint.objects.select_for_update().get(association=a)
        check.status = "enabled" if action == "resume" else "paused"
        check.next_due_at = timezone.now() if action == "resume" else None
        check.save()
        if action == "resume":
            m.BackgroundJob.objects.filter(
                association=a, status="cancelled", error_code="CONSENT_REVOKED_OR_PAUSED"
            ).update(status="pending", error_code=None, next_attempt_at=timezone.now())
            schedule_sync(a.pk)
        audit(request.user, "association." + action, a)
        return Response(serialize_association(a))


class ResolveInput(StrictSerializer):
    action = serializers.ChoiceField(choices=["resolve", "cancel", "execute_deletion"])
    resolution_code = serializers.ChoiceField(choices=["resolved", "cancelled", "deleted"])
    note = serializers.CharField(required=False, allow_blank=True, max_length=500, default="")

    def validate(self, data):
        if (
            data["resolution_code"]
            != {"resolve": "resolved", "cancel": "cancelled", "execute_deletion": "deleted"}[
                data["action"]
            ]
        ):
            raise serializers.ValidationError("动作与结果码不匹配")
        return data


@endpoint(["POST"], staff_roles=["operations", "technical"], csrf=True)
def resolve(request, request_id):
    data = validate(ResolveInput, request.data)
    with transaction.atomic():
        initial = get_object_or_404(m.DataRequest, pk=request_id)
        child = (
            m.Child.objects.select_for_update().filter(pk=initial.child_id).first()
            if initial.child_id
            else None
        )
        row = m.DataRequest.objects.select_for_update().get(pk=request_id)
        if data["action"] == "execute_deletion" and not (
            request.user.is_superuser or request.user.groups.filter(name="technical").exists()
        ):
            raise ApiError("PERMISSION_DENIED", 403)
        if row.status in ["completed", "cancelled"]:
            if row.resolution_code != data["resolution_code"]:
                raise ApiError("STATE_CONFLICT", 409)
            return Response(serialize_request(row))
        if (data["action"] == "execute_deletion") != (
            row.kind == "deletion" and data["action"] != "cancel"
        ):
            raise ApiError("STATE_CONFLICT", 409)
        if data["action"] == "execute_deletion":
            if not child:
                raise ApiError("STATE_CONFLICT", 409)
            delete_child(child)
            row.child = None
        row.status = "cancelled" if data["action"] == "cancel" else "completed"
        row.resolution_code = data["resolution_code"]
        row.resolution_note = data.get("note", "")
        row.completed_at = timezone.now()
        row.save()
        audit(
            request.user,
            "data_request." + data["action"],
            row,
            f"事项 {row.pk}",
            {"note": row.resolution_note, "resolution_code": row.resolution_code},
        )
        return Response(serialize_request(row))


class RolesInput(StrictSerializer):
    role_codes = serializers.ListField(
        child=serializers.ChoiceField(choices=["operations", "content", "technical"]), max_length=3
    )


class StatusInput(StrictSerializer):
    is_active = serializers.BooleanField()


@endpoint(["PATCH"], staff_roles=["account_admin"], csrf=True)
def staff_user(request, staff_id, action):
    data = validate(RolesInput if action == "roles" else StatusInput, request.data)
    with transaction.atomic():
        user = get_object_or_404(
            get_user_model().objects.select_for_update(),
            pk=staff_id,
            account_kind="staff",
            is_staff=True,
        )
        if (
            user.pk == request.user.pk
            or user.is_superuser
            or user.groups.filter(name="account_admin").exists()
        ):
            raise ApiError("PERMISSION_DENIED", 403, "不能通过业务入口修改自己或账号管理员")
        if action == "roles":
            user.groups.set(Group.objects.filter(name__in=data["role_codes"]))
        else:
            user.is_active = data["is_active"]
            user.save(update_fields=["is_active"])
        audit(
            request.user,
            "staff." + action,
            user,
            user.name or user.username,
            {"roles": data["role_codes"]} if action == "roles" else {"is_active": user.is_active},
        )
        return Response(
            {
                "id": str(user.pk),
                "is_active": user.is_active,
                "role_codes": list(user.groups.values_list("name", flat=True)),
            }
        )
