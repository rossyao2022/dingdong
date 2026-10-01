"""All runtime legacy bridge resources must survive every supported web build."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
BRIDGES = ["daily", "test", "result", "thumb", "island", "blindbox", "report"]
RESOURCES = ["guide-preference.js", "legacy.js", *[f"{name}.html" for name in BRIDGES]]
RESOURCES.extend(["dingdong-report.js", "bootstrap.js", "experience-flow.js"])


def test_legacy_resources_in_every_web_image():
    for dockerfile in ["Dockerfile.web", "Dockerfile.web.from-v0319", "Dockerfile.web.from-v0320"]:
        text = (ROOT / "deploy" / dockerfile).read_text()
        copy_lines = "\n".join(line for line in text.splitlines() if line.startswith("COPY frontend/"))
        for resource in RESOURCES:
            assert f"frontend/{resource}" in copy_lines, (dockerfile, resource)
            assert (ROOT / "frontend" / resource).is_file(), resource


def test_legacy_html_allowed_into_build_context_and_served_by_nginx():
    ignore = (ROOT / ".dockerignore").read_text().splitlines()
    for name in BRIDGES:
        assert f"!frontend/{name}.html" in ignore
    nginx = (ROOT / "deploy/nginx.conf.template").read_text()
    assert re.search(r"location\s+/\s*\{\s*try_files\s+\$uri\s+\$uri/\s+=404;\s*\}", nginx)
    version = (ROOT / "VERSION").read_text().strip()
    for name in BRIDGES:
        html = (ROOT / "frontend" / f"{name}.html").read_text()
        assert '<meta name="referrer" content="no-referrer"' in html
        assert f'type="module" src="legacy.js?v={version}"' in html
        assert "<meta http-equiv" not in html, "redirect must discard untrusted URL arguments"
