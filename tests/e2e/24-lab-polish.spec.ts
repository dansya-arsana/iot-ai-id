import {test,expect,type Page} from '@playwright/test';

/** Lab final polish: pills stay off hardware and controls, leaders when far, record text whole, code box sized to content. */
const PUBLIC=process.env.E2E_PUBLIC??'http://iot.admin.localhost:8891';
type R={x:number;y:number;w:number;h:number};
type Hook={project(t:string):{x:number;y:number;visible:boolean}|null;targetRect(t:string):R|null};
const UNO=['uno.mcu','uno.led-l','uno.usb','uno.power-jack','uno.reset','uno.digital-header','uno.analog-header','uno.power-header'];
const LESSONS=['board','blink','button','knob','rgb','light','distance','sound','motor','servo','parking'];
async function openLab(page:Page,lesson:string){
 await page.goto(`${PUBLIC}/lab/${lesson}?e2e=1`);
 await expect(page.locator('.lab')).toHaveAttribute('data-scene','ready',{timeout:30000});
 await page.waitForTimeout(1500);
}

for(const vp of [{width:1440,height:900},{width:1280,height:720},{width:390,height:844}]){
 test(`pills avoid hardware and controls, and lead to far anchors at ${vp.width}`,async({page})=>{
  test.setTimeout(240000);
  await page.setViewportSize(vp);
  const bad:string[]=[];
  for(const l of LESSONS){
   await openLab(page,l);
   await page.getByTestId('lab-run').first().click();
   await page.waitForTimeout(3000);
   const res=await page.evaluate(ids=>{
    const sc=(window as unknown as {__labScene:Hook}).__labScene;
    const stage=document.querySelector('.lab-stage')!,sr0=stage.getBoundingClientRect(),k=sr0.width/stage.clientWidth;const sr={left:sr0.left,top:sr0.top,width:stage.clientWidth};
    const boxes:{n:string;r:R}[]=[];
    const callouts=[...document.querySelectorAll<HTMLElement>('.lab-callout')];
    for(const c of callouts){const t=c.dataset.target!;const r=sc.targetRect(t);if(r)boxes.push({n:t,r});}
    for(const t of ids){const r=sc.targetRect(t);if(r)boxes.push({n:t,r});}
    document.querySelectorAll('.lab-viewbar,.lab-dock:not([data-folded=true]),.lab-dockchip:not([data-folded=true]),.lab-minimap').forEach(n=>{const b=n.getBoundingClientRect();if(b.width>0)boxes.push({n:n.className,r:{x:(b.left-sr.left)/k,y:(b.top-sr.top)/k,w:b.width/k,h:b.height/k}});});
    const out:string[]=[];
    const paths=[...document.querySelectorAll<SVGPathElement>('.lab-leader')];
    callouts.forEach((c,i)=>{
     if(c.dataset.pill!=='true'||c.style.opacity==='0')return;
     const b=c.getBoundingClientRect(),p={x:(b.left-sr.left)/k,y:(b.top-sr.top)/k,w:b.width/k,h:b.height/k};
     for(const o of boxes)if(p.x<o.r.x+o.r.w-1&&p.x+p.w>o.r.x+1&&p.y<o.r.y+o.r.h-1&&p.y+p.h>o.r.y+1)out.push(`${c.dataset.target} overlaps ${o.n}`);
     if(p.x<-1||p.x+p.w>sr.width+1)out.push(`${c.dataset.target} outside stage`);
     const pr=sc.project(c.dataset.target!);if(!pr)return;
     const dx=Math.max(p.x-pr.x,0,pr.x-(p.x+p.w)),dy=Math.max(p.y-pr.y,0,pr.y-(p.y+p.h));
     if(Math.hypot(dx,dy)>20.5&&paths[i]?.style.opacity!=='1')out.push(`${c.dataset.target} far without leader`);
    });
    return out;
   },UNO);
   for(const m of res)bad.push(`${l}: ${m}`);
  }
  expect(bad).toEqual([]);
 });
}

test('record text is whole at 1280 (blink)',async({page})=>{
 await page.setViewportSize({width:1280,height:720});
 await openLab(page,'blink');
 await page.getByTestId('lab-run').first().click();
 const rec=page.getByTestId('lab-test-record');
 await expect(rec).toBeVisible({timeout:30000});
 await page.waitForTimeout(600);
 const clipped=await rec.evaluate(el=>[...el.querySelectorAll<HTMLElement>('dd,dt,.lab-record-fw')].filter(e=>e.scrollWidth>e.clientWidth+1||getComputedStyle(e).textOverflow==='ellipsis').map(e=>e.textContent));
 expect(clipped).toEqual([]);
 await expect(rec).toContainText('cycle-exact');
});

test('mobile code box is sized to its content',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await openLab(page,'blink');
 const m=await page.getByTestId('lab-code').evaluate(el=>({sh:el.scrollHeight,ch:el.clientHeight}));
 expect(m.sh).toBeLessThanOrEqual(m.ch+1);
});

test('L11 record keeps "green at 60 cm" whole at 1280',async({page})=>{
 await page.setViewportSize({width:1280,height:720});
 await openLab(page,'parking');
 await page.getByTestId('lab-run').first().click();
 const slider=page.locator('[data-testid^=lab-control-] input[type=range]').first();
 const set=(v:number)=>slider.evaluate((el:HTMLInputElement,val)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(el,String(val));el.dispatchEvent(new Event('input',{bubbles:true}));},v);
 await page.waitForTimeout(1500);await set(10);await page.waitForTimeout(2500);await set(150);
 const rec=page.getByTestId('lab-test-record');
 await expect(rec).toBeVisible({timeout:30000});
 await page.waitForTimeout(600);
 await expect(rec).toContainText('green at');
 const clipped=await rec.evaluate(el=>[...el.querySelectorAll<HTMLElement>('dd,dt')].filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>e.textContent));
 expect(clipped).toEqual([]);
});

test('clock record header and rows sit inside the dock at 1440',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await openLab(page,'clock');
 await page.getByTestId('lab-run').first().click();
 const rec=page.getByTestId('lab-test-record');
 await expect(rec).toBeVisible({timeout:60000});
 await page.waitForTimeout(600);
 const out=await rec.evaluate(el=>{const d=el.closest('.lab-signals')!.getBoundingClientRect();return [...el.querySelectorAll<HTMLElement>('header,dt,dd,.lab-record-fw')].filter(e=>{const r=e.getBoundingClientRect();return r.top<d.top-1||r.bottom>d.bottom+1}).map(e=>e.textContent)});
 expect(out).toEqual([]);
});
