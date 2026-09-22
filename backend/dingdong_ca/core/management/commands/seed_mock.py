"""Non-production synthetic rows, never HTTP response mocks."""

import json
import uuid

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from dingdong_ca.core.models import (
    ActivityContentVersion,
    Child,
    Family,
    FamilyMembership,
)

NAMESPACE = uuid.UUID("2ea9a66d-0136-4389-a414-c0ec7e3319a4")


def ident(dataset, key):
    return uuid.uuid5(NAMESPACE, dataset + ":" + key)


class Command(BaseCommand):
    help = "注入合成账号、儿童、活动、题库、授权说明及报告模板。"

    def add_arguments(self, parser):
        parser.add_argument("--dataset", default="phase1-v1")
        parser.add_argument("--mode", choices=["cold", "warm"], default="cold")

    @transaction.atomic
    def handle(self, *args, **options):
        if settings.APP_ENV not in ["development", "test", "demo"]:
            raise CommandError("mock data is non-production only")
        dataset = options["dataset"]
        if dataset != "phase1-v1":
            raise CommandError("Currently supports only dataset phase1-v1")
        users = []
        children = []
        created = 0
        reused = 0
        for i in [1, 2]:
            phone = f"+861390000000{i}"
            existing = get_user_model().objects.filter(account_kind="parent", phone=phone).first()
            if existing and existing.pk != ident(dataset, f"user-{i}"):
                raise CommandError("Test phone is owned by another user; refusing to overwrite")
            user, new = get_user_model().objects.get_or_create(
                pk=ident(dataset, f"user-{i}"),
                defaults={
                    "username": f"test-{dataset}-{i}",
                    "phone": phone,
                    "account_kind": "parent",
                },
            )
            if new:
                user.set_unusable_password()
                user.save()
            family, _ = Family.objects.get_or_create(pk=ident(dataset, f"family-{i}"))
            FamilyMembership.objects.get_or_create(
                pk=ident(dataset, f"member-{i}"), defaults={"family": family, "user": user}
            )
            child, _ = Child.objects.get_or_create(
                pk=ident(dataset, f"child-{i}"),
                defaults={
                    "family": family,
                    "created_by": user,
                    "create_request_key": ident(dataset, f"child-create-{i}"),
                    "create_payload": {
                        "name": f"合成儿童{i}",
                        "gender": "unknown",
                        "birth_date": None,
                    },
                    "name": f"合成儿童{i}",
                },
            )
            users.append({"id": str(user.pk), "phone": phone, "family_id": str(family.pk)})
            children.append(child)
        activity_ids = []
        from dingdong_ca.testsupport.activity_content import ACTIVITIES

        for i, (title, materials, steps) in enumerate(ACTIVITIES):
            code = f"test-activity-{i}"
            current = ActivityContentVersion.objects.filter(code=code, status="published").first()
            publish = current is None or current.version == "test-v1"
            if publish and current:
                current.status = "retired"
                current.save()
            a, new = ActivityContentVersion.objects.get_or_create(
                pk=ident(dataset, f"activity-readable-{i}"),
                defaults={
                    "code": f"test-activity-{i}",
                    "version": "readable-v2",
                    "title": title,
                    "island": ["science", "story", "nature", "imagination"][i % 4],
                    "mood": ["energy", "focus", "inspire", "calm"][i % 4],
                    "duration_minutes": 3,
                    "content": {
                        "materials": materials,
                        "goal": "和孩子一起尝试，留下一个日常小发现。",
                        "alternative": "没有材料时，可以先聊聊你们会怎样尝试。",
                        "allowed_styles": ["cognitive", "emotional", "creative", "exploratory"],
                        "steps": [
                            {
                                "index": n,
                                "instruction": steps[n],
                                "guide_text": "不必做得一样，听听孩子的想法，再一起试一小步。",
                            }
                            for n in range(3)
                        ],
                    },
                    "status": "published" if publish else "draft",
                    "data_origin": "synthetic",
                    "published_at": timezone.now(),
                },
            )
            created += int(new)
            reused += int(not new)
            activity_ids.append(str(a.pk))
        from dingdong_ca.testsupport.seed import seed_content

        seed_content()
        from dingdong_ca.testsupport.robot import seed_robot_content

        seed_robot_content()
        self.stdout.write(
            json.dumps(
                {
                    "dataset": dataset,
                    "mode": options["mode"],
                    "data_origin": "synthetic",
                    "users": users,
                    "children": [str(c.pk) for c in children],
                    "activity_ids": activity_ids,
                    "created_activities": created,
                    "reused_activities": reused,
                    "note": "Existing published records stay frozen; known placeholder seeds are retired with readable replacements. No completed business results are inserted; warm is an input-only compatibility alias.",
                },
                ensure_ascii=False,
            )
        )
