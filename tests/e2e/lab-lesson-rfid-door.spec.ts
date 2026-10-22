import {test,expect,type Page} from '@playwright/test';

/**
 * Lesson 19, RFID door: the RC522 popover holds a card over the antenna, the real sketch reads its UID over SPI, and the assertions read the
 * REAL simulated outputs from the live snapshot (servo angle, relay contact, lamp, reader state), not only the serial text.
 */
const PUBLIC=process.env.E2E_PUBLIC??'http://iot.admin.localhost:8891';
const SHOTS=process.env.E2E_SHOTS??'test-results/lab-rfid-door';

type V=Record<string,number|boolean|string|null>;
type Part={kind:string;angleDeg?:number;v?:V};
type Snap={parts:Record<string,Part>;status:string;simTimeMs:number};
type LabHook={project(t:string):{x:number;y:number;visible:boolean}|null;update(s:Snap,dt:number):void};
type W={__labScene?:LabHook;__snap?:Snap};   // read through a cast: the other lab specs declare the same globals with their own types

async function open(page:Page){
 await page.setViewportSize({width:1440,height:900});
 await page.goto(`${PUBLIC}/lab/rfid-door?e2e=1`);
 await expect(page.locator('.lab')).toHaveAttribute('data-scene','ready',{timeout:30000});
 await page.waitForTimeout(1200);
 await expect(page.getByText(/RFID door/i).first()).toBeVisible();
 await page.evaluate(()=>{
  const sc=(window as unknown as W).__labScene!;const orig=sc.update.bind(sc);
  sc.update=(s,d)=>{(window as unknown as W).__snap=s;orig(s,d);};
 });
}
const stateOf=(page:Page,id:string):Promise<V|null>=>page.evaluate(i=>{const p=(window as unknown as W).__snap?.parts[i];return p&&p.kind==='ext'?p.v??null:null;},id);
const servoAngle=(page:Page):Promise<number|null>=>page.evaluate(()=>{const p=(window as unknown as W).__snap?.parts.sv1;return p&&p.kind==='servo'?p.angleDeg??null:null;});
async function until(page:Page,fn:()=>Promise<boolean>,timeout=30000){await expect.poll(fn,{timeout,intervals:[250]}).toBe(true);}
async function partAt(page:Page,id:string,dy=0){
 const p=await page.evaluate(t=>{
  const r=document.querySelector('canvas.lab-canvas')!.getBoundingClientRect();
  const q=(window as unknown as W).__labScene?.project(t);
  return q?{x:r.left+q.x,y:r.top+q.y}:null;
 },id);
 expect(p,`part ${id} projected`).not.toBeNull();
 return {x:p!.x,y:p!.y+dy};
}
/** Click the part until its popover opens; a miss closes any popover and resets the camera before the next offset. */
async function openPopover(page:Page,id:string,offsets=[0,12,-6,25,45,70]){
 const pop=page.getByTestId(`lab-popover-${id}`);
 for(const dy of offsets){
  const at=await partAt(page,id,dy);
  await page.mouse.click(at.x,at.y);
  await page.waitForTimeout(600);
  if(await pop.isVisible())return pop;
  await page.keyboard.press('Escape');
  await page.evaluate(()=>((window as unknown as W).__labScene as unknown as {view(c:string):void}).view('reset'));
  await page.waitForTimeout(900);
 }
 await expect(pop).toBeVisible();
 return pop;
}

test('lesson 19: an allowed card opens the servo and relay, locks again, and a refused fob changes nothing',async({page})=>{
 await open(page);
 await page.getByTestId('lab-run').first().click();
 await expect(page.getByTestId('lab-serial')).toContainText('ready: door locked',{timeout:20000});
 await until(page,async()=>(await servoAngle(page))!<10);
 expect((await stateOf(page,'rel1'))!.energized).toBe(false);
 expect((await stateOf(page,'rc1'))!.version).toBe(0x92);
 await page.screenshot({path:`${SHOTS}/locked.png`,animations:'disabled'});

 // the blue fob is not on the list: it is read to the end and refused, the door never moves
 const pop=await openPopover(page,'rc1');
 await pop.getByTestId('lab-pop-card-card2').click();
 await expect(page.getByTestId('lab-serial')).toContainText('uid=07C56E2D DENIED',{timeout:20000});
 expect((await stateOf(page,'rc1'))!.uid).toBe('07c56e2d');
 expect(await servoAngle(page)).toBeLessThan(10);
 expect((await stateOf(page,'rel1'))!.energized).toBe(false);
 await page.screenshot({path:`${SHOTS}/denied.png`,animations:'disabled'});

 // the white card is on the list: servo to 90, relay closed, lamp on; after the unlock time it locks again
 await pop.getByTestId('lab-pop-card-none').click();
 await page.waitForTimeout(400);
 await pop.getByTestId('lab-pop-card-card1').click();
 await expect(page.getByTestId('lab-serial')).toContainText('uid=4BA21F93 GRANTED',{timeout:20000});
 await until(page,async()=>(await servoAngle(page))!>=80);
 await until(page,async()=>{const r=await stateOf(page,'rel1');return !!r&&r.energized===true&&r.comTo==='NO';});
 await until(page,async()=>(await stateOf(page,'bulb1'))?.on===true);
 await page.screenshot({path:`${SHOTS}/open.png`,animations:'disabled'});
 await until(page,async()=>(await servoAngle(page))!<10,30000);
 await until(page,async()=>(await stateOf(page,'rel1'))?.energized===false);
 await expect(page.getByTestId('lab-serial')).toContainText('door locked');

 // the 7-byte sticker tag needs two cascade levels and is on the list too
 await pop.getByTestId('lab-pop-card-none').click();
 await page.waitForTimeout(400);
 await pop.getByTestId('lab-pop-card-card3').click();
 await expect(page.getByTestId('lab-serial')).toContainText('uid=046AB12C5F7180 GRANTED',{timeout:20000});
 await until(page,async()=>(await servoAngle(page))!>=80);
});
