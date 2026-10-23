import {test,expect,type Page} from '@playwright/test';
import {SLOW_TEST_MS,goalDone,hookSnapshot,serialHas,untilSim,waitSim} from './lab-sim';
import {grantLab} from './lab-access';

/**
 * Lesson 23, kitchen scale: the real compiled sketch reads the HX711 model over its two-wire protocol and drives the TM1637 model.
 * The popover slides the weight, the tare button is clicked in 3D, and the assertions read the REAL simulated outputs from the live snapshot.
 */
const PUBLIC=process.env.E2E_PUBLIC??'http://iot.admin.localhost:8891';
test.beforeEach(({page})=>grantLab(page,PUBLIC));
const SHOTS=process.env.E2E_SHOTS??'test-results/lab-lesson-scale';

type V=Record<string,number|boolean|string|null>;
type Ext={kind:'ext';type:string;v:V};
// Window.__labScene and Window.__snap are declared globally by the other lab specs (same shapes).

async function open(page:Page){
 await page.setViewportSize({width:1440,height:900});
 await page.goto(`${PUBLIC}/lab/scale?e2e=1`);
 await expect(page.locator('.lab')).toHaveAttribute('data-scene','ready',{timeout:30000});
 await expect(page.getByText(/Kitchen scale/i).first()).toBeVisible();
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
/** Click the part until ITS popover opens; every miss closes the popover and resets the view before the next offset. */
async function openPopover(page:Page,id:string,offsets=[0,12,-8,25,45,-2,70]){
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
const pressed=(page:Page)=>page.evaluate(()=>!!(window.__snap?.parts.btn1 as unknown as {pressed?:boolean}|undefined)?.pressed);
/** Hold the tare button with the mouse for a moment. */
async function tare(page:Page){
 for(const dy of [0,10,-8,20]){
  const at=await partAt(page,'btn1',dy);
  await page.mouse.move(at.x,at.y);
  await page.mouse.down();
  await waitSim(page,250);
  const hit=await pressed(page);
  await page.mouse.up();
  if(hit)return;
  await page.waitForTimeout(300);
 }
 expect(false,'the tare button was pressed').toBe(true);
}

test('lesson 23: the display shows the grams on the bar, tare zeroes it, and the goal is reached',async({page})=>{
 test.setTimeout(SLOW_TEST_MS);   // every wait below is a budget of SIMULATED ms
 await open(page);
 await page.getByTestId('lab-run').first().click();
 await serialHas(page,'ready');
 // power-up tare: an empty bar reads zero, and the sketch really clocked the TM1637 (ACK on every byte)
 await serialHas(page,'tare');
 await until(page,'disp1',v=>v.on===true&&v.text==='   0'&&Number(v.acks)>=7);
 await until(page,'hx1',v=>v.powered===true&&Number(v.reads)>=2&&v.channel==='A'&&v.gain===128);
 await page.screenshot({path:`${SHOTS}/scale-empty.png`,animations:'disabled'});

 // slide the weight in the load cell popover: 750 g -> the HX711 code and the display follow
 const pop=await openPopover(page,'hx1');
 const sliders=pop.locator('input[type=range]');
 await expect(sliders).toHaveCount(1);
 await setRange(sliders.first(),750);
 await until(page,'hx1',v=>v.weight===750&&Number(v.raw)>=322000&&Number(v.raw)<=322300);   // 750 g x 429.5 counts per gram
 await until(page,'disp1',v=>v.text===' 750');
 await serialHas(page,'g=750');
 await page.screenshot({path:`${SHOTS}/scale-750g.png`,animations:'disabled'});
 await goalDone(page,0,false);

 // tare with the weight still on: the display reads zero and the lesson goal is met
 await page.keyboard.press('Escape');
 await tare(page);
 await until(page,'disp1',v=>v.text==='   0');
 await serialHas(page,'g=0');
 await goalDone(page,10000);
 await page.screenshot({path:`${SHOTS}/scale-tared.png`,animations:'disabled'});

 // more weight on top of the bowl, then take it all off: the display shows a negative number with the minus sign
 const pop2=await openPopover(page,'hx1');
 await setRange(pop2.locator('input[type=range]').first(),1250);
 await until(page,'disp1',v=>v.text===' 500');
 await setRange(pop2.locator('input[type=range]').first(),0);
 await until(page,'disp1',v=>v.text==='-750');
});
