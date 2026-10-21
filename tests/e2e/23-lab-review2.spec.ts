import {test,expect,type Page} from '@playwright/test';

/** Lab review round 2: measurable regressions (zoom floor, pill overflow, traffic-light value, record text, callout mix, mobile overlays, minimap, camera stability, code scroll). */
const PUBLIC=process.env.E2E_PUBLIC??'http://iot.admin.localhost:8891';
const SHOTS='test-results/lab-review2';

interface Pose{x:number;z:number;az:number;zoom:number}
type LabHook={project(t:string):{x:number;y:number;visible:boolean}|null;cameraPose():Pose;selectedPart():string|null;zoomLevel():number;focus(t:string|null):void;targetRect(t:string):{x:number;y:number;w:number;h:number}|null};
const hook=(page:Page)=>page.evaluate(()=>{const sc=(window as unknown as {__labScene:LabHook}).__labScene;return {pose:sc.cameraPose(),sel:sc.selectedPart(),zoom:sc.zoomLevel()};});
async function openLab(page:Page,lesson:string){
 await page.goto(`${PUBLIC}/lab/${lesson}?e2e=1`);
 await expect(page.locator('.lab')).toHaveAttribute('data-scene','ready',{timeout:30000});
 await page.waitForTimeout(1500);
}
const setRange=(loc:ReturnType<Page['locator']>,v:number)=>loc.evaluate((el:HTMLInputElement,val)=>{
 Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(el,String(val));el.dispatchEvent(new Event('input',{bubbles:true}));
},v);

test('UNO sub-parts zoom in (>= 1.25) from a click, from Components and from "Zoom to it"',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await openLab(page,'parking');
 for(const id of ['uno.usb','uno.mcu','uno.power-jack']){
  await page.evaluate(()=>(window as unknown as {__labScene:LabHook}).__labScene.focus(null));
  await expect.poll(async()=>(await hook(page)).zoom,{timeout:4000}).toBeLessThan(1.05);
  await page.getByTestId('lab-rail-parts').click();
  await page.getByTestId(`lab-comp-${id}`).click();
  await expect.poll(async()=>(await hook(page)).zoom,{timeout:4000}).toBeGreaterThanOrEqual(1.25);
  expect((await hook(page)).sel).toBe(id);
  // "Zoom to it" after the user zoomed out again brings it back in
  await page.evaluate(()=>(window as unknown as {__labScene:LabHook}).__labScene.focus(null));
  await expect.poll(async()=>(await hook(page)).zoom,{timeout:4000}).toBeLessThan(1.05);
  await page.evaluate(t=>(window as unknown as {__labScene:LabHook}).__labScene.focus(t),id);
  await expect.poll(async()=>(await hook(page)).zoom,{timeout:4000}).toBeGreaterThanOrEqual(1.25);
 }
});

test('pill text never overflows its pill, and the traffic-light callout shows the lit LED',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await openLab(page,'parking');
 await page.getByTestId('lab-run').first().click();
 await expect(page.getByTestId('lab-serial')).toContainText(/\d+ cm/,{timeout:15000});
 const traffic=page.locator('.lab-callout[data-target=ledR] .lab-callout-live span');
 await expect(traffic).toHaveText('GREEN',{timeout:5000}); // obstacle at 60 cm, farCm 40
 await setRange(page.locator('[data-testid=lab-control-obs1] input[type=range]'),10);
 await expect(traffic).toHaveText('RED · stop',{timeout:8000});
 await setRange(page.locator('[data-testid=lab-control-obs1] input[type=range]'),25);
 await expect(traffic).toHaveText('YELLOW · slow',{timeout:8000});
 await page.getByTestId('lab-rail-parts').click();
 await page.getByTestId('lab-comp-uno.mcu').click();
 await page.waitForTimeout(1200);
 const over=await page.evaluate(()=>[...document.querySelectorAll<HTMLElement>('.lab-callout[data-pill=true]')].filter(e=>e.style.opacity==='1').map(e=>{
  const live=e.querySelector<HTMLElement>('.lab-callout-live span');
  return {t:e.dataset.target,pill:e.scrollWidth-e.clientWidth,live:live?live.scrollWidth-live.clientWidth:0};
 }));
 expect(over.length).toBeGreaterThan(0);
 for(const o of over){expect(o.pill,`pill ${o.t}`).toBeLessThanOrEqual(1);expect(o.live,`live ${o.t}`).toBeLessThanOrEqual(1);}
 await page.screenshot({path:`${SHOTS}/pills.png`,animations:'disabled'});
});

test('a view is never a mix of cards and pills, and no card covers the part it labels',async({page})=>{
 for(const [w,h] of [[1440,900],[1280,720]] as const){
  await page.setViewportSize({width:w,height:h});
  await openLab(page,'parking');
  await page.waitForTimeout(600);
  const r=await page.evaluate(()=>{
   const sc=(window as unknown as {__labScene:LabHook}).__labScene;
   const cv=document.querySelector('canvas.lab-canvas')!.getBoundingClientRect();
   const shown=[...document.querySelectorAll<HTMLElement>('.lab-callout')].filter(e=>e.style.opacity==='1');
   const kinds=new Set(shown.map(e=>e.dataset.pill));
   const covers=shown.filter(e=>e.dataset.pill==='false').filter(e=>{
    const b=e.getBoundingClientRect(),t=sc.targetRect(e.dataset.target!);if(!t)return false;
    const x=t.x+cv.left,y=t.y+cv.top;
    return b.left<x+t.w-2&&b.right>x+2&&b.top<y+t.h-2&&b.bottom>y+2;
   }).map(e=>e.dataset.target);
   return {kinds:[...kinds],covers};
  });
  expect(r.kinds.length,`${w}: one callout style`).toBeLessThanOrEqual(1);
  expect(r.covers,`${w}: cards over their part`).toEqual([]);
  await page.screenshot({path:`${SHOTS}/callouts-${w}.png`,animations:'disabled'});
 }
});

test('the test record never clips its text',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await openLab(page,'blink');
 await page.getByTestId('lab-run').first().click();
 const rec=page.getByTestId('lab-test-record');
 await expect(rec).toBeVisible({timeout:30000});
 await page.waitForTimeout(600);
 const clipped=await rec.evaluate(el=>[...el.querySelectorAll<HTMLElement>('dd,dt,.lab-record-fw')].filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>e.textContent));
 expect(clipped).toEqual([]);
 await expect(rec).not.toContainText('(cycle-e');
 await page.screenshot({path:`${SHOTS}/record.png`,animations:'disabled'});
});

test('mobile L11: at most two pills, the dock is a 32px chip that opens the sheet',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await openLab(page,'parking');
 await page.getByTestId('lab-run').first().click();
 await page.waitForTimeout(1500);
 const pills=await page.locator('.lab-callout[data-pill=true]').evaluateAll(els=>els.filter(e=>(e as HTMLElement).style.opacity==='1').length);
 expect(pills).toBeLessThanOrEqual(2);
 const chip=page.getByTestId('lab-control-obs1');
 expect(await chip.evaluate(e=>e.tagName)).toBe('BUTTON');
 expect((await chip.boundingBox())!.height).toBeLessThanOrEqual(32.5);
 await expect(page.locator('.lab-dock input[type=range]')).toHaveCount(0);
 await chip.click();
 await expect(page.getByTestId('lab-popover-obs1')).toBeVisible();
 await page.screenshot({path:`${SHOTS}/mobile-l11.png`,animations:'disabled'});
});

test('mobile AI build: the caption sits below the sticky header and the lesson title is replaced',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await openLab(page,'blink');
 await page.getByTestId('lab-ai-open').click();
 await page.locator('[data-testid^=lab-ai-ex-]').first().click();
 await expect(page.getByTestId('lab-ai-caption')).toBeVisible({timeout:20000});
 await page.waitForTimeout(800);
 const top=await page.getByTestId('lab-ai-caption').evaluate(e=>e.getBoundingClientRect().top);
 expect(top).toBeGreaterThanOrEqual(52);
 const stage=await page.locator('.lab-stage-card').boundingBox();
 expect(stage!.y).toBeLessThan(700); // the stage being built is on screen under the caption
 await expect(page.locator('.lab-mobile-title')).not.toContainText('Blink');
 await expect(page.locator('.lab-mobile-title')).toContainText(/AI BUILD/i);
 await page.screenshot({path:`${SHOTS}/mobile-ai.png`,animations:'disabled'});
});

test('the obstacle stays clear of the sensor and the breadboard at 3 cm',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await openLab(page,'distance');
 await setRange(page.locator('[data-testid=lab-control-obs1] input[type=range]'),3);
 await page.waitForTimeout(800);
 const r=await page.evaluate(()=>{
  const sc=(window as unknown as {__labScene:LabHook}).__labScene;
  return {o:sc.targetRect('obs1'),s:sc.targetRect('us1'),b:sc.targetRect('breadboard')};
 });
 expect(r.o&&r.s).toBeTruthy();
 await page.screenshot({path:`${SHOTS}/obstacle-3cm.png`,animations:'disabled'});
});

test('minimap markers stay inside the frame',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await openLab(page,'parking');
 await page.getByTestId('lab-rail-parts').click();
 await page.getByTestId('lab-comp-obs1').click();
 await page.waitForTimeout(1000);
 const m=page.getByTestId('lab-minimap');
 await expect(m).toBeVisible();
 // no dark marker pixels hug the very edge of the canvas
 const edge=await page.getByTestId('lab-minimap-canvas').evaluate((cv:HTMLCanvasElement)=>{
  const g=cv.getContext('2d')!,d=g.getImageData(0,0,cv.width,cv.height).data;let bad=0;const w=cv.width,h=cv.height,k=Math.round(w/156*3);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){if(x>=k&&x<w-k&&y>=k&&y<h-k)continue;const i=(y*w+x)*4;if(d[i+3]>200&&d[i]+d[i+1]+d[i+2]<300)bad++;}
  return bad;
 });
 expect(edge).toBe(0);
 await page.screenshot({path:`${SHOTS}/minimap.png`,animations:'disabled'});
});

test('toggling Callout labels does not move the camera or the page',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await openLab(page,'distance');
 const p0=(await hook(page)).pose;
 await page.getByTestId('lab-rail-settings').click();
 await page.getByTestId('lab-set-labels').click();
 await page.waitForTimeout(1200);
 const p1=(await hook(page)).pose;
 await page.getByTestId('lab-set-labels').click();
 await page.waitForTimeout(1200);
 const p2=(await hook(page)).pose;
 for(const p of [p1,p2]){expect(Math.hypot(p.x-p0.x,p.z-p0.z)).toBeLessThan(0.05);expect(p.zoom).toBeCloseTo(p0.zoom,3);}
 // phone: scrollY and camera stay put too
 await page.setViewportSize({width:390,height:844});
 await openLab(page,'distance');
 await page.getByRole('button',{name:'Settings'}).last().click();
 const y0=await page.evaluate(()=>window.scrollY),c0=(await hook(page)).pose;
 await page.getByTestId('lab-set-labels').click();
 await page.waitForTimeout(1200);
 expect(await page.evaluate(()=>window.scrollY)).toBe(y0);
 const c1=(await hook(page)).pose;
 expect(Math.hypot(c1.x-c0.x,c1.z-c0.z)).toBeLessThan(0.05);
 expect(c1.zoom).toBeCloseTo(c0.zoom,3);
});

test('code auto-scroll lands on whole lines',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await openLab(page,'parking');
 await page.getByTestId('lab-run').first().click();
 await expect(page.getByTestId('lab-serial')).toContainText(/\d+ cm/,{timeout:15000});
 await page.waitForTimeout(1500);
 const r=await page.getByTestId('lab-code').evaluate(b=>{
  const lh=(b.querySelector('[data-line="11"]')!.getBoundingClientRect().top-b.querySelector('[data-line="1"]')!.getBoundingClientRect().top)/10,pad=b.querySelector<HTMLElement>('[data-line="1"]')!.offsetTop;
  return {st:b.scrollTop,lh,pad,fits:b.scrollHeight<=b.clientHeight};
 });
 expect(r.st).toBeGreaterThan(0);
 const frac=((r.st-r.pad)/r.lh)%1;
 expect(Math.min(frac,1-frac)).toBeLessThan(0.03);
 // a short sketch that fits never scrolls
 await openLab(page,'blink');
 await page.getByTestId('lab-run').first().click();
 await page.waitForTimeout(1500);
 const short=await page.getByTestId('lab-code').evaluate(b=>({st:b.scrollTop,fits:b.scrollHeight<=b.clientHeight}));
 if(short.fits)expect(short.st).toBe(0);
});
