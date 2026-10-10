import {test,expect} from '@playwright/test';

test('landing has original visual, usable navigation and real destinations',async({page})=>{
 await page.goto('/');
 await expect(page.locator('.result-landing')).toHaveAttribute('data-ready','true');
 await expect(page.locator('.rl-loader')).toBeHidden();
 await expect(page.getByRole('heading',{level:1})).toHaveText(/Testing robots\s*and sensors where\s*the world is messy\./);
 const capsule=page.locator('.rl-capsule');
 await expect(capsule).toBeVisible();
 expect(await capsule.evaluate((el:HTMLImageElement)=>el.complete&&el.naturalWidth>0)).toBe(true);
 await expect(page.getByRole('link',{name:/Explore field testing/})).toHaveAttribute('href','/partnership-brief.txt');
 await expect(page.locator('.ds-header').getByRole('link',{name:'Partner with us'})).toHaveAttribute('href','/partnership-brief.txt');
 await expect(page.locator('.rl-scenario')).toHaveCount(6);
 await expect(page.locator('.rl-map svg circle').first()).toBeAttached();
 for(const width of [1440,768,390]){
  await page.setViewportSize({width,height:900});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await expect(capsule).toBeVisible();
 }
 const toggle=page.locator('.ds-menu-toggle');
 await toggle.click();await expect(toggle).toHaveAttribute('aria-expanded','true');
 await page.keyboard.press('Escape');await expect(toggle).toHaveAttribute('aria-expanded','false');
 await toggle.click();await page.mouse.click(10,800);await expect(toggle).toHaveAttribute('aria-expanded','false');
 await toggle.click();await page.locator('#ds-mobile-menu').getByRole('link',{name:'Hardware',exact:true}).click();
 await expect(page).toHaveURL(/\/hardware$/);await expect(page.locator('.result-landing')).toHaveCount(0);
});

test('language toggle switches the landing to Indonesian and remembers it',async({page})=>{
 await page.goto('/');
 await page.locator('.ds-header').getByRole('button',{name:'ID',exact:true}).click();
 await expect(page.getByRole('heading',{level:1})).toHaveText(/Menguji robot/);
 await expect(page.locator('html')).toHaveAttribute('lang','id');
 await page.reload();
 await expect(page.getByRole('heading',{level:1})).toHaveText(/Menguji robot/);
 await page.locator('.ds-header').getByRole('button',{name:'EN',exact:true}).click();
 await expect(page.getByRole('heading',{level:1})).toHaveText(/Testing robots/);
});

test('reduced motion reveals all content immediately and Learn stays usable',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');
 await expect(page.locator('.rl-loader')).toBeHidden();
 expect(await page.locator('.rl-hero-copy').evaluate(el=>getComputedStyle(el).opacity)).toBe('1');
 await page.locator('.ds-header').getByRole('link',{name:'Learn',exact:true}).click();await expect(page).toHaveURL(/\/learn$/);
});

test('public reference catalog remains usable without an owner API session',async({page})=>{
 await page.route('**/api/session',route=>route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({error:'Workspace publik belum tersedia.'})}));
 await page.goto('/hardware/bme280');
 await expect(page.getByText('Offline reference mode').first()).toBeVisible();
 await expect(page.getByRole('heading',{level:1})).toContainText('BME280');
 await page.goto('/hardware');
 await expect(page.locator('.reference-result')).not.toHaveCount(0);
 await page.getByLabel('Search devices or aliases').fill('raspberry');
 await expect(page.locator('.reference-results')).toContainText('Raspberry');
});
