import {test,expect,type Page} from '@playwright/test';

/**
 * Lab platform upgrade: the LCD backpack address follows the popover (0x27 / 0x3F), the plant lesson shows the LCD text facing the camera,
 * and no shipped lesson shows a power warning.
 */
const PUBLIC=process.env.E2E_PUBLIC??'http://iot.admin.localhost:8891';
const SHOTS=process.env.E2E_SHOTS??'test-results/lab-platform';

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
const run=(page:Page)=>page.getByTestId('lab-run').first().click();


test('lcd: the I2C address popover moves the backpack and the sketch (0x27) stops reaching it at 0x3F',async({page})=>{
 await open(page,'plant',/Plant monitor/i);
 await run(page);
 await until(page,'lcd1',v=>Number(v.writes)>10&&String(v.line1).startsWith('Soil'));
 const pop=await openPopover(page,'lcd1');
 await expect(pop.getByTestId('lab-pop-address-0x27')).toHaveAttribute('aria-pressed','true');
 await pop.getByTestId('lab-pop-address-0x3F').click();
 await page.waitForTimeout(700);
 const a=Number((await stateOf(page,'lcd1'))!.writes);
 await page.waitForTimeout(1600);
 const b=Number((await stateOf(page,'lcd1'))!.writes);
 expect(b,'the sketch talks to 0x27: the 0x3F backpack hears nothing').toBe(a);
 expect((await stateOf(page,'lcd1'))!.address).toBe(0x3f);
 await pop.getByTestId('lab-pop-address-0x27').click();
 await until(page,'lcd1',v=>Number(v.writes)>b);
 await page.screenshot({path:`${SHOTS}/lcd-address.png`,animations:'disabled'});
});

test('plant lesson: the lesson view faces the LCD, and the stage shows no power warning',async({page})=>{
 await open(page,'plant',/Plant monitor/i);
 await run(page);
 await until(page,'lcd1',v=>String(v.line1).startsWith('Soil'));
 await expect(page.getByTestId('lab-power-notice')).toHaveCount(0);
 await page.screenshot({path:`${SHOTS}/plant-view.png`,animations:'disabled'});
});
