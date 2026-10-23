import {test,expect,type Page} from '@playwright/test';
import {SLOW_TEST_MS,hookSnapshot,serialHas,untilSim} from './lab-sim';
import {grantLab} from './lab-access';

/**
 * Lesson 25 (motor driver): the real sketch reads the knob, the L298N drives two motors from the 9 V battery through the power solver.
 * The assertions read the REAL simulated outputs from the live snapshot: motor rpm and direction, the bridge voltage, the battery supply.
 */
const PUBLIC=process.env.E2E_PUBLIC??'http://iot.admin.localhost:8891';
test.beforeEach(({page})=>grantLab(page,PUBLIC));
const SHOTS=process.env.E2E_SHOTS??'test-results/lab-lesson-motor-driver';

type V=Record<string,number|boolean|string|null>;
type Part={kind:string;rpm?:number;duty?:number;v?:V};
type Snap={parts:Record<string,Part>;status:string};
type LabHook={project(t:string):{x:number;y:number;visible:boolean}|null;update(s:Snap,dt:number):void};
type W={__labScene?:LabHook;__snap?:Snap};

async function open(page:Page){
 await page.setViewportSize({width:1440,height:900});
 await page.goto(`${PUBLIC}/lab/motor-driver?e2e=1`);
 await expect(page.locator('.lab')).toHaveAttribute('data-scene','ready',{timeout:30000});
 await hookSnapshot(page);
}
const part=(page:Page,id:string):Promise<Part|null>=>page.evaluate(i=>(window as unknown as W).__snap?.parts[i]??null,id);
/** Wait for a part state, measured in simulated ms (see lab-sim.ts), never in wall-clock seconds. */
async function until(page:Page,id:string,pred:(p:Part)=>boolean,budgetSimMs=30000){
 await untilSim(page,`${id} state`,()=>part(page,id),p=>!!p&&pred(p),budgetSimMs);
}
async function openPopover(page:Page,id:string){
 const pop=page.getByTestId(`lab-popover-${id}`);
 for(const dy of [25,45,-2,10,70]){
  const at=await page.evaluate(t=>{const r=document.querySelector('canvas.lab-canvas')!.getBoundingClientRect();const q=(window as unknown as W).__labScene?.project(t);return q?{x:r.left+q.x,y:r.top+q.y}:null;},id);
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

test('lesson 25: the knob sets both motor speeds through the L298N, opposite ways',async({page})=>{
 test.setTimeout(SLOW_TEST_MS);   // every wait below is a budget of SIMULATED ms
 await open(page);
 await page.getByTestId('lab-run').first().click();
 await serialHas(page,'ready');

 // default knob 600/1023: bridge on, motor A forward, motor B mirrored, the battery is the supply (9.6 V fresh)
 await until(page,'m1',p=>(p.rpm??0)>2000&&(p.rpm??0)<5800);
 await until(page,'m2',p=>(p.rpm??0)<-2000);
 const drv=((await part(page,'drv1')) as Part).v!;
 expect(drv.modeA).toBe('forward');expect(drv.modeB).toBe('reverse');
 expect(Number(drv.vs)).toBeGreaterThan(9);
 await serialHas(page,/pot 600 -> pwm 150/);
 await page.screenshot({path:`${SHOTS}/motor-driver-mid.png`,animations:'disabled'});

 // the popover input: full knob -> full speed
 const pop=await openPopover(page,'pot1');
 const slider=pop.locator('input[type=range]');
 await setRange(slider.first(),1023);
 await until(page,'m1',p=>(p.rpm??0)>5400);
 await until(page,'m2',p=>(p.rpm??0)<-5400);
 await serialHas(page,/pwm 255/);
 await page.screenshot({path:`${SHOTS}/motor-driver-full.png`,animations:'disabled'});

 // below the dead band both motors stop
 await setRange(slider.first(),10);
 await until(page,'m1',p=>Math.abs(p.rpm??9999)<200);
 await until(page,'m2',p=>Math.abs(p.rpm??9999)<200);
 await serialHas(page,/pwm 0/);
 await page.screenshot({path:`${SHOTS}/motor-driver-stopped.png`,animations:'disabled'});
});
