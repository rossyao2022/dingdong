"""Final audit: new reference sessions respect expiry and consent lifecycle."""

import uuid
from datetime import timedelta

import pytest
from django.utils import timezone
from test_prototype_exploration import complete, fill, start

from dingdong_ca.core.models import AssessmentSession, ConsentGrant, ProfileSnapshot

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize("purpose", ["interest", "talent"])
def test_expired_reference_answer_and_completion_reject_without_result(client, purpose):
    child, session, payload = start(client, purpose)
    session = fill(client, session, 4)
    AssessmentSession.objects.filter(pk=session["id"]).update(
        expires_at=timezone.now() - timedelta(seconds=1)
    )
    url = f"/api/v1/assessments/{session['id']}"
    assert (
        client.post(
            url + "/complete-exploration", {"revision": session["revision"]}, format="json"
        ).json()["code"]
        == "STATE_CONFLICT"
    )
    assert (
        client.patch(
            url + "/answers", {"revision": session["revision"], "answers": []}, format="json"
        ).json()["code"]
        == "STATE_CONFLICT"
    )
    assert client.get(url).json()["exploration_result"] is None
    newer = client.post(
        f"/api/v1/children/{child['id']}/assessments",
        {**payload, "request_id": str(uuid.uuid4())},
        format="json",
    )
    assert newer.status_code == 201 and newer.json()["id"] != session["id"]
    assert newer.json()["answers"] == []
    assert ProfileSnapshot.objects.count() == 0


@pytest.mark.parametrize("purpose", ["interest", "talent"])
def test_reference_revoke_preserves_completed_result_and_regrant_starts_new(client, purpose):
    child, session, payload = start(client, purpose)
    done = complete(client, fill(client, session, 4))
    draft_response = client.post(
        f"/api/v1/children/{child['id']}/assessments",
        {**payload, "request_id": str(uuid.uuid4())},
        format="json",
    )
    assert draft_response.status_code == 201
    draft = draft_response.json()
    grant = ConsentGrant.objects.get(pk=payload["consent_grant_id"])
    revoked = client.post(f"/api/v1/consents/{grant.pk}/revoke", {}, format="json")
    assert revoked.status_code == 200
    assert (
        client.get(f"/api/v1/assessments/{session['id']}").json()["exploration_result"]
        == done["exploration_result"]
    )
    assert client.get(f"/api/v1/assessments/{draft['id']}").json()["status"] == "cancelled"
    assert (
        client.patch(
            f"/api/v1/assessments/{draft['id']}/answers",
            {"revision": draft["revision"], "answers": []},
            format="json",
        ).json()["code"]
        == "CONSENT_REQUIRED"
    )
    assert (
        client.post(
            f"/api/v1/assessments/{session['id']}/complete-exploration",
            {"revision": done["revision"]},
            format="json",
        ).json()["code"]
        == "CONSENT_REQUIRED"
    )
    regrant = client.post(
        f"/api/v1/children/{child['id']}/consents",
        {"request_id": str(uuid.uuid4()), "policy_version_id": str(grant.policy_version_id)},
        format="json",
    )
    assert regrant.status_code == 201
    fresh = client.post(
        f"/api/v1/children/{child['id']}/assessments",
        {**payload, "request_id": str(uuid.uuid4()), "consent_grant_id": regrant.json()["id"]},
        format="json",
    )
    assert fresh.status_code == 201 and fresh.json()["id"] not in [session["id"], draft["id"]]
    assert fresh.json()["answers"] == [] and fresh.json()["exploration_result"] is None
    assert (
        client.get(f"/api/v1/assessments/{session['id']}").json()["exploration_result"]
        == done["exploration_result"]
    )
    assert ProfileSnapshot.objects.count() == 0
