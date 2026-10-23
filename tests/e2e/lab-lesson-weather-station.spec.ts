import {test,expect,type Page} from '@playwright/test';
import {grantLab} from './lab-access';

/**
 * Lesson 17 (weather station): runs the real compiled sketch in the browser, the BMP280 and DHT22 popovers change the world, and
 * the assertions read the REAL simulated LCD rows from the live snapshot, not only the serial text.
 */
const PUBLIC=process.env.E2E_PUBLIC??'http://iot.admin.localhost:8891';
test.beforeEach(({page})=>grantLab(page,PUBLIC));
const SHOTS=process.env.E2E_SHOTS??'test-results/lab-lesson-weather-station';

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
const setRange=(loc:ReturnType<Page['locator']>,v:number)=>loc.evaluate((el:HTMLInputElement,val)=>{
 Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(el,String(val));el.dispatchEvent(new Event('input',{bubbles:true}));
},v);
const run=(page:Page)=>page.getByTestId('lab-run').first().click();


const rowsOf=(v:V)=>[v.line1,v.line2,v.line3,v.line4].map(x=>String(x).trimEnd());

test('lesson 17: the LCD shows both sensors, and the BMP280 and DHT22 popovers move the rows and the min and max',async({page})=>{
 await open(page,'weather-station',/Weather station/i);
 await run(page);
 await expect(page.getByTestId('lab-serial')).toContainText('ready',{timeout:15000});
 await until(page,'lcd1',v=>v.display===true&&rowsOf(v)[0]==='DHT 24.0C  60.0%'&&rowsOf(v)[2]==='Tmin 24.0 max 24.0'&&rowsOf(v)[3]==='Pmin 1013 max 1013',45000);
 expect(rowsOf((await stateOf(page,'lcd1'))!)[1]).toBe('BMP 24.0C 1013 hPa');
 expect(await stateOf(page,'bmp1')).toMatchObject({address:0x76});
 await page.screenshot({path:`${SHOTS}/weather-initial.png`,animations:'disabled'});

 const bmp=await openPopover(page,'bmp1');
 const bs=bmp.locator('input[type=range]');
 await expect(bs).toHaveCount(2);
 await setRange(bs.nth(0),31);
 await setRange(bs.nth(1),1021);
 await until(page,'lcd1',v=>rowsOf(v)[1]==='BMP 31.0C 1021 hPa'&&rowsOf(v)[2]==='Tmin 24.0 max 31.0'&&rowsOf(v)[3]==='Pmin 1013 max 1021',45000);
 await setRange(bs.nth(0),18);
 await setRange(bs.nth(1),1004);
 await until(page,'lcd1',v=>rowsOf(v)[1]==='BMP 18.0C 1004 hPa'&&rowsOf(v)[2]==='Tmin 18.0 max 31.0'&&rowsOf(v)[3]==='Pmin 1004 max 1021',45000);
 await page.keyboard.press('Escape');

 const dht=await openPopover(page,'dht1');
 const ds=dht.locator('input[type=range]');
 await expect(ds).toHaveCount(2);
 await setRange(ds.nth(0),12.5);
 await setRange(ds.nth(1),33);
 await until(page,'lcd1',v=>rowsOf(v)[0]==='DHT 12.5C  33.0%',45000);
 await expect(page.getByTestId('lab-serial')).toContainText(/Tmin=18\.0 Tmax=31\.0/);
 await page.screenshot({path:`${SHOTS}/weather-minmax.png`,animations:'disabled'});
});
