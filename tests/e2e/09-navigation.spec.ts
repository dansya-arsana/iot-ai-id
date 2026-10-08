import {test,expect} from '@playwright/test';

test('shared navigation groups routes and closes predictably',async({page})=>{
 await page.goto('/build');
 const resources=page.locator('.resources-nav');
 const summary=resources.locator('summary');
 await expect(page.getByRole('navigation',{name:'Main navigation'}).getByRole('link')).toHaveCount(3);
 await expect(page.locator('.header-cta')).toHaveCount(0);
 await summary.click();
 const menu=page.getByRole('navigation',{name:'Resources',exact:true});
 for(const label of ['Hardware','Docs','API','Research','PhysicalBench','Arena','Builders'])await expect(menu.getByRole('link',{name:label,exact:true})).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(resources).not.toHaveAttribute('open','');
 await expect(summary).toBeFocused();
 await summary.click();
 await page.getByRole('heading',{level:1}).click();
 await expect(resources).not.toHaveAttribute('open','');
 await summary.click();
 await menu.getByRole('link',{name:'Hardware',exact:true}).click();
 await expect(page).toHaveURL(/\/hardware$/);
 await expect(resources).not.toHaveAttribute('open','');
 await expect(summary).toHaveAttribute('aria-current','true');
 await expect(page.locator('.app-shell')).toBeVisible();
 await expect(page.locator('.site-footer').getByRole('link',{name:'Docs',exact:true})).toBeVisible();
 for(const route of ['/build','/hardware','/learn','/docs','/arena']){
  await page.goto(route);
  for(const width of [1280,768,390]){
   await page.setViewportSize({width,height:900});
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   expect(await page.getByRole('heading',{level:1}).evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeLessThanOrEqual(80);
  }
 }
 await page.locator('.mobile-nav summary').click();
 const mobile=page.getByRole('navigation',{name:'Mobile navigation'});
 await expect(mobile.getByRole('link',{name:'Builders',exact:true})).toBeVisible();
 await mobile.getByRole('link',{name:'Docs',exact:true}).click();
 await expect(page).toHaveURL(/\/docs$/);
 await expect(page.locator('.mobile-nav')).not.toHaveAttribute('open','');
 await expect(page.locator('.site-footer')).toBeVisible();
});
