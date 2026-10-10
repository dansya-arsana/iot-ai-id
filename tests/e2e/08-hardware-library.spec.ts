import {test,expect} from '@playwright/test';
test('persistent hardware references expose sourced planning data and searchable details',async({page})=>{
 await page.goto('/hardware');
 const response=await page.evaluate(async()=>{const {token}=await(await fetch('/api/session')).json();return (await fetch('/api/hardware',{headers:{'X-IOT-Session':token}})).json();});
 expect(response.catalog).toHaveLength(56);expect(response.boards).toHaveLength(16);expect(response.components).toHaveLength(16);
 await expect(page.locator('.reference-result')).toHaveCount(56);
 await page.getByLabel('Search devices or aliases').fill('raspy');
 await expect(page.locator('.reference-result')).toHaveCount(3);
 await page.locator('.reference-result').filter({hasText:'Raspberry Pi 4 Model B'}).click();
 await expect(page.locator('.reference-detail')).toContainText('3.3');
 await expect(page.locator('.reference-detail')).toContainText('not yet runnable');
 await expect(page.locator('.reference-detail a').first()).toHaveAttribute('href',/^https:\/\//);
 await page.goto('/hardware/scd41');
 await expect(page.getByRole('heading',{level:1})).toContainText('SCD41');await expect(page.locator('.reference-detail')).toContainText('Sources');
 await page.reload();await expect(page.locator('.reference-result')).toHaveCount(56);
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('assembly guide shows readiness evidence on Learn and hardware at mobile width',async({page})=>{
 await page.goto('/learn');
 await expect(page.getByRole('region',{name:'Assembly learning path'})).toBeVisible();
 await page.locator('.build-progression summary').nth(2).click();
 await expect(page.locator('.build-progression')).toContainText('Perfboard with separate pads needs its own connections');
 await expect(page.locator('.build-progression details').nth(2)).toHaveAttribute('open','');
 await page.goto('/hardware');
 await page.setViewportSize({width:390,height:844});
 await page.locator('.build-progression summary').nth(2).click();
 await expect(page.locator('.build-progression details').nth(2)).toHaveAttribute('open','');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
