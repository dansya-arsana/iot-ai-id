import {test,expect,type Page} from '@playwright/test';
import {grantLab} from './lab-access';

/**
 * Lesson 18, Tilt alarm: the real compiled sketch reads the MPU6050 over I2C. Tilting the sensor in its popover fills the LED bar
 * and sounds the buzzer; the assertions read the simulated part states, not only the serial text.
 */
const PUBLIC=process.env.E2E_PUBLIC??'http://iot.admin.localhost:8891';
test.beforeEach(({page})=>grantLab(page,PUBLIC));
const SHOTS=process.env.E2E_SHOTS??'test-results/lab-lesson-tilt-alarm';

type V=Record<string,number|boolean|string|null>;
type Part={kind:string;type?:string;v?:V;on?:boolean;freqHz?:number};
type Snap={parts:Record<string,Part>;status:string};
type LabHook={project(t:string):{x:number;y:number;visible:boolean}|null;update(s:Snap,dt:number):void};
type W={__labScene?:LabHook;__snap?:Snap};

const part=(page:Page,id:string):Promise<Part|null>=>page.evaluate(i=>(window as unknown as W).__snap?.parts[i]??null,id);
async function until(page:Page,id:string,pred:(p:Part)=>boolean,timeout=30000){
 await expect.poll(async()=>{const p=await part(page,id);return !!p&&pred(p);},{timeout,intervals:[250]}).toBe(true);
}
async function openPopover(page:Page,id:string){
 const pop=page.getByTestId(`lab-popover-${id}`);
 for(const dy of [25,45,-2,10,70]){
  const at=await page.evaluate(t=>{
   const r=document.querySelector('canvas.lab-canvas')!.getBoundingClientRect();
   const q=(window as unknown as W).__labScene?.project(t);
   return q?{x:r.left+q.x,y:r.top+q.y}:null;
  },id);
  expect(at,`part ${id} projected`).not.toBeNull();
  await page.mouse.click(at!.x,at!.y+dy);
  await page.waitForTimeout(600);
  if(await pop.isVisible())return pop;
  await page.keyboard.press('Escape');
  await page.evaluate(()=>((window as unknown as W).__labScene as unknown as {view(c:string):void}).view('reset'));
  await page.waitForTimeout(900);
 }
 await expect(pop).toBeVisible();
 return pop;
}
const setRange=(loc:ReturnType<Page['locator']>,v:number)=>loc.evaluate((el:HTMLInputElement,val)=>{
 Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(el,String(val));el.dispatchEvent(new Event('input',{bubbles:true}));
},v);

test('lesson 18: tilting the MPU6050 fills the LED bar and sounds the buzzer',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await page.goto(`${PUBLIC}/lab/tilt-alarm?e2e=1`);
 await expect(page.locator('.lab')).toHaveAttribute('data-scene','ready',{timeout:30000});
 await page.waitForTimeout(1200);
 await expect(page.getByText(/Tilt alarm/i).first()).toBeVisible();
 await page.evaluate(()=>{
  const sc=(window as unknown as W).__labScene!;const orig=sc.update.bind(sc);
  sc.update=(s,d)=>{(window as unknown as W).__snap=s;orig(s,d);};
 });
 await page.getByTestId('lab-run').first().click();
 await expect(page.getByTestId('lab-serial')).toContainText('ready',{timeout:15000});

 // flat: the sketch woke the chip, the bar is dark and the buzzer silent
 await until(page,'mpu1',p=>p.v?.asleep===false&&Number(p.v?.reads)>0);
 await until(page,'bar1',p=>p.v?.lit===0);
 await until(page,'bz1',p=>p.on===false);
 await expect(page.getByTestId('lab-serial')).toContainText(/tilt 0 ok/,{timeout:15000});
 await page.screenshot({path:`${SHOTS}/flat.png`,animations:'disabled'});

 // tilt past the alarm angle (45 degrees by default)
 const pop=await openPopover(page,'mpu1');
 const sliders=pop.locator('input[type=range]');
 await setRange(sliders.nth(0),60);   // Roll
 await until(page,'bar1',p=>Number(p.v?.lit)>=6&&Number(p.v?.level)>=6);
 await until(page,'bz1',p=>p.on===true&&Math.abs(Number(p.freqHz)-1000)<20);
 await expect(page.getByTestId('lab-serial')).toContainText(/tilt 6\d ALARM/,{timeout:15000});
 await page.screenshot({path:`${SHOTS}/tilted.png`,animations:'disabled'});

 // back to a small angle: the buzzer stops, only a few segments stay lit, and the goal is reported
 await setRange(sliders.nth(0),10);
 await until(page,'bz1',p=>p.on===false);
 await until(page,'bar1',p=>Number(p.v?.lit)>=1&&Number(p.v?.lit)<=2);
 await expect(page.getByTestId('lab-serial')).toContainText(/tilt 1\d ok/,{timeout:15000});
});
