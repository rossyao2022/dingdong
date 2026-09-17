"""T-030：清理 T-020 注入的合成测试批次（只改状态字段，不物理 DELETE）。

清单来源：`.trellis/tasks/T-020/report.md` 末节「本次注入的合成数据（供清理参考）」。

用法（默认只预演，不写库）：

    cd backend
    uv run python manage.py shell < ../.trellis/tasks/T-030/dispose_synthetic_batch.py
    T030_APPLY=1 uv run python manage.py shell < ../.trellis/tasks/T-030/dispose_synthetic_batch.py

审计文案修正（把早先写入的 detail 改成当前形态，同样默认预演）：

    T030_REPAIR_AUDIT=1 T030_APPLY=1 uv run python manage.py shell < ...

幂等：已经是目标状态的条目跳过，不重复写审计。
"""

import os

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from dingdong_ca.core.assessment_models import BackgroundJob, ConsentGrant
from dingdong_ca.core.integration_models import ExternalAssociation, SyncCheckpoint
from dingdong_ca.core.models import AuditEvent, Child, Family, FamilyMembership, LoginGrant
from dingdong_ca.ops import labels as L

# 审计文案要短、不带连字符：humanize_value 会把 32 字符以上且含「-」的字符串
# 当成内部编号截成「编号 xxx」，长 reason 会在运营端显示成半句话。
REASON = "清理注入的合成测试批次"
CHILD_ID = "0a4055e4-ffc8-41f2-a8a1-dcc06c85deca"
PARENT_PHONE = "+8613748001381"
APPLY = os.environ.get("T030_APPLY") == "1"
REPAIR = os.environ.get("T030_REPAIR_AUDIT") == "1"

# 时间戳字段的「目标状态」是「已经写上时间」，不能拿本次的 now 去比，
# 否则第二次跑会把同一个字段再当成待处置（不幂等）。
SET_NOW = object()

# 审计「修改前/修改后」文案：对象类型 -> (前态, 后态, 备注)。
# 前态取处置前实测值（见 before-state.txt），不读当前对象——处置落库后对象已是后态。
# 有词表的取值取词表，避免运营端出现第二份中文。
AUDIT_TEXT = {
    "child": (L.CHILD_STATUS["active"], L.CHILD_STATUS["archived"], ""),
    "family": (L.FAMILY_STATUS["active"], L.FAMILY_STATUS["closed"], ""),
    "external_association": (
        L.ASSOCIATION_STATUS["verified"],
        L.ASSOCIATION_STATUS["revoked"],
        "",
    ),
    "sync_checkpoint": (L.CHECKPOINT_STATUS["enabled"], L.CHECKPOINT_STATUS["paused"], ""),
    "background_job": (
        L.JOB_STATUS["failed"],
        L.JOB_STATUS["cancelled"],
        # 备注要短：humanize_value 会把 32 字符以上的长文本当成内部编号截断。
        "失败证据见 T-020 报告与失败快照",
    ),
    "consent_grant": ("有效", "已撤回", "清单外连带：同批次的同步授权"),
    "family_membership": ("在册", "已结束", "清单外连带"),
    "login_grant": ("有效", "已失效", "清单外连带：家长已有登录会话随之失效"),
}


def is_pending(obj, field, target):
    if target is SET_NOW:
        return getattr(obj, field) is None
    return getattr(obj, field) != target


def audit_detail(kind):
    before_text, after_text, note = AUDIT_TEXT[kind]
    detail = {"reason": REASON}
    if before_text:
        detail["before"] = before_text
    detail["after"] = after_text
    if note:
        detail["note"] = note
    return detail


now = timezone.now()
User = get_user_model()

child = Child.objects.get(pk=CHILD_ID)
family = Family.objects.get(pk=child.family_id)
parent = User.objects.get(account_kind="parent", phone=PARENT_PHONE)
assoc = ExternalAssociation.objects.get(child=child)
checkpoint = SyncCheckpoint.objects.get(association=assoc)
failed_job = BackgroundJob.objects.filter(association=assoc, status="failed").first()
succeeded_jobs = BackgroundJob.objects.filter(association=assoc, status="succeeded")

# 处置清单：(对象, 运营看得懂的对象名, 目标状态, 审计对象类型)
targets = [
    (child, f"儿童档案（{child.name}）", {"status": "archived"}, "child"),
    (family, f"家庭（{child.name}）", {"status": "closed"}, "family"),
    (
        assoc,
        f"伙伴关联（{child.name}）",
        {"status": "revoked", "ended_at": SET_NOW},
        "external_association",
    ),
    (
        checkpoint,
        f"同步游标（{child.name}）",
        {"status": "paused", "next_due_at": None},
        "sync_checkpoint",
    ),
    (
        failed_job,
        f"数据同步任务（{child.name}）",
        {"status": "cancelled", "error_code": "CONSENT_REVOKED_OR_PAUSED", "finished_at": SET_NOW},
        "background_job",
    ),
]
for consent in ConsentGrant.objects.filter(child=child, revoked_at__isnull=True):
    targets.append((consent, f"授权记录（{child.name}）", {"revoked_at": SET_NOW}, "consent_grant"))
for membership in FamilyMembership.objects.filter(family=family, ended_at__isnull=True):
    targets.append(
        (membership, f"家庭成员（家长 {PARENT_PHONE}）", {"ended_at": SET_NOW}, "family_membership")
    )
for grant in LoginGrant.objects.filter(user=parent, revoked_at__isnull=True):
    targets.append(
        (
            grant,
            f"登录凭据（家长 {PARENT_PHONE}）",
            {"revoked_at": SET_NOW, "revoke_reason": "synthetic_dispose"},
            "login_grant",
        )
    )

# 无状态字段可改（ImmutableResult 禁原地修改），只记录，随儿童归档退出活跃视图
no_status = [
    ("观察批次", "observation_batch", "e3d0860e-4934-4ec4-ba82-c5fa34fc9d22"),
    ("阶段画像", "profile_snapshot", str(child.profilesnapshot_set.first().pk)),
    ("阶段报告", "report_version", "4c86a69c-5197-46c2-ac7b-ea372c9d0c5b"),
]

print(f"=== T-030 合成测试批次处置（{'APPLY：写库' if APPLY else '预演：不写库'}）===")

changed = 0
skipped = 0
audits = []
for obj, label, target, kind in targets:
    if obj is None:
        print(f"跳过（库内不存在）：{label}")
        continue
    pending = {f: v for f, v in target.items() if is_pending(obj, f, v)}
    if not pending:
        skipped += 1
        print(f"已是目标状态，跳过：{label} ({obj._meta.db_table}/{obj.pk})")
        continue
    note = AUDIT_TEXT[kind][2]
    for field, value in pending.items():
        shown = "本次时间" if value is SET_NOW else repr(value)
        print(
            f"{label} ({obj._meta.db_table}/{obj.pk}) {field}: "
            f"{getattr(obj, field)!r} -> {shown}"
            + (f"　[{note}]" if note else "")
        )
    changed += 1
    audits.append((obj, label, pending, audit_detail(kind)))

print("无状态字段可变更，只记录（ImmutableResult 禁原地修改）：")
for kind, table, pk in no_status:
    print(f"  - {kind} {table}/{pk}")
print(f"终态任务不改（非活跃态）：succeeded × {succeeded_jobs.count()}")
print(
    "家长账号停用（不单列审计：app_user 词条是「工作人员账号」，见 T-030 report）："
    f"{PARENT_PHONE} is_active={parent.is_active!r}"
    + ("（已是目标状态）" if not parent.is_active else "")
)
print(f"汇总：状态变更 {changed} 项，已是目标状态 {skipped} 项，无状态字段 {len(no_status)} 项")

if not APPLY:
    print("预演结束：设置 T030_APPLY=1 才写库。")
else:
    with transaction.atomic():
        for obj, label, pending, detail in audits:
            for field, value in pending.items():
                setattr(obj, field, now if value is SET_NOW else value)
            obj.save(update_fields=[*pending, "updated_at"])
            AuditEvent.objects.create(
                actor=None,
                action="synthetic.dispose",
                target_kind=obj._meta.db_table,
                target_id=obj.pk,
                target_label=label,
                detail=detail,
            )
        if parent.is_active:
            parent.is_active = False
            parent.save(update_fields=["is_active"])
    print(f"已写库：状态变更 {changed} 项，审计 synthetic.dispose × {len(audits)} 条")

    child.refresh_from_db()
    family.refresh_from_db()
    assoc.refresh_from_db()
    checkpoint.refresh_from_db()
    print("=== 处置后 ===")
    print(f"Child.status={child.status!r}")
    print(f"Family.status={family.status!r}")
    print(f"ExternalAssociation.status={assoc.status!r} ended_at={assoc.ended_at!r}")
    print(
        f"SyncCheckpoint.status={checkpoint.status!r} next_due_at={checkpoint.next_due_at!r}"
    )
    for job in BackgroundJob.objects.filter(association=assoc).order_by("kind", "status"):
        print(f"BackgroundJob {job.kind}/{job.status} error_code={job.error_code!r}")
    print(f"User.is_active={parent.is_active!r}")
    print(f"AuditEvent(synthetic.dispose)={AuditEvent.objects.filter(action='synthetic.dispose').count()}")

if REPAIR:
    # 早先写入的 detail 把字段名与 datetime 的 repr 直接拼成字符串，运营端会看到
    # `修改后：revoked_at: datetime.datetime(...)`，而且长文本把「操作」列挤成一字一行。
    # 这里按当前形态原地修正文案，不改动作、对象与时间。
    print(f"=== 审计文案修正（{'APPLY：写库' if APPLY else '预演：不写库'}）===")
    repaired = 0
    unmatched = 0
    for row in AuditEvent.objects.filter(action="synthetic.dispose").order_by("created_at"):
        if row.target_kind not in AUDIT_TEXT:
            unmatched += 1
            print(f"跳过（不在本次清单）：{row.target_kind}/{row.pk}")
            continue
        expected = audit_detail(row.target_kind)
        if row.detail == expected:
            print(f"文案已是当前形态：{row.target_kind}/{row.pk}")
            continue
        repaired += 1
        print(f"{row.target_kind}/{row.pk}\n  旧: {row.detail}\n  新: {expected}")
        if APPLY:
            row.detail = expected
            row.save(update_fields=["detail"])
    print(
        f"审计文案待修正 {repaired} 条，跳过 {unmatched} 条"
        + ("（已写库）" if APPLY else "（预演，未写库）")
    )
