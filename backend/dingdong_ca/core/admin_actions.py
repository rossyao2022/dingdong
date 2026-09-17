"""Thin Admin controls calling the same tested staff APIs; no duplicate business handlers."""

import json


class ActionPanelMixin:
    change_form_template = "admin/core/actions_change_form.html"

    class Media:
        js = ["core/admin_actions.js"]

    def change_view(self, request, object_id, form_url="", extra_context=None):
        obj = self.get_object(request, object_id)
        roles = set(request.user.groups.values_list("name", flat=True))
        if request.user.is_superuser:
            roles.update(["content", "technical", "operations", "account_admin"])
        actions = []

        def add(label, path, payload=None, method="POST"):
            actions.append(
                {
                    "label": label,
                    "url": "/api/v1/staff/" + path,
                    "payload": json.dumps(payload or {}),
                    "method": method,
                }
            )

        if obj:
            name = obj._meta.model_name
            content = {
                "questionnaireversion": "questionnaires",
                "activitycontentversion": "activities",
                "reporttemplateversion": "report-templates",
                "ruleversion": "rules",
            }
            if name in content and "content" in roles and obj.status == "draft":
                add("发布此版本", content[name] + "/" + str(obj.pk) + "/publish")
            if name == "backgroundjob" and "technical" in roles and obj.status == "failed":
                add("重试失败任务", "jobs/" + str(obj.pk) + "/retry")
            if name == "externalassociation" and "technical" in roles and obj.status == "verified":
                action = "pause" if obj.synccheckpoint.status == "enabled" else "resume"
                add(
                    "暂停同步" if action == "pause" else "恢复同步",
                    "associations/" + str(obj.pk) + "/" + action,
                )
            if name == "datarequest" and obj.status in ["open", "processing"]:
                url = "data-requests/" + str(obj.pk) + "/resolve"
                if obj.kind == "deletion" and "technical" in roles:
                    add(
                        "执行此儿童的数据删除",
                        url,
                        {"action": "execute_deletion", "resolution_code": "deleted"},
                    )
                elif obj.kind != "deletion" and roles & {"operations", "technical"}:
                    add(
                        "确认人工处理完成",
                        url,
                        {"action": "resolve", "resolution_code": "resolved"},
                    )
                if roles & {"operations", "technical"}:
                    add("取消事项", url, {"action": "cancel", "resolution_code": "cancelled"})
            if (
                name == "user"
                and "account_admin" in roles
                and obj.pk != request.user.pk
                and not obj.is_superuser
                and not obj.groups.filter(name="account_admin").exists()
            ):
                add(
                    "停用工作人员" if obj.is_active else "启用工作人员",
                    "users/" + str(obj.pk) + "/status",
                    {"is_active": not obj.is_active},
                    "PATCH",
                )
                extra_context = {
                    **(extra_context or {}),
                    "ca_roles_url": "/api/v1/staff/users/" + str(obj.pk) + "/roles",
                    "ca_roles": [
                        {"code": r, "checked": obj.groups.filter(name=r).exists()}
                        for r in ["operations", "content", "technical"]
                    ],
                }
        return super().change_view(
            request, object_id, form_url, {**(extra_context or {}), "ca_actions": actions}
        )
