import {test,expect,type APIRequestContext} from '@playwright/test';
import {readFileSync} from 'node:fs';

async function admin(request:APIRequestContext){
 const {token}=await (await request.get('/api/session')).json();
 return async(method:'GET'|'POST'|'PATCH',path:string,data?:unknown)=>{const response=await request.fetch('/api/ops/'+path,{method,headers:{'X-IOT-Session':token},data});expect(response.ok(),`${method} ${path}: ${await response.text()}`).toBeTruthy();return response.json();};
}

test('Lab Mitra portal: school admin and teacher allocate a verified task, AIoT pays the school, the school confirms',async({page,request,browser,baseURL})=>{
 const call=await admin(request);const stamp=Date.now();const schoolName=`SMK Portal Demo ${stamp}`,title=`Soak test ${stamp}`;
 const org=await call('POST','organizations',{type:'school',name:schoolName,city:'Bekasi',status:'active',package:'lab'});

 // 1. AIoT creates the school admin and reads the one-time invite code.
 await page.goto('/backoffice#bo-commissions');
 const panel=page.locator('#bo-commissions');
 await panel.getByLabel('School',{exact:true}).selectOption(org.id);
 await panel.getByLabel('School admin name').fill('Siti Admin');
 await panel.getByRole('button',{name:'Create school admin'}).click();
 const code=(await panel.getByTestId('invite-code').textContent())!.trim();
 expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{10}$/);
 await expect(panel).toContainText('Shown once');
 const people=async()=>(await call('GET','people')).people as {id:string;name:string;username:string;orgId:string;role:string}[];
 const adminUser=(await people()).find(p=>p.name==='Siti Admin'&&p.orgId===org.id)!.username;
 expect(adminUser).toMatch(/^siti\.smk-portal-demo/);

 // 2. The school admin activates on /mitra, adds a teacher and a student with guardian consent.
 const school=await browser.newContext({baseURL,viewport:{width:1280,height:2400}});const sp=await school.newPage();
 await sp.goto('/mitra');
 await expect(sp).toHaveTitle(/Lab Mitra portal \| AIoT/);
 await sp.getByRole('button',{name:'Activate account'}).click();
 await sp.fill('#mt-code',code);
 await sp.fill('#mt-password','a long school password');
 await sp.getByRole('button',{name:'Activate and sign in'}).click();
 await expect(sp.locator('main h1')).toContainText(schoolName);
 await expect(sp.getByText('Account activated')).toBeVisible();
 await sp.fill('#mt-teacher-name','Budi Guru');
 await sp.getByRole('button',{name:'Add teacher'}).click();
 const teacherCode=(await sp.getByTestId('teacher-invite').textContent())!.trim();
 expect(teacherCode).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{10}$/);
 await sp.fill('#mt-student-name','Ani Siswa');
 await sp.fill('#mt-student-class','XI TKJ 1');
 await expect(sp.getByRole('button',{name:'Add student'})).toBeDisabled();
 await sp.locator('.mt-consent input').check();
 await sp.getByRole('button',{name:'Add student'}).click();
 await expect(sp.getByText('Student added')).toBeVisible();
 await expect(sp.locator('.mt-table').filter({hasText:'Students'})).toContainText('Ani Siswa');

 // 3. The teacher activates, signs out and logs in again.
 const staff=await browser.newContext({baseURL,viewport:{width:1280,height:2400}});const tp=await staff.newPage();
 await tp.goto('/mitra');
 await tp.getByRole('button',{name:'Activate account'}).click();
 await tp.fill('#mt-code',teacherCode);
 await tp.fill('#mt-password','a long teacher password');
 await tp.getByRole('button',{name:'Activate and sign in'}).click();
 await expect(tp.getByRole('heading',{name:'Tasks you lead'})).toBeVisible();
 await tp.getByRole('button',{name:'Sign out'}).click();
 const teacher=(await people()).find(p=>p.name==='Budi Guru'&&p.orgId===org.id)!;
 await tp.getByRole('button',{name:'Sign in'}).first().click();
 await tp.fill('#mt-username',teacher.username);
 await tp.fill('#mt-password','a wrong teacher password');
 await tp.locator('form').getByRole('button',{name:'Sign in'}).click();
 await expect(tp.getByRole('alert')).toContainText('Wrong username or password');
 await tp.fill('#mt-password','a long teacher password');
 await tp.locator('form').getByRole('button',{name:'Sign in'}).click();
 await expect(tp.getByRole('heading',{name:'Tasks you lead'})).toBeVisible();

 // 4. AIoT creates a task for the school with the teacher as lead; the teacher submits evidence and proposes the split.
 const task=await call('POST','tasks',{title,feeIdr:150000,labId:org.id,leadId:teacher.id});
 await tp.reload();
 const card=tp.locator('.ds-card').filter({hasText:title}).first();
 await card.getByLabel('Evidence reference').fill('job 4f2a');
 await card.getByRole('button',{name:'Submit evidence'}).click();
 await expect(tp.getByText('Evidence submitted')).toBeVisible();
 await card.getByLabel(/Ani Siswa/).first().check();
 await expect(card.locator('.mt-sum')).toContainText('Rp90.000 / Rp90.000');
 await card.getByRole('button',{name:'Propose allocation'}).click();
 await expect(tp.getByText('Allocation proposed')).toBeVisible();
 await expect(card).toContainText('allocation pending');

 // 5. AIoT verifies; the school admin approves the allocation.
 await call('PATCH',`tasks/${task.id}`,{action:'verify'});
 await sp.reload();
 await expect(sp.getByRole('heading',{name:'Allocations to approve'})).toBeVisible();
 await expect(sp.locator('.mt-list').first()).toContainText('Ani Siswa');
 await sp.getByRole('button',{name:`Approve ${title}`}).click();
 await expect(sp.getByText('Allocation approved')).toBeVisible();

 // 6. AIoT creates a batch and marks it paid; the task becomes paid; the school confirms distribution.
 await page.reload();
 const school$=panel.locator('tbody tr').filter({hasText:schoolName}).first();
 await school$.getByRole('button',{name:/Create batch/}).click();
 const batchRow=panel.locator('tbody tr').filter({hasText:'created'});
 await expect(batchRow).toBeVisible();
 await expect(batchRow.getByRole('button',{name:'Mark paid'})).toBeDisabled();
 await batchRow.getByLabel('Transfer reference').fill('BCA-0001');
 await batchRow.getByRole('button',{name:'Mark paid'}).click();
 await expect(page.locator('.bo-ops-head .ds-notice')).toContainText('tasks are now paid');
 expect((await call('GET','tasks')).tasks.find((t:{id:string})=>t.id===task.id).status).toBe('paid');
 await sp.reload();
 await expect(sp.locator('.ds-stat').filter({hasText:'Paid to the school'})).toContainText('Rp150.000');
 await expect(sp.getByRole('heading',{name:'Received batches'})).toBeVisible();
 await sp.getByRole('button',{name:/Confirm distributed/}).click();
 await expect(sp.getByText('Recorded as distributed')).toBeVisible();
 await expect(sp.locator('.ds-stat').filter({hasText:'Waiting to be distributed'})).toContainText('Rp0');

 // 7. The CSV lists the student and the amount.
 const [download]=await Promise.all([sp.waitForEvent('download'),sp.getByRole('button',{name:'Download CSV'}).click()]);
 const csv=readFileSync((await download.path())!,'utf8');
 expect(csv).toContain('student,Ani Siswa,XI TKJ 1,90000');
 expect(csv).toContain('BCA-0001');
 await school.close();await staff.close();
});

test('portal API refuses anonymous calls, missing CSRF header and sets a scoped session cookie',async({request})=>{
 expect((await request.get('/ops/v1/portal/me')).status()).toBe(401);
 expect((await request.get('/ops/v1/portal/people')).status()).toBe(401);
 expect((await request.post('/ops/v1/portal/login',{data:{username:'nobody.nowhere',password:'wrong password'}})).status()).toBe(403);
 const login=await request.post('/ops/v1/portal/login',{headers:{'X-AIoT-Portal':'1'},data:{username:'nobody.nowhere',password:'wrong password'}});
 expect(login.status()).toBe(401);expect(login.headers()['set-cookie']).toBeUndefined();
 const robots=await request.get('/robots.txt');if(robots.ok())expect(await robots.text()).toContain('Disallow: /mitra');
});
