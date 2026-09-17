import json

from django.contrib.auth.models import Group, Permission
from django.core.management.base import BaseCommand
from django.db import transaction


class Command(BaseCommand):
    help = "幂等初始化固定角色；不创建超级管理员或真实业务结果。"

    @transaction.atomic
    def handle(self, *args, **options):
        roles = {
            "operations": [
                "view_child",
                "view_activityrecord",
                "view_externalassociation",
                "view_reportversion",
                "view_datarequest",
            ],
            "content": [
                action + "_" + model
                for action in ["view", "add", "change"]
                for model in [
                    "activitycontentversion",
                    "questionnaireversion",
                    "reporttemplateversion",
                    "ruleversion",
                ]
            ],
            "technical": [
                "view_backgroundjob",
                "view_jobattempt",
                "view_synccheckpoint",
                "view_externalassociation",
                "view_observationbatch",
                "view_auditevent",
                "view_datarequest",
            ],
            "account_admin": ["view_user"],
        }
        for code, permissions in roles.items():
            group, _ = Group.objects.get_or_create(name=code)
            group.permissions.set(
                Permission.objects.filter(
                    content_type__app_label__in=["core", "users"], codename__in=permissions
                )
            )
        self.stdout.write(
            json.dumps(
                {
                    "roles": list(roles),
                    "scope": "Fixed role actions; no editable permission or menu platform",
                },
                ensure_ascii=False,
            )
        )
