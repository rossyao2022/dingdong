"""家长端的四个展示面接口：人设、周期成长报告、互动健康度、复测建议与回写。

对应 `.trellis/tasks/T-021/design.md`。一律以 `child_id` 为键 + `owned_child()`
家庭隔离；`ca_account_id` 不出现在请求或响应里。取数与错误处置全在
`core/services/ca_display.py`，这里只做鉴权、入参校验与序列化。
"""

from rest_framework import serializers
from rest_framework.response import Response

from dingdong_ca.core.services import ca_display as service

from .children import owned_child
from .common import endpoint, validate
from .inputs import StrictSerializer, StrictString


class GrowthPeriodInput(StrictSerializer):
    # 固定 15/30 天；任意区间由既有「成长观察」承担，不是同一份数据。
    period = serializers.ChoiceField(choices=["15d", "30d"])


class ReassessmentResponseInput(StrictSerializer):
    request_id = serializers.UUIDField()
    accepted = serializers.BooleanField()


class ReassessmentCompleteInput(StrictSerializer):
    request_id = serializers.UUIDField()
    assessment_id = StrictString(max_length=64)


@endpoint(["GET"])
def companion_persona(request, child_id):
    return Response(service.persona_view(owned_child(request, child_id)))


@endpoint(["GET"])
def growth_cycle(request, child_id):
    child = owned_child(request, child_id)
    data = validate(GrowthPeriodInput, request.query_params)
    return Response(service.growth_view(child, service.PERIODS[data["period"]]))


@endpoint(["GET"])
def companion_health(request, child_id):
    return Response(service.health_view(owned_child(request, child_id)))


@endpoint(["GET"])
def reassessment(request, child_id):
    return Response(service.reassessment_view(owned_child(request, child_id)))


@endpoint(["POST"])
def reassessment_response(request, child_id, event_id):
    child = owned_child(request, child_id)
    data = validate(ReassessmentResponseInput, request.data)
    return Response(
        service.respond(child, event_id, data["accepted"], data["request_id"], request.user)
    )


@endpoint(["POST"])
def reassessment_complete(request, child_id, event_id):
    child = owned_child(request, child_id)
    data = validate(ReassessmentCompleteInput, request.data)
    return Response(
        service.complete(child, event_id, data["assessment_id"], data["request_id"], request.user)
    )
