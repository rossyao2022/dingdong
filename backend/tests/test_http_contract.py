import pytest
from conftest import assert_schema, csrf, sign_in

pytestmark = pytest.mark.django_db


def test_runtime_csrf_and_malformed_json(client):
    assert_schema("Runtime", client.get("/api/v1/runtime").json())
    assert_schema("Csrf", client.get("/api/v1/auth/csrf").json())
    csrf(client)
    r = client.post("/api/v1/auth/sms", data="{broken", content_type="application/json")
    assert r.status_code == 400
    assert_schema("Error", r.json())
    assert r["X-Request-ID"] == r.json()["trace_id"]


def test_json_api_rejects_file_upload_without_parsing(client):
    from django.core.files.uploadedfile import SimpleUploadedFile

    sign_in(client)
    r = client.post(
        "/api/v1/children",
        {"name": "test", "file": SimpleUploadedFile("synthetic.png", b"not-an-image")},
        format="multipart",
    )
    assert r.status_code == 415
    assert_schema("Error", r.json())
