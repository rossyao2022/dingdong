"""`ca_account_id` 的发号、解析与生命周期。

号码形态与三项决定见 `设计/CA对接_C1_ca_account_id设计_20260916.md`：
账户级、一台机器人一个号、一台机器人服务一个孩子、换机发新号。

这里只做**我方本地**能闭环的部分。真正的绑定要调对方端点，需要 base URL 与
`X-API-Key`（D10/D12 尚未回复），所以新账户的 ``bind_state`` 停在 ``unbound``。
"""

import hashlib
import hmac
import logging
import os
import re

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone

from dingdong_ca.core.api.common import ApiError, audit
from dingdong_ca.core.ca_models import CaAccount
from dingdong_ca.core.models import Child

logger = logging.getLogger(__name__)

# Crockford Base32：没有 I / L / O / U，避免 0/O、1/I 被人念错抄错。
_CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
_ULID_LENGTH = 26
# 号码撞车（80 位随机）概率可忽略，但重试成本极低，留一道保险。
_ISSUE_ATTEMPTS = 5


def new_ulid(moment=None):
    """26 字符 ULID：48 位毫秒时间戳 + 80 位随机数。

    选它而不是自增或 UUID4：自增会泄露业务量且需要分布式协调；UUID4 无时序，
    运维排查与分页都难。ULID 同时满足唯一、时序、定长、不透明。
    """
    now = moment or timezone.now()
    milliseconds = int(now.timestamp() * 1000)
    if not 0 <= milliseconds < (1 << 48):
        raise ValueError("时间戳超出 ULID 的 48 位范围")
    value = (milliseconds << 80) | int.from_bytes(os.urandom(10), "big")
    return "".join(
        _CROCKFORD[(value >> shift) & 31] for shift in range((_ULID_LENGTH - 1) * 5, -1, -5)
    )


def ca_account_id_pattern():
    prefix = re.escape(settings.CA_ACCOUNT_ID_PREFIX)
    return re.compile(prefix + r"[0-9A-HJKMNP-TV-Z]{%d}" % _ULID_LENGTH)


def new_ca_account_id(moment=None):
    return settings.CA_ACCOUNT_ID_PREFIX + new_ulid(moment)


def is_valid_ca_account_id(value):
    return isinstance(value, str) and ca_account_id_pattern().fullmatch(value) is not None


def nfc_token_digest(token):
    """NFC token 的 HMAC-SHA256 摘要。

    明文不落库、不进日志：token 是设备凭据，把它复制进我们的库等于多一份
    可被滥用的凭据（与"真实指纹不留存"同一条思路）。
    """
    key = settings.NFC_TOKEN_HMAC_KEY.encode("utf-8")
    return hmac.new(key, token.encode("utf-8"), hashlib.sha256).hexdigest()


def token_fingerprint(digest):
    """给运营比对用的短指纹：换机器时够区分，又无法反推原文。"""
    return digest[:8]


def issue_account(*, child, user, request_id, nfc_token, robot_ref=None):
    """建立或复用该孩子的 CA 账户，返回 ``(account, created)``。

    幂等键是 ``(bound_by, request_id)``：同一请求重放返回同一行；请求内容不一致
    返回 409，不静默改号。同一台机器人再次绑定时复用现有号码（不是换机）。
    该孩子已有活跃账户且是**另一台**机器人时，要求先归档旧号——这样"换机发新号"
    在接口层就是显式两步，家长确认后才发生。
    """
    digest = nfc_token_digest(nfc_token)
    payload = {
        "child_id": str(child.pk),
        "nfc_token_digest": digest,
        "robot_ref": robot_ref,
    }
    created = True
    with transaction.atomic():
        # 锁住孩子，串行化同一孩子的并发建号；跨孩子抢同一台机器人的情况
        # 由数据库条件唯一约束兜住（见下）。
        Child.objects.select_for_update().get(pk=child.pk)
        previous = CaAccount.objects.filter(bound_by=user, create_request_key=request_id).first()
        if previous is not None:
            if previous.create_payload != payload:
                raise ApiError("IDEMPOTENCY_CONFLICT", 409, "同一 request_id 的请求内容不一致")
            account, created = previous, False
        else:
            current = CaAccount.objects.filter(child=child, status="active").first()
            if current is not None:
                if current.nfc_token_hash != digest:
                    raise ApiError(
                        "ACCOUNT_REPLACEMENT_REQUIRED",
                        409,
                        "该孩子已有活跃账户；换机器人请先归档旧号，再为新机器人发新号",
                    )
                # 同一台机器人重复绑定：复用现有号码，不换号。
                account, created = current, False
            else:
                for _ in range(_ISSUE_ATTEMPTS):
                    identifier = new_ca_account_id()
                    try:
                        with transaction.atomic():
                            account = CaAccount.objects.create(
                                ca_account_id=identifier,
                                robot_ref=robot_ref,
                                nfc_token_hash=digest,
                                family=child.family,
                                child=child,
                                bound_by=user,
                                create_request_key=request_id,
                                create_payload=payload,
                                bound_at=timezone.now(),
                            )
                        break
                    except IntegrityError:
                        if not CaAccount.objects.filter(ca_account_id=identifier).exists():
                            # 不是号码撞车，而是并发下同一台机器人/同一个孩子已被占用。
                            raise ApiError(
                                "CA_ACCOUNT_CONFLICT",
                                409,
                                "该机器人或该孩子已被其他活跃账户占用",
                            ) from None
                else:
                    raise ApiError("CA_ACCOUNT_ISSUE_FAILED", 503, "号码生成重试次数用尽")
                audit(user, "ca_account.create", account)
    # 网络调用放在事务外：不要为了绑一次机器人把行锁和事务一起拖住。
    # 绑定失败不回滚建号——号码仍然有效，界面按 bind_state 显示"待接通"。
    if account.bind_state == "unbound":
        attempt_bind(account, nfc_token)
    return account, created


def attempt_bind(account, nfc_token):
    """配置齐全时真的调对方的绑定接口；未配置就返回 None，状态留在 `unbound`。"""
    from .dingdong_client import DingDongError, call, is_configured

    if not is_configured():
        return None
    try:
        result = call(
            "POST",
            "/api/v1/ca/account/bind",
            payload={"ca_account_id": account.ca_account_id, "nfc_token": nfc_token},
            request_id=str(account.create_request_key),
        )
    except DingDongError as exc:
        logger.warning(
            "CA 账户绑定未完成 ca_account_id=%s code=%s message=%s",
            account.ca_account_id,
            exc.code,
            exc.message,
        )
        return None
    # 绑定接口成功才改状态；对方没确认成功之前不许显示"已绑定"。
    account.bind_state = "bound"
    account.save(update_fields=["bind_state", "updated_at"])
    return result


def resolve_account(ca_account_id):
    """`ca_account_id -> 账户（含 child/family）` 的唯一解析入口。

    8 个对外调用都要用它取数，不允许各自写一份解析，否则"哪些号算有效"
    会出现多个口径。
    """
    account = (
        CaAccount.objects.select_related("child", "family")
        .filter(ca_account_id=ca_account_id, status="active")
        .first()
    )
    if account is None:
        raise ApiError("CA_ACCOUNT_UNKNOWN", 404, "账户号不存在或已归档")
    return account


def retire_account(account, user):
    """归档账户。换机时先调它，旧号保留可查、永不重用。"""
    if account.status == "retired":
        return account
    account.status = "retired"
    account.unbound_at = timezone.now()
    account.save(update_fields=["status", "unbound_at", "updated_at"])
    audit(user, "ca_account.retire", account)
    return account
