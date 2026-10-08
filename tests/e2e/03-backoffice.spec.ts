import {test, expect} from '@playwright/test';
const GOAL = 'Build an ESP32 room monitor with temperature, humidity and an OLED.';
test('backoffice shows real counts, project row and honest coordinator state', async ({page}) => {
  await page.goto('/build');
  await page.fill('#hero-goal', GOAL);
  await page.getByRole('button', {name: /Build it/}).click();
  await page.waitForURL(/\/project\//);
  await expect(page.locator('.school-status')).toContainText('Siap belajar', {timeout: 45000});
  await page.goto('/backoffice');
  await expect(page.locator('.bo-kpi-yellow')).toContainText('Total Proyek');
  await expect.poll(async () => Number(await page.locator('.bo-kpi-yellow strong').textContent()), {timeout: 30000}).toBeGreaterThan(0);
  const projects = Number(await page.locator('.bo-kpi-yellow strong').textContent());
  const experiments = Number(await page.locator('.bo-kpi-dark strong').first().textContent());
  expect(experiments).toBeGreaterThanOrEqual(0);
  await expect(page.locator('.bo-projects .bo-tr').filter({hasText: 'room monitor'}).first()).toBeVisible({timeout: 30000});
  await expect(page.locator('.bo-health')).toContainText('Belum dikonfigurasi');
  await expect(page.locator('.bo-title p')).toContainText('Tidak ada metrik rekaan');
  expect(projects).toBeGreaterThan(0);
});

test('dashboard search, raw status, project chat and mobile preserve operational controls', async ({page}) => {
  await page.goto('/backoffice');
  await expect(page.locator('.bo-projects')).toBeVisible();
  const session = await (await page.request.get('/api/session')).json();
  const response = await page.request.get('/api/backoffice',{headers:{'X-IOT-Session':session.token}});
  const data = await response.json();
  expect(data.experimentDaily.reduce((sum: number, day: any) => sum + day.count, 0)).toBe(data.counts.experiments);
  expect(data.counts.activeRemoteJobs).toBeGreaterThanOrEqual(0);
  const project = data.projects[0];
  await page.getByRole('textbox', {name:'Cari proyek'}).fill(project.id);
  await expect(page.locator('.bo-projects .bo-tr:not(.bo-th)')).toHaveCount(1);
  await page.getByRole('combobox', {name:'Filter status'}).selectOption(project.status);
  await expect(page.locator('.bo-projects .bo-tr:not(.bo-th)')).toHaveCount(1);
  await page.getByRole('textbox', {name:'Cari proyek'}).fill('no-project-matches-this');
  await expect(page.locator('.bo-projects')).toContainText('Tidak ada proyek yang cocok');
  await page.getByRole('textbox', {name:'Cari proyek'}).fill(project.title);
  await expect(page.locator('.bo-projects')).toContainText(project.id.slice(0,8));
  await page.getByRole('combobox', {name:'Proyek',exact:true}).selectOption(project.id);
  await expect(page.getByRole('link', {name:'Buka percakapan'})).toHaveAttribute('href','/project/' + project.id);
  await page.setViewportSize({width:390,height:844});
  const status = page.locator('.bo-projects .bo-tr:not(.bo-th) span').last();
  await expect(status).toHaveCSS('display','block');
  await expect(page.locator('.bo-header nav')).toBeVisible();
  await expect(page.getByRole('columnheader',{name:'Status',exact:true})).toHaveCount(1);
  await expect(page.getByRole('columnheader',{name:'Tujuan',exact:true})).toHaveCount(1);
  await page.getByRole('link', {name:'Buka percakapan'}).click();
  await page.waitForURL('**/project/' + project.id);
});

test('dashboard retry retains data and clears dashboard and independent runtime failures', async ({page}) => {
  let dashboardFails = false;
  let runtimeFails = false;
  await page.route('**/api/backoffice', route => dashboardFails ? route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'dashboard unavailable'})}) : route.continue());
  await page.route('**/api/status', route => runtimeFails ? route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'runtime unavailable'})}) : route.continue());
  await page.goto('/backoffice');
  await expect(page.locator('.bo-projects')).toBeVisible();
  const count = await page.locator('.bo-kpi-yellow strong').textContent();
  runtimeFails = true;
  await expect(page.locator('.bo-health [role=alert]')).toBeVisible({timeout:10000});
  await expect(page.locator('.bo-kpi-yellow strong')).toHaveText(count!);
  dashboardFails = true;
  await expect(page.locator('main > [role=alert]')).toBeVisible({timeout:10000});
  await expect(page.locator('.bo-projects')).toBeVisible();
  dashboardFails = false;runtimeFails = false;
  await page.getByRole('button',{name:'Coba lagi'}).first().click();
  await expect(page.locator('[role=alert]')).toHaveCount(0);
});

test('chart uses full daily aggregates and zero days have zero height', async ({page}) => {
  await page.route('**/api/backoffice', async route => {
    const response = await route.fetch();const data = await response.json();
    data.experimentDaily=[{date:new Date().toISOString().slice(0,10),count:91}];
    data.counts.experiments=91;data.recentExperiments=[];
    await route.fulfill({response,json:data});
  });
  await page.goto('/backoffice');
  await expect(page.locator('.bo-bar-count').last()).toHaveText('91');
  await expect(page.locator('.bo-bar').first()).toHaveCSS('height','0px');
  await expect(page.locator('.bo-chart')).toContainText('seluruh riwayat');
  await page.getByRole('button',{name:'12 minggu'}).click();
  await expect(page.locator('.bo-bar-count').last()).toHaveText('91');
});


test('late responses cannot overwrite a newer retry or restore stale errors', async ({page}) => {
  let dashboardRequest = 0;
  let runtimeRequest = 0;
  let releaseDashboard: (() => void) | undefined;
  let releaseRuntime: (() => void) | undefined;
  const dashboardDelay = new Promise<void>(resolve => {releaseDashboard = resolve;});
  const runtimeDelay = new Promise<void>(resolve => {releaseRuntime = resolve;});
  await page.route('**/api/backoffice', async route => {
    const request = ++dashboardRequest;
    if (request === 2) {
      await dashboardDelay;
      await route.fulfill({status:503,json:{error:'stale dashboard failure'}});
      return;
    }
    const response = await route.fetch(); const data = await response.json();
    data.counts.projects = request >= 3 ? 432 : 123;
    await route.fulfill({response,json:data});
  });
  await page.route('**/api/status', async route => {
    const request = ++runtimeRequest;
    if (request === 2) {
      await runtimeDelay;
      await route.fulfill({status:503,json:{error:'stale runtime failure'}});
      return;
    }
    await route.continue();
  });
  await page.goto('/backoffice');
  await expect(page.locator('.bo-kpi-yellow strong')).toHaveText('123');
  await expect.poll(() => dashboardRequest,{timeout:10000}).toBeGreaterThanOrEqual(2);
  await expect.poll(() => runtimeRequest,{timeout:10000}).toBeGreaterThanOrEqual(2);
  await page.getByRole('button',{name:'Perbarui data'}).click();
  await expect(page.locator('.bo-kpi-yellow strong')).toHaveText('432');
  await expect(page.locator('[role=alert]')).toHaveCount(0);
  const staleDashboard = page.waitForResponse(response => response.url().endsWith('/api/backoffice') && response.status() === 503);
  const staleRuntime = page.waitForResponse(response => response.url().endsWith('/api/status') && response.status() === 503);
  releaseDashboard!(); releaseRuntime!();
  await Promise.all([staleDashboard, staleRuntime]);
  await expect.poll(() => page.locator('[role=alert]').count()).toBe(0);
  await expect(page.locator('.bo-kpi-yellow strong')).toHaveText('432');
});

test('homepage prompt creates a build and dashboard navigation follows history',async({page})=>{
 await page.goto('/');
 await page.getByRole('textbox',{name:'Hardware goal'}).fill(GOAL);
 await page.getByRole('button',{name:/Build it/}).click();
 await page.waitForURL(/\/project\//);
 await expect(page.locator('.school-status')).toContainText('Siap belajar',{timeout:45000});
 const projectId=new URL(page.url()).pathname.split('/').at(-1);
 const session=await(await page.request.get('/api/session')).json();
 const project=await(await page.request.get('/api/projects/'+projectId,{headers:{'X-IOT-Session':session.token}})).json();
 expect(project.entryPoint).toBe('build');
 await page.goto('/backoffice#bo-runtime');
 const nav=page.getByRole('navigation',{name:'Navigasi backoffice'});
 await expect(nav.getByRole('link',{name:'Runtime',exact:true})).toHaveAttribute('aria-current','location');
 await nav.getByRole('link',{name:'Proyek',exact:true}).click();
 await expect(nav.getByRole('link',{name:'Proyek',exact:true})).toHaveAttribute('aria-current','location');
 await expect(nav.locator('[aria-current]')).toHaveCount(1);
 await page.goBack();
 await expect(nav.getByRole('link',{name:'Runtime',exact:true})).toHaveAttribute('aria-current','location');
 await page.goForward();
 await expect(nav.getByRole('link',{name:'Proyek',exact:true})).toHaveAttribute('aria-current','location');
});
