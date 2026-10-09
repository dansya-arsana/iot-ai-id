import {test,expect} from '@playwright/test';

test('landing has original visual, usable navigation and real destinations',async({page})=>{
 await page.goto('/');
 await expect(page.locator('.result-landing')).toHaveAttribute('data-ready','true');
 await expect(page.locator('.rl-loader')).toBeHidden();
 await expect(page.getByRole('heading',{level:1})).toHaveAccessibleName('Dari komponen. Jadi sesuatu yang berguna.');
 const robot=page.locator('.rl-robot');
 await expect(robot).toBeVisible();
 expect(await robot.evaluate((el:HTMLImageElement)=>el.complete&&el.naturalWidth>0)).toBe(true);
 await expect(page.getByRole('link',{name:'Jelajahi hardware'})).toHaveAttribute('href','/hardware');
 await expect(page.locator('.rl-card-blue')).toHaveAttribute('href',/iot-ai-id\/releases\/tag\/v0.1.0-preview.1$/);
 await expect(page.getByRole('link',{name:'Explore a partnership'})).toHaveAttribute('href','/partnership-brief.txt');
 for(const width of [1440,768,390]){
  await page.setViewportSize({width,height:900});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await expect(robot).toBeVisible();
 }
 const toggle=page.locator('.rl-menu-toggle');
 await toggle.click();await expect(toggle).toHaveAttribute('aria-expanded','true');
 await page.keyboard.press('Escape');await expect(toggle).toHaveAttribute('aria-expanded','false');
 await toggle.click();await page.mouse.click(10,800);await expect(toggle).toHaveAttribute('aria-expanded','false');
 await toggle.click();await page.getByRole('navigation',{name:'Navigasi mobile'}).getByRole('link',{name:'Hardware',exact:true}).click();
 await expect(page).toHaveURL(/\/hardware$/);await expect(page.locator('.result-landing')).toHaveCount(0);
});

test('reduced motion reveals all content immediately and Learn stays usable',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');
 await expect(page.locator('.rl-loader')).toBeHidden();
 const headline=page.locator('#landing-title');
 expect(await headline.locator('[data-enter]').first().evaluate(el=>getComputedStyle(el).opacity)).toBe('1');
 await page.getByRole('link',{name:'Mulai belajar',exact:true}).click();await expect(page).toHaveURL(/\/learn$/);
});

 test('public reference catalog remains usable without an owner API session',async({page})=>{
  await page.route('**/api/session',route=>route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({error:'Workspace publik belum tersedia.'})}));
  await page.goto('/hardware/bme280');
  await expect(page.getByRole('status')).toContainText('Mode referensi offline');
  await expect(page.locator('.reference-detail h4')).toContainText('BME280');
  await expect(page.locator('.reference-result')).not.toHaveCount(0);
  await page.getByLabel('Cari perangkat atau alias').fill('raspberry');
  await expect(page.locator('.reference-results')).toContainText('Raspberry');
 });
