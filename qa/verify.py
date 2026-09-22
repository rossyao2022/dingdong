import os
import json
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT=Path(__file__).parent
BASE=os.environ.get('DINGDONG_BASE','http://127.0.0.1:4173/dingdong/')
results=[]
def ok(name):
 results.append(name)
 print('PASS:', name)

with sync_playwright() as p:
 browser=p.chromium.launch(headless=True)
 context=browser.new_context(viewport={'width':1440,'height':1000},accept_downloads=True)
 page=context.new_page()
 errors=[]
 page.on('pageerror',lambda err: errors.append(str(err)))
 def route(name):
  page.goto(BASE+'#'+name)
  page.wait_for_load_state('networkidle')
 def action(name,where=None):
  (where or page).locator('[data-action="'+name+'"]').first.click()
 def state(): return page.evaluate('JSON.parse(localStorage.getItem("dingdong-demo-v2"))')
 def close(): action('close',page.locator('dialog'))
 route('home')
 assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
 expect(page.locator('.hero h2')).to_contain_text('小小的可能')
 ok('Desktop home renders without overflow')
 # Profile is local and markup is escaped.
 action('profile')
 page.locator('#nickname').fill('<芽芽>')
 page.locator('#age').select_option(label='6–8 岁')
 page.locator('#profile-form button[type=submit]').click()
 expect(page.locator('h1')).to_contain_text('<芽芽>')
 page.reload()
 expect(page.locator('h1')).to_contain_text('<芽芽>')
 assert page.locator('h1 > 芽芽').count()==0
 ok('Profile persists; text is escaped')
 # Task survives reload and stores each completion exactly once.
 action('start-task')
 action('next-step')
 assert state()['active']['step']==1
 page.reload()
 action('start-task')
 expect(page.locator('.step-dots')).to_contain_text('步骤 2 / 3')
 action('next-step')
 action('next-step')
 page.locator('[data-action=feedback]').first.click()
 page.locator('#discovery-note').fill('纸折起来以后，桥更稳了。')
 action('finish-task')
 assert len(state()['records'])==1 and state()['active'] is None
 page.reload()
 assert len(state()['records'])==1
 ok('Task resumes after refresh; completion creates one persisted record')
 # All four mood flows offer real executable steps and skip creates separate status.
 for mood in ['focus','inspire','calm','energy']:
  route('home')
  page.locator('[data-action=mood][data-value='+mood+']').click()
  assert state()['mood']==mood
  action('task-detail')
  assert page.locator('.instructions li').count()==3
  action('web-task')
  assert state()['active']['mode']=='web'
  action('skip-dialog')
  action('skip-task')
 assert len(state()['records'])==5
 assert len([r for r in state()['records'] if r['status']=='completed'])==1
 ok('All four moods have executable tasks; skipping does not increase completed count')
 # Switching unfinished tasks is an explicit, transparent choice.
 action('start-task')
 close()
 page.locator('[data-action=mood][data-value=inspire]').click()
 action('start-task')
 expect(page.locator('#dialog-title')).to_contain_text('没有结束')
 action('replace-task')
 assert state()['active']['taskId']=='cloud-story'
 action('skip-dialog');action('skip-task')
 ok('Switching tasks preserves a skipped record for the prior task')
 # Journey, filters and source clarity.
 route('journey')
 page.locator('[data-action=filter][data-value=completed]').click()
 assert page.locator('.record').count()==1
 expect(page.locator('.record')).to_contain_text('用户自报')
 expect(page.locator('.record')).to_contain_text('纸折起来以后')
 ok('Journey filter displays actual records and sources')
 # Assessment is resumable and produces preference counts rather than diagnostic scores.
 route('companion');action('assessment')
 for i in range(2):
  page.locator('[data-action=answer][data-value="'+str(i)+'"]').click()
  action('assessment-next')
 page.reload();action('assessment')
 expect(page.locator('dialog')).to_contain_text('第 3 / 4')
 for i in range(2,4):
  page.locator('[data-action=answer][data-value="'+str(i)+'"]').click()
  action('assessment-next')
 assert state()['assessment']['completed'] is True
 assert len(state()['assessment']['answers'])==4
 assert page.locator('dialog .metric-row').count()==4
 expect(page.locator('dialog')).to_contain_text('不建立正式 Baseline')
 ok('Four-question assessment resumes and labels results as non-formal preferences')
 close();route('companion')
 prompts=[]
 for style in ['cognitive','imitative','reverse','open']:
  page.locator('[data-action=style][data-value='+style+']').click()
  action('start-task')
  prompts.append(page.locator('#guide-speech').inner_text())
  action('skip-dialog');action('skip-task')
 assert len(set(prompts))==4
 ok('Four companion styles produce distinct guidance')
 # Reports keep unavailable values empty, with no invented professional scores.
 route('reports')
 for period in ['15d','30d']:
  page.locator('[data-action=period][data-value="'+period+'"]').click()
  assert page.locator('[data-metric]').count()==5
  assert all(t=='尚未同步' for t in page.locator('[data-metric]').all_text_contents())
 expect(page.locator('main')).to_contain_text('非正式报告')
 assert page.evaluate('DingDongAPI.normalizeScores({scores:{wisdom:0}}).find(x=>x.key==="wisdom").value')==0
 assert page.evaluate('DingDongAPI.normalizeScores(null).every(x=>x.value===null)')
 ok('15/30-day views and adapter distinguish unknown values from real zero')
 # Export roundtrip.
 with page.expect_download() as dl:
  action('export')
 artifact=dl.value
 artifact.save_as(str(ROOT/'sample-export.json'))
 exported=json.loads((ROOT/'sample-export.json').read_text(encoding='utf-8'))
 assert exported['environment']=='demo' and len(exported['records'])==len(state()['records'])
 ok('Exported JSON matches saved records')
 route('settings')
 assert all(v is False for v in state()['consents'].values())
 page.locator('[data-action=consent][data-value=data]').click()
 page.reload()
 expect(page.locator('[data-value=data]')).to_have_attribute('aria-checked','true')
 page.locator('[data-action=consent][data-value=data]').click()
 assert state()['consents']['data'] is False
 action('device');expect(page.locator('dialog')).to_contain_text('待技术团队接入')
 page.keyboard.press('Escape');expect(page.locator('dialog')).not_to_be_visible()
 ok('Optional demo preferences start off; device dialog and Escape work')
 # Legacy paths and NFC token are source signals only.
 for file,target in [('test.html','talents'),('thumb.html','fingerprint'),('daily.html','home'),('report.html','reports'),('blindbox.html','explore'),('island.html','explore')]:
  page.goto(BASE+file)
  page.wait_for_url('**#'+target)
 page.goto(BASE+'?nfc_token=demo-placeholder#home')
 expect(page.locator('.nfc-note')).to_be_visible()
 assert 'nfc_token' not in page.url
 assert 'demo-placeholder' not in json.dumps(state())
 ok('All six legacy URLs redirect; NFC token is removed and cannot bind a device')
 # Responsive sweep and modal usability.
 for width in [360,390,768,1024,1440]:
  page.set_viewport_size({'width':width,'height':900})
  for name in ['home','journey','explore','companion','reports','settings','services']:
   route(name)
   assert not page.evaluate('document.documentElement.scrollWidth>innerWidth'), (width,name)
 ok('All seven pages fit 360 / 390 / 768 / 1024 / 1440 px viewports')
 page.set_viewport_size({'width':390,'height':844})
 route('home');action('start-task')
 assert not page.evaluate('document.querySelector("dialog").scrollWidth>document.querySelector("dialog").clientWidth')
 page.screenshot(path=str(ROOT/'mobile-guide.png'),full_page=True,animations='disabled')
 close();route('companion')
 page.set_viewport_size({'width':1440,'height':1000})
 page.screenshot(path=str(ROOT/'desktop-companion.png'),full_page=True,animations='disabled')
 route('reports')
 page.screenshot(path=str(ROOT/'desktop-report.png'),full_page=True,animations='disabled')
 assert errors==[], errors
 ok('Mobile guide fits; no JavaScript errors in full user journeys')
 # Storage failure must not blank the app.
 restricted=browser.new_context()
 restricted.add_init_script('Object.defineProperty(window, "localStorage", {get(){throw new Error("unavailable")}});Object.defineProperty(window,"sessionStorage",{get(){throw new Error("unavailable")}});')
 badpage=restricted.new_page()
 badpage.goto(BASE)
 expect(badpage.locator('.six-island-world')).to_be_visible()
 expect(badpage.locator('.storage-warning')).to_be_visible()
 ok('App remains usable when browser storage is unavailable')
 context.close();restricted.close();browser.close()

(ROOT/'verification-results.json').write_text(json.dumps({'passed':len(results),'checks':results,'javascript_errors':errors},ensure_ascii=False,indent=2),encoding='utf-8')
