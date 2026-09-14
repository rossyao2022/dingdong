#!/usr/bin/env python3
"""v0.3.6 公网验收：准备隔离的合成数据（不触碰既有运营数据）。

本轮只改运营后台界面，不改后端逻辑与家长端。跑这个脚本是为了让"报告查看 +
失败任务重试""服务事项闭环"两条运营用例在公网有真实数据可操作，
而不是为了验证后端——后端继承 v0.3.5 的 237 项测试结果。

全部走真实链路：
1. 用公网家长 API 建立隔离的临时家长账号与儿童（随机手机号 + 固定验证码 00000）。
2. 在容器内执行真实的 `inject_fixture --scenario report_retry`，注入同步输入与
   "连续 5 次渲染失败"的故障输入（非生产合成输入）。
3. 走真实家长 API 授权 dingdong_sync 并提交关联核验票据，让 Worker 真的跑出
   一条失败的报告任务（用于运营侧"查看报告 + 重试失败任务"验收）。
4. 为同一儿童提交一条 support 服务事项，作为运营侧"服务事项闭环"的隔离对象。

本轮隔离对象统一用称呼前缀 **界面验收隔离儿童**，验收后按此前缀定向归档。

用法：
    python3 deploy/evidence/v0.3.6/prepare-acceptance-data.py
输出：
    标准输出为 JSON，含 child_id / child_name / failed_job / phone / service_query；
    凭据不落盘。此脚本不含任何密钥。
"""

import json
import secrets
import subprocess
import sys
import time
import urllib.error
import urllib.request
import uuid
from http.cookiejar import CookieJar

BASE = "http://110.42.225.196/api/v1"
CONTAINER = "dingdong-demo-api-1"


def ssh(command: str, timeout: int = 60) -> str:
    return subprocess.check_output(
        ["ssh", "-o", "ConnectTimeout=15", "dell", command], timeout=timeout
    ).decode()


class Client:
    def __init__(self) -> None:
        self.jar = CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))

    def csrf(self):
        return next((c.value for c in self.jar if c.name == "csrftoken"), None)

    def call(self, method, path, body=None, token=None):
        request = urllib.request.Request(BASE + path, method=method)
        request.add_header("Content-Type", "application/json")
        if token:
            request.add_header("Authorization", "Bearer " + token)
        token_value = self.csrf()
        if token_value and method != "GET":
            request.add_header("X-CSRFToken", token_value)
        payload = json.dumps(body).encode() if body is not None else None
        try:
            response = self.opener.open(request, payload, timeout=30)
        except urllib.error.HTTPError as exc:
            raise SystemExit(f"{method} {path} -> {exc.code} {exc.read().decode()}") from None
        raw = response.read()
        return response.status, (json.loads(raw) if raw else None)


def container_python(code: str, timeout: int = 90) -> str:
    escaped = code.replace("'", "'\"'\"'")
    return ssh(
        "docker exec -e DJANGO_SETTINGS_MODULE=config.settings.deployment "
        f"{CONTAINER} python -c '{escaped}'",
        timeout=timeout,
    )


def main() -> int:
    stamp = time.strftime("%H%M%S")
    phone = "+86139" + "".join(secrets.choice("0123456789") for _ in range(8))
    child_name = f"界面验收隔离儿童{stamp}"
    client = Client()

    client.call("GET", "/auth/csrf")
    _, sms = client.call("POST", "/auth/sms", {"phone": phone})
    _, login = client.call(
        "POST", "/auth/login", {"challenge_id": sms["challenge_id"], "code": "00000"}
    )
    token = login["access_token"]

    _, child = client.call(
        "POST",
        "/children",
        {
            "request_id": str(uuid.uuid4()),
            "name": child_name,
            "gender": "unknown",
            "birth_date": None,
        },
        token,
    )
    child_id = child["id"]
    print(f"# child {child_id} {child_name}", file=sys.stderr)

    # 注入真实故障输入：同步输入 + 连续 5 次渲染失败
    out = container_python(
        "import django; django.setup();"
        "from django.core.management import call_command; "
        f"call_command('inject_fixture', child_id='{child_id}', scenario='report_retry')"
    )
    proof = ""
    for line in out.splitlines():
        if "TEST-PROOF-" in line:
            proof = line.split("TEST-PROOF-")[-1].strip()
    if not proof:
        raise SystemExit("未从注入输出里解析到核验票据：" + out)
    entry_proof = "TEST-PROOF-" + proof
    print(f"# proof {entry_proof}", file=sys.stderr)

    _, policy = client.call("GET", "/policies/current?purpose=dingdong_sync")
    _, grant = client.call(
        "POST",
        f"/children/{child_id}/consents",
        {"request_id": str(uuid.uuid4()), "policy_version_id": policy["id"]},
        token,
    )

    _, assoc = client.call(
        "POST",
        f"/children/{child_id}/associations/verify",
        {
            "request_id": str(uuid.uuid4()),
            "consent_grant_id": grant["id"],
            "entry_proof": entry_proof,
        },
        token,
    )

    # 隔离的服务事项：只处理这一条，不碰既有家庭的服务数据
    _, request_row = client.call(
        "POST",
        f"/children/{child_id}/data-requests",
        {"request_id": str(uuid.uuid4()), "kind": "support", "reason_code": "support_needed"},
        token,
    )

    assoc_id = assoc["id"]
    failed_job = None
    for _ in range(40):
        listing = container_python(
            "import django; django.setup();"
            "from django.apps import apps;"
            "B=apps.get_model('core','BackgroundJob');"
            "print('|'.join(str(x) for x in B.objects.filter(status='failed',"
            f"association_id='{assoc_id}')"
            ".values_list('id','kind','error_code')))"
        ).strip()
        if listing:
            failed_job = listing.splitlines()[-1]
            break
        time.sleep(9)

    print(
        json.dumps(
            {
                "phone": phone,
                "child_id": child_id,
                "child_name": child_name,
                "association_id": assoc["id"],
                "association_status": assoc["status"],
                "data_request_id": str(request_row["id"]),
                "failed_job": failed_job,
                "search_query": child_name,
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
