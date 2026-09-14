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
        "print(s.DEBUG, s.ALLOWED_HOSTS, s.CSRF_TRUSTED_ORIGINS, s.COOKIE_SECURE, "
        "s.SECURE_CROSS_ORIGIN_OPENER_POLICY)"],
        env=env, capture_output=True, text=True)


def test_https_origin():
    r = run_settings()
    assert r.returncode == 0, r.stderr
    assert "False ['demo.example.com'] ['https://demo.example.com'] True same-origin" in r.stdout


def test_plain_http_origin_omits_headers_only_honored_on_secure_origins():
    """明文入口不能发 Cross-Origin-Opener-Policy。

    Chrome 只在"可信源"（https 或 localhost）上认可这个响应头；在 http 明文入口上
    它会被忽略并**在每一个页面的控制台打一条错误**，把真正的错误淹掉。
    部署在纯 HTTP 下的演示环境因此不该发这个头。
    """
    r = run_settings(PUBLIC_ORIGIN="http://110.42.225.196")
    assert r.returncode == 0, r.stderr
    assert r.stdout.strip().endswith("False None"), r.stdout


def test_invalid_origin():
    assert run_settings(PUBLIC_ORIGIN="https://demo.example.com/path").returncode != 0


def test_missing_secret():
    assert run_settings(DJANGO_SECRET_KEY="").returncode != 0


def test_additional_origin():
    r = run_settings(PUBLIC_ORIGIN="http://110.42.225.196",
                     ADDITIONAL_ORIGINS="http://100.115.66.119:18080")
    assert r.returncode == 0, r.stderr
    assert "['110.42.225.196', '100.115.66.119']" in r.stdout
    assert "['http://110.42.225.196', 'http://100.115.66.119:18080']" in r.stdout


def test_invalid_additional_origin():
    assert run_settings(ADDITIONAL_ORIGINS="https://example.com/path").returncode != 0


def test_mixed_scheme_origin():
    assert run_settings(ADDITIONAL_ORIGINS="http://example.com").returncode != 0
