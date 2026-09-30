import { chromium } from '../../../../frontend/node_modules/playwright-core/index.mjs';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { randomUUID, createHmac } from 'node:crypto';
import assert from 'node:assert/strict';

const base = 'http://127.0.0.1:4176', backend = 'http://127.0.0.1:8024';
const shots = 'deploy/evidence/v0.3.24/shots';
mkdirSync(shots, { recursive: true });
const version = readFileSync('VERSION', 'utf8').trim();
const evidence = { boundary: 'isolated synthetic DB, fixed SMS code, no real supplier outbound, no production writes', checks: [], layouts: [] };
function shell(source) {
  return execFileSync(resolve('backend/.venv/bin/python'), ['manage.py','shell','-c',source], {cwd:resolve('backend'),env:process.env,stdio:'pipe'}).toString().trim().split('\n').at(-1);
}
async function api(page,path,options={}) {
  return page.evaluate(async ({path,options,version}) => (await import(`./api.js?v=${version}`)).request(path,options), {path,options,version});
}
async function screenshot(page, name, fullPage=false) {
  await page.locator('#toast.show').waitFor({ state:'hidden', timeout:10000 });
  await page.screenshot({ path:`${shots}/${name}.png`, animations:'disabled',fullPage });
}
async function layout(page,label,width) {
  await page.setViewportSize({width,height:844});
  const dimensions=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
  assert.ok(dimensions.scroll<=dimensions.client+1, `${label} overflow at ${width}`);
  evidence.layouts.push({label,width,...dimensions});
}
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const context=await browser.newContext({viewport:{width:390,height:844}}), page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const runtime=await (await page.request.get(base+'/api/v1/runtime')).json();
 assert.equal(runtime.sms_mode,'fixed_code');assert.equal(runtime.exhibition_enabled,true);
 await page.goto(base);await screenshot(page,'ux-login-390');
 const phone='139'+String(Math.floor(Math.random()*1e8)).padStart(8,'0');
 await page.getByLabel('手机号',{exact:true}).fill(phone);
 await page.locator('#send-code').click();
 await page.getByLabel('验证码',{exact:true}).fill('00000');
 await page.getByRole('button',{name:'登录',exact:true}).click();
 await page.getByRole('heading',{name:'建立儿童档案',exact:true}).waitFor();
 await screenshot(page,'ux-onboarding-390');
 await page.getByLabel('姓名或称呼').fill('展会流程合成儿童');
 await page.getByRole('button',{name:'保存档案',exact:true}).click();
 await page.locator('.six-islands').waitFor();await screenshot(page,'ux-ca-explore-390');
 evidence.checks.push('login->child creation->CA island exploration unchanged');
 assert.deepEqual(await page.locator('#mobile-nav a').allTextContents(), ['✧天赋探索','⌂今日陪伴','◷成长旅程','▥测评与报告','⚙账户与关联']);
 await page.goto(base+'/#reports');await page.locator('#personal-assessments').waitFor();
 assert.equal(await page.locator('#dingdong-growth-report').count(),0);
 assert.equal(await page.getByText('还没有连接机器人记录',{exact:true}).count(),0);
 await screenshot(page,'ux-report-unbound-390');
 await page.goto(base+'/#companion');await page.locator('[data-action=companion-exploration]').waitFor();
 await screenshot(page,'ux-companion-unbound-390');
 await page.goto(base+'/#settings');await page.getByRole('heading',{name:'账户与关联',exact:true}).waitFor();
 await screenshot(page,'ux-settings-390');
 const rawFixture=JSON.parse(readFileSync('backend/tests/fixtures/prototype-insights.json','utf8'));
 for(const weekly of [3,7,14,21]) {
   const data=structuredClone(rawFixture);data.growth.weekly_turns=weekly;data.companion.effective_turns=24;data.companion.updated_at=new Date().toISOString();
   const envelope={event_type:'dingdong.prototype.companion_milestone',occurred_at:data.companion.updated_at,milestone:{interval:3,completed_turns:24},data};
   const raw=JSON.stringify(envelope),stamp=String(Math.floor(Date.now()/1000));
   const signature='sha256='+createHmac('sha256','synthetic-only-signing-secret').update(stamp+'.'+raw).digest('hex');
   const push=await page.request.post(backend+'/api/dingdong/prototype/events',{data:raw,headers:{'Content-Type':'application/json','X-Dingdong-Timestamp':stamp,'X-Dingdong-Signature':signature,'X-Dingdong-Event-ID':'ux-browser-'+randomUUID(),'X-Dingdong-Event-Type':envelope.event_type}});
   assert.equal(push.status(),201);
 }
 await page.goto(base+'/#exhibition');await page.locator('.dd-report-chart').waitFor();
 assert.equal(await page.locator('.dd-report-row[role=row]').count(),9);
 assert.equal(await page.locator('[data-action=dingdong-weekly-turns]').count(),4);
 assert.equal(await page.locator('details .dd-report').count(),0);
 await screenshot(page,'ux-exhibition-390');await screenshot(page,'ux-exhibition-full-390',true);
 await page.locator('.dd-report-trend').scrollIntoViewIfNeeded();await screenshot(page,'ux-chart-390');
 const personalReports=await api(page,'/children/'+await page.locator('#child-select').inputValue()+'/reports');
 assert.equal(personalReports.items.length,0,'shared exhibition never becomes personal ReportVersion');
 for(const width of [320,390,430,768,1280]) await layout(page,'exhibition',width);
 evidence.checks.push('shared signed input displayed through real authenticated report HTTP; all contents expanded, CA personal history unchanged');
 const eventRows=JSON.parse(shell(`import json; from dingdong_ca.core.models import ExhibitionVisitor, ExhibitionVisit; row=ExhibitionVisitor.objects.get(user__phone='+86${phone}'); print(json.dumps({'id':str(row.pk),'entered':row.last_entered_at is not None,'viewed':row.last_report_viewed_at is not None,'count':ExhibitionVisit.objects.filter(visitor=row).count()}))`));
 assert.equal(eventRows.entered,true);assert.equal(eventRows.viewed,true);
 const adminSession=shell(`import json; from django.contrib.auth import get_user_model; from django.contrib.auth.models import Group; from django.test import Client; u=get_user_model().objects.create_user(username='ux-ops-${randomUUID()}',password='synthetic-local-only',account_kind='staff',is_staff=True,name='合成运营人员');u.groups.set(Group.objects.filter(name='operations'));c=Client();c.force_login(u);print(c.cookies['sessionid'].value)`);
 const opsContext=await browser.newContext({viewport:{width:1280,height:900}});
 await opsContext.addCookies([{name:'sessionid',value:adminSession,url:backend,httpOnly:true,sameSite:'Lax'}]);
 const ops=await opsContext.newPage();ops.on('pageerror',e=>errors.push(e.message));
 const listing=await ops.goto(backend+'/ops/exhibition/');assert.equal(listing.status(),200);
 await ops.getByRole('heading',{name:'展会体验用户',exact:true}).waitFor();
 await screenshot(ops,'ux-ops-exhibition-list');
 await ops.goto(backend+'/ops/exhibition/'+eventRows.id+'/');
 await ops.getByLabel('跟进状态').selectOption('contacted');
 await ops.getByLabel('跟进备注').fill('本地合成验收：已介绍机器人体验，等待家长后续确认。');
 await ops.getByRole('button',{name:'保存跟进记录',exact:true}).click();
 await ops.getByText('跟进记录已保存。',{exact:true}).waitFor();
 assert.equal(await ops.getByLabel('跟进状态').inputValue(),'contacted');
 await screenshot(ops,'ux-ops-exhibition-detail');
 for(const width of [390,768,1280]) await layout(ops,'ops-followup',width);
 await ops.setViewportSize({width:390,height:844});await ops.reload();
 await ops.getByLabel('跟进状态').waitFor();
 await screenshot(ops,'ux-ops-exhibition-detail-390');
 const verified=JSON.parse(shell(`import json;from dingdong_ca.core.models import ExhibitionVisitor,AuditEvent;row=ExhibitionVisitor.objects.get(pk='${eventRows.id}');print(json.dumps({'revision':row.revision,'status':row.status,'audits':AuditEvent.objects.filter(target_kind='exhibition_visitor',target_id=row.pk,action='exhibition.followup').count()}))`));
 assert.equal(verified.status,'contacted');assert.equal(verified.revision,2);assert.equal(verified.audits,1);
 const stale=await ops.locator('#main input[name=csrfmiddlewaretoken]').inputValue();
 const conflict=await ops.request.post(backend+'/ops/exhibition/'+eventRows.id+'/',{form:{csrfmiddlewaretoken:stale,revision:'1',status:'closed',note:'旧页面提交不应覆盖'},headers:{Referer:backend+'/ops/exhibition/'+eventRows.id+'/'}});
 assert.equal(conflict.status(),409);
 evidence.checks.push('existing phone telemetry rendered for authorized ops; CSRF HTML form saves state/note+audit; stale revision409 preserves existing followup');
 const forbiddenSession=shell(`from django.contrib.auth import get_user_model;from django.contrib.auth.models import Group;from django.test import Client;u=get_user_model().objects.create_user(username='ux-content-${randomUUID()}',password='synthetic-local-only',account_kind='staff',is_staff=True,name='合成内容人员');u.groups.set(Group.objects.filter(name='content'));c=Client();c.force_login(u);print(c.cookies['sessionid'].value)`);
 const forbiddenContext=await browser.newContext();await forbiddenContext.addCookies([{name:'sessionid',value:forbiddenSession,url:backend,httpOnly:true,sameSite:'Lax'}]);
 assert.equal((await forbiddenContext.request.get(backend+'/ops/exhibition/')).status(),403);
 const anonymous=await browser.newContext();assert.equal((await anonymous.request.get(backend+'/ops/exhibition/',{maxRedirects:0})).status(),302);
 evidence.checks.push('content403, anonymous302; no extra phone form or purchase-intent classification');
 assert.deepEqual(errors,[]);evidence.pageErrors=errors;
 writeFileSync('deploy/evidence/v0.3.24/exhibition-ops-browser.json',JSON.stringify(evidence,null,2));
 console.log(JSON.stringify({checks:evidence.checks.length,layouts:evidence.layouts.length,pageErrors:errors.length}));
} finally {await browser.close();}
