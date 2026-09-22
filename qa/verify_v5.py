"""Verify original questionnaire fidelity, score boundaries and the full new user journey."""
from pathlib import Path
import os,json,re,itertools,hashlib
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
BASE=os.environ.get('DINGDONG_BASE','http://127.0.0.1:4184/dingdong/')
results=[];errors=[]
def done(s):results.append(s);print('PASS',s,flush=True)
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,channel='chromium')
 context=browser.new_context(viewport={'width':1440,'height':1000},reduced_motion='reduce')
 page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(BASE,wait_until='networkidle')
 expect(page.locator('.island-v4')).to_have_count(6)
 assert page.locator('.island-v4>img').evaluate_all('(els)=>els.every(e=>e.src.includes("/generated/")&&e.naturalWidth>0)')
 assert len(set(page.locator('.island-v4>img').evaluate_all('(els)=>els.map(e=>e.src)')))==6
 page.screenshot(path=str(ROOT/'qa/v5-explore-desktop.png'),full_page=True)
 page.locator('.talent-summary').first.click();expect(page.locator('.talent-intro-grid article')).to_have_count(8)
 texts=page.evaluate('TalentData.questions.map(q=>q.text)')
 assert len(texts)==24 and hashlib.sha256(json.dumps(texts,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()=='7da3e8c61736bb439dd761e3ae29e7c7f8e1f76f4f039214186a87ee7738c225'
 assert page.evaluate('TalentExplorer.exportData().scores') is None
 done('Six generated islands and eight talent entry; exact original 24 prompts; no fabricated scores')
 def act(name):page.locator('[data-talent-action='+name+']').click()
 act('start');expect(page.locator('[data-talent-action=next]')).to_be_disabled()
 page.locator('[data-talent-action=answer][data-value="5"]').click();act('next');act('previous')
 expect(page.locator('[data-talent-action=answer][data-value="5"]')).to_have_attribute('aria-pressed','true')
 page.keyboard.press('Escape');page.reload(wait_until='networkidle');act('start')
 expect(page.locator('[data-talent-action=answer][data-value="5"]')).to_have_attribute('aria-pressed','true')
 done('Unanswered gate, back navigation and reload resume')
 values=[5,5,5,1,1,1,4,4,4,3,3,3,2,2,2,5,4,3,1,3,5,2,4,5]
 for i,value in enumerate(values):
  expect(page.locator('#talent-question-title')).to_have_text(texts[i])
  page.evaluate('(v)=>{document.querySelector(`[data-talent-action=answer][data-value="${v}"]`).click();document.querySelector("[data-talent-action=next]").click()}',value)
 expect(page.locator('.talent-result-card')).to_have_count(8)
 assert page.evaluate('TalentExplorer.exportData().scores.map(d=>d.score)')==[15,3,12,9,6,12,9,11]
 assert page.locator('.talent-top-tags>span').count()==3
 page.screenshot(path=str(ROOT/'qa/v5-talent-report-desktop.png'),full_page=True)
 done('24 answers generate all eight correct raw scores and top traits')
 # Change first answer; score is recomputed, never double-added.
 act('review');page.locator('[data-talent-action=answer][data-value="1"]').click()
 assert page.evaluate('TalentExplorer.exportData().completed') is False
 for i in range(24):act('next')
 assert page.evaluate('TalentExplorer.exportData().scores[0].score')==11
 with page.expect_download() as download:page.locator('.talent-report-actions [data-action=export]').click()
 payload=json.loads(Path(download.value.path()).read_text(encoding='utf-8'))
 assert payload['talentExploration']['scores'][0]['score']==11
 page.reload(wait_until='networkidle');expect(page.locator('.talent-result-card')).to_have_count(8)
 done('Review edits replace the original answer, report persists and export includes all scores')
 # Ties, extremes and malformed storage.
 for value in [1,5]:
  page.evaluate('(v)=>localStorage.setItem("dingdong-talents-v1",JSON.stringify({version:TalentData.version,index:23,completed:true,answers:Object.fromEntries(TalentData.questions.map(q=>[q.id,v]))}))',value)
  page.reload(wait_until='networkidle')
  assert page.locator('.talent-top-tags>span').count()==8
  assert page.evaluate('TalentExplorer.scores().every(d=>d.score===%d)'%(value*3))
  expect(page.locator('.talent-report-overview')).to_contain_text('不强行排前三')
 done('All-low and all-high score boundaries and equal-score handling')
 for width in [360,390,768,1440]:
  page.set_viewport_size({'width':width,'height':900})
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width
 page.set_viewport_size({'width':390,'height':844})
 page.screenshot(path=str(ROOT/'qa/v5-talent-report-mobile.png'),full_page=True)
 page.goto(BASE+'#explore',wait_until='networkidle')
 for ids in itertools.combinations('RIASEC',3):
  page.evaluate('IslandExplorer.reset()')
  page.evaluate('(ids)=>ids.forEach(id=>document.querySelector(`[data-world-id="${id}"]`).click())',list(ids))
  page.locator('[data-interest-action=start]').click()
  for i in range(9):page.evaluate('()=>{document.querySelector("[data-interest-action=answer][data-rating=\\"4\\"]").click();document.querySelector("[data-interest-action=next]").click()}')
  expect(page.locator('.career-combination')).to_be_visible()
  assert page.locator('.career-cards article').count()>=1
  expect(page.locator('.career-plan li')).to_have_count(3)
  assert page.evaluate('document.querySelector("#dialog").scrollWidth<=document.querySelector("#dialog").clientWidth+1')
  if ''.join(ids)=='RIA':
   expect(page.locator('.career-cards')).to_contain_text('景观建筑师')
   expect(page.locator('.career-cards')).to_contain_text('工业设计师')
   page.screenshot(path=str(ROOT/'qa/v5-ria-mobile.png'),full_page=True)
  page.keyboard.press('Escape')
 done('All 20 combinations show sourced careers and three specific actions, without mobile overflow')
 page.goto(BASE+'#settings',wait_until='networkidle');page.locator('[data-action=reset-dialog]').click();page.locator('[data-action=reset]').click()
 assert page.evaluate('TalentExplorer.exportData().answers')=={}
 page.goto(BASE+'test.html',wait_until='networkidle');expect(page).to_have_url(re.compile('#talents$'))
 page.goto(BASE+'result.html?word=15',wait_until='networkidle');expect(page).to_have_url(re.compile('#talents$'))
 expect(page.locator('.talent-result-card')).to_have_count(0)
 done('Account reset clears talents; legacy routes work without trusting arbitrary score query parameters')
 page.evaluate('localStorage.setItem("dingdong-talents-v1",JSON.stringify({version:TalentData.version,completed:true,index:999,answers:{1:999,2:"5"}}))')
 page.reload(wait_until='networkidle');assert page.evaluate('TalentExplorer.exportData().scores') is None
 blocked=browser.new_context();blocked.add_init_script('Object.defineProperty(window,"localStorage",{get(){throw Error("blocked")}})')
 bp=blocked.new_page();bp.goto(BASE+'#talents',wait_until='networkidle');bp.locator('[data-talent-action=start]').click();expect(bp.locator('.talent-question')).to_contain_text('刷新后可能丢失');blocked.close()
 assert not errors,errors
 done('Invalid and blocked storage degrade safely; no JavaScript exceptions')
 browser.close()
(ROOT/'qa/verification-v5-results.json').write_text(json.dumps({'url':BASE,'passed':len(results),'checks':results,'errors':errors},ensure_ascii=False,indent=2),encoding='utf-8')
print('V5 checks passed:',len(results))
