import {test,expect,type Page} from '@playwright/test';

/**
 * Lesson "Keypad lock": the real compiled sketch scans the 4x4 keypad, drives the TM1637 over its own two-wire bus and moves the
 * servo. Keys are pressed in the keypad popover; every assertion reads the REAL simulated outputs from the live snapshot.
 */
const PUBLIC=process.env.E2E_PUBLIC??'http://iot.admin.localhost:8891';
const SHOTS=process.env.E2E_SHOTS??'test-results/lab-lesson-keypad-lock';

type V=Record<string,number|boolean|string|null>;
type Ext={kind:'ext';type:string;v:V};
type Snap={parts:Record<string,Ext|{kind:string;angleDeg?:number}>;status:string;simTimeMs:number};
type LabHook={project(t:string):{x:number;y:number;visible:boolean}|null;update(s:Snap,dt:number):void;view(c:string):void};
type Win={__labScene?:LabHook;__snap?:Snap};

async function open(page:Page){
 await page.setViewportSize({width:1440,height:900});
 await page.goto(`${PUBLIC}/lab/keypad-lock?e2e=1`);
 await expect(page.locator('.lab')).toHaveAttribute('data-scene','ready',{timeout:30000});
 await page.waitForTimeout(1200);
 await expect(page.getByText(/Keypad lock/i).first()).toBeVisible();
 await page.evaluate(()=>{
  const sc=(window as unknown as Win).__labScene!;const orig=sc.update.bind(sc);
  sc.update=(s,d)=>{const w=window as unknown as Win&{__seen?:string[]};w.__snap=s;const t=(s.parts.tm1 as Ext|undefined)?.v?.text;if(typeof t==='string'){(w.__seen??=[]).push(t.trim());}orig(s,d);};
 });
}
const stateOf=(page:Page,id:string):Promise<V|null>=>page.evaluate(i=>{const p=(window as unknown as Win).__snap?.parts[i];return p&&p.kind==='ext'?(p as Ext).v:null;},id);
const angle=(page:Page):Promise<number>=>page.evaluate(()=>{const p=(window as unknown as Win).__snap?.parts.sv1;return p&&'angleDeg' in p&&typeof p.angleDeg==='number'?p.angleDeg:-1;});
async function until(page:Page,id:string,pred:(v:V)=>boolean,timeout=30000){
 await expect.poll(async()=>{const v=await stateOf(page,id);return !!v&&pred(v);},{timeout,intervals:[250]}).toBe(true);
}
async function partAt(page:Page,id:string,dy=0){
 const p=await page.evaluate(t=>{
  const sc=(window as unknown as Win).__labScene;
  const r=document.querySelector('canvas.lab-canvas')!.getBoundingClientRect();
  const q=sc?.project(t);
  return q?{x:r.left+q.x,y:r.top+q.y}:null;
 },id);
 expect(p,`part ${id} projected`).not.toBeNull();
 return {x:p!.x,y:p!.y+dy};
}
async function openPopover(page:Page,id:string,offsets=[0,12,-8,25,45,70]){
 const pop=page.getByTestId(`lab-popover-${id}`);
 for(const dy of offsets){
  const at=await partAt(page,id,dy);
  await page.mouse.click(at.x,at.y);
  await page.waitForTimeout(600);
  if(await pop.isVisible())return pop;
  await page.keyboard.press('Escape');
  await page.evaluate(()=>(window as unknown as Win).__labScene!.view('reset'));
  await page.waitForTimeout(900);
 }
 await expect(pop).toBeVisible();
 return pop;
}

test('keypad lock: a wrong PIN shows Err, the right PIN shows 0PEn and swings the servo open, then it locks again',async({page})=>{
 await open(page);
 await page.getByTestId('lab-run').first().click();
 await expect(page.getByTestId('lab-serial')).toContainText('ready',{timeout:15000});
 await until(page,'tm1',v=>v.text==='----'&&v.on===true);
 await expect.poll(()=>angle(page),{timeout:10000}).toBeLessThan(20);

 const pop=await openPopover(page,'pad1');
 // the main grid is a momentary press (about 150 ms down, then released), so wait for the sketch to see it and the key to come back up
 const tap=async(k:string)=>{
  await pop.getByTestId(`lab-pop-key-${k}`).click();
  await page.waitForTimeout(450);
  await until(page,'pad1',v=>v.pressed==='');
 };

 // a wrong PIN: the display shows Err and the latch stays shut
 for(const k of ['9','9','9','9'])await tap(k);
 await until(page,'tm1',v=>v.text==='9999');
 await tap('#');
 await expect.poll(()=>page.evaluate(()=>((window as unknown as {__seen?:string[]}).__seen??[]).includes('Err')),{timeout:30000}).toBe(true);
 await expect(page.getByTestId('lab-serial')).toContainText('denied 1');
 expect(await angle(page)).toBeLessThan(20);
 await page.screenshot({path:`${SHOTS}/err.png`,animations:'disabled'});
 await until(page,'tm1',v=>v.text==='----');

 // the right PIN: digits appear one by one, then OPEn and the servo turns to 90
 for(const k of ['1','2'])await tap(k);
 await until(page,'tm1',v=>v.text==='12--');
 for(const k of ['3','4'])await tap(k);
 await until(page,'tm1',v=>v.text==='1234');
 await tap('#');
 await until(page,'tm1',v=>v.text==='0PEn');
 await expect.poll(()=>angle(page),{timeout:15000}).toBeGreaterThanOrEqual(80);
 await expect(page.getByTestId('lab-serial')).toContainText('unlocked');
 await page.screenshot({path:`${SHOTS}/open.png`,animations:'disabled'});

 // the goal is met from the sim data, and the latch closes again after the open time
 await expect(page.getByTestId('lab-goal')).toHaveAttribute('data-done','true',{timeout:15000});
 await expect.poll(()=>angle(page),{timeout:20000}).toBeLessThan(20);
 await expect(page.getByTestId('lab-serial')).toContainText('locked');
});
