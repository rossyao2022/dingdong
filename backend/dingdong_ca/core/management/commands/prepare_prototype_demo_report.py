"""Prepare synthetic input for the fixed exhibition child; never manufacture a report."""

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from dingdong_ca.core.api.common import audit
from dingdong_ca.core.assessment_models import QuestionnaireVersion, ReportTemplateVersion
from dingdong_ca.core.ca_models import CaAccount
from dingdong_ca.core.models import Child, FamilyMembership
from dingdong_ca.core.services.ca_account import (
    PROTOTYPE_ACCOUNT_ID,
    nfc_token_digest,
    prototype_demo_enabled,
)
from dingdong_ca.testsupport.models import TestFixture


class Command(BaseCommand):
    help = "预检固定演示儿童的报告输入；仅 --apply 写入，不创建报告或修改发布内容"

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true")

    def handle(self, *args, **options):
        if not prototype_demo_enabled() or settings.INTEGRATION_DATA_SOURCE != "database_fixture":
            raise CommandError("仅限已开启固定账号的 demo/database_fixture 环境")
        with transaction.atomic():
            account = CaAccount.objects.filter(ca_account_id=PROTOTYPE_ACCOUNT_ID).first()
            if account is None:
                raise CommandError("固定演示账号不存在；请先用原标签连接")
            # 与建号服务保持相同锁顺序，避免准备输入时档案被并发更改。
            child = Child.objects.select_for_update().get(pk=account.child_id)
            account = (
                CaAccount.objects.select_for_update(of=("self",))
                .select_related("bound_by")
                .get(pk=account.pk)
            )
            if (
                account.status != "active"
                or account.child_id != child.pk
                or account.bound_by is None
                or not settings.DINGDONG_PROTOTYPE_NFC_TOKEN
                or account.nfc_token_hash != nfc_token_digest(settings.DINGDONG_PROTOTYPE_NFC_TOKEN)
                or child.status != "active"
                or child.family_id != account.family_id
                or not FamilyMembership.objects.filter(
                    user=account.bound_by,
                    family_id=account.family_id,
                    ended_at__isnull=True,
                    family__status="active",
                ).exists()
                or not account.bound_by.is_active
            ):
                raise CommandError("演示账号或原儿童档案状态不符；拒绝准备输入")
            questionnaire = QuestionnaireVersion.objects.filter(
                code="initial-assessment", status="published", data_origin="synthetic"
            ).first()
            template = ReportTemplateVersion.objects.filter(
                code="initial-report", status="published", data_origin="synthetic"
            ).first()
            if questionnaire is None or template is None:
                raise CommandError("缺少已发布的合成题库或报告模板；不自动发布内容")
            payload = {
                "questionnaire_version_id": str(questionnaire.pk),
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
            lookup = {
                "dataset": "phase1-v1",
                "kind": "initial_result",
                "subject_key": str(child.pk),
                "sequence": 1,
            }
            existing = TestFixture.objects.filter(**lookup).first()
            if existing and existing.payload != payload:
                raise CommandError("原档案已有不同报告输入；拒绝覆盖，请先核对")
            faults = TestFixture.objects.filter(
                dataset="phase1-v1", kind="fault", subject_key=str(child.pk), sequence=1
            )
            if any(
                row.payload not in [{"scenario": "normal"}, {"scenario": "assessment_success"}]
                for row in faults
            ):
                raise CommandError("原档案存在故障测试输入；拒绝覆盖，请先核对")
            if not options["apply"]:
                self.stdout.write("预检通过：仅准备原演示儿童的合成输入；使用 --apply 才会写入")
                return
            if not existing:
                TestFixture.objects.create(**lookup, payload=payload)
                audit(account.bound_by, "prototype_demo.prepare_report", account)
            self.stdout.write("报告体验输入已就绪；仍需家长同意、完成问卷并提交生成报告")
