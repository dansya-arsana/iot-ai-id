import {test,expect} from '@playwright/test';

test('shared navigation groups routes and closes predictably',async({page})=>{
 await page.goto('/build');
 const header=page.locator('.ds-header');
 const main=header.getByRole('navigation',{name:'Main',exact:true});
 await expect(main.getByRole('link')).toHaveCount(5);
 const resources=main.getByRole('button',{name:'Resources'});
 await resources.click();
 await expect(resources).toHaveAttribute('aria-expanded','true');
 const menu=page.locator('#ds-resources');
 for(const label of ['Build','Sites','API','Research','PhysicalBench','Arena','Builders'])await expect(menu.getByRole('link',{name:label,exact:true})).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(menu).toHaveCount(0);
 await resources.click();
 await page.mouse.click(20,700);
 await expect(menu).toHaveCount(0);
 await resources.click();
 await menu.getByRole('link',{name:'Research',exact:true}).click();
 await expect(page).toHaveURL(/\/research$/);
 await expect(menu).toHaveCount(0);
 await expect(resources).toHaveAttribute('aria-current','true');
 await main.getByRole('link',{name:'Hardware',exact:true}).click();
 await expect(page).toHaveURL(/\/hardware$/);
 await expect(page.locator('.ds-footer').getByRole('link',{name:'Docs',exact:true})).toBeVisible();
 await header.getByRole('button',{name:'ID',exact:true}).click();
 await expect(header.locator('.ds-nav').getByRole('link',{name:'Belajar',exact:true})).toBeVisible();
 await header.getByRole('button',{name:'EN',exact:true}).click();
 for(const route of ['/build','/hardware','/learn','/docs','/arena','/research']){
  await page.goto(route);
  for(const width of [1280,768,390]){
   await page.setViewportSize({width,height:900});
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   expect(await page.getByRole('heading',{level:1}).evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeLessThanOrEqual(86);
  }
 }
 const toggle=page.locator('.ds-menu-toggle');
 await toggle.click();
 const mobile=page.locator('#ds-mobile-menu');
 await expect(mobile.getByRole('link',{name:'Builders',exact:true})).toBeVisible();
 await mobile.getByRole('link',{name:'Docs',exact:true}).click();
 await expect(page).toHaveURL(/\/docs$/);
 await expect(mobile).toHaveCount(0);
 await expect(page.locator('.ds-footer')).toBeVisible();
});
