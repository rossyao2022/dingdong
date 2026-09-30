"""Phone comes from the authenticated parent; no new profile or marketing messages."""

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from dingdong_ca.core.models import ExhibitionVisit, ExhibitionVisitor


def serialize_visitor(row):
    return {
        "id": str(row.pk),
        "first_entered_at": row.first_entered_at.isoformat() if row.first_entered_at else None,
        "last_entered_at": row.last_entered_at.isoformat() if row.last_entered_at else None,
        "last_report_viewed_at": row.last_report_viewed_at.isoformat()
        if row.last_report_viewed_at
        else None,
    }


@transaction.atomic
def record_visit(user, event, request_id):
    from dingdong_ca.core.api.common import ApiError

    # Lock the already-existing parent row, including first visit; no creation race.
    get_user_model().objects.select_for_update().get(pk=user.pk)
    row, _ = ExhibitionVisitor.objects.get_or_create(user=user)
    receipt = ExhibitionVisit.objects.filter(visitor=row, request_id=request_id).first()
    if receipt:
        if receipt.event != event:
            raise ApiError("STATE_CONFLICT", 409, "体验记录已经改变，请刷新后重试")
        return receipt.response, False
    now = timezone.now()
    if event == "entered":
        row.first_entered_at = row.first_entered_at or now
        row.last_entered_at = now
    else:
        row.last_report_viewed_at = now
    # Activity timestamps do not invalidate an operator's follow-up edit revision.
    row.save(
        update_fields=["first_entered_at", "last_entered_at", "last_report_viewed_at", "updated_at"]
    )
    result = serialize_visitor(row)
    ExhibitionVisit.objects.create(visitor=row, request_id=request_id, event=event, response=result)
    return result, True


@transaction.atomic
def update_followup(visitor_id, actor, revision, status, note):
    from dingdong_ca.core.api.common import ApiError
    from dingdong_ca.ops.services import ops_audit

    row = ExhibitionVisitor.objects.select_for_update().get(pk=visitor_id)
    if row.revision != revision:
        raise ApiError("STATE_CONFLICT", 409, "记录已被其他同事修改，请刷新页面后重新填写。")
    previous = row.status
    row.status, row.note = status, note
    row.revision += 1
    row.save(update_fields=["status", "note", "revision", "updated_at"])
    ops_audit(
        actor,
        "exhibition.followup",
        row,
        "展会体验用户",
        {
            "previous_status": previous,
            "status": status,
            "note": note,
            "revision": row.revision,
        },
    )
    return row
