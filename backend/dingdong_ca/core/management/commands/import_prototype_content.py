"""Dry-run by default; --apply creates drafts, --publish explicitly publishes new versions."""

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from dingdong_ca.core.api.common import audit
from dingdong_ca.core.api.staff import validate_content
from dingdong_ca.core.models import ActivityContentVersion, QuestionnaireVersion
from dingdong_ca.core.services.prototype_content import activity_payloads, questionnaire_payloads


class Command(BaseCommand):
    help = "预览或导入已锁定原型内容；默认只预览，不更改已有CA内容"

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true")
        parser.add_argument("--publish", action="store_true")

    def handle(self, *args, **options):
        if options["publish"] and not options["apply"]:
            raise CommandError("--publish 需要同时指定 --apply")
        with transaction.atomic():
            for model, payloads in [
                (QuestionnaireVersion, questionnaire_payloads()),
                (ActivityContentVersion, activity_payloads()),
            ]:
                for payload in payloads:
                    row = model(**payload)
                    validate_content(row)
                    self.stdout.write(f"{payload['title']} · {payload['version']}")
                    if not options["apply"]:
                        continue
                    existing = (
                        model.objects.select_for_update()
                        .filter(code=row.code, version=row.version)
                        .first()
                    )
                    if existing:
                        if any(getattr(existing, key) != value for key, value in payload.items()):
                            raise CommandError(
                                f"{row.code} 的现有版本与锁定内容不一致，请创建新版本，禁止覆盖"
                            )
                        row = existing
                    elif model.objects.filter(code=row.code).exists():
                        raise CommandError(
                            f"{row.code} 已存在其他内容版本，需运营核对后决定，禁止自动覆盖"
                        )
                    else:
                        row.save()
                        audit(None, "prototype_content.import", row)
                    if options["publish"] and row.status == "draft":
                        if (
                            model.objects.filter(code=row.code, status="published")
                            .exclude(pk=row.pk)
                            .exists()
                        ):
                            raise CommandError(f"{row.code} 已有已发布版本，禁止自动替换")
                        row.status = "published"
                        row.published_at = timezone.now()
                        row.save()
                        audit(None, "prototype_content.publish", row)
        self.stdout.write("仅预览，未写入" if not options["apply"] else "导入完成")
