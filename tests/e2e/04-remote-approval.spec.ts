import {test, expect, type APIRequestContext} from '@playwright/test';
const GOAL = 'Build an ESP32 room monitor with temperature, humidity and an OLED.';
async function sessionHeaders(request: APIRequestContext) {
  const session = await (await request.get('/api/session')).json();
  return {'X-IOT-Session': session.token as string, 'Content-Type': 'application/json'};
}
async function readyProject(request: APIRequestContext, headers: Record<string, string>) {
  const project = await (await request.post('/api/projects', {headers, data: {goal: GOAL}})).json();
  await expect.poll(async () => (await (await request.get(`/api/projects/${project.id}`, {headers})).json()).status, {timeout: 45000}).toBe('ready');
  return project;
}
async function currentContract(request: APIRequestContext, headers: Record<string, string>, projectId: string) {
  const project = await (await request.get(`/api/projects/${projectId}`, {headers})).json();
  return project.contracts.find((c: any) => c.id === project.contractId);
}
test('simulate remote job shows approval banner, then completes after approval', async ({page, request}) => {
  const headers = await sessionHeaders(request);
  const project = await readyProject(request, headers);
  const version = await currentContract(request, headers, project.id);
  const jobInput = {id: crypto.randomUUID(), leaseId: crypto.randomUUID(), expiresAt: Date.now() + 25000, operation: 'simulate', projectId: project.id, contractId: version.id, contractHash: version.hash, deviceId: null};
  const accepted = await request.post('/api/remote-jobs', {headers, data: jobInput});
  expect(accepted.status()).toBe(201);
  await page.goto('/project/' + project.id);
  await expect(page.getByRole('region', {name: /Permintaan jarak jauh/})).toBeVisible();
  await expect(page.getByRole('region', {name: /Permintaan jarak jauh/})).toContainText('latihan model');
  await page.getByRole('button', {name: /Setujui & jalankan/}).click();
  await expect(page.getByRole('region', {name: /Permintaan jarak jauh/})).toBeHidden({timeout: 30000});
  await expect(page.locator('.school-status')).toContainText('Latihan lolos', {timeout: 45000});
});
test('physical remote job waits for trusted USB device', async ({page, request}) => {
  const headers = await sessionHeaders(request);
  const project = await readyProject(request, headers);
  const version = await currentContract(request, headers, project.id);
  const jobInput = {id: crypto.randomUUID(), leaseId: crypto.randomUUID(), expiresAt: Date.now() + 25000, operation: 'physical', projectId: project.id, contractId: version.id, contractHash: version.hash, deviceId: '/dev/cu.e2e-fixture'};
  const accepted = await request.post('/api/remote-jobs', {headers, data: jobInput});
  expect(accepted.status()).toBe(201);
  await page.goto('/project/' + project.id);
  await expect(page.getByRole('region', {name: /Permintaan jarak jauh/})).toBeVisible();
  await expect(page.getByRole('region', {name: /Permintaan jarak jauh/})).toContainText('eksperimen perangkat fisik');
  await expect(page.getByRole('region', {name: /Permintaan jarak jauh/})).toContainText('/dev/cu.e2e-fixture');
  await expect(page.getByRole('button', {name: /Setujui & jalankan/})).toBeDisabled();
  await expect(page.getByRole('region', {name: /Permintaan jarak jauh/})).toContainText('Pilih dan izinkan perangkat USB');
});

test('approval disappears at expiry even when polling fails',async({page,request})=>{
 const headers=await sessionHeaders(request);const project=await readyProject(request,headers);
 let remoteRequests=0;
 await page.route('**/api/remote-jobs',route=>{
  if(++remoteRequests>1)return route.fulfill({status:503,json:{error:'poll unavailable'}});
  return route.fulfill({json:{jobs:[{id:crypto.randomUUID(),status:'awaiting_approval',input:{projectId:project.id,operation:'simulate',expiresAt:Date.now()+3000}}]}});
 });
 await page.goto('/project/'+project.id);
 await expect(page.getByRole('button',{name:/Setujui & jalankan/})).toBeEnabled();
 await expect(page.getByRole('button',{name:/Setujui & jalankan/})).toHaveCount(0,{timeout:8000});
});
