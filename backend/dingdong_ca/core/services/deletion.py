"""Explicit child-scoped deletion, leaving only requester-scoped status receipts."""

from django.db.models import Q
from django.utils import timezone

from dingdong_ca.core import models as m
from dingdong_ca.testsupport.models import TestFixture


def delete_child(child):
    # Caller holds the child row lock, shared by every external result writer.
    associations = m.ExternalAssociation.objects.filter(child=child)
    profiles = m.ProfileSnapshot.objects.filter(child=child)
    jobs = m.BackgroundJob.objects.filter(Q(association__in=associations) | Q(profile__in=profiles))
    ids = {child.pk}
    for qs in [
        associations,
        profiles,
        jobs,
        m.ConsentGrant.objects.filter(child=child),
        m.AssessmentSession.objects.filter(child=child),
        m.AlgorithmAttempt.objects.filter(session__child=child),
        m.ActivityRecord.objects.filter(child=child),
        m.ReportVersion.objects.filter(profile__in=profiles),
        m.ObservationBatch.objects.filter(association__in=associations),
    ]:
        ids.update(qs.values_list("pk", flat=True))
    m.JobAttempt.objects.filter(job__in=jobs).delete()
    jobs.delete()
    m.ReportVersion.objects.filter(profile__in=profiles).delete()
    profiles.delete()
    for obs in m.ObservationBatch.objects.filter(association__in=associations).order_by(
        "-revision_no"
    ):
        obs.delete()
    m.SyncCheckpoint.objects.filter(association__in=associations).delete()
    associations.delete()
    m.AlgorithmAttempt.objects.filter(session__child=child).delete()
    m.AssessmentSession.objects.filter(child=child).delete()
    m.ConsentGrant.objects.filter(child=child).delete()
    m.ActivityRecord.objects.filter(child=child).delete()
    TestFixture.objects.filter(subject_key=str(child.pk)).delete()
    m.AuditEvent.objects.filter(target_id__in=ids).update(target_id=None)
    m.DataRequest.objects.filter(child=child, status__in=["open", "processing"]).update(
        status="cancelled", resolution_code="cancelled", completed_at=timezone.now()
    )
    m.DataRequest.objects.filter(child=child).update(child=None)
    child.delete()
