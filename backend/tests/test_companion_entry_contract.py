"""Fixed prototype public entry and backend transport; supplier is synthetic only."""

import json
from io import BytesIO
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

import pytest
from conftest import sign_in

from dingdong_ca.core.services import dingdong_client

pytestmark = pytest.mark.django_db


def test_companion_entry_and_insights_transport_follow_supplied_contract(
    client, settings, monkeypatch
):
    """Real client request construction, with only supplier transport replaced."""
    settings.APP_ENV = "demo"
    settings.DINGDONG_PROTOTYPE_DEMO_ENABLED = True
    settings.DINGDONG_BASE_URL = "https://www.dingdongrobo.top"
    settings.DINGDONG_PROTOTYPE_WEB_URL = "https://www.dingdongrobo.top/dingdong/companion/main"
    settings.DINGDONG_API_KEY = "synthetic-contract-key"
    settings.DINGDONG_ALLOW_HTTP = False
    payload = json.loads((Path(__file__).parent / "fixtures/prototype-insights.json").read_text())
    captured = []

    def capture(request, timeout):
        captured.append(request)
        return BytesIO(json.dumps({"code": 0, "data": payload}).encode())

    monkeypatch.setattr(dingdong_client, "_open", capture)
    runtime = client.get("/api/v1/runtime").json()
    assert runtime["exhibition_chat_url"] == settings.DINGDONG_PROTOTYPE_WEB_URL
    sign_in(client)
    response = client.get("/api/v1/exhibition/report")
    assert response.status_code == 200, response.content
    assert response.json()["prototype_url"] == settings.DINGDONG_PROTOTYPE_WEB_URL
    assert len(captured) == 1
    request = captured[0]
    parsed = urlsplit(request.full_url)
    assert (request.method, parsed.scheme, parsed.netloc, parsed.path) == (
        "GET",
        "https",
        "www.dingdongrobo.top",
        "/api/v1/ca/prototype/insights",
    )
    assert parse_qs(parsed.query) == {"ca_account_id": ["ca_dingdong"], "weekly_turns": ["7"]}
    assert not parsed.fragment and request.data is None
    headers = {key.lower(): value for key, value in request.header_items()}
    assert headers == {"x-api-key": "synthetic-contract-key", "accept": "application/json"}
    assert "synthetic-contract-key" not in response.content.decode()
