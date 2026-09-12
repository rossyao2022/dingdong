"""运营后台的 JSON 动作接口。

设计原则：
- 只新增"运营确实需要、现有接口没有"的动作；发布、重试、事项处理直接复用
  /api/v1/staff/* 的同一套实现，避免两份业务规则。
- 每个动作都在服务端重新判断角色，并写审计。
- 草稿保存宽松（允许未完成的编辑），发布严格（复用 core 的发布校验）。
"""

import copy
import uuid
from functools import wraps

from django.core.exceptions import ObjectDoesNotExist
from django.db import transaction
from django.http import Http404
from django.shortcuts import get_object_or_404
from rest_framework.authentication import SessionAuthentication
from rest_framework.decorators import api_view
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser

from dingdong_ca.core.models import ActivityContentVersion, Child, Family, QuestionnaireVersion

from . import labels as L
from .permissions import has_permission
from .services import OpsError, json_error, json_ok, ops_audit

MAX_QUESTIONS = 50
MAX_OPTIONS = 12
PURPOSE_RANGE = {"exploration": (1, 10), "assessment": (20, 30)}


def ops_action(permission):
    """JSON 动作装饰器：会话身份 + 角色校验 + 统一错误信封。

    沿用 core 中已经验证过的做法：先把 authentication_classes / parser_classes
    设在被装饰函数上，再交给 DRF 的 api_view；这样 CSRF 与 JSON 解析行为
    和家长端后台接口完全一致。
    """

    def decorate(view):
        @wraps(view)
        def handler(request, *args, **kwargs):
            if not has_permission(request.user, permission):
                return json_error("PERMISSION_DENIED", "当前账号没有执行该操作的权限。", 403)
            data = request.data if isinstance(request.data, dict) else {}
            try:
                return view(request, data, *args, **kwargs)
            except OpsError as exc:
                return json_error(exc.code, exc.message, exc.status, exc.fields)
            except Http404, ObjectDoesNotExist:
                return json_error("NOT_FOUND", "记录不存在或已被删除。", 404)

        handler.authentication_classes = [SessionAuthentication]
        handler.parser_classes = [JSONParser, FormParser, MultiPartParser]
        return api_view(["POST"])(handler)

    return decorate


# --------------------------------------------------------------------------- 内容规范化


def _text(value, limit, field, label):
    if not isinstance(value, str):
        raise OpsError("VALIDATION_ERROR", f"{label}格式不正确。", 422, [{"field": field}])
    value = value.strip()
    if len(value) > limit:
        raise OpsError("VALIDATION_ERROR", f"{label}最多 {limit} 个字。", 422, [{"field": field}])
    return value


def normalize_questions(raw, purpose):
    """把编辑器提交的题目规范成题库存储结构；草稿阶段允许未完成。"""
    if not isinstance(raw, list):
        raise OpsError("VALIDATION_ERROR", "题目数据格式不正确，请刷新页面后重试。", 422)
    if len(raw) > MAX_QUESTIONS:
        raise OpsError("VALIDATION_ERROR", f"单份题库最多 {MAX_QUESTIONS} 题。", 422)
    questions = []
    used = set()
    for index, item in enumerate(raw, 1):
        if not isinstance(item, dict):
            raise OpsError("VALIDATION_ERROR", f"第 {index} 题数据格式不正确。", 422)
        title = _text(
            item.get("title", ""), 300, f"questions.{index}.title", f"第 {index} 题的题干"
        )
        if not title:
            raise OpsError(
                "VALIDATION_ERROR",
                f"第 {index} 题还没有填写题干。",
                422,
                [{"field": f"questions.{index}.title"}],
            )
        qtype = item.get("type")
        if qtype not in ("single_choice", "multiple_choice"):
            raise OpsError("VALIDATION_ERROR", f"第 {index} 题的题型不正确。", 422)
        required = item.get("required", True)
        if not isinstance(required, bool):
            raise OpsError("VALIDATION_ERROR", f"第 {index} 题的必填设置不正确。", 422)
        options = item.get("options")
        if not isinstance(options, list) or not options:
            raise OpsError("VALIDATION_ERROR", f"第 {index} 题至少需要 1 个选项。", 422)
        if len(options) > MAX_OPTIONS:
            raise OpsError("VALIDATION_ERROR", f"第 {index} 题最多 {MAX_OPTIONS} 个选项。", 422)
        clean_options = []
        labels = set()
        for oi, option in enumerate(options, 1):
            if not isinstance(option, dict):
                raise OpsError("VALIDATION_ERROR", f"第 {index} 题第 {oi} 个选项格式不正确。", 422)
            label = _text(
                option.get("label", ""),
                200,
                f"questions.{index}.options.{oi}",
                f"第 {index} 题第 {oi} 个选项文字",
            )
            if not label:
                raise OpsError(
                    "VALIDATION_ERROR",
                    f"第 {index} 题第 {oi} 个选项还没有填写文字。",
                    422,
                    [{"field": f"questions.{index}.options.{oi}"}],
                )
            if label in labels:
                raise OpsError(
                    "VALIDATION_ERROR",
                    f"第 {index} 题有重复的选项文字“{label}”。",
                    422,
                    [{"field": f"questions.{index}.options.{oi}"}],
                )
            labels.add(label)
            code = option.get("code")
            code = code.strip() if isinstance(code, str) and code.strip() else f"O{oi}"
            clean_options.append({"code": code, "label": label})
        if qtype == "single_choice":
            min_choices = max_choices = 1
        else:
            try:
                min_choices = int(item.get("min_choices", 1))
                max_choices = int(item.get("max_choices", len(clean_options)))
            except TypeError, ValueError:
                raise OpsError(
                    "VALIDATION_ERROR", f"第 {index} 题的选择数量不是整数。", 422
                ) from None
            if min_choices < 1 or max_choices < min_choices:
                raise OpsError(
                    "VALIDATION_ERROR",
                    f"第 {index} 题的最少选择数不能小于 1，且不能大于最多选择数。",
                    422,
                )
            if max_choices > len(clean_options):
                raise OpsError(
                    "VALIDATION_ERROR",
                    f"第 {index} 题最多选择数不能超过选项数量（{len(clean_options)}）。",
                    422,
                )
        code = item.get("code")
        code = code.strip() if isinstance(code, str) and code.strip() else f"Q{index}"
        while code in used:
            code = f"{code}x"
        used.add(code)
        questions.append(
            {
                "code": code,
                "type": qtype,
                "title": title,
                "required": required,
                "min_choices": min_choices,
                "max_choices": max_choices,
                "options": clean_options,
            }
        )
    return questions


def normalize_activity_content(raw):
    """活动内容：材料、目标、备选方案、可展示风格与步骤。"""
    if not isinstance(raw, dict):
        raise OpsError("VALIDATION_ERROR", "活动内容格式不正确，请刷新页面后重试。", 422)
    materials = _text(raw.get("materials", ""), 2000, "content.materials", "材料说明")
    goal = _text(raw.get("goal", ""), 2000, "content.goal", "活动目标")
    alternative = _text(raw.get("alternative", ""), 2000, "content.alternative", "备选方案")
    styles = raw.get("allowed_styles")
    allowed = ["cognitive", "emotional", "creative", "exploratory"]
    if not isinstance(styles, list) or any(s not in allowed for s in styles):
        raise OpsError("VALIDATION_ERROR", "可展示风格选择不正确。", 422)
    styles = [s for s in allowed if s in styles]
    raw_steps = raw.get("steps")
    if not isinstance(raw_steps, list):
        raise OpsError("VALIDATION_ERROR", "步骤数据格式不正确。", 422)
    if len(raw_steps) > 30:
        raise OpsError("VALIDATION_ERROR", "单个活动最多 30 个步骤。", 422)
    steps = []
    for index, step in enumerate(raw_steps):
        if not isinstance(step, dict):
            raise OpsError("VALIDATION_ERROR", f"第 {index + 1} 个步骤格式不正确。", 422)
        instruction = _text(
            step.get("instruction", ""),
            1000,
            f"content.steps.{index}.instruction",
            f"第 {index + 1} 步的家长指引",
        )
        guide_text = _text(
            step.get("guide_text", ""),
            1000,
            f"content.steps.{index}.guide_text",
            f"第 {index + 1} 步的引导语",
        )
        steps.append({"index": index, "instruction": instruction, "guide_text": guide_text})
    return {
        "materials": materials,
        "goal": goal,
        "alternative": alternative,
        "allowed_styles": styles,
        "steps": steps,
    }


# --------------------------------------------------------------------------- 题库


def _questionnaire_row(version_id):
    return get_object_or_404(QuestionnaireVersion, pk=version_id)


def _content_payload(row):
    return {
        "id": str(row.pk),
        "code": row.code,
        "version": row.version,
        "title": row.title,
        "description": row.description,
        "purpose": row.purpose,
        "status": row.status,
        "questions": row.questions,
        "updated_at": row.updated_at.isoformat(),
    }


def content_problems(row):
    """发布前的可读检查清单；真正发布仍由服务端统一校验。"""
    problems = []
    if isinstance(row, QuestionnaireVersion):
        bounds = PURPOSE_RANGE.get(row.purpose)
        count = len(row.questions or [])
        if not row.title.strip():
            problems.append("题库名称不能为空。")
        if not row.description.strip():
            problems.append("给家长的用途说明不能为空。")
        if not bounds:
            problems.append("用途不在当前支持范围内。")
        elif not bounds[0] <= count <= bounds[1]:
            problems.append(
                f"“{row.get_purpose_display()}”需要 {bounds[0]}–{bounds[1]} 题，当前 {count} 题。"
            )
        for index, question in enumerate(row.questions or [], 1):
            if not isinstance(question, dict):
                problems.append(f"第 {index} 题数据异常。")
                continue
            if len(question.get("options", [])) < 2:
                problems.append(f"第 {index} 题至少需要 2 个选项才能发布。")
            for option in question.get("options", []):
                if not str(option.get("label", "")).strip():
                    problems.append(f"第 {index} 题存在空选项文字。")
    else:
        content = row.content or {}
        if row.duration_minutes < 1:
            problems.append("活动时长必须大于 0 分钟。")
        if not content.get("steps"):
            problems.append("活动至少需要 1 个步骤。")
        if not content.get("allowed_styles"):
            problems.append("请至少选择一种可展示风格。")
        if not str(content.get("goal", "")).strip():
            problems.append("活动目标不能为空。")
        for index, step in enumerate(content.get("steps", []), 1):
            if not str(step.get("instruction", "")).strip():
                problems.append(f"第 {index} 步还没有填写家长指引。")
    return problems


@ops_action("questionnaire.view")
def questionnaire_check(request, data, version_id):
    """题库发布前检查：只读，返回运营能看懂的问题清单。"""
    from dingdong_ca.core.api.common import ApiError
    from dingdong_ca.core.api.staff import validate_content

    row = get_object_or_404(QuestionnaireVersion, pk=version_id)
    problems = content_problems(row)
    try:
        validate_content(row)
    except ApiError as exc:
        if not problems:
            problems.append(
                getattr(exc, "message", "") or "内容不符合当前题库规范，请检查题干与选项。"
            )
    return json_ok({"problems": problems, "publishable": not problems})


@ops_action("questionnaire.edit")
def questionnaire_create(request, data):
    code = _text(data.get("code", ""), 64, "code", "题库标识")
    version = _text(data.get("version", ""), 32, "version", "版本号")
    title = _text(data.get("title", ""), 160, "title", "题库名称")
    purpose = data.get("purpose")
    if purpose not in PURPOSE_RANGE:
        raise OpsError("VALIDATION_ERROR", "请选择题库用途。", 422)
    if not code or not version or not title:
        raise OpsError("VALIDATION_ERROR", "题库标识、版本号和名称都需要填写。", 422)
    if QuestionnaireVersion.objects.filter(code=code, version=version).exists():
        raise OpsError("STATE_CONFLICT", "相同题库标识和版本号已存在，请换一个版本号。", 409)
    description = _text(data.get("description", ""), 2000, "description", "给家长的用途说明")
    with transaction.atomic():
        row = QuestionnaireVersion.objects.create(
            code=code,
            version=version,
            title=title,
            purpose=purpose,
            description=description,
            data_origin="synthetic",
            schema_version="questionnaire-v1",
            questions=[],
            status="draft",
        )
        ops_audit(
            request.user,
            "questionnaire.copy" if data.get("from_copy") else "questionnaire.create",
            row,
            f"{row.title} · {row.version}",
            {"purpose": purpose},
        )
    return json_ok({"questionnaire": _content_payload(row)}, status=201)


@ops_action("questionnaire.edit")
def questionnaire_save(request, data, version_id):
    title = _text(data.get("title", ""), 160, "title", "题库名称")
    description = _text(data.get("description", ""), 2000, "description", "给家长的用途说明")
    with transaction.atomic():
        row = QuestionnaireVersion.objects.select_for_update().get(pk=version_id)
        if row.status != "draft":
            raise OpsError(
                "STATE_CONFLICT",
                "已发布或已停用的题库不能直接修改。请先复制为新版本再编辑。",
                409,
            )
        questions = normalize_questions(data.get("questions", []), row.purpose)
        row.title = title or row.title
        row.description = description
        row.questions = questions
        row.save()
        ops_audit(
            request.user,
            "questionnaire.save",
            row,
            f"{row.title} · {row.version}",
            {"questions": len(questions)},
        )
    return json_ok({"questionnaire": _content_payload(row)})


@ops_action("questionnaire.edit")
def questionnaire_copy(request, data, version_id):
    with transaction.atomic():
        source = QuestionnaireVersion.objects.select_for_update().get(pk=version_id)
        version = _text(data.get("version", ""), 32, "version", "新版本号")
        version = version or "copy-" + uuid.uuid4().hex[:12]
        if QuestionnaireVersion.objects.filter(code=source.code, version=version).exists():
            raise OpsError("STATE_CONFLICT", "该版本号已存在，请换一个。", 409)
        new = QuestionnaireVersion.objects.create(
            code=source.code,
            version=version,
            title=_text(data.get("title", source.title), 160, "title", "题库名称") or source.title,
            purpose=source.purpose,
            description=source.description,
            data_origin=source.data_origin,
            schema_version=source.schema_version,
            questions=copy.deepcopy(source.questions),
            status="draft",
        )
        ops_audit(
            request.user,
            "questionnaire.copy",
            new,
            f"{new.title} · {new.version}",
            {"from": f"{source.version}（{L.CONTENT_STATUS.get(source.status, source.status)}）"},
        )
    return json_ok({"id": str(new.pk), "redirect": f"/ops/questionnaires/{new.pk}/"}, status=201)


@ops_action("questionnaire.edit")
def questionnaire_retire(request, data, version_id):
    with transaction.atomic():
        row = QuestionnaireVersion.objects.select_for_update().get(pk=version_id)
        if row.status == "retired":
            return json_ok({"status": row.status, "already": True})
        was_published = row.status == "published"
        row.status = "retired"
        row.save()
        ops_audit(
            request.user,
            "questionnaire.retire",
            row,
            f"{row.title} · {row.version}",
            {"was_published": was_published},
        )
    return json_ok({"status": row.status})


# --------------------------------------------------------------------------- 活动


def _activity_payload(row):
    return {
        "id": str(row.pk),
        "code": row.code,
        "version": row.version,
        "title": row.title,
        "island": row.island,
        "mood": row.mood,
        "duration_minutes": row.duration_minutes,
        "status": row.status,
        "content": row.content,
        "updated_at": row.updated_at.isoformat(),
    }


@ops_action("activity.view")
def activity_check(request, data, version_id):
    """活动发布前检查：只读。"""
    from dingdong_ca.core.api.common import ApiError
    from dingdong_ca.core.api.staff import validate_content

    row = get_object_or_404(ActivityContentVersion, pk=version_id)
    problems = content_problems(row)
    try:
        validate_content(row)
    except ApiError:
        if not problems:
            problems.append("内容不符合当前测试协议，请检查材料、步骤和展示风格。")
    return json_ok({"problems": problems, "publishable": not problems})


@ops_action("activity.edit")
def activity_create(request, data):
    code = _text(data.get("code", ""), 64, "code", "活动标识")
    version = _text(data.get("version", ""), 32, "version", "版本号")
    title = _text(data.get("title", ""), 120, "title", "活动标题")
    if not code or not version or not title:
        raise OpsError("VALIDATION_ERROR", "活动标识、版本号和标题都需要填写。", 422)
    if ActivityContentVersion.objects.filter(code=code, version=version).exists():
        raise OpsError("STATE_CONFLICT", "相同活动标识和版本号已存在，请换一个版本号。", 409)
    with transaction.atomic():
        row = ActivityContentVersion.objects.create(
            code=code,
            version=version,
            title=title,
            island=_text(data.get("island", ""), 32, "island", "岛屿") or "未设置",
            mood=_text(data.get("mood", ""), 32, "mood", "情绪") or "未设置",
            duration_minutes=_positive_int(data.get("duration_minutes"), "活动时长"),
            content={
                "materials": "",
                "goal": "",
                "alternative": "",
                "allowed_styles": [],
                "steps": [],
            },
            status="draft",
            data_origin="synthetic",
        )
        ops_audit(request.user, "activity.create", row, f"{row.title} · {row.version}")
    return json_ok({"activity": _activity_payload(row)}, status=201)


def _positive_int(value, label):
    try:
        number = int(value)
    except TypeError, ValueError:
        raise OpsError("VALIDATION_ERROR", f"{label}需要填写整数分钟数。", 422) from None
    if not 1 <= number <= 600:
        raise OpsError("VALIDATION_ERROR", f"{label}需要在 1–600 分钟之间。", 422)
    return number


@ops_action("activity.edit")
def activity_save(request, data, version_id):
    with transaction.atomic():
        row = ActivityContentVersion.objects.select_for_update().get(pk=version_id)
        if row.status != "draft":
            raise OpsError(
                "STATE_CONFLICT",
                "已发布或已停用的活动不能直接修改，请先复制为新版本。",
                409,
            )
        row.title = _text(data.get("title", ""), 120, "title", "活动标题") or row.title
        row.island = _text(data.get("island", ""), 32, "island", "岛屿") or row.island
        row.mood = _text(data.get("mood", ""), 32, "mood", "情绪") or row.mood
        row.duration_minutes = _positive_int(data.get("duration_minutes"), "活动时长")
        row.content = normalize_activity_content(data.get("content", {}))
        row.save()
        ops_audit(
            request.user,
            "activity.save",
            row,
            f"{row.title} · {row.version}",
            {"steps": len(row.content["steps"])},
        )
    return json_ok({"activity": _activity_payload(row)})


@ops_action("activity.edit")
def activity_copy(request, data, version_id):
    with transaction.atomic():
        source = ActivityContentVersion.objects.select_for_update().get(pk=version_id)
        version = _text(data.get("version", ""), 32, "version", "新版本号")
        version = version or "copy-" + uuid.uuid4().hex[:12]
        if ActivityContentVersion.objects.filter(code=source.code, version=version).exists():
            raise OpsError("STATE_CONFLICT", "该版本号已存在，请换一个。", 409)
        new = ActivityContentVersion.objects.create(
            code=source.code,
            version=version,
            title=_text(data.get("title", source.title), 120, "title", "活动标题") or source.title,
            island=source.island,
            mood=source.mood,
            duration_minutes=source.duration_minutes,
            content=copy.deepcopy(source.content),
            status="draft",
            data_origin=source.data_origin,
        )
        ops_audit(
            request.user,
            "activity.copy",
            new,
            f"{new.title} · {new.version}",
            {"from": f"{source.version}（{L.CONTENT_STATUS.get(source.status, source.status)}）"},
        )
    return json_ok({"id": str(new.pk), "redirect": f"/ops/activities/{new.pk}/"}, status=201)


@ops_action("activity.edit")
def activity_retire(request, data, version_id):
    with transaction.atomic():
        row = ActivityContentVersion.objects.select_for_update().get(pk=version_id)
        if row.status == "retired":
            return json_ok({"status": row.status, "already": True})
        in_progress = row.activityrecord_set.filter(status="active").count()
        was_published = row.status == "published"
        row.status = "retired"
        row.save()
        ops_audit(
            request.user,
            "activity.retire",
            row,
            f"{row.title} · {row.version}",
            {"was_published": was_published, "active_records": in_progress},
        )
    return json_ok({"status": row.status, "active_records": in_progress})


# --------------------------------------------------------------------------- 家庭与儿童


def _family_label(family):
    """家庭在审计与界面上的展示名：家长称呼 + 手机号后四位。

    家庭本身没有名字，直接写 UUID 运营看不懂，也不方便对着电话核对。
    """
    from dingdong_ca.core.models import FamilyMembership

    member = (
        FamilyMembership.objects.select_related("user")
        .filter(family=family, ended_at__isnull=True)
        .first()
    )
    if member is None:
        return f"家庭 编号 {str(family.pk)[:8]}"
    user = member.user
    name = getattr(user, "name", "") or getattr(user, "username", "") or "未登记家长"
    phone = getattr(user, "phone", "") or ""
    return f"{name} 的家庭（尾号 {phone[-4:]}）" if len(phone) >= 4 else f"{name} 的家庭"


@ops_action("family.edit")
def family_status(request, data, family_id):
    target = data.get("status")
    if target not in ("active", "frozen"):
        raise OpsError("VALIDATION_ERROR", "只能设置为正常或已冻结。", 422)
    with transaction.atomic():
        family = Family.objects.select_for_update().get(pk=family_id)
        if family.status == target:
            return json_ok({"status": family.status, "already": True})
        if family.status == "closed":
            raise OpsError("STATE_CONFLICT", "已关闭的家庭不能在此修改。", 409)
        family.status = target
        family.save(update_fields=["status", "updated_at"])
        ops_audit(
            request.user,
            "family.freeze" if target == "frozen" else "family.restore",
            family,
            _family_label(family),
            {"children": family.child_set.count()},
        )
    return json_ok({"status": family.status})


@ops_action("child.edit")
def child_profile(request, data, child_id):
    from django.core.exceptions import ValidationError as DjangoValidationError
    from django.utils.dateparse import parse_date

    name = _text(data.get("name", ""), 80, "name", "儿童称呼")
    if not name:
        raise OpsError("VALIDATION_ERROR", "儿童称呼不能为空。", 422)
    gender = data.get("gender", "unknown")
    if gender not in ("unknown", "male", "female"):
        raise OpsError("VALIDATION_ERROR", "性别取值不正确。", 422)
    raw_birth = (data.get("birth_date") or "").strip()
    birth_date = None
    if raw_birth:
        try:
            birth_date = parse_date(raw_birth)
        except ValueError:
            birth_date = None
    if raw_birth and birth_date is None:
        raise OpsError("VALIDATION_ERROR", "生日格式不正确，请使用 2000-01-01 形式。", 422)
    with transaction.atomic():
        child = Child.objects.select_for_update().get(pk=child_id)
        before = {"name": child.name, "gender": child.gender, "birth_date": str(child.birth_date)}
        child.name = name
        child.gender = gender
        child.birth_date = birth_date
        try:
            child.full_clean(exclude=["create_payload", "create_request_key"])
        except DjangoValidationError as exc:
            messages = [m for msgs in exc.message_dict.values() for m in msgs]
            raise OpsError(
                "VALIDATION_ERROR", "；".join(messages) or "档案信息不合法。", 422
            ) from None
        child.save()
        ops_audit(
            request.user,
            "child.profile_update",
            child,
            child.name,
            {
                "before": before,
                "after": {"name": name, "gender": gender, "birth_date": str(birth_date)},
            },
        )
    return json_ok(
        {"name": child.name, "gender": child.gender, "birth_date": str(child.birth_date or "")}
    )


__all__ = ["content_problems", "ops_action"]
