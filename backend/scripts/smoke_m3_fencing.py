# ruff: noqa: E402
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

import os
import signal

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.local")
import django

django.setup()
from datetime import timedelta

from django.db import connection
from django.utils import timezone

from dingdong_ca.core.models import BackgroundJob, JobAttempt, ReportVersion
from dingdong_ca.core.tasks import dispatch_pending, run_report_job

# No worker should be running when this script starts. It owns its temporary workers.
subprocess.run(
    [
        sys.executable,
        "manage.py",
        "inject_fixture",
        "--child-id",
        child["id"],
        "--scenario",
        "sync_success",
    ],
    cwd=Path(__file__).resolve().parents[1],
    check=True,
    capture_output=True,
)
policy = call("GET", "/policies/current?purpose=dingdong_sync")
consent = call(
    "POST",
    f"/children/{child['id']}/consents",
    {"request_id": str(uuid.uuid4()), "policy_version_id": policy["id"]},
)
association = call(
    "POST",
    f"/children/{child['id']}/associations/verify",
    {
        "request_id": str(uuid.uuid4()),
        "consent_grant_id": consent["id"],
        "entry_proof": "TEST-PROOF-" + child["id"],
    },
)
job = BackgroundJob.objects.get(association_id=association["id"], kind="sync")
workers = []
queue = "dingdong-ca-smoke-" + uuid.uuid4().hex
run_report_job.apply_async(args=[str(job.pk)], queue=queue)


def launch():
    worker = subprocess.Popen(
        [
            sys.executable,
            "-m",
            "celery",
            "-A",
            "config",
            "worker",
            "--pool=solo",
            "--concurrency=1",
            "--loglevel=ERROR",
            "--queues=" + queue,
            "--without-gossip",
            "--without-mingle",
        ],
        cwd=Path(__file__).resolve().parents[1],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=True,
    )
    workers.append(worker)
    return worker


import psycopg

try:
    with psycopg.connect(**connection.get_connection_params()) as blocker:
        with blocker.cursor() as cursor:
            cursor.execute("LOCK TABLE test_fixture IN ACCESS EXCLUSIVE MODE")
        old = launch()
        for _ in range(100):
            job.refresh_from_db()
            if job.status == "running":
                break
            time.sleep(0.1)
        assert job.status == "running"
        BackgroundJob.objects.filter(pk=job.pk).update(
            lease_expires_at=timezone.now() - timedelta(seconds=1)
        )
        dispatch_pending()
        run_report_job.apply_async(args=[str(job.pk)], queue=queue)
        new = launch()
        for _ in range(100):
            job.refresh_from_db()
            if job.status == "running" and job.attempt_count == 2:
                break
            time.sleep(0.1)
        assert job.status == "running" and job.attempt_count == 2
    # Both processes now return from the source read. Only the current token may commit.
    delivered = {job.pk}
    for _ in range(150):
        for pending in BackgroundJob.objects.filter(
            association_id=association["id"], status="pending"
        ):
            if pending.pk not in delivered:
                run_report_job.apply_async(args=[str(pending.pk)], queue=queue)
                delivered.add(pending.pk)
        report = ReportVersion.objects.filter(profile__child_id=child["id"]).first()
        if report:
            break
        time.sleep(0.1)
    assert report is not None
    from dingdong_ca.core.models import ObservationBatch, ProfileSnapshot, SyncCheckpoint

    assert ObservationBatch.objects.filter(association_id=association["id"]).count() == 1
    assert ProfileSnapshot.objects.filter(child_id=child["id"]).count() == 1
    assert ReportVersion.objects.filter(profile__child_id=child["id"]).count() == 1
    assert SyncCheckpoint.objects.get(association_id=association["id"]).cursor == 1
    assert JobAttempt.objects.filter(job=job, status="abandoned").count() == 1
    assert JobAttempt.objects.filter(job=job, status="succeeded").count() == 1
    print(
        json.dumps(
            {
                "late_worker_fencing": "passed",
                "concurrent_workers": 2,
                "observations": 1,
                "profiles": 1,
                "reports": 1,
                "child_id": child["id"],
                "job_id": str(job.pk),
            },
            ensure_ascii=False,
        )
    )
finally:
    for worker in workers:
        if worker.poll() is None:
            os.killpg(worker.pid, signal.SIGTERM)
            try:
                worker.wait(timeout=8)
            except subprocess.TimeoutExpired:
                os.killpg(worker.pid, signal.SIGKILL)
                worker.wait(timeout=5)
