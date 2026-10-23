import {test,expect,type Page} from '@playwright/test';
import {oledPosition,readOledLine} from '../../apps/web/src/lab/lessons/stepper';
import {SLOW_TEST_MS,goalDone,hookSnapshot,serialHas,untilSim} from './lab-sim';
import {grantLab} from './lab-access';

/**
 * Lesson 22 (Stepper control): the real compiled sketch runs in the browser. The joystick popover changes the ADC voltage on A0 and the SW level on D2;
 * the assertions read the REAL simulated outputs from the live snapshot: ULN2003 coil outputs, the stepper's own step count, and the OLED frame buffer.
 */
const PUBLIC=process.env.E2E_PUBLIC??'http://iot.admin.localhost:8891';
test.beforeEach(({page})=>grantLab(page,PUBLIC));
const SHOTS=process.env.E2E_SHOTS??'test-results/lab-lesson-stepper';

type V=Record<string,number|boolean|string|null>;
type Ext={kind:'ext';type:string;v:V};
type Snap={parts:Record<string,Ext|{kind:string}>;status:string;simTimeMs:number};
type LabHook={project(t:string):{x:number;y:number;visible:boolean}|null;update(s:Snap,dt:number):void};
declare global{interface Window{__labScene?:LabHook;__snap?:Snap}}

async function open(page:Page){
 await page.setViewportSize({width:1440,height:900});
 await page.goto(`${PUBLIC}/lab/stepper?e2e=1`);
 await expect(page.locator('.lab')).toHaveAttribute('data-scene','ready',{timeout:30000});
 await expect(page.getByText(/Stepper control/i).first()).toBeVisible();
 await hookSnapshot(page);
}
const stateOf=(page:Page,id:string):Promise<V|null>=>page.evaluate(i=>{const p=window.__snap?.parts[i];return p&&p.kind==='ext'?(p as Ext).v:null;},id);
/** Wait for a part state, measured in simulated ms (see lab-sim.ts), never in wall-clock seconds. */
async function until(page:Page,id:string,pred:(v:V)=>boolean,budgetSimMs=30000){
 await untilSim(page,`${id} state`,()=>stateOf(page,id),v=>!!v&&pred(v),budgetSimMs);
}
async function partAt(page:Page,id:string,dy=0){
 const p=await page.evaluate(t=>{
  const sc=window.__labScene;
  const r=document.querySelector('canvas.lab-canvas')!.getBoundingClientRect();
  const q=sc?.project(t);
  return q?{x:r.left+q.x,y:r.top+q.y}:null;
 },id);
 expect(p,`part ${id} projected`).not.toBeNull();
 return {x:p!.x,y:p!.y+dy};
}
async function openPopover(page:Page,id:string,offsets=[25,45,-2,10,70]){
 const pop=page.getByTestId(`lab-popover-${id}`);
 for(const dy of offsets){
  const at=await partAt(page,id,dy);
  await page.mouse.click(at.x,at.y);
  await page.waitForTimeout(600);
  if(await pop.isVisible())return pop;
  await page.keyboard.press('Escape');
  await page.evaluate(()=>(window.__labScene as unknown as {view(c:string):void}).view('reset'));
  await page.waitForTimeout(900);
 }
 await expect(pop).toBeVisible();
 return pop;
}
const setRange=(loc:ReturnType<Page['locator']>,v:number)=>loc.evaluate((el:HTMLInputElement,val)=>{
 Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(el,String(val));el.dispatchEvent(new Event('input',{bubbles:true}));
},v);
const pos=async(page:Page)=>oledPosition(String((await stateOf(page,'oled1'))?.fb??''));

test('lesson 22: the joystick turns the stepper through the ULN2003 and the OLED shows the position the motor is at',async({page})=>{
 test.setTimeout(SLOW_TEST_MS);   // wall time stretches on a slow machine; every wait below is a budget of SIMULATED ms
 await open(page);
 await page.getByTestId('lab-run').first().click();
 await serialHas(page,'ready');
 // at rest: shaft at 0, screen reads POS 0, goal not met
 await until(page,'oled1',v=>readOledLine(String(v.fb),1).trim()==='POS 0'&&readOledLine(String(v.fb),4).trim()==='DEG 0');
 expect((await stateOf(page,'stp1'))!.halfSteps).toBe(0);
 expect((await stateOf(page,'stp1'))!.powered).toBe(true);
 await goalDone(page,0,false);
 await page.screenshot({path:`${SHOTS}/stepper-rest.png`,animations:'disabled'});

 // push the stick fully right: coils chase, the shaft turns forward without losing a step
 const pop=await openPopover(page,'joy1');
 const sliders=pop.locator('input[type=range]');
 await expect(sliders).toHaveCount(2);
 await setRange(sliders.nth(0),1023);
 await until(page,'stp1',v=>Number(v.halfSteps)>300&&v.mode==='half');
 await until(page,'drv1',v=>Number(v.outMask)>0&&Number(v.edges)>100);
 expect((await stateOf(page,'stp1'))!.missed).toBe(0);
 await page.screenshot({path:`${SHOTS}/stepper-forward.png`,animations:'disabled'});

 // back to the centre: the shaft stops, the screen settles on the exact count, coils rest, the goal ticks
 await until(page,'stp1',v=>Number(v.halfSteps)>=1000);
 await setRange(sliders.nth(0),512);
 await untilSim(page,'screen shows the exact step count',async()=>({st:await stateOf(page,'stp1'),p:await pos(page)}),({st,p})=>!!st&&p!==null&&p===st.halfSteps&&Number(st.halfSteps)>=1000,20000);
 const stopped=(await stateOf(page,'stp1'))!.halfSteps as number;
 const deg=Math.trunc(stopped*360/4076);
 await until(page,'oled1',v=>readOledLine(String(v.fb),4).trim()===`DEG ${deg}`);
 await goalDone(page,15000);
 await serialHas(page,`DEG ${deg}`);
 await page.screenshot({path:`${SHOTS}/stepper-position.png`,animations:'disabled'});

 // push left: the count falls (reverse order of the coil patterns)
 await setRange(sliders.nth(0),0);
 await until(page,'stp1',v=>Number(v.halfSteps)<stopped-200);
 expect((await stateOf(page,'stp1'))!.missed).toBe(0);

 // press the stick (SW low): the sketch walks the shaft home and the screen reads zero
 await setRange(sliders.nth(0),512);
 await pop.getByTestId('lab-pop-pressed').check();
 await until(page,'stp1',v=>v.halfSteps===0,70000);
 await until(page,'oled1',v=>readOledLine(String(v.fb),1).trim()==='POS 0',40000);
 await page.screenshot({path:`${SHOTS}/stepper-home.png`,animations:'disabled'});
});
