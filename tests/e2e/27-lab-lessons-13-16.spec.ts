import {test,expect,type Page} from '@playwright/test';
import {readLine,litPixels} from '../lab-oled-font';

/**
 * Lessons 13-16 (OLED dashboard, motion light, plant monitor, remote control): each runs the real compiled sketch in the browser,
 * a popover input changes the world, and the assertions read the REAL simulated outputs from the live snapshot (OLED frame buffer,
 * relay contact, LCD text, 7-segment glyph), not only the serial text.
 */
const PUBLIC=process.env.E2E_PUBLIC??'http://iot.admin.localhost:8891';
const SHOTS=process.env.E2E_SHOTS??'test-results/lab-lessons-13-16';

type V=Record<string,number|boolean|string|null>;
type Ext={kind:'ext';type:string;v:V};
type Snap={parts:Record<string,Ext|{kind:string}>;status:string;simTimeMs:number};
type LabHook={project(t:string):{x:number;y:number;visible:boolean}|null;update(s:Snap,dt:number):void};
declare global{interface Window{__labScene?:LabHook;__snap?:Snap}}

async function open(page:Page,lesson:string,title:RegExp){
 await page.setViewportSize({width:1440,height:900});
 await page.goto(`${PUBLIC}/lab/${lesson}?e2e=1`);
 await expect(page.locator('.lab')).toHaveAttribute('data-scene','ready',{timeout:30000});
 await page.waitForTimeout(1200);
 await expect(page.getByText(title).first()).toBeVisible();
 // keep the newest simulation snapshot so the test can read the part states the scene draws from
 await page.evaluate(()=>{
  const sc=window.__labScene!;const orig=sc.update.bind(sc);
  sc.update=(s,d)=>{window.__snap=s;orig(s,d);};
 });
}
/** The typed state of part `id` in the latest snapshot. */
const stateOf=(page:Page,id:string):Promise<V|null>=>page.evaluate(i=>{const p=window.__snap?.parts[i];return p&&p.kind==='ext'?(p as Ext).v:null;},id);
/** Poll a part state until a predicate over it holds. */
async function until(page:Page,id:string,pred:(v:V)=>boolean,timeout=30000){
 await expect.poll(async()=>{const v=await stateOf(page,id);return !!v&&pred(v);},{timeout,intervals:[250]}).toBe(true);
}
const ledOn=(page:Page,id:string)=>page.evaluate(i=>{const p=window.__snap?.parts[i] as {on?:boolean}|undefined;return p?.on;},id);
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
/**
 * Click the part until ITS popover opens. The projected anchor of a tall or crowded part can sit on a neighbour (opening that one's
 * popover and zooming the camera), so every miss closes the popover and resets the view before the next offset.
 */
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
const run=(page:Page)=>page.getByTestId('lab-run').first().click();

test('lesson 13: the OLED frame buffer holds the DHT22 digits and redraws when the sensor changes',async({page})=>{
 await open(page,'oled',/OLED dashboard/i);
 await run(page);
 await until(page,'oled1',v=>readLine(String(v.fb),1)==='T 24.0 C'&&readLine(String(v.fb),4)==='H 60.0 %');
 const first=await stateOf(page,'oled1');
 expect(litPixels(String(first!.fb))).toBeGreaterThan(200);
 expect(first!.on).toBe(true);
 await page.screenshot({path:`${SHOTS}/oled-lesson.png`,animations:'disabled'});

 const pop=await openPopover(page,'dht1');
 const sliders=pop.locator('input[type=range]');
 await expect(sliders).toHaveCount(2);
 await setRange(sliders.nth(0),31.5);
 await setRange(sliders.nth(1),42);
 await until(page,'oled1',v=>readLine(String(v.fb),1)==='T 31.5 C'&&readLine(String(v.fb),4)==='H 42.0 %');
 await expect(page.getByTestId('lab-serial')).toContainText(/T 31\.5 C/);
 await page.screenshot({path:`${SHOTS}/oled-readings.png`,animations:'disabled'});
});

test('lesson 14: the PIR popover closes the relay, the lamp lights, and the hold time opens it again',async({page})=>{
 await open(page,'motion',/Motion light/i);
 await run(page);
 await expect(page.getByTestId('lab-serial')).toContainText('ready',{timeout:15000});
 await until(page,'rel1',v=>v.energized===false&&v.comTo==='NC');
 await until(page,'bulb1',v=>v.on===false);

 const pop=await openPopover(page,'pir1');
 await pop.getByTestId('lab-pop-motion').check();
 await until(page,'rel1',v=>v.energized===true&&v.comTo==='NO'&&v.ledOn===true);
 await until(page,'bulb1',v=>v.on===true);
 await expect(page.getByTestId('lab-serial')).toContainText('motion: lamp ON');
 await page.screenshot({path:`${SHOTS}/motion-on.png`,animations:'disabled'});

 await pop.getByTestId('lab-pop-motion').uncheck();
 // the PIR keeps OUT high for its own hold time and the sketch then holds the relay for holdMs: it is still closed right after
 expect((await stateOf(page,'rel1'))!.energized).toBe(true);
 await until(page,'rel1',v=>v.energized===false&&v.comTo==='NC',30000);
 await until(page,'bulb1',v=>v.on===false);
 await expect(page.getByTestId('lab-serial')).toContainText('quiet: lamp OFF');
 await page.screenshot({path:`${SHOTS}/motion-off.png`,animations:'disabled'});
});

test('lesson 15: the soil slider changes the LCD text and the alert LED',async({page})=>{
 await open(page,'plant',/Plant monitor/i);
 await run(page);
 await until(page,'lcd1',v=>v.display===true&&/^Soil 5\d%/.test(String(v.line1))&&String(v.line2).trim()==='Soil is fine');
 await page.screenshot({path:`${SHOTS}/plant-fine.png`,animations:'disabled'});

 const pop=await openPopover(page,'soil1');
 const wet=pop.locator('input[type=range]');
 await expect(wet).toHaveCount(1);
 await setRange(wet,8);
 await until(page,'lcd1',v=>/^Soil [78]%/.test(String(v.line1))&&String(v.line2).trim()==='Needs water!');
 await expect.poll(()=>ledOn(page,'led1')).toBe(true);
 await page.screenshot({path:`${SHOTS}/plant-dry.png`,animations:'disabled'});

 await setRange(wet,85);
 await until(page,'lcd1',v=>/^Soil [89]\d%/.test(String(v.line1))&&String(v.line2).trim()==='Soil is fine');
 await expect.poll(()=>ledOn(page,'led1')).toBe(false);
});

test('lesson 16: pressing remote keys in the popover shows the digit on the 7-segment display',async({page})=>{
 await open(page,'remote',/Remote control/i);
 await run(page);
 await expect(page.getByTestId('lab-serial')).toContainText('ready',{timeout:15000});
 const pop=await openPopover(page,'ir1');
 await pop.getByTestId('lab-pop-button-3').click();
 await until(page,'seg1',v=>v.glyph==='3');
 await expect(page.getByTestId('lab-serial')).toContainText(/k[\s\S]*?ey 3/,{timeout:15000});
 expect((await stateOf(page,'ir1'))!.command).toBe(0x5e);
 await page.screenshot({path:`${SHOTS}/remote-3.png`,animations:'disabled'});
 await pop.getByTestId('lab-pop-button-7').click();
 await until(page,'seg1',v=>v.glyph==='7'&&Number(v.a)>0&&Number(v.d)===0);
 expect((await stateOf(page,'ir1'))!.command).toBe(0x42);
 await expect(page.getByTestId('lab-serial')).toContainText(/k[\s\S]*?ey 7/,{timeout:15000});
 await page.screenshot({path:`${SHOTS}/remote-7.png`,animations:'disabled'});
});

test('lessons 13-16 are listed in the lesson strip and the new parts in the components panel',async({page})=>{
 await open(page,'plant',/Plant monitor/i);
 for(const id of ['oled','motion','plant','remote'])await expect(page.getByTestId(`lab-lesson-${id}`)).toBeAttached();
 await page.getByTestId('lab-rail-parts').click();
 await expect(page.getByTestId('lab-comp-soil1')).toBeVisible();
 await expect(page.getByTestId('lab-comp-lcd1')).toBeVisible();
});
