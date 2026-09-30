"""Webpage guidance preference: independent of activity styles and DingDong settings."""

from django.db import transaction
from rest_framework.response import Response

from dingdong_ca.core.models import ChildCompanionPreference

from .children import owned_child
from .common import ApiError, audit, endpoint, validate
from .inputs import CompanionPreferenceInput


def serialize_preference(child_id, preference=None):
    return {
        "child_id": str(child_id),
        "guide_mode": preference.guide_mode if preference else "cognitive",
        "revision": preference.revision if preference else 0,
    }


@endpoint(["GET", "PATCH"])
def preference(request, child_id):
    if request.method == "GET":
        child = owned_child(request, child_id)
        row = ChildCompanionPreference.objects.filter(child=child).first()
        return Response(serialize_preference(child.pk, row))
    data = validate(CompanionPreferenceInput, request.data)
    with transaction.atomic():
        # Lock child first: concurrent initial saves both see the same revision baseline.
        child = owned_child(request, child_id, lock=True)
        row = ChildCompanionPreference.objects.select_for_update().filter(child=child).first()
        current_revision = row.revision if row else 0
        if current_revision != data["revision"]:
            raise ApiError("REVISION_CONFLICT", 409, "陪伴方式已更新，请刷新后再选择")
        if row is None:
            row = ChildCompanionPreference(child=child)
        row.guide_mode = data["guide_mode"]
        row.revision = current_revision + 1
        row.save()
        audit(
            request.user,
            "companion_preference.update",
            row,
            "网页陪伴偏好",
            {"guide_mode": row.guide_mode, "revision": row.revision},
        )
    return Response(serialize_preference(child.pk, row))
