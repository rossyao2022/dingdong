"""The deployment nginx must forward every top-level prefix Django serves.

Regression guard for v0.3.0: the ops console shipped reachable in local dev
but returned an nginx 404 behind the Docker deployment, because the proxy
location regex in ``deploy/nginx.conf.template`` only listed
``api/|admin/|static/`` and silently dropped ``ops/``.
"""
import ast
import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
NGINX_TEMPLATE = REPO_ROOT / "deploy" / "nginx.conf.template"
URLS = REPO_ROOT / "backend" / "config" / "urls.py"

# Served by Django but never declared as a ``path()`` in urls.py.
EXTRA_REQUIRED_PREFIXES = {"static"}

# Prefixes handled by the outer Shanghai relay / other hosts, not this server.
NOT_OURS = {"metrics", "healthz"}


def top_level_prefixes():
    """Literal first path segments declared in ``urlpatterns``."""
    tree = ast.parse(URLS.read_text(encoding="utf-8"))
    found = set()
    for node in ast.walk(tree):
        if not isinstance(node, ast.Constant) or not isinstance(node.value, str):
            continue
        route = node.value
        if not route or route.startswith("/") or "<" in route.split("/")[0]:
            continue
        first = route.split("/")[0]
        # Only treat real route strings as prefixes: they must look like a
        # segment followed by a separator, or be a bare "admin/" style route.
        if re.fullmatch(r"[a-z0-9_-]+", first) and ("/" in route):
            found.add(first)
    return found


def proxied_prefixes():
    """Prefixes listed in the nginx proxy location regex."""
    text = NGINX_TEMPLATE.read_text(encoding="utf-8")
    match = re.search(r"location\s+~\s+\^/\(([^)]*)\)", text)
    assert match, "nginx template no longer has a proxy location regex"
    return {part.strip().strip("/") for part in match.group(1).split("|") if part.strip()}


def test_nginx_proxies_every_django_prefix():
    required = (top_level_prefixes() | EXTRA_REQUIRED_PREFIXES) - NOT_OURS
    missing = sorted(required - proxied_prefixes())
    assert not missing, (
        f"deploy/nginx.conf.template does not proxy {missing}; those paths will "
        f"return an nginx 404 in Docker even though Django serves them"
    )


def test_ops_console_route_is_proxied():
    assert "ops" in proxied_prefixes()
