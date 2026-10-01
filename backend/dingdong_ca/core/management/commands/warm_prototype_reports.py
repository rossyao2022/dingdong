"""Warm shared report projections using only the supplier's read endpoint."""

from django.core.management.base import BaseCommand, CommandError

from dingdong_ca.core.api.common import ApiError
from dingdong_ca.core.services.ca_account import prototype_demo_enabled
from dingdong_ca.core.services.prototype_reports import (
    WEEKLY_TURNS,
    latest_snapshot,
    shared_snapshot,
)


class Command(BaseCommand):
    help = "预检四个展会报告周期；仅 --apply 真实拉取并保存，不读家庭或修改供应商数据"

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true")

    def handle(self, *args, **options):
        if not prototype_demo_enabled():
            raise CommandError("仅限已开启 Prototype 的 demo 环境")
        if not options["apply"]:
            for weekly in WEEKLY_TURNS:
                snapshot = latest_snapshot(weekly)
                self.stdout.write(f"dry-run weekly_turns={weekly} cached={snapshot is not None}")
            return
        failures = []
        for weekly in WEEKLY_TURNS:
            try:
                shared_snapshot(weekly, require_live=True)
            except ApiError as exc:
                failures.append(weekly)
                self.stdout.write(f"weekly_turns={weekly} failed={exc.code}")
            else:
                self.stdout.write(f"weekly_turns={weekly} ready")
        if failures:
            raise CommandError("部分周期未完成真实拉取；保留原有记录，请检查后重试")
