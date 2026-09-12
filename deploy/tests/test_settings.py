"""Deployment must reject incomplete configuration and honor the public origin."""
import os
import subprocess
import sys


def run_settings(**overrides):
    env = {**os.environ, "DJANGO_SETTINGS_MODULE": "config.settings.deployment",
           "PUBLIC_ORIGIN": "https://demo.example.com",
           "DJANGO_SECRET_KEY": "a" * 64, "JWT_SIGNING_KEY": "b" * 64,
           **overrides}
    return subprocess.run([sys.executable, "-c", 
        "from django.conf import settings as s; "
        "print(s.DEBUG, s.ALLOWED_HOSTS, s.CSRF_TRUSTED_ORIGINS, s.COOKIE_SECURE)"],
        env=env, capture_output=True, text=True)


def test_https_origin():
    r = run_settings()
    assert r.returncode == 0, r.stderr
    assert "False ['demo.example.com'] ['https://demo.example.com'] True" in r.stdout


def test_invalid_origin():
    assert run_settings(PUBLIC_ORIGIN="https://demo.example.com/path").returncode != 0


def test_missing_secret():
    assert run_settings(DJANGO_SECRET_KEY="").returncode != 0
