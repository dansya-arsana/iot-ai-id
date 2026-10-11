import {test,expect,type APIRequestContext} from '@playwright/test';

async function admin(request:APIRequestContext){
 const {token}=await (await request.get('/api/session')).json();
 return async(method:'GET'|'POST'|'PATCH',path:string,data?:unknown)=>{const response=await request.fetch('/api/ops/'+path,{method,headers:{'X-IOT-Session':token},data});expect(response.ok(),`${method} ${path}: ${await response.text()}`).toBeTruthy();return response.json();};
}

test('partner form stores an inquiry that the backoffice can work and convert',async({page})=>{
 const org=`Example Robotics ${Date.now()}`;
 await page.goto('/');
 await page.locator('.ds-header-actions').getByRole('link',{name:'Partner with us'}).click();
 await expect(page).toHaveURL(/\/partner$/);
 await expect(page).toHaveTitle(/Partner with us \| AIoT/);
 await page.getByRole('button',{name:'Send inquiry'}).click();
 await expect(page.getByText('Enter your name.')).toBeVisible();
 await expect(page.getByText('Please agree so we can contact you.')).toBeVisible();
 await page.getByLabel('Device maker / vendor').check({force:true});
 await page.fill('#pt-name','Li Wei');
 await page.fill('#pt-org',org);
 await page.fill('#pt-email','li@example.com');
 await page.fill('#pt-country','China');
 await page.selectOption('#pt-interest','Localization & distribution');
 await page.fill('#pt-message','We want to test our dexterous hand in Indonesian humidity and sell it to schools.');
 await expect(page.locator('#pt-website')).not.toBeInViewport();
 await page.locator('.pt-consent input').check();
 await page.getByRole('button',{name:'Send inquiry'}).click();
 await expect(page.getByRole('heading',{name:'Thank you. We have your message.'})).toBeVisible();
 const reference=(await page.locator('.pt-ref').textContent())!;
 expect(reference).toMatch(/^[0-9A-F]{8}$/);
 await expect(page.locator('[data-cta="partner-wa-after"]')).toHaveAttribute('href',new RegExp(`^https://wa\\.me/62812114040\\?text=.*${reference}`));

 await page.goto('/backoffice#bo-inquiries');
 const inbox=page.locator('#bo-inquiries');
 await expect(page.locator('.bo-ops-who')).toContainText('owner');
 const row=inbox.locator('.bo-ops-list > li').filter({hasText:org});
 await expect(row).toBeVisible();
 await row.locator('.bo-ops-row').click();
 await expect(row).toContainText('dexterous hand');
 await expect(row).toContainText('/partner');
 await row.getByLabel('Add a note').fill('Intro call booked');
 await row.getByRole('button',{name:'Add note'}).click();
 await expect(row.locator('.bo-ops-history')).toContainText('note: Intro call booked');
 await row.getByRole('button',{name:'Convert to organization'}).click();
 await expect(page.locator('.bo-ops-head .ds-notice')).toContainText('Organization created');
 await expect(page.locator('#bo-orgs table')).toContainText(org);
 await expect(inbox.locator('.bo-ops-list > li').filter({hasText:org}).locator('.ds-tag').first()).toHaveText('qualified');
});

test('distributor catalog and Lab Mitra payouts flow end to end, and reach the public pages',async({page,request})=>{
 const call=await admin(request);const stamp=Date.now();
 const vendor=await call('POST','organizations',{type:'vendor',name:`Hand Vendor ${stamp}`,country:'China'});
 const product=await call('POST','products',{slug:`hand-${stamp}`,vendorId:vendor.id,name:`Demo Hand ${stamp}`,category:'Dexterous hand',summary:'Six-DoF hand with tactile fingertips for research labs.',wireless:true});
 await page.goto('/products');
 await expect(page.locator('main h1')).toContainText('Hardware, tested before it ships.');
 await expect(page.locator('main')).not.toContainText(`Demo Hand ${stamp}`);

 // The backoffice refuses to sell before localization and evidence are complete.
 await page.goto('/backoffice#bo-products');
 const card=page.locator('.bo-ops-card').filter({hasText:`Demo Hand ${stamp}`});
 await card.getByLabel('Status').selectOption('available');
 await expect(page.locator('.bo-ops-head .ds-notice')).toContainText('Cannot mark available');
 await call('PATCH',`products/${product.id}`,{status:'available',published:true,localization:{sdppi:'done',manual_id:'done',warranty:'done',service_center:'done',stock:'done',pricing:'done'},evidence:[{label:'Humidity soak report',url:'https://iot.ai.id/docs/'}],testSummary:'72 h at 85% RH without faults.',priceNote:'Quote on request'});
 await page.goto('/products');
 const listed=page.locator('.pt-product').filter({hasText:`Demo Hand ${stamp}`});
 await expect(listed).toContainText('Tested in Indonesia');
 await expect(listed).toContainText(`Hand Vendor ${stamp}`);
 await expect(listed).toContainText('SDPPI certification');

 const school=`SMK Negeri Demo ${stamp}`;
 const lab=await call('POST','organizations',{type:'school',name:school,city:'Bekasi',status:'active',package:'lab',publicListing:true});
 const task=await call('POST','tasks',{title:`Humidity soak ${stamp}`,feeIdr:150000});
 await page.goto('/backoffice#bo-tasks');
 const row=page.locator('#bo-tasks tbody tr').filter({hasText:`Humidity soak ${stamp}`});
 await expect(row).toContainText('Rp90.000 / Rp37.500 / Rp22.500');
 await row.getByLabel('Lab').selectOption(lab.id);
 await row.getByRole('button',{name:'Assign'}).click();
 await expect(row.locator('.ds-tag')).toHaveText('assigned');
 await row.getByLabel('Evidence reference').fill('job 4f2a');
 await row.getByRole('button',{name:'Mark submitted'}).click();
 await expect(row.locator('.ds-tag')).toHaveText('submitted');
 await row.getByRole('button',{name:'Verify'}).click();
 await expect(row.locator('.ds-tag')).toHaveText('verified');
 await expect(page.locator('.bo-ops-payouts')).toContainText('Payout due');
 await row.getByRole('button',{name:'Mark paid'}).click();
 await expect(row.locator('.ds-tag')).toHaveText('paid');
 expect((await call('GET','tasks')).tasks.find((t:{id:string})=>t.id===task.id).status).toBe('paid');

 await page.goto('/id/');
 const board=page.locator('#papan tbody');
 await expect(board).toContainText(school);
 await expect(board.locator('tr').filter({hasText:school})).toContainText('Rp150.000');
});

test('public intake rejects junk and never exposes admin routes without a session',async({request})=>{
 expect((await request.post('/ops/v1/inquiries',{data:{kind:'vendor',name:'X',message:'short',consent:true}})).status()).toBe(400);
 expect((await request.post('/ops/v1/inquiries',{data:{kind:'vendor',name:'Bot',email:'b@example.com',message:'Buy cheap followers now',consent:true,website:'http://spam'}})).status()).toBe(202);
 const direct=await request.get('/ops/v1/admin/inquiries');expect(direct.status()).toBe(404);expect(await direct.text()).not.toContain('li@example.com');
 expect((await request.get('/api/ops/inquiries')).status()).toBe(403);
});
