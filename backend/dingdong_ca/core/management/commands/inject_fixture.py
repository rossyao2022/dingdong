from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from dingdong_ca.core.models import Child
from dingdong_ca.testsupport.ca_display import DISPLAY_SCENARIOS, inject_display
from dingdong_ca.testsupport.models import TestFixture
from dingdong_ca.testsupport.robot import SCENARIOS, inject_robot
from dingdong_ca.testsupport.seed import inject, seed_content

LOCAL_SCENARIOS = [
    "fresh",
    "sms_invalid",
    "family_isolation",
    "activity_complete",
    "activity_skip",
    "assessment_bad_input",
    "report_retry",
    "permission",
    "deletion",
]


class Command(BaseCommand):
    help = "注入指定儿童的非生产数据库测试输入，不生成报告或调用 API"

    def add_arguments(self, parser):
        parser.add_argument("--dataset", default="phase1-v1")
        parser.add_argument("--child-id", required=True)
        parser.add_argument("--questionnaire-version-id")
        parser.add_argument(
            "--scenario",
            required=True,
            choices=SCENARIOS
            + LOCAL_SCENARIOS
            + list(DISPLAY_SCENARIOS)
            + [
                "assessment_success",
                "assessment_timeout",
                "assessment_failure",
                "report_failure",
            ],
        )

    @transaction.atomic
    def handle(self, *args, **options):
        if (
            settings.APP_ENV not in ["development", "test", "demo"]
            or options["dataset"] != "phase1-v1"
        ):
            raise CommandError("Only non-production phase1-v1 is supported")
        if not Child.objects.filter(pk=options["child_id"]).exists():
            raise CommandError("Child does not exist")
        scenario = options["scenario"]
        if scenario in DISPLAY_SCENARIOS:
            # 四个展示面的合成输入：按活跃 CA 账户写入，不调任何外部接口。
            account_id = inject_display(options["child_id"], scenario, options["dataset"])
            self.stdout.write("Display scenario ready: " + scenario + " for " + account_id)
        elif scenario in LOCAL_SCENARIOS:
            seed_content()
            if scenario == "permission":
                call_command("seed_base", stdout=self.stdout)
            elif scenario in ["report_retry", "deletion"]:
                proof = inject_robot(options["child_id"], "sync_success", options["dataset"])
                inject(options["child_id"], "assessment_success", options["dataset"])
                self.stdout.write("Synthetic proof: " + proof)
                if scenario == "report_retry":
                    TestFixture.objects.filter(
                        dataset=options["dataset"], kind="fault", subject_key=options["child_id"]
                    ).update(
                        payload={"scenario": "report_failure", "remaining": 5}, consumed_at=None
                    )
            self.stdout.write(
                "Scenario ready: "
                + scenario
                + "; run the real API actions listed in docs/M3_SCENARIOS.md"
            )
        elif options["scenario"] in SCENARIOS:
            proof = inject_robot(options["child_id"], options["scenario"], options["dataset"])
            self.stdout.write("Synthetic proof: " + proof)
        else:
            inject(
                options["child_id"],
                options["scenario"],
                options["dataset"],
                options["questionnaire_version_id"],
            )
        self.stdout.write("Synthetic database input injected")
