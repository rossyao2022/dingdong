"""运营后台的 JSON 动作接口。

设计原则：
- 只新增"运营确实需要、现有接口没有"的动作；发布、重试、事项处理直接复用
  /api/v1/staff/* 的同一套实现，避免两份业务规则。
- 每个动作都在服务端重新判断角色，并写审计。
- 草稿保存宽松（允许未完成的编辑），发布严格（复用 core 的发布校验）。
"""

import copy
import hashlib
import re
import uuid
from functools import wraps

from django.core.exceptions import ObjectDoesNotExist
from django.db import connection, transaction
from django.http import Http404
from django.shortcuts import get_object_or_404
from django.utils.text import slugify
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


# --------------------------------------------------------------------------- 并发控制


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
                return json_error(exc.code, exc.message, exc.status, exc.fields, extra=exc.extra)
            except (Http404, ObjectDoesNotExist):
                return json_error("NOT_FOUND", "记录不存在或已被删除。", 404)

        handler.authentication_classes = [SessionAuthentication]
        handler.parser_classes = [JSONParser, FormParser, MultiPartParser]
        return api_view(["POST"])(handler)

    return decorate


def expected_revision(data, label):
    """读取并校验客户端携带的修订号。

    修订号是"我这次编辑基于哪一版"的声明。缺失或不合法时明确要求刷新页面，
    而不是当作"没有冲突"放行——那正是旧页面静默覆盖别人修改的成因。
    """
    raw = data.get("revision")
    if isinstance(raw, bool) or raw is None:
        number = None
    elif isinstance(raw, int):
        number = raw
    elif isinstance(raw, str) and raw.strip().isdigit():
        number = int(raw.strip())
    else:
        number = None
    if number is None or number < 1:
        raise OpsError(
            "VALIDATION_ERROR",
            f"没有收到{label}的修订号，无法确认你打开的是最新版本。"
            "请刷新页面后重新编辑，避免覆盖其他人的修改。",
            422,
            [{"field": "revision"}],
        )
    return number


def edit_conflict(row, payload, label):
    """过期编辑：返回 409 与服务端当前内容，前端据此对比后重新编辑。"""
    return OpsError(
        "EDIT_CONFLICT",
        f"这份{label}在你编辑期间已被其他人保存过，为避免覆盖对方的修改，本次没有保存。"
        "你的输入仍然保留在页面上：可以先对比差异，再决定加载最新版本或用你的修改覆盖。",
        409,
        [{"field": "revision"}],
        extra={"current": payload},
    )


def request_key(data):
    """新建请求幂等键：重复提交或重试不会产生第二份内容。"""
    raw = data.get("request_key")
    if not isinstance(raw, str) or not raw.strip():
        return None
    try:
        return uuid.UUID(raw.strip())
    except ValueError:
        raise OpsError("VALIDATION_ERROR", "提交标识格式不正确，请刷新页面后重试。", 422) from None


CODE_LIMIT = 48
CODE_DIGEST_LEN = 12


def _title_digest(title):
    return hashlib.sha1(title.strip().encode("utf-8")).hexdigest()[:CODE_DIGEST_LEN]


def _title_slug(title):
    return re.sub(r"-{2,}", "-", slugify(title, allow_unicode=False)).strip("-")


def _fit_code(prefix, slug, tail):
    """拼出不超过 CODE_LIMIT 的标识，并保证 tail（含标题摘要）不被截断。

    早期实现只在 slug 不足 3 个字符时才用摘要，长标题还会把摘要连同后缀一起截掉。
    结果是"ABC 观察"和"ABC 绘画"都退化成 `qn-abc`，被误当成同一份题库的两个版本，
    发布后一份会把另一份停用。摘要必须始终保留，slug 只在剩余空间里出现。
    """
    if slug:
        room = CODE_LIMIT - len(prefix) - 2 - len(tail)
        trimmed = slug[:room].strip("-") if room > 0 else ""
        if trimmed:
            return f"{prefix}-{trimmed}-{tail}"
    return f"{prefix}-{tail}"[:CODE_LIMIT]


def generated_code(title, prefix):
    """由业务名称推出可读的内部标识候选（不含重名去重后缀）。

    同一个标题总得到同一个候选；不同标题的候选一定不同，因为完整标题的摘要始终
    保留。这让运营不需要理解技术标识，也让"标题不同"永远不会变成"同一份内容"。
    """
    return _fit_code(prefix, _title_slug(title), _title_digest(title))


def unique_code(model, kind, prefix, title):
    """在内容咨询锁内取一个未被占用的标识。

    新建即独立内容：候选标识已被占用时（同标题被不同人各建一份，或历史遗留标识
    恰好相同），依次尝试 -2、-3…，而不是并入已有内容的版本序列。
    """
    slug = _title_slug(title)
    digest = _title_digest(title)
    code = generated_code(title, prefix)
    attempt = 1
    while True:
        # 先取锁再判断：并发创建会被串行化到同一把咨询锁上，
        # 后进来的那个一定看得到前一个刚提交的标识，不会先查后插留下竞争窗口。
        lock_code(kind, code)
        if not model.objects.filter(code=code).exists():
            return code
        attempt += 1
        code = _fit_code(prefix, slug, f"{digest}-{attempt}")


def next_version(model, code):
    """同一内容的下一个版本号：v1、v2……由系统递增，运营无需手工管理。"""
    used = set(model.objects.filter(code=code).values_list("version", flat=True))
    number = 1
    while f"v{number}" in used:
        number += 1
    return f"v{number}"


def lock_code(kind, code):
    """按内容标识取事务级咨询锁，保证并发创建/复制不会撞版本号。"""
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT pg_advisory_xact_lock(hashtextextended(%s,0))", [f"ops-content:{kind}:{code}"]
        )


def reusable(model, key):
    """幂等：同一请求键已经建过内容就直接返回，不再新建。"""
    if key is None:
        return None
    return model.objects.filter(create_request_key=key).first()


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
            except (TypeError, ValueError):
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
        "revision": row.revision,
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
    """新建题库草稿：运营只填业务名称、用途和说明，标识与版本由系统生成。

    可选 `code` / `version` 仅供脚本与测试显式指定；页面不提供这两个输入。
    """
    title = _text(data.get("title", ""), 160, "title", "题库名称")
    if not title:
        raise OpsError("VALIDATION_ERROR", "请填写题库名称。", 422, [{"field": "title"}])
    purpose = data.get("purpose")
    if purpose not in PURPOSE_RANGE:
        raise OpsError("VALIDATION_ERROR", "请选择题库用途。", 422, [{"field": "purpose"}])
    description = _text(data.get("description", ""), 2000, "description", "给家长的用途说明")
    key = request_key(data)
    explicit_code = _text(data.get("code", ""), 64, "code", "题库标识")
    explicit_version = _text(data.get("version", ""), 32, "version", "版本号")

    with transaction.atomic():
        reused = reusable(QuestionnaireVersion, key)
        if reused is not None:
            return json_ok({"questionnaire": _content_payload(reused), "reused": True})
        if explicit_code:
            code = explicit_code
            lock_code("questionnaire", code)
        else:
            # 新建永远是独立内容：标识由标题派生并保证唯一，不会并入已有题库的版本序列。
            # 要产出"同一题库的新版本"，请在版本页使用"复制为新版本"。
            code = unique_code(QuestionnaireVersion, "questionnaire", "qn", title)
        version = explicit_version or next_version(QuestionnaireVersion, code)
        if QuestionnaireVersion.objects.filter(code=code, version=version).exists():
            raise OpsError(
                "STATE_CONFLICT",
                f"该题库已经有版本 {version}，请直接打开已有版本或使用“复制为新版本”。",
                409,
            )
        is_new_version = QuestionnaireVersion.objects.filter(code=code).exists()
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
            create_request_key=key,
        )
        ops_audit(
            request.user,
            "questionnaire.copy" if data.get("from_copy") else "questionnaire.create",
            row,
            f"{row.title} · {row.version}",
            {"purpose": purpose, "code": row.code},
        )
        notice = (
            f"已按指定标识 {code} 创建了它的新版本 {row.version}。"
            if is_new_version
            else "草稿已创建，可以开始添加题目。"
        )
    return json_ok(
        {"questionnaire": _content_payload(row), "reused": False, "notice": notice}, status=201
    )


@ops_action("questionnaire.edit")
def questionnaire_save(request, data, version_id):
    title = _text(data.get("title", ""), 160, "title", "题库名称")
    description = _text(data.get("description", ""), 2000, "description", "给家长的用途说明")
    with transaction.atomic():
        row = QuestionnaireVersion.objects.select_for_update().get(pk=version_id)
        expected = expected_revision(data, "题库")
        if row.status != "draft":
            raise OpsError(
                "STATE_CONFLICT",
                "已发布或已停用的题库不能直接修改。请先复制为新版本再编辑。",
                409,
            )
        if row.revision != expected:
            raise edit_conflict(row, _content_payload(row), "题库")
        questions = normalize_questions(data.get("questions", []), row.purpose)
        row.title = title or row.title
        row.description = description
        row.questions = questions
        row.revision = expected + 1
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
    key = request_key(data)
    with transaction.atomic():
        reused = reusable(QuestionnaireVersion, key)
        if reused is not None:
            return json_ok(
                {
                    "id": str(reused.pk),
                    "redirect": f"/ops/questionnaires/{reused.pk}/",
                    "version": reused.version,
                    "reused": True,
                },
                status=201,
            )
        source = QuestionnaireVersion.objects.select_for_update().get(pk=version_id)
        lock_code("questionnaire", source.code)
        version = _text(data.get("version", ""), 32, "version", "新版本号")
        version = version or next_version(QuestionnaireVersion, source.code)
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
            create_request_key=key,
        )
        ops_audit(
            request.user,
            "questionnaire.copy",
            new,
            f"{new.title} · {new.version}",
            {"from": f"{source.version}（{L.CONTENT_STATUS.get(source.status, source.status)}）"},
        )
    return json_ok(
        {
            "id": str(new.pk),
            "redirect": f"/ops/questionnaires/{new.pk}/",
            "version": new.version,
            "reused": False,
        },
        status=201,
    )


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
        "revision": row.revision,
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
    """新建活动草稿：运营只填标题与内容，标识与版本由系统生成。"""
    title = _text(data.get("title", ""), 120, "title", "活动标题")
    if not title:
        raise OpsError("VALIDATION_ERROR", "请填写活动标题。", 422, [{"field": "title"}])
    key = request_key(data)
    explicit_code = _text(data.get("code", ""), 64, "code", "活动标识")
    explicit_version = _text(data.get("version", ""), 32, "version", "版本号")
    with transaction.atomic():
        reused = reusable(ActivityContentVersion, key)
        if reused is not None:
            return json_ok({"activity": _activity_payload(reused), "reused": True})
        if explicit_code:
            code = explicit_code
            lock_code("activity", code)
        else:
            # 与题库一致：新建永远是独立内容，只有"复制为新版本"才关联到已有活动。
            code = unique_code(ActivityContentVersion, "activity", "act", title)
        version = explicit_version or next_version(ActivityContentVersion, code)
        if ActivityContentVersion.objects.filter(code=code, version=version).exists():
            raise OpsError(
                "STATE_CONFLICT",
                f"该活动已经有版本 {version}，请直接打开已有版本或使用“复制为新版本”。",
                409,
            )
        is_new_version = ActivityContentVersion.objects.filter(code=code).exists()
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
            create_request_key=key,
        )
        ops_audit(request.user, "activity.create", row, f"{row.title} · {row.version}")
        notice = (
            f"已按指定标识 {code} 创建了它的新版本 {row.version}。"
            if is_new_version
            else "草稿已创建，可以开始维护步骤。"
        )
    return json_ok(
        {"activity": _activity_payload(row), "reused": False, "notice": notice}, status=201
    )


def _positive_int(value, label):
    try:
        number = int(value)
    except (TypeError, ValueError):
        raise OpsError("VALIDATION_ERROR", f"{label}需要填写整数分钟数。", 422) from None
    if not 1 <= number <= 600:
        raise OpsError("VALIDATION_ERROR", f"{label}需要在 1–600 分钟之间。", 422)
    return number


@ops_action("activity.edit")
def activity_save(request, data, version_id):
    with transaction.atomic():
        row = ActivityContentVersion.objects.select_for_update().get(pk=version_id)
        expected = expected_revision(data, "活动")
        if row.status != "draft":
            raise OpsError(
                "STATE_CONFLICT",
                "已发布或已停用的活动不能直接修改，请先复制为新版本。",
                409,
            )
        if row.revision != expected:
            raise edit_conflict(row, _activity_payload(row), "活动")
        row.title = _text(data.get("title", ""), 120, "title", "活动标题") or row.title
        row.island = _text(data.get("island", ""), 32, "island", "岛屿") or row.island
        row.mood = _text(data.get("mood", ""), 32, "mood", "情绪") or row.mood
        row.duration_minutes = _positive_int(data.get("duration_minutes"), "活动时长")
        row.content = normalize_activity_content(data.get("content", {}))
        row.revision = expected + 1
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
    key = request_key(data)
    with transaction.atomic():
        reused = reusable(ActivityContentVersion, key)
        if reused is not None:
            return json_ok(
                {
                    "id": str(reused.pk),
                    "redirect": f"/ops/activities/{reused.pk}/",
                    "version": reused.version,
                    "reused": True,
                },
                status=201,
            )
        source = ActivityContentVersion.objects.select_for_update().get(pk=version_id)
        lock_code("activity", source.code)
        version = _text(data.get("version", ""), 32, "version", "新版本号")
        version = version or next_version(ActivityContentVersion, source.code)
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
            create_request_key=key,
        )
        ops_audit(
            request.user,
            "activity.copy",
            new,
            f"{new.title} · {new.version}",
            {"from": f"{source.version}（{L.CONTENT_STATUS.get(source.status, source.status)}）"},
        )
    return json_ok(
        {
            "id": str(new.pk),
            "redirect": f"/ops/activities/{new.pk}/",
            "version": new.version,
            "reused": False,
        },
        status=201,
    )


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
    expected = (data.get("expected_status") or "").strip()
    with transaction.atomic():
        family = Family.objects.select_for_update().get(pk=family_id)
        if expected and expected != family.status:
            # 页面渲染之后别人已经改过状态：按新的状态重新判断，不盲目执行旧意图。
            raise OpsError(
                "EDIT_CONFLICT",
                "该家庭的状态刚刚已被其他人修改，本次没有执行。请刷新页面确认最新状态后再操作。",
                409,
                extra={
                    "current": {
                        "status": family.status,
                        "label": L.FAMILY_STATUS.get(family.status, family.status),
                    }
                },
            )
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
    return json_ok({"status": family.status, "label": L.FAMILY_STATUS.get(family.status, "")})


@ops_action("child.edit")
def child_profile(request, data, child_id):
    from django.core.exceptions import ValidationError as DjangoValidationError
    from django.utils.dateparse import parse_date

    expected = None
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
        expected = expected_revision(data, "儿童档案")
        if child.revision != expected:
            raise OpsError(
                "EDIT_CONFLICT",
                "这份儿童档案在你编辑期间已被更正过（可能是家长在家长端改的，也可能是另一位同事）。"
                "为避免覆盖对方的修改，本次没有保存。你填写的内容仍保留在弹窗中："
                "可以先看一下最新档案，再决定是否重新提交。",
                409,
                [{"field": "revision"}],
                extra={"current": _child_payload(child)},
            )
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
        child.revision = expected + 1
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
    return json_ok(_child_payload(child))


def _child_payload(child):
    return {
        "name": child.name,
        "gender": child.gender,
        "gender_label": L.GENDER.get(child.gender, child.gender),
        "birth_date": str(child.birth_date or ""),
        "revision": child.revision,
        "updated_at": child.updated_at.isoformat(),
    }


__all__ = ["content_problems", "ops_action"]
