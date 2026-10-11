import {test,expect,type APIRequestContext} from '@playwright/test';

/** `admin.localhost` resolves to loopback in Chromium and stands in for admin.iot.ai.id: the API serves the static page and /ops/v1/staff/* there, but never /api (so the backoffice data itself stays out of reach). */
const ADMIN='http://admin.localhost:8891';
async function owner(request:APIRequestContext){
 const {token}=await (await request.get('/api/session')).json();
 return async(method:'GET'|'POST'|'PATCH',path:string,data?:unknown)=>{const response=await request.fetch('/api/ops/'+path,{method,headers:{'X-IOT-Session':token},data});expect(response.ok(),`${method} ${path}: ${await response.text()}`).toBeTruthy();return response.json();};
}

test('admin landing: bilingual, accessible sign-in and activation, session end, screenshots',async({page,request,browser})=>{
 const call=await owner(request);const username=`e2e.sales.${Date.now()}`;
 const made=await call('POST','staff',{username,name:'Rina Sales',role:'sales'});
 expect(made.inviteCode).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{10}$/);

 await page.setViewportSize({width:1440,height:900});
 await page.goto(ADMIN+'/');
 await expect(page).toHaveTitle('Admin | AIoT');
 await expect(page.locator('meta[name=robots]')).toHaveAttribute('content',/noindex/);
 await expect(page.getByRole('heading',{level:1})).toHaveText('Run the gateway.');
 await expect(page.getByText('AIoT · ADMIN CONSOLE')).toBeVisible();
 for(const name of ['Inquiries & CRM','Tested catalog','Lab Mitra commissions & payouts','AI settings'])await expect(page.locator('.al-caps')).toContainText(name);
 await expect(page.getByText('Access is by invitation. Every action is logged.')).toBeVisible();
 await expect(page.getByRole('link',{name:/iot\.ai\.id/})).toHaveAttribute('href','https://iot.ai.id/');
 await expect(page.locator('#al-username')).toBeFocused();
 await page.screenshot({path:'test-results/admin-landing-desktop.png',fullPage:true,animations:'disabled'});

 // Validation, then wrong credentials.
 await page.locator('form').getByRole('button',{name:'Sign in'}).click();
 await expect(page.getByText('Enter your username (at least 3 characters).')).toBeVisible();
 await expect(page.locator('#al-username')).toBeFocused();
 await page.fill('#al-username',username);await page.fill('#al-password','not the password');
 await page.locator('form').getByRole('button',{name:'Sign in'}).click();
 await expect(page.getByRole('alert').filter({hasText:'Wrong username or password'})).toContainText('15 minutes');
 await expect(page.getByRole('alert')).toBeFocused();

 // Activation: validation, then success lands in the backoffice shell with name, role and Sign out.
 await page.getByRole('tab',{name:'Activate invite'}).click();
 await page.fill('#al-code','ABCD-bad');await page.fill('#al-password','short');await page.fill('#al-confirm','different');
 await page.locator('form').getByRole('button',{name:'Activate and sign in'}).click();
 await expect(page.getByText('Invite codes look like ABCD-EFGHJKMNPQ.')).toBeVisible();
 await expect(page.getByText('Password needs at least 10 characters.')).toBeVisible();
 await expect(page.getByText('The two passwords do not match.')).toBeVisible();
 await page.fill('#al-code','ZZZZ-ZZZZZZZZZZ');await page.fill('#al-password','a long staff password');await page.fill('#al-confirm','a long staff password');
 await page.locator('form').getByRole('button',{name:'Activate and sign in'}).click();
 await expect(page.getByRole('alert')).toContainText('invalid, already used or expired');
 await page.fill('#al-code',made.inviteCode);
 await page.locator('form').getByRole('button',{name:'Activate and sign in'}).click();
 await expect(page.getByTestId('staff-who')).toContainText('Rina Sales');
 await expect(page.getByTestId('staff-who')).toContainText('sales');
 await expect(page).toHaveTitle('Backoffice | AIoT');
 const cookies=await page.context().cookies(ADMIN);const c=cookies.find(x=>x.name==='aiot_admin')!;
 expect(c.httpOnly).toBe(true);expect(c.sameSite).toBe('Strict');expect(c.path).toBe('/');

 // A reload keeps the session; Sign out returns to the landing; signing in again works.
 await page.reload();await expect(page.getByTestId('staff-who')).toBeVisible();
 await page.getByRole('button',{name:'Sign out'}).click();
 await expect(page.getByRole('heading',{level:1})).toHaveText('Run the gateway.');
 await page.fill('#al-username',username);await page.fill('#al-password','a long staff password');
 await page.locator('form').getByRole('button',{name:'Sign in'}).click();
 await expect(page.getByTestId('staff-who')).toContainText('Rina Sales');

 // The owner disables the account elsewhere: the next check returns to the landing with a notice.
 const row=(await call('GET','staff')).staff.find((s:{username:string})=>s.username===username);
 await call('PATCH',`staff/${row.id}`,{status:'disabled'});
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await expect(page.getByText('Your session ended. Sign in again to continue.')).toBeVisible();
 await expect(page.getByRole('heading',{level:1})).toBeVisible();

 // Language toggle, then the mobile layout: card first, no horizontal overflow.
 await page.getByRole('button',{name:'ID',exact:true}).click();
 await expect(page.getByRole('heading',{level:1})).toHaveText('Kendalikan gerbangnya.');
 await expect(page.getByText('Akses hanya dengan undangan. Setiap tindakan dicatat.')).toBeVisible();
 await page.getByRole('button',{name:'EN',exact:true}).click();
 const phone=await browser.newContext({viewport:{width:390,height:844}});const mp=await phone.newPage();
 await mp.goto(ADMIN+'/');await expect(mp.getByRole('heading',{level:1})).toBeVisible();
 expect(await mp.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 const card=await mp.locator('.al-card').boundingBox(),title=await mp.locator('#al-title').boundingBox();expect(card!.y).toBeLessThan(title!.y);
 await mp.screenshot({path:'test-results/admin-landing-mobile.png',fullPage:true,animations:'disabled'});
 await phone.close();
});

test('the local API serves only the page and staff routes on admin.localhost, never /api or other ops paths',async({request})=>{
 const get=(path:string)=>request.get(ADMIN+path);
 expect((await get('/')).status()).toBe(200);
 expect((await get('/api/session')).status()).toBe(403);
 expect((await get('/ops/v1/labs')).status()).toBe(403);
 expect((await get('/ops/v1/staff/me')).status()).toBe(401);
 expect((await get('/ops/v1/staff/check')).status()).toBe(404);
 expect((await request.get('/ops/v1/staff/check')).status()).toBe(404);
 expect((await request.get('/ops/v1/staff/me/')).status()).toBe(404);
});

test('Team section: owner adds a person, sees the code once, changes role, disables and resets an invite',async({page})=>{
 await page.setViewportSize({width:1280,height:2400});
 await page.goto('/backoffice#bo-team');
 const team=page.locator('#bo-team');await expect(team).toBeVisible();
 const username=`team.ops.${Date.now()}`;
 await team.getByLabel('Username').fill(username);await team.getByLabel('Name',{exact:true}).fill('Budi Ops');
 await team.getByLabel('Role',{exact:true}).selectOption('ops');
 await team.getByRole('button',{name:'Add person'}).click();
 const code=(await team.getByTestId('staff-invite-code').textContent())!.trim();
 expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{10}$/);await expect(team).toContainText('Shown once');
 await expect(team.getByRole('button',{name:'Copy code'})).toBeVisible();
 await team.getByRole('button',{name:'I have copied it'}).click();await expect(team.getByTestId('staff-invite-code')).toHaveCount(0);
 const row=team.locator('tr',{hasText:username});await expect(row).toContainText('invite until');
 await row.getByLabel('Role of Budi Ops').selectOption('viewer');await expect(page.getByText('Role changed')).toBeVisible();
 await row.getByRole('button',{name:'Reset invite'}).click();await expect(team.getByTestId('staff-invite-code')).toBeVisible();
 expect((await team.getByTestId('staff-invite-code').textContent())!.trim()).not.toBe(code);
 await row.getByRole('button',{name:'Disable'}).click();await expect(row).toContainText('disabled');
 await expect(row.getByRole('button',{name:'Enable'})).toBeVisible();
});
