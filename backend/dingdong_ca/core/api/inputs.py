from django.utils import timezone
from rest_framework import serializers


class StrictSerializer(serializers.Serializer):
    def to_internal_value(self, data):
        if not isinstance(data, dict):
            raise serializers.ValidationError({"body": "必须为 JSON 对象"})
        unknown = set(data) - set(self.fields)
        if unknown:
            raise serializers.ValidationError({x: "未知字段" for x in unknown})
        if self.partial and not data:
            raise serializers.ValidationError({"body": "至少提供一个字段"})
        return super().to_internal_value(data)


class StrictString(serializers.CharField):
    def to_internal_value(self, data):
        if not isinstance(data, str):
            raise serializers.ValidationError("必须为字符串")
        return super().to_internal_value(data)


class SmsInput(StrictSerializer):
    phone = StrictString(max_length=16)

    def validate_phone(self, value):
        import re

        if re.fullmatch(r"1\d{10}", value):
            value = "+86" + value
        if not re.fullmatch(r"\+[1-9]\d{6,14}", value):
            raise serializers.ValidationError("手机号格式不合法")
        return value


class LoginInput(StrictSerializer):
    challenge_id = serializers.UUIDField()
    code = StrictString(min_length=5, max_length=5, trim_whitespace=False)

    def validate_code(self, value):
        if not value.isascii() or not value.isdigit():
            raise serializers.ValidationError("验证码为5位数字字符串")
        return value


class ChildBaseInput(StrictSerializer):
    name = StrictString(max_length=80)
    gender = serializers.ChoiceField(choices=["unknown", "male", "female"], default="unknown")
    birth_date = serializers.DateField(allow_null=True, default=None)

    def validate_birth_date(self, value):
        if value and value > timezone.localdate():
            raise serializers.ValidationError("出生日期不能晚于今天")
        return value


class ChildInput(ChildBaseInput):
    """家长端编辑档案。

    `revision` 是可选字段：新版客户端会带上"打开页面时读到的修订号"，服务端据此
    判断是否有人（工作人员或其他标签页）在期间改过档案。不带也能用，以兼容已经
    打开着的旧页面；但无论带不带，服务端都会推进修订号，让别人的旧页面失效。
    """

    revision = serializers.IntegerField(min_value=1, required=False)


class ChildCreate(ChildBaseInput):
    request_id = serializers.UUIDField()


class ActivityCreate(StrictSerializer):
    request_id = serializers.UUIDField()
    activity_version_id = serializers.UUIDField()
    mode = serializers.ChoiceField(choices=["guide", "web"])
    style = StrictString(max_length=32)


class ActivityProgress(StrictSerializer):
    revision = serializers.IntegerField(min_value=1)
    step_index = serializers.IntegerField(min_value=0)


class ActivityFinish(StrictSerializer):
    status = serializers.ChoiceField(choices=["completed", "skipped"])
    feedback = serializers.ChoiceField(
        choices=["interesting", "try_again", "challenging"], allow_null=True, default=None
    )
    note = StrictString(max_length=160, allow_blank=True, default="")

    def validate(self, attrs):
        if attrs["status"] == "skipped" and (attrs["feedback"] is not None or attrs["note"]):
            raise serializers.ValidationError({"status": "跳过不保存反馈或备注"})
        return attrs


class ConsentInput(StrictSerializer):
    request_id = serializers.UUIDField()
    policy_version_id = serializers.UUIDField()


class AssessmentCreate(StrictSerializer):
    request_id = serializers.UUIDField()
    questionnaire_version_id = serializers.UUIDField()
    consent_grant_id = serializers.UUIDField()


class AnswerInput(StrictSerializer):
    question_code = StrictString(max_length=64)
    option_codes = serializers.ListField(child=StrictString(max_length=64), max_length=20)


class AnswersInput(StrictSerializer):
    revision = serializers.IntegerField(min_value=1)
    answers = AnswerInput(many=True)


class SubmitInput(StrictSerializer):
    request_id = serializers.UUIDField()
    revision = serializers.IntegerField(min_value=1)
