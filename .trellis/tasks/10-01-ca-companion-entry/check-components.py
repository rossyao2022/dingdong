"""Real Chromium component checks, not authenticated API or supplier acceptance.

Uses production renderer/CSS and existing Storybook-only synthetic inputs.
All artifacts and browser temporary files stay inside this checkout.
"""

import json
import os
import re
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[3]
FRONTEND = ROOT / "frontend"
OUT = FRONTEND / "test-results/companion-entry-component"
for directory in [OUT, OUT / "tmp", OUT / "home", OUT / "cache"]:
    directory.mkdir(parents=True, exist_ok=True)
os.environ.update(
    TMPDIR=str(OUT / "tmp"), TMP=str(OUT / "tmp"), TEMP=str(OUT / "tmp"),
    HOME=str(OUT / "home"), XDG_CACHE_HOME=str(OUT / "cache"),
    XDG_CONFIG_HOME=str(OUT / "home/config"),
)

from playwright.sync_api import sync_playwright, expect  # noqa: E402

URL = "https://www.dingdongrobo.top/dingdong/companion/main"
LABEL = "进入 DINGDONG 天赋陪伴空间"
styles = re.findall(r'<link rel="stylesheet" href="([^"]+)"', (FRONTEND / "index.html").read_text())
HARNESS = ("<!doctype html><html lang='zh-CN'><meta charset='utf-8'>"
           "<meta name='viewport' content='width=device-width,initial-scale=1'>"
           "<title>CA companion component verification</title>"
           + "".join(f'<link rel="stylesheet" href="/{style}">' for style in styles)
           + "<body><div class='app-shell'><main id='main'></main></div>"
           "<script type='module'>"
           "import * as stories from '/stories/dingdong-report.stories.js';"
           "import * as components from '/dingdong-report.js';"
           "window.stories=stories;window.components=components;"
           "</script></body></html>").encode()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def do_GET(self):
        path = urlsplit(self.path).path
        if path == "/":
            data, kind = HARNESS, "text/html; charset=utf-8"
        elif re.fullmatch(r"/[a-zA-Z0-9_./-]+\.(?:js|css|svg|webp|png)", path):
            file = (FRONTEND / path.lstrip("/")).resolve()
            if not file.is_relative_to(FRONTEND) or not file.is_file():
                self.send_error(404)
                return
            data = file.read_bytes()
            kind = {".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml",
                    ".webp": "image/webp", ".png": "image/png"}[file.suffix]
        else:
            self.send_error(404)
            return
        self.send_response(200)
        self.send_header("Content-Type", kind)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Referrer-Policy", "no-referrer")
        self.end_headers()
        self.wfile.write(data)


server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
thread = threading.Thread(target=server.serve_forever, daemon=True)
thread.start()
base = f"http://127.0.0.1:{server.server_port}/"
results, attempted_navigation, errors = [], [], []


def render(page, story, report=False):
    page.evaluate("([story,report]) => { document.querySelector('#main').innerHTML = "
                  "window.stories[story].render() + (report ? window.stories.Ready.render() : ''); }",
                  [story, report])


try:
    with sync_playwright() as playwright:
        context = playwright.chromium.launch_persistent_context(
            user_data_dir=str(OUT / "profile"), executable_path="/usr/bin/chromium",
            headless=True, locale="zh-CN", args=["--disable-dev-shm-usage"],
        )

        def network_guard(route):
            if route.request.url.startswith(base):
                route.continue_()
            else:
                attempted_navigation.append({"url": route.request.url,
                                             "headers": route.request.headers})
                route.abort()  # Do not contact the real vendor or start a shared session.

        context.route("**/*", network_guard)
        page = context.pages[0]
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(base)
        page.wait_for_function("!!window.stories && !!window.components")
        for width, height in [(1280, 900), (768, 1024), (390, 844), (320, 700)]:
            page.set_viewport_size({"width": width, "height": height})
            render(page, "BoundRobot", report=True)
            link = page.get_by_role("link", name=LABEL, exact=True)
            expect(link).to_be_visible()
            expect(link).to_have_attribute("href", URL)
            expect(link).to_have_attribute("target", "_blank")
            expect(link).to_have_attribute("rel", "noopener noreferrer")
            expect(page.locator("iframe")).to_have_count(0)
            expect(page.locator('.robot-entry a[href="#exhibition"]')).to_have_count(0)
            expect(page.get_by_role("link", name="管理机器人", exact=True)).to_be_visible()
            expect(page.locator(".dd-report-row")).to_have_count(9)
            expect(page.locator("[data-action=dingdong-weekly-turns]")).to_have_count(4)
            expect(page.locator('[data-action=dingdong-weekly-turns][data-value="7"]')).to_have_attribute("aria-pressed", "true")
            expect(page.get_by_role("button", name="刷新陪伴变化", exact=True)).to_be_visible()
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
            assert link.evaluate("el => el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight")
            page.screenshot(path=str(OUT / f"bound-report-{width}.png"), full_page=True)
            results.append({"case": "bound-link-report-layout", "width": width, "passed": True})
            render(page, "UnboundRobot")
            expect(page.get_by_role("link", name=LABEL, exact=True)).to_have_count(0)
            expect(page.get_by_role("button", name="绑定机器人", exact=True)).to_be_visible()
            expect(page.locator('.robot-entry a[href="#exhibition"]')).to_be_visible()
            expect(page.get_by_role("link", name="管理机器人", exact=True)).to_have_count(0)
            page.screenshot(path=str(OUT / f"unbound-{width}.png"), full_page=True)
            results.append({"case": "unbound-visibility", "width": width, "passed": True})
        for story, text in [("PendingRobot", "继续连接"), ("UnknownRobot", "重新读取")]:
            render(page, story)
            expect(page.get_by_role("link", name=LABEL, exact=True)).to_have_count(0)
            expect(page.locator("#main")).to_contain_text(text)
            expect(page.get_by_role("link", name="管理机器人", exact=True)).to_have_count(0)
            results.append({"case": story, "passed": True})
        render(page, "BoundRobot")
        before = page.url
        with context.expect_page() as opened:
            page.get_by_role("link", name=LABEL, exact=True).click()
        popup = opened.value
        page.wait_for_timeout(250)
        assert page.url == before
        assert attempted_navigation and attempted_navigation[-1]["url"] == URL
        headers = attempted_navigation[-1]["headers"]
        assert not any(key in headers for key in ["cookie", "authorization", "referer", "x-api-key"])
        popup.close()
        results.append({"case": "new-tab-navigation-blocked-before-vendor", "passed": True})
        for story, text in [("Empty", "还没有陪伴成长记录"), ("Error", "暂时无法读取"),
                            ("Loading", "正在读取")]:
            render(page, story)
            expect(page.locator("#main")).to_contain_text(text)
            results.append({"case": story, "passed": True})
        assert not errors, errors
        context.close()
finally:
    server.shutdown()

report = {"scope": "Local real Chromium production component/CSS with Storybook synthetic inputs; no API mocks, no authenticated E2E, no vendor request",
          "results": results, "page_errors": errors,
          "blocked_vendor_navigation": [item["url"] for item in attempted_navigation]}
(OUT / "verification.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
print(json.dumps(report, ensure_ascii=False, indent=2))
