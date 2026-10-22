import {test,expect,type Page} from '@playwright/test';
import {SLOW_TEST_MS,goalDone,hookSnapshot,serialHas,untilSim} from './lab-sim';

/**
 * Lesson "Rainbow pixels" (WS2812 ring + rotary encoder): the real sketch runs in the browser. Assertions read the REAL simulated
 * outputs from the live snapshot: the ring's 16 decoded pixel colours (800 kHz, zero timing errors), the encoder detent count and
 * the serial lines the sketch prints, plus the lesson goal flag.
 */
const PUBLIC=process.env.E2E_PUBLIC??'http://iot.admin.localhost:8891';
const SHOTS=process.env.E2E_SHOTS??'test-results/lab-lesson-neopixel';

type V=Record<string,number|boolean|string|null>;
type Ext={kind:'ext';type:string;v:V};
type Snap={parts:Record<string,Ext|{kind:string}>;status:string;simTimeMs:number};
type LabHook={project(t:string):{x:number;y:number;visible:boolean}|null;update(s:Snap,dt:number):void};
declare global{interface Window{__labScene?:LabHook;__snap?:Snap}}

const stateOf=(page:Page,id:string):Promise<V|null>=>page.evaluate(i=>{const p=window.__snap?.parts[i];return p&&p.kind==='ext'?(p as Ext).v:null;},id);
/** Wait for a part state, measured in simulated ms (see lab-sim.ts), never in wall-clock seconds. */
async function until(page:Page,id:string,pred:(v:V)=>boolean,budgetSimMs=30000){
 await untilSim(page,`${id} state`,()=>stateOf(page,id),v=>!!v&&pred(v),budgetSimMs);
}
const pixels=(v:V)=>(String(v.leds).match(/.{6}/g)??[]);
const peak=(v:V)=>Math.max(...pixels(v).flatMap(p=>[0,2,4].map(i=>parseInt(p.slice(i,i+2),16))));
async function partAt(page:Page,id:string,dy=0){
 const p=await page.evaluate(t=>{
  const r=document.querySelector('canvas.lab-canvas')!.getBoundingClientRect();
  const q=window.__labScene?.project(t);
  return q?{x:r.left+q.x,y:r.top+q.y}:null;
 },id);
 expect(p,`part ${id} projected`).not.toBeNull();
 return {x:p!.x,y:p!.y+dy};
}
async function openPopover(page:Page,id:string){
 const pop=page.getByTestId(`lab-popover-${id}`);
 for(const dy of [-2,15,30,-12,45]){
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

test('rainbow pixels: the ring shows a rainbow, the knob changes its brightness and the goal completes',async({page})=>{
 test.setTimeout(SLOW_TEST_MS);
 await page.setViewportSize({width:1440,height:900});
 await page.goto(`${PUBLIC}/lab/neopixel?e2e=1`);
 await expect(page.locator('.lab')).toHaveAttribute('data-scene','ready',{timeout:30000});
 await page.waitForTimeout(1200);
 await expect(page.getByText(/Rainbow pixels/i).first()).toBeVisible();
 await hookSnapshot(page);
 await expect(page.getByTestId('lab-goal')).toHaveAttribute('data-done','false');
 await page.getByTestId('lab-run').first().click();
 await serialHas(page,'ready');

 // the ring decodes 16 different colours from the 800 kHz stream, with no timing error
 await until(page,'ring1',v=>Number(v.frames)>5&&pixels(v).length===16);
 const ring=(await stateOf(page,'ring1'))!;
 expect(ring.timingErrors).toBe(0);
 expect(ring.shape).toBe('ring');
 expect(new Set(pixels(ring)).size).toBeGreaterThanOrEqual(14);
 const before=peak(ring);
 await page.screenshot({path:`${SHOTS}/rainbow.png`,animations:'disabled'});

 // turn the knob four detents clockwise from the popover: brightness goes 64 -> 128 and the sketch says so
 const pop=await openPopover(page,'enc1');
 await expect(pop.locator('h2')).toContainText(/Rotary/i);
 await page.screenshot({path:`${SHOTS}/rainbow-popover.png`,animations:'disabled'});
 await setRange(pop.locator('input[type=range]').first(),4);
 await until(page,'enc1',v=>Number(v.steps)===4);
 await serialHas(page,'level=128');
 await until(page,'ring1',v=>peak(v)>before+40);
 expect(await stateOf(page,'ring1')).toMatchObject({timingErrors:0});
 await goalDone(page);

 // back down two detents lowers it again
 await setRange(pop.locator('input[type=range]').first(),2);
 await serialHas(page,'level=96');
 await page.screenshot({path:`${SHOTS}/rainbow-dimmed.png`,animations:'disabled'});
});

test('rainbow pixels: pushing the knob switches the animation',async({page})=>{
 test.setTimeout(SLOW_TEST_MS);
 await page.setViewportSize({width:1440,height:900});
 await page.goto(`${PUBLIC}/lab/neopixel?e2e=1`);
 await expect(page.locator('.lab')).toHaveAttribute('data-scene','ready',{timeout:30000});
 await page.waitForTimeout(1200);
 await hookSnapshot(page);
 await page.getByTestId('lab-run').first().click();
 await until(page,'ring1',v=>Number(v.frames)>5);
 const pop=await openPopover(page,'enc1');
 await pop.locator('label.lab-pop-toggle').first().click();   // Knob pushed (SW low: one falling edge)
 await until(page,'enc1',v=>v.pressed===true);
 await serialHas(page,'mode=1');
 // the comet leaves dark pixels behind its head
 await until(page,'ring1',v=>pixels(v).some(p=>p==='000000'),15000);
 await page.screenshot({path:`${SHOTS}/comet.png`,animations:'disabled'});
});
