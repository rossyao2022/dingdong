"""Public trial must not expose a second login path after removing Basic Auth."""

from pathlib import Path


def test_public_trial_has_no_browser_gate_and_closes_technical_admin():
    locations = (
        Path(__file__).resolve().parents[1] / "production-trial" / "nginx-locations.conf"
    ).read_text()
    assert "auth_basic" not in locations
    assert "location ^~ /admin/ { return 404; }" in locations
    assert "location ^~ /dingdong/admin/ { return 404; }" in locations
