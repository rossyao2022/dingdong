import {chromium} from '../../../../frontend/node_modules/playwright-core/index.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:4178',state='.trellis/.runtime/exhibition-ca/supplier.json';
const version=readFileSync('VERSION','utf8').trim();
const browser=await chromium.launch({channel:'chrome',headless:true});
const evidence={boundary:'isolated synthetic local HTTP supplier, fixed SMS, same local DB; no business interception, no real supplier or production writes',checks:[],errors:[]};
async function api(page,path,options={}){return page.evaluate(async({path,options,version})=>(await import(`./api.js?v=${version}`)).request(path,options),{path,options,version});}
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});page.on('pageerror',e=>evidence.errors.push(e.message));
 await page.goto(base);assert.equal((await(await page.request.get(base+'/api/v1/runtime')).json()).sms_mode,'fixed_code');
 await page.getByLabel('手机号',{exact:true}).fill('139'+String(Math.floor(Math.random()*1e8)).padStart(8,'0'));
 await page.locator('#send-code').click();await page.getByLabel('验证码',{exact:true}).fill('00000');await page.getByRole('button',{name:'登录',exact:true}).click();
 await page.getByLabel('姓名或称呼').fill('慢刷新合成儿童');await page.getByRole('button',{name:'保存档案',exact:true}).click();await page.locator('.experience-task').waitFor();
 const first=await page.locator('#child-select').inputValue();
 const second=await api(page,'/children',{method:'POST',body:{request_id:randomUUID(),name:'慢刷新另一儿童'}});
 await page.reload();await page.locator('.experience-task').waitFor();
 writeFileSync(state,JSON.stringify({delay:8,fail:false,calls:0}));
 await page.goto(base+'/#exhibition');await page.locator('.dd-report-summary').waitFor();assert.equal(JSON.parse(readFileSync(state)).calls,0);
 evidence.checks.push('initial cached=1 renders validated prior snapshot with zero supplier calls');
 const started=Date.now();await page.locator('[data-action=dingdong-report-refresh]').click();
 await page.locator('.robot-refresh-status').waitFor();assert.equal(await page.locator('#child-select').isEnabled(),true);
 await page.locator('#child-select').selectOption(second.id);await page.locator('.experience-task').waitFor({timeout:3000});
 evidence.navigationMs=Date.now()-started;assert.equal(await page.locator('#child-select').inputValue(),second.id);
 await page.waitForTimeout(9000);assert.equal(await page.locator('#dingdong-growth-report').count(),0);assert.equal(await page.locator('.experience-task').count(),1);
 evidence.checks.push('8-second live refresh allows immediate child switch; late response cannot patch CA page');
 await page.locator('#child-select').selectOption(first);await page.locator('.experience-task').waitFor();await page.goto(base+'/#exhibition');await page.locator('.dd-report-summary').waitFor();
 writeFileSync(state,JSON.stringify({delay:1,fail:true,calls:0}));
 await page.locator('[data-action=dingdong-report-refresh]').click();await page.locator('#dingdong-growth-report').getByText('暂时没能更新，先显示已保存的记录。',{exact:true}).waitFor();
 assert.equal(await page.locator('.dd-report-summary').count(),1);await page.screenshot({path:'deploy/evidence/v0.3.25/shots/ux-stale-report-390.png',fullPage:true});
 evidence.checks.push('HTTP503 refresh retains validated full prior pull/push report with stale notice');
 await page.locator('[data-action=dingdong-weekly-turns][data-value="14"]').click();await page.locator('.dd-report-summary').waitFor();assert.equal(JSON.parse(readFileSync(state)).calls,1);
 evidence.checks.push('frequency switch reads its own weekly cache without an extra supplier call');
 assert.deepEqual(evidence.errors,[]);writeFileSync('deploy/evidence/v0.3.25/slow-refresh-browser.json',JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify({checks:evidence.checks.length,navigationMs:evidence.navigationMs,errors:0}));
}finally{await browser.close();}
