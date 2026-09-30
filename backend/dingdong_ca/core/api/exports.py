"""Current child's actual records only; no credentials, device tokens or image inputs."""

from django.utils import timezone
from rest_framework.response import Response

from dingdong_ca.core.models import ActivityRecord, AssessmentSession, ChildCompanionPreference

from .activities import serialize_record
from .assessments import serialize_session
from .children import owned_child
from .common import endpoint
from .companion_preferences import serialize_preference


@endpoint(["GET"])
def child_export(request, child_id):
    child = owned_child(request, child_id)
    sessions = (
        AssessmentSession.objects.select_related("questionnaire_version")
        .filter(
            child=child, questionnaire_version__purpose__in=["exploration", "interest", "talent"]
        )
        .order_by("created_at", "id")
    )
    activities = (
        ActivityRecord.objects.select_related("activity_version")
        .filter(child=child)
        .order_by("created_at", "id")
    )
    preference = ChildCompanionPreference.objects.filter(child=child).first()
    return Response(
        {
            "schema_version": "ca-child-export-v1",
            "exported_at": timezone.now().isoformat(),
            "child": {
                "id": str(child.pk),
                "name": child.name,
                "gender": child.gender,
                "birth_date": child.birth_date.isoformat() if child.birth_date else None,
            },
            "companion_preference": serialize_preference(child.pk, preference),
            "explorations": [serialize_session(row) for row in sessions],
            "activities": [serialize_record(row) for row in activities],
        }
    )
