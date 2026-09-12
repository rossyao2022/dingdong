"""Real HTTP + PostgreSQL + Redis/Celery; only deterministic synthetic PNG bytes."""

import http.cookiejar
import json
import secrets
import subprocess
import sys
import time
import urllib.request
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from dingdong_ca.testsupport.synthetic import synthetic_png

base = "http://127.0.0.1:8017/api/v1"
jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
access = None


def call(method, path, data=None, content_type="application/json"):
    headers = {"Content-Type": content_type}
    csrf = next((c.value for c in jar if c.name == "csrftoken"), None)
    if csrf:
        headers["X-CSRFToken"] = csrf
    if access:
        headers["Authorization"] = "Bearer " + access
    payload = (
        data if isinstance(data, bytes) else json.dumps(data).encode() if data is not None else None
    )
    with opener.open(
        urllib.request.Request(base + path, data=payload, headers=headers, method=method),
        timeout=10,
    ) as response:
        body = response.read()
        return json.loads(body) if body else None


call("GET", "/auth/csrf")
challenge = call("POST", "/auth/sms", {"phone": "+86136" + f"{secrets.randbelow(10**8):08d}"})
login = call("POST", "/auth/login", {"challenge_id": challenge["challenge_id"], "code": "00000"})
access = login["access_token"]
child = call("POST", "/children", {"request_id": str(uuid.uuid4()), "name": "HTTP合成测评儿童"})
policy = call("GET", "/policies/current?purpose=assessment_processing")
consent = call(
    "POST",
    f"/children/{child['id']}/consents",
    {"request_id": str(uuid.uuid4()), "policy_version_id": policy["id"]},
)
config = call("GET", "/assessment-config")
session = call(
    "POST",
    f"/children/{child['id']}/assessments",
    {
        "request_id": str(uuid.uuid4()),
        "questionnaire_version_id": config["questionnaire_version_id"],
        "consent_grant_id": consent["id"],
    },
)
session = call(
    "PATCH",
    f"/assessments/{session['id']}/answers",
    {
        "revision": session["revision"],
        "answers": [
            {"question_code": q["code"], "option_codes": [q["options"][0]["code"]]}
            for q in session["questions"]
        ],
    },
)
subprocess.run(
    [
        sys.executable,
        "manage.py",
        "inject_fixture",
        "--child-id",
        child["id"],
        "--scenario",
        "assessment_success",
    ],
    cwd=Path(__file__).resolve().parents[1],
    check=True,
    capture_output=True,
)
boundary = "ca-" + uuid.uuid4().hex
parts = []
for key, value in {"request_id": str(uuid.uuid4()), "revision": str(session["revision"])}.items():
    parts.append(
        f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"\r\n\r\n{value}\r\n'.encode()
    )
for i in range(1, 6):
    parts.append(
        f'--{boundary}\r\nContent-Disposition: form-data; name="slot_{i}"; filename="synthetic.png"\r\nContent-Type: image/png\r\n\r\n'.encode()
        + synthetic_png(i)
        + b"\r\n"
    )
parts.append(f"--{boundary}--\r\n".encode())
result = call(
    "POST",
    f"/assessments/{session['id']}/submit",
    b"".join(parts),
    f"multipart/form-data; boundary={boundary}",
)
assert result["status"] == "completed"
for _ in range(40):
    state = call("GET", f"/assessments/{session['id']}")
    if state["report_status"] == "ready":
        break
    time.sleep(0.25)
assert state["report_status"] == "ready", state
report = call("GET", "/reports/" + state["report_id"])
assert report["data_origin"] == "synthetic" and report["sections"][0]["paragraphs"]
call("POST", "/auth/logout", {})
print(
    json.dumps(
        {
            "m2_http_smoke": "passed",
            "session_id": session["id"],
            "profile_id": state["profile_id"],
            "report_id": report["id"],
            "data_origin": report["data_origin"],
            "report_worker": "real Celery via Redis",
        },
        ensure_ascii=False,
    )
)
