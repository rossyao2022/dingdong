"""V3 regression checks for exploration, local fingerprint tools, and responsive pages."""
import base64
import json
import struct
import sys
import traceback
import zlib
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import expect, sync_playwright

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

ROOT = Path(__file__).parent
BASE = 'http://127.0.0.1:4173/dingdong/'
RESULT_PATH = ROOT / 'verification-v3-results.json'
checks = []
errors = []
responsive_details = []


def check(name, fn):
    if '--camera-only' in sys.argv and 'camera' not in name.lower():
        return
    try:
        detail = fn()
        checks.append({'name': name, 'status': 'passed', 'detail': detail})
        print('PASS: ' + name, flush=True)
    except Exception as exc:
        checks.append({'name': name, 'status': 'failed', 'error': str(exc), 'traceback': traceback.format_exc()})
        print('FAIL: ' + name + ': ' + str(exc), flush=True)
    RESULT_PATH.write_text(json.dumps({'passed': sum(c['status'] == 'passed' for c in checks), 'failed': sum(c['status'] == 'failed' for c in checks), 'checks': checks, 'javascript_errors': errors, 'responsive_details': responsive_details}, ensure_ascii=False, indent=2), encoding='utf-8')


def png_bytes():
    # Synthetic in-memory image; this test never uses a person's biometric image.
    def chunk(kind, data):
        return struct.pack('!I', len(data)) + kind + data + struct.pack('!I', zlib.crc32(kind + data) & 0xffffffff)
    rows = b''.join(b'\0' + bytes([116, 174, 161, 255]) * 16 for _ in range(16))
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('!2I5B', 16, 16, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(rows)) + chunk(b'IEND', b'')


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, channel='chromium', args=['--use-fake-device-for-media-stream'])
    context = browser.new_context(viewport={'width': 1440, 'height': 1000}, permissions=['camera'])
    context.add_init_script('''
      window.__qaTracks = [];
      window.__qaMediaErrors = [];
      if (navigator.mediaDevices?.getUserMedia) {
        const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
        navigator.mediaDevices.getUserMedia = async (...args) => {
          let stream;
          try { stream = await original(...args); }
          catch (error) { window.__qaMediaErrors.push({name:error.name, message:error.message}); throw error; }
          window.__qaTracks.push(...stream.getTracks());
          return stream;
        };
      }
    ''')
    page = context.new_page()
    page.set_default_timeout(7000)
    page.on('pageerror', lambda err: errors.append(str(err)))

    def route(name=None):
        page.goto(BASE + ('#' + name if name else ''), wait_until='domcontentloaded')
        expect(page.locator('main')).to_be_visible()

    def action(name, scope=None):
        (scope or page).locator('[data-action="' + name + '"]').first.click()

    def fp_action(name):
        page.locator('[data-fp-action="' + name + '"]').first.click()

    def close():
        if page.locator('#dialog').is_visible():
            page.keyboard.press('Escape')
            expect(page.locator('#dialog')).not_to_be_visible()

    def state():
        return page.evaluate('JSON.parse(localStorage.getItem("dingdong-demo-v2"))')

    def default_explore():
        route()
        expect(page.locator('#interest-map')).to_be_visible()
        expect(page.locator('.island-stop')).to_have_count(4)
        expect(page.locator('.discovery-portal')).to_have_count(3)
        expect(page.locator('.fingerprint-portal')).to_have_attribute('href', '#fingerprint')
        expect(page.locator('.adventure-button')).to_be_disabled()
        return {'url': page.url, 'islands': 4, 'portals': 3}
    check('No-hash entry opens exploration map with three discovery portals', default_explore)

    def island_selections():
        route('explore')
        selections = [('science', 'paper-bridge', '科学发现岛', '一张纸，能搭一座桥吗？'), ('story', 'cloud-story', '故事表达岛', '如果云朵有一份工作'), ('nature', 'leaf-look', '自然观察岛', '和一片叶子安静待一会儿'), ('imagination', 'new-use', '创意想象岛', '一把勺子的第二种人生')]
        for island, task_id, title, task_title in selections:
            page.locator('[data-world-id="' + island + '"]').click()
            expect(page.locator('.island-stop[aria-pressed=true]')).to_have_count(1)
            expect(page.locator('[data-world-id="' + island + '"]')).to_have_attribute('aria-pressed', 'true')
            expect(page.locator('#interest-map')).to_have_attribute('data-selected', island)
            expect(page.locator('#world-dock')).to_contain_text(title)
            page.locator('[data-world-action=depart]').click()
            expect(page.locator('#dialog-title')).to_contain_text(task_title)
            assert state()['taskId'] == task_id
            close()
        return {'destinations_verified': 4}
    check('Four islands update visible selection and open the matching activity', island_selections)

    def blindbox():
        route('explore')
        action('blindbox')
        expect(page.locator('.mystery-room')).to_be_visible()
        action('open-box')
        expect(page.locator('.mystery-room')).to_have_class('dialog-body mystery-room opening')
        expect(page.locator('[data-action=open-box]')).to_be_disabled()
        expect(page.locator('.instructions li')).to_have_count(3)
        assert page.locator('#dialog-title').inner_text().strip()
        close()
        action('blindbox')
        action('open-box')
        close()
        page.wait_for_timeout(1500)
        expect(page.locator('#dialog')).not_to_be_visible()
        action('blindbox')
        action('open-box')
        page.evaluate('location.hash = "fingerprint"')
        expect(page.locator('#fingerprint-lab')).to_be_visible()
        page.wait_for_timeout(1500)
        expect(page.locator('#dialog')).not_to_be_visible()
        return {'revealed': True, 'escape_cancellation': True, 'navigation_cancellation': True}
    check('Blindbox animates, reveals an actionable task, and cancels safely', blindbox)

    def fingerprint_patterns():
        route('fingerprint')
        expect(page.locator('.fp-pattern')).to_have_count(4)
        for pattern in ['whorl', 'loop', 'arch', 'reverse']:
            page.locator('[data-fp-pattern="' + pattern + '"]').click()
            expect(page.locator('.fp-pattern[aria-pressed=true]')).to_have_count(1)
            expect(page.locator('[data-fp-pattern="' + pattern + '"]')).to_have_attribute('aria-pressed', 'true')
            expect(page.locator('#fp-observation')).to_contain_text('我的手动观察')
            expect(page.locator('#fp-observation')).to_contain_text('不是能力或性格结论')
        fp_action('reset')
        expect(page.locator('.fp-pattern[aria-pressed=true]')).to_have_count(0)
        fp_action('sample')
        expect(page.locator('#fp-viewfinder')).to_have_class('fp-viewfinder fp-is-scanning')
        expect(page.locator('#fp-status')).to_contain_text('不进行 AI 识别')
        expect(page.locator('#fp-status')).to_contain_text('请手动选择', timeout=5000)
        expect(page.locator('.fp-pattern[aria-pressed=true]')).to_have_count(0)
        expect(page.locator('#fp-stage')).to_contain_text('非真实指纹')
        fp_action('reset')
        expect(page.locator('.fp-empty')).to_be_visible()
        fp_action('sample')
        fp_action('reset')
        page.wait_for_timeout(2600)
        expect(page.locator('.fp-empty')).to_be_visible()
        expect(page.locator('#fp-status')).to_contain_text('还没有准备图片')
        return {'manual_patterns': 4, 'automatic_classification': False, 'scan_reset_cancels_timer': True}
    check('Fingerprint patterns and sample scan retain explicit manual interpretation', fingerprint_patterns)

    def fingerprint_uploads():
        route('fingerprint')
        requests = []
        listener = lambda req: requests.append({'method': req.method, 'url': req.url})
        page.on('request', listener)
        inp = page.locator('#fp-file-input')
        initial_storage = page.evaluate('JSON.stringify({...localStorage})')
        inp.set_input_files({'name': 'synthetic-fingerprint.png', 'mimeType': 'image/png', 'buffer': png_bytes()})
        expect(page.locator('#fp-status')).to_contain_text('图片准备好了')
        expect(page.locator('.fp-user-image')).to_be_visible()
        assert page.locator('.fp-user-image').evaluate('(img) => img.complete && img.naturalWidth === 16 && img.src.startsWith("blob:")')
        fp_action('scan')
        expect(page.locator('#fp-status')).to_contain_text('请手动选择', timeout=5000)
        inp.set_input_files({'name': 'invalid.txt', 'mimeType': 'text/plain', 'buffer': b'not an image'})
        expect(page.locator('#fp-status')).to_contain_text('暂时只能打开')
        inp.set_input_files({'name': 'corrupt.png', 'mimeType': 'image/png', 'buffer': b'not a valid png'})
        expect(page.locator('#fp-status')).to_contain_text('没有成功打开')
        inp.set_input_files({'name': 'empty.png', 'mimeType': 'image/png', 'buffer': b''})
        expect(page.locator('#fp-status')).to_contain_text('非空')
        inp.set_input_files({'name': 'too-large.png', 'mimeType': 'image/png', 'buffer': png_bytes() + b'\0' * (10 * 1024 * 1024)})
        expect(page.locator('#fp-status')).to_contain_text('不超过 10 MB')
        inp.set_input_files({'name': 'exact-limit.png', 'mimeType': 'image/png', 'buffer': png_bytes() + b'\0' * (10 * 1024 * 1024 - len(png_bytes()))})
        expect(page.locator('#fp-status')).to_contain_text('图片准备好了')
        fp_action('reset')
        expect(page.locator('.fp-empty')).to_be_visible()
        assert inp.input_value() == ''
        assert page.evaluate('JSON.stringify({...localStorage})') == initial_storage
        page.remove_listener('request', listener)
        network = [r for r in requests if r['url'].startswith(('http:', 'https:'))]
        assert network == [], network
        return {'valid_png': True, 'invalid_format': True, 'invalid_data': True, 'zero_bytes': True, 'over_10_mb_rejected': True, 'exact_10_mb_accepted': True, 'network_requests_during_upload': network, 'local_storage_unchanged': True}
    check('Local image upload validates format and 10 MB boundary without network or storage writes', fingerprint_uploads)

    def camera_capture():
        route('fingerprint')
        fp_action('camera')
        try:
            expect(page.locator('.fp-camera-video')).to_be_visible()
        except Exception:
            raise AssertionError({'media_errors': page.evaluate('window.__qaMediaErrors'), 'status': page.locator('#fp-status').inner_text()})
        page.wait_for_function('document.querySelector(".fp-camera-video")?.videoWidth > 0')
        expect(page.locator('#fp-capture-button')).to_be_visible()
        assert page.evaluate('window.__qaTracks.length > 0 && window.__qaTracks.every(t => t.readyState === "live")')
        fp_action('capture')
        expect(page.locator('#fp-status')).to_contain_text('图片准备好了')
        expect(page.locator('.fp-user-image')).to_be_visible()
        assert page.evaluate('window.__qaTracks.every(t => t.readyState === "ended")')
        fp_action('camera')
        expect(page.locator('.fp-camera-video')).to_be_visible()
        page.wait_for_function('document.querySelector(".fp-camera-video")?.videoWidth > 0')
        page.locator('.fp-back').click()
        expect(page.locator('#interest-map')).to_be_visible()
        assert page.evaluate('window.__qaTracks.every(t => t.readyState === "ended")')
        page.evaluate('location.hash = "fingerprint"')
        expect(page.locator('#fingerprint-lab')).to_be_visible()
        fp_action('camera')
        expect(page.locator('.fp-camera-video')).to_be_visible()
        page.wait_for_function('document.querySelector(".fp-camera-video")?.videoWidth > 0')
        fp_action('reset')
        expect(page.locator('.fp-empty')).to_be_visible()
        assert page.evaluate('window.__qaTracks.every(t => t.readyState === "ended")')
        return {'fake_camera': True, 'capture_stops_tracks': True, 'spa_navigation_stops_tracks': True, 'reset_stops_tracks': True}
    check('Camera capture, navigation and reset release every media track', camera_capture)

    def camera_permission_rejection():
        denied_context = browser.new_context()
        denied = denied_context.new_page()
        denied.set_default_timeout(7000)
        denied.on('pageerror', lambda err: errors.append(str(err)))
        denied.goto(BASE + '#fingerprint', wait_until='domcontentloaded')
        cdp = denied_context.new_cdp_session(denied)
        context_id = cdp.send('Target.getTargetInfo')['targetInfo']['browserContextId']
        cdp.send('Browser.setPermission', {'permission': {'name': 'camera'}, 'setting': 'denied', 'origin': 'http://127.0.0.1:4173', 'browserContextId': context_id})
        denied.locator('[data-fp-action=camera]').click()
        expect(denied.locator('#fp-status')).to_contain_text('相机权限没有开启')
        expect(denied.locator('#fp-status')).to_contain_text('选择一张指纹图片')
        expect(denied.locator('[data-fp-action=camera]')).to_be_enabled()
        expect(denied.locator('.fp-empty')).to_be_visible()
        denied_context.close()
        return {'actual_browser_permission': 'denied', 'alternative_action_visible': True}
    check('Denied camera permission gives a helpful image-upload alternative', camera_permission_rejection)

    def keyboard():
        route('explore')
        target = page.locator('[data-world-id=science]')
        target.focus()
        page.keyboard.press('Enter')
        expect(target).to_have_attribute('aria-pressed', 'true')
        target = page.locator('[data-world-id=nature]')
        target.focus()
        page.keyboard.press('Space')
        expect(target).to_have_attribute('aria-pressed', 'true')
        page.locator('[data-world-action=depart]').focus()
        page.keyboard.press('Enter')
        expect(page.locator('#dialog')).to_be_visible()
        page.keyboard.press('Escape')
        expect(page.locator('#dialog')).not_to_be_visible()
        page.locator('.fingerprint-portal').focus()
        page.keyboard.press('Enter')
        expect(page.locator('#fingerprint-lab')).to_be_visible()
        page.locator('[data-fp-pattern=arch]').focus()
        page.keyboard.press('Space')
        expect(page.locator('[data-fp-pattern=arch]')).to_have_attribute('aria-pressed', 'true')
        page.locator('[data-fp-pattern=loop]').focus()
        page.keyboard.press('Enter')
        expect(page.locator('[data-fp-pattern=loop]')).to_have_attribute('aria-pressed', 'true')
        page.keyboard.press('Tab')
        assert page.evaluate('document.activeElement.matches("button, a, input, select, textarea")')
        return {'enter': True, 'space': True, 'escape': True, 'tab': True}
    check('Islands, portals and fingerprint choices work with keyboard input', keyboard)

    def responsive():
        overflow = []
        for width in [360, 390, 768, 1024, 1440]:
            page.set_viewport_size({'width': width, 'height': 900})
            for name in ['home', 'journey', 'explore', 'companion', 'reports', 'settings', 'services', 'fingerprint']:
                route(name)
                detail = page.evaluate('''() => ({viewport:innerWidth, documentWidth:document.documentElement.scrollWidth, pages:[...document.querySelectorAll('.page')].map(el=>({id:el.id, class:el.className, width:el.clientWidth, scrollWidth:el.scrollWidth}))})''')
                detail.update({'width': width, 'route': name})
                responsive_details.append(detail)
                if detail['documentWidth'] > width + 1 or any(v['scrollWidth'] > v['width'] + 1 for v in detail['pages']):
                    overflow.append(detail)
        assert not overflow, json.dumps(overflow, ensure_ascii=False)
        return {'pages': 8, 'widths': [360, 390, 768, 1024, 1440], 'combinations': 40, 'nested_page_overflow_checked': True}
    check('Eight pages and nested containers fit all five responsive widths', responsive)

    def legacy_thumb():
        page.goto(BASE + 'thumb.html', wait_until='domcontentloaded')
        page.wait_for_url('**#fingerprint')
        expect(page.locator('#fingerprint-lab')).to_be_visible()
        return {'destination': page.url}
    check('Legacy thumb.html redirects to the restored fingerprint experience', legacy_thumb)

    def reduced_motion():
        page.emulate_media(reduced_motion='reduce')
        route('fingerprint')
        fp_action('sample')
        expect(page.locator('#fp-status')).to_contain_text('请手动选择', timeout=1500)
        route('explore')
        action('blindbox')
        action('open-box')
        expect(page.locator('.instructions li')).to_have_count(3, timeout=1500)
        close()
        page.emulate_media(reduced_motion='no-preference')
        return {'sample_scan': True, 'blindbox': True}
    check('Reduced-motion preference preserves completion of animated interactions', reduced_motion)

    def no_js_errors():
        assert errors == [], errors
        return {'pageerror_count': 0}
    check('No uncaught JavaScript errors throughout V3 checks', no_js_errors)
    context.close()
    browser.close()

print(json.dumps({'passed': sum(c['status'] == 'passed' for c in checks), 'failed': sum(c['status'] == 'failed' for c in checks), 'result': str(RESULT_PATH)}, ensure_ascii=False), flush=True)
raise SystemExit(1 if any(c['status'] == 'failed' for c in checks) else 0)
