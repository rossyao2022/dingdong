"""关联（`ExternalAssociation`）的结束动作只有一份实现。

两条路径都会结束关联：家长点「解除本地关联」，以及归档旧号（换机的第一步）。
落的状态必须一致（`revoked` + `ended_at` + 同步检查点停用），否则账户页、成长观察
与三个展示面会出现两种口径（T-044 的 P-19）。
"""

from django.utils import timezone

from dingdong_ca.core.api.common import audit
from dingdong_ca.core.models import SyncCheckpoint


def end_association(a, user):
    """结束一条关联；已结束的不重复记审计。调用方负责行锁与事务。"""
    if a.status == "revoked":
        return a
    a.status = "revoked"
    a.ended_at = timezone.now()
    a.save(update_fields=["status", "ended_at", "updated_at"])
    # 检查点留着可查（历史同步记录），但不再调度新的同步。
    SyncCheckpoint.objects.filter(association=a).update(status="blocked", next_due_at=None)
    audit(user, "association.revoke", a)
    return a
