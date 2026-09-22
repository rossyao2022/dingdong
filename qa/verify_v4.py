"""Browser regression for ordered RIASEC islands and supplied fingerprint / robot material."""
import itertools
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

BASE=os.environ.get('DINGDONG_BASE','http://127.0.0.1:4184/dingdong/')
OUT=Path(__file__).parent
results=[]
errors=[]
failed=[]
def done(name):
    results.append(name)
    print('PASS',name,flush=True)

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,channel='chromium')
    context=browser.new_context(viewport={'width':1440,'height':1000},reduced_motion='reduce')
    page=context.new_page()
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('response',lambda r:failed.append({'url':r.url,'status':r.status}) if r.status>=400 else None)
    def route(name='explore'):
        page.goto(BASE+'#'+name,wait_until='networkidle')
    def act(name):
        page.locator('[data-interest-action="'+name+'"]').first.click()
    def choose(ids):
        for id in ids: page.locator('[data-world-id="'+id+'"]').click()
    def state(): return page.evaluate('window.IslandExplorer.exportData()')
    page.goto(BASE,wait_until='networkidle')
    expect(page.locator('.island-v4')).to_have_count(6)
    assert page.locator('.island-v4').evaluate_all('(xs)=>xs.map(x=>x.dataset.worldId)')==list('RIASEC')
    expect(page.locator('.interest-start')).to_be_disabled()
    done('Six RIASEC islands and gated three-island entry')
    choose('RIA')
    expect(page.locator('.is-chosen')).to_have_count(3)
    expect(page.locator('#interest-map')).to_have_attribute('data-selected','RIA')
    page.locator('[data-world-id=S]').click()
    assert state()['selected']==list('RIA')
    expect(page.locator('#island-selection-message')).to_contain_text('装满')
    page.locator('[data-interest-action=earlier][data-id=A]').click()
    assert state()['selected']==list('RAI')
    page.locator('[data-interest-action=remove][data-id=A]').click()
    expect(page.locator('.interest-start')).to_be_disabled()
    choose('S')
    assert state()['selected']==list('RIS')
    page.reload(wait_until='networkidle')
    assert state()['selected']==list('RIS')
    done('Limit, ordered slots, removal, reorder and refresh persistence')
    act('start')
    expect(page.locator('[data-interest-action=next]')).to_be_disabled()
    page.locator('[data-interest-action=answer][data-rating="0"]').click()
    act('next')
    expect(page.locator('.interest-question-meta')).to_contain_text('2 / 9')
    act('previous')
    expect(page.locator('[data-interest-action=answer][data-rating="0"]')).to_have_attribute('aria-pressed','true')
    page.keyboard.press('Escape')
    page.reload(wait_until='networkidle')
    act('start')
    expect(page.locator('[data-interest-action=answer][data-rating="0"]')).to_have_attribute('aria-pressed','true')
    page.keyboard.press('Escape')
    done('Zero rating, previous question and resumable answers')
    for ids in itertools.combinations('RIASEC',3):
        page.evaluate('window.IslandExplorer.reset()')
        # Dispatch the same DOM click handlers for all 20 combinations.
        page.evaluate('(ids)=>ids.forEach(id=>document.querySelector(`[data-world-id="${id}"]`).click())',list(ids))
        page.evaluate('document.querySelector("[data-interest-action=start]").click()')
        for index in range(9):
            expected_id=ids[index//3]
            assert expected_id in page.locator('.interest-code-badge').inner_text()
            rating=index%5
            page.evaluate('(rating)=>{document.querySelector(`[data-interest-action=answer][data-rating="${rating}"]`).click();document.querySelector("[data-interest-action=next]").click();}',rating)
        expect(page.locator('.interest-profile')).to_have_count(3)
        assert [t.strip() for t in page.locator('.interest-profile-title>span').all_text_contents()]==list(ids)
        assert state()['completed'] and len(state()['answers'])==9
        assert '1.0' in page.locator('.interest-profile').nth(0).inner_text()
        assert '2.3' in page.locator('.interest-profile').nth(1).inner_text()
        assert '2.0' in page.locator('.interest-profile').nth(2).inner_text()
        act('back')
    done('All 20 three-island combinations produce nine corresponding prompts and three scored profiles')
    page.evaluate('window.IslandExplorer.reset()')
    choose('RIA');act('start')
    page.locator('[data-interest-action=answer][data-rating="4"]').click()
    page.keyboard.press('Escape')
    page.locator('[data-interest-action=earlier][data-id=I]').click()
    assert not state()['answers'] and not state()['completed']
    done('Changing a combination invalidates prior answers and results')
    for ids in ['RIA','SEC']:
        page.evaluate('window.IslandExplorer.reset()')
        choose(ids);act('start')
        for _ in range(9):
            page.locator('[data-interest-action=answer][data-rating="4"]').click();act('next')
        for id in ids:
            if not page.locator('.interest-result').count(): act('start')
            page.locator('[data-interest-action=task][data-id="'+id+'"]').click()
            expect(page.locator('.instructions li')).to_have_count(3)
            page.keyboard.press('Escape')
    done('All six result directions link to a real guided activity')
    route('fingerprint')
    expected={'whorl':('斗纹','认知型'),'loop':('正箕纹','模仿型'),'reverse':('反箕纹','逆思型'),'arch':('弧纹','开放型')}
    for id,(label,title) in expected.items():
        page.locator('[data-fp-pattern="'+id+'"]').click()
        expect(page.locator('#fp-guide-title')).to_contain_text(title)
        expect(page.locator('.fp-guide-columns article')).to_have_count(3)
        expect(page.locator('.fp-guide-header')).to_contain_text(label)
        expect(page.locator('.fp-guide-footnote')).to_contain_text('指纹仅用于形态观察')
        assert page.locator('.fp-pattern [src="assets/fingerprints/'+id+'.webp"]').evaluate('(img)=>img.complete&&img.naturalWidth>0')
        page.locator('[data-fp-action=read-guide]').click()
        assert page.url.endswith('#fingerprint')
    page.screenshot(path=str(OUT/'v4-fingerprint-desktop.png'),full_page=True)
    page.locator('[data-fp-action=reset]').click()
    expect(page.locator('#fp-guide-report')).to_have_count(0)
    done('Four original fingerprint images map to the correct complete reference cards; reset clears the card')
    for width in [360,390,768,1024,1440]:
        page.set_viewport_size({'width':width,'height':900})
        for name in ['explore','fingerprint','home','companion','journey','reports','settings','services']:
            route(name)
            if name=='fingerprint': page.locator('[data-fp-pattern=reverse]').click()
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),(width,name)
        route()
        act('start')
        assert page.evaluate('document.querySelector("#dialog").scrollWidth<=document.querySelector("#dialog").clientWidth+1'),(width,'result')
        act('review')
        assert page.evaluate('document.querySelector("#dialog").scrollWidth<=document.querySelector("#dialog").clientWidth+1'),(width,'question')
        page.keyboard.press('Escape')
    done('Eight pages, long fingerprint cards, questions and results fit five screen widths')
    page.set_viewport_size({'width':1440,'height':1000})
    route();page.evaluate('window.IslandExplorer.reset()');choose('RIA')
    page.screenshot(path=str(OUT/'v4-explore-desktop.png'),full_page=True)
    act('start')
    page.screenshot(path=str(OUT/'v4-question-desktop.png'),full_page=True)
    page.keyboard.press('Escape')
    page.set_viewport_size({'width':390,'height':844})
    route();page.screenshot(path=str(OUT/'v4-explore-mobile.png'),full_page=True)
    route('fingerprint');page.locator('[data-fp-pattern=whorl]').click()
    page.screenshot(path=str(OUT/'v4-fingerprint-mobile.png'),full_page=True)
    route();page.evaluate('window.IslandExplorer.reset()')
    target=page.locator('[data-world-id=R]');target.focus();page.keyboard.press('Enter')
    target=page.locator('[data-world-id=I]');target.focus();page.keyboard.press('Space')
    choose('A');act('start');target=page.locator('[data-interest-action=answer][data-rating="4"]');target.focus();page.keyboard.press('Space')
    expect(target).to_have_attribute('aria-pressed','true')
    page.keyboard.press('Escape')
    done('Keyboard operation selects islands and answers, and Escape closes the dialog')
    route('settings')
    page.locator('[data-action=reset-dialog]').click();page.locator('[data-action=reset]').click()
    assert state()['selected']==[] and state()['answers']=={}
    done('Account reset also clears the new island data')
    malformed=browser.new_context()
    malformed.add_init_script('localStorage.setItem("dingdong-islands-v4",JSON.stringify({version:"dingdong-interest-1",selected:["R","R","evil"],answers:{},index:99,completed:true}))')
    mp=malformed.new_page();mp.goto(BASE,wait_until='networkidle')
    assert mp.evaluate('window.IslandExplorer.exportData().selected.length')==0
    malformed.close()
    blocked=browser.new_context()
    blocked.add_init_script('Object.defineProperty(window,"localStorage",{get(){throw new Error("blocked")}})')
    bp=blocked.new_page();bp.goto(BASE,wait_until='networkidle')
    expect(bp.locator('.island-v4')).to_have_count(6)
    for id in 'RIA': bp.locator('[data-world-id="'+id+'"]').click()
    bp.locator('[data-interest-action=start]').click()
    expect(bp.locator('.interest-question-note')).to_contain_text('仅在页面内')
    blocked.close()
    done('Malformed and unavailable local storage degrade safely')
    assert not errors,errors
    assert not failed,failed
    assert page.evaluate('[...document.images].every(img=>img.complete&&img.naturalWidth>0)')
    done('No JavaScript errors, failed assets or broken images')
    browser.close()
(OUT/'verification-v4-results.json').write_text(json.dumps({'url':BASE,'passed':len(results),'checks':results,'javascript_errors':errors,'failed_requests':failed},ensure_ascii=False,indent=2),encoding='utf-8')
print('V4 checks passed:',len(results),flush=True)
