import {test,expect} from '@playwright/test';
import {readdirSync} from 'node:fs';
import {grantLab} from './lab-access';

/** Every callout on a goal part (anything that is not the Uno or a bare board pin) stays visible at 1440, in every lesson. */
const PUBLIC=process.env.E2E_PUBLIC??'http://iot.admin.localhost:8891';
test.beforeEach(({page})=>grantLab(page,PUBLIC));
const LESSONS=readdirSync(new URL('../../apps/web/src/lab/lessons/',import.meta.url)).filter(f=>f.endsWith('.ts')&&!['index.ts','kit.ts'].includes(f)).map(f=>f.replace(/\.ts$/,'')).sort();

test('lesson folder is not empty',()=>{expect(LESSONS.length).toBeGreaterThanOrEqual(26);});

test('every goal-part callout is visible at 1440 in all lessons',async({page})=>{
 test.setTimeout(300000);
 await page.setViewportSize({width:1440,height:900});
 const bad:string[]=[];
 for(const id of LESSONS){
  await page.goto(`${PUBLIC}/lab/${id}?e2e=1`);
  await expect(page.locator('.lab')).toHaveAttribute('data-scene','ready',{timeout:30000});
  await page.waitForTimeout(1500);
  const hidden=await page.evaluate(()=>[...document.querySelectorAll<HTMLElement>('.lab-callout')]
   .filter(c=>{const t=c.dataset.target!;return !t.startsWith('uno.')&&!/^(D\d+|A\d|GND|5V|3V3)$/.test(t)&&c.style.opacity==='0';}).map(c=>c.dataset.target));
  for(const t of hidden)bad.push(`${id}: ${t}`);
 }
 expect(bad).toEqual([]);
});
