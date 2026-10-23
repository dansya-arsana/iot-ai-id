import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';

/** /pro/dev: the farm fixture in the workspace, 3D assembly, site plan and the chat stream. Local host: no member grant needed. */
const LOCAL='http://127.0.0.1:8891';
const OUT='test-results/pro-v1';
test.use({viewport:{width:1440,height:900}});
test.beforeAll(()=>mkdirSync(OUT,{recursive:true}));

test('workspace shows the farm tree, the 3D node and the site plan, and the chat streams the fixture turn',async({page})=>{
 await page.goto(`${LOCAL}/pro/dev`);
 await expect(page.getByTestId('pro-workspace')).toBeVisible();
 await expect(page.getByTestId('cad-viewport')).toBeVisible({timeout:30000});
 await page.waitForTimeout(1500);
 await page.screenshot({path:`${OUT}/01-workspace.png`});
 await page.getByTestId('pro-tab-site').click();
 await expect(page.locator('svg').first()).toBeVisible();
 await page.waitForTimeout(500);
 await page.screenshot({path:`${OUT}/02-site-plan.png`});
 await page.getByTestId('pro-tab-3d').click();
 await page.getByPlaceholder('Ask for a change…').fill("I'm building IoT for my farm. It has 4 fields: mango, melon, banana and chili.");
 await page.getByRole('button',{name:/Regenerate/}).first().click();
 await expect(page.getByTestId('pro-chat')).toBeVisible();
 await page.getByTestId('pro-chat').getByRole('button',{name:/send/i}).click();
 await expect(page.getByTestId('pchat-revision')).toBeVisible({timeout:30000});
 await page.screenshot({path:`${OUT}/03-chat.png`});
});
