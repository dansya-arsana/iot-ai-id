import {test,expect,type APIRequestContext,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';

/** The Arduino lab is invitation-only on the public host (grant `lab`). `iot.admin.localhost` stands in for iot.ai.id, `admin.localhost` for admin.iot.ai.id; plain localhost (desktop) stays open (see 20-lab). */
const PUBLIC='http://iot.admin.localhost:8891',ADMIN='http://admin.localhost:8891';
const ROUTES=['/lab','/lab/blink','/lab/parts','/lab/parts/hc05-bluetooth'];
const gate=(page:Page)=>page.getByTestId('invitation-only');

async function session(request:APIRequestContext){const {token}=await (await request.get('/api/session')).json();return token as string;}
async function activateMember(page:Page,request:APIRequestContext,grants:string[]){
 const token=await session(request);
 const made=await (await request.fetch('/api/ops/members',{method:'POST',headers:{'X-IOT-Session':token},data:{username:`e2e.labgate.${Date.now()}.${grants.length}`,name:'Gia Gate',grants}})).json();
 await page.goto(PUBLIC+'/masuk');
 await page.getByRole('tab',{name:'Activate invite'}).click();
 await page.fill('#ml-code',made.inviteCode);await page.fill('#ml-password','a long member password');await page.fill('#ml-confirm','a long member password');
 await page.locator('form').getByRole('button',{name:'Activate and sign in'}).click();
 await expect(page).toHaveURL(PUBLIC+'/profile');
}

test('anonymous on the public alias: invitation-only, no Lab links, noindex shell without lesson content',async({page,request})=>{
 for(const route of ROUTES){
  await page.goto(PUBLIC+route);
  await expect(gate(page),route).toBeVisible();
  await expect(page.getByRole('heading',{level:1})).toContainText(/invitation-only/i);
  await expect(page.locator('.lab')).toHaveCount(0);
 }
 await page.goto(PUBLIC+'/');
 await expect(page.locator('.ds-header').getByRole('navigation',{name:'Main',exact:true}).getByRole('link',{name:'Lab',exact:true})).toHaveCount(0);
 await expect(page.locator('.ds-footer').getByRole('link',{name:'Arduino lab'})).toHaveCount(0);
 await page.goto(PUBLIC+'/learn');
 await expect(page.getByRole('link',{name:'Open the lab'})).toHaveCount(0);
 // The prerendered shell: noindex, no lesson text, out of the sitemap and llms files.
 for(const route of ['/lab/','/lab/blink/']){
  const html=readFileSync(`dist/web${route}index.html`,'utf8');
  expect(html).toMatch(/<meta name="robots" content="noindex/);
  expect(html).not.toMatch(/emulated ATmega328P|guided lessons/i);
 }
 for(const file of ['sitemap.xml','llms.txt','llms-full.txt'])expect(readFileSync('dist/web/'+file,'utf8'),file).not.toMatch(/\/lab\b/);
 expect((await request.get(PUBLIC+'/ops/v1/member/lab/examples')).status()).toBe(401);
});

test('a member with the lab grant sees the lab and its links; one without does not',async({page,request})=>{
 await activateMember(page,request,['lab']);
 for(const route of ROUTES){await page.goto(PUBLIC+route);await expect(gate(page),route).toHaveCount(0);}
 await page.goto(PUBLIC+'/lab/blink');
 await expect(page.locator('.lab')).toBeVisible({timeout:30000});
 await page.goto(PUBLIC+'/');
 await expect(page.locator('.ds-header').getByRole('navigation',{name:'Main',exact:true}).getByRole('link',{name:'Lab',exact:true})).toBeVisible();
 expect((await page.request.get(PUBLIC+'/ops/v1/member/lab/examples')).status()).toBe(200);
});

test('a member without the lab grant stays locked out',async({page,request})=>{
 await activateMember(page,request,['arena']);
 for(const route of ROUTES){await page.goto(PUBLIC+route);await expect(gate(page),route).toBeVisible();}
 await expect(page.getByRole('heading',{level:1})).toContainText(/invitation-only/i);
 await expect(page.getByText('Your account does not include this area yet.')).toBeVisible();
 expect((await page.request.get(PUBLIC+'/ops/v1/member/lab/examples')).status()).toBe(403);
});

test('staff presentation mode unlocks the lab, view-as-public locks it again',async({page,request})=>{
 const token=await session(request);
 const r=await request.fetch('/api/ops/staff',{method:'POST',headers:{'X-IOT-Session':token},data:{username:`e2e.labstaff.${Date.now()}`,name:'Sam Staff',role:'viewer'}});
 expect(r.ok()).toBeTruthy();const {inviteCode}=await r.json();
 await page.goto(ADMIN+'/');
 const status=await page.evaluate(async c=>(await fetch('/ops/v1/staff/activate',{method:'POST',headers:{'Content-Type':'application/json','X-AIoT-Staff':'1'},body:JSON.stringify({code:c,password:'a long staff password'})})).status,inviteCode);
 expect(status).toBe(200);
 await page.goto(PUBLIC+'/lab/blink');
 await expect(page.getByTestId('preview-pill')).toBeVisible();
 await expect(gate(page)).toHaveCount(0);
 await expect(page.locator('.lab')).toBeVisible({timeout:30000});
 await page.getByRole('button',{name:'View as public'}).click();
 await expect(gate(page)).toBeVisible();
});
