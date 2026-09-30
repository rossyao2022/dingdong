"""Public trial must not expose a second login path after removing Basic Auth."""

from pathlib import Path


def test_public_trial_has_no_browser_gate_and_closes_technical_admin():
    locations = (
        Path(__file__).resolve().parents[1]
        / "production-trial"
        / "nginx-locations.conf"
    ).read_text()
    assert "auth_basic" not in locations
    assert "location ^~ /admin/ { return 404; }" in locations
    assert "location ^~ /dingdong/admin/ { return 404; }" in locations


def test_http_callback_is_exact_and_does_not_expose_parent_api_or_ops():
    root = Path(__file__).resolve().parents[1] / "production-trial"
    http = (root / "nginx-http-locations.conf").read_text()
    https = (root / "nginx-locations.conf").read_text()
    import re

    routes = re.findall(r"^location ([^{]+)\{", http, re.MULTILINE)
    assert routes == ["= /api/dingdong/prototype/events "]
    for body, scheme in [(http, "http"), (https, "https")]:
        callback = body.split("location = /api/dingdong/prototype/events {", 1)[
            1
        ].split("}", 1)[0]
        assert "proxy_pass http://127.0.0.1:18080;" in callback
        assert f"proxy_set_header X-Forwarded-Proto {scheme};" in callback
        assert (
            "access_log /var/log/nginx/dingdong-push-access.log dingdong_push;"
            in callback
        )
    log = (root / "nginx-push-log.conf").read_text()
    assert "$uri" in log
    assert all(
        variable not in log
        for variable in [
            "$request ",
            "$request_uri",
            "$args",
            "$request_body",
            "$http_authorization",
        ]
    )
