from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from dingdong_ca.core.models import LoginGrant, SmsChallenge


class Command(BaseCommand):
    help = "清理超过24小时的验证码挑战（含短期IP限频数据）与过期登录授权。"

    @transaction.atomic
    def handle(self, *args, **options):
        now = timezone.now()
        SmsChallenge.objects.filter(expires_at__lt=now, status="sent").update(
            status="expired", code_digest=None
        )
        challenges = SmsChallenge.objects.filter(created_at__lt=now - timedelta(hours=24)).delete()[
            0
        ]
        grants = LoginGrant.objects.filter(expires_at__lt=now - timedelta(days=1)).delete()[0]
        self.stdout.write(f"challenges={challenges}, grants={grants}")
