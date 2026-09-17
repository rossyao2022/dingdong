"""Database inputs for real business services; not HTTP endpoint mocks."""

import math

from django.conf import settings

from .models import TestFixture


class FixtureFailure(Exception):
    def __init__(self, code, unknown=False):
        self.code, self.unknown = code, unknown


def initial_result(child_id, questionnaire_id):
    if (
        settings.APP_ENV not in ["development", "test", "demo"]
        or settings.INTEGRATION_DATA_SOURCE != "database_fixture"
    ):
        raise FixtureFailure("INTEGRATION_NOT_READY")
    fault = TestFixture.objects.filter(
        dataset="phase1-v1", kind="fault", subject_key=str(child_id), sequence=1
    ).first()
    if fault:
        scenario = fault.payload.get("scenario")
        if scenario == "assessment_timeout":
            raise FixtureFailure("UPSTREAM_TIMEOUT", unknown=True)
        if scenario == "assessment_failure":
            raise FixtureFailure("UPSTREAM_UNAVAILABLE")
    row = TestFixture.objects.filter(
        dataset="phase1-v1", kind="initial_result", subject_key=str(child_id), sequence=1
    ).first()
    if not row:
        raise FixtureFailure("FIXTURE_NOT_FOUND")
    data = row.payload
    if (
        not isinstance(data, dict)
        or set(data)
        != {"questionnaire_version_id", "schema_version", "algorithm_version", "metrics"}
        or data["questionnaire_version_id"] != str(questionnaire_id)
    ):
        raise FixtureFailure("UPSTREAM_SCHEMA_INVALID")
    if data["schema_version"] != "test-profile-v1" or data["algorithm_version"] != "db-fixture-v1":
        raise FixtureFailure("UPSTREAM_SCHEMA_INVALID")
    metrics = data["metrics"]
    if not isinstance(metrics, list) or not 1 <= len(metrics) <= 20:
        raise FixtureFailure("UPSTREAM_SCHEMA_INVALID")
    seen = set()
    for item in metrics:
        if not isinstance(item, dict) or set(item) != {
            "code",
            "label",
            "value",
            "unit",
            "missing_reason",
        }:
            raise FixtureFailure("UPSTREAM_SCHEMA_INVALID")
        if (
            not isinstance(item["code"], str)
            or not item["code"].startswith("test_")
            or item["code"] in seen
        ):
            raise FixtureFailure("UPSTREAM_SCHEMA_INVALID")
        seen.add(item["code"])
        if any(
            not isinstance(item[k], str) or len(item[k]) > 80 for k in ["code", "label", "unit"]
        ):
            raise FixtureFailure("UPSTREAM_SCHEMA_INVALID")
        value = item["value"]
        if value is not None and (type(value) not in [int, float] or not math.isfinite(value)):
            raise FixtureFailure("UPSTREAM_SCHEMA_INVALID")
        if item["missing_reason"] is not None and item["missing_reason"] not in [
            "not_provided",
            "not_applicable",
        ]:
            raise FixtureFailure("UPSTREAM_SCHEMA_INVALID")
    return {
        "schema_version": data["schema_version"],
        "algorithm_version": data["algorithm_version"],
        "metrics": metrics,
    }
