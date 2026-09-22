"""运营可见的中文业务语言。

数据库里的英文代码只在内部使用；运营界面一律显示这里的说明，
并给出"下一步该怎么办"的可执行提示，避免运营去猜代码含义。
"""

FAMILY_STATUS = {
    "active": "正常",
    "frozen": "已冻结",
    "closed": "已关闭",
}

CHILD_STATUS = {
    "active": "正常",
    "archived": "已归档",
}

GENDER = {
    "unknown": "未填写",
    "male": "男孩",
    "female": "女孩",
}

QUESTIONNAIRE_PURPOSE = {
    "exploration": "探索体验",
    "assessment": "测评流程（测试）",
}

CONTENT_STATUS = {
    "draft": "草稿",
    "published": "已发布",
    "retired": "已停用",
}

DATA_ORIGIN = {
    "synthetic": "测试数据",
    "live": "真实数据",
}

QUESTION_TYPE = {
    "single_choice": "单选",
    "multiple_choice": "多选",
}

ACTIVITY_STYLE = {
    "cognitive": "认知",
    "emotional": "情绪",
    "creative": "创造",
    "exploratory": "探索",
}

# 岛屿与情绪是运营自由填写的标签（模型里是 CharField，不是 choices），
# 这里的词表只覆盖已知取值，未命中的原样显示——见 ops_labels.known_label。
# 取值与家长端的叫法对齐（`frontend/app.js` 的 islands / moods）。
ACTIVITY_ISLAND = {
    "science": "科学发现",
    "story": "故事表达",
    "nature": "自然观察",
    "imagination": "创意想象",
}

ACTIVITY_MOOD = {
    "energy": "能量满满",
    "focus": "正在专注",
    "inspire": "需要启发",
    "calm": "平静如水",
}

# 家庭角色。模型约束里目前只有 owner 一个取值（`family_membership` 的
# membership_role_owner），模板直接渲染会显示英文 `owner`。
FAMILY_ROLE = {
    "owner": "主要家长",
}

ACTIVITY_RECORD_STATUS = {
    "active": "进行中",
    "completed": "已完成",
    "skipped": "已跳过",
}

ASSESSMENT_STATUS = {
    "draft": "草稿",
    "ready": "已就绪",
    "processing": "处理中",
    "needs_recapture": "需重新采集",
    "result_unknown": "结果未知",
    "completed": "已完成",
    "cancelled": "已取消",
    "expired": "已过期",
}

PROFILE_KIND = {
    "initial": "初始画像",
    "stage": "阶段画像",
}

ASSOCIATION_STATUS = {
    "verified": "已核验",
    "revoked": "已撤回",
}

CHECKPOINT_STATUS = {
    "enabled": "同步中",
    "paused": "已暂停",
}

# CA 账户：本地占用状态与「与对方的绑定状态」是两件事，不要合成一个词
CA_ACCOUNT_STATUS = {
    "active": "使用中",
    "retired": "已归档",
}

CA_ACCOUNT_BIND_STATE = {
    "unbound": "待接通",
    "bound": "已绑定",
}

SERVICE_KIND = {
    "support": "家长求助",
    "deletion": "数据删除申请",
    "correction": "资料更正申请",
}

SERVICE_REASON = {
    "support_needed": "家长需要人工支持",
    "delete_child_data": "家长要求删除儿童数据",
    "correct_profile": "家长要求更正档案信息",
}

SERVICE_STATUS = {
    "open": "待处理",
    "processing": "处理中",
    "completed": "已完成",
    "cancelled": "已取消",
}

SERVICE_RESOLUTION = {
    "resolved": "已人工处理",
    "cancelled": "已取消",
    "deleted": "数据已删除",
}

JOB_STATUS = {
    "pending": "排队中",
    "running": "处理中",
    "waiting": "等待依赖",
    "unknown": "状态不明",
    "succeeded": "已完成",
    "failed": "失败",
    "cancelled": "已停止",
}

JOB_KIND = {
    "report": "报告生成",
    "stage_profile": "阶段画像生成",
    "sync": "数据同步",
}

CONSENT_PURPOSE = {
    "assessment_processing": "测评数据处理",
    "dingdong_sync": "伙伴数据同步",
}

# 失败原因：给运营一句人话 + 一句下一步动作。
JOB_ERROR = {
    "RENDER_FAILED": (
        "报告内容生成失败",
        "系统在拼装报告内容时出错。该问题通常是临时的，可由技术运维在报告详情页重试。",
        True,
    ),
    "TEMPLATE_MISSING": (
        "缺少已发布的报告模板",
        "需要内容运营先发布对应报告模板，任务会自动继续。",
        False,
    ),
    "RULE_MISSING": (
        "缺少已发布的阶段规则",
        "需要内容运营先发布阶段规则版本，任务会自动继续。",
        False,
    ),
    "CONSENT_REVOKED_OR_PAUSED": (
        "家长已撤回授权或同步已暂停",
        "任务已按合规要求停止，不会自动重试。如需恢复，请先由家长重新授权。",
        False,
    ),
    "LEASE_EXPIRED": (
        "任务执行超时",
        "任务超过约定处理时间被系统回收。可由技术运维重试。",
        True,
    ),
    "INPUT_SCHEMA_INVALID": (
        "输入数据不符合约定格式",
        "需要人工检查数据来源，不能直接重试。",
        False,
    ),
    "SOURCE_CONFLICT": (
        "数据来源冲突",
        "同一批数据出现互相矛盾的内容，需要人工核对后再处理。",
        False,
    ),
    "WINDOW_CONFLICT": (
        "观察时间窗口冲突",
        "数据时间范围与已有记录冲突，需要人工核对。",
        False,
    ),
    "UPSTREAM_SCHEMA_INVALID": (
        "上游数据结构不符合约定",
        "需要人工检查对接数据结构，不能直接重试。",
        False,
    ),
    "RULE_INVALID": (
        "规则配置不合法",
        "需要修正规则内容并重新发布，不能直接重试。",
        False,
    ),
    "FIXTURE_INVALID": (
        "测试数据配置不合法",
        "当前是演示环境，测试数据本身有误，需要重新注入。",
        False,
    ),
    "UPSTREAM_TIMEOUT": (
        "上游处理超时",
        "外部处理未在约定时间内返回，可稍后重试。",
        True,
    ),
    "JOB_KIND_INVALID": (
        "任务类型无法识别",
        "需要技术运维人工检查。",
        False,
    ),
}

ERROR_ACTION = {
    "AUTH_REQUIRED": "登录已失效，请重新登录。",
    "LOGIN_REVOKED": "登录已失效，请重新登录。",
    "PERMISSION_DENIED": "当前账号没有执行该操作的权限。",
    "VALIDATION_ERROR": "填写内容不符合要求，请检查标红字段。",
    "INVALID_JSON": "提交的数据格式不正确，请刷新页面后重试。",
    "STATE_CONFLICT": "记录状态已变化，请刷新后按最新状态处理。",
    "NOT_FOUND": "记录不存在或已被删除。",
    "CONSENT_REQUIRED": "家长授权已撤回，无法继续该操作。",
    "DEPENDENCY_NOT_READY": "依赖内容尚未就绪，暂时无法执行。",
    "CONTENT_INVALID": "内容不符合当前测试协议，请按提示修改后再发布。",
    "RATE_LIMITED": "操作过于频繁，请稍后再试。",
    "METHOD_NOT_ALLOWED": "该操作不被支持，请刷新页面后重试。",
}

AUDIT_ACTION = {
    # 运营后台自己的动作
    "content.publish": "发布内容版本",
    "questionnaire.create": "新建题库草稿",
    "questionnaire.save": "保存题库草稿",
    "questionnaire.copy": "复制题库版本",
    "questionnaire.retire": "停用题库版本",
    "activity.create": "新建活动草稿",
    "activity.save": "保存活动草稿",
    "activity.copy": "复制活动版本",
    "activity.retire": "停用活动版本",
    "job.retry": "重试失败任务",
    "report.retry": "重试报告生成",
    "data_request.resolve": "确认服务事项已处理",
    "data_request.cancel": "取消服务事项",
    "data_request.execute_deletion": "执行儿童数据删除",
    "data_request.note": "记录服务事项说明",
    "staff.roles": "调整工作人员角色",
    "staff.status": "启用或停用工作人员",
    "staff.create": "新建工作人员账号",
    "staff.password_reset": "重置工作人员密码",
    "staff.password_change": "修改本人密码",
    "association.pause": "暂停数据同步",
    "association.resume": "恢复数据同步",
    "family.freeze": "冻结家庭",
    "family.restore": "恢复家庭",
    "child.profile_update": "更新儿童档案",
    "account.login": "登录运营后台",
    "account.logout": "退出运营后台",
    # 家长端动作：运营在审计里也要看得懂，不能显示英文代码
    "auth.login": "家长登录",
    "auth.logout": "家长退出",
    "child.create": "家长新增儿童档案",
    "child.update": "家长修改儿童档案",
    "consent.grant": "家长同意授权",
    "consent.revoke": "家长撤回授权",
    "assessment.create": "家长开始答题",
    "assessment.submit": "家长提交答卷",
    "assessment.cancel": "家长放弃答题",
    "exploration.complete": "家长完成探索体验",
    "activity.start": "家长开始活动",
    "association.verify": "核验伙伴关联",
    "association.revoke": "撤回伙伴关联",
    # CA 对接：家长绑机器人时建号，换机时归档旧号
    "ca_account.create": "建立 CA 账户",
    "ca_account.retire": "归档 CA 账户",
    # 复测回写：家长对复测建议的选择与承接复测的完成
    "ca_reassessment.response": "家长回应复测建议",
    "ca_reassessment.complete": "家长完成复测回写",
    # 运维：按报告清单清理注入的合成测试批次（只改状态，不物理删除）
    "synthetic.dispose": "清理合成测试数据",
}

# 审计 detail 里的字段名 -> 运营看得懂的说法
DETAIL_KEY = {
    "purpose": "用途",
    "questions": "题目数量",
    "from": "复制来源",
    "was_published": "原状态为已发布",
    "steps": "步骤数量",
    "active_records": "进行中的活动记录",
    "children": "儿童数量",
    "before": "修改前",
    "after": "修改后",
    "note": "处理说明",
    "reason": "原因",
    "result": "处理结果",
    "roles": "角色",
    "status": "状态",
    "name": "称呼",
    "gender": "性别",
    "birth_date": "生日",
    "code": "编号",
    "kind": "类型",
    "count": "数量",
    "resolution_code": "处理结果",
    "source": "来源",
    "version": "版本",
}

# detail 里的取值 -> 中文（与取值本身同形的通用词）
DETAIL_VALUE = {
    True: "是",
    False: "否",
    "exploration": "探索体验",
    "assessment": "测评流程",
    "draft": "草稿",
    "published": "已发布",
    "retired": "已停用",
    "unknown": "未填写",
    "male": "男孩",
    "female": "女孩",
    "None": "未填写",
    "": "未填写",
    "questionnaires": "题库",
    "activities": "活动",
    "rules": "规则",
    "resolved": "已处理",
    "deleted": "已删除",
    "corrected": "已更正",
    "open": "待处理",
    "processing": "处理中",
    "completed": "已完成",
}

TARGET_KIND = {
    "questionnaire_version": "题库版本",
    "activity_content_version": "活动版本",
    "report_template_version": "报告模板",
    "rule_version": "规则版本",
    "background_job": "后台任务",
    "data_request": "服务事项",
    "app_user": "工作人员账号",
    "family": "家庭",
    "child": "儿童档案",
    "external_association": "伙伴关联",
    "policy_version": "政策版本",
    "report_version": "报告",
    "assessment_session": "答卷",
    "consent_grant": "授权记录",
    "activity_record": "活动记录",
    "profile_snapshot": "画像快照",
    "ca_account": "CA 账户",
    "ca_reassessment_event": "复测事件",
    "login_grant": "登录凭据",
    "algorithm_attempt": "算法尝试",
    "sync_checkpoint": "同步游标",
    "family_membership": "家庭成员",
}


def target_name(value, model_names=None):
    """审计对象名里的英文模型名换回中文。

    `core/api/common.py` 的 describe_target 在没有业务名称可借时写的是
    「英文模型名（关联对象名）」（如 `login grant（parent-xxx）`），运营看不懂
    英文模型名。这里按调用方给的「英文模型名 -> 中文对象词条」表换掉前缀，
    换不掉的（已经是业务名称、或词表里没有的模型）原样返回。
    """
    text = (value or "").strip()
    if not text:
        return ""
    prefix, sep, rest = text.partition("（")
    if not sep:
        return text
    chinese = (model_names or {}).get(prefix.strip())
    return f"{chinese}（{rest}" if chinese else text


def label(mapping, code, fallback=None):
    if code is None or code == "":
        return "—"
    return mapping.get(code, fallback or f"未知（{code}）")


def humanize_action(code):
    """没有中文词条时的兜底显示，不把英文代码直接丢给运营。

    例：`assessment.create` -> `答卷 · 新建`。这属于兜底，正式动作都应有
    中文词条；`tests/test_ops_console.py` 会检查这一点。
    """
    if not code:
        return "—"
    prefix, _, suffix = str(code).partition(".")
    names = {
        "account": "后台账号",
        "activity": "活动",
        "assessment": "答卷",
        "association": "伙伴关联",
        "auth": "登录",
        "ca_reassessment": "复测",
        "child": "儿童档案",
        "consent": "授权",
        "content": "内容",
        "data_request": "服务事项",
        "exploration": "探索体验",
        "family": "家庭",
        "job": "生成任务",
        "questionnaire": "题库",
        "report": "报告",
        "staff": "工作人员",
    }
    verbs = {
        "create": "新建",
        "save": "保存",
        "update": "修改",
        "delete": "删除",
        "copy": "复制",
        "retire": "停用",
        "publish": "发布",
        "start": "开始",
        "submit": "提交",
        "cancel": "取消",
        "complete": "完成",
        "verify": "核验",
        "revoke": "撤回",
        "grant": "同意",
        "pause": "暂停",
        "resume": "恢复",
        "retry": "重试",
        "resolve": "处理",
        "note": "备注",
        "login": "登录",
        "logout": "退出",
        "status": "状态变更",
        "roles": "角色变更",
        "freeze": "冻结",
        "restore": "恢复",
        "profile_update": "资料修改",
        "password_reset": "重置密码",
        "password_change": "修改密码",
        "execute_deletion": "执行删除",
    }
    return f"{names.get(prefix, prefix)} · {verbs.get(suffix, suffix)}"


def humanize_value(value):
    """审计 detail 里的取值转成中文，并把长编号缩短。"""
    if value is None:
        return "未填写"
    if isinstance(value, bool):
        return "是" if value else "否"
    if isinstance(value, dict):
        return "、".join(f"{DETAIL_KEY.get(k, k)}={humanize_value(v)}" for k, v in value.items())
    if isinstance(value, (list, tuple)):
        return "、".join(humanize_value(item) for item in value)
    text = str(value)
    if text in DETAIL_VALUE:
        return DETAIL_VALUE[text]
    # UUID 之类的长编号只保留前 8 位，运营不需要看全量内部编号
    if len(text) >= 32 and "-" in text:
        return f"编号 {text[:8]}"
    return text


def job_error(code):
    """返回 (标题, 说明, 是否允许重试)。"""
    if not code:
        return ("无错误", "任务未记录错误。", False)
    title, advice, retryable = JOB_ERROR.get(
        code, ("未识别的错误", f"系统记录了未识别的错误代码 {code}，请交由技术运维处理。", False)
    )
    return (title, advice, retryable)
