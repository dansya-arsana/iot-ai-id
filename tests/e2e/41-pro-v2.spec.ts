import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';

/** /pro/dev v2: dock tabs (wiring, code, checklist, BOM, power, checks), isolate chip, Build Sheet route and PDF. Local host: no member grant needed. */
const BASE=process.env.PRO_BASE??'http://127.0.0.1:8891';
const OUT='test-results/pro-v2';
test.use({viewport:{width:1440,height:900}});
test.beforeAll(()=>mkdirSync(OUT,{recursive:true}));

test('dock tabs mount with counts and each panel renders; the workspace shots are saved',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${BASE}/pro/dev`);
 await expect(page.getByTestId('cad-viewport')).toBeVisible({timeout:30000});
 await page.waitForTimeout(1500);
 const tabs=['wiring','code','checklist','bom','power','checks'];
 for(const t of tabs)await expect(page.getByTestId('pro-dock-'+t)).toBeVisible();
 await expect(page.getByTestId('pro-dock-wiring')).toHaveAttribute('aria-selected','true');
 await expect(page.getByTestId('pro-dock-bom').locator('.pro-dock-count')).toHaveText(/\d+/);
 await page.screenshot({path:`${OUT}/01-workspace.png`});
 const shots:Record<string,string>={wiring:'02-wiring',code:'03-code',checklist:'04-checklist',bom:'05-bom',power:'06-power',checks:'06-checks'};
 for(const t of tabs){
  await page.getByTestId('pro-dock-'+t).click();
  await page.getByTestId('pro-dock-max').click();
  await page.waitForTimeout(500);
  await page.screenshot({path:`${OUT}/${shots[t]}.png`});
  await page.getByTestId('pro-dock-max').click();
 }
 expect(errors).toEqual([]);
});

test('isolating a part in 3D shows the chip and a second click clears it',async({page})=>{
 await page.goto(`${BASE}/pro/dev`);
 await expect(page.getByTestId('cad-viewport')).toBeVisible({timeout:30000});
 await page.locator('.pro-tree-row').filter({hasText:'LoRa'}).first().locator('.pro-tree-main').click();
 await page.getByTestId('cad-tool-isolate').click();
 await expect(page.getByTestId('cad-context')).toContainText('Isolated');
 await page.getByTestId('cad-tool-isolate').click();
 await expect(page.getByTestId('cad-context')).toHaveCount(0);
});

test('mobile checklist at 390',async({browser})=>{
 const ctx=await browser.newContext({viewport:{width:390,height:844}});const page=await ctx.newPage();
 await page.goto(`${BASE}/pro/dev`);
 await expect(page.getByTestId('pro-workspace')).toBeVisible();
 await page.getByTestId('pro-dock-checklist').click();
 await page.getByTestId('pro-dock-max').click();
 await page.waitForTimeout(600);
 await page.screenshot({path:`${OUT}/07-checklist-mobile-390.png`});
 await ctx.close();
});

test('Build Sheet opens from the top bar, is noindex, and prints to an A4 PDF',async({page,context})=>{
 await page.goto(`${BASE}/pro/dev`);
 await expect(page.getByTestId('pro-build-sheet')).toBeEnabled();
 const [sheet]=await Promise.all([context.waitForEvent('page'),page.getByTestId('pro-build-sheet').click()]);
 await sheet.waitForLoadState();
 await expect(sheet).toHaveURL(/\/pro\/print\/dev-farm\/1$/);
 await expect(sheet.getByTestId('bs-bar')).toBeVisible({timeout:30000});
 await expect(sheet.locator('meta[name=robots]')).toHaveAttribute('content',/noindex/);
 await expect(sheet.getByText('DESIGN · NOT BUILT').first()).toBeVisible();
 await sheet.waitForTimeout(3000);
 await sheet.emulateMedia({media:'print'});
 await sheet.pdf({path:`${OUT}/buildsheet.pdf`,format:'A4',printBackground:true,preferCSSPageSize:true});
});
