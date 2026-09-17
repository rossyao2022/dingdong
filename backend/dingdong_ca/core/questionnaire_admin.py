"""Structured question editor; JSON is only its wire/storage representation."""

import copy
import uuid

from django import forms
from django.core.exceptions import PermissionDenied
from django.db import transaction
from django.http import HttpResponseRedirect
from django.urls import path, reverse

from .models import QuestionnaireVersion


class QuestionEditor(forms.Textarea):
    template_name = "core/question_editor.html"

    class Media:
        js = ["core/question_editor.js"]
        css = {"all": ["core/question_editor.css"]}


class QuestionnaireForm(forms.ModelForm):
    class Meta:
        model = QuestionnaireVersion
        fields = "__all__"
        exclude = ["status", "published_at", "published_by"]
        widgets = {"questions": QuestionEditor()}
        labels = {
            "code": "题库标识",
            "version": "版本号",
            "title": "题库名称",
            "purpose": "用途",
            "description": "给家长的用途说明",
            "questions": "逐题编辑",
            "data_origin": "内容来源",
        }
        help_texts = {"questions": "保存草稿后再发布。探索体验 1–10 题，测评流程测试 20–30 题。"}

    def clean_questions(self):
        questions = self.cleaned_data["questions"] or []
        if not isinstance(questions, list):
            raise forms.ValidationError("请使用逐题编辑器添加题目。")
        if len(questions) > 30:
            raise forms.ValidationError("最多保存 30 题。")
        return questions


class QuestionnaireAdminMixin:
    form = QuestionnaireForm
    list_display = ["title", "purpose", "version", "status", "data_origin"]
    fields = [
        "code",
        "version",
        "title",
        "purpose",
        "description",
        "data_origin",
        "questions",
        "status",
        "published_at",
        "published_by",
    ]

    def get_fields(self, request, obj=None):
        return [
            "question_preview" if f == "questions" and obj and obj.status != "draft" else f
            for f in self.fields
        ]

    def get_readonly_fields(self, request, obj=None):
        return list(super().get_readonly_fields(request, obj)) + ["question_preview"]

    def question_preview(self, obj):
        from django.utils.html import format_html_join

        return format_html_join(
            "",
            "<section><h3>{}. {}（{}）</h3><p>{}</p></section>",
            (
                (
                    i,
                    q["title"],
                    "必填" if q["required"] else "选填",
                    format_html_join(
                        "", "<span>{}　</span>", ((o["label"],) for o in q["options"])
                    ),
                )
                for i, q in enumerate(obj.questions, 1)
            ),
        )

    question_preview.short_description = "已发布题目预览"

    def get_urls(self):
        return [
            path(
                "<uuid:object_id>/copy/",
                self.admin_site.admin_view(self.copy_view),
                name="core_questionnaireversion_copy",
            )
        ] + super().get_urls()

    def copy_view(self, request, object_id):
        if (
            request.method != "POST"
            or not self.has_add_permission(request)
            or not super().has_change_permission(request)
        ):
            raise PermissionDenied
        with transaction.atomic():
            source = self.get_object(request, str(object_id))
            if source is None:
                raise PermissionDenied
            new = QuestionnaireVersion.objects.create(
                code=source.code,
                version="copy-" + uuid.uuid4().hex[:12],
                title=source.title,
                purpose=source.purpose,
                description=source.description,
                data_origin=source.data_origin,
                schema_version=source.schema_version,
                questions=copy.deepcopy(source.questions),
            )
            from .api.common import audit

            audit(request.user, "questionnaire.copy", new)
        return HttpResponseRedirect(
            reverse("admin:core_questionnaireversion_change", args=[new.pk])
        )

    def change_view(self, request, object_id, form_url="", extra_context=None):
        return super().change_view(
            request,
            object_id,
            form_url,
            {
                **(extra_context or {}),
                "questionnaire_copy_url": reverse(
                    "admin:core_questionnaireversion_copy", args=[object_id]
                )
                if self.has_add_permission(request)
                else None,
            },
        )
