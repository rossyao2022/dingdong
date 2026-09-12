"""Real HTTP smoke against a running local server; creates synthetic business rows."""

import http.cookiejar
import json
import secrets
import urllib.request
import uuid

base = "http://127.0.0.1:8017/api/v1"
jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
access = None


def call(method, path, data=None):
    headers = {"Content-Type": "application/json"}
    csrf = next((c.value for c in jar if c.name == "csrftoken"), None)
    if csrf:
        headers["X-CSRFToken"] = csrf
    if access:
        headers["Authorization"] = "Bearer " + access
    req = urllib.request.Request(
        base + path,
        data=json.dumps(data).encode() if data is not None else None,
        headers=headers,
        method=method,
    )
    with opener.open(req) as response:
        payload = response.read()
        return response.status, json.loads(payload) if payload else None


call("GET", "/auth/csrf")
_, challenge = call("POST", "/auth/sms", {"phone": "+86137" + f"{secrets.randbelow(10**8):08d}"})
_, login = call("POST", "/auth/login", {"challenge_id": challenge["challenge_id"], "code": "00000"})
access = login["access_token"]
_, child = call("POST", "/children", {"request_id": str(uuid.uuid4()), "name": "HTTP合成测试儿童"})
_, activities = call("GET", "/activities")
activity = activities["items"][0]
_, record = call(
    "POST",
    f"/children/{child['id']}/activity-records",
    {
        "request_id": str(uuid.uuid4()),
        "activity_version_id": activity["id"],
        "mode": "web",
        "style": activity["allowed_styles"][0],
    },
)
call(
    "PATCH",
    "/activity-records/" + record["id"],
    {"revision": 1, "step_index": len(activity["steps"]) - 1},
)
call(
    "POST",
    "/activity-records/" + record["id"] + "/finish",
    {"status": "completed", "note": "真实HTTP闭环验证"},
)
_, records = call("GET", f"/children/{child['id']}/activity-records")
assert records["summary"] == {"completed_count": 1, "active_days": 1}
call("POST", "/auth/logout", {})
print(
    json.dumps(
        {
            "http_smoke": "passed",
            "child_id": child["id"],
            "record_id": record["id"],
            "summary": records["summary"],
        },
        ensure_ascii=False,
    )
)
