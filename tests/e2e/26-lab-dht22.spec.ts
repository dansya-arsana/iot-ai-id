import {test,expect,type Page} from '@playwright/test';

/** Lesson 12 and the DHT22 plugin: real single-wire protocol, popover sliders, serial prints the slider values. */
const PUBLIC=process.env.E2E_PUBLIC??'http://iot.admin.localhost:8891';
const SHOTS=process.env.E2E_SHOTS??'test-results/lab-dht22';

type LabHook={project(t:string):{x:number;y:number;visible:boolean}|null};
async function partAt(page:Page,id:string,dy=0){
 const p=await page.evaluate(t=>{
  const sc=(window as unknown as {__labScene?:LabHook}).__labScene;
  const r=document.querySelector('canvas.lab-canvas')!.getBoundingClientRect();
  const q=sc?.project(t);
  return q?{x:r.left+q.x,y:r.top+q.y}:null;
 },id);
 expect(p,`part ${id} projected`).not.toBeNull();
 return {x:p!.x,y:p!.y+dy};
}
const setRange=(loc:ReturnType<Page['locator']>,v:number)=>loc.evaluate((el:HTMLInputElement,val)=>{
 Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(el,String(val));el.dispatchEvent(new Event('input',{bubbles:true}));
},v);

test('lesson 12: the sketch reads the DHT22 over one wire and prints the slider values',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await page.goto(`${PUBLIC}/lab/dht?e2e=1`);
 await expect(page.locator('.lab')).toHaveAttribute('data-scene','ready',{timeout:30000});
 await page.waitForTimeout(1200);
 await expect(page.getByText(/Read temperature & humidity/i).first()).toBeVisible();
 await page.getByTestId('lab-run').first().click();
 const serial=page.getByTestId('lab-serial');
 await expect(serial).toContainText(/T=24\.0 C\s+H=60\.0 %/,{timeout:15000});
 await page.screenshot({path:`${SHOTS}/dht22-lesson.png`,animations:'disabled'});

 // open the sensor popover and move both sliders: the next reading shows the new values
 const at=await partAt(page,'dht1',-2);
 await page.mouse.click(at.x,at.y);
 const pop=page.getByTestId('lab-popover-dht1');
 await expect(pop).toBeVisible();
 await expect(pop.locator('h2')).toHaveText(/DHT22/i);
 const sliders=pop.locator('input[type=range]');
 await expect(sliders).toHaveCount(2);
 await page.screenshot({path:`${SHOTS}/dht22-popover.png`,animations:'disabled'});
 await setRange(sliders.nth(0),31.5);
 await setRange(sliders.nth(1),42);
 await expect(serial).toContainText(/T=31\.5 C\s+H=42\.0 %/,{timeout:20000});
 await expect(serial).not.toContainText('read failed');
 await page.screenshot({path:`${SHOTS}/dht22-readings.png`,animations:'disabled'});
});

test('the DHT22 is listed with its own copy in the components panel',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await page.goto(`${PUBLIC}/lab/dht?e2e=1`);
 await expect(page.locator('.lab')).toHaveAttribute('data-scene','ready',{timeout:30000});
 await page.getByTestId('lab-rail-parts').click();
 await expect(page.getByTestId('lab-comp-dht1')).toContainText(/DHT22/);
 await expect(page.getByTestId('lab-comp-dht1')).toContainText(/40 bits|one wire/i);
});
