import {test,expect,type APIRequestContext,type Page} from '@playwright/test';

/** `iot.admin.localhost` stands in for iot.ai.id (static files only; it is a subdomain of admin.localhost because only then are the two same-site, as iot.ai.id and admin.iot.ai.id are) and `admin.localhost` for admin.iot.ai.id; plain localhost is the desktop app, where everything works. */
const PUBLIC='http://iot.admin.localhost:8891',ADMIN='http://admin.localhost:8891';
async function invite(request:APIRequestContext){
 const {token}=await (await request.get('/api/session')).json();
 const r=await request.fetch('/api/ops/staff',{method:'POST',headers:{'X-IOT-Session':token},data:{username:`e2e.present.${Date.now()}`,name:'Pia Presenter',role:'viewer'}});
 expect(r.ok()).toBeTruthy();return r.json();
}
async function signIn(page:Page,code:string){
 await page.goto(ADMIN+'/');
 const status=await page.evaluate(async c=>(await fetch('/ops/v1/staff/activate',{method:'POST',headers:{'Content-Type':'application/json','X-AIoT-Staff':'1'},body:JSON.stringify({code:c,password:'a long staff password'})})).status,code);
 expect(status).toBe(200);await page.reload();
}
const gate=(page:Page)=>page.getByTestId('invitation-only');

test('public host: invitation-only for gated pages, hidden nav, honest and no /api errors',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 for(const route of ['/products','/builders','/bench','/arena','/arena/room-monitor','/build','/sites','/site/x','/design']){
  await page.goto(PUBLIC+route);
  await expect(gate(page),route).toBeVisible();
  await expect(page.getByRole('heading',{level:1})).toContainText(/invitation-only|khusus untuk anggota undangan/i);
  await expect(page.getByRole('link',{name:'Request access',exact:true}).first()).toBeVisible();
  await expect(page.getByText(/Could not|unavailable|0 projects/i)).toHaveCount(0);
 }
 await page.goto(PUBLIC+'/products');
 await page.screenshot({path:'test-results/invitation-only-desktop.png',fullPage:true,animations:'disabled'});
 // Navigation only offers what is real.
 await page.goto(PUBLIC+'/');
 const main=page.locator('.ds-header').getByRole('navigation',{name:'Main',exact:true});
 for(const label of ['Products','Build','Sites','Builders','Arena','PhysicalBench'])await expect(main.getByRole('link',{name:label,exact:true})).toHaveCount(0);
 for(const label of ['Hardware','Learn','Docs','API','Research'])await expect(main.getByRole('link',{name:label,exact:true})).toBeVisible();
 await expect(main.getByRole('button',{name:'Resources'})).toHaveCount(0);
 await expect(page.locator('.ds-footer').getByRole('link',{name:'Tested products'})).toHaveCount(0);
 await expect(page.getByTestId('preview-pill')).toHaveCount(0);
 await expect(page.locator('.ds-header').getByRole('link',{name:'Sign in',exact:true})).toHaveAttribute('href','/masuk');
 // Real pages stay.
 for(const route of ['/partner','/hardware','/docs','/research','/mitra']){await page.goto(PUBLIC+route);await expect(gate(page),route).toHaveCount(0);}
 // Learn keeps its lesson but the Start button is replaced.
 await page.goto(PUBLIC+'/learn');
 await expect(page.getByRole('heading',{name:'Build. Break. Recover.'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Start learning episode'})).toHaveCount(0);
 await expect(page.getByRole('link',{name:'Request access'}).first()).toHaveAttribute('href','/partner?kind=school');
 // The /id leaderboard becomes an invitation-only block; the rest stays.
 await page.setViewportSize({width:390,height:844});
 await page.goto(PUBLIC+'/id');
 await expect(page.getByTestId('board-invite')).toBeVisible();
 await expect(page.getByText('Slot terbuka')).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'Papan Lab Mitra khusus untuk anggota undangan.'})).toBeVisible();
 await expect(page.locator('#paket')).toBeVisible();
 await page.getByTestId('board-invite').scrollIntoViewIfNeeded();
 await page.screenshot({path:'test-results/invitation-only-id-board-mobile.png',animations:'disabled'});
});

test('the public alias serves static files only and desktop stays unaffected',async({page,request})=>{
 expect((await request.get(PUBLIC+'/api/session')).status()).toBe(403);
 expect((await request.get(PUBLIC+'/ops/v1/catalog')).status()).toBe(403);
 expect((await request.get(PUBLIC+'/ops/v1/staff/preview')).status()).toBe(403);
 // Only the member routes are served in-process on the public alias.
 expect((await request.get(PUBLIC+'/ops/v1/member/me')).status()).toBe(401);
 expect((await request.get(PUBLIC+'/ops/v1/member/me/')).status()).toBe(404);
 expect((await request.get(PUBLIC+'/ops/v1/member/installer')).status()).toBe(401);
 expect((await request.get(ADMIN+'/ops/v1/member/me')).status()).toBe(403);
 await page.goto('/products');
 await expect(page.getByTestId('invitation-only')).toHaveCount(0);
 await page.goto('/builders');await expect(page.getByTestId('invitation-only')).toHaveCount(0);
 await page.goto('/learn');await expect(page.getByRole('button',{name:'Start learning episode'})).toBeVisible();
 await page.goto('/');await expect(page.locator('.ds-header').getByRole('link',{name:'Products',exact:true})).toBeVisible();
});

test('presentation mode: staff sign-in unlocks the public alias, with pill, preview nav and view-as-public',async({page,request})=>{
 const made=await invite(request);
 await page.goto(PUBLIC+'/products');await expect(gate(page)).toBeVisible();
 await signIn(page,made.inviteCode);
 await expect(page.getByRole('link',{name:'Present site'})).toHaveAttribute('href','https://iot.ai.id/');
 await page.setViewportSize({width:1440,height:900});
 await page.goto(PUBLIC+'/products');
 await expect(page.getByTestId('preview-pill')).toContainText('Presentation mode · Pia Presenter');
 await expect(gate(page)).toHaveCount(0);
 await expect(page.getByRole('heading',{level:1})).toContainText('Hardware, tested before it ships');
 const main=page.locator('.ds-header').getByRole('navigation',{name:'Main',exact:true});
 await expect(main.getByRole('link',{name:/^Products/})).toContainText('Preview');
 await main.getByRole('button',{name:'Resources'}).click();
 for(const label of ['Build','Sites','API','Research','PhysicalBench','Arena','Builders'])await expect(page.locator('#ds-resources').getByRole('link',{name:new RegExp('^'+label+'(Preview)?$')})).toBeVisible();
 await page.screenshot({path:'test-results/preview-mode-desktop.png',animations:'disabled'});
 await page.goto(PUBLIC+'/bench');await expect(gate(page)).toHaveCount(0);
 await page.goto(PUBLIC+'/id');await expect(page.getByTestId('board-invite')).toHaveCount(0);await expect(page.getByText('Slot terbuka').first()).toBeVisible();
 // /build needs /api, so even in preview it points at the workspace on the admin host.
 await page.goto(PUBLIC+'/build');
 await expect(gate(page)).toBeVisible();
 await expect(page.getByRole('link',{name:/Open in workspace/})).toHaveAttribute('href',ADMIN+'/build');
 await page.goto(PUBLIC+'/products');
 await page.getByRole('button',{name:'View as public'}).click();
 await expect(gate(page)).toBeVisible();
 await expect(page.locator('.ds-header').getByRole('link',{name:'Products',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Back to preview'}).click();
 await expect(gate(page)).toHaveCount(0);
 // The admin host renders the shared /build route (not gated there).
 await page.goto(ADMIN+'/build');await expect(page.getByTestId('invitation-only')).toHaveCount(0);
});

test('preview endpoint: exact-origin CORS, 401 without a session',async({request})=>{
 const get=(origin?:string)=>request.get(ADMIN+'/ops/v1/staff/preview',{headers:origin?{Origin:origin}:{}});
 const ok=await get(PUBLIC);expect(ok.status()).toBe(401);
 expect(ok.headers()['access-control-allow-origin']).toBe(PUBLIC);expect(ok.headers()['access-control-allow-credentials']).toBe('true');
 const evil=await get('http://evil.localhost:8891');expect(evil.status()).toBe(403);
 expect((await request.get(ADMIN+'/ops/v1/staff/preview/')).status()).toBe(404);
});
