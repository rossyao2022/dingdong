from django.utils import timezone

from dingdong_ca.core.models import PolicyVersion, QuestionnaireVersion, ReportTemplateVersion

from .models import TestFixture


def seed_content():
    common = {"status": "published", "data_origin": "synthetic", "published_at": timezone.now()}
    for purpose in ["assessment_processing", "dingdong_sync"]:
        PolicyVersion.objects.get_or_create(
            purpose=purpose,
            version="test-v1",
            defaults={
                **common,
                "code": purpose,
                "body": "[合成测试]仅用于功能验证；不采集或保存真实指纹。",
            },
        )
    from .question_content import DAILY, EXPLORATION, questions

    # Upgrade only the known placeholder seed. Operator publications are never replaced.
    for code, purpose, title, rows in [
        ("initial-assessment", "assessment", "日常探索问卷（流程测试）", DAILY),
        ("exploration", "exploration", "四个小情境：探索偏好体验", EXPLORATION),
    ]:
        if not QuestionnaireVersion.objects.filter(code=code, version="readable-v2").exists():
            current = QuestionnaireVersion.objects.filter(code=code, status="published").first()
            publish = current is None or current.version == "test-v1"
            if publish and current:
                current.status = "retired"
                current.save()
            QuestionnaireVersion.objects.create(
                code=code,
                version="readable-v2",
                purpose=purpose,
                title=title,
                description="非正式测评，仅用于体验或流程测试；记录本次选择，不评定天赋或能力。",
                questions=questions(rows),
                data_origin="synthetic",
                status="published" if publish else "draft",
                published_at=timezone.now() if publish else None,
            )
    q = QuestionnaireVersion.objects.filter(code="initial-assessment", status="published").first()
    ReportTemplateVersion.objects.get_or_create(
        code="initial-report",
        version="test-template-v1",
        defaults={
            **common,
            "template": {"title": "合成测试观察", "intro": "用于验证报告生成，不是实际测评结论。"},
        },
    )
    return q


def inject(child_id, scenario, dataset="phase1-v1", questionnaire_version_id=None):
    seed_content()
    q = (
        QuestionnaireVersion.objects.get(pk=questionnaire_version_id)
        if questionnaire_version_id
        else QuestionnaireVersion.objects.get(code="initial-assessment", status="published")
    )
    TestFixture.objects.update_or_create(
        dataset=dataset,
        kind="initial_result",
        subject_key=str(child_id),
        sequence=1,
        defaults={
            "payload": {
                "questionnaire_version_id": str(q.pk),
                "schema_version": "test-profile-v1",
                "algorithm_version": "db-fixture-v1",
                "metrics": [
                    {
                        "code": "test_professional_result",
                        "label": "专业测评结果（尚未接入）",
                        "value": None,
                        "unit": "",
                        "missing_reason": "not_provided",
                    }
                ],
            }
        },
    )
    TestFixture.objects.update_or_create(
        dataset=dataset,
        kind="fault",
        subject_key=str(child_id),
        sequence=1,
        defaults={"payload": {"scenario": scenario}, "consumed_at": None},
    )
