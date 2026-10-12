import {test,expect} from '@playwright/test';

/** `iot.admin.localhost` stands in for iot.ai.id. The backoffice itself is driven on the local desktop origin: the admin alias never serves /api (see 16), and locally the owner role applies. */
const PUBLIC='http://iot.admin.localhost:8891';
const INSTALLER='https://downloads.example.test/aiot-installer.zip';

test('members: staff create a member with grants, the member activates, unlocks products, gets the installer, signs out',async({page})=>{
 const username=`e2e.member.${Date.now()}`,password='a long member password';
 await page.setViewportSize({width:1440,height:900});

 // Anonymous visitors see invitation-only and a Sign in link, and cost no `me` request (no hint cookie).
 const meCalls:string[]=[];page.on('request',r=>{if(r.url().includes('/ops/v1/member/me'))meCalls.push(r.url());});
 await page.goto(PUBLIC+'/products');
 await expect(page.getByTestId('invitation-only')).toBeVisible();
 await expect(page.locator('.ds-header').getByRole('link',{name:'Sign in',exact:true})).toBeVisible();
 await page.goto(PUBLIC+'/');await page.goto(PUBLIC+'/masuk');
 expect(meCalls,'anonymous loads make no me request').toEqual([]);

 // Staff add the member in the backoffice and read the code once.
 await page.goto('/backoffice#bo-members');
 const section=page.locator('#bo-members');
 await expect(section.getByRole('heading',{name:'Members'})).toBeVisible();
 await page.fill('#mb-username',username);await page.fill('#mb-name','Mira Member');await page.fill('#mb-org','SMK Contoh');
 await page.check('#mb-g-products');await page.check('#mb-g-installer');
 await section.getByRole('button',{name:'Add member'}).click();
 const code=(await page.getByTestId('member-invite-code').textContent())!.trim();
 expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{10}$/);
 const row=page.getByTestId(`member-${username}`);
 await expect(row).toContainText('Mira Member');await expect(row).toContainText('SMK Contoh');
 await expect(row.getByLabel('Products')).toBeChecked();await expect(row.getByLabel('Installer download')).toBeChecked();await expect(row.getByLabel('Arena')).not.toBeChecked();
 await section.scrollIntoViewIfNeeded();
 await page.screenshot({path:'test-results/backoffice-members-desktop.png',fullPage:false,animations:'disabled'});

 // The member activates on the public host: validation first, then success lands on the profile.
 await page.goto(PUBLIC+'/masuk');
 await expect(page).toHaveTitle('Sign in | AIoT');
 await expect(page.locator('meta[name=robots]')).toHaveAttribute('content',/noindex/);
 await expect(page.getByRole('heading',{level:1})).toHaveText('Member sign-in');
 await page.screenshot({path:'test-results/member-login-desktop.png',fullPage:true,animations:'disabled'});
 await page.fill('#ml-username',username);await page.fill('#ml-password','not the password');
 await page.locator('form').getByRole('button',{name:'Sign in'}).click();
 await expect(page.getByRole('alert')).toContainText('Wrong username or password');
 await page.getByRole('tab',{name:'Activate invite'}).click();
 await page.fill('#ml-code','ABCD-bad');await page.fill('#ml-password','short');await page.fill('#ml-confirm','different');
 await page.locator('form').getByRole('button',{name:'Activate and sign in'}).click();
 await expect(page.getByText('Invite codes look like ABCD-EFGHJKMNPQ.')).toBeVisible();
 await page.fill('#ml-code',code);await page.fill('#ml-password',password);await page.fill('#ml-confirm',password);
 await page.locator('form').getByRole('button',{name:'Activate and sign in'}).click();
 await expect(page).toHaveURL(PUBLIC+'/profile');
 const cookie=(await page.context().cookies(PUBLIC+'/ops/v1/member/me')).find(c=>c.name==='aiot_member')!;
 expect(cookie.httpOnly).toBe(true);expect(cookie.sameSite).toBe('Strict');expect(cookie.path).toBe('/ops/v1/member');

 const hint=(await page.context().cookies(PUBLIC+'/')).find(c=>c.name==='aiot_member_hint')!;
 expect(hint.httpOnly).toBe(false);expect(hint.sameSite).toBe('Strict');expect(hint.path).toBe('/');
 // A reload probes `me` once (the hint is present) and keeps the member signed in.
 meCalls.length=0;await page.reload();
 await expect(page.getByRole('heading',{level:1})).toHaveText('Mira Member');expect(meCalls.length).toBe(1);

 // Profile: name, organization, unlocked and locked areas, the installer button.
 await expect(page.getByRole('heading',{level:1})).toHaveText('Mira Member');
 await expect(page.getByText('SMK Contoh').first()).toBeVisible();
 await expect(page.getByTestId('area-products')).toContainText('Unlocked');
 await expect(page.getByTestId('locked-bench')).toContainText('Invitation only');
 await expect(page.getByTestId('locked-bench').getByRole('link',{name:'Request access'})).toHaveAttribute('href','/partner');
 await expect(page.getByTestId('installer-button')).toHaveAttribute('href','/ops/v1/member/installer');
 await expect(page.locator('meta[name=robots]')).toHaveAttribute('content',/noindex/);
 await expect(page.locator('.ds-header').getByTestId('member-link')).toHaveText('Mira Member');
 await page.screenshot({path:'test-results/member-profile-desktop.png',fullPage:true,animations:'disabled'});
 // The installer link is a top-level navigation that redirects to the configured URL.
 const dl=await page.request.get(PUBLIC+'/ops/v1/member/installer',{maxRedirects:0});
 expect(dl.status()).toBe(302);expect(dl.headers().location).toBe(INSTALLER);
 // No public release link on the public host.
 await expect(page.locator('a[href*="github.com/dansya-arsana/iot-ai-id/releases"]')).toHaveCount(0);
 await page.setViewportSize({width:390,height:844});
 await page.reload();
 await expect(page.getByTestId('installer-button')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.screenshot({path:'test-results/member-profile-mobile.png',fullPage:true,animations:'disabled'});
 await page.setViewportSize({width:1440,height:900});

 // Products unlock (and reappear in the nav) while Bench stays invitation-only; the workspace points at the desktop app.
 await page.goto(PUBLIC+'/products');
 await expect(page.getByTestId('invitation-only')).toHaveCount(0);
 await expect(page.getByRole('heading',{level:1})).toContainText('Hardware, tested before it ships');
 const main=page.locator('.ds-header').getByRole('navigation',{name:'Main',exact:true});
 await expect(main.getByRole('link',{name:'Products',exact:true})).toBeVisible();
 await expect(main.getByRole('link',{name:'Products',exact:true})).not.toContainText('Preview');
 await page.goto(PUBLIC+'/bench');
 await expect(page.getByTestId('invitation-only')).toBeVisible();
 await expect(page.getByRole('heading',{level:1})).toContainText('invitation-only');
 await page.goto(PUBLIC+'/build');
 await expect(page.getByRole('heading',{level:1})).toContainText('runs in the desktop app');
 await expect(page.getByTestId('installer-button')).toBeVisible();
 await page.goto(PUBLIC+'/design');
 await expect(page.getByRole('heading',{level:1})).toContainText('invitation-only');

 // Staff adding a grant takes effect on the next load.
 await page.goto('/backoffice#bo-members');
 const bench=page.getByTestId(`member-${username}`).getByLabel('PhysicalBench');
 await bench.click();
 await expect(page.getByText('Grants updated')).toBeVisible();await expect(bench).toBeChecked();
 await page.goto(PUBLIC+'/bench');
 await expect(page.getByTestId('invitation-only')).toHaveCount(0);

 // Sign out locks everything again and the profile redirects to sign-in.
 await page.goto(PUBLIC+'/profile');
 await page.getByTestId('sign-out').click();
 await expect(page).toHaveURL(PUBLIC+'/');
 await expect(page.locator('.ds-header').getByRole('link',{name:'Sign in',exact:true})).toBeVisible();
 expect((await page.context().cookies(PUBLIC+'/')).some(c=>c.name==='aiot_member_hint')).toBe(false);
 // A stale hint costs one probe; the 401 clears it.
 await page.context().addCookies([{name:'aiot_member_hint',value:'1',url:PUBLIC+'/'}]);
 meCalls.length=0;await page.goto(PUBLIC+'/products');await expect(page.getByTestId('invitation-only')).toBeVisible();
 expect(meCalls.length).toBe(1);
 await expect.poll(async()=>(await page.context().cookies(PUBLIC+'/')).some(c=>c.name==='aiot_member_hint')).toBe(false);
 await page.goto(PUBLIC+'/products');await expect(page.getByTestId('invitation-only')).toBeVisible();
 await page.goto(PUBLIC+'/profile');await expect(page).toHaveURL(PUBLIC+'/masuk');
 expect((await page.request.get(PUBLIC+'/ops/v1/member/installer',{maxRedirects:0})).status()).toBe(401);

 // Signing in again, via the /login alias and in Indonesian.
 await page.goto(PUBLIC+'/login');
 await page.getByRole('button',{name:'ID',exact:true}).click();
 await expect(page.getByRole('heading',{level:1})).toHaveText('Masuk anggota');
 await page.fill('#ml-username',username);await page.fill('#ml-password',password);
 await page.locator('form').getByRole('button',{name:'Masuk',exact:true}).click();
 await expect(page).toHaveURL(PUBLIC+'/profile');
 await expect(page.getByTestId('area-bench')).toContainText('Terbuka');
 await page.getByRole('button',{name:'EN',exact:true}).click();
});

test('a member without the installer grant sees no installer button, and a disabled member is signed out',async({page,request})=>{
 const {token}=await (await request.get('/api/session')).json();
 const call=async(method:'GET'|'POST'|'PATCH',path:string,data?:unknown)=>{const r=await request.fetch('/api/ops/'+path,{method,headers:{'X-IOT-Session':token},data});expect(r.ok(),`${method} ${path}`).toBeTruthy();return r.json();};
 const username=`e2e.plain.${Date.now()}`;
 const made=await call('POST','members',{username,name:'Pia Plain',grants:['arena']});
 await page.goto(PUBLIC+'/masuk');
 await page.getByRole('tab',{name:'Activate invite'}).click();
 await page.fill('#ml-code',made.inviteCode);await page.fill('#ml-password','a long member password');await page.fill('#ml-confirm','a long member password');
 await page.locator('form').getByRole('button',{name:'Activate and sign in'}).click();
 await expect(page).toHaveURL(PUBLIC+'/profile');
 await expect(page.getByTestId('installer-button')).toHaveCount(0);
 await expect(page.getByTestId('installer-locked')).toContainText('Invitation only');
 expect((await page.request.get(PUBLIC+'/ops/v1/member/installer',{maxRedirects:0})).status()).toBe(403);
 await page.goto(PUBLIC+'/arena');await expect(page.getByTestId('invitation-only')).toHaveCount(0);
 await page.goto(PUBLIC+'/build');
 await expect(page.getByRole('heading',{level:1})).toContainText('runs in the desktop app');
 await expect(page.getByTestId('installer-button')).toHaveCount(0);
 // A 429 on `me` is "unknown", not "anonymous": the probe retries and the member keeps access.
 let limited=0;
 await page.route('**/ops/v1/member/me',route=>{if(limited++<2)return route.fulfill({status:429,contentType:'application/json',body:'{"error":"Too many"}'});return route.continue();});
 await page.goto(PUBLIC+'/arena');
 await expect.poll(()=>limited,{timeout:10000}).toBe(3);
 await expect(page.getByTestId('invitation-only')).toHaveCount(0);await expect(page.locator('#main')).toBeVisible();
 await page.unroute('**/ops/v1/member/me');
 await call('PATCH',`members/${made.member.id}`,{status:'disabled'});
 await page.goto(PUBLIC+'/arena');await expect(page.getByTestId('invitation-only')).toBeVisible();
});
