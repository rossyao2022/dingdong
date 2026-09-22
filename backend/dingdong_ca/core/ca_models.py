"""CA 账户：CA 侧对外提供给 DingDong 的稳定账户标识 `ca_account_id`。

设计见 `设计/CA对接_C1_ca_account_id设计_20260916.md`。三条硬约束来自用户决定：

1. **账户级** —— 不设家庭级聚合层；
2. **一台机器人一个号** —— 机器人 : ``ca_account_id`` = 1 : 1；
3. **一台机器人服务一个孩子** —— 账户 : 孩子 = 1 : 1，**换机发新号**，旧号 ``retired`` 归档且永不重用。

两个状态维度刻意分开，不要合并：

- ``status`` 是**我方本地**的占用状态（活跃 / 已归档）；
- ``bind_state`` 是**与对方**的绑定状态。对方端点还没通（缺 base URL 与 key）时
  它停在 ``unbound``，**不许假装已绑定**。

"同一孩子同一时刻只有一个活跃账户"与"同一台机器人不被两个活跃账户占用"
两条不变量由数据库条件唯一约束保证，不靠应用层自觉。
"""

from django.conf import settings
from django.db import models
from django.db.models import Q

from .models import Entity


class CaAccount(Entity):
    ca_account_id = models.CharField(max_length=64, unique=True)
    robot_ref = models.CharField(max_length=64, null=True, blank=True)
    # 只存 HMAC 摘要：NFC token 是设备凭据，明文不落库（与"真实指纹不留存"同源）。
    nfc_token_hash = models.CharField(max_length=64)
    family = models.ForeignKey("Family", on_delete=models.PROTECT)
    child = models.ForeignKey("Child", on_delete=models.PROTECT)
    status = models.CharField(max_length=16, default="active")
    bind_state = models.CharField(max_length=16, default="unbound")
    bound_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.PROTECT)
    create_request_key = models.UUIDField()
    create_payload = models.JSONField()
    bound_at = models.DateTimeField()
    unbound_at = models.DateTimeField(null=True)

    class Meta:
        db_table = "ca_account"
        # 审计页按 verbose_name 生成"CA 账户（小易）"这样的可读对象名，
        # 不设会显示 Django 自动生成的英文 "ca account"。
        verbose_name = verbose_name_plural = "CA 账户"
        constraints = [
            models.UniqueConstraint(
                fields=["bound_by", "create_request_key"], name="ca_account_create_unique"
            ),
            # 一台机器人一个号：同一台机器人不会被两个活跃账户占用。
            models.UniqueConstraint(
                fields=["nfc_token_hash"],
                condition=Q(status="active"),
                name="ca_account_one_active_robot",
            ),
            # 一台机器人一个孩子：同一孩子同一时刻只有一个活跃账户，
            # 换机时旧号必须先归档才能给新号让位。
            models.UniqueConstraint(
                fields=["child"], condition=Q(status="active"), name="ca_account_one_active_child"
            ),
            models.CheckConstraint(
                condition=Q(status__in=["active", "retired"]), name="ca_account_status_valid"
            ),
            models.CheckConstraint(
                condition=Q(bind_state__in=["unbound", "bound"]),
                name="ca_account_bind_state_valid",
            ),
            models.CheckConstraint(
                condition=Q(status="active", unbound_at__isnull=True)
                | Q(status="retired", unbound_at__isnull=False),
                name="ca_account_end_valid",
            ),
        ]

    def __str__(self):
        return self.ca_account_id


class CaReassessmentEvent(Entity):
    """复测事件（`reassessment_event`）在**我方**的本地状态。

    对方是事件与结果的权威（表 3.7「CA 写入：部分」）；这里只存家长的回写选择、
    承接复测的结果，以及出站同步状态。三条不变量落到库里，不靠应用层自觉：

    - 回写选择与回写时间同生同灭（``accepted`` 为 null 就是还没回写）；
    - 复测完成与完成时间同生同灭；
    - 同一账户下的同一 ``event_id`` 只有一行，重复回写走幂等重放而不是插入新行。

    ``event_id`` 由对方按事件发放，**跨账户可能重名**（合成 fixture 的两个复测
    mock 账号就共用一份事件），所以唯一性是 ``(ca_account, event_id)`` 而不是
    全局——服务层的读写本来就按这两键查（``services/ca_display.py`` 的
    ``_local_event``），约束比服务语义更严会把"第二个账户也能回写"变成 500。

    ``pending_sync`` / ``last_error`` 表示"本地已落库、出站还没成功"：不出现
    "本地已切换、对方不知道"的半截状态，也不把未同步说成已同步。
    """

    event_id = models.CharField(max_length=64)
    ca_account = models.ForeignKey(CaAccount, on_delete=models.PROTECT, related_name="+")
    child = models.ForeignKey("Child", on_delete=models.PROTECT)
    trigger_type = models.CharField(max_length=32)
    recommended_at = models.DateTimeField()
    old_profile_id = models.CharField(max_length=64, null=True, blank=True)
    old_persona_id = models.CharField(max_length=64, null=True, blank=True)
    accepted = models.BooleanField(null=True)
    responded_at = models.DateTimeField(null=True)
    response_request_key = models.UUIDField(null=True, blank=True)
    new_assessment_id = models.CharField(max_length=64, null=True, blank=True)
    new_profile_id = models.CharField(max_length=64, null=True, blank=True)
    completed_at = models.DateTimeField(null=True)
    complete_request_key = models.UUIDField(null=True, blank=True)
    # 复测完成时对方给的结果（新角色建议等）。只存原样，不改语义。
    result = models.JSONField(default=dict, blank=True)
    # 家长确认后由我方落标记；V1 没有自动切换路径，默认恒为 false。
    persona_switched = models.BooleanField(default=False)
    pending_sync = models.BooleanField(default=False)
    last_error = models.CharField(max_length=64, null=True, blank=True)

    class Meta:
        db_table = "ca_reassessment_event"
        verbose_name = verbose_name_plural = "复测事件"
        constraints = [
            # 事件 id 按账户唯一：对方发放的事件 id 跨账户可能重名。
            models.UniqueConstraint(
                fields=["ca_account", "event_id"], name="ca_reassessment_event_account_unique"
            ),
            models.CheckConstraint(
                condition=Q(trigger_type__in=["low_engagement", "periodic", "manual"]),
                name="ca_reassessment_trigger_valid",
            ),
            models.CheckConstraint(
                condition=Q(accepted__isnull=True, responded_at__isnull=True)
                | Q(accepted__isnull=False, responded_at__isnull=False),
                name="ca_reassessment_response_valid",
            ),
            models.CheckConstraint(
                condition=Q(new_assessment_id__isnull=True, completed_at__isnull=True)
                | Q(new_assessment_id__isnull=False, completed_at__isnull=False),
                name="ca_reassessment_complete_valid",
            ),
        ]

    def __str__(self):
        return self.event_id
