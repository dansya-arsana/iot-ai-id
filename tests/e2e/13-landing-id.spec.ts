import {test,expect} from '@playwright/test';

test('Indonesian SMK landing sells the program and every CTA opens WhatsApp',async({page,context})=>{
 await page.goto('/id');
 await expect(page.locator('html')).toHaveAttribute('lang','id');
 await expect(page.getByRole('heading',{level:1})).toContainText('dibayar');
 await expect(page).toHaveTitle(/Program Lab Mitra/);
 await expect(page.locator('.lid-card')).toHaveCount(3);
 await expect(page.locator('#paket')).toContainText('Rp9.900.000');
 await expect(page.locator('#paket')).toContainText('Rp1.490.000');
 const ctas=page.locator('a[data-cta]');
 expect(await ctas.count()).toBeGreaterThan(5);
 for(const href of await ctas.evaluateAll(els=>els.map(e=>e.getAttribute('href')||'')))expect(href).toMatch(/^https:\/\/wa\.me\/62812114040\?text=/);
 await expect(page.locator('a[data-cta="lab"]').first()).toHaveAttribute('href',/Lab%20Mitra%20Sekolah/);
 expect((await context.cookies()).find(c=>c.name==='iot_region')?.value).toBe('id');
 for(const width of [1440,768,390]){
  await page.setViewportSize({width,height:900});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 }
 await expect(page.locator('.lid-sticky')).toBeVisible();
 await page.locator('.lid-faq summary').first().click();
 await expect(page.locator('.lid-faq details').first()).toHaveAttribute('open','');
 await page.locator('.lid-header').getByRole('link',{name:'Global site (EN)'}).click();
 await expect(page).toHaveURL(/\/$/);
 await expect(page.getByRole('heading',{level:1})).toContainText('gateway for AI robotics');
 expect((await context.cookies()).find(c=>c.name==='iot_region')?.value).toBe('global');
});
