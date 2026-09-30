import { chromium } from '../../../../frontend/node_modules/playwright-core/index.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:4176',slow='http://127.0.0.1:4177';
const version=readFileSync('VERSION','utf8').trim();
const delayFile='.trellis/.runtime/parent-ux-20261001/supplier-delay.txt';
function shell(code){return execFileSync(resolve('backend/.venv/bin/python'),['manage.py','shell','-c',code],{cwd:resolve('backend'),env:process.env,stdio:'pipe'}).toString();}
async function api(page,path,options={}){return page.evaluate(async({path,options,version})=>(await import(`./api.js?v=${version}`)).request(path,options),{path,options,version});}
const browser=await chromium.launch({channel:'chrome',headless:true});
const evidence={boundary:'local synthetic supplier HTTP source, isolated schema, fixed SMS, no production/supplier writes',checks:[]};
let childId,account;
try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base);assert.equal((await(await page.request.get(base+'/api/v1/runtime')).json()).sms_mode,'fixed_code');
 await page.getByLabel('手机号',{exact:true}).fill('139'+String(Math.floor(Math.random()*1e8)).padStart(8,'0'));
 await page.locator('#send-code').click();await page.getByLabel('验证码',{exact:true}).fill('00000');await page.getByRole('button',{name:'登录',exact:true}).click();
 await page.getByRole('heading',{name:'建立儿童档案',exact:true}).waitFor();await page.getByLabel('姓名或称呼').fill('慢接口合成儿童');await page.getByRole('button',{name:'保存档案',exact:true}).click();await page.locator('.six-islands').waitFor();
 childId=await page.locator('#child-select').inputValue();
 account=await api(page,`/children/${childId}/ca-accounts`,{method:'POST',body:{request_id:randomUUID(),nfc_token:'SYNTHETIC-CLOSED-LOOP-NFC'}});
 assert.equal(account.bind_state,'unbound');assert.match(childId,/^[a-f0-9-]{36}$/);assert.match(account.ca_account_id,/^ca_[a-zA-Z0-9]+$/);
 shell(`from django.conf import settings;from dingdong_ca.core.models import CaAccount;assert settings.SMS_MODE=='fixed_code' and settings.DINGDONG_BASE_URL=='';row=CaAccount.objects.get(child_id='${childId}',ca_account_id='${account.ca_account_id}',status='active');assert row.prototype_demo;row.bind_state='bound';row.save(update_fields=['bind_state'])`);
 const policy=await api(page,'/policies/current?purpose=dingdong_sync',{auth:false});await api(page,`/children/${childId}/consents`,{method:'POST',body:{request_id:randomUUID(),policy_version_id:policy.id}});
 writeFileSync(delayFile,'5');
 const start=Date.now();await page.goto(slow+'/#reports',{waitUntil:'domcontentloaded'});
 await page.locator('#personal-assessments').waitFor({timeout:3000});
 evidence.caVisibleAfterMs=Date.now()-start;
 await page.locator('.assessment-start summary').click();
 await page.locator('#dingdong-growth-report .dd-report-comparison').waitFor({timeout:12000});
 assert.equal(await page.locator('.assessment-start').getAttribute('open'),'');
 evidence.checks.push('CA visible before 5s supplier; full robot response patches only robot region, open questionnaire chooser preserved');
 await page.evaluate(()=>scrollTo(0,0));await page.locator('#toast.show').waitFor({state:'hidden',timeout:10000});
 await page.screenshot({path:'deploy/evidence/v0.3.24/shots/ux-bound-report-390.png',animations:'disabled'});
 await page.screenshot({path:'deploy/evidence/v0.3.24/shots/ux-bound-report-full-390.png',animations:'disabled',fullPage:true});
 await page.goto(slow+'/#companion');await page.locator('.robot-entry a[href="#reports"]').waitFor();
 await page.screenshot({path:'deploy/evidence/v0.3.24/shots/ux-companion-bound-390.png',animations:'disabled'});
 writeFileSync(delayFile,'25');await page.goto(slow+'/#reports',{waitUntil:'domcontentloaded'});
 await page.locator('#personal-assessments').waitFor({timeout:3000});
 const ready=await page.evaluate(async(version)=>Promise.race([(await import(`./app.js?v=${version}`)).appReady.then(()=>true),new Promise(resolve=>setTimeout(()=>resolve(false),3000))]),version);
 assert.equal(ready,true,'bootstrap readiness must not wait for independent supplier');
 await page.locator('.assessment-start summary').click();
 await page.waitForTimeout(21000);
 assert.equal(await page.locator('#personal-assessments').isVisible(),true);
 assert.equal(await page.getByRole('heading',{name:'页面暂时没有加载成功',exact:true}).count(),0);
 assert.equal(await page.locator('.assessment-start').getAttribute('open'),'');
 assert.equal(await page.getByRole('link',{name:'和 DingDong 对话 ↗',exact:true}).isVisible(),true);
 evidence.checks.push('restored-login boot remains usable beyond 20s startup deadline; supplier timeout stays local, chat and CA available');
 await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'deploy/evidence/v0.3.24/shots/ux-supplier-timeout-390.png',animations:'disabled'});
 assert.deepEqual(errors,[]);evidence.pageErrors=errors;
 writeFileSync('deploy/evidence/v0.3.24/slow-supplier-browser.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify({checks:evidence.checks.length,caVisibleAfterMs:evidence.caVisibleAfterMs,pageErrors:errors.length}));
}finally{
 if(childId&&account){shell(`from django.conf import settings;from django.utils import timezone;from dingdong_ca.core.models import CaAccount;assert settings.DATABASES['default']['OPTIONS']['options']=='-c search_path=parent_ux_20261001';CaAccount.objects.filter(child_id='${childId}',ca_account_id='${account.ca_account_id}',status='active').update(status='retired',bind_state='unbound',unbound_at=timezone.now())`);}
 writeFileSync(delayFile,'5');await browser.close();
}
