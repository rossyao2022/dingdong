from django.contrib import admin

from .admin_actions import ActionPanelMixin
from .ca_models import CaAccount
from .models import ActivityContentVersion, ActivityRecord, AuditEvent, Child


class ReadOnlyAdmin(ActionPanelMixin, admin.ModelAdmin):
    actions = None

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Child)
class ChildAdmin(ReadOnlyAdmin):
    list_display = ["id", "name", "gender", "status"]
    fields = ["id", "name", "gender", "birth_date", "status", "created_at", "updated_at"]
    search_fields = ["name", "=id"]


@admin.register(ActivityContentVersion)
class ContentAdmin(ReadOnlyAdmin):
    list_display = ["code", "version", "title", "status", "data_origin"]
    fields = ["code", "version", "title", "status", "data_origin"]


@admin.register(ActivityRecord)
class RecordAdmin(ReadOnlyAdmin):
    list_display = ["id", "status", "started_at", "finished_at", "source"]
    fields = ["id", "status", "started_at", "finished_at", "source"]


@admin.register(AuditEvent)
class AuditAdmin(ReadOnlyAdmin):
    list_display = ["action", "target_kind", "target_id", "created_at"]
    fields = ["action", "target_kind", "target_id", "created_at"]


from .models import (  # noqa: E402
    BackgroundJob,
    DataRequest,
    ExternalAssociation,
    JobAttempt,
    ObservationBatch,
    QuestionnaireVersion,
    ReportTemplateVersion,
    ReportVersion,
    RuleVersion,
    SyncCheckpoint,
)


class DraftContentAdmin(ActionPanelMixin, admin.ModelAdmin):
    list_display = ["code", "version", "status", "data_origin"]
    readonly_fields = ["status", "published_at", "published_by"]
    actions = None

    def has_delete_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return super().has_change_permission(request, obj) and (
            obj is None or obj.status == "draft"
        )

    def save_model(self, request, obj, form, change):
        # Serialize edits with the publish API, checking fresh state rather than stale form state.
        from django.core.exceptions import PermissionDenied
        from django.db import transaction

        with transaction.atomic():
            if change:
                fresh = type(obj).objects.select_for_update().get(pk=obj.pk)
                if fresh.status != "draft":
                    raise PermissionDenied("发布内容请复制为新版本")
                # 技术后台和运营后台改的是同一份草稿，必须共用同一个修订号：
                # 这里推进修订号，运营旧页面拿着旧修订号保存才会被拒，而不是静默覆盖。
                if any(field.name == "revision" for field in type(obj)._meta.get_fields()):
                    obj.revision = fresh.revision + 1
            super().save_model(request, obj, form, change)


admin.site.unregister(ActivityContentVersion)
admin.site.register(ActivityContentVersion, DraftContentAdmin)
from .questionnaire_admin import QuestionnaireAdminMixin  # noqa: E402


@admin.register(QuestionnaireVersion)
class QuestionnaireAdmin(QuestionnaireAdminMixin, DraftContentAdmin):
    pass


for model in [ReportTemplateVersion, RuleVersion]:
    admin.site.register(model, DraftContentAdmin)


@admin.register(ExternalAssociation)
class AssociationAdmin(ReadOnlyAdmin):
    list_display = ["id", "child", "status", "verified_at", "ended_at"]
    fields = ["id", "child", "status", "verified_at", "ended_at", "data_origin"]


@admin.register(BackgroundJob)
class JobAdmin(ReadOnlyAdmin):
    list_display = ["id", "kind", "status", "attempt_count", "error_code"]
    fields = [
        "id",
        "kind",
        "status",
        "attempt_count",
        "max_attempts",
        "error_code",
        "next_attempt_at",
    ]


@admin.register(DataRequest)
class RequestAdmin(ReadOnlyAdmin):
    list_display = ["id", "kind", "status", "reason_code", "resolution_code"]
    fields = [
        "id",
        "child",
        "kind",
        "status",
        "reason_code",
        "resolution_code",
        "created_at",
        "completed_at",
    ]


@admin.register(ReportVersion)
class ReportAdmin(ReadOnlyAdmin):
    list_display = ["id", "data_origin", "generated_at"]
    fields = ["id", "profile", "template_version", "content", "data_origin", "generated_at"]


for model in [SyncCheckpoint, JobAttempt, ObservationBatch]:
    admin.site.register(model, ReadOnlyAdmin)


@admin.register(CaAccount)
class CaAccountAdmin(ReadOnlyAdmin):
    # 不把 nfc_token_hash 放进列表与详情：运营不需要凭据摘要。
    list_display = ["ca_account_id", "child", "status", "bind_state", "bound_at"]
    fields = [
        "id",
        "ca_account_id",
        "child",
        "family",
        "robot_ref",
        "status",
        "bind_state",
        "bound_at",
        "unbound_at",
        "created_at",
        "updated_at",
    ]
    search_fields = ["=ca_account_id"]


from django.contrib.auth import get_user_model  # noqa: E402


@admin.register(get_user_model())
class StaffUserAdmin(ReadOnlyAdmin):
    list_display = ["username", "is_active", "is_staff"]
    fields = ["username", "is_active", "is_staff"]

    def get_queryset(self, request):
        return super().get_queryset(request).filter(account_kind="staff", is_staff=True)
