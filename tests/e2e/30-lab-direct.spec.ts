import {test,expect,type Page} from '@playwright/test';
import {SLOW_TEST_MS,goalDone,hookSnapshot,serialHas,untilSim,waitSim} from './lab-sim';
import {grantLab} from './lab-access';

/**
 * Direct manipulation in 3D and the part pages: keypad keys are tapped by clicking them, the joystick stick is dragged (and springs back),
 * the encoder knob is turned by dragging round it, the HC-05 popover is a text terminal, and a part's card in the gallery comes alive on hover.
 * Waits are budgets of SIMULATED time (lab-sim.ts), so a slow machine only stretches wall time.
 */
const PUBLIC=process.env.E2E_PUBLIC??'http://iot.admin.localhost:8891';
test.beforeEach(({page})=>grantLab(page,PUBLIC));
const SHOTS=process.env.E2E_SHOTS??'test-results/lab-direct';

type V=Record<string,number|boolean|string|null>;
type Snap={parts:Record<string,{kind:string;type?:string;v?:V;on?:boolean}>;simTimeMs:number;status:string};
type Hook={grabPoints(id:string):{grab:Record<string,unknown>;x:number;y:number}[]};
type W=Window&{__labScene?:Hook;__snap?:Snap};

async function open(page:Page,lesson:string){
 await page.setViewportSize({width:1440,height:900});
 await page.goto(`${PUBLIC}/lab/${lesson}?e2e=1`);
 await expect(page.locator('.lab')).toHaveAttribute('data-scene','ready',{timeout:30000});
 await hookSnapshot(page);
}
const state=(page:Page,id:string):Promise<V|null>=>page.evaluate(i=>{const p=(window as W).__snap?.parts[i];return p&&p.kind==='ext'?p.v??null:null;},id);
/** Screen point (page coordinates) of a grab piece of a part; `match` picks which one (a keypad key by its value). */
async function grabAt(page:Page,id:string,match:(g:Record<string,unknown>)=>boolean=()=>true){
 const all=await page.evaluate(i=>{
  const r=document.querySelector('canvas.lab-canvas')!.getBoundingClientRect();
  return (window as W).__labScene!.grabPoints(i).map(g=>({grab:g.grab,x:r.left+g.x,y:r.top+g.y}));
 },id);
 const g=all.find(x=>match(x.grab));
 expect(g,`a grab piece on ${id}`).toBeTruthy();
 return g!;
}

test('keypad: clicking keys in 3D taps them (momentary) and types the PIN that opens the lock',async({page})=>{
 test.setTimeout(SLOW_TEST_MS);
 await open(page,'keypad-lock');
 await page.getByTestId('lab-run').first().click();
 await serialHas(page,'ready');
 // a tap lasts a moment of wall time: record every frame's pressed key instead of polling for it
 await page.evaluate(()=>{
  const sc=(window as W).__labScene as unknown as {update(s:Snap,d:number):void};const o=sc.update.bind(sc);
  (window as unknown as {__seen:string[]}).__seen=[];
  sc.update=(s,d)=>{const p=s.parts.pad1?.v?.pressed;const seen=(window as unknown as {__seen:string[]}).__seen;if(typeof p==='string'&&seen[seen.length-1]!==p)seen.push(p);o(s,d);};
 });
 // one key: down while the tap lasts, released by itself afterwards, no popover needed
 const pts:Record<string,{x:number;y:number}>={};
 for(const key of ['1','2','3','4','#'])pts[key]=await grabAt(page,'pad1',g=>g.value===key);
 let k=pts['1']!;
 await page.mouse.click(k.x,k.y);
 await untilSim(page,'key 1 is released again',()=>page.evaluate(()=>(window as unknown as {__seen:string[]}).__seen),seen=>seen.includes('1')&&seen[seen.length-1]==='',3000);
 for(const key of ['2','3','4','#']){
  await waitSim(page,300);   // a tap no longer zooms the camera, so the original positions stay valid
  k=pts[key]!;
  await page.mouse.click(k.x,k.y);
  await serialHas(page,key==='#'?'unlocked':`digit ${key}`,6000);
 }
 await untilSim(page,'servo opened',()=>page.evaluate(()=>(window as W).__snap!.parts.sv1 as unknown as {angleDeg:number}),s=>s.angleDeg>60,8000);
 await goalDone(page,8000);
 await page.screenshot({path:`${SHOTS}/keypad-3d-unlocked.png`,animations:'disabled'});
});

test('joystick: dragging the stick tilts it, the stepper follows, and it springs back on release',async({page})=>{
 test.setTimeout(SLOW_TEST_MS);
 await open(page,'stepper');
 await page.getByTestId('lab-run').first().click();
 await serialHas(page,'ready');
 const s=await grabAt(page,'joy1',g=>g.type==='stick');
 await page.mouse.move(s.x,s.y);
 await page.mouse.down();
 await page.mouse.move(s.x+25,s.y,{steps:4});
 await page.mouse.move(s.x+70,s.y,{steps:6});
 await untilSim(page,'stick pushed right',()=>state(page,'joy1'),v=>Number(v?.x)>900,2000);
 expect((await state(page,'joy1'))!.pressed,'a drag is not a push').toBe(false);
 await untilSim(page,'the shaft turns',()=>state(page,'stp1'),v=>Number(v?.halfSteps)>200,20000);
 await page.screenshot({path:`${SHOTS}/joystick-drag.png`,animations:'disabled'});
 await page.mouse.up();
 await untilSim(page,'stick springs back to centre',()=>state(page,'joy1'),v=>v?.x===512&&v?.y===512,2000);
});

test('encoder: dragging round the knob turns it and a click pushes it',async({page})=>{
 test.setTimeout(SLOW_TEST_MS);
 await open(page,'neopixel');
 await page.getByTestId('lab-run').first().click();
 await serialHas(page,'ready');
 const kn=await grabAt(page,'enc1',g=>g.type==='knob');
 const R=14;
 await page.mouse.move(kn.x+R,kn.y);
 await page.mouse.down();
 for(let i=1;i<=14;i++){const a=i*0.22;await page.mouse.move(kn.x+R*Math.cos(a),kn.y+R*Math.sin(a));}
 await untilSim(page,'knob turned',()=>state(page,'enc1'),v=>Number(v?.position)>=3,6000);
 await page.mouse.up();
 const before=Number((await state(page,'enc1'))!.position);
 // a plain click pushes the shaft for a moment (SW), it does not turn it
 const again=await grabAt(page,'enc1',g=>g.type==='knob');
 await page.mouse.click(again.x,again.y);
 await untilSim(page,'knob pushed',()=>state(page,'enc1'),v=>v?.pressed===true,2000);
 await untilSim(page,'knob released',()=>state(page,'enc1'),v=>v?.pressed===false,2000);
 expect(Number((await state(page,'enc1'))!.position)).toBe(before);
});

test('HC-05 page: the popover is a text terminal, a typed line is sent and shown',async({page})=>{
 await page.setViewportSize({width:1200,height:900});
 await page.goto(`${PUBLIC}/lab/parts/hc05-bluetooth`);
 const box=page.getByTestId('parts-try');
 await expect(box).toBeVisible({timeout:60000});
 const term=box.getByTestId('lab-pop-terminal');
 await expect(term).toBeVisible();
 const input=term.getByTestId('lab-pop-terminal-input');
 await expect(term.getByTestId('lab-pop-terminal-send')).toBeDisabled();
 await input.fill('LED ON');
 await term.getByTestId('lab-pop-terminal-send').click();
 await expect(input).toHaveValue('');
 await expect(term.getByTestId('lab-pop-terminal-log')).toContainText('you LED ON',{timeout:15000});
 // Enter sends too, and the phone can be switched off: then nothing more is sent
 await input.fill('second');await input.press('Enter');
 await expect(term.getByTestId('lab-pop-terminal-log')).toContainText('second');
 await box.getByRole('switch').first().uncheck();
 await input.fill('lost');await input.press('Enter');
 await page.waitForTimeout(500);
 await expect(term.getByTestId('lab-pop-terminal-log')).not.toContainText('lost');
 await page.screenshot({path:`${SHOTS}/hc05-terminal.png`,animations:'disabled'});
});

test('gallery: hovering a card runs the part (servo sweeps, an LCD shows a pattern)',async({page})=>{
 await page.setViewportSize({width:1000,height:800});
 for(const kind of ['servo','lcd2004-i2c']){
  await page.goto(`${PUBLIC}/lab/parts/${kind}`);
  await page.waitForFunction(()=>document.body.dataset.partsReady,null,{timeout:60000});
  const card=page.locator('figure.parts-card').first();
  await expect(card).not.toHaveAttribute('data-live','1');
  await card.hover();
  await expect(card).toHaveAttribute('data-live','1');
  const live=card.getByTestId('parts-live');
  await expect(live).toBeVisible();
  const frame=():Promise<string>=>live.evaluate((c:HTMLCanvasElement)=>c.toDataURL());
  const a=await frame();
  await page.waitForTimeout(900);
  const b=await frame();
  expect(b,`${kind} changes over time`).not.toBe(a);
  await page.mouse.move(5,5);
  await expect(card).not.toHaveAttribute('data-live','1');
 }
});
