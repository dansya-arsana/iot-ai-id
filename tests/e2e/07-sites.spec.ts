import {test,expect,type Page} from '@playwright/test';
async function request(page:Page,path:string,method='GET',body?:unknown){return page.evaluate(async({path,method,body})=>{const {token}=await(await fetch('/api/session')).json();const r=await fetch('/api'+path,{method,headers:{'X-IOT-Session':token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};},{path,method,body});}
test('farm hierarchy persists moves, declared network, linked wiring, and mobile forms',async({page})=>{
 await page.goto('/sites');await page.getByLabel('Location name',{exact:true}).fill('Kebun QA');await page.getByRole('button',{name:'Create location'}).click();await page.waitForURL(/\/site\//);const id=page.url().split('/').at(-1)!;await page.getByRole('button',{name:'Areas',exact:true}).click();
 for(const name of ['Lahan utara','Tangki']){await page.getByLabel('New area name').fill(name);await page.getByRole('button',{name:'Add area',exact:true}).click();await expect(page.getByLabel('New area name')).toHaveValue('');}
 await expect.poll(async()=>(await request(page,'/sites/'+id)).data.areas.length).toBe(2);
 const p=(await request(page,'/projects','POST',{goal:'Build an ESP32 room monitor with temperature, humidity and an OLED.'})).data;
 await page.reload();await page.getByRole('button',{name:'Areas',exact:true}).click();await page.getByLabel('New device name').fill('Monitor kebun');await page.getByLabel('Linked project').selectOption(p.id);await page.getByRole('button',{name:'Add device',exact:true}).click();await expect.poll(async()=>(await request(page,'/sites/'+id)).data.devices.length).toBe(1);await expect(page.locator('.flow-status')).toContainText('Contract valid',{timeout:45000});await page.getByRole('button',{name:'Areas',exact:true}).click();
 await page.getByLabel('New device name').fill('Level tangki');await page.getByLabel('Linked project').selectOption('');await page.getByLabel('Area for new device',{exact:true}).selectOption({label:'Tangki'});await page.getByRole('button',{name:'Add device',exact:true}).click();await expect.poll(async()=>(await request(page,'/sites/'+id)).data.devices.length).toBe(2);
 await page.getByLabel('From',{exact:true}).selectOption({label:'Monitor kebun'});await page.getByLabel('To',{exact:true}).selectOption({label:'Level tangki'});await page.getByLabel('Protocol',{exact:true}).selectOption('mqtt');await page.getByRole('button',{name:'Add declaration'}).click();await expect(page.locator('.react-flow__edge')).toHaveCount(9);
 await page.locator('.site-device-list').getByRole('button',{name:/^Monitor kebun/}).click();await page.getByLabel('Device area',{exact:true}).selectOption({label:'Tangki'});await expect.poll(async()=>(await request(page,'/sites/'+id)).data.devices[0].areaId).toBe((await request(page,'/sites/'+id)).data.areas[1].id);
 await page.getByLabel('X',{exact:true}).fill('240');await page.getByRole('button',{name:'Save position'}).click();await expect.poll(async()=>(await request(page,'/sites/'+id)).data.devices[0].position.x).toBe(240);
 await page.reload();await expect(page.locator('.react-flow__edge')).toHaveCount(9);await page.getByRole('button',{name:'Areas',exact:true}).click();await page.locator('.site-device-list').getByRole('button',{name:/^Monitor kebun/}).click();await page.getByRole('button',{name:'Focus device',exact:true}).click();await expect(page.locator('.flow-status')).toContainText('Contract valid',{timeout:45000});
 await page.goto('/site/'+id);await page.getByRole('button',{name:'Areas',exact:true}).click();await page.setViewportSize({width:390,height:844});await expect(page.getByLabel('New device name')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
test('CAS conflict preserves unsaved position until explicit reload',async({page})=>{
 await page.goto('/sites');const a={id:crypto.randomUUID(),name:'Area',icon:'field',position:{x:0,y:0}};const s=(await request(page,'/sites','POST',{name:'Conflict',areas:[a],devices:[],links:[]})).data;await page.goto('/site/'+s.id);await page.getByRole('button',{name:'Areas',exact:true}).click();await page.locator('.site-device-list').getByRole('button',{name:/Area/}).click();const old=await request(page,'/sites/'+s.id);await request(page,'/sites/'+s.id,'PUT',{expectedRevision:0,snapshot:{name:'Concurrent',areas:[a],devices:[],links:[]}});await page.getByLabel('X',{exact:true}).fill('777');await page.getByRole('button',{name:'Save position'}).click();await expect(page.getByRole('alert')).toContainText('revision conflict');await page.waitForTimeout(3500);await expect(page.getByLabel('X',{exact:true})).toHaveValue('777');expect(old.data.revision).toBe(0);await page.getByRole('button',{name:'Reload',exact:true}).click();await expect(page.locator('h1')).toHaveText('Concurrent');
});

test('one canvas contains repeated hardware and read-only devices; dirty wiring blocks focus',async({page})=>{
 await page.goto('/sites');const goal='Build an ESP32 room monitor with temperature, humidity and an OLED.';
 const p1=(await request(page,'/projects','POST',{goal})).data,p2=(await request(page,'/projects','POST',{goal})).data;
 await expect.poll(async()=>(await request(page,'/projects/'+p1.id)).data.contractId,{timeout:45000}).toBeTruthy();await expect.poll(async()=>(await request(page,'/projects/'+p2.id)).data.contractId,{timeout:45000}).toBeTruthy();
 const area={id:crypto.randomUUID(),name:'Area ganda',icon:'field',position:{x:40,y:40}},d1={id:crypto.randomUUID(),name:'Monitor satu',kind:'environment',areaId:area.id,required:true,projectId:p1.id,position:{x:30,y:90}},d2={...d1,id:crypto.randomUUID(),name:'Monitor dua',projectId:p2.id,position:{x:980,y:90}};
 const site=(await request(page,'/sites','POST',{name:'Unified QA',areas:[area],devices:[d1,d2],links:[]})).data;
 await page.goto('/site/'+site.id);await expect(page.locator('.react-flow')).toHaveCount(1);await expect(page.locator('.hardware-part')).toHaveCount(6,{timeout:20000});await expect(page.locator('.react-flow__edge')).toHaveCount(16);
 const remote=page.locator(`[data-id="device:${d2.id}:part:bme280"]`);await expect(remote).toHaveCount(1);await expect(remote.locator('.react-flow__handle.connectable')).toHaveCount(0);await expect(page.locator(`[data-id="device:${d2.id}:part:ssd1306"] .react-flow__handle[data-handleid="SDA"]`)).toHaveCount(1);
 await page.getByRole('button',{name:'Inspect BME280 environmental sensor',exact:true}).first().click();await page.getByLabel('Connection bme280 SDA').selectOption('18');await page.getByRole('button',{name:'Close inspector'}).click();
 await page.locator(`[data-id="device:${d2.id}"] .flow-device-group button`).first().click();await expect(page.locator('.flow-status')).toContainText('Local draft');await expect(page.locator('.chat-device-context')).toContainText('Monitor satu');
 await page.getByRole('button',{name:'Discard edits'}).click();await page.locator(`[data-id="device:${d2.id}"] .flow-device-group button`).first().click();await expect(page.locator('.chat-device-context')).toContainText('Monitor dua');await expect(page.locator('.react-flow')).toHaveCount(1);await expect(page.locator('.react-flow__edge')).toHaveCount(16);
});

test('empty location starts a real hardware project through the same canvas chat',async({page})=>{
 await page.goto('/sites');
 const site=(await request(page,'/sites','POST',{name:'Chat start',areas:[],devices:[],links:[]})).data;
 await page.goto('/site/'+site.id);
 await expect(page.locator('.react-flow')).toHaveCount(1);
 await page.getByRole('button',{name:'Open chat',exact:true}).click();await page.getByLabel('Message for the hardware engineer',{exact:true}).fill('Build an ESP32 room monitor with temperature, humidity and an OLED.');
 await page.getByRole('button',{name:'Send message',exact:true}).click();
 await expect.poll(async()=>(await request(page,'/sites/'+site.id)).data.devices.length,{timeout:45000}).toBe(1);
 await expect(page.locator('.hardware-part')).toHaveCount(3,{timeout:45000});
 await expect(page.locator('.react-flow__edge')).toHaveCount(8);
 await expect(page.locator('.chat-device-context')).toContainText('Perangkat pertama');
});

test('canvas actions add and remove areas/devices without the inspector drawer',async({page})=>{
 await page.goto('/sites');const area={id:crypto.randomUUID(),name:'Utara',icon:'field',position:{x:40,y:40}};
 const project=(await request(page,'/projects','POST',{goal:'Build an ESP32 room monitor with temperature, humidity and an OLED.'})).data;
 const device={id:crypto.randomUUID(),name:'Monitor tetap',kind:'environment',areaId:area.id,required:true,projectId:project.id,position:{x:30,y:90}};
 const site=(await request(page,'/sites','POST',{name:'Canvas CRUD',areas:[area],devices:[device],links:[]})).data;
 await page.goto('/site/'+site.id);await expect(page.locator('.flow-status')).toContainText('Contract valid',{timeout:45000});
 await expect(page.getByRole('button',{name:'Remove area Utara',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'＋ Area',exact:true}).click();await page.getByLabel('Canvas area name').fill('Selatan');await page.getByRole('button',{name:'Add area',exact:true}).click();
 await expect.poll(async()=>(await request(page,'/sites/'+site.id)).data.areas.length).toBe(2);
 await page.getByRole('button',{name:'Add device in Selatan',exact:true}).click();await expect(page.getByLabel('Canvas device area')).toHaveValue((await request(page,'/sites/'+site.id)).data.areas[1].id);
 await page.getByLabel('Canvas device name').fill('Sensor baru');await page.getByRole('button',{name:'Add device',exact:true}).click();await expect.poll(async()=>(await request(page,'/sites/'+site.id)).data.devices.length).toBe(2);
 const state=(await request(page,'/sites/'+site.id)).data;await request(page,'/sites/'+site.id,'PUT',{expectedRevision:state.revision,snapshot:{name:state.name,areas:state.areas,devices:state.devices,links:[{id:crypto.randomUUID(),source:device.id,target:state.devices[1].id,kind:'mqtt',status:'declared_unverified'}]}});
 await page.reload();await page.getByRole('button',{name:'Detach device Sensor baru',exact:true}).click();await page.getByRole('button',{name:'Confirm device detach',exact:true}).click();
 await expect.poll(async()=>(await request(page,'/sites/'+site.id)).data.links.length).toBe(0);await expect.poll(async()=>(await request(page,'/sites/'+site.id)).data.devices.length).toBe(1);
 await page.getByRole('button',{name:'Remove area Selatan',exact:true}).click();await page.getByRole('button',{name:'Confirm area removal',exact:true}).click();await expect.poll(async()=>(await request(page,'/sites/'+site.id)).data.areas.length).toBe(1);
 await page.getByRole('button',{name:'Inspect BME280 environmental sensor',exact:true}).click();await page.getByLabel('Connection bme280 SDA').selectOption('18');await expect(page.getByRole('button',{name:'Remove component',exact:true})).toBeDisabled();await page.getByRole('button',{name:'Close inspector'}).click();
 await expect(page.getByRole('button',{name:'＋ Area',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'Detach device Monitor tetap',exact:true})).toBeDisabled();await page.getByRole('button',{name:'Discard edits'}).click();
 await page.getByRole('button',{name:'Detach device Monitor tetap',exact:true}).click();await page.getByRole('button',{name:'Confirm device detach',exact:true}).click();await expect.poll(async()=>(await request(page,'/sites/'+site.id)).data.devices.length).toBe(0);expect((await request(page,'/projects/'+project.id)).status).toBe(200);await page.getByRole('button',{name:'Open chat',exact:true}).click();await expect(page.getByLabel('Message for the hardware engineer')).toBeVisible();
 await expect(page.locator('.flow-site-drawer')).toHaveCount(0);
});

test('free canvas fills viewport and chat slides over it without resizing',async({page})=>{
 await page.goto('/sites');const site=(await request(page,'/sites','POST',{name:'Free canvas',areas:[],devices:[],links:[]})).data;await page.goto('/site/'+site.id);
 const bounds=()=>page.locator('.react-flow').evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,screenWidth:innerWidth,screenHeight:innerHeight};});
 await expect(page.getByRole('button',{name:'Open chat',exact:true})).toBeVisible();let before=await bounds();expect(before.x).toBe(0);expect(before.y).toBe(0);expect(before.width).toBe(before.screenWidth);expect(before.height).toBe(before.screenHeight);await expect(page.locator('#workbench-chat')).toHaveAttribute('inert','');
 await page.getByRole('button',{name:'Open chat',exact:true}).click();await expect(page.getByLabel('Message for the hardware engineer')).toBeVisible();expect(await bounds()).toEqual(before);
 await page.getByRole('button',{name:'Close chat',exact:true}).click();await expect(page.locator('#workbench-chat')).toHaveAttribute('inert','');
 await page.setViewportSize({width:390,height:844});before=await bounds();expect(before.width).toBe(390);expect(before.height).toBe(844);await page.getByRole('button',{name:'Open chat',exact:true}).click();await expect(page.getByLabel('Message for the hardware engineer')).toBeVisible();expect(await bounds()).toEqual(before);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
});
