import {test,expect,type Page} from '@playwright/test';
import {grantLab} from './lab-access';

/** Lab interaction parity: click-to-focus, minimap, selection ring, Components panel, settings, WASD camera, threshold popovers, live drag. */
const PUBLIC=process.env.E2E_PUBLIC??'http://iot.admin.localhost:8891';
test.beforeEach(({page})=>grantLab(page,PUBLIC));
const SHOTS='test-results/lab-parity';

interface Pose{x:number;z:number;az:number;zoom:number}
type LabHook={project(t:string):{x:number;y:number;visible:boolean}|null;cameraPose():Pose;selectedPart():string|null;zoomLevel():number};
const hook=(page:Page)=>page.evaluate(()=>{const sc=(window as unknown as {__labScene:LabHook}).__labScene;return {pose:sc.cameraPose(),sel:sc.selectedPart(),zoom:sc.zoomLevel()};});

/** Page-coordinate position of a part, via the dev hook (?e2e=1). dy nudges off the exact top vertex of thin parts. */
async function partAt(page:Page,id:string,dy=0){
 const p=await page.evaluate(t=>{
  const sc=(window as unknown as {__labScene?:LabHook}).__labScene;
  const r=document.querySelector('canvas.lab-canvas')!.getBoundingClientRect();
  const q=sc?.project(t);
  return q?{x:r.left+q.x,y:r.top+q.y}:null;
 },id);
 expect(p,`part ${id} projected`).not.toBeNull();
 return {x:p!.x,y:p!.y+dy};
}
async function openLab(page:Page,lesson:string,seed?:Record<string,unknown>){
 if(seed)await page.addInitScript(s=>{if(sessionStorage.getItem('seeded'))return;sessionStorage.setItem('seeded','1');for(const [k,v] of Object.entries(s))localStorage.setItem(k,JSON.stringify(v));},seed);
 await page.goto(`${PUBLIC}/lab/${lesson}?e2e=1`);
 await expect(page.locator('.lab')).toHaveAttribute('data-scene','ready',{timeout:30000});
 await page.waitForTimeout(1200);
}
const setRange=(page:Page,loc:ReturnType<Page['locator']>,v:number)=>loc.evaluate((el:HTMLInputElement,val)=>{
 Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(el,String(val));el.dispatchEvent(new Event('input',{bubbles:true}));
},v);

test('clicking a part zooms onto it, callouts become pills, the minimap appears, the floor ring marks it',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await openLab(page,'parking');
 await expect(page.getByTestId('lab-minimap')).toHaveCount(0);
 await expect(page.locator('.lab-callout[data-pill=true]')).toHaveCount(0);
 const z0=(await hook(page)).zoom;
 const at=await partAt(page,'ledR',5);
 await page.mouse.click(at.x,at.y);
 await expect.poll(async()=>(await hook(page)).zoom,{timeout:4000}).toBeGreaterThan(z0*1.4);
 expect((await hook(page)).sel).toBe('ledR');
 await expect(page.getByTestId('lab-minimap')).toBeVisible();
 await expect(page.locator('.lab-callout[data-pill=true]').first()).toBeAttached();
 await page.screenshot({path:`${SHOTS}/focused-led.png`,animations:'disabled'});
 // Escape returns to the full view and removes ring, pills and minimap
 await expect(page.getByTestId('lab-popover-ledR')).toBeVisible();
 await page.keyboard.press('Escape'); // first Escape closes the popover
 await expect(page.getByTestId('lab-popover-ledR')).toHaveCount(0);
 await page.keyboard.press('Escape'); // second one leaves the focused view
 await expect(page.getByTestId('lab-minimap')).toHaveCount(0);
 await expect.poll(async()=>(await hook(page)).zoom,{timeout:4000}).toBeLessThan(1.05);
 expect((await hook(page)).sel).toBeNull();
});

test('the minimap click recentres the camera',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await openLab(page,'distance');
 await page.getByTestId('lab-rail-parts').click();
 await page.getByTestId('lab-comp-us1').click();
 const m=page.getByTestId('lab-minimap-canvas');
 await expect(m).toBeVisible();
 await page.waitForTimeout(800);
 const before=(await hook(page)).pose;
 const box=(await m.boundingBox())!;
 await page.mouse.click(box.x+box.width*0.2,box.y+box.height*0.75);
 await page.waitForTimeout(800);
 const after=(await hook(page)).pose;
 expect(Math.hypot(after.x-before.x,after.z-before.z)).toBeGreaterThan(8);
 expect(after.zoom).toBeCloseTo(before.zoom,1);
});

test('Components panel lists the parts in view and a row focuses the part',async({page})=>{
 await page.setViewportSize({width:1280,height:720});
 await openLab(page,'parking');
 await page.getByTestId('lab-rail-parts').click();
 const count=page.getByTestId('lab-components-count');
 await expect(count).toHaveText(/^\d+ in view$/);
 expect(Number((await count.innerText()).split(' ')[0])).toBeGreaterThanOrEqual(9);
 for(const id of ['us1','obs1','ledR','ledG','bz1'])await expect(page.getByTestId(`lab-comp-${id}`)).toBeVisible();
 await expect(page.getByTestId('lab-comp-obs1')).toContainText(/obstacle/i);
 await page.screenshot({path:`${SHOTS}/components.png`,animations:'disabled'});
 const z0=(await hook(page)).zoom;
 await page.getByTestId('lab-comp-obs1').click();
 await expect.poll(async()=>(await hook(page)).zoom,{timeout:4000}).toBeGreaterThan(z0*1.4);
 expect((await hook(page)).sel).toBe('obs1');
 // board features focus too
 await page.getByTestId('lab-rail-parts').click();
 await page.getByTestId('lab-comp-uno.mcu').click();
 await expect.poll(async()=>(await hook(page)).sel).toBe('uno.mcu');
});

test('settings toggles really work and persist',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await openLab(page,'blink',{'iot-lab:done':['board','blink'],'iot-lab:settings':{autoRotate:false}});
 const canvas=page.locator('canvas.lab-canvas');
 await expect(page.getByTestId('lab-progress')).toHaveAttribute('data-count','2');
 await page.getByTestId('lab-rail-settings').click();
 // callout labels
 await expect(page.getByTestId('lab-callouts')).toBeVisible();
 await page.getByTestId('lab-set-labels').click();
 await expect(page.getByTestId('lab-callouts')).toHaveCount(0);
 await page.getByTestId('lab-set-labels').click();
 await expect(page.getByTestId('lab-callouts')).toBeVisible();
 // floor grid
 await expect(canvas).toHaveAttribute('data-grid','true');
 await page.getByTestId('lab-set-grid').click();
 await expect(canvas).toHaveAttribute('data-grid','false');
 // turntable: rotates only after the camera has been idle
 await expect(canvas).toHaveAttribute('data-turntable','false');
 const az0=(await hook(page)).pose.az;
 await page.getByTestId('lab-set-autoRotate').click();
 await expect(canvas).toHaveAttribute('data-turntable','true');
 await page.waitForTimeout(4200);
 expect(Math.abs((await hook(page)).pose.az-az0)).toBeGreaterThan(0.02);
 await page.getByTestId('lab-set-autoRotate').click();
 // sound + reduce motion are stored
 await page.getByTestId('lab-set-sound').click();
 await page.getByTestId('lab-set-reducedMotion').click();
 await expect(page.locator('.lab')).toHaveClass(/lab--reduced/);
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('iot-lab:settings')!));
 expect(saved).toMatchObject({sound:false,reducedMotion:true,grid:false,labels:true,autoRotate:false});
 // reset progress
 await page.getByTestId('lab-set-reset').click();
 await expect(page.getByTestId('lab-progress')).toHaveAttribute('data-count','0');
 await page.screenshot({path:`${SHOTS}/settings.png`,animations:'disabled'});
 await page.reload();
 await expect(page.locator('.lab')).toHaveAttribute('data-scene','ready',{timeout:30000});
 await expect(page.locator('canvas.lab-canvas')).toHaveAttribute('data-grid','false');
});

test('WASD pans the camera, Q/E rotate, scroll zooms, and the hint pill says so',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await openLab(page,'distance');
 await expect(page.locator('.lab-hint')).toContainText('WASD');
 const p0=(await hook(page)).pose;
 await page.mouse.move(600,300);
 await page.keyboard.down('d');await page.waitForTimeout(500);await page.keyboard.up('d');
 const p1=(await hook(page)).pose;
 expect(Math.hypot(p1.x-p0.x,p1.z-p0.z)).toBeGreaterThan(4);
 await page.keyboard.down('w');await page.waitForTimeout(500);await page.keyboard.up('w');
 const p2=(await hook(page)).pose;
 expect(Math.hypot(p2.x-p1.x,p2.z-p1.z)).toBeGreaterThan(4);
 const stopped=(await hook(page)).pose;await page.waitForTimeout(300);
 expect(Math.hypot((await hook(page)).pose.x-stopped.x,(await hook(page)).pose.z-stopped.z)).toBeLessThan(0.01);
 await page.keyboard.press('e');
 await expect.poll(async()=>Math.abs((await hook(page)).pose.az-p2.az)).toBeGreaterThan(1.3);
 const z0=(await hook(page)).zoom;
 await page.mouse.wheel(0,-400);
 await expect.poll(async()=>(await hook(page)).zoom).toBeGreaterThan(z0*1.2);
});

test('threshold parts open a popover whose sliders patch the firmware, and the sim reacts',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await openLab(page,'parking');
 await page.getByTestId('lab-rail-parts').click();
 await page.getByTestId('lab-comp-ledY').click();
 await page.waitForTimeout(900);
 const at=await partAt(page,'ledY',4);
 await page.mouse.click(at.x,at.y);
 const pop=page.getByTestId('lab-popover-ledY');
 await expect(pop).toBeVisible();
 await expect(pop.locator('h2')).toHaveText(/traffic light/i);
 await expect(pop).toContainText(/red within/i);
 await expect(pop).toContainText(/green beyond/i);
 await page.screenshot({path:`${SHOTS}/threshold-popover.png`,animations:'disabled'});
 // obstacle sits at 60 cm: with the default farCm (40) the light is green. Raise "green beyond" to 100 and it must turn yellow.
 await setRange(page,pop.locator('input[type=range]').nth(1),100);
 await expect(page.locator('.lab-code,[data-testid=lab-code]').first()).toContainText('farCm = 100');
 await page.getByTestId('lab-run').first().click();
 await expect(page.getByTestId('lab-serial')).toContainText(/SLOW/,{timeout:8000});
 // Run closed the popover (outside click); reopen it and move "red within" too: it is written into flash and the sim restarts
 const again=await partAt(page,'ledY',4);
 await page.mouse.click(again.x,again.y);
 await expect(pop).toBeVisible();
 await setRange(page,pop.locator('input[type=range]').nth(0),50);
 await setRange(page,pop.locator('input[type=range]').nth(1),100);
 await expect(page.getByTestId('lab-serial')).toContainText('Wrote nearCm = 50',{timeout:8000});
});

test('dragging the obstacle with its popover open: the distance slider follows live and the lights react',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await openLab(page,'parking');
 await page.getByTestId('lab-run').first().click();
 await page.getByTestId('lab-rail-parts').click();
 await page.getByTestId('lab-comp-obs1').click();
 await page.waitForTimeout(900);
 const at=await partAt(page,'obs1');
 await page.mouse.click(at.x,at.y);
 const pop=page.getByTestId('lab-popover-obs1');
 await expect(pop).toBeVisible();
 await expect(pop).toContainText(/or drag it in the scene/i);
 const out=pop.locator('output');
 const before=Number((await out.innerText()).replace(/\D/g,''));
 const from=await partAt(page,'obs1');
 await page.mouse.move(from.x,from.y);await page.mouse.down();
 for(let i=1;i<=14;i++)await page.mouse.move(from.x-i*7,from.y-i*5);
 const during=Number((await out.innerText()).replace(/\D/g,''));
 await page.mouse.up();
 expect(during).not.toBe(before);
 await expect(pop).toBeVisible();
 await page.screenshot({path:`${SHOTS}/drag-live.png`,animations:'disabled'});
 await expect(page.getByTestId('lab-serial')).toContainText(new RegExp(`\\b(${during-1}|${during}|${during+1}) cm`),{timeout:6000});
});

test('rail: run button toggles the simulation and the sidebar expands',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await openLab(page,'blink');
 await page.getByTestId('lab-rail-run').click();
 await expect(page.locator('.lab')).toHaveAttribute('data-sim-status','running');
 await page.getByTestId('lab-rail-run').click();
 await expect(page.locator('.lab')).toHaveAttribute('data-sim-status','stopped');
 await page.getByTestId('lab-rail-expand').click();
 await expect(page.locator('.lab-rail')).toHaveAttribute('data-expanded','true');
 await page.screenshot({path:`${SHOTS}/rail-expanded.png`,animations:'disabled'});
});
