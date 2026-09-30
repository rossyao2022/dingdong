"""Explicit exhibition input: unanswered professional metrics stay missing."""

from django.conf import settings

from dingdong_ca.core.models import QuestionnaireVersion


def demo_initial_input(questionnaire_id):
    if (
        settings.APP_ENV != "demo"
        or not settings.CA_DEMO_REPORTS_ENABLED
        or settings.INTEGRATION_DATA_SOURCE != "database_fixture"
    ):
        return None
    if not QuestionnaireVersion.objects.filter(
        pk=questionnaire_id,
        code="initial-assessment",
        purpose="assessment",
        data_origin="synthetic",
        status__in=["published", "retired"],
    ).exists():
        return None
    return {
        "questionnaire_version_id": str(questionnaire_id),
        "schema_version": "test-profile-v1",
        "algorithm_version": "db-fixture-v1",
        "metrics": [
            {
                "code": "test_professional_result",
                "label": "专业测评结果",
                "value": None,
                "unit": "",
                "missing_reason": "not_provided",
            }
        ],
    }
