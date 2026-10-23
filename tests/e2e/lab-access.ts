import {readFileSync,readdirSync} from 'node:fs';
import {expect,type APIRequestContext,type Page} from '@playwright/test';

const ORIGIN='http://iot.admin.localhost:8891';

/** The lab is invitation-only on the public host (grant `lab`). Lab specs that run on the public alias present a member with that grant: the hint cookie plus a stubbed `me`. Server checks are covered by 32-lab-gate and tests/lab-ai.test.ts. */
export async function grantLab(page:Page,origin='http://iot.admin.localhost:8891',grants:string[]=['lab']){
 await page.context().addCookies([{name:'aiot_member_hint',value:'1',url:origin+'/'}]);
 await page.route('**/ops/v1/member/me',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({name:'Lia Lab',org:'',grants})}));
}

/** The lab is invitation-only on the public host: sign in as a real member (grant lab) so the examples route accepts the cookie. */
export async function labMember(page:Page,request:APIRequestContext,grants:string[]=['lab']){
 const {token}=await (await request.get('/api/session')).json();
 const made=await (await request.fetch('/api/ops/members',{method:'POST',headers:{'X-IOT-Session':token},data:{username:`e2e.labm.${Date.now()}.${Math.floor(Math.random()*1e6)}`,name:'Lia Lab',grants}})).json();
 await page.unroute('**/ops/v1/member/me');await page.context().clearCookies();// drop the stub so /masuk shows the real form
 await page.goto(ORIGIN+'/masuk');
 await page.getByRole('tab',{name:'Activate invite'}).click();
 await page.fill('#ml-code',made.inviteCode);await page.fill('#ml-password','a long member password');await page.fill('#ml-confirm','a long member password');
 await page.locator('form').getByRole('button',{name:'Activate and sign in'}).click();
 await expect(page).toHaveURL(ORIGIN+'/profile');
}

/** Serves the committed example list to a page whose member session is only stubbed (the real route needs a member cookie). Builds of an `exampleId` stay anonymous server-side. */
export async function stubExamples(page:Page){
 const dir='apps/web/src/lab/ai/examples/';
 const examples=readdirSync(dir).filter(f=>f.endsWith('.json')).sort().map(f=>JSON.parse(readFileSync(dir+f,'utf8')));
 await page.route('**/ops/v1/member/lab/examples',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({examples})}));
}
