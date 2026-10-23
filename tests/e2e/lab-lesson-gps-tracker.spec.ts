import {test,expect,type Page} from '@playwright/test';
import {grantLab} from './lab-access';

/**
 * Lesson 26, GPS logger: the real compiled sketch parses NMEA from the NEO-6M and draws the fix on the Nokia 5110.
 * A popover input moves the receiver; the assertions read the REAL frame buffer of the simulated screen, the serial text and the saved goal.
 */
const PUBLIC=process.env.E2E_PUBLIC??'http://iot.admin.localhost:8891';
test.beforeEach(({page})=>grantLab(page,PUBLIC));
const SHOTS=process.env.E2E_SHOTS??'test-results/lab-gps-tracker';

type V=Record<string,number|boolean|string|null>;
type Ext={kind:'ext';type:string;v:V};
type Snap={parts:Record<string,Ext|{kind:string}>;status:string;simTimeMs:number};
type LabHook={project(t:string):{x:number;y:number;visible:boolean}|null;update(s:Snap,dt:number):void};
declare global{interface Window{__labScene?:LabHook;__snap?:Snap}}

// 5x7 glyph columns (bit 0 on top), written out here so a typo in the sketch font fails the test
const REF:Record<string,number[]>={
 '0':[0x3E,0x51,0x49,0x45,0x3E],'1':[0x00,0x42,0x7F,0x40,0x00],'2':[0x42,0x61,0x51,0x49,0x46],'3':[0x21,0x41,0x45,0x4B,0x31],'4':[0x18,0x14,0x12,0x7F,0x10],
 '5':[0x27,0x45,0x45,0x45,0x39],'6':[0x3C,0x4A,0x49,0x49,0x30],'7':[0x01,0x71,0x09,0x05,0x03],'8':[0x36,0x49,0x49,0x49,0x36],'9':[0x06,0x49,0x49,0x29,0x1E],
 '.':[0x00,0x60,0x60,0x00,0x00],'-':[0x08,0x08,0x08,0x08,0x08],':':[0x00,0x36,0x36,0x00,0x00],' ':[0,0,0,0,0],
 N:[0x7F,0x04,0x08,0x10,0x7F],S:[0x46,0x49,0x49,0x49,0x31],E:[0x7F,0x49,0x49,0x49,0x41],W:[0x3F,0x40,0x38,0x40,0x3F],F:[0x7F,0x09,0x09,0x09,0x01],
 I:[0x00,0x41,0x7F,0x41,0x00],X:[0x63,0x14,0x08,0x14,0x63],O:[0x3E,0x41,0x41,0x41,0x3E],A:[0x7E,0x11,0x11,0x11,0x7E],T:[0x01,0x01,0x7F,0x01,0x01],
};
const row=(fb:string,bank:number):string=>{
 let out='';
 for(let k=0;k<14;k++){
  const cols=Array.from({length:5},(_,i)=>parseInt(fb.slice((bank*84+k*6+i)*2,(bank*84+k*6+i)*2+2),16));
  const hit=Object.entries(REF).find(([,g])=>g.every((v,i)=>v===cols[i]));
  out+=hit?hit[0]:'?';
 }
 return out.trimEnd();
};

const stateOf=(page:Page,id:string):Promise<V|null>=>page.evaluate(i=>{const p=window.__snap?.parts[i];return p&&p.kind==='ext'?(p as Ext).v:null;},id);
async function untilRows(page:Page,rows:Record<number,string|RegExp>,timeout=30000){
 await expect.poll(async()=>{
  const v=await stateOf(page,'lcd1');
  if(!v)return false;
  const fb=String(v.fb);
  return Object.entries(rows).every(([b,want])=>want instanceof RegExp?want.test(row(fb,Number(b))):row(fb,Number(b))===want);
 },{timeout,intervals:[250]}).toBe(true);
}
async function partAt(page:Page,id:string,dy=0){
 const p=await page.evaluate(t=>{
  const r=document.querySelector('canvas.lab-canvas')!.getBoundingClientRect();
  const q=window.__labScene?.project(t);
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
  await page.evaluate(()=>(window.__labScene as unknown as {view(c:string):void}).view('reset'));
  await page.waitForTimeout(900);
 }
 await expect(pop).toBeVisible();
 return pop;
}
const setRange=(loc:ReturnType<Page['locator']>,v:number)=>loc.evaluate((el:HTMLInputElement,val)=>{
 Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(el,String(val));el.dispatchEvent(new Event('input',{bubbles:true}));
},v);

test('lesson 26: the screen shows the parsed fix, follows a moved position, and says NO FIX without satellites',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await page.goto(`${PUBLIC}/lab/gps-tracker?e2e=1`);
 await expect(page.locator('.lab')).toHaveAttribute('data-scene','ready',{timeout:30000});
 await page.waitForTimeout(1200);
 await expect(page.getByText(/GPS logger/i).first()).toBeVisible();
 await page.evaluate(()=>{
  const sc=window.__labScene!;const orig=sc.update.bind(sc);
  sc.update=(s,d)=>{window.__snap=s;orig(s,d);};
 });
 await page.getByTestId('lab-run').first().click();

 // the first real NMEA fix: Jakarta, eight satellites
 await untilRows(page,{0:'FIX 08 SAT',1:'6.20880 S',2:'106.84560 E',4:/^03:00:\d\d$/});
 await expect(page.getByTestId('lab-serial')).toContainText(/FIX 08 SAT 6\.20880 S 106\.84560 E/);
 const gps=await stateOf(page,'gps1');
 expect(gps!.fix).toBe(true);
 expect(Number(gps!.sentences)).toBeGreaterThanOrEqual(4);
 await page.screenshot({path:`${SHOTS}/gps-fix.png`,animations:'disabled'});

 // popover input: move the receiver to Tokyo-ish coordinates (west longitude to exercise the W hemisphere)
 const pop=await openPopover(page,'gps1');
 const sliders=pop.locator('input[type=range]');
 await setRange(sliders.nth(0),35.6762);
 await setRange(sliders.nth(1),-139.6503);
 await untilRows(page,{0:'FIX 08 SAT',1:'35.67620 N',2:'139.65030 W'});
 await expect(page.getByTestId('lab-serial')).toContainText(/35\.67620 N 139\.65030 W/);
 await page.screenshot({path:`${SHOTS}/gps-moved.png`,animations:'disabled'});

 // the goal (screen shows the moved position) is saved in the browser
 await expect.poll(()=>page.evaluate(()=>Object.values(localStorage).some(v=>v.includes('gps-tracker'))),{timeout:15000}).toBe(true);

 // switch the fix off: the module sends the empty sentences and the screen says NO FIX with dashes
 await pop.getByTestId('lab-pop-fix').setChecked(false,{force:true});
 await untilRows(page,{0:'NO FIX',1:'-',2:'-'});
 expect((await stateOf(page,'gps1'))!.fix).toBe(false);
 await page.screenshot({path:`${SHOTS}/gps-nofix.png`,animations:'disabled'});
});
