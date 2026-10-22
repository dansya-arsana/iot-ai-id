import {test,expect,type Page} from '@playwright/test';
import {SLOW_TEST_MS,goalDone,hookSnapshot,serialHas,untilSim} from './lab-sim';

/**
 * Lesson "Real-time clock": the real sketch reads a DS3231 over I2C, draws HH:MM:SS on four chained MAX7219 matrices over SPI, and
 * rings a buzzer when alarm 1 pulls INT low. Assertions read the REAL simulated outputs from the live snapshot (matrix frame, RTC
 * state, buzzer state) and the serial text, and a popover input (the chip temperature) changes what the sketch reads.
 */
const PUBLIC=process.env.E2E_PUBLIC??'http://iot.admin.localhost:8891';
const SHOTS=process.env.E2E_SHOTS??'test-results/lab-lesson-clock';

type V=Record<string,number|boolean|string|null>;
type Part={kind:string;on?:boolean;freqHz?:number;type?:string;v?:V};
type Snap={parts:Record<string,Part>;status:string;simTimeMs:number};
type LabHook={project(t:string):{x:number;y:number;visible:boolean}|null;update(s:Snap,dt:number):void};
type W=Window&{__labScene?:LabHook;__snap?:Snap};

/** Reference of the sketch's 3 x 5 digits (written out on purpose: a typo in the sketch fails the test). */
const DIGITS=[[7,5,5,5,7],[2,6,2,2,7],[7,1,7,4,7],[7,1,7,1,7],[5,5,7,1,1],[7,4,7,1,7],[7,4,7,5,7],[7,1,1,1,1],[7,5,7,5,7],[7,5,7,1,7]];
const faceOf=(fb:string):string|null=>{
 const dot=(r:number,c:number)=>(parseInt(fb.substr(((c>>3)*8+r)*2,2),16)>>(7-(c&7)))&1;
 let out='';
 for(const [i,col] of [2,6,12,16,22,26].entries()){
  const d=DIGITS.findIndex(g=>g.every((bits,r)=>[0,1,2].every(k=>dot(r+1,col+k)===((bits>>(2-k))&1))));
  if(d<0)return null;
  out+=d+(i===1||i===3?':':'');
 }
 return out;
};

async function open(page:Page){
 await page.setViewportSize({width:1440,height:900});
 await page.goto(`${PUBLIC}/lab/clock?e2e=1`);
 await expect(page.locator('.lab')).toHaveAttribute('data-scene','ready',{timeout:30000});
 await expect(page.getByText(/Real-time clock/i).first()).toBeVisible();
 await hookSnapshot(page);
}
const ext=(page:Page,id:string):Promise<V|null>=>page.evaluate(i=>{const p=(window as W).__snap?.parts[i];return p&&p.kind==='ext'?p.v!:null;},id);
const buzzer=(page:Page)=>page.evaluate(()=>{const p=(window as W).__snap?.parts.bz1;return p?{on:!!p.on,hz:p.freqHz??0}:null;});
/** Wait for a part state, measured in simulated ms (see lab-sim.ts), never in wall-clock seconds. */
async function until(page:Page,id:string,pred:(v:V)=>boolean,budgetSimMs=30000){
 await untilSim(page,`${id} state`,()=>ext(page,id),v=>!!v&&pred(v),budgetSimMs);
}
async function openPopover(page:Page,id:string,offsets=[25,45,-2,10,70]){
 const pop=page.getByTestId(`lab-popover-${id}`);
 for(const dy of offsets){
  const p=await page.evaluate(t=>{
   const r=document.querySelector('canvas.lab-canvas')!.getBoundingClientRect();
   const q=(window as W).__labScene?.project(t);
   return q?{x:r.left+q.x,y:r.top+q.y}:null;
  },id);
  expect(p,`part ${id} projected`).not.toBeNull();
  await page.mouse.click(p!.x,p!.y+dy);
  await page.waitForTimeout(600);
  if(await pop.isVisible())return pop;
  await page.keyboard.press('Escape');
  await page.evaluate(()=>((window as W).__labScene as unknown as {view(c:string):void}).view('reset'));
  await page.waitForTimeout(900);
 }
 await expect(pop).toBeVisible();
 return pop;
}
const setRange=(loc:ReturnType<Page['locator']>,v:number)=>loc.evaluate((el:HTMLInputElement,val)=>{
 Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(el,String(val));el.dispatchEvent(new Event('input',{bubbles:true}));
},v);

test('clock: the matrix shows the DS3231 time, then the alarm pulls INT low, the buzzer rings and the sketch clears it',async({page})=>{
 test.setTimeout(SLOW_TEST_MS);   // every wait below is a budget of SIMULATED ms, so a slow machine only stretches wall time
 await open(page);
 // a popover input changes what the sketch reads over I2C: the chip temperature, reported with the alarm
 const pop=await openPopover(page,'rtc1');
 const sliders=pop.locator('input[type=range]');
 await expect(sliders).toHaveCount(1);
 await setRange(sliders.first(),31.25);
 await page.keyboard.press('Escape');
 await page.getByTestId('lab-run').first().click();
 await serialHas(page,'clock ready');
 await serialHas(page,'clock was stopped: set 07:30:00');

 // the matrix frame decodes to the time the chip keeps (the chip may be one second ahead of the last redraw)
 await until(page,'mx1',v=>{
  const f=faceOf(String(v.fb));return !!f&&/^07:30:0\d$/.test(f);
 });
 const a=await ext(page,'mx1'),r=await ext(page,'rtc1');
 expect(String(a!.fb).length).toBe(64);
 expect(r!.alarm1).toBe(false);
 expect(await buzzer(page)).toMatchObject({on:false});
 await page.screenshot({path:`${SHOTS}/clock-time.png`,animations:'disabled'});
 // the face moves on with the chip
 const f0=faceOf(String(a!.fb));
 await until(page,'mx1',v=>{const f=faceOf(String(v.fb));return !!f&&f!==f0;},4000);

 // alarm 1 (6 simulated s after start; the budget is simulated time, so a slow machine does not matter): A1F set, INT low, buzzer at 2 kHz, display at full brightness
 await until(page,'rtc1',v=>v.intLow===true&&v.alarm1===true,30000);
 await untilSim(page,'buzzer rings',()=>buzzer(page),b=>b?.on===true,2000);
 expect((await buzzer(page))!.hz).toBeGreaterThan(1500);
 expect(String((await ext(page,'mx1'))!.lum).startsWith('f')).toBe(true);
 await serialHas(page,'ALARM 31.25 C');
 await page.screenshot({path:`${SHOTS}/clock-alarm.png`,animations:'disabled'});

 // after beepMs the sketch writes 0 to the status register: flag cleared, INT released, buzzer quiet, display dimmed again
 await until(page,'rtc1',v=>v.intLow===false&&v.alarm1===false,20000);
 await serialHas(page,'alarm cleared');
 await untilSim(page,'buzzer quiet',()=>buzzer(page),b=>b?.on===false,2000);
 expect(String((await ext(page,'mx1'))!.lum).startsWith('2')).toBe(true);
 // the lesson goal is checked from this same data
 await goalDone(page,10000);
});
