"""The test protocol is deliberately distinct from any unconfirmed DingDong API."""

import hashlib
import math
from datetime import timedelta

from django.conf import settings
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from dingdong_ca.core.models import Child, ReportTemplateVersion, RuleVersion

from .adapter import FixtureFailure
from .models import TestFixture

SCENARIOS = [
    "sync_success",
    "sync_duplicate",
    "sync_correction",
    "sync_conflict",
    "sync_failure",
    "rule_missing",
    "no_consent",
    "rule_version",
]


def seed_robot_content():
    RuleVersion.objects.get_or_create(
        code="stage-rule",
        version="test-rule-v1",
        defaults={
            "status": "published",
            "data_origin": "synthetic",
            "published_at": timezone.now(),
            "config": {"implementation": "test-count-v1", "multiplier": 1},
        },
    )
    ReportTemplateVersion.objects.get_or_create(
        code="stage-report",
        version="test-stage-template-v1",
        defaults={
            "status": "published",
            "data_origin": "synthetic",
            "published_at": timezone.now(),
            "template": {
                "title": "阶段成长观察",
                "intro": "本报告基于观察数据生成，供家长了解孩子的近期状态。",
            },
        },
    )


def inject_robot(child_id, scenario, dataset):
    seed_robot_content()
    child = Child.objects.get(pk=child_id)
    subject = "TEST-SUBJECT-" + str(child_id)
    proof = "TEST-PROOF-" + str(child_id)
    TestFixture.objects.update_or_create(
        dataset=dataset,
        kind="identity",
        subject_key=str(child_id),
        sequence=1,
        defaults={
            "payload": {
                "proof_digest": hashlib.sha256(proof.encode()).hexdigest(),
                "family_id": str(child.family_id),
                "external_subject_id": subject,
                "expires_at": (timezone.now() + timedelta(hours=24)).isoformat(),
            },
            "consumed_at": None,
        },
    )
    sample = {
        "external_subject_id": subject,
        "logical_key": "TEST-WINDOW-20260901",
        "source_version": "fixture-r1",
        "revision_no": 1,
        "schema_version": "test-observation-v1",
        "window_start": "2026-09-01T00:00:00Z",
        "window_end": "2026-09-08T00:00:00Z",
        "metrics": [
            {
                "code": "test_observation",
                "label": "观察次数",
                "value": 3,
                "unit": "次",
                "missing_reason": None,
            }
        ],
    }
    TestFixture.objects.update_or_create(
        dataset=dataset,
        kind="observation",
        subject_key=str(child_id),
        sequence=1,
        defaults={"payload": sample},
    )
    if scenario in ["sync_duplicate", "sync_correction", "sync_conflict"]:
        second = {**sample}
        if scenario != "sync_duplicate":
            second["metrics"] = [{**sample["metrics"][0], "value": 5}]
        if scenario == "sync_correction":
            second.update(source_version="fixture-r2", revision_no=2)
        TestFixture.objects.update_or_create(
            dataset=dataset,
            kind="observation",
            subject_key=str(child_id),
            sequence=2,
            defaults={"payload": second},
        )
    if scenario == "sync_failure":
        TestFixture.objects.update_or_create(
            dataset=dataset,
            kind="observation",
            subject_key=str(child_id),
            sequence=2,
            defaults={"payload": {"error": "UPSTREAM_TIMEOUT"}},
        )
    if scenario == "rule_missing":
        RuleVersion.objects.filter(code="stage-rule", status="published").update(
            status="draft", published_at=None
        )
    if scenario == "rule_version":
        RuleVersion.objects.get_or_create(
            code="stage-rule",
            version="test-rule-v2",
            defaults={
                "data_origin": "synthetic",
                "config": {"implementation": "test-count-v1", "multiplier": 2},
            },
        )
    return proof


def require_fixture_mode():
    if (
        settings.APP_ENV not in ["development", "test", "demo"]
        or settings.INTEGRATION_DATA_SOURCE != "database_fixture"
    ):
        raise FixtureFailure("INTEGRATION_NOT_READY")


def normalize_observation(payload, subject):
    expected = {
        "external_subject_id",
        "logical_key",
        "source_version",
        "revision_no",
        "schema_version",
        "window_start",
        "window_end",
        "metrics",
    }
    if not isinstance(payload, dict) or set(payload) != expected:
        raise FixtureFailure("UPSTREAM_SCHEMA_INVALID")
    if (
        payload["external_subject_id"] != subject
        or payload["schema_version"] != "test-observation-v1"
    ):
        raise FixtureFailure("UPSTREAM_SCHEMA_INVALID")
    if type(payload["revision_no"]) is not int or payload["revision_no"] < 1:
        raise FixtureFailure("UPSTREAM_SCHEMA_INVALID")
    if any(
        not isinstance(payload[k], str) or not 1 <= len(payload[k]) <= 64
        for k in ["logical_key", "source_version"]
    ):
        raise FixtureFailure("UPSTREAM_SCHEMA_INVALID")
    try:
        start, end = parse_datetime(payload["window_start"]), parse_datetime(payload["window_end"])
        if (
            not start
            or not end
            or timezone.is_naive(start)
            or timezone.is_naive(end)
            or start >= end
        ):
            raise ValueError
    except (TypeError, ValueError):
        raise FixtureFailure("UPSTREAM_SCHEMA_INVALID") from None
    metrics = payload["metrics"]
    if not isinstance(metrics, list) or len(metrics) != 1:
        raise FixtureFailure("UPSTREAM_SCHEMA_INVALID")
    m = metrics[0]
    if not isinstance(m, dict) or set(m) != {"code", "label", "value", "unit", "missing_reason"}:
        raise FixtureFailure("UPSTREAM_SCHEMA_INVALID")
    if (
        m["code"] != "test_observation"
        or m["unit"] != "次"
        or m["missing_reason"] is not None
        or not isinstance(m["label"], str)
        or len(m["label"]) > 80
    ):
        raise FixtureFailure("UPSTREAM_SCHEMA_INVALID")
    if (
        type(m["value"]) not in [int, float]
        or not math.isfinite(m["value"])
        or not 0 <= m["value"] <= 100000
    ):
        raise FixtureFailure("UPSTREAM_SCHEMA_INVALID")
    return {**payload, "window_start": start, "window_end": end}


def fetch_observation(association, cursor):
    require_fixture_mode()
    row = TestFixture.objects.filter(
        dataset="phase1-v1",
        kind="observation",
        subject_key=str(association.child_id),
        sequence=cursor + 1,
    ).first()
    if row is None:
        return None
    if row.payload == {"error": "UPSTREAM_TIMEOUT"}:
        raise FixtureFailure("UPSTREAM_TIMEOUT")
    return normalize_observation(row.payload, association.external_subject_id)
